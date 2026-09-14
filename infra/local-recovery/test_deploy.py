import json
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
