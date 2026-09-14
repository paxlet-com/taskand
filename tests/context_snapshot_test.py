import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import sys
import tarfile
import tempfile
import time
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'infra/local-recovery/context_snapshot.py'
SPEC = importlib.util.spec_from_file_location('context_snapshot', SOURCE)
recovery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recovery)


class ContextRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='context-recovery-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'synthetic.sqlite3'
        with sqlite3.connect(self.source) as db:
            for table in ('meta', 'objects', 'requests', 'events'):
                db.execute(f'CREATE TABLE {table} (value TEXT)')
            db.execute("INSERT INTO objects VALUES ('synthetic-profile')")
        db.close()
        self.content = self.source.read_bytes()
        self.sha = hashlib.sha256(self.content).hexdigest()
        self.identity = 'a' * 64
        self.observed = {'id': self.identity, 'image': 'sha256:' + 'b' * 64,
                         'name': '/glm53-gateway-test', 'status': 'exited',
                         'started': 'before', 'finished': 'after'}

    def archive(self, members=None):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            root = tarfile.TarInfo('context')
            root.type = tarfile.DIRTYPE
            archive.addfile(root)
            for name, kind, content in members or [('context/context.sqlite3', tarfile.REGTYPE, self.content)]:
                info = tarfile.TarInfo(name)
                info.type, info.size = kind, len(content)
                archive.addfile(info, io.BytesIO(content))
        return stream.getvalue()

    def test_snapshot_and_restore_round_trip(self):
        snapshot = self.root / 'snapshot.sqlite3'
        with patch.object(recovery, 'stopped_container', return_value=self.observed), \
                patch.object(recovery, 'capture', return_value=self.archive()) as capture:
            result = recovery.snapshot(self.identity, snapshot, True)
        self.assertEqual(result['sha256'], self.sha)
        self.assertFalse(result['activated'])
        self.assertEqual(capture.call_args.args[0], ['docker', 'cp', self.identity + ':/taskand/log/context', '-'])
        target = self.root / 'restored'
        self.assertEqual(recovery.restore(snapshot, self.sha, target, True)['status'], 'PREPARED')
        self.assertEqual((target / 'context.sqlite3').read_bytes(), self.content)
        self.assertEqual(target.stat().st_mode & 0o777, 0o700)
        self.assertEqual(snapshot.stat().st_mode & 0o777, 0o600)
        self.assertEqual((target / 'context.sqlite3').stat().st_mode & 0o777, 0o600)

    def test_explicit_sensitive_data_acknowledgement(self):
        with patch.object(recovery, 'capture') as capture:
            with self.assertRaisesRegex(recovery.RecoveryError, 'ACKNOWLEDGEMENT'):
                recovery.snapshot(self.identity, self.root / 'out')
            with self.assertRaisesRegex(recovery.RecoveryError, 'ACKNOWLEDGEMENT'):
                recovery.restore(self.source, self.sha, self.root / 'out')
            capture.assert_not_called()

    def test_exact_stopped_gateway_required(self):
        with self.assertRaisesRegex(recovery.RecoveryError, 'EXACT_CONTAINER'):
            recovery.stopped_container('gateway')
        for field, value in [('id', 'c' * 64), ('status', 'running'), ('status', 'paused'),
                             ('name', '/unrelated-service'), ('image', 'latest')]:
            with self.subTest(field=field, value=value), \
                    patch.object(recovery, 'capture', return_value=json.dumps({**self.observed, field:value}).encode()):
                with self.assertRaisesRegex(recovery.RecoveryError, 'STOPPED_GATEWAY'):
                    recovery.stopped_container(self.identity)

    def test_failed_copy_never_publishes(self):
        target = self.root / 'snapshot'
        with patch.object(recovery, 'stopped_container', return_value=self.observed), \
                patch.object(recovery, 'capture', side_effect=recovery.RecoveryError('COPY_COMMAND_FAILED')):
            with self.assertRaisesRegex(recovery.RecoveryError, 'COPY_COMMAND_FAILED'):
                recovery.snapshot(self.identity, target, True)
        self.assertFalse(target.exists())

    def test_restart_during_copy_rejected(self):
        with patch.object(recovery, 'stopped_container', side_effect=[self.observed, {**self.observed,'started':'changed'}]), \
                patch.object(recovery, 'capture', return_value=self.archive()):
            with self.assertRaisesRegex(recovery.RecoveryError, 'CONTAINER_CHANGED'):
                recovery.snapshot(self.identity, self.root / 'snapshot', True)
        self.assertFalse((self.root / 'snapshot').exists())

    def test_unsafe_tar_entries_and_sidecars_rejected(self):
        for name, kind in [('context/../outside', tarfile.REGTYPE),
                           ('/context/context.sqlite3', tarfile.REGTYPE),
                           ('context/context.sqlite3-wal', tarfile.REGTYPE),
                           ('context/context.sqlite3-journal', tarfile.REGTYPE),
                           ('context/context.sqlite3', tarfile.SYMTYPE),
                           ('context/context.sqlite3', tarfile.LNKTYPE),
                           ('context/context.sqlite3', tarfile.FIFOTYPE)]:
            with self.subTest(name=name, kind=kind):
                with self.assertRaises(recovery.RecoveryError):
                    recovery.database_from_tar(self.archive([(name, kind, self.content)]))

    def test_duplicate_and_oversized_tar_rejected(self):
        member = ('context/context.sqlite3', tarfile.REGTYPE, self.content)
        with self.assertRaises(recovery.RecoveryError):
            recovery.database_from_tar(self.archive([member, member]))
        with patch.object(recovery, 'MAX_DATABASE', 100):
            with self.assertRaises(recovery.RecoveryError):
                recovery.database_from_tar(self.archive())
        with self.assertRaises(recovery.RecoveryError):
            recovery.database_from_tar(b'not tar')

    def test_wrong_digest_and_invalid_database_leave_no_destination(self):
        target = self.root / 'restored'
        with self.assertRaisesRegex(recovery.RecoveryError, 'DIGEST_MISMATCH'):
            recovery.restore(self.source, '0' * 64, target, True)
        self.source.write_bytes(b'x' * 1024)
        with self.assertRaisesRegex(recovery.RecoveryError, 'INTEGRITY_FAILED'):
            recovery.restore(self.source, hashlib.sha256(self.source.read_bytes()).hexdigest(), target, True)
        self.assertFalse(target.exists())

    def test_existing_destinations_never_overwritten(self):
        for target in (self.source, self.root):
            with self.assertRaisesRegex(recovery.RecoveryError, 'DESTINATION_EXISTS'):
                recovery.restore(self.source, self.sha, target, True)
        self.assertEqual(self.source.read_bytes(), self.content)

    def test_symlink_and_nonregular_source_rejected(self):
        link = self.root / 'link'
        link.symlink_to(self.source)
        with self.assertRaisesRegex(recovery.RecoveryError, 'UNSAFE_PATH'):
            recovery.restore(link, self.sha, self.root / 'out', True)
        fifo = self.root / 'fifo'
        os.mkfifo(fifo)
        with self.assertRaisesRegex(recovery.RecoveryError, 'SIZE_OR_TYPE'):
            recovery.restore(fifo, self.sha, self.root / 'out', True)

    def test_shared_parent_rejected(self):
        shared = self.root / 'shared'
        shared.mkdir()
        shared.chmod(0o777)
        with self.assertRaisesRegex(recovery.RecoveryError, 'PRIVATE_OWNED_PARENT'):
            recovery.restore(self.source, self.sha, shared / 'out', True)

    def test_schema_and_corrupt_snapshot_rejected_before_publication(self):
        with patch.object(recovery, 'stopped_container', return_value=self.observed), \
                patch.object(recovery, 'capture', return_value=self.archive([
                    ('context/context.sqlite3', tarfile.REGTYPE, b'x' * 1024)])):
            with self.assertRaisesRegex(recovery.RecoveryError, 'INTEGRITY_FAILED'):
                recovery.snapshot(self.identity, self.root / 'bad', True)
        self.assertFalse((self.root / 'bad').exists())
        with sqlite3.connect(self.source) as db:
            db.execute('DROP TABLE objects')
        db.close()
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        with self.assertRaisesRegex(recovery.RecoveryError, 'SCHEMA_UNSUPPORTED'):
            recovery.restore(self.source, digest, self.root / 'out', True)

    def test_target_appearing_before_publication_preserved(self):
        target = self.root / 'out'
        original = recovery.checked_file
        def race(directory, content):
            result = original(directory, content)
            target.mkdir()
            (target / 'owned-by-other').write_text('keep')
            return result
        with patch.object(recovery, 'checked_file', side_effect=race):
            with self.assertRaises(FileExistsError):
                recovery.restore(self.source, self.sha, target, True)
        self.assertEqual((target / 'owned-by-other').read_text(), 'keep')

    def test_output_limit_deadline_and_command_failure(self):
        command = [sys.executable, '-c']
        self.assertEqual(recovery.capture(command + ["print('ok')"], 20), b'ok\n')
        with self.assertRaisesRegex(recovery.RecoveryError, 'SIZE_EXCEEDED'):
            recovery.capture(command + ["print('x'*10000)"], 100)
        with self.assertRaisesRegex(recovery.RecoveryError, 'DEADLINE_EXCEEDED'):
            recovery.capture(command + ['import time; time.sleep(5)'], 100, timeout=0.1)
        with self.assertRaisesRegex(recovery.RecoveryError, 'COMMAND_FAILED'):
            recovery.capture(command + ['raise SystemExit(2)'], 100)

    def test_timeout_cleans_descendant_after_parent_exit(self):
        pid_file = self.root / 'child.pid'
        code = ("import subprocess,sys; from pathlib import Path; "
                "p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)']); "
                f"Path({str(pid_file)!r}).write_text(str(p.pid))")
        with self.assertRaisesRegex(recovery.RecoveryError, 'DEADLINE_EXCEEDED'):
            recovery.capture([sys.executable, '-c', code], 100, timeout=2)
        pid = int(pid_file.read_text())
        for _ in range(20):
            status = Path(f'/proc/{pid}/status')
            if not status.exists() or '\nState:\tZ' in status.read_text():
                break
            time.sleep(0.01)
        else:
            self.fail('descendant still running after capture timeout')


if __name__ == '__main__':
    unittest.main()
