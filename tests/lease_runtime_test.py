"""Portable lease adoption must preserve the real backend and reject drift."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
REVISION = '4e7f1aa4e230de22281366c34a117df6afc3de16'
SOURCE_SHA = '013c82127cb2d398e83479d82fd2d1008773cae08d322d391a6616427b614a37'


def load_adapter():
    spec = importlib.util.spec_from_file_location('portable_adapter_test', ROOT / 'project/lease-controller.py')
    adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter)
    return adapter


class LeaseRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.adapter = load_adapter()
        self.temp = tempfile.TemporaryDirectory(prefix='lease-runtime-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / '.governance').mkdir()
        for name in ('change_lease_check.py', 'manifest.lock.json'):
            shutil.copyfile(ROOT / '.governance' / name, self.root / '.governance' / name)
        self.backend = self.root / 'backend.py'
        self.backend.write_bytes(self.adapter.BACKEND.read_bytes())
        setting = patch.object(self.adapter, 'BACKEND', self.backend)
        setting.start()
        self.addCleanup(setting.stop)

    def test_default_is_bundled_immutable_upstream(self):
        adapter = load_adapter()
        self.assertEqual(adapter.BACKEND, ROOT / 'project/vendor/autonom/change_lease.py')
        self.assertEqual(adapter.BACKEND_REVISION, REVISION)
        self.assertEqual(hashlib.sha256(adapter.BACKEND.read_bytes()).hexdigest(), SOURCE_SHA)

    def test_real_store_and_adopted_policy_load_without_installed_package(self):
        backend, policy = self.adapter.runtimes(self.root)
        self.assertTrue(callable(backend.ChangeLeaseStore))
        self.assertTrue(callable(policy.evaluate_transition))
        self.assertEqual(Path(backend.__file__), self.backend)

    def test_missing_backend_has_stable_diagnostic(self):
        self.backend.unlink()
        with self.assertRaisesRegex(ValueError, 'LEASE_BACKEND_UNAVAILABLE'):
            self.adapter.runtimes(self.root)

    def test_modified_backend_is_not_executed(self):
        self.backend.write_text('raise AssertionError("unverified code executed")\n')
        with self.assertRaisesRegex(ValueError, 'LEASE_BACKEND_DIGEST_MISMATCH'):
            self.adapter.runtimes(self.root)

    def test_backend_symlink_is_rejected(self):
        target = self.root / 'original.py'
        self.backend.rename(target)
        self.backend.symlink_to(target)
        with self.assertRaisesRegex(ValueError, 'LEASE_BACKEND_SYMLINK'):
            self.adapter.runtimes(self.root)

    def test_symlinked_parent_is_rejected(self):
        link = self.root / 'linked'
        link.symlink_to(self.root, target_is_directory=True)
        with patch.object(self.adapter, 'BACKEND', link / 'backend.py'):
            with self.assertRaisesRegex(ValueError, 'LEASE_BACKEND_SYMLINK'):
                self.adapter.runtimes(self.root)

    def test_modified_policy_is_not_executed(self):
        (self.root / '.governance/change_lease_check.py').write_text('raise AssertionError("unverified policy executed")\n')
        with self.assertRaisesRegex(ValueError, 'LEASE_POLICY_DIGEST_MISMATCH'):
            self.adapter.runtimes(self.root)

    def test_policy_and_lock_symlinks_are_rejected(self):
        for name, label in (('change_lease_check.py', 'POLICY'), ('manifest.lock.json', 'POLICY_LOCK')):
            with self.subTest(name=name):
                source = self.root / '.governance' / name
                target = self.root / name
                source.rename(target)
                source.symlink_to(target)
                with self.assertRaisesRegex(ValueError, 'LEASE_' + label + '_SYMLINK'):
                    self.adapter.runtimes(self.root)
                source.unlink()
                target.rename(source)

    def test_executes_verified_buffer_even_if_file_changes_after_check(self):
        original = self.adapter.module

        def replace_before_load(name, path, *args, **kwargs):
            if name == 'taskand_lease_backend':
                path.write_text('raise AssertionError("changed file executed")\n')
            return original(name, path, *args, **kwargs)

        with patch.object(self.adapter, 'module', side_effect=replace_before_load):
            backend, _ = self.adapter.runtimes(self.root)
        self.assertTrue(callable(backend.ChangeLeaseStore))

    def test_dictionary_policy_pin_remains_supported(self):
        lock = self.root / '.governance/manifest.lock.json'
        data = json.loads(lock.read_text())
        pin = data['managedFiles']['.governance/change_lease_check.py']
        data['managedFiles']['.governance/change_lease_check.py'] = {'sha256': pin}
        lock.write_text(json.dumps(data))
        _, policy = self.adapter.runtimes(self.root)
        self.assertTrue(callable(policy.evaluate_transition))


if __name__ == '__main__':
    unittest.main()
