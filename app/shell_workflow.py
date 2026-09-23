"""Local Taskand NL → script → Paxlet workflow. No task executes implicitly."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys


def make_engine(catalog=None, env_file=None):
    from nl_dsl_sh import Catalog, Engine, LiteLLMClient, LLMConfig

    return Engine(
        Catalog.load(catalog) if catalog else Catalog(),
        LiteLLMClient(LLMConfig.from_env(env_file)) if env_file else None,
    )


def compile_plan(plan, *, catalog=None, format="python"):
    from nl_dsl_sh import Plan

    return make_engine(catalog).compile(Plan.model_validate(plan), format=format)


def verify_package(directory):
    from paxlet.manifest import load_manifest, package_digest, validate_manifest

    manifest_path, manifest = load_manifest(directory)
    result = validate_manifest(manifest_path.parent, manifest)
    if not result.ok:
        raise ValueError("Invalid Paxlet: " + "; ".join(result.errors))
    return {
        "urn": manifest["identity"]["urn"],
        "digest": package_digest(manifest_path.parent, manifest),
        "warnings": result.warnings,
    }


def export_package(plan, directory, *, urn, permissions, catalog=None):
    from nl_dsl_sh.interop import export_paxlet

    artifact = compile_plan(plan, catalog=catalog)
    path = export_paxlet(artifact, directory, urn=urn, permissions=permissions)
    return {"directory": str(path), **verify_package(path), "report": artifact.report}


def run_package(directory, *, expected_digest, stdin="", timeout=30):
    from paxlet.runtime import run_action

    if not isinstance(stdin, str):
        raise ValueError("stdin must be a string")
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("timeout must be positive and finite")
    verified = verify_package(directory)
    if not expected_digest or expected_digest != verified["digest"]:
        raise ValueError("Paxlet digest mismatch; review the current package before running")
    output, receipt, receipt_path = run_action(
        directory, "run", {"stdin": stdin}, timeout=timeout,
    )
    return {"output": output, "receipt": receipt, "receipt_path": str(receipt_path)}


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    plan = commands.add_parser("plan", help="Plan NL; offline unless --env-file is given")
    plan.add_argument("prompt")
    plan.add_argument("--catalog")
    plan.add_argument("--env-file", help="Explicit opt-in to the configured LLM provider")
    plan.add_argument("--language", default="bash")
    plan.add_argument("--reuse-only", action="store_true")
    compile_command = commands.add_parser("compile", help="Compile JSON without executing")
    compile_command.add_argument("plan")
    compile_command.add_argument("--catalog")
    compile_command.add_argument("--format", choices=("bash", "python"), default="python")
    compile_command.add_argument("--output", required=True)
    export = commands.add_parser("export", help="Compile and validate a new Paxlet directory")
    export.add_argument("plan")
    export.add_argument("directory")
    export.add_argument("--catalog")
    export.add_argument("--urn", required=True)
    export.add_argument("--permissions", required=True, help="Explicit permissions JSON file")
    verify = commands.add_parser("verify")
    verify.add_argument("directory")
    run = commands.add_parser("run", help="Explicitly execute a reviewed Paxlet locally")
    run.add_argument("directory")
    run.add_argument("--expected-digest", required=True)
    run.add_argument("--stdin", default="")
    run.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args(argv)
    try:
        if args.command == "plan":
            engine = make_engine(args.catalog, args.env_file)
            result = engine.plan(args.prompt, language=args.language, reuse_only=args.reuse_only).model_dump()
        elif args.command == "compile":
            artifact = compile_plan(read_json(args.plan), catalog=args.catalog, format=args.format)
            # Preserve any existing user artifact.
            with Path(args.output).open("x", encoding="utf-8") as stream:
                stream.write(artifact.script)
            Path(args.output).chmod(0o700)
            result = {"output": args.output, "sha256": artifact.sha256, "report": artifact.report}
        elif args.command == "export":
            result = export_package(read_json(args.plan), args.directory, urn=args.urn,
                                    permissions=read_json(args.permissions), catalog=args.catalog)
        elif args.command == "verify":
            result = verify_package(args.directory)
        else:
            result = run_package(args.directory, expected_digest=args.expected_digest,
                                 stdin=args.stdin, timeout=args.timeout)
    except (ValueError, OSError, ImportError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    except Exception as exc:
        # Upstream Paxlet errors do not inherit ValueError/RuntimeError.
        from paxlet.errors import PaxletError
        if not isinstance(exc, PaxletError):
            raise
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
