import contextlib
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import multiprocessing
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import runtime_readiness as readiness  # noqa: E402

PANEL = b"<title>readiness fixture</title>"
COMMIT = "a" * 40
SOURCE = {"sha": COMMIT, "panelSha256": hashlib.sha256(PANEL).hexdigest()}


@contextlib.contextmanager
def server(routes):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append((self.path, self.headers.get("Authorization")))
            status, body = routes.get(self.path, (404, b""))
            try:
                if status == "slow-headers":
                    self.wfile.write(b"HTTP/1.1 200 OK\r\nX-Slow: ")
                    self.wfile.flush()
                    for _ in range(30):
                        time.sleep(0.15)
                        self.wfile.write(b"a")
                        self.wfile.flush()
                    return
                if status == "slow-body":
                    self.send_response(200)
                    self.send_header("Content-Length", "10000")
                    self.end_headers()
                    for _ in range(30):
                        time.sleep(0.15)
                        self.wfile.write(b"a")
                        self.wfile.flush()
                    return
                self.send_response(status)
                self.send_header("Content-Length", str(len(body)))
                if status == 302:
                    self.send_header("Location", "/forbidden-redirect")
                self.end_headers()
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *args):
            pass

    service = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=service.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True)
    thread.start()
    try:
        yield service.server_port, requests
    finally:
        service.shutdown()
        service.server_close()
        thread.join(1)


def routes():
    return {"/": (200, PANEL), "/healthz": (200, json.dumps({"ok": True, "commit": COMMIT}).encode()),
            "/api/context": (401, b"private response must not appear"), "/api/mesh/state": (403, b"")}


class ReadinessTests(unittest.TestCase):
    def test_success_is_only_unauthenticated_preflight(self):
        with server(routes()) as (port, requests):
            # http.client does not consult proxy environment variables.
            with patch.dict("os.environ", {"HTTP_PROXY": "http://127.0.0.1:1", "http_proxy": "http://127.0.0.1:1"}):
                probes = readiness.probe_all(port, port, 3)
        report = readiness.assess(SOURCE, probes)
        self.assertTrue(report["preflightPassed"], report)
        self.assertFalse(report["runtimeVerified"])
        self.assertFalse(report["grantsAuthority"])
        self.assertEqual(report["nextAction"], "AUTHENTICATED_FUNCTIONAL_CANARY_REQUIRED")
        self.assertEqual({path for path, _ in requests}, set(readiness.ROUTES.values()))
        self.assertTrue(all(auth is None for _, auth in requests))
        self.assertNotIn("private response", json.dumps(report))

    def test_old_runtime_has_explicit_findings_without_bodies(self):
        fixture = routes()
        fixture.update({"/": (200, b"old html"), "/healthz": (200, b'{"ok":true}'),
                        "/api/context": (404, b"private-not-found"), "/api/mesh/state": (404, b"")})
        with server(fixture) as (port, _):
            report = readiness.assess(SOURCE, readiness.probe_all(port, port))
        codes = [finding["code"] for finding in report["findings"]]
        self.assertFalse(report["preflightPassed"])
        self.assertIn("PANEL_SOURCE_MISMATCH", codes)
        self.assertIn("GATEWAY_SOURCE_UNREPORTED", codes)
        self.assertEqual(codes.count("ENDPOINT_NOT_FOUND"), 2)
        self.assertNotIn("private-not-found", json.dumps(report))

    def test_redirect_and_public_api_response_fail_without_following(self):
        fixture = routes()
        fixture["/"] = (302, b"private redirect")
        fixture["/api/context"] = (200, b"private data")
        with server(fixture) as (port, requests):
            report = readiness.assess(SOURCE, readiness.probe_all(port, port))
        self.assertEqual({f["code"] for f in report["findings"]},
                         {"REDIRECT_NOT_FOLLOWED", "UNAUTHENTICATED_API_RESPONSE"})
        self.assertNotIn("/forbidden-redirect", [path for path, _ in requests])
        self.assertNotIn("private", json.dumps(report))

    def test_health_and_panel_byte_limits(self):
        fixture = routes()
        fixture["/healthz"] = (200, b"x" * (readiness.HEALTH_LIMIT + 1))
        fixture["/"] = (200, b"x" * (readiness.BODY_LIMIT + 1))
        with server(fixture) as (port, _):
            probes = readiness.probe_all(port, port)
        self.assertEqual(probes["health"]["code"], "RESPONSE_TOO_LARGE")
        self.assertEqual(probes["panel"]["code"], "RESPONSE_TOO_LARGE")
        self.assertNotIn("panelSha256", probes["panel"])

    def test_invalid_health_and_unknown_identity_fail_closed(self):
        for body in (b"[]", b"null", b'{"ok":1}', b"not-json"):
            with self.subTest(body=body):
                fixture = routes()
                fixture["/healthz"] = (200, body)
                with server(fixture) as (port, _):
                    probes = readiness.probe_all(port, port)
                self.assertEqual(probes["health"]["code"], "INVALID_HEALTH")

    def test_source_mismatch_and_unhealthy_are_independent(self):
        fixture = routes()
        fixture["/healthz"] = (200, json.dumps({"ok": False, "sha": "b" * 40}).encode())
        with server(fixture) as (port, _):
            report = readiness.assess(SOURCE, readiness.probe_all(port, port))
        self.assertEqual({f["code"] for f in report["findings"]},
                         {"GATEWAY_UNHEALTHY", "GATEWAY_SOURCE_MISMATCH"})

    def test_drip_headers_and_body_share_deadline_and_stream_fast_results(self):
        fixture = routes()
        fixture["/healthz"] = ("slow-headers", b"")
        fixture["/"] = ("slow-body", b"")
        events = []
        before = {p.pid for p in multiprocessing.active_children()}
        with server(fixture) as (port, _):
            start = time.monotonic()
            probes = readiness.probe_all(port, port, 1, lambda event: events.append((time.monotonic(), event)))
            elapsed = time.monotonic() - start
        self.assertLess(elapsed, 2.5)
        self.assertEqual(probes["health"]["code"], "PROBE_TIMEOUT")
        self.assertEqual(probes["panel"]["code"], "PROBE_TIMEOUT")
        self.assertEqual({event["probe"] for _, event in events[:2]}, {"mesh", "context"})
        self.assertLess(events[0][0] - start, 0.9)
        self.assertEqual({p.pid for p in multiprocessing.active_children()}, before)

    def test_invalid_budgets_and_ports_never_spawn(self):
        with patch.object(readiness.multiprocessing, "get_context", side_effect=AssertionError("spawn")):
            for timeout in (float("nan"), float("inf"), -1, 0, 16):
                with self.subTest(timeout=timeout), self.assertRaisesRegex(ValueError, "TIMEOUT_RANGE"):
                    readiness.probe_all(1, 1, timeout)
            for port in (True, 0, 65536, "8077"):
                with self.subTest(port=port), self.assertRaisesRegex(ValueError, "PORT_INVALID"):
                    readiness.probe_all(port, 8090)


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="readiness-test-")
        self.addCleanup(self.directory.cleanup)
        self.repo = Path(self.directory.name)
        self.git("init", "-q")
        (self.repo / "index.html").write_bytes(PANEL)
        self.git("add", "index.html")
        self.git("-c", "user.name=Readiness fixture", "-c", "user.email=fixture@example.invalid",
                 "commit", "-qm", "fixture")
        self.sha = self.git("rev-parse", "HEAD").strip()

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True,
                              capture_output=True, text=True, timeout=5).stdout

    def test_immutable_source_ignores_dirty_panel_without_git_writes(self):
        (self.repo / "index.html").write_bytes(b"dirty")
        before = self.git("status", "--porcelain")
        source = readiness.source_identity(self.repo, self.sha)
        self.assertEqual(source["panelSha256"], SOURCE["panelSha256"])
        self.assertEqual(self.git("status", "--porcelain"), before)
        self.assertEqual(self.git("rev-parse", "HEAD").strip(), self.sha)

    def test_moving_ref_rejected_before_git(self):
        with patch.object(readiness.subprocess, "run", side_effect=AssertionError("Git access")):
            for revision in ("main", "HEAD", "-h", "A" * 40, "a" * 39):
                with self.subTest(revision=revision), self.assertRaisesRegex(ValueError, "IMMUTABLE_SHA"):
                    readiness.source_identity(self.repo, revision)

    def test_committed_symlink_is_not_a_panel(self):
        panel = self.repo / "index.html"
        panel.unlink()
        panel.symlink_to("not-a-panel")
        self.git("add", "index.html")
        self.git("-c", "user.name=Readiness fixture", "-c", "user.email=fixture@example.invalid",
                 "commit", "-qm", "symlink fixture")
        with self.assertRaisesRegex(ValueError, "PANEL_BLOB_REQUIRED"):
            readiness.source_identity(self.repo, self.git("rev-parse", "HEAD").strip())

    def test_cli_jsonl_has_four_events_and_non_authorizing_summary(self):
        fixture = routes()
        fixture["/healthz"] = (200, json.dumps({"ok": True, "commit": self.sha}).encode())
        with server(fixture) as (port, _):
            result = subprocess.run([sys.executable, str(ROOT / "app/runtime_readiness.py"),
                                     "--repo", str(self.repo), "--expected-sha", self.sha,
                                     "--gateway-port", str(port), "--ui-port", str(port), "--stream"],
                                    capture_output=True, text=True, timeout=8)
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(len(lines), 5)
        self.assertTrue(all(not line["grantsAuthority"] for line in lines))
        self.assertFalse(lines[-1]["runtimeVerified"])
        self.assertTrue(lines[-1]["preflightPassed"])


if __name__ == "__main__":
    unittest.main()
