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
compose = module("compose").compose
move_state = module("move_state").move_state


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

    def test_composition_preserves_catalog_and_binds_shell_source(self):
        for name in ("bin/taskand", "packages/taskand-shell/hello.plan.json",
                     "generated/mcp/shell-build/bin.mjs", "generated/mcp/shell-run/bin.mjs"):
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture")
        entries = {"proc://taskand.dev/mcp/" + n + "/v1": {"hash": n}
                   for n in ("shell-build", "shell-run")}
        (self.repo / "generated/mcp/registry.json").write_text(json.dumps({"processes": entries}))
        self.commit()
        stage(self.repo, self.sha, self.release)
        base = self.root / "base"
        stage(self.repo, self.sha, base)
        original = {"organism": "mcp", "processes": {"existing": {"hash": "preserve", "status": "active"}}}
        (base / "generated/mcp/registry.json").write_text(json.dumps(original))
        (base / "log").mkdir()
        (base / "log/private").write_text("runtime state")
        target = self.root / "composed"
        pin = hashlib.sha256((base / "release-manifest.json").read_bytes()).hexdigest()
        receipt = compose(base, self.release, target, pin)
        combined = json.loads((target / "generated/mcp/registry.json").read_text())
        self.assertEqual(combined["processes"]["existing"], original["processes"]["existing"])
        self.assertEqual(len(combined["processes"]), 3)
        self.assertFalse((target / "log").exists())
        self.assertEqual(receipt["shellSourceSha"], self.sha)
        with self.assertRaises(ValueError):
            compose(base, self.release, self.root / "bad-pin", "0" * 64)

    def test_state_move_retry_and_rollback_preserve_directory_identity(self):
        source, target = self.root / "state", self.root / "next-state"
        source.mkdir()
        (source / "database").write_text("existing state")
        identity = source.stat()
        move_state(source, target, identity.st_dev, identity.st_ino)
        move_state(source, target, identity.st_dev, identity.st_ino)
        move_state(target, source, identity.st_dev, identity.st_ino)
        self.assertEqual((source / "database").read_text(), "existing state")
        with self.assertRaises(ValueError):
            move_state(source, target, identity.st_dev, identity.st_ino + 1)
        target.mkdir()
        with self.assertRaises(ValueError):
            move_state(source, target, identity.st_dev, identity.st_ino)


if __name__ == "__main__":
    unittest.main()
