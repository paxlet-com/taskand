"""Gossip contract tests and disposable HTTP/Node registry peers; no live node state."""
from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import MagicMock, patch

from gateway.gossip import (GossipEngine, peer_origin, start_gossip_service, stop_gossip_service,
                            MAX_PEERS, MAX_CATALOG_ENTRIES, MAX_RESPONSE_BYTES)
from gateway.handlers.gossip import handle_gossip_status, handle_gossip_trigger

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which('node')
URI = 'proc://taskand.dev/demo/hello/v1'
HASH = 'sha256:' + '1' * 64


class GossipContractTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {'TASKAND_PEERS': '', 'TASKAND_GOSSIP_PEER_TOKENS': '{}',
            'TASKAND_GOSSIP_AUTO_APPROVE': '0', 'TASKAND_GOSSIP_INTERVAL': '5',
            'TASKAND_AUTH_TOKEN': 'local-admin-must-not-leave-node'})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.addCleanup(stop_gossip_service)

    def prepared(self, *, auto_approve=False, local=None, report=None):
        engine = GossipEngine(auto_approve=auto_approve)
        engine.discover_peers = lambda: ['http://seed.invalid']
        def http(url, timeout=3, **kwargs):
            if url.endswith('healthz'):
                return {'ok': True}
            if url.endswith('gossip'):
                return {'ok': True, 'peers': {'http://untrusted.invalid': {}}}
            return {'ok': True, 'standard': 'taskand-registry/1', 'node': 'seed',
                    'processes': [{'uri': URI, 'hash': HASH}]}
        engine._http_get_json = http
        def invoke(action, data, timeout=5):
            if action == 'list':
                return {'ok': True, 'processes': local or []}
            if action == 'pull':
                return {'ok': True, 'imported': 1, 'report': report if report is not None else
                    [{'uri': URI, 'result': 'imported', 'status': 'candidate'}]}
            if action == 'approve':
                return {'ok': True}
            raise AssertionError(action)
        return engine, invoke

    def test_defaults_do_not_activate_or_inherit_admin_credentials(self):
        engine, invoke = self.prepared()
        with patch('gateway.gossip.registry', side_effect=invoke) as call:
            result = engine.sync_once()
        self.assertTrue(result['ok'], result)
        self.assertFalse(engine.auto_approve)
        self.assertNotIn('approve', [c.args[0] for c in call.call_args_list])
        pull = next(c for c in call.call_args_list if c.args[0] == 'pull')
        self.assertIsNone(pull.args[1]['token'])
        self.assertEqual(pull.args[1]['expected'], {URI: HASH})
        self.assertTrue(pull.args[1]['hold'])
        self.assertNotIn('peer_add', [c.args[0] for c in call.call_args_list])
        self.assertEqual(result['peers']['http://seed.invalid']['discovered_peers'], ['http://untrusted.invalid'])
        self.assertNotIn('local-admin', json.dumps(engine.get_status()))

    def test_explicit_approval_and_approval_failure_are_reported(self):
        engine, invoke = self.prepared(auto_approve=True)
        with patch('gateway.gossip.registry', side_effect=invoke):
            self.assertTrue(engine.sync_once()['ok'])
        self.assertEqual(engine.get_status()['peers']['http://seed.invalid']['approved_count'], 1)
        def failed(action, data, timeout=5):
            return {'ok': False} if action == 'approve' else invoke(action, data, timeout)
        with patch('gateway.gossip.registry', side_effect=failed):
            result = engine.sync_once()
        self.assertFalse(result['ok'])
        self.assertEqual(result['peers']['http://seed.invalid']['approved_count'], 0)

    def test_existing_candidate_and_deprecated_are_not_reactivated(self):
        for status in ['candidate', 'deprecated', 'active']:
            engine, invoke = self.prepared(auto_approve=True, local=[{'uri': URI, 'hash': HASH, 'status': status}])
            with self.subTest(status=status), patch('gateway.gossip.registry', side_effect=invoke) as call:
                self.assertTrue(engine.sync_once()['ok'])
                self.assertEqual([c.args[0] for c in call.call_args_list], ['list'])

    def test_existing_uri_digest_conflict_is_visible_without_overwrite(self):
        engine, invoke = self.prepared(local=[{'uri': URI, 'hash': 'sha256:' + '0' * 64, 'status': 'active'}])
        with patch('gateway.gossip.registry', side_effect=invoke) as call:
            result = engine.sync_once()
        self.assertFalse(result['ok'])
        self.assertEqual(result['peers']['http://seed.invalid']['conflicts'], [URI])
        self.assertEqual([c.args[0] for c in call.call_args_list], ['list'])

    def test_partial_import_and_incomplete_report_are_not_success(self):
        for report in [[{'uri': URI, 'result': 'rejected'}], [], [{'uri': 'wrong', 'result': 'imported'}],
                       [None], [{'uri': [], 'result': 'imported'}], [{'uri': URI, 'result': {}}]]:
            engine, invoke = self.prepared(report=report)
            with self.subTest(report=report), patch('gateway.gossip.registry', side_effect=invoke):
                result = engine.sync_once()
                self.assertFalse(result['ok'])
                self.assertEqual(result['synced_this_round'], [])

    def test_rounds_are_serialized_and_status_is_a_copy(self):
        engine, invoke = self.prepared()
        entered, release = threading.Event(), threading.Event()
        original = engine.discover_peers
        def paused():
            entered.set()
            self.assertTrue(release.wait(3))
            return original()
        engine.discover_peers = paused
        with patch('gateway.gossip.registry', side_effect=invoke) as call:
            thread = threading.Thread(target=engine.sync_once)
            thread.start()
            try:
                self.assertTrue(entered.wait(2))
                self.assertTrue(engine.sync_once()['busy'])
                self.assertEqual(call.call_count, 0)
            finally:
                release.set()
                thread.join(4)
        self.assertFalse(thread.is_alive())
        snapshot = engine.get_status()
        snapshot['peers']['http://seed.invalid']['error'] = 'mutated'
        self.assertIsNone(engine.get_status()['peers']['http://seed.invalid']['error'])

    def test_bounded_config_and_strict_origins(self):
        for origin in ['file:///tmp', 'http://name:bad', 'http://user:pass@host', 'http://host/path',
                       'http://host?', 'http://host#', 'http://host/%2e', 'http://host\\path', 'http://host\n', 'http://host:0']:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                peer_origin(origin)
        self.assertEqual(peer_origin('HTTP://LOCALHOST:80/'), 'http://localhost')
        self.assertEqual(peer_origin('http://[::1]:8077'), 'http://[::1]:8077')
        for kwargs in [{'auth_token': 'shared'}, {'interval': 0}, {'interval': float('nan')},
                       {'peer_tokens': {'http://a': 'bad\r\nheader'}},
                       {'peer_tokens': {'http://a': 'one', 'http://a:80/': 'two'}}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                GossipEngine(**kwargs)
        with patch('gateway.gossip.registry', return_value={'ok': True, 'peers': [f'http://p{i}' for i in range(MAX_PEERS + 1)]}):
            with self.assertRaises(ValueError):
                GossipEngine().discover_peers()

    def test_environment_seeds_do_not_mutate_genome(self):
        with patch.dict(os.environ, {'TASKAND_PEERS': 'http://new:80/'}), patch('gateway.gossip.registry', return_value={'ok': True, 'peers': ['http://old']}) as call:
            self.assertEqual(GossipEngine().discover_peers(), ['http://new', 'http://old'])
            self.assertEqual([c.args[0] for c in call.call_args_list], ['peers'])

    def test_catalog_limits_and_duplicate_entries(self):
        entry = {'uri': URI, 'hash': HASH}
        for processes in [[entry, entry], [{}], ['not object'], [entry] * (MAX_CATALOG_ENTRIES + 1)]:
            with self.subTest(processes=len(processes)), self.assertRaises(ValueError):
                GossipEngine._entries({'ok': True, 'standard': 'taskand-registry/1', 'processes': processes}, remote=True)

    def test_per_round_import_budget_is_global(self):
        engine, _ = self.prepared()
        engine.discover_peers = lambda: ['http://a', 'http://b']
        def http(url, *args, **kwargs):
            if url.endswith('catalog.json'):
                return {'ok': True, 'standard': 'taskand-registry/1', 'node': 'n', 'processes':
                    [{'uri': f'proc://taskand.dev/demo/p{i}/v1', 'hash': HASH} for i in range(30)]}
            return {'ok': True, 'peers': {}}
        engine._http_get_json = http
        def invoke(action, data, timeout=5):
            if action == 'list': return {'ok': True, 'processes': []}
            return {'ok': True, 'report': [{'uri': u, 'result': 'imported', 'status': 'candidate'} for u in data['uris']]}
        with patch('gateway.gossip.registry', side_effect=invoke) as call:
            result = engine.sync_once()
        self.assertEqual(sum(len(c.args[1]['uris']) for c in call.call_args_list if c.args[0] == 'pull'), 16)
        self.assertEqual(result['peers']['http://b']['deferred_count'], 14)

    def test_deadline_prevents_scheduling_further_requests(self):
        engine, invoke = self.prepared()
        with patch('gateway.gossip.ROUND_SECONDS', 0), patch('gateway.gossip.registry', side_effect=invoke) as call:
            self.assertFalse(engine.sync_once()['ok'])
            self.assertEqual(call.call_count, 0)

    def test_handlers_require_read_and_admin_grants(self):
        users = {'read': {'token': 'reader-fixture', 'role': 'user', 'allowed_uris': ['proc://taskand.dev/*'], 'allowed_actions': ['read']},
                 'admin': {'token': 'admin-fixture', 'role': 'administrator', 'allowed_uris': ['proc://taskand.dev/*'], 'allowed_actions': ['*']}}
        engine = MagicMock()
        engine.get_status.return_value = {'ok': True}
        engine.sync_once.return_value = {'ok': True}
        with patch('gateway.auth.load_grants', return_value={'users': users}), patch('gateway.handlers.gossip.get_gossip_engine', return_value=engine):
            for token, status_code, allowed in [('', 401, False), ('reader-fixture', 403, False), ('admin-fixture', 200, True)]:
                handler = MagicMock(headers={'Authorization': 'Bearer ' + token})
                engine.sync_once.reset_mock()
                handle_gossip_trigger(handler, {})
                self.assertEqual(handler._send.call_args.args[0], status_code)
                self.assertEqual(engine.sync_once.called, allowed)
            handler = MagicMock(headers={'Authorization': 'Bearer reader-fixture'})
            handle_gossip_status(handler, {})
            self.assertEqual(handler._send.call_args.args[0], 200)
            handler = MagicMock(headers={'Authorization': 'Bearer admin-fixture'})
            handle_gossip_trigger(handler, {'auto_approve': True})
            self.assertEqual(handler._send.call_args.args[0], 400)
            engine.sync_once.return_value = {'ok': False, 'busy': True}
            handle_gossip_trigger(handler, {})
            self.assertEqual(handler._send.call_args.args[0], 409)

    def test_background_start_stop_without_live_registry(self):
        with patch('gateway.gossip.registry', return_value={'ok': True, 'peers': [], 'processes': []}):
            engine = start_gossip_service()
            first = engine._thread
            engine.start()
            self.assertIs(engine._thread, first)
            stop_gossip_service()
            self.assertFalse(engine.get_status()['running'])
            self.assertFalse(first.is_alive())


class RegistryNode:
    """A real registry process and HTTP transport backed only by a temp directory."""
    def __init__(self, root, name):
        self.root, self.name = root, name
        self.core = root / 'generated/registry/core/taskand.dev/v1'
        shutil.copytree(ROOT / 'generated/registry/core/taskand.dev/v1', self.core)
        (root / 'log').mkdir()
        (root / 'genome.yaml').write_text('peers: []\npolicy:\n  peers: auto\norganisms:\n')
        self.token = name + '-read-fixture'
        self.peers = []
        self.requests = []
        self.overrides = {}
        self.port = 0
        self.server = None
        self.env = {'PATH': os.defpath, 'HOME': str(root), 'TASKAND_NODE': name}
        self.start()

    def command(self, action, data=None):
        return [NODE, str(self.core / 'bin.mjs')], json.dumps({'action': action, **(data or {})})

    def registry(self, action, data=None, timeout=10):
        argv, payload = self.command(action, data)
        result = subprocess.run(argv, input=payload, text=True, capture_output=True, cwd=self.root,
                                env=self.env, timeout=timeout + 2)
        if result.returncode:
            raise AssertionError(result.stderr or result.stdout)
        return json.loads(result.stdout)

    def add_package(self, uri=URI, message='hello', files=None):
        organism, capability, version = uri.split('/')[3:]
        directory = self.root / 'generated' / organism / capability / 'taskand.dev' / version
        directory.mkdir(parents=True)
        (directory / 'proc.yaml').write_text(f'uri: {uri}\nkind: task\norigin: builtin\n')
        (directory / 'bin.mjs').write_text("import {writeFileSync} from 'node:fs';\nwriteFileSync('executed', 'yes');\nconsole.log(JSON.stringify({message:" + json.dumps(message) + "}));\n")
        for name, content in (files or {}).items():
            (directory / name).write_bytes(content)
        result = self.registry('register', {'uri': uri, 'origin': 'builtin'})
        if not result['ok']: raise AssertionError(result)
        return directory, result['entry']['hash']

    def start(self):
        node = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def reply(self, status, payload, headers=None):
                data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
                self.send_response(status)
                for key, value in (headers or {}).items(): self.send_header(key, value)
                if 'Content-Length' not in (headers or {}): self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                with contextlib.suppress(BrokenPipeError, ConnectionResetError): self.wfile.write(data)
            def dispatch(self, method):
                node.requests.append((method, self.path, self.headers.get('Authorization')))
                override = node.overrides.get((method, self.path))
                if override:
                    self.reply(*override)
                    return
                if method == 'GET' and self.path == '/healthz': self.reply(200, {'ok': True, 'node': node.name})
                elif method == 'GET' and self.path == '/.well-known/catalog.json': self.reply(200, node.registry('export'))
                elif method == 'GET' and self.path == '/api/cluster/gossip':
                    if self.headers.get('Authorization') != 'Bearer ' + node.token: self.reply(401, {'ok': False})
                    else: self.reply(200, {'ok': True, 'peers': {p: {} for p in node.peers}})
                elif method == 'POST' and self.path == '/api/registry':
                    if self.headers.get('Authorization') != 'Bearer ' + node.token: self.reply(401, {'ok': False})
                    else:
                        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
                        if body.get('action') != 'package': self.reply(403, {'ok': False})
                        else: self.reply(200, {'ok': True, 'result': node.registry('package', {'uri': body['uri']})})
                else: self.reply(404, {'ok': False})
            def do_GET(self): self.dispatch('GET')
            def do_POST(self): self.dispatch('POST')
        self.server = ThreadingHTTPServer(('127.0.0.1', self.port), Handler)
        self.port = self.server.server_port
        self.url = f'http://127.0.0.1:{self.port}'
        self.thread = threading.Thread(target=lambda: self.server.serve_forever(poll_interval=0.03), daemon=True)
        self.thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown(); self.server.server_close(); self.thread.join(2)
            self.server = None


@unittest.skipUnless(NODE, 'Node is required for real registry peer tests')
class IsolatedPeerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.nodes = [RegistryNode(self.root / name, name) for name in ['a', 'b', 'c']]
        for node in self.nodes: self.addCleanup(node.stop)
        self.a, self.b, self.c = self.nodes
        self.environment = patch.dict(os.environ, {'TASKAND_PEERS': '', 'TASKAND_GOSSIP_PEER_TOKENS': '{}',
            'TASKAND_GOSSIP_AUTO_APPROVE': '0', 'TASKAND_AUTH_TOKEN': 'local-admin-must-not-leave-node'})
        self.environment.start(); self.addCleanup(self.environment.stop)

    def engine(self, destination):
        engine = GossipEngine(peer_tokens={self.a.url: self.a.token})
        engine.discover_peers = lambda: [self.a.url]
        return engine

    def sync(self, engine, destination):
        with patch('gateway.gossip.registry', side_effect=destination.registry):
            return engine.sync_once()

    def pull(self, source=None, destination=None, **extra):
        source, destination = source or self.a, destination or self.b
        return destination.registry('pull', {'peer': source.url, 'token': source.token, 'uris': [URI], **extra})

    def test_three_nodes_replicate_candidates_without_execution_or_discovery_trust(self):
        source, digest = self.a.add_package()
        self.a.peers = [self.c.url]
        for destination in [self.b, self.c]:
            engine = self.engine(destination)
            result = self.sync(engine, destination)
            self.assertTrue(result['ok'], result)
            self.assertEqual(result['synced_this_round'], [URI])
            entry = destination.registry('list')['processes'][0]
            self.assertEqual((entry['hash'], entry['status']), (digest, 'candidate'))
            self.assertEqual(destination.registry('export')['processes'], [])
            self.assertFalse((destination.root / 'executed').exists())
            self.assertEqual(self.sync(engine, destination)['synced_this_round'], [])
            self.assertEqual(destination.registry('peers')['peers'], [])
        self.assertFalse((source / 'executed').exists())
        self.assertEqual(self.c.requests, [])
        for method, path, token in self.a.requests:
            if path in ['/healthz', '/.well-known/catalog.json']: self.assertIsNone(token)
            else: self.assertEqual(token, 'Bearer ' + self.a.token)
        self.assertNotIn('local-admin', json.dumps(self.a.requests))

    def test_offline_rejoin_retries_without_reinstalling_or_activating(self):
        self.a.add_package()
        engine = self.engine(self.b)
        self.a.stop()
        self.assertFalse(self.sync(engine, self.b)['ok'])
        self.assertEqual(self.b.registry('list')['processes'], [])
        self.a.start()
        self.assertTrue(self.sync(engine, self.b)['ok'])
        self.assertEqual(self.sync(engine, self.b)['synced_this_round'], [])
        self.assertEqual(self.b.registry('list')['processes'][0]['status'], 'candidate')

    def test_http_redirects_never_contact_discovered_target(self):
        self.a.add_package()
        self.a.overrides[('GET', '/api/cluster/gossip')] = (302, b'', {'Location': self.c.url + '/capture'})
        self.a.overrides[('POST', '/api/registry')] = (302, b'', {'Location': self.c.url + '/capture'})
        self.assertFalse(self.sync(self.engine(self.b), self.b)['ok'])
        self.assertEqual(self.c.requests, [])
        self.assertEqual(self.b.registry('list')['processes'], [])

    def test_http_rejects_oversize_and_invalid_json_shape(self):
        engine = self.engine(self.b)
        for data, headers in [(b'{}', {'Content-Length': str(MAX_RESPONSE_BYTES + 1)}),
                              (b'x' * (MAX_RESPONSE_BYTES + 1), {}), (b'[]', {}),
                              (b'{"ok":true,"ok":false}', {}), (b'{"ok":NaN}', {}),
                              (b'{"deep":' + b'[' * 2000 + b'0' + b']' * 2000 + b'}', {})]:
            self.a.overrides[('GET', '/healthz')] = (200, data, headers)
            with self.subTest(size=len(data)):
                self.assertFalse(self.sync(engine, self.b)['ok'])
                self.assertEqual(self.b.registry('list')['processes'], [])

    def test_maximum_file_size_imports_without_parser_stack_exhaustion(self):
        content = b'x' * (4 * 1024 * 1024)
        path, digest = self.a.add_package(files={'data.bin': content})
        result = self.pull()
        self.assertEqual(result['report'][0]['result'], 'imported', result)
        imported = self.b.root / path.relative_to(self.a.root)
        self.assertEqual((imported / 'data.bin').read_bytes(), content)
        self.assertEqual(self.b.registry('list')['processes'][0]['hash'], digest)

    def test_changed_catalog_pin_cannot_install_different_contents(self):
        self.a.add_package()
        result = self.pull(expected={URI: 'sha256:' + '0' * 64})
        self.assertEqual(result['report'][0]['result'], 'rejected')
        self.assertFalse((self.b.root / 'generated/demo/hello/taskand.dev/v1').exists())

    def test_unsafe_payloads_never_create_final_package_or_escape(self):
        self.a.add_package()
        original = self.a.registry('package', {'uri': URI})
        changes = [lambda p: p.update(uri='proc://taskand.dev/demo/other/v1'),
                   lambda p: p['files'].update({'../escaped': 'eA=='}),
                   lambda p: p['files'].update({'..': 'eA=='}),
                   lambda p: p['files'].update({'bin.mjs': '!notbase64!'}),
                   lambda p: p['files'].update({'bin.mjs': 'eA=='}),
                   lambda p: p['files'].update({'extra': 'eA==' * 2000000})]
        for change in changes:
            payload = json.loads(json.dumps(original)); change(payload)
            self.a.overrides[('POST', '/api/registry')] = (200, payload, {})
            result = self.pull()
            self.assertNotEqual(result['report'][0]['result'], 'imported', result)
            self.assertFalse((self.b.root / 'generated/demo/hello/taskand.dev/v1').exists())
            self.assertEqual(self.b.registry('list')['processes'], [])
        self.assertEqual(list(self.b.root.rglob('escaped')), [])
        self.assertEqual(list(self.b.root.rglob('.incoming-*')), [])

    def test_existing_content_conflict_preserves_local_bytes(self):
        self.a.add_package(message='remote')
        path, digest = self.b.add_package(message='local')
        before = (path / 'bin.mjs').read_bytes()
        result = self.pull()
        self.assertEqual(result['report'][0]['result'], 'conflict')
        self.assertEqual((path / 'bin.mjs').read_bytes(), before)
        self.assertEqual(self.b.registry('list')['processes'][0]['hash'], digest)
        report = self.sync(self.engine(self.b), self.b)
        self.assertFalse(report['ok'])
        self.assertEqual(report['peers'][self.a.url]['conflicts'], [URI])

    def test_concurrent_imports_and_orphan_recovery(self):
        path, digest = self.a.add_package()
        argv, payload = self.b.command('pull', {'peer': self.a.url, 'token': self.a.token, 'uris': [URI]})
        processes = [subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, cwd=self.b.root, env=self.b.env) for _ in range(4)]
        for process in processes:
            process.stdin.write(payload); process.stdin.close(); process.stdin = None
        try:
            for process in processes:
                stdout, stderr = process.communicate(timeout=20)
                self.assertEqual(process.returncode, 0, stderr)
                self.assertIn(json.loads(stdout)['report'][0]['result'], ['same', 'imported'])
        finally:
            for process in processes:
                if process.poll() is None: process.kill(); process.communicate()
        self.assertEqual(len(self.b.registry('list')['processes']), 1)
        self.assertEqual(self.b.registry('list')['processes'][0]['hash'], digest)
        # Simulate the durable state between filesystem rename and registry commit.
        orphan = self.c.root / path.relative_to(self.a.root)
        shutil.copytree(path, orphan)
        recovery = self.pull(destination=self.c)
        self.assertTrue(recovery['report'][0]['recovered'])
        self.assertEqual(self.c.registry('list')['processes'][0]['status'], 'candidate')

    def test_imported_candidate_roundtrips_through_paxlet_store(self):
        if not os.environ.get('PAXLET_TEST_ROOT'):
            self.skipTest('set PAXLET_TEST_ROOT/PYTHONPATH to test current Paxlet integration')
        import paxlet
        self.assertTrue(Path(paxlet.__file__).resolve().is_relative_to(Path(os.environ['PAXLET_TEST_ROOT'])))
        from integrations.taskand.adapt import export_proc_yaml
        from paxlet.manifest import package_digest
        from paxlet.store import put_package, materialize_package
        from paxlet.runtime import run_action
        source, _ = self.a.add_package()
        self.assertEqual(self.pull()['report'][0]['result'], 'imported')
        imported = self.b.root / source.relative_to(self.a.root)
        exported = self.root / 'paxlet-export'
        _, valid, errors = export_proc_yaml(imported / 'proc.yaml', exported)
        self.assertTrue(valid, errors)
        with patch.dict(os.environ, {'PAXLET_STORE_DIR': str(self.root / 'paxlet-store')}):
            digest, _, installed = put_package(exported, expected_digest=package_digest(exported))
            execution = materialize_package(digest, self.root / 'execution')
            output, receipt, _ = run_action(execution, 'run', {}, expected_digest=digest)
            self.assertEqual(output, {'message': 'hello'})
            self.assertEqual(receipt['package_digest'], digest)
            self.assertEqual(package_digest(installed), digest)
            self.assertFalse((installed / 'executed').exists())
        self.assertEqual(self.b.registry('list')['processes'][0]['status'], 'candidate')
        self.assertFalse((imported / 'executed').exists())


if __name__ == '__main__':
    unittest.main()
