"""Real installed Paxlet + nl-dsl-sh round trips, without an LLM provider."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.shell_workflow import (
    compile_plan, export_package, main, make_engine, run_package, verify_package, process_request,
)
from app.paxlet_catalog import Catalog as NativeCatalog, CatalogError
from nl_dsl_sh import Catalog
from paxlet.errors import PaxletError
from paxlet.manifest import load_manifest


class ShellWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plan = {"schema_version": "0.1", "name": "hello", "steps": [
            {"id": "hello", "kind": "generate", "language": "python",
             "code": "print('Witaj Taskand!')\n"},
        ]}
        self.package = self.root / "package"

    def export(self, plan=None):
        return export_package(plan or self.plan, self.package,
                              urn="urn:paxlet:taskand:test", permissions={})

    def test_real_export_verify_run_receipt(self):
        exported = self.export()
        result = run_package(self.package, expected_digest=exported["digest"])
        self.assertEqual(result["output"]["stdout"], "Witaj Taskand!\n")
        self.assertEqual(result["output"]["exit_code"], 0)
        self.assertEqual(json.loads(Path(result["receipt_path"]).read_text()), result["receipt"])
        self.assertEqual(verify_package(self.package)["digest"], exported["digest"])

    def test_export_does_not_execute_task(self):
        marker = self.root / "executed"
        self.plan["steps"][0]["code"] = f"from pathlib import Path\nPath({str(marker)!r}).touch()\n"
        self.export()
        self.assertFalse(marker.exists())

    def test_alias_reuses_snapshot_after_source_removed(self):
        source = self.root / "hello.sh"
        source.write_text("printf 'offline\\n'\n")
        catalog = Catalog()
        catalog.import_script(source, script_id="urn:nl-dsl-sh:taskand:hello", description="hello",
                              aliases=["przywitaj się"])
        path = self.root / "catalog.json"
        catalog.save(path)
        source.unlink()
        engine = make_engine(path)
        plan = engine.plan("przywitaj się")
        self.assertEqual(engine.last_route, "exact-alias")
        exported = export_package(plan.model_dump(), self.package, catalog=path,
                                  urn="urn:paxlet:taskand:offline", permissions={})
        self.assertEqual(run_package(self.package, expected_digest=exported["digest"])
                         ["output"]["stdout"], "offline\n")

    def test_unknown_prompt_offline_fails(self):
        with self.assertRaisesRegex(ValueError, "No exact alias"):
            make_engine().plan("missing task")

    def test_tampering_rejected_before_execution(self):
        exported = self.export()
        marker = self.root / "executed"
        (self.package / "action.py").write_text(f"from pathlib import Path\nPath({str(marker)!r}).touch()\n")
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            run_package(self.package, expected_digest=exported["digest"])
        self.assertFalse(marker.exists())

    def test_invalid_plan_creates_no_package(self):
        self.plan["steps"][0]["needs"] = ["missing"]
        with self.assertRaises(ValueError):
            self.export()
        self.assertFalse(self.package.exists())

    def test_export_preserves_existing_directory(self):
        self.package.mkdir()
        marker = self.package / "keep"
        marker.write_text("original")
        with self.assertRaises(FileExistsError):
            self.export()
        self.assertEqual(marker.read_text(), "original")

    def test_failed_step_is_not_success(self):
        self.plan["steps"][0]["code"] = "raise SystemExit(7)\n"
        exported = self.export()
        with self.assertRaises(PaxletError):
            run_package(self.package, expected_digest=exported["digest"])

    def test_invalid_timeout_rejected(self):
        for value in (0, -1, float("nan"), float("inf"), True):
            with self.subTest(value=value), self.assertRaises(ValueError):
                run_package(self.package, expected_digest="unused", timeout=value)

    def test_cli_compile_and_preserve_existing_output(self):
        plan_path = self.root / "plan.json"
        plan_path.write_text(json.dumps(self.plan))
        output = self.root / "task.py"
        args = ["compile", str(plan_path), "--output", str(output)]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            self.assertEqual(main(args), 0)
        self.assertIn("sha256", json.loads(stdout.getvalue()))
        self.assertEqual(subprocess.check_output([sys.executable, output], text=True), "Witaj Taskand!\n")
        before = output.read_bytes()
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(main(args), 1)
        self.assertEqual(output.read_bytes(), before)

    def test_cli_missing_dependency_free_help(self):
        result = subprocess.run([sys.executable, "-m", "app.shell_workflow", "--help"],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("export", result.stdout)

    def test_process_json_roundtrip(self):
        env = {**os.environ, "TASKAND_SHELL_WORKSPACE": str(self.root)}
        def call(operation, data):
            result = subprocess.run([sys.executable, "-m", "app.shell_workflow", "process", operation],
                                    input=json.dumps(data), text=True, capture_output=True, env=env,
                                    cwd=Path(__file__).resolve().parents[1])
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return json.loads(result.stdout)["result"]
        exported = call("export", {"plan": self.plan, "id": "hello", "urn": "urn:paxlet:taskand:hello", "permissions": {}})
        result = call("run", {"id": "hello", "expected_digest": exported["digest"]})
        self.assertEqual(result["output"]["stdout"], "Witaj Taskand!\n")
        self.assertEqual(call("verify", {"id": "hello"})["digest"], exported["digest"])

    def test_process_run_catalog_requires_approval_and_fresh_pinned_workspace(self):
        environment = {"TASKAND_SHELL_WORKSPACE": str(self.root / "workspace"),
                       "TASKAND_PAXLET_CATALOG_ROOT": str(self.root / "native"),
                       "PAXLET_STORE_DIR": str(self.root / "store")}
        with patch.dict(os.environ, environment):
            exported = self.export()
            _, manifest = load_manifest(self.package)
            urn = manifest["identity"]["urn"]
            version = manifest["identity"]["version"]
            native = NativeCatalog(self.root / "native", node_id="node-a")
            native.trust_namespace("taskand", "node-a")
            native.install(self.package, expected_digest=exported["digest"])
            request = {"id": "first", "selector": urn, "action": "run", "version": version,
                       "expected_digest": exported["digest"]}
            with self.assertRaises(CatalogError):
                process_request("run_catalog", request)
            self.assertFalse((self.root / "workspace/catalog-runs/first").exists())
            native.approve(urn, version, exported["digest"])
            result = process_request("run_catalog", request)
            self.assertEqual(result["selection"]["digest"], exported["digest"])
            self.assertEqual(result["output"]["stdout"], "Witaj Taskand!\n")
            self.assertEqual(result["receipt"]["package_digest"], exported["digest"])
            receipt = Path(result["receipt_path"])
            self.assertEqual(json.loads(receipt.read_text()), result["receipt"])
            cli = subprocess.run([sys.executable, "-m", "app.shell_workflow", "process", "run_catalog"],
                input=json.dumps({**request, "id": "cli"}), text=True, capture_output=True,
                env=os.environ.copy(), cwd=Path(__file__).resolve().parents[1])
            self.assertEqual(cli.returncode, 0, cli.stdout + cli.stderr)
            self.assertEqual(json.loads(cli.stdout)["result"]["output"]["stdout"], "Witaj Taskand!\n")
            with self.assertRaises(PaxletError):
                process_request("run_catalog", request)
            self.assertEqual(json.loads(receipt.read_text()), result["receipt"])
            with self.assertRaises(CatalogError):
                process_request("run_catalog", {**request, "id": "wrong-pin",
                    "expected_digest": "sha256:" + "0" * 64})
            self.assertFalse((self.root / "workspace/catalog-runs/wrong-pin").exists())
            native.withdraw(urn, version, exported["digest"])
            with self.assertRaises(CatalogError):
                process_request("run_catalog", {**request, "id": "withdrawn"})
            self.assertFalse((self.root / "workspace/catalog-runs/withdrawn").exists())

    def test_process_run_catalog_rejects_paths_and_missing_operator_catalog(self):
        with patch.dict(os.environ, {"TASKAND_SHELL_WORKSPACE": str(self.root / "workspace"),
                                  "TASKAND_PAXLET_CATALOG_ROOT": str(self.root / "native")}):
            base = {"selector": "urn:paxlet:taskand:test", "action": "run",
                    "expected_digest": "sha256:" + "0" * 64}
            for identifier in ("../escape", "/tmp/escape", "", None):
                with self.subTest(identifier=identifier), self.assertRaises(ValueError):
                    process_request("run_catalog", {**base, "id": identifier})
            with self.assertRaisesRegex(ValueError, "unavailable"):
                process_request("run_catalog", {**base, "id": "new"})
            with self.assertRaises(ValueError):
                process_request("run_catalog", {**base, "id": "new", "catalog_root": "/tmp"})
            with self.assertRaises(ValueError):
                process_request("run_catalog", {**base, "id": "new", "expected_digest": None})

    def test_process_forbids_host_paths_and_unknown_fields(self):
        with patch.dict(os.environ, {"TASKAND_SHELL_WORKSPACE": str(self.root)}):
            for identifier in ("../escape", "/tmp/task", "", None):
                with self.subTest(identifier=identifier), self.assertRaises(ValueError):
                    process_request("verify", {"id": identifier})
            with self.assertRaises(ValueError):
                process_request("plan", {"prompt": "hello", "env_file": "/tmp/secret"})
            (self.root / "packages").symlink_to(self.root)
            with self.assertRaisesRegex(ValueError, "symlinks"):
                process_request("verify", {"id": "hello"})

    def test_process_llm_requires_operator_configuration(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "configuration is unavailable"):
                process_request("plan", {"prompt": "hello", "use_llm": True})


if __name__ == "__main__":
    unittest.main()
