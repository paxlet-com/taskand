import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
import uuid
import subprocess

from gateway.context import ContextError, Store, redact
from gateway import GatewayHTTPHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent.parent


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='taskand-context-test-')
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(Path(self.tmp.name) / 'private')

    def profile(self, parent=None, refs=()):
        return self.store.profile('alice', {'label': 'Synthetic operator', 'prompts': ['Pokaż stan'], 'synthetic': True}, refs, parent)

    def test_metadata_only_and_answer_relationship(self):
        request = self.store.begin('alice', '/api/chat', {'message': 'private-sentinel-secret'})
        obj = self.store.get('alice', request['promptRef'])
        self.assertIsNone(obj['payload']['parts'][0]['text'])
        self.assertTrue(obj['payload']['inputDigest'].startswith('hmac-sha256:'))
        done = self.store.finish('alice', request['requestId'], {'ok': True, 'reply': 'private-reply'})
        self.assertEqual(self.store.get('alice', done['answerRef'])['refs'], [obj['urn']])
        self.assertNotIn(b'private-sentinel-secret', self.store.path.read_bytes())
        self.assertNotIn(b'private-reply', self.store.path.read_bytes())

    def test_redaction_opt_in(self):
        result = self.store.begin('alice', 'chat', {'message': 'password=test-only-secret Bearer hidden-token'}, retain=True)
        text = self.store.get('alice', result['promptRef'])['payload']['parts'][0]['text']
        self.assertNotIn('test-only-secret', text)
        self.assertNotIn('hidden-token', text)

    def test_owner_and_missing_reference(self):
        obj = self.profile()
        with self.assertRaises(ContextError): self.store.get('bob', obj['urn'])
        with self.assertRaises(ContextError): self.profile(refs=['urn:uuid:' + str(uuid.uuid4())])
        self.assertEqual(len(self.store.list('alice')), 1)

    def test_versions_and_composition(self):
        first = self.profile()
        second = self.profile(parent=first['urn'])
        composite = self.profile(refs=[first['urn'], second['urn']])
        self.assertEqual(second['family'], first['family'])
        self.assertEqual(second['revision'], 2)
        self.assertEqual(self.store.get('alice', first['urn'])['revision'], 1)
        self.assertEqual(composite['refs'], [first['urn'], second['urn']])
        with self.assertRaises(ContextError): self.profile(parent=first['urn'])

    def test_concurrent_revision_cas(self):
        first = self.profile()
        def attempt():
            try: return self.profile(parent=first['urn'])['revision']
            except ContextError: return 'stale'
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            self.assertCountEqual(list(pool.map(lambda _: attempt(), range(2))), [2, 'stale'])

    def test_duplicate_request_rolls_back_prompt(self):
        first = self.store.begin('alice', 'chat', {'message': 'hello'})
        with self.assertRaises(ContextError): self.store.begin('alice', 'chat', {'message': 'again'}, first['requestId'])
        self.assertEqual(len(self.store.list('alice', 'prompt')), 1)

    def test_synthetic_required_and_no_secret_fixtures(self):
        for payload in ({'label': 'x', 'prompts': ['hello'], 'synthetic': False},
                        {'label': 'x', 'prompts': ['password=secret'], 'synthetic': True}):
            with self.assertRaises(ContextError): self.store.profile('alice', payload)

    def test_graph_is_factual_not_task_success(self):
        request = self.store.begin('alice', 'chat', {'message': 'status'})
        self.store.event('alice', request['requestId'], 'call:1', 'CALLING', 'proc://test')
        graph = self.store.graph('alice', request['requestId'])
        self.assertEqual(graph['nodes'][-1]['state'], 'CALLING')
        self.assertFalse(graph['taskSuccessVerified'])
        with self.assertRaises(ContextError): self.store.graph('bob', request['requestId'])

    def test_addressable_event_and_owner(self):
        request = self.store.begin('alice', 'chat', {'message': 'status'})
        event = self.store.graph('alice', request['requestId'])['events'][0]
        resolved = self.store.get('alice', event['urn'])
        self.assertEqual(resolved['kind'], 'event')
        self.assertEqual(resolved['refs'], [request['promptRef']])
        with self.assertRaises(ContextError): self.store.get('bob', event['urn'])

    def test_store_permissions_and_symlink(self):
        self.assertEqual(self.store.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.store.root.stat().st_mode & 0o777, 0o700)
        linked = Path(self.tmp.name) / 'link'
        linked.symlink_to(self.store.root, target_is_directory=True)
        with self.assertRaises(ContextError): Store(linked)


class PlannerTests(unittest.TestCase):
    def run_planner(self, value):
        run = subprocess.run(['node', str(ROOT / 'generated/planner/plan/taskand.dev/v1/bin.mjs')], input=json.dumps(value), text=True, capture_output=True, timeout=30, cwd=ROOT)
        self.assertEqual(run.returncode, 0, run.stderr)
        return json.loads(run.stdout)

    def step(self, **values):
        return {'id': 1, 'name': 'sample', 'type': 'worker', 'description': 'Sample',
                'process': 'proc://taskand.dev/monitor/cpu/v1', 'deps': [], 'params': {}, **values}

    def proposal(self, steps):
        return self.run_planner({'task': 'test', 'candidate': {'blueprint': {'goal': 'test', 'steps': steps}}})

    def test_deterministic_registry_derived_dsl(self):
        a = self.run_planner({'params': {'action': 'compile', 'task': 'test'}})
        b = self.run_planner({'action': 'compile', 'task': 'test'})
        self.assertEqual(a['dslDigest'], b['dslDigest'])
        self.assertEqual(a['status'], 'COMPILED')
        self.assertTrue(any('/registry/' in p['uri'] for p in a['dsl']['REGISTRIES']['processes']))
        self.assertFalse(a['executionReady'])

    def test_empty_and_unknown_process_rejected(self):
        empty = self.proposal([])
        self.assertEqual(empty['status'], 'REJECTED')
        self.assertIn('DSL_NONEMPTY_BOUNDED_STEPS_REQUIRED', empty['reason'])
        self.assertIn('DSL_UNRESOLVED_PROCESS', self.proposal([self.step(process='spawn:monitor-cpu')])['errors'])

    def test_nested_secret_rejected_without_invented_vault(self):
        result = self.proposal([self.step(params={'nested': {'api_key': 'sentinel'}})])
        self.assertIn('DSL_UNRESOLVED_OR_INLINE_SECRET', result['errors'])
        self.assertNotIn('vault://sample', json.dumps(result))
        self.assertNotIn('sentinel', json.dumps(result))

    def test_wrong_file_contract_and_web_strings(self):
        self.assertIn('DSL_FILE_INPUT_CONTRACT', self.proposal([self.step(process='proc://taskand.dev/file/ops/v1', params={'action': 'read', 'path': 'TBD'})])['errors'])
        self.assertIn('DSL_WEB_SCENARIO_CONTRACT', self.proposal([self.step(process='proc://taskand.dev/twin/web/v1', params={'action': 'run', 'steps': ['assert: body']})])['errors'])

    def test_missing_context_and_cycle(self):
        self.assertEqual(self.run_planner({'action': 'compile', 'task': 'test', 'contextRefs': ['urn:uuid:' + str(uuid.uuid4())]})['status'], 'REJECTED')
        self.assertIn('DSL_DEPENDENCY_CYCLE', self.proposal([self.step(deps=['sample'])])['errors'])

    def test_proposal_never_grants_execution(self):
        result = self.proposal([self.step()])
        self.assertTrue(result['contractValid'])
        self.assertFalse(result['valid'])
        self.assertNotIn('blueprint', result)
        self.assertFalse(result['productionApproved'])


class HTTPTests(StoreTests):
    def setUp(self):
        super().setUp()
        def auth(headers):
            name = headers.get('Authorization', '').removeprefix('Bearer ')
            return (True, {'name': name, 'role': 'test', 'allowed_uris': ['*'], 'allowed_actions': ['*']}) if name in {'alice', 'bob'} else (False, None)
        for target, value in [('gateway.check_auth', auth), ('gateway.auth.check_auth', auth),
                              ('gateway.handlers.context.check_auth', auth),
                              ('gateway.default_store', lambda: self.store),
                              ('gateway.handlers.context.default_store', lambda: self.store)]:
            mock = patch(target, value); mock.start(); self.addCleanup(mock.stop)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), GatewayHTTPHandler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close); self.addCleanup(self.server.shutdown)

    def http(self, path, body=None, owner='alice'):
        req = urllib.request.Request('http://127.0.0.1:' + str(self.server.server_port) + path,
              data=json.dumps(body).encode() if body is not None else None,
              headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + owner})
        try:
            with urllib.request.urlopen(req, timeout=15) as response: return response.status, json.load(response)
        except urllib.error.HTTPError as error: return error.code, json.load(error)

    def test_live_while_request_is_running_and_owner_isolation(self):
        entered, release = threading.Event(), threading.Event()
        def process(*args, **kwargs):
            entered.set(); release.wait(5); return {'ok': True, 'cpu_pct': 1}
        request_id = 'urn:uuid:' + str(uuid.uuid4())
        with patch('gateway.utils.registry', process), concurrent.futures.ThreadPoolExecutor(1) as pool:
            future = pool.submit(self.http, '/api/proc/call', {'uri': 'proc://taskand.dev/monitor/cpu/v1', 'data': {}, 'requestId': request_id})
            self.assertTrue(entered.wait(5))
            status, state = self.http('/api/state?requestId=' + request_id)
            self.assertEqual(status, 200)
            self.assertEqual(state['graph']['nodes'][-1]['state'], 'CALLING')
            self.assertEqual(self.http('/api/state?requestId=' + request_id, owner='bob')[0], 404)
            release.set(); status, result = future.result()
        self.assertEqual(status, 200)
        self.assertTrue(result['answerRef'].startswith('urn:uuid:'))
        self.assertEqual(self.http('/api/state?requestId=' + request_id)[1]['graph']['state'], 'RESPONDED')

    def test_malformed_unauthenticated_and_missing_context_do_not_execute(self):
        with patch('gateway.utils.registry') as process:
            self.assertEqual(self.http('/api/chat', [], 'alice')[0], 400)
            self.assertEqual(self.http('/api/chat', {'message': 'hello'}, 'unknown')[0], 401)
            self.assertEqual(self.http('/api/chat', {'message': 'hello', 'contextRefs': ['urn:uuid:' + str(uuid.uuid4())]})[0], 409)
            process.assert_not_called()

    def test_audit_unavailable_fails_closed(self):
        with patch.object(self.store, 'begin', side_effect=OSError('test')), patch('gateway.utils.registry') as process:
            self.assertEqual(self.http('/api/chat', {'message': 'hello'})[0], 503)
            process.assert_not_called()

    def test_profile_endpoint_and_simulation_never_execute(self):
        status, saved = self.http('/api/context', {'action': 'create_user_twin', 'payload': {'label': 'Synthetic', 'prompts': ['status'], 'synthetic': True}})
        self.assertEqual(status, 201)
        with patch('gateway.utils.registry', return_value={'status': 'COMPILED', 'dsl': {'DOCUMENT': 'TEST'}, 'dslDigest': 'fixture-only'}):
            status, simulation = self.http('/api/context', {'action': 'simulate', 'urn': saved['object']['urn']})
        self.assertEqual(status, 200)
        self.assertFalse(simulation['executed'])
        self.assertEqual(len(simulation['fixtures']), 1)


class LeaseTests(unittest.TestCase):
    def test_monotonic_receipt_stale_cas_and_idempotency(self):
        spec = importlib.util.spec_from_file_location('lease_adapter_test', ROOT / 'project/lease-controller.py')
        adapter = importlib.util.module_from_spec(spec); spec.loader.exec_module(adapter)
        backend, policy = adapter.runtimes(ROOT)
        intent = {'allowedPaths': ['test-only/**']}
        with tempfile.TemporaryDirectory(prefix='taskand-lease-test-') as directory:
            store = backend.ChangeLeaseStore(Path(directory))
            lease = store.acquire(request_id='test', repository_ref='test/repo', target_branch='main', ticket_id='ticket-001', workstream='test', scope_hash=adapter.digest(intent['allowedPaths']), branch_ref='test', worktree_id='test', owner_actor='test', owner_session='test', plan_hash=adapter.digest(intent))
            request = {'schema': policy.REQUEST_SCHEMA, 'requestId': 'start', 'leaseId': lease['leaseId'], 'action': 'begin-edit', 'expectedRevision': 1, 'expectedFencingToken': 1, 'expectedPhase': 'claimed', 'requestedBy': 'test', 'idempotencyKey': 'start', 'targetHeadSha': None, 'replacementReceiptRef': None, 'authorityRef': 'test-only', 'requestedAt': store.now().isoformat()}
            receipt, current = adapter.transition(store, policy, request, intent)
            self.assertEqual(policy.validate_receipt(receipt), [])
            self.assertEqual(current['fencingToken'], 2)
            self.assertEqual(adapter.transition(store, policy, request, intent)[0]['outcome'], 'idempotent')
            with self.assertRaises(ValueError): adapter.transition(store, policy, {**request, 'idempotencyKey': 'stale'}, intent)
            self.assertEqual(store.lease(lease['leaseId'])['fencingToken'], 2)
            cancelled, ended = adapter.transition(store, policy, {**request, 'requestId': 'cancel', 'idempotencyKey': 'cancel', 'action': 'cancel', 'expectedRevision': 2, 'expectedFencingToken': 2, 'expectedPhase': 'editing'}, intent)
            self.assertEqual(cancelled['fencingToken'], 3)
            self.assertEqual(ended['phase'], 'cancelled')
            self.assertEqual(store._read()['active'], {})


if __name__ == '__main__':
    unittest.main()
