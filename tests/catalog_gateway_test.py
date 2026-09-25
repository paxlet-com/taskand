"""Opt-in catalog gateway surface and authenticated peer replication; disposable state only."""
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from app.paxlet_catalog import Catalog
from paxlet.manifest import package_digest
from paxlet.packing import pack
from paxlet.store import get_package, put_package

from gateway.gossip import GossipEngine, stop_gossip_service
from gateway.handlers.catalog import (handle_catalog, handle_catalog_package,
                                      handle_catalog_snapshot, handle_catalog_snapshot_apply)

ROOT = Path(__file__).resolve().parents[1]
URN = "urn:paxlet:example:hello"
BINDING = "paxlet://example/hello"
GRANTS = {"users": {
    "read": {"token": "reader-fixture", "role": "user",
             "allowed_uris": ["proc://taskand.dev/*"], "allowed_actions": ["read"]},
    "admin": {"token": "admin-fixture", "role": "administrator",
              "allowed_uris": ["proc://taskand.dev/*"], "allowed_actions": ["*"]}}}


class CatalogFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.environment = patch.dict(os.environ, {
            "PAXLET_STORE_DIR": str(self.root / "store"),
            "TASKAND_CATALOG_ROOT": str(self.root / "local/catalog"),
            "TASKAND_PEERS": "", "TASKAND_GOSSIP_PEER_TOKENS": "{}",
            "TASKAND_CATALOG_PEERS": "{}", "TASKAND_GOSSIP_AUTO_APPROVE": "0",
            "TASKAND_GOSSIP_INTERVAL": "5"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.addCleanup(stop_gossip_service)
        self.local = Catalog(self.root / "local/catalog", node_id="node-a")

    def package(self, name="hello", urn=URN, binding=BINDING):
        source = self.root / "sources" / name
        source.mkdir(parents=True)
        manifest = {"paxlet": "0.1", "identity": {"urn": urn, "name": name, "version": "1.0.0"},
                    "bindings": [binding], "actions": {"hello": {"runtime": {"type": "python", "entry": "run.py"},
                    "input": {"type": "object"}, "output": {"type": "object"}}},
                    "resources": [], "requires": [],
                    "permissions": {"filesystem": {"read": [], "write": []}, "network": [], "secrets": []}}
        (source / "paxlet.json").write_text(json.dumps(manifest))
        (source / "run.py").write_text("print('{}')")
        digest = package_digest(source, manifest)
        archive = self.root / "archives" / (digest[7:] + ".paxlet.zip")
        archive.parent.mkdir(exist_ok=True)
        pack(source, archive)
        return source, digest, archive

    def remote_snapshot(self):
        """Peer node-b publishes the fixture package inside its own disposable store."""
        with patch.dict(os.environ, {"PAXLET_STORE_DIR": str(self.root / "remote/store")}):
            remote = Catalog(self.root / "remote/catalog", node_id="node-b")
            remote.trust_namespace("example", "node-b")
            remote.install(self.source, expected_digest=self.digest)
            return remote.snapshot()

    def handler(self, token, path="/api/catalog"):
        return MagicMock(headers={"Authorization": "Bearer " + token}, path=path)


class CatalogSurfaceTests(CatalogFixture):
    def test_surface_is_inert_without_catalog_root(self):
        with patch.dict(os.environ, {"TASKAND_CATALOG_ROOT": ""}), \
                patch("gateway.auth.load_grants", return_value=GRANTS):
            for handler_fn in (handle_catalog, handle_catalog_snapshot):
                target = self.handler("reader-fixture")
                handler_fn(target, {})
                self.assertEqual(target._send.call_args.args[0], 503)
                self.assertEqual(target._send.call_args.args[1]["error"], "CATALOG_NOT_CONFIGURED")
            target = self.handler("reader-fixture", "/api/catalog/package?digest=sha256:" + "0" * 64)
            handle_catalog_package(target, {})
            self.assertEqual(target._send.call_args.args[0], 503)

    def test_endpoints_require_read_and_admin_grants(self):
        self.source, self.digest, self.archive = self.package()
        self.local.trust_namespace("example", "node-b")
        snapshot = self.remote_snapshot()
        with patch("gateway.auth.load_grants", return_value=GRANTS):
            anonymous = MagicMock(headers={}, path="/api/catalog")
            handle_catalog(anonymous, {})
            self.assertEqual(anonymous._send.call_args.args[0], 401)
            for handler_fn, path in [(handle_catalog, "/api/catalog"),
                                     (handle_catalog_snapshot, "/api/catalog/snapshot")]:
                reader = self.handler("reader-fixture", path)
                handler_fn(reader, {})
                self.assertEqual(reader._send.call_args.args[0], 200)
            snapshot_reader = self.handler("reader-fixture", "/api/catalog/snapshot")
            handle_catalog_snapshot(snapshot_reader, {})
            body = snapshot_reader._send.call_args.args[1]
            self.assertEqual(body["schema"], "taskand.paxlet-catalog/v1")
            self.assertEqual(body["entries"], [])
            pushed = self.handler("reader-fixture", "/api/catalog/snapshot")
            handle_catalog_snapshot_apply(pushed, {"origin": "node-b", "snapshot": snapshot})
            self.assertEqual(pushed._send.call_args.args[0], 403)

    def test_pushed_snapshot_applies_only_through_explicit_origin(self):
        self.source, self.digest, self.archive = self.package()
        put_package(self.archive)
        self.local.trust_namespace("example", "node-b")
        snapshot = self.remote_snapshot()
        with patch("gateway.auth.load_grants", return_value=GRANTS):
            for body in [{}, {"origin": "node-b"}, {"snapshot": snapshot},
                         {"origin": "node-c", "snapshot": snapshot},
                         {"origin": "node-b", "snapshot": snapshot, "extra": 1},
                         {"origin": "node-b", "snapshot": {**snapshot, "origin": "node-c"}}]:
                with self.subTest(body=sorted(body)):
                    target = self.handler("admin-fixture", "/api/catalog/snapshot")
                    handle_catalog_snapshot_apply(target, body)
                    self.assertEqual(target._send.call_args.args[0], 400)
            self.assertEqual(self.local.records(), [])
            target = self.handler("admin-fixture", "/api/catalog/snapshot")
            handle_catalog_snapshot_apply(target, {"origin": "node-b", "snapshot": snapshot})
            self.assertEqual(target._send.call_args.args[0], 200)
            record = self.local.records()[0]
            self.assertEqual((record["urn"], record["digest"], record["origin"]),
                             (URN, self.digest, "node-b"))
            stale = self.handler("admin-fixture", "/api/catalog/snapshot")
            handle_catalog_snapshot_apply(stale, {"origin": "node-b",
                                                  "snapshot": {**snapshot, "revision": snapshot["revision"] - 1}})
            self.assertEqual(stale._send.call_args.args[0], 400)

    def test_apply_fails_closed_when_package_bytes_are_missing(self):
        self.source, self.digest, self.archive = self.package()
        self.local.trust_namespace("example", "node-b")
        snapshot = self.remote_snapshot()
        self.assertIsNone(get_package(self.digest))
        with patch("gateway.auth.load_grants", return_value=GRANTS):
            target = self.handler("admin-fixture", "/api/catalog/snapshot")
            handle_catalog_snapshot_apply(target, {"origin": "node-b", "snapshot": snapshot})
            self.assertEqual(target._send.call_args.args[0], 400)
        self.assertEqual(self.local.records(), [])

    def test_package_endpoint_serves_only_pinned_store_bytes(self):
        self.source, self.digest, self.archive = self.package()
        put_package(self.archive)
        with patch("gateway.auth.load_grants", return_value=GRANTS):
            for path, code in [("/api/catalog/package", 400),
                               ("/api/catalog/package?digest=sha256:" + "0" * 64, 404),
                               ("/api/catalog/package?digest=sha256:ABCDEF" + "0" * 58, 400)]:
                target = self.handler("reader-fixture", path)
                handle_catalog_package(target, {})
                self.assertEqual(target._send.call_args.args[0], code, path)
            target = self.handler("reader-fixture", "/api/catalog/package?digest=" + self.digest)
            handle_catalog_package(target, {})
            target.send_response.assert_called_once_with(200)
            self.assertEqual(b"".join(c.args[0] for c in target.wfile.write.call_args_list),
                             self.archive.read_bytes())


class CatalogPeerSyncTests(CatalogFixture):
    def engine(self, mapping):
        environment = patch.dict(os.environ, {"TASKAND_CATALOG_PEERS": json.dumps(mapping)})
        environment.start()
        self.addCleanup(environment.stop)
        engine = GossipEngine()
        engine.discover_peers = lambda: list(mapping)
        return engine

    def registry_list(self, action, data, timeout=5):
        if action == "list":
            return {"ok": True, "processes": []}
        raise AssertionError(action)

    def test_peer_snapshot_pulls_missing_digest_pinned_archives(self):
        self.source, self.digest, self.archive = self.package()
        snapshot = self.remote_snapshot()
        self.local.trust_namespace("example", "node-b")
        engine = self.engine({"http://seed.invalid": "node-b"})
        archive_bytes = self.archive.read_bytes()
        def http_json(url, timeout=3, **kwargs):
            if url.endswith("healthz"):
                return {"ok": True}
            if url.endswith("cluster/gossip"):
                return {"ok": True, "peers": {}}
            if url.endswith("catalog/snapshot"):
                return snapshot
            return {"ok": True, "standard": "taskand-registry/1", "node": "seed", "processes": []}
        fetched = []
        def http_bytes(url, timeout=3, **kwargs):
            fetched.append(url)
            return archive_bytes
        engine._http_get_json = http_json
        engine._http_get_bytes = http_bytes
        with patch("gateway.gossip.registry", side_effect=self.registry_list):
            result = engine.sync_once()
        self.assertTrue(result["ok"], result)
        catalog = result["peers"]["http://seed.invalid"]["catalog"]
        self.assertEqual(catalog, {"node": "node-b", "applied": True, "changed": True,
                                   "revision": snapshot["revision"], "error": None})
        self.assertEqual(fetched, ["http://seed.invalid/api/catalog/package?digest=" + self.digest])
        self.assertIsNotNone(get_package(self.digest))
        self.assertEqual((get_package(self.digest).parent / "package.paxlet.zip").read_bytes(),
                         archive_bytes)
        records = self.local.records()
        self.assertEqual(len(records), 1)
        self.assertEqual((records[0]["urn"], records[0]["digest"], records[0]["origin"]),
                         (URN, self.digest, "node-b"))
        self.assertFalse(records[0]["approved"])
        self.assertFalse((self.root / "EXECUTED").exists())
        with patch("gateway.gossip.registry", side_effect=self.registry_list):
            again = engine.sync_once()
        repeat = again["peers"]["http://seed.invalid"]["catalog"]
        self.assertTrue(repeat["applied"])
        self.assertFalse(repeat["changed"])

    def test_catalog_pull_never_grants_trust_or_breaks_the_round(self):
        self.source, self.digest, self.archive = self.package()
        snapshot = self.remote_snapshot()
        engine = self.engine({"http://seed.invalid": "node-b"})
        engine._http_get_json = lambda url, timeout=3, **kwargs: (
            {"ok": True} if url.endswith("healthz")
            else snapshot if url.endswith("catalog/snapshot")
            else {"ok": True, "standard": "taskand-registry/1", "node": "seed", "processes": []})
        with patch("gateway.gossip.registry", side_effect=self.registry_list):
            result = engine.sync_once()
        self.assertTrue(result["ok"], result)
        peer = result["peers"]["http://seed.invalid"]
        self.assertIsNone(peer["error"])
        self.assertEqual(peer["catalog"]["error"], "catalog synchronization failed")
        self.assertFalse(peer["catalog"]["applied"])
        self.assertEqual(self.local.records(), [])

    def test_unmapped_peers_have_no_catalog_channel(self):
        engine = self.engine({})
        engine.discover_peers = lambda: ["http://seed.invalid"]
        engine._http_get_json = lambda url, timeout=3, **kwargs: (
            {"ok": True} if url.endswith("healthz")
            else {"ok": True, "standard": "taskand-registry/1", "node": "seed", "processes": []})
        called = []
        engine._http_get_bytes = lambda *args, **kwargs: called.append(args) or b""
        with patch("gateway.gossip.registry", side_effect=self.registry_list):
            result = engine.sync_once()
        self.assertTrue(result["ok"], result)
        self.assertNotIn("catalog", result["peers"]["http://seed.invalid"])
        self.assertEqual(called, [])

    def test_catalog_peer_mapping_is_bounded_and_explicit(self):
        for mapping in ['{"http://seed.invalid": "bad node"}', '[["http://a", "node-b"]]',
                        '{"http://seed.invalid/a": "node-b"}',
                        json.dumps({f"http://peer-{i}": "node-b" for i in range(17)})]:
            with self.subTest(mapping=mapping), \
                    patch.dict(os.environ, {"TASKAND_CATALOG_PEERS": mapping}), \
                    self.assertRaises(ValueError):
                GossipEngine()


if __name__ == "__main__":
    unittest.main()
