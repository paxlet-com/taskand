"""Import trusted local MCP configurations into versioned Taskand URI packages.

Discovery never calls tools. Registration creates candidates; URI approval and
gateway grants remain separate operator actions.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib

from bridge import canonical, client, digest, error_code, load_json, require, tool_catalog, validate_schema

HERE = Path(__file__).resolve().parent
WRAPPER = '''#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const python = process.env.TASKAND_MCP_PYTHON;
let result;
if (!python?.startsWith('/')) result = {ok:false,errorType:'MCP_PYTHON_REQUIRED',outcomeKnown:true};
else {
  const child = spawnSync(python, [fileURLToPath(new URL('./bridge.py', import.meta.url))], {
    input:readFileSync(0), encoding:'utf8', timeout:30000, maxBuffer:524288, env:process.env
  });
  try { result = JSON.parse(child.stdout); }
  catch { result = {ok:false,errorType:'OUTCOME_UNKNOWN',outcomeKnown:false,retried:false}; }
}
process.stdout.write(JSON.stringify(result)+'\\n');
'''


def slug(name):
    require(isinstance(name, str) and bool(name), "INVALID_NAME")
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48] or "tool"
    return base + "-" + hashlib.sha256(name.encode()).hexdigest()[:8]


def configurations(path):
    path = Path(path)
    raw = path.read_bytes()
    require(len(raw) <= 4194304, "CONFIG_TOO_LARGE")
    data = tomllib.loads(raw.decode()) if path.suffix == ".toml" else json.loads(raw)
    servers = data.get("mcp_servers", data.get("mcpServers", data.get("servers")))
    require(isinstance(servers, dict), "MCP_SERVERS_REQUIRED")
    return servers


def merged_configurations(paths, prefer_first=False):
    result, aliases = {}, {}
    for path in paths:
        for name, spec in configurations(path).items():
            if name in result:
                require(prefer_first or result[name] == spec, "CONFIGURATION_NAME_CONFLICT")
                aliases.setdefault(name, []).append(str(path))
            else:
                result[name] = spec
    return result, aliases


def normalize(name, spec):
    require(isinstance(spec, dict), "INVALID_CONFIGURATION")
    require(spec.get("enabled", True) is True, "DISABLED")
    # A Taskand-to-Taskand adapter would re-export the same catalog recursively.
    require(name != "taskand" and Path(spec.get("command", "")).name != "taskand-mcp"
            and "TASKAND_MCP_GATEWAY_URL" not in spec.get("env", {}), "SELF_REFERENCE_EXCLUDED")
    mode = spec.get("taskand_protocol_mode", "auto")
    require(mode in {"auto", "legacy"}, "INVALID_PROTOCOL_MODE")
    if spec.get("url"):
        require(not spec.get("http_headers") and not spec.get("env_http_headers")
                and not spec.get("bearer_token_env_var"), "HTTP_AUTH_UNSUPPORTED")
        return {"transport": "http", "url": spec["url"], "protocolMode": mode}
    command = shutil.which(spec.get("command", ""))
    require(command is not None, "COMMAND_NOT_FOUND")
    env = {key: os.environ[key] for key in ("PATH", "HOME", "LANG", "USER", "TMPDIR") if key in os.environ}
    configured = spec.get("env", {})
    require(isinstance(configured, dict), "INVALID_ENV")
    for key, value in configured.items():
        require(isinstance(key, str) and isinstance(value, str), "INVALID_ENV")
        env[key] = value
    for key in spec.get("env_vars", []):
        require(key in os.environ, "ENVIRONMENT_REQUIRED")
        env[key] = os.environ[key]
    return {"transport": "stdio", "command": str(Path(command).absolute()), "args": spec.get("args", []),
            "cwd": spec.get("cwd"), "env": env, "protocolMode": mode}


async def discover(servers, concurrency=3):
    semaphore = asyncio.Semaphore(concurrency)
    profiles, catalogs, results = {}, {}, {}

    async def one(name, spec):
        async with semaphore:
            try:
                profile = normalize(name, spec)
                async with asyncio.timeout(35):
                    async with client(profile) as session:
                        tools = await tool_catalog(session)
                for tool in tools:
                    validate_schema(tool["inputSchema"])
                    if "outputSchema" in tool:
                        validate_schema(tool["outputSchema"])
                profiles[name], catalogs[name] = profile, tools
                results[name] = {"status": "discovered", "tools": len(tools), "transport": profile["transport"]}
            except Exception as error:
                code = error_code(error)
                results[name] = {"status": "excluded" if code in {"SELF_REFERENCE_EXCLUDED", "DISABLED"} else "unavailable",
                                 "errorType": code, "tools": 0}
            print(canonical({"server": name, **results[name]}), flush=True)

    await asyncio.gather(*(one(name, spec) for name, spec in sorted(servers.items())))
    return profiles, catalogs, results


def package_files(server, profile, tool, version):
    require(type(version) is int and 1 <= version <= 9999, "INVALID_VERSION")
    organism, capability = "mcp-" + slug(server), slug(tool["name"])
    uri = f"proc://taskand.dev/{organism}/{capability}/v{version}"
    descriptor = {"schema": "taskand.mcp-tool/v1", "uri": uri, "server": server,
                  "profilePin": digest(profile), "tool": tool}
    description = str(tool.get("description", tool["name"]))[:1000]
    manifest = f"uri: {uri}\norganism: {organism}\nkind: task\norigin: mcp\ndesc: {json.dumps(description, ensure_ascii=True)}\nenv: [TASKAND_MCP_PYTHON, TASKAND_MCP_PROFILES]\n"
    return uri, {
        "bin.mjs": WRAPPER.encode(), "bridge.py": (HERE / "bridge.py").read_bytes(),
        "proc.yaml": manifest.encode(), "tool.json": (canonical(descriptor) + "\n").encode(),
    }


def emit(root, profiles, catalogs, version=1):
    root = Path(root).absolute()
    require(not any(p.is_symlink() for p in (root, *root.parents)), "SYMLINK_REJECTED")
    planned = []
    for server, tools in sorted(catalogs.items()):
        for tool in tools:
            uri, files = package_files(server, profiles[server], tool, version)
            organism, capability, release = uri.removeprefix("proc://taskand.dev/").split("/")
            directory = root / organism / capability / "taskand.dev" / release
            require(not any(p.is_symlink() for p in (directory, *directory.parents)), "SYMLINK_REJECTED")
            if directory.exists():
                require(set(p.name for p in directory.iterdir()) == set(files)
                        and all(not (directory / name).is_symlink() and (directory / name).read_bytes() == value
                                for name, value in files.items()), "IMMUTABLE_VERSION_CONFLICT")
            planned.append((uri, directory, files))
    # Preflight every collision before the first write; each package is atomic.
    for uri, directory, files in planned:
        if directory.exists():
            continue
        directory.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".mcp-build-", dir=directory.parent) as tmp:
            for name, value in files.items():
                (Path(tmp) / name).write_bytes(value)
            os.rename(tmp, directory)
    return [uri for uri, _, _ in planned]


def write_private(path, value):
    path = Path(path).absolute()
    require(not any(p.is_symlink() for p in (path, *path.parents)), "SYMLINK_REJECTED")
    encoded = (canonical(value) + "\n").encode()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.exists():
        require(path.read_bytes() == encoded and path.stat().st_mode & 0o077 == 0, "PROFILE_FILE_CONFLICT")
        return
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(encoded)


def register(root, uris):
    registry = Path(root) / "generated/registry/core/taskand.dev/v1/bin.mjs"
    require(registry.is_file(), "TASKAND_ROOT_REQUIRED")
    for uri in uris:
        proc = subprocess.run(["node", str(registry)], input=canonical({"action": "register", "uri": uri, "origin": "mcp", "hold": True}),
                              capture_output=True, text=True, timeout=15, cwd=root)
        require(proc.returncode == 0, "REGISTRATION_FAILED")
        response = json.loads(proc.stdout)
        require(response.get("ok") is True, "REGISTRATION_FAILED")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True, action="append", help="Trusted Codex TOML or MCP JSON; repeat for multiple clients")
    parser.add_argument("--prefer-first", action="store_true", help="For duplicate names explicitly prefer the first client configuration")
    parser.add_argument("--output", type=Path, required=True, help="mcp/ directory in an isolated Taskand deployment")
    parser.add_argument("--profiles", type=Path, required=True, help="New private host profile snapshot, outside the repository")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--only", action="append", help="Select exact server names; default inventories all")
    parser.add_argument("--version", type=int, default=1)
    parser.add_argument("--register", action="store_true", help="Register candidates in the output parent Taskand root")
    args = parser.parse_args()
    profiles_path = args.profiles.absolute()
    require(not profiles_path.is_relative_to(args.output.absolute()), "PROFILES_OUTSIDE_PACKAGES_REQUIRED")
    require(not any((parent / ".git").exists() for parent in profiles_path.parents), "PROFILES_OUTSIDE_REPOSITORY_REQUIRED")
    servers, aliases = merged_configurations(args.config, args.prefer_first)
    if args.only:
        require(set(args.only) <= set(servers), "UNKNOWN_SERVER")
        servers = {name: servers[name] for name in args.only}
    # MCP servers own stderr; keep raw provider output in private operational logs.
    profiles, catalogs, results = asyncio.run(discover(servers))
    write_private(args.profiles, profiles)
    uris = emit(args.output, profiles, catalogs, args.version)
    if args.register:
        require(args.output.name == "mcp", "MCP_ROOT_REQUIRED")
        register(args.output.parent, uris)
    report = {"schema": "taskand.mcp-import/v1", "servers": results, "uris": uris,
              "discovered": len(profiles), "total": len(servers), "registered": args.register,
              "status": "candidate", "allAvailable": all(v["status"] != "unavailable" for v in results.values()),
              "aliases": aliases}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(canonical({k: v for k, v in report.items() if k not in {"servers", "uris"}}))
    return 0 if report["allAvailable"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
