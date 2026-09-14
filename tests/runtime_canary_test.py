import contextlib
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import time
import unittest
from unittest.mock import patch

from app import runtime_canary as canary


@contextlib.contextmanager
def server(mode="success"):
    seen = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            seen.append((self.path, self.headers.get("Authorization")))
            if mode == "timeout":
                time.sleep(2)
                return
            status, body = 200, {}
            if self.path.startswith("/api/context"):
                body = {"ok": True, "objects": []}
            elif self.path == "/api/mesh/state":
                body = {"ok": True, "schema": "taskand.mesh-observation/v1",
                        "counts": {"processes": 1, "organisms": 1, "configuredPeers": 0, "onlinePeers": None}}
            elif self.path == "/api/federation":
                body = {"ok": True, "processes": [{"uri": "proc://taskand.dev/x/y/v1"}]}
            elif self.path == "/.well-known/catalog.json":
                body = {"ok": True, "processes": [{"uri": "proc://taskand.dev/x/y/v1"}]}
            else:
                status, body = 404, {"ok": False}
            if mode == "auth-failure" and self.path.startswith("/api/"):
                status, body = 401, {"ok": False, "error": "private-body-must-not-appear"}
            if mode == "malformed" and self.path == "/api/mesh/state":
                body = "not-json"
            if mode == "oversized" and self.path == "/api/mesh/state":
                body = "x" * (canary.BODY_LIMIT + 1)
            self.send_response(status)
            raw = body.encode() if isinstance(body, str) else json.dumps(body).encode()
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_POST(self):
            seen.append((self.path, self.headers.get("Authorization")))
            self.rfile.read(int(self.headers.get("Content-Length", "0")))
            if self.path != "/api/registry":
                self.send_response(404); self.end_headers(); return
            body = {"ok": True, "result": {"ok": True, "total": 30}}
            if mode == "auth-failure":
                body = {"ok": False, "error": "private-body-must-not-appear"}
            raw = json.dumps(body).encode()
            self.send_response(401 if mode == "auth-failure" else 200)
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers(); self.wfile.write(raw)

        def log_message(self, *_args):
            pass

    service = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=service.serve_forever, daemon=True)
    thread.start()
    try:
        yield service.server_port, seen
    finally:
        service.shutdown(); service.server_close(); thread.join(1)


class RuntimeCanaryTests(unittest.TestCase):
    def test_success_is_read_only_and_bounded(self):
        with server() as (port, seen), patch.dict(os.environ, {"CANARY_TEST_TOKEN": "synthetic-only"}):
            report = canary.canary(port, 3, "CANARY_TEST_TOKEN")
        self.assertTrue(report["passed"], report)
        self.assertFalse(report["grantsAuthority"])
        self.assertFalse(report["writes"])
        self.assertFalse(report["observersActivated"])
        self.assertEqual(len(report["probes"]), 5)
        self.assertIn(("/api/context?kind=user_twin", "Bearer synthetic-only"), seen)
        self.assertIn(("/api/federation", None), seen)
        self.assertNotIn("synthetic-only", json.dumps(report))

    def test_missing_token_never_contacts_runtime(self):
        with server() as (_port, seen), patch.dict(os.environ, {}, clear=True):
            report = canary.canary(1, 1, "CANARY_TEST_TOKEN")
        self.assertFalse(report["passed"])
        self.assertEqual(report["findings"], ["CANARY_CREDENTIAL_MISSING"])
        self.assertEqual(seen, [])

    def test_auth_failure_is_explicit_without_body_leak(self):
        with server("auth-failure") as (port, _), patch.dict(os.environ, {"CANARY_TEST_TOKEN": "synthetic-only"}):
            report = canary.canary(port, 3, "CANARY_TEST_TOKEN")
        self.assertFalse(report["passed"])
        self.assertIn("UNEXPECTED_HTTP_STATUS:context", report["findings"])
        self.assertNotIn("private-body", json.dumps(report))

    def test_malformed_json_and_timeout_fail_closed(self):
        with server("malformed") as (port, _), patch.dict(os.environ, {"CANARY_TEST_TOKEN": "synthetic-only"}):
            report = canary.canary(port, 3, "CANARY_TEST_TOKEN")
        self.assertFalse(report["passed"])
        self.assertIn("INVALID_JSON:mesh", report["findings"])
        with server("timeout") as (port, _), patch.dict(os.environ, {"CANARY_TEST_TOKEN": "synthetic-only"}):
            report = canary.canary(port, 0.2, "CANARY_TEST_TOKEN")
        self.assertFalse(report["passed"])
        self.assertTrue(any(item.startswith("PROBE_TIMEOUT:") for item in report["findings"]))

        with server("oversized") as (port, _), patch.dict(os.environ, {"CANARY_TEST_TOKEN": "synthetic-only"}):
            report = canary.canary(port, 3, "CANARY_TEST_TOKEN")
        self.assertFalse(report["passed"])
        self.assertIn("RESPONSE_TOO_LARGE:mesh", report["findings"])

    def test_input_rejects_non_loopback_and_invalid_budget(self):
        with self.assertRaisesRegex(ValueError, "LOOPBACK_ONLY"):
            canary.canary(8077, 1, "TOKEN", host="192.0.2.1")
        with self.assertRaisesRegex(ValueError, "TIMEOUT_RANGE"):
            canary.canary(8077, 31, "TOKEN")


if __name__ == "__main__":
    unittest.main()
