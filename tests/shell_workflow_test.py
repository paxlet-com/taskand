"""Real installed Paxlet + nl-dsl-sh round trips, without an LLM provider."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.shell_workflow import (
    compile_plan, export_package, main, make_engine, run_package, verify_package,
)
from nl_dsl_sh import Catalog
from paxlet.errors import PaxletError


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


if __name__ == "__main__":
    unittest.main()
