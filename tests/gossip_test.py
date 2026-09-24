"""Unit tests for Taskand background gossip and autonomous continuous replication."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from gateway.gossip import GossipEngine, get_gossip_engine, start_gossip_service, stop_gossip_service
from gateway.handlers.gossip import handle_gossip_status, handle_gossip_trigger


class TestGossipEngine(unittest.TestCase):
    def setUp(self):
        stop_gossip_service()

    def tearDown(self):
        stop_gossip_service()

    def test_engine_initialization_and_status(self):
        engine = GossipEngine(interval=2.5, auto_approve=True, auth_token="test-token")
        self.assertEqual(engine.interval, 2.5)
        self.assertTrue(engine.auto_approve)
        self.assertEqual(engine.auth_token, "test-token")

        status = engine.get_status()
        self.assertTrue(status["ok"])
        self.assertFalse(status["running"])
        self.assertEqual(status["interval"], 2.5)
        self.assertTrue(status["auto_approve"])
        self.assertIsNone(status["last_sync"])
        self.assertEqual(status["peers"], {})
        self.assertEqual(status["synced_uris"], [])

    @patch("gateway.gossip.registry")
    def test_discover_peers(self, mock_registry):
        mock_registry.return_value = {
            "ok": True,
            "peers": ["http://127.0.0.1:8071/", "http://127.0.0.1:8072"],
        }
        with patch.dict("os.environ", {"TASKAND_PEERS": "http://127.0.0.1:8073"}):
            engine = GossipEngine()
            peers = engine.discover_peers()
            self.assertIn("http://127.0.0.1:8071", peers)
            self.assertIn("http://127.0.0.1:8072", peers)
            self.assertIn("http://127.0.0.1:8073", peers)

    @patch("gateway.gossip.registry")
    def test_sync_once_pulls_and_approves_missing_packages(self, mock_registry):
        engine = GossipEngine(interval=1.0, auto_approve=True, auth_token="test-token")

        # Mock discover_peers
        engine.discover_peers = MagicMock(return_value=["http://peer1:8077"])

        # Mock local registry list (no active processes)
        def registry_side_effect(action, payload, timeout=10):
            if action == "list":
                return {"ok": True, "processes": []}
            if action == "pull":
                return {
                    "ok": True,
                    "imported": 1,
                    "report": [{"uri": "proc://taskand.dev/demo/task/v1", "result": "imported"}],
                }
            if action == "approve":
                return {"ok": True, "uri": payload.get("uri")}
            return {"ok": True}

        mock_registry.side_effect = registry_side_effect

        # Mock _http_get_json for healthz, gossip, and catalog
        def http_side_effect(url, timeout=3.0):
            if url.endswith("/healthz"):
                return {"ok": True, "node": "peer1", "version": "2.2"}
            if url.endswith("/api/cluster/gossip"):
                return {"ok": True, "peers": {}}
            if url.endswith("/.well-known/catalog.json"):
                return {
                    "ok": True,
                    "processes": [
                        {
                            "uri": "proc://taskand.dev/demo/task/v1",
                            "status": "active",
                            "hash": "sha256:" + "0" * 64,
                        }
                    ],
                }
            return None

        engine._http_get_json = MagicMock(side_effect=http_side_effect)

        result = engine.sync_once()

        self.assertTrue(result["ok"])
        self.assertEqual(result["peers_count"], 1)
        self.assertIn("proc://taskand.dev/demo/task/v1", result["synced_this_round"])
        self.assertIn("proc://taskand.dev/demo/task/v1", result["total_synced"])

        # Verify registry was called with pull and approve
        actions_called = [call[0][0] for call in mock_registry.call_args_list]
        self.assertIn("pull", actions_called)
        self.assertIn("approve", actions_called)

        # Check status
        status = engine.get_status()
        self.assertIn("proc://taskand.dev/demo/task/v1", status["synced_uris"])
        self.assertTrue(status["peers"]["http://peer1:8077"]["up"])
        self.assertEqual(status["peers"]["http://peer1:8077"]["pulled_count"], 1)

    def test_gossip_handlers(self):
        engine = GossipEngine(interval=5.0)
        engine.get_status = MagicMock(return_value={"ok": True, "running": True})
        engine.sync_once = MagicMock(return_value={"ok": True, "synced_this_round": []})

        mock_handler = MagicMock()

        with patch("gateway.handlers.gossip.get_gossip_engine", return_value=engine):
            handle_gossip_status(mock_handler, {})
            mock_handler._send.assert_called_with(200, {"ok": True, "running": True})

            handle_gossip_trigger(mock_handler, {})
            mock_handler._send.assert_called_with(200, {"ok": True, "synced_this_round": []})

    def test_start_and_stop_lifecycle(self):
        engine = start_gossip_service()
        self.assertTrue(engine.get_status()["running"])
        stop_gossip_service()
        self.assertFalse(engine.get_status()["running"])


if __name__ == "__main__":
    unittest.main()
