"""Real SDK servers and native registry round trips, using isolated state."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "mcp"))


if "--fixture" in sys.argv:
    from mcp.server import MCPServer
    server = MCPServer("catalog-test", log_level="ERROR")
    state = Path(sys.argv[sys.argv.index("--fixture") + 1])

    @server.tool()
    def add(left: int, right: int) -> dict:
        """Add two integers and persist the observed result."""
        value = {"sum": left + right}
        (state / "result.json").write_text(json.dumps(value))
        return value

    @server.tool()
    def uncertain() -> dict:
        """Disconnect after one visible write."""
        with (state / "calls").open("a") as stream:
            stream.write("1\n")
        os._exit(1)

    if "--http" in sys.argv:
        server.run(transport="streamable-http", host="127.0.0.1", port=int(sys.argv[-1]))
    else:
        server.run(transport="stdio")
    raise SystemExit

import bridge
import catalog
import reprofile
from unittest.mock import AsyncMock, patch


class CatalogTests(unittest.IsolatedAsyncioTestCase):
    async def test_reprofile_creates_candidate_without_dispatch_or_rewriting_old_version(self):
        uri, tool = await self.prepared()
        self.assertTrue(self.registry_call("approve", uri=uri)["ok"])
        old = next((self.root / "mcp").rglob("tool.json"))
        original = old.read_bytes()
        changed = {**self.profile, "env": {"PROFILE_RECOVERY_FIXTURE": "1"}}
        self.profiles.write_text(json.dumps({"fixture": changed}))
        result = await reprofile.reprofile(self.root, self.profiles, uri, 2)
        self.assertEqual(result["status"], "candidate")
        self.assertFalse(result["admitted"])
        self.assertEqual(old.read_bytes(), original)
        self.assertFalse((self.state / "result.json").exists())
        self.assertEqual(self.registry_call("call", uri=result["candidateUri"], input={"left": 1, "right": 2})["errorType"], "DENIED")
        self.assertTrue(self.registry_call("approve", uri=result["candidateUri"])["ok"])
        self.assertTrue(self.registry_call("call", uri=result["candidateUri"], input={"left": 1, "right": 2})["ok"])
        with self.assertRaisesRegex(bridge.ContractError, "CANDIDATE_VERSION_EXISTS"):
            await reprofile.reprofile(self.root, self.profiles, uri, 2)
        with self.assertRaisesRegex(bridge.ContractError, "NEW_VERSION_REQUIRED"):
            await reprofile.reprofile(self.root, self.profiles, uri, 1)

    async def test_reprofile_rejects_unadmitted_or_changed_contract(self):
        uri, tool = await self.prepared()
        with self.assertRaisesRegex(bridge.ContractError, "ADMITTED_MCP_REQUIRED"):
            await reprofile.reprofile(self.root, self.profiles, uri, 2)
        self.registry_call("approve", uri=uri)
        self.profiles.write_text(json.dumps({"fixture": {**self.profile, "env": {"CHANGED": "1"}}}))
        with patch.object(reprofile, "tool_catalog", AsyncMock(return_value=[{**tool, "description": "changed"}])):
            with self.assertRaisesRegex(bridge.ContractError, "TOOL_CONTRACT_CHANGED"):
                await reprofile.reprofile(self.root, self.profiles, uri, 2)
        self.assertEqual(len(list((self.root / "mcp").rglob("tool.json"))), 1)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / "state"
        self.state.mkdir()
        self.profile = {"transport": "stdio", "command": sys.executable,
                        "args": [str(Path(__file__).resolve()), "--fixture", str(self.state)], "env": {}}
        self.registry = self.root / "generated/registry/core/taskand.dev/v1"
        shutil.copytree(ROOT / "generated/registry/core/taskand.dev/v1", self.registry)
        (self.root / "genome.yaml").write_text("organisms:\n")
        (self.root / "log").mkdir()
        self.profiles = self.root / "profiles.json"
        catalog.write_private(self.profiles, {"fixture": self.profile})

    async def tools(self):
        async with bridge.client(self.profile) as client:
            return await bridge.tool_catalog(client)

    def registry_call(self, action, **data):
        env = {**os.environ, "TASKAND_MCP_PROFILES": str(self.profiles), "TASKAND_MCP_PYTHON": sys.executable}
        result = subprocess.run(["node", str(self.registry / "bin.mjs")], input=json.dumps({"action": action, **data}),
                                capture_output=True, text=True, timeout=35, cwd=self.root, env=env)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    async def prepared(self, name="add"):
        tool = next(t for t in await self.tools() if t["name"] == name)
        uri = catalog.emit(self.root / "mcp", {"fixture": self.profile}, {"fixture": [tool]})[0]
        catalog.register(self.root, [uri])
        return uri, tool

    async def test_native_uri_candidate_approval_schema_and_result(self):
        uri, tool = await self.prepared()
        self.assertEqual(self.registry_call("call", uri=uri, input={"left": 2, "right": 3})["errorType"], "DENIED")
        self.assertTrue(self.registry_call("approve", uri=uri)["ok"])
        exported = self.registry_call("export")["processes"][0]
        self.assertEqual(exported["inputSchema"], tool["inputSchema"])
        result = self.registry_call("call", uri=uri, input={"left": 350, "right": 480})
        self.assertTrue(result["ok"], result)
        self.assertEqual(json.loads((self.state / "result.json").read_text()), {"sum": 830})
        self.assertFalse(result["taskSuccessVerified"])
        self.assertTrue(self.registry_call("verify")["ok"])

    async def test_invalid_arguments_and_profile_drift_never_dispatch(self):
        uri, tool = await self.prepared()
        descriptor = {"server": "fixture", "profilePin": bridge.digest(self.profile), "tool": tool}
        result = await bridge.invoke(descriptor, {"fixture": self.profile}, {"left": "bad", "right": 2})
        self.assertEqual(result["errorType"], "ARGUMENT_SCHEMA_INVALID")
        changed = {**self.profile, "args": []}
        result = await bridge.invoke(descriptor, {"fixture": changed}, {"left": 1, "right": 2})
        self.assertEqual(result["errorType"], "PROFILE_CHANGED")
        self.assertFalse((self.state / "result.json").exists())

    async def test_changed_tool_schema_rejected_before_call(self):
        tool = next(t for t in await self.tools() if t["name"] == "add")
        descriptor = {"server": "fixture", "profilePin": bridge.digest(self.profile),
                      "tool": {**tool, "description": "obsolete contract"}}
        result = await bridge.invoke(descriptor, {"fixture": self.profile}, {"left": 1, "right": 2})
        self.assertEqual(result["errorType"], "TOOL_SCHEMA_CHANGED")
        self.assertFalse((self.state / "result.json").exists())

    async def test_legacy_initialize_protocol_is_explicit(self):
        profile = {**self.profile, "protocolMode": "legacy"}
        async with bridge.client(profile) as session:
            tool = next(t for t in await bridge.tool_catalog(session) if t["name"] == "add")
        result = await bridge.invoke({"server": "legacy", "profilePin": bridge.digest(profile), "tool": tool},
                                     {"legacy": profile}, {"left": 3, "right": 4})
        self.assertTrue(result["ok"], result)
        self.assertEqual(json.loads((self.state / "result.json").read_text()), {"sum": 7})

    async def test_uncertain_effect_not_retried(self):
        uri, _ = await self.prepared("uncertain")
        self.assertTrue(self.registry_call("approve", uri=uri)["ok"])
        result = self.registry_call("call", uri=uri, input={})
        self.assertEqual(result["errorType"], "OUTCOME_UNKNOWN", result)
        self.assertFalse(result["outcomeKnown"])
        self.assertEqual((self.state / "calls").read_text(), "1\n")

    async def test_immutable_packages_and_untrusted_metadata(self):
        tools = await self.tools()
        outputs = catalog.emit(self.root / "mcp", {"fixture": self.profile}, {"fixture": tools})
        self.assertEqual(outputs, catalog.emit(self.root / "mcp", {"fixture": self.profile}, {"fixture": tools}))
        changed = [{**tools[0], "description": "Changed"}, *tools[1:]]
        with self.assertRaisesRegex(bridge.ContractError, "IMMUTABLE_VERSION_CONFLICT"):
            catalog.emit(self.root / "mcp", {"fixture": self.profile}, {"fixture": changed})
        self.assertNotEqual(catalog.slug("tool_name"), catalog.slug("tool-name"))
        self.assertNotIn("/", catalog.slug("../../escape"))

    async def test_http_discovery_and_invocation(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        proc = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--fixture", str(self.state), "--http", str(port)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=.1):
                        break
                except OSError:
                    await asyncio.sleep(.05)
            profile = {"transport": "http", "url": f"http://127.0.0.1:{port}/mcp"}
            async with bridge.client(profile) as session:
                tool = next(t for t in await bridge.tool_catalog(session) if t["name"] == "add")
            result = await bridge.invoke({"server": "http", "profilePin": bridge.digest(profile), "tool": tool},
                                         {"http": profile}, {"left": 2, "right": 4})
            self.assertTrue(result["ok"], result)
            self.assertEqual(json.loads((self.state / "result.json").read_text()), {"sum": 6})
        finally:
            proc.terminate()
            proc.wait(timeout=5)

    def test_duplicate_configuration_is_explicit(self):
        paths = [self.root / "first.json", self.root / "second.json"]
        for path, command in zip(paths, ["first", "second"]):
            path.write_text(json.dumps({"mcpServers": {"same": {"command": command}}}))
        with self.assertRaisesRegex(bridge.ContractError, "CONFIGURATION_NAME_CONFLICT"):
            catalog.merged_configurations(paths)
        servers, aliases = catalog.merged_configurations(paths, prefer_first=True)
        self.assertEqual(servers["same"]["command"], "first")
        self.assertEqual(aliases["same"], [str(paths[1])])

    def test_unavailable_server_reports_partial_inventory_and_nonzero_exit(self):
        config = self.root / "broken.json"
        config.write_text(json.dumps({"mcpServers": {
            "missing": {"command": str(self.root / "missing-command")},
            "taskand": {"command": sys.executable},
        }}))
        report = self.root / "report.json"
        result = subprocess.run([sys.executable, str(ROOT / "mcp/catalog.py"),
                                 "--config", str(config), "--output", str(self.root / "mcp"),
                                 "--profiles", str(self.root / "partial-profiles.json"),
                                 "--report", str(report)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        data = json.loads(report.read_text())
        self.assertFalse(data["allAvailable"])
        self.assertEqual(data["servers"]["missing"]["errorType"], "COMMAND_NOT_FOUND")
        self.assertEqual(data["servers"]["taskand"]["status"], "excluded")

    def test_private_profiles_and_no_secret_in_package(self):
        profile = {**self.profile, "env": {"SECRET": "test-sentinel-do-not-export"}}
        tool = {"name": "add", "inputSchema": {"type": "object"}}
        _, files = catalog.package_files("fixture", profile, tool, 1)
        self.assertFalse(any(b"test-sentinel-do-not-export" in raw for raw in files.values()))
        self.assertEqual(self.profiles.stat().st_mode & 0o777, 0o600)
        with self.assertRaisesRegex(bridge.ContractError, "PROFILE_FILE_CONFLICT"):
            catalog.write_private(self.profiles, {"fixture": profile})
        link = self.root / "link"
        link.symlink_to(self.root / "mcp", target_is_directory=True)
        with self.assertRaisesRegex(bridge.ContractError, "SYMLINK_REJECTED"):
            catalog.emit(link, {"fixture": profile}, {"fixture": [tool]})

    def test_config_validation_and_self_reference(self):
        with self.assertRaisesRegex(bridge.ContractError, "SELF_REFERENCE_EXCLUDED"):
            catalog.normalize("taskand", {"command": sys.executable})
        with self.assertRaisesRegex(bridge.ContractError, "DISABLED"):
            catalog.normalize("disabled", {"enabled": False})
        with self.assertRaisesRegex(bridge.ContractError, "HTTP_AUTH_UNSUPPORTED"):
            catalog.normalize("remote", {"url": "https://example.invalid/mcp", "bearer_token_env_var": "SECRET"})
        with self.assertRaisesRegex(bridge.ContractError, "EXTERNAL_SCHEMA_REFERENCE"):
            bridge.validate_schema({"$ref": "https://example.invalid/schema"})
        with self.assertRaisesRegex(bridge.ContractError, "INVALID_ENDPOINT"):
            bridge.client({"transport": "http", "url": "http://example.invalid/mcp"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
