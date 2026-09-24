#!/usr/bin/env python3
"""Add merged shell files to an existing runtime without replacing its catalog."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

RUNTIME = ("gateway.py", "gateway", "app", "generated", "bin", "mcp", "index.html",
           "grants.yaml", "genome.yaml", "web-root", "vms")
SHELL = ("app/shell_workflow.py", "bin/taskand", "packages/taskand-shell",
         "generated/mcp/shell-build", "generated/mcp/shell-run")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def regular_files(root):
    if root.is_symlink():
        raise ValueError("Runtime symlink")
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError("Runtime symlinks require explicit separate handling")
        if path.is_file() and "__pycache__" not in path.parts:
            yield path


def compose(base, shell, destination, base_pin):
    base, shell, destination = map(lambda p: Path(p).absolute(), (base, shell, destination))
    for root in (base, shell, destination):
        if any(p.is_symlink() for p in (root, *root.parents)):
            raise ValueError("Symlink in runtime path")
    if destination.exists() or any(root == destination or root in destination.parents for root in (base, shell)):
        raise ValueError("Composition requires a new external directory")
    old_manifest = base / "release-manifest.json"
    if digest(old_manifest) != base_pin:
        raise ValueError("Base manifest pin mismatch")
    original = json.loads(old_manifest.read_text())
    code = {k: v for k, v in original["files"].items()
            if k in {"gateway.py", "index.html"} or (k.startswith("gateway/") and k.endswith(".py"))}
    for name, expected in code.items():
        if Path(name).is_absolute() or ".." in Path(name).parts:
            raise ValueError("Unsafe manifest path")
        if digest(base / name) != expected:
            raise ValueError("Base code mismatch: " + name)
    source = json.loads((shell / "source-inventory.json").read_text())
    additions = []
    for name in SHELL:
        path = shell / name
        additions.extend(regular_files(path) if path.is_dir() else [path])
    for path in additions:
        name = str(path.relative_to(shell))
        if path.is_symlink() or digest(path) != source["files"].get(name):
            raise ValueError("Shell source mismatch: " + name)
    base_files = []
    for name in RUNTIME:
        path = base / name
        if not path.exists():
            continue
        base_files.extend(regular_files(path) if path.is_dir() else [path])
    if any(p.is_symlink() for p in base_files):
        raise ValueError("Runtime symlink")
    destination.mkdir(parents=True, exist_ok=False)
    for root, files in ((base, base_files), (shell, additions)):
        for path in files:
            target = destination / path.relative_to(root)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
    registry_path = destination / "generated/mcp/registry.json"
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {"organism": "mcp", "processes": {}}
    shell_registry = shell / "generated/mcp/registry.json"
    if digest(shell_registry) != source["files"].get("generated/mcp/registry.json"):
        raise ValueError("Shell registry source mismatch")
    entries = json.loads(shell_registry.read_text())["processes"]
    for name in ("shell-build", "shell-run"):
        uri = "proc://taskand.dev/mcp/" + name + "/v1"
        if uri in registry["processes"]:
            raise ValueError("Shell URI already exists in base")
        registry["processes"][uri] = entries[uri]
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, indent=2) + "\n")
    files = {str(p.relative_to(destination)): digest(p) for p in regular_files(destination)}
    manifest = {"sourceSha": original["sourceSha"], "files": code,
                "shellSourceSha": source["sourceSha"], "baseManifestSha256": base_pin}
    (destination / "release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    receipt = {"sourceSha": original["sourceSha"], "shellSourceSha": source["sourceSha"],
               "baseRelease": str(base), "baseManifestSha256": base_pin, "files": files,
               "artifactSha256": digest(destination / "release-manifest.json")}
    (destination / "source-inventory.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return {k: v for k, v in receipt.items() if k != "files"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", type=Path)
    parser.add_argument("shell", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--base-manifest-sha256", required=True)
    args = parser.parse_args()
    print(json.dumps(compose(args.base, args.shell, args.destination, args.base_manifest_sha256), indent=2))
