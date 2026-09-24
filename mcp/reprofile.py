"""Create candidates for existing admitted tools after an explicit profile change."""
import argparse
import asyncio
import json
from pathlib import Path
import subprocess

from bridge import client, digest, error_code, load_json, require, tool_catalog
from catalog import emit, register


def registry(root, action, **data):
    result = subprocess.run(["node", str(root / "generated/registry/core/taskand.dev/v1/bin.mjs")],
                            input=json.dumps({"action": action, **data}), cwd=root,
                            text=True, capture_output=True, timeout=20, check=True)
    value = json.loads(result.stdout)
    require(value.get("ok") is True, "REGISTRY_REJECTED")
    return value


async def replacement(profile, descriptor):
    require(digest(profile) != descriptor["profilePin"], "PROFILE_UNCHANGED")
    async with asyncio.timeout(35):
        async with client(profile) as session:
            tools = await tool_catalog(session)
    matches = [tool for tool in tools if tool["name"] == descriptor["tool"]["name"]]
    require(len(matches) == 1 and matches[0] == descriptor["tool"], "TOOL_CONTRACT_CHANGED")
    return matches[0]


async def reprofile(root, profiles_path, uri, version):
    root = Path(root).absolute()
    require(not any(p.is_symlink() for p in (root, *root.parents)), "SYMLINK_REJECTED")
    entries = registry(root, "list")["processes"]
    matches = [entry for entry in entries if entry["uri"] == uri]
    require(len(matches) == 1, "URI_NOT_FOUND")
    entry = matches[0]
    require(entry.get("origin") == "mcp" and entry.get("status") == "active", "ADMITTED_MCP_REQUIRED")
    registry(root, "resolve", uri=uri)
    relative = Path(entry["path"])
    require(not relative.is_absolute() and ".." not in relative.parts, "INVALID_PACKAGE_PATH")
    path = root / relative / "tool.json"
    require(not any(p.is_symlink() for p in (path, *path.parents)), "SYMLINK_REJECTED")
    descriptor = load_json(path)
    require(descriptor["uri"] == uri, "DESCRIPTOR_URI_MISMATCH")
    require(type(version) is int and version > int(uri.rsplit("/v", 1)[1]), "NEW_VERSION_REQUIRED")
    candidate = uri.rsplit("/v", 1)[0] + "/v" + str(version)
    require(not any(item["uri"] == candidate for item in entries), "CANDIDATE_VERSION_EXISTS")
    require(Path(profiles_path).stat().st_mode & 0o077 == 0, "PRIVATE_PROFILES_REQUIRED")
    profiles = load_json(Path(profiles_path), 4194304)
    server = descriptor["server"]
    require(server in profiles, "PROFILE_MISSING")
    tool = await replacement(profiles[server], descriptor)
    uris = emit(root / "mcp", {server: profiles[server]}, {server: [tool]}, version)
    register(root, uris)
    # Admission, old-version retirement and gateway grants are separate operator effects.
    return {"ok": True, "previousUri": uri, "candidateUri": uris[0],
            "profilePin": digest(profiles[server]), "status": "candidate", "admitted": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--profiles", type=Path, required=True)
    parser.add_argument("--uri", required=True)
    parser.add_argument("--version", type=int, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(asyncio.run(reprofile(args.root, args.profiles, args.uri, args.version))))
    except Exception as error:
        # Provider exception text may contain private profile configuration.
        print(json.dumps({"ok": False, "errorType": error_code(error)}))
        raise SystemExit(1)
