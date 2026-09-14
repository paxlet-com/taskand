import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

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


if __name__ == '__main__':
    unittest.main()
