import json
import unittest
from unittest.mock import patch

from gateway.handlers.observers import (
    FIXTURES,
    digest,
    normalize,
    plan,
    simulate,
    handle_pilot,
)


class ObserverTests(unittest.TestCase):
    def test_plan_is_deterministic_versioned_and_non_authorizing(self):
        self.assertEqual(plan(), plan())
        self.assertEqual(plan()["mode"], "FIXTURE_TWIN_ONLY")
        self.assertIn("AUTHORITY NONE", plan()["dsl"])
        self.assertEqual(plan()["dsl"].count("ACTION NORMALIZE_METADATA"), 3)

    def test_three_sources_run_in_fixture_twin_without_network(self):
        with patch(
            "socket.create_connection", side_effect=AssertionError("remote effect")
        ):
            result = simulate(plan())
        self.assertEqual(len(result["results"]), 3)
        self.assertTrue(all(r["normalizedCount"] == 2 for r in result["results"]))
        self.assertFalse(result["observersEnabled"])
        self.assertFalse(result["productionExecuted"])
        self.assertEqual(result["liveSources"], [])
        self.assertEqual(result["planDigest"], digest(plan()))
        self.assertEqual(result["status"], "WAIT_FOR_HUMAN_DECISION")

    def test_modified_plan_refuses_execution(self):
        for field, value in [
            ("mode", "LIVE"),
            ("sources", ["browser"]),
            ("fixtureDigest", "0" * 64),
        ]:
            candidate = plan()
            candidate[field] = value
            with self.assertRaises(ValueError):
                simulate(candidate)

    def test_sensitive_metadata_dropped_for_all_adapters(self):
        for source, rows in FIXTURES.items():
            for row in rows:
                result = json.dumps(normalize(source, row))
                for forbidden in ("fixture-secret", "/private/", "?token=", "--token="):
                    self.assertNotIn(forbidden, result)

    def test_unknown_inputs_do_not_become_training_evidence(self):
        for source, row in [
            ("unknown", {}),
            ("browser", {"kind": "keypress", "value": "secret"}),
            ("cli-ide", {"kind": "command.exit", "program": "/bin/sh", "exitCode": 0}),
            ("taskand", {"type": "git.changed", "data": {"count": True}}),
            ("browser", {"kind": "navigation", "url": "https://github.com/private"}),
            (
                "browser",
                {"kind": "navigation", "url": "https://user:secret@example.invalid"},
            ),
        ]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                normalize(source, row)

    def test_endpoint_cannot_enable_live_observers(self):
        from types import SimpleNamespace

        sent = []
        handler = SimpleNamespace(_send=lambda *args: sent.append(args))
        with (
            patch(
                "gateway.handlers.observers.require_grant",
                return_value={"name": "test"},
            ),
            patch("gateway.handlers.observers.default_store") as store,
        ):
            handle_pilot(handler, {"action": "enable", "sources": ["browser"]})
            self.assertEqual(sent[-1][0], 400)
            store.assert_not_called()

    def test_plan_precedes_simulation_and_receipt_is_owner_bound(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from types import SimpleNamespace
        from gateway.context import Store, ContextError

        with TemporaryDirectory(prefix="taskand-pilot-store-") as directory:
            store = Store(Path(directory) / "private")
            sent = []
            handler = SimpleNamespace(_send=lambda *args: sent.append(args))
            original = simulate

            def run(candidate):
                self.assertEqual(len(store.list("alice", "observer_plan")), 1)
                self.assertEqual(len(store.list("alice", "observer_receipt")), 0)
                return original(candidate)

            with (
                patch(
                    "gateway.handlers.observers.require_grant",
                    return_value={"name": "alice"},
                ),
                patch("gateway.handlers.observers.default_store", return_value=store),
                patch("gateway.handlers.observers.simulate", side_effect=run),
            ):
                handle_pilot(handler, {"action": "simulate"})
            code, response = sent[-1]
            self.assertEqual(code, 200)
            receipt = store.get("alice", response["receiptRef"])
            self.assertEqual(receipt["refs"], [response["planRef"]])
            with self.assertRaises(ContextError):
                store.get("bob", response["receiptRef"])
            self.assertFalse(receipt["payload"]["productionExecuted"])

    def test_no_grant_does_not_read_store_or_simulate(self):
        with (
            patch("gateway.handlers.observers.require_grant", return_value=None),
            patch("gateway.handlers.observers.default_store") as store,
            patch("gateway.handlers.observers.simulate") as run,
        ):
            handle_pilot(object(), {"action": "simulate"})
            store.assert_not_called()
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
