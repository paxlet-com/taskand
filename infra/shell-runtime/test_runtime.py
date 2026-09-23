import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


stage = module("stage").stage
canary = module("canary").canary


class StagingTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo = self.root / "source"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("config", "user.name", "Fixture")
        for name in ("gateway.py", "gateway/__init__.py", "index.html", "app/shell_workflow.py"):
            path = self.repo / name
            path.parent.mkdir(exist_ok=True)
            path.write_text("source\n")
        self.commit()
        self.release = self.root / "release"

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], stderr=subprocess.DEVNULL).decode().strip()

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")
        self.sha = self.git("rev-parse", "HEAD")

    def test_uses_commit_not_dirty_checkout_and_records_identity(self):
        (self.repo / "gateway.py").write_text("uncommitted\n")
        (self.repo / ".env").write_text("PRIVATE=fixture\n")
        result = stage(self.repo, self.sha, self.release)
        self.assertEqual((self.release / "gateway.py").read_text(), "source\n")
        self.assertFalse((self.release / ".env").exists())
        self.assertEqual(hashlib.sha256((self.release / "release-manifest.json").read_bytes()).hexdigest(), result["artifactSha256"])
        inventory = json.loads((self.release / "source-inventory.json").read_text())
        self.assertEqual(inventory["sourceSha"], self.sha)
        self.assertIn("app/shell_workflow.py", inventory["files"])

    def test_refuses_overwrite_and_checkout_destination(self):
        self.release.mkdir()
        marker = self.release / "keep"
        marker.write_text("existing")
        with self.assertRaises(ValueError):
            stage(self.repo, self.sha, self.release)
        self.assertEqual(marker.read_text(), "existing")
        with self.assertRaises(ValueError):
            stage(self.repo, self.sha, self.repo / "release")

    def test_rejects_mutable_ref_symlink_parent_and_archived_symlink(self):
        with self.assertRaises(ValueError):
            stage(self.repo, "HEAD", self.release)
        alias = self.root / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            stage(self.repo, self.sha, alias / "release")
        (self.repo / "link").symlink_to("/etc/passwd")
        self.commit()
        with self.assertRaises(ValueError):
            stage(self.repo, self.sha, self.release)
        self.assertFalse(self.release.exists())

    def test_rejects_tracked_credentials_before_extracting(self):
        (self.repo / ".env").write_text("PRIVATE=fixture\n")
        self.commit()
        with self.assertRaises(ValueError):
            stage(self.repo, self.sha, self.release)
        self.assertFalse(self.release.exists())

    def test_canary_rejects_modified_release_before_starting(self):
        stage(self.repo, self.sha, self.release)
        (self.release / "gateway.py").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "inventory mismatch"):
            canary(self.release, self.root / "nonexistent-python")


if __name__ == "__main__":
    unittest.main()
