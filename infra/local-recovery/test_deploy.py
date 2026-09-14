import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import deploy


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="taskand-recovery-")
        self.root = Path(self.temp.name)
        self.stage = self.root / "stage"
        (self.stage / "source").mkdir(parents=True)
        (self.stage / "source" / "index.html").write_text("current\n", encoding="utf-8")
        (self.stage / "source" / "gateway.py").write_text("gateway\n", encoding="utf-8")
        self.manifest = {
            "sourceSha": "a" * 40,
            "files": {
                "index.html": deploy.digest(b"current\n"),
                "gateway.py": deploy.digest(b"gateway\n"),
            },
        }
        (self.stage / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def test_load_stage_is_digest_bound(self):
        manifest, source = deploy.load_stage(self.stage)
        self.assertEqual(manifest["sourceSha"], "a" * 40)
        self.assertEqual(source / "index.html", self.stage / "source/index.html")

    def test_modified_stage_is_rejected(self):
        (self.stage / "source/index.html").write_text("changed\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Stage changed"):
            deploy.load_stage(self.stage)

    def test_manifest_path_traversal_is_rejected(self):
        self.manifest["files"]["../outside"] = deploy.digest(b"x")
        (self.stage / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Invalid manifest path"):
            deploy.load_stage(self.stage)

    def test_safe_rejects_symlinked_path(self):
        link = self.root / "link"
        link.symlink_to(self.root)
        with self.assertRaisesRegex(ValueError, "Symlink"):
            deploy.safe(link)

    def test_digest_is_stable(self):
        self.assertEqual(deploy.digest(b"taskand"), deploy.digest(b"taskand"))
        self.assertNotEqual(deploy.digest(b"taskand"), deploy.digest(b"Taskand"))

    def test_predecessor_binds_exact_service_name_and_id(self):
        manifest = {'gateway': {'name': 'glm53-gateway-recovery-009', 'id': 'previous-id'}}
        with patch.object(deploy, 'metadata', return_value={'id': 'previous-id'}) as observe:
            self.assertEqual(deploy.predecessor(manifest, 'gateway'), 'glm53-gateway-recovery-009')
            observe.assert_called_once_with('glm53-gateway-recovery-009')
        with patch.object(deploy, 'metadata', return_value={'id': 'replacement-id'}):
            with self.assertRaisesRegex(ValueError, 'changed'):
                deploy.predecessor(manifest, 'gateway')
        manifest['gateway']['name'] = 'glm53-landing-recovery-009'
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            deploy.predecessor(manifest, 'gateway')

    def test_canary_pins_manifest_without_mounting_production_secrets(self):
        self.manifest['gateway'] = {'hostname': 'test-node', 'image': 'sha256:' + 'b' * 64}
        (self.stage / 'manifest.json').write_text(json.dumps(self.manifest))
        with patch.object(deploy, 'run') as execute:
            deploy.create(self.stage, 'test-canary', 18077, canary=True)
        command = execute.call_args.args
        self.assertIn('TASKAND_RELEASE_SHA256=' + deploy.digest((self.stage / 'manifest.json').read_bytes()), command)
        self.assertIn('TASKAND_RELEASE_MANIFEST=/app/release.json', command)
        self.assertTrue(any('/app/release.json,readonly' in arg for arg in command))
        self.assertNotIn('--env-file', command)
        self.assertFalse(any('/taskand/.env' in arg or 'docker.sock' in arg for arg in command))

    def test_rollback_uses_observed_predecessors_when_candidate_files_are_bad(self):
        self.manifest.update({name: {'name': f'glm53-{name}-previous', 'id': name}
                              for name in ('gateway', 'landing')})
        (self.stage / 'manifest.json').write_text(json.dumps(self.manifest))
        (self.stage / 'source/index.html').write_text('broken')
        with patch.object(deploy, 'metadata', side_effect=lambda name: {'id': name.split('-')[1]}), \
                patch.object(deploy.subprocess, 'run'), patch.object(deploy, 'run') as execute:
            deploy.rollback(self.stage, 'test-candidate')
        execute.assert_called_once_with('docker', 'start', 'glm53-gateway-previous', 'glm53-landing-previous')


if __name__ == "__main__":
    unittest.main()
