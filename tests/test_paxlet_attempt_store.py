"""Tests for AttemptStore and PaxletTaskandExecutor."""
from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from app.paxlet_adapter import AttemptStore, PaxletTaskandExecutor, compute_digest
from app.shell_workflow import export_package, run_package


class PaxletAttemptStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.store = AttemptStore(store_dir=self.root / "attempts")

    def test_attempt_store_record_and_retrieve(self):
        receipt = {
            "receipt": "paxlet/0.1",
            "identity": {"urn": "urn:paxlet:taskand:demo", "version": "1.0.0"},
            "package_digest": "sha256:" + "a" * 64,
            "action": "run",
            "input_digest": "sha256:" + "b" * 64,
            "output_digest": "sha256:" + "c" * 64,
            "runtime": "taskand-executor/1.0",
            "node": "urn:paxlet:node:test",
            "started_at": "2026-09-27T12:00:00Z",
            "finished_at": "2026-09-27T12:00:01Z",
            "exit_code": 0,
            "granted_secret_names": [],
            "artifact_refs": [],
        }

        rec = self.store.record_attempt(
            urn="urn:paxlet:taskand:demo",
            action="run",
            digest="sha256:" + "a" * 64,
            status="SUCCESS",
            input_payload={"param": "value"},
            output={"result": 42},
            receipt=receipt,
            started_at="2026-09-27T12:00:00Z",
            finished_at="2026-09-27T12:00:01Z",
            duration_ms=100.5,
            exit_code=0,
        )

        self.assertTrue(rec.attempt_id.startswith("att_"))
        self.assertEqual(rec.status, "SUCCESS")
        self.assertTrue(rec.receipt_digest.startswith("sha256:"))

        # Retrieve
        retrieved = self.store.get_attempt(rec.attempt_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.urn, "urn:paxlet:taskand:demo")
        self.assertEqual(retrieved.receipt["action"], "run")

        # List
        attempts = self.store.list_attempts(urn="urn:paxlet:taskand:demo")
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0]["attempt_id"], rec.attempt_id)

    def test_executor_runs_paxlet_and_persists_attempt(self):
        executor = PaxletTaskandExecutor(attempt_store=self.store)

        # Build simple package
        pkg_dir = self.root / "sample-pkg"
        plan = {
            "schema_version": "0.1",
            "name": "calc",
            "steps": [
                {"id": "calc", "kind": "generate", "language": "python", "code": "import sys, json; print(json.dumps({'calc': 7 * 6}))\n"},
            ],
        }
        exported = export_package(plan, pkg_dir, urn="urn:paxlet:taskand:calc", permissions={})

        result = executor.execute_urn(
            package_directory=pkg_dir,
            action="run",
            expected_digest=exported["digest"],
        )

        self.assertEqual(result["urn"], "urn:paxlet:taskand:calc")
        self.assertEqual(result["output"]["exit_code"], 0)
        self.assertIn("calc", result["output"]["stdout"])

        attempt_id = result["attempt_id"]
        rec = self.store.get_attempt(attempt_id)
        self.assertIsNotNone(rec)
        self.assertEqual(rec.status, "SUCCESS")
        self.assertEqual(rec.digest, exported["digest"])

    def test_run_package_integrates_attempt_store(self):
        pkg_dir = self.root / "workflow-pkg"
        plan = {
            "schema_version": "0.1",
            "name": "msg",
            "steps": [
                {"id": "msg", "kind": "generate", "language": "python", "code": "print('Taskand pipeline execution test')\n"},
            ],
        }
        exported = export_package(plan, pkg_dir, urn="urn:paxlet:taskand:msg", permissions={})

        res = run_package(pkg_dir, expected_digest=exported["digest"])
        self.assertIn("attempt_id", res)
        self.assertIn("receipt_digest", res)
        self.assertTrue(res["attempt_id"].startswith("att_"))
