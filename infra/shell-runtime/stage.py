#!/usr/bin/env python3
"""Stage an exact Git revision into a new directory; never switch a service."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile


def stage(repository, revision, destination):
    repository, destination = Path(repository).absolute(), Path(destination).absolute()
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("An exact 40-character commit is required")
    if destination.exists() or any(p.is_symlink() for p in (destination, *destination.parents)):
        raise ValueError("Destination must be new and have no symlink components")
    if destination == repository or repository in destination.parents:
        raise ValueError("Release must be outside the source checkout")
    subprocess.run(["git", "-C", str(repository), "cat-file", "-e", revision + "^{commit}"], check=True)
    raw = subprocess.check_output(["git", "-C", str(repository), "archive", "--format=tar", revision])
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        members = archive.getmembers()
        for member in members:
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or not (member.isfile() or member.isdir()):
                raise ValueError("Unsafe archive member")
            if path.parts[0] in {".env", "log", ".git"}:
                raise ValueError("Release contains runtime state or credentials")
        files = {m.name: hashlib.sha256(archive.extractfile(m).read()).hexdigest()
                 for m in members if m.isfile()}
        for required in ("gateway.py", "index.html", "app/shell_workflow.py"):
            if required not in files:
                raise ValueError("Missing runtime file: " + required)
        destination.mkdir(parents=True, exist_ok=False)
        archive.extractall(destination, members=members, filter="data")
    # Health identity covers gateway/UI. Source inventory covers all archived files.
    manifest = {"sourceSha": revision, "files": {k: v for k, v in files.items()
                if k in {"gateway.py", "index.html"} or (k.startswith("gateway/") and k.endswith(".py"))}}
    data = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    (destination / "release-manifest.json").write_bytes(data)
    receipt = {"sourceSha": revision, "release": str(destination),
               "artifactSha256": hashlib.sha256(data).hexdigest(),
               "archiveSha256": hashlib.sha256(raw).hexdigest(), "files": files}
    (destination / "source-inventory.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return {k: v for k, v in receipt.items() if k != "files"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository", type=Path)
    parser.add_argument("revision")
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(json.dumps(stage(args.repository, args.revision, args.destination), indent=2))
