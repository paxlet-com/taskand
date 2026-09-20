"""Exercise the HTTP boundary and a real SDK client/server stdio exchange."""

import asyncio
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_SRC = ROOT / "packages" / "taskand-mcp" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from mcp import Client, StdioServerParameters

from taskand_mcp.gateway import Gateway, GatewayError, Settings, MAX_RESPONSE_BYTES

ECHO = "proc://taskand.dev/chat/message/v1"
DEV = "proc://taskand.dev/dev/codegen/v1"


class BoundaryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.requests = []
        self.override = None
        self.delay = 0
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def handle_request(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                payload = json.loads(body) if body else None
                owner.requests.append((self.command, self.path, self.headers.get("Authorization"), payload))
                if owner.delay:
                    time.sleep(owner.delay)
                status, raw, headers = 200, None, {}
                if owner.override:
                    status, raw, headers = owner.override
                elif self.path == "/.well-known/catalog.json":
                    raw = json.dumps({"ok": True, "processes": [
                        {"uri": DEV, "desc": "Generate code"},
                        {"uri": ECHO, "desc": "Echo message", "inputSchema": {"type": "object"}},
                    ]}).encode()
                elif self.path == "/api/proc/call":
                    if self.headers.get("Authorization") != "Bearer test-only" or payload["uri"] != ECHO:
                        status, raw = 403, b'{"ok":false,"error":"denied"}'
                    else:
                        raw = json.dumps({"ok": True, "uri": ECHO, "result": {
                            "ok": True, "message": payload["data"].get("message"),
                        }}).encode()
                else:
                    status, raw = 404, b'{"ok":false}'
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                try:
                    self.wfile.write(raw)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            do_GET = do_POST = handle_request

        self.http = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.http.server_port}"
        self.gateway = Gateway(Settings(self.url, "test-only"))

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(timeout=2)

    def client(self, credential="test-only"):
        return Client(StdioServerParameters(command=sys.executable,
                      args=["-m", "taskand_mcp.server"], env={
                          "PYTHONPATH": str(PACKAGE_SRC),
                          "TASKAND_MCP_GATEWAY_URL": self.url,
                          "TASKAND_MCP_TOKEN": credential,
                          "TASKAND_AUTH_TOKEN": "must-not-be-used",
                      }), read_timeout_seconds=10)

    async def test_real_stdio_discovery_describe_call_and_denial(self):
        async with self.client() as client:
            tools = (await client.list_tools()).tools
            self.assertEqual({tool.name for tool in tools}, {"list_processes", "describe_process", "call_process"})
            call_tool = next(tool for tool in tools if tool.name == "call_process")
            self.assertFalse(call_tool.annotations.read_only_hint)
            self.assertFalse(call_tool.annotations.idempotent_hint)
            self.assertIn("input_data", call_tool.input_schema["required"])
            first = await client.call_tool("list_processes", {"limit": 1})
            self.assertFalse(first.is_error)
            self.assertEqual(first.structured_content["next_offset"], 1)
            self.assertEqual(first.structured_content["processes"][0]["uri"], ECHO)
            second = await client.call_tool("list_processes", {"limit": 1, "offset": 1})
            self.assertEqual(second.structured_content["processes"][0]["uri"], DEV)
            self.assertIsNone(second.structured_content["next_offset"])
            description = await client.call_tool("describe_process", {"uri": DEV})
            self.assertFalse(description.structured_content["inputSchemaPublished"])
            described_echo = await client.call_tool("describe_process", {"uri": ECHO})
            self.assertTrue(described_echo.structured_content["inputSchemaPublished"])
            unknown = await client.call_tool("describe_process", {"uri": "proc://taskand.dev/unknown/process/v1"})
            self.assertTrue(unknown.is_error)
            payload = {"message": "Zażółć — MCP", "nested": {"items": [1, False, None]}}
            called = await client.call_tool("call_process", {"uri": ECHO, "input_data": payload, "timeout_seconds": 3})
            self.assertFalse(called.is_error)
            self.assertEqual(called.structured_content["result"]["message"], payload["message"])
            self.assertEqual(json.loads(called.content[0].text), called.structured_content)
            self.assertEqual(self.requests[-1], ("POST", "/api/proc/call", "Bearer test-only",
                                               {"uri": ECHO, "data": payload, "timeout": 3}))
            denied = await client.call_tool("call_process", {"uri": DEV, "input_data": {}})
            self.assertTrue(denied.is_error)
            self.assertEqual(denied.structured_content["errorType"], "HTTP_403")

    async def test_stdio_validation_prevents_network_requests(self):
        async with self.client() as client:
            for arguments in ({"uri": ECHO}, {"uri": ECHO, "input_data": []},
                              {"uri": ECHO, "input_data": {}, "timeout_seconds": 301},
                              {"uri": ECHO, "input_data": {}, "timeout_seconds": True},
                              {"uri": ECHO, "input_data": {}, "timeout_seconds": "5"},
                              {"uri": "proc://taskand.dev/../../etc/passwd", "input_data": {}}):
                response = await client.call_tool("call_process", arguments)
                self.assertTrue(response.is_error, arguments)
            self.assertTrue((await client.call_tool("list_processes", {"limit": 101})).is_error)
        self.assertEqual(self.requests, [])

    async def test_missing_credential_never_uses_inherited_admin(self):
        async with self.client(credential="") as client:
            self.assertFalse((await client.call_tool("list_processes")).is_error)
            denied = await client.call_tool("call_process", {"uri": ECHO, "input_data": {}})
            self.assertEqual(denied.structured_content["errorType"], "AUTH_REQUIRED")
        self.assertEqual(len(self.requests), 1)
        self.assertIsNone(self.requests[0][2])

    async def test_process_failure_is_mcp_error_even_with_http_200(self):
        self.override = (200, b'{"ok":true,"result":{"ok":false,"errorType":"DENIED"}}', {})
        async with self.client() as client:
            response = await client.call_tool("call_process", {"uri": ECHO, "input_data": {}})
            self.assertTrue(response.is_error)
            self.assertEqual(response.structured_content["result"]["errorType"], "DENIED")

    async def test_redirect_is_not_followed_or_retried(self):
        self.override = (307, b'{}', {"Location": self.url + "/capture-credential"})
        with self.assertRaises(GatewayError) as caught:
            await self.gateway.call(ECHO, {}, 1)
        self.assertEqual(caught.exception.code, "HTTP_307")
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.requests[0][1], "/api/proc/call")

    async def test_response_and_input_bounds_and_json_errors(self):
        for raw, expected in [(b'x' * (MAX_RESPONSE_BYTES + 1), "RESPONSE_TOO_LARGE"),
                              (b'not-json', "INVALID_RESPONSE"), (b'[]', "INVALID_RESPONSE"),
                              (b'{"ok":"true"}', "INVALID_RESPONSE"),
                              (b'{"ok":true,"value":NaN}', "INVALID_RESPONSE")]:
            self.override = (200, raw, {})
            with self.assertRaises(GatewayError) as caught:
                await self.gateway.request("/test")
            self.assertEqual(caught.exception.code, expected)
        before = len(self.requests)
        with self.assertRaises(GatewayError) as caught:
            await self.gateway.call(ECHO, {"data": "x" * (256 * 1024)}, 1)
        self.assertEqual(caught.exception.code, "INPUT_TOO_LARGE")
        with self.assertRaises(GatewayError):
            await self.gateway.call(ECHO, {"value": float("nan")}, 1)
        self.assertEqual(len(self.requests), before)

    async def test_deadline_returns_unknown_without_retry(self):
        self.delay = 0.5
        with self.assertRaises(GatewayError) as caught:
            await self.gateway.request("/api/proc/call", {"uri": ECHO, "data": {}}, timeout=0.25)
        self.assertEqual(caught.exception.code, "OUTCOME_UNKNOWN")
        await asyncio.sleep(0.6)
        self.assertEqual(len(self.requests), 1)

    async def test_catalog_rejects_duplicates_and_unavailable_results(self):
        for value in ({"ok": False, "processes": []}, {"ok": True, "processes": [{"uri": ECHO}] * 2},
                      {"ok": True, "processes": [None]}, {"ok": True, "processes": {}}):
            self.override = (200, json.dumps(value).encode(), {})
            with self.assertRaises(GatewayError):
                await self.gateway.catalog()

    def test_configuration_and_credentials_are_bounded(self):
        for url in ("http://example.com", "file:///tmp/file", "http://user:pass@localhost",
                    "http://localhost?key=foo", "http://localhost/#fragment", "http://localhost/path",
                    "http://localhost:99999", "http://localhost\n", "http://localhost:0"):
            with self.assertRaises(ValueError, msg=url):
                Settings(url)
        for url in ("https://taskand.example", "http://[::1]:8077", "http://127.0.0.1:8077/"):
            Settings(url)
        with self.assertRaises(ValueError):
            Settings(self.url, "header\ninjection")
        self.assertNotIn("test-only", repr(self.gateway.settings))
        with patch.dict(os.environ, {"TASKAND_AUTH_TOKEN": "must-not-be-used"}, clear=True):
            self.assertEqual(Settings.from_env().token, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
