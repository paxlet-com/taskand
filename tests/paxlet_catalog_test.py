"""Native catalogs use actual Paxlet objects and disposable node state."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import copy
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from app.paxlet_catalog import Catalog, CatalogError, checksum, read_snapshot
from paxlet.errors import PaxletError
from paxlet.manifest import package_digest
from paxlet.packing import pack
from paxlet.store import get_package

ROOT = Path(__file__).resolve().parents[1]
URN = "urn:paxlet:example:hello"
BINDING = "paxlet://example/hello"


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {"PAXLET_STORE_DIR": str(self.root / "a/store")})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.catalog = Catalog(self.root / "a/catalog", node_id="node-a")
        self.catalog.trust_namespace("example", "node-a")
        self.source, self.digest, self.archive = self.package("hello")

    def package(self, name, *, version="1.0.0", urn=URN, binding=BINDING, text="Hello"):
        source = self.root / "sources" / name
        source.mkdir(parents=True)
        manifest = {"paxlet": "0.1", "identity": {"urn": urn, "name": name, "version": version},
                    "bindings": [binding], "actions": {"hello": {"runtime": {"type": "python", "entry": "run.py"},
                    "input": {"type": "object"}, "output": {"type": "object"}}},
                    "resources": [], "requires": [],
                    "permissions": {"filesystem": {"read": [], "write": []}, "network": [], "secrets": []}}
        (source / "paxlet.json").write_text(json.dumps(manifest))
        (source / "run.py").write_text("from pathlib import Path\nPath(" + repr(str(self.root / "EXECUTED")) + ").write_text('ran')\nprint(" + repr(json.dumps({"message": text})) + ")\n")
        digest = package_digest(source, manifest)
        archive = self.root / "archives" / (digest[7:] + ".paxlet.zip")
        archive.parent.mkdir(exist_ok=True)
        pack(source, archive)
        return source, digest, archive

    def publish(self):
        return self.catalog.install(self.source, expected_digest=self.digest)

    @contextmanager
    def node(self, name):
        with patch.dict(os.environ, {"PAXLET_STORE_DIR": str(self.root / name / "store")}):
            catalog = Catalog(self.root / name / "catalog", node_id="node-" + name)
            catalog.trust_namespace("example", "node-a")
            yield catalog

    def apply(self, catalog, snapshot, archives=None):
        return catalog.apply_snapshot(snapshot, authenticated_origin="node-a",
                                      archives=archives or {self.digest: self.archive})

    def resign(self, snapshot):
        snapshot["checksum"] = checksum({k: v for k, v in snapshot.items() if k != "checksum"})
        return snapshot

    def test_persisted_identity_and_namespace_ownership(self):
        self.assertEqual(Catalog(self.catalog.root).node_id, "node-a")
        with self.assertRaises(CatalogError):
            Catalog(self.catalog.root, node_id="replacement")
        with self.assertRaises(CatalogError):
            self.catalog.trust_namespace("example", "node-b")
        with self.assertRaises(CatalogError):
            self.catalog.trust_namespace("Example", "node-a")

    def test_unrelated_database_and_symlinks_are_preserved(self):
        other = self.root / "other"
        other.mkdir()
        with sqlite3.connect(other / "catalog.sqlite") as db:
            db.execute("CREATE TABLE important (value TEXT)")
        original = (other / "catalog.sqlite").read_bytes()
        with self.assertRaises(CatalogError):
            Catalog(other)
        self.assertEqual((other / "catalog.sqlite").read_bytes(), original)
        link = self.root / "linked"
        link.symlink_to(other, target_is_directory=True)
        with self.assertRaises(CatalogError):
            Catalog(link)

    def test_install_requires_pin_and_namespace_authority(self):
        for pin in (None, "sha256:" + "0" * 64):
            with self.assertRaises((CatalogError, PaxletError)):
                self.catalog.install(self.source, expected_digest=pin)
        source, pin, _ = self.package("foreign", urn="urn:paxlet:foreign:hello", binding="paxlet://foreign/hello")
        with self.assertRaises(CatalogError):
            self.catalog.install(source, expected_digest=pin)
        self.assertEqual(self.catalog.records(), [])

    def test_explicit_approval_and_alias_resolution_do_not_execute(self):
        first = self.publish()
        self.assertEqual(self.publish(), first)
        self.assertFalse(self.catalog.records()[0]["approved"])
        with self.assertRaises(CatalogError):
            self.catalog.resolve(URN, action="hello")
        self.catalog.approve(URN, "1.0.0", self.digest)
        with self.assertRaises(CatalogError):
            self.catalog.resolve(BINDING, action="hello")
        self.catalog.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
        plan = self.catalog.resolve(BINDING + "/actions/hello?version=1.0.0")
        self.assertEqual(plan, self.catalog.resolve(URN, action="hello", version="1.0.0", digest=self.digest))
        self.assertEqual(plan, {"package": URN, "action": "hello", "version": "1.0.0", "digest": self.digest})
        for args in ({"action": "missing"}, {"action": "hello", "digest": "sha256:" + "0" * 64}, {"action": "hello", "version": ""}):
            with self.assertRaises((CatalogError, PaxletError)):
                self.catalog.resolve(URN, **args)
        with self.assertRaises(PaxletError):
            self.catalog.resolve("paxlet://example/hello%2Factions%2Fhello")
        self.assertFalse((self.root / "EXECUTED").exists())

    def test_versions_need_selection_and_alias_approval_is_per_version(self):
        self.publish()
        source, digest, _ = self.package("v2", version="2.0.0")
        self.catalog.install(source, expected_digest=digest)
        self.catalog.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
        self.catalog.approve(URN, "2.0.0", digest)
        with self.assertRaises(CatalogError):
            self.catalog.resolve(URN, action="hello")
        self.assertEqual(self.catalog.resolve(BINDING, action="hello")["version"], "1.0.0")
        with self.assertRaises(CatalogError):
            self.catalog.resolve(BINDING, action="hello", version="2.0.0")
        self.assertEqual(self.catalog.resolve(URN, action="hello", digest=digest)["version"], "2.0.0")

    def test_conflicting_content_and_alias_cannot_replace_existing_assignments(self):
        self.publish()
        self.catalog.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
        source, digest, _ = self.package("changed", text="Changed")
        with self.assertRaises(CatalogError):
            self.catalog.install(source, expected_digest=digest)
        other = "urn:paxlet:example:other"
        source, digest, _ = self.package("other", urn=other)
        self.catalog.install(source, expected_digest=digest)
        with self.assertRaises(CatalogError):
            self.catalog.approve(other, "1.0.0", digest, bindings=[BINDING])
        self.assertEqual(self.catalog.resolve(BINDING, action="hello")["digest"], self.digest)
        self.assertFalse(next(r for r in self.catalog.records() if r["urn"] == other)["approved"])

    def test_binding_cannot_claim_another_namespace(self):
        source, digest, _ = self.package("forged-alias", binding="paxlet://other/hello")
        self.catalog.install(source, expected_digest=digest)
        with self.assertRaises(CatalogError):
            self.catalog.approve(URN, "1.0.0", digest, bindings=["paxlet://other/hello"])

    def test_withdrawal_is_persistent_idempotent_and_terminal(self):
        self.publish()
        self.catalog.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
        self.catalog.withdraw(URN, "1.0.0", self.digest)
        snapshot = self.catalog.snapshot()
        self.catalog.withdraw(URN, "1.0.0", self.digest)
        self.assertEqual(self.catalog.snapshot(), snapshot)
        self.assertTrue(Catalog(self.catalog.root).records()[0]["withdrawn"])
        self.assertIsNotNone(get_package(self.digest))  # Withdrawal never deletes bytes/evidence.
        for call in (self.publish, lambda: self.catalog.approve(URN, "1.0.0", self.digest), lambda: self.catalog.resolve(URN, action="hello")):
            with self.assertRaises(CatalogError):
                call()

    def test_snapshots_have_no_local_approval_aliases_or_host_paths(self):
        self.publish()
        before = self.catalog.snapshot()
        self.catalog.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
        self.assertEqual(before, self.catalog.snapshot())
        self.assertNotIn(str(self.root), json.dumps(before))
        self.assertEqual(set(before["entries"][0]), {"urn", "version", "digest", "revision", "withdrawn"})

    def test_received_candidate_and_local_approval_survive_idempotent_retry(self):
        self.publish()
        snapshot = self.catalog.snapshot()
        with self.node("b") as b:
            self.assertTrue(self.apply(b, snapshot)["changed"])
            self.assertFalse(b.records()[0]["approved"])
            b.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
            self.assertFalse(self.apply(b, snapshot)["changed"])
            self.assertEqual(b.resolve(BINDING, action="hello")["digest"], self.digest)
            self.assertEqual(b.snapshot()["entries"], [])  # No re-authoring foreign state.

    def test_local_deactivation_is_not_reversed_by_peer_retry(self):
        self.publish()
        snapshot = self.catalog.snapshot()
        with self.node("b") as b:
            self.apply(b, snapshot)
            b.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
            b.deactivate(URN, "1.0.0", self.digest)
            self.apply(b, snapshot)
            self.assertFalse(b.records()[0]["approved"])
            with self.assertRaises(CatalogError):
                b.resolve(BINDING, action="hello")
            with self.assertRaises(CatalogError):
                b.withdraw(URN, "1.0.0", self.digest)

    def test_higher_snapshot_cannot_backdate_a_new_entry_or_change_digest(self):
        self.publish()
        snapshot = self.catalog.snapshot()
        _, other_digest, _ = self.package("changed", text="Changed")
        with self.node("b") as b:
            self.apply(b, snapshot)
            conflict = copy.deepcopy(snapshot)
            conflict["revision"] = 2
            conflict["entries"][0].update(revision=2, digest=other_digest)
            with self.assertRaises(CatalogError):
                self.apply(b, self.resign(conflict))
            backdated = copy.deepcopy(snapshot)
            backdated["revision"] = 2
            backdated["entries"][0]["revision"] = 2
            backdated["entries"].append({**snapshot["entries"][0], "version": "0.1.0"})
            with self.assertRaises(CatalogError):
                self.apply(b, self.resign(backdated))
            self.assertEqual(b.records()[0]["digest"], self.digest)

    def test_unauthorized_origin_and_injected_local_state_fail_before_import(self):
        self.publish()
        snapshot = self.catalog.snapshot()
        with self.node("b") as b, patch("app.paxlet_catalog.put_package") as importer:
            with self.assertRaises(CatalogError):
                b.apply_snapshot(snapshot, authenticated_origin="unknown")
            extra = copy.deepcopy(snapshot)
            extra["entries"][0]["approved"] = True
            with self.assertRaises(CatalogError):
                self.apply(b, self.resign(extra))
            forged = copy.deepcopy(snapshot)
            forged["entries"][0]["urn"] = "urn:paxlet:foreign:hello"
            with self.assertRaises(CatalogError):
                self.apply(b, self.resign(forged))
            importer.assert_not_called()
            self.assertEqual(b.records(), [])

    def test_batch_import_failure_never_exposes_partial_catalog_or_cursor(self):
        self.publish()
        source, digest, archive = self.package("second", urn="urn:paxlet:example:second", binding="paxlet://example/second")
        self.catalog.install(source, expected_digest=digest)
        snapshot = self.catalog.snapshot()
        corrupt = self.root / "bad.paxlet.zip"
        corrupt.write_bytes(archive.read_bytes()[:40])
        with self.node("b") as b:
            with self.assertRaises(PaxletError):
                self.apply(b, snapshot, {self.digest: self.archive, digest: corrupt})
            self.assertEqual(b.records(), [])
            with sqlite3.connect(b.path) as db:
                self.assertEqual(db.execute("SELECT count(*) FROM origins").fetchone()[0], 0)
            self.apply(b, snapshot, {self.digest: self.archive, digest: archive})
            self.assertEqual(len(b.records()), 2)

    def test_interrupted_withdrawal_transaction_rolls_back_approval_and_cursor(self):
        self.publish()
        live = self.catalog.snapshot()
        self.catalog.withdraw(URN, "1.0.0", self.digest)
        withdrawn = self.catalog.snapshot()
        with self.node("b") as b:
            self.apply(b, live)
            b.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
            with patch.object(b, "_deactivate", side_effect=InterruptedError("injected interruption")):
                with self.assertRaises(InterruptedError):
                    self.apply(b, withdrawn)
            restarted = Catalog(b.root)
            self.assertEqual(restarted.resolve(BINDING, action="hello")["digest"], self.digest)
            self.assertFalse(self.apply(restarted, live)["changed"])
            self.apply(restarted, withdrawn)
            with self.assertRaises(CatalogError):
                restarted.resolve(BINDING, action="hello")

    def test_new_remote_version_does_not_inherit_local_activation(self):
        self.publish()
        initial = self.catalog.snapshot()
        source, digest, archive = self.package("v2", version="2.0.0")
        self.catalog.install(source, expected_digest=digest)
        latest = self.catalog.snapshot()
        with self.node("b") as b:
            self.apply(b, initial)
            b.approve(URN, "1.0.0", self.digest, bindings=[BINDING])
            self.apply(b, latest, {digest: archive})
            self.assertTrue(b.records()[0]["approved"])
            self.assertFalse(b.records()[1]["approved"])
            self.assertEqual(b.resolve(BINDING, action="hello")["digest"], self.digest)
            with self.assertRaises(CatalogError):
                b.resolve(URN, version="2.0.0", action="hello")

    def test_claimed_identity_must_match_verified_manifest(self):
        self.publish()
        snapshot = self.catalog.snapshot()
        snapshot["entries"][0]["urn"] = "urn:paxlet:example:lie"
        self.resign(snapshot)
        with self.node("b") as b:
            with self.assertRaises(CatalogError):
                self.apply(b, snapshot)
            self.assertEqual(b.records(), [])

    def test_stale_equivocated_and_incomplete_snapshots_are_rejected(self):
        self.publish()
        initial = self.catalog.snapshot()
        self.catalog.withdraw(URN, "1.0.0", self.digest)
        withdrawn = self.catalog.snapshot()
        source, digest, archive = self.package("v2", version="2.0.0")
        self.catalog.install(source, expected_digest=digest)
        newest = self.catalog.snapshot()
        with self.node("b") as b:
            self.apply(b, initial)
            b.approve(URN, "1.0.0", self.digest)
            self.apply(b, withdrawn)
            with self.assertRaises(CatalogError):
                self.apply(b, initial)
            for bad in (copy.deepcopy(withdrawn), copy.deepcopy(newest)):
                if bad["revision"] == 2:
                    bad["entries"][0]["withdrawn"] = False
                else:
                    bad["entries"] = [e for e in bad["entries"] if e["version"] == "2.0.0"]
                with self.assertRaises(CatalogError):
                    self.apply(b, self.resign(bad), {digest: archive})
            self.assertTrue(b.records()[0]["withdrawn"])
            self.assertFalse(b.records()[0]["approved"])
            self.apply(b, newest, {digest: archive})
            revived = copy.deepcopy(newest)
            revived["entries"][0].update(withdrawn=False, revision=4)
            revived["revision"] = 4
            with self.assertRaises(CatalogError):
                self.apply(b, self.resign(revived), {digest: archive})

    def test_snapshot_shape_revision_bounds_duplicates_and_checksum(self):
        self.publish()
        snapshot = self.catalog.snapshot()
        variants = []
        for field, value in (("revision", True), ("revision", -1), ("revision", 2**53), ("schema", "other")):
            item = copy.deepcopy(snapshot)
            item[field] = value
            variants.append(self.resign(item))
        duplicate = copy.deepcopy(snapshot)
        duplicate["entries"] *= 2
        variants.append(self.resign(duplicate))
        oversized = copy.deepcopy(snapshot)
        oversized["entries"] *= 1001
        variants.append(self.resign(oversized))
        bad_hash = copy.deepcopy(snapshot)
        bad_hash["checksum"] = "sha256:" + "0" * 64
        variants.append(bad_hash)
        for value in variants:
            with self.subTest(value=str(value)[:70]), self.assertRaises((CatalogError, PaxletError)):
                Catalog._check_snapshot(value, "node-a")
        path = self.root / "duplicate.json"
        path.write_text('{"schema":"one","schema":"two"}')
        with self.assertRaises(CatalogError):
            read_snapshot(path)
        path.write_bytes(b" " * (1024 * 1024 + 1))
        with self.assertRaises(CatalogError):
            read_snapshot(path)

    def test_corrupt_store_never_resolves_an_approved_entry(self):
        self.publish()
        self.catalog.approve(URN, "1.0.0", self.digest)
        package = get_package(self.digest)
        script = package / "run.py"
        script.chmod(0o644)
        script.write_text("tampered")
        with self.assertRaises(PaxletError):
            self.catalog.resolve(URN, action="hello")

    def test_concurrent_publish_serializes_revision_and_same_package_retry(self):
        source, digest, _ = self.package("v2", version="2.0.0")
        jobs = [(self.source, self.digest), (source, digest)] * 3
        def publish(item):
            catalog = Catalog(self.catalog.root)
            return catalog.install(item[0], expected_digest=item[1])
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(publish, jobs))
        self.assertEqual(len(results), 6)
        snapshot = self.catalog.snapshot()
        self.assertEqual(snapshot["revision"], 2)
        self.assertEqual(sorted(e["revision"] for e in snapshot["entries"]), [1, 2])

    def test_concurrent_snapshots_cannot_regress_accepted_revision(self):
        self.publish()
        live = self.catalog.snapshot()
        self.catalog.withdraw(URN, "1.0.0", self.digest)
        withdrawn = self.catalog.snapshot()
        with self.node("b") as b:
            def receive(snapshot):
                try:
                    return self.apply(Catalog(b.root), snapshot)
                except CatalogError as error:
                    return str(error)
            with ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(receive, [live, withdrawn]))
            self.assertTrue(b.records()[0]["withdrawn"])
            with self.assertRaises(CatalogError):
                self.apply(b, live)

    def cli(self, node, *arguments, ok=True):
        env = {**os.environ, "PAXLET_STORE_DIR": str(self.root / node / "store"),
               "PYTHONDONTWRITEBYTECODE": "1",
               "PYTHONPATH": os.pathsep.join([str(ROOT), *sys.path])}
        result = subprocess.run([sys.executable, "-B", "-m", "app.paxlet_catalog", "--root", str(self.root / node / "catalog"), *arguments],
                                cwd=self.root, env=env, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0 if ok else 1, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_three_process_nodes_offline_rejoin_preserve_withdrawals_and_pins(self):
        for node in ("b", "c"):
            self.cli(node, "init", "--node-id", "node-" + node)
            self.cli(node, "trust", "example", "node-a")
        self.cli("a", "install", str(self.archive), "--digest", self.digest)
        old = self.root / "old.json"
        old.write_text(json.dumps(self.cli("a", "snapshot")))
        self.cli("b", "apply", str(old), "--origin", "node-a", "--archives", str(self.archive.parent))
        self.cli("b", "resolve", URN, "--action", "hello", ok=False)
        self.cli("b", "approve", URN, "--version", "1.0.0", "--digest", self.digest, "--binding", BINDING)
        self.assertEqual(self.cli("b", "resolve", BINDING + "/actions/hello")["digest"], self.digest)
        self.cli("a", "withdraw", URN, "--version", "1.0.0", "--digest", self.digest)
        _, digest, archive = self.package("version2", version="2.0.0")
        self.cli("a", "install", str(archive), "--digest", digest)
        latest = self.root / "latest.json"
        latest.write_text(json.dumps(self.cli("a", "snapshot")))
        for node in ("b", "c"):
            self.cli(node, "apply", str(latest), "--origin", "node-a", "--archives", str(archive.parent))
            self.cli(node, "apply", str(old), "--origin", "node-a", "--archives", str(archive.parent), ok=False)
            self.cli(node, "resolve", URN, "--version", "1.0.0", "--action", "hello", ok=False)
            records = self.cli(node, "list")
            self.assertTrue(records[0]["withdrawn"])
            self.assertFalse(any(r["approved"] for r in records))
            self.assertEqual(records[1]["digest"], digest)
        self.assertEqual(self.cli("b", "list"), self.cli("c", "list"))
        self.assertFalse((self.root / "c/store/objects-v1" / self.digest[7:]).exists())
        self.assertFalse((self.root / "EXECUTED").exists())


if __name__ == "__main__":
    unittest.main()
