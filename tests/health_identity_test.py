from concurrent.futures import ThreadPoolExecutor
import errno
import hashlib
import json
from pathlib import Path
import tempfile
import subprocess
import threading
import unittest
from unittest.mock import Mock, patch

from gateway import utils

from gateway.handlers.health import release_identity, handle_healthz


class HealthIdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'gateway').mkdir()
        files = {'gateway/__init__.py': b'gateway', 'gateway.py': b'entry', 'index.html': b'html'}
        for name, content in files.items():
            (self.root / name).write_bytes(content)
        self.value = {'sourceSha': 'a' * 40,
                      'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
        self.manifest = self.root / 'release.json'

    def observe(self):
        raw = json.dumps(self.value).encode()
        self.manifest.write_bytes(raw)
        return release_identity(self.manifest, hashlib.sha256(raw).hexdigest(), self.root, self.root)

    def test_reports_only_matching_code_and_panel(self):
        result = self.observe()
        self.assertEqual(result['commit'], 'a' * 40)
        self.assertEqual(result['identityStatus'], 'LOCAL_CODE_MATCH')
        self.assertEqual(result['artifactSha256'], hashlib.sha256(self.manifest.read_bytes()).hexdigest())

    def test_changed_code_or_panel_never_reports_source(self):
        for name in ('gateway.py', 'gateway/__init__.py', 'index.html'):
            original = (self.root / name).read_bytes()
            (self.root / name).write_bytes(b'changed')
            self.assertIsNone(self.observe()['commit'], name)
            (self.root / name).write_bytes(original)

    def test_pin_mismatch_and_missing_manifest_fail_closed(self):
        self.observe()
        for path in (self.manifest, self.root / 'missing'):
            result = release_identity(path, '0' * 64, self.root, self.root)
            self.assertIsNone(result['commit'])
            self.assertEqual(result['identityStatus'], 'MISMATCH_OR_INVALID')

    def test_missing_declaration_never_uses_environment_commit(self):
        with patch.dict('os.environ', {'TASKAND_SOURCE_SHA': 'a' * 40}, clear=True):
            self.assertEqual(release_identity()['identityStatus'], 'UNREPORTED')

    def test_missing_or_extra_gateway_code_fails_closed(self):
        self.value['files'].pop('gateway/__init__.py')
        self.assertIsNone(self.observe()['commit'])
        self.value['files']['gateway/__init__.py'] = hashlib.sha256(b'gateway').hexdigest()
        (self.root / 'gateway/injected.py').write_bytes(b'extra')
        self.assertIsNone(self.observe()['commit'])

    def test_invalid_inventory_and_symlink_fail_closed(self):
        for source in ('main', 'a' * 39, None):
            self.value['sourceSha'] = source
            self.assertIsNone(self.observe()['commit'])
        self.value['sourceSha'] = 'a' * 40
        original = self.root / 'index.html'
        original.rename(self.root / 'hidden')
        original.symlink_to(self.root / 'hidden')
        self.assertIsNone(self.observe()['commit'])

    def test_identity_failure_does_not_claim_service_failure(self):
        class Response:
            def _send(self, status, body):
                self.status, self.body = status, body
        response = Response()
        with patch('gateway.handlers.health.registry', return_value={'ok': True, 'total': 3}), \
                patch.dict('os.environ', {}, clear=True):
            handle_healthz(response, {})
        self.assertEqual(response.status, 200)
        self.assertTrue(response.body['ok'])
        self.assertIsNone(response.body['commit'])


class GatewayCapacityTests(unittest.TestCase):
    def setUp(self):
        for name in ('_CALL_SLOTS', '_CONTROL_SLOTS'):
            patched = patch.object(utils, name, threading.BoundedSemaphore(2))
            patched.start()
            self.addCleanup(patched.stop)

    def test_saturation_rejects_before_spawn_and_keeps_health_capacity(self):
        active = 0
        lock = threading.Lock()
        both = threading.Event()
        release = threading.Event()
        def execute(*args, **kwargs):
            nonlocal active
            body = json.loads(kwargs['input'])
            if body['action'] == 'call':
                with lock:
                    active += 1
                    if active == 2:
                        both.set()
                if not release.wait(5):
                    raise AssertionError('test release deadline')
            return subprocess.CompletedProcess([], 0, '{"ok": true, "total": 1}', '')
        with patch.object(utils.subprocess, 'run', side_effect=execute) as spawn:
            with ThreadPoolExecutor(max_workers=2) as pool:
                work = [pool.submit(utils.call_process, 'proc://test/run/v1', {}) for _ in range(2)]
                try:
                    self.assertTrue(both.wait(3))
                    for _ in range(6):
                        denied = utils.call_process('proc://test/run/v1', {})
                        self.assertEqual(denied['errorType'], 'BUSY')
                        self.assertEqual(utils.status_for(denied), 503)
                    self.assertEqual(spawn.call_count, 2)
                    health = Mock()
                    with patch('gateway.handlers.health.release_identity', return_value={}):
                        handle_healthz(health, {})
                    self.assertEqual(health._send.call_args.args[0], 200)
                    self.assertTrue(health._send.call_args.args[1]['ok'])
                    self.assertEqual(spawn.call_count, 3)
                finally:
                    release.set()
                self.assertTrue(all(f.result()['ok'] for f in work))
            self.assertTrue(utils.call_process('proc://test/run/v1', {})['ok'])

    def test_control_saturation_cannot_consume_execution_slots(self):
        self.assertTrue(utils._CONTROL_SLOTS.acquire(False))
        self.assertTrue(utils._CONTROL_SLOTS.acquire(False))
        with patch.object(utils.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '{"ok":true}', '')) as spawn:
            self.assertEqual(utils.registry('list', {})['errorType'], 'BUSY')
            self.assertTrue(utils.registry('call', {})['ok'])
            self.assertEqual(spawn.call_count, 1)
        utils._CONTROL_SLOTS.release()
        utils._CONTROL_SLOTS.release()

    def test_payload_cannot_move_call_into_control_lane(self):
        with patch.object(utils.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '{"ok":true}', '')) as spawn:
            utils.registry('list', {'action':'call'})
            self.assertEqual(json.loads(spawn.call_args.kwargs['input'])['action'], 'list')

    def test_failures_release_slots_and_have_non_success_status(self):
        cases = [(OSError(errno.EAGAIN, 'sensitive path'), 'REGISTRY_UNAVAILABLE', 503),
                 (subprocess.TimeoutExpired('registry', 1), 'OUTCOME_UNKNOWN', 504),
                 (subprocess.CompletedProcess([], 0, 'bad-json', ''), 'REGISTRY_ERROR', 502),
                 (subprocess.CompletedProcess([], 0, '[]', ''), 'REGISTRY_ERROR', 502),
                 (subprocess.CompletedProcess([], 7, '{"ok":true}', ''), 'REGISTRY_ERROR', 502)]
        for failure, code, status in cases:
            with self.subTest(code=code, failure=type(failure).__name__):
                with patch.object(utils, '_CALL_SLOTS', threading.BoundedSemaphore(1)), \
                     patch.object(utils.subprocess, 'run', side_effect=[failure, subprocess.CompletedProcess([], 0, '{"ok":true}', '')]):
                    result = utils.registry('call', {})
                    self.assertEqual(result['errorType'], code)
                    self.assertEqual(utils.status_for(result), status)
                    self.assertNotIn('sensitive path', json.dumps(result))
                    self.assertTrue(utils.registry('call', {})['ok'])
        self.assertEqual(utils.status_for({'ok':False,'error':'spawnSync node EAGAIN'}), 502)
        self.assertEqual(utils.status_for({'ok':False,'errorType':'DENIED'}), 403)
        self.assertEqual(utils.status_for({'ok':True}), 200)

    def test_unexpected_exception_also_releases_slot(self):
        with patch.object(utils, '_CALL_SLOTS', threading.BoundedSemaphore(1)), \
             patch.object(utils.subprocess, 'run', side_effect=[RuntimeError('test'), subprocess.CompletedProcess([], 0, '{"ok":true}', '')]):
            with self.assertRaises(RuntimeError):
                utils.registry('call', {})
            self.assertTrue(utils.registry('call', {})['ok'])

    def test_operator_limits_are_bounded(self):
        for value in ('0','-1','33','invalid'):
            with patch.dict('os.environ', {'TASKAND_MAX_CONCURRENT_CALLS':value}):
                with self.assertRaises(ValueError):
                    utils._capacity('TASKAND_MAX_CONCURRENT_CALLS')
        with patch.dict('os.environ', {'TASKAND_MAX_CONCURRENT_CALLS':'3'}):
            self.assertEqual(utils._capacity('TASKAND_MAX_CONCURRENT_CALLS'), 3)


if __name__ == '__main__':
    unittest.main()
