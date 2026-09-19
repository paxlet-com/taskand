"""One bounded MCP call. Copied into each immutable native process package."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator
from mcp import Client, StdioServerParameters

LIMIT = 262144


class ContractError(Exception):
    pass


def require(condition, code):
    if not condition:
        raise ContractError(code)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def load_json(path, limit=1048576):
    path = Path(path)
    require(not any(p.is_symlink() for p in (path, *path.parents)), "SYMLINK_REJECTED")
    with path.open("rb") as stream:
        raw = stream.read(limit + 1)
    require(len(raw) <= limit, "FILE_TOO_LARGE")
    return json.loads(raw)


def validate_schema(schema):
    def walk(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in {"$ref", "$dynamicRef"}:
                    require(isinstance(child, str) and child.startswith("#"), "EXTERNAL_SCHEMA_REFERENCE")
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(schema)
    Draft202012Validator.check_schema(schema)


def client(profile):
    require(isinstance(profile, dict), "INVALID_PROFILE")
    mode = profile.get("protocolMode", "auto")
    require(mode in {"auto", "legacy"}, "INVALID_PROTOCOL_MODE")
    if profile.get("transport") == "stdio":
        command = profile.get("command")
        require(isinstance(command, str) and Path(command).is_absolute(), "ABSOLUTE_COMMAND_REQUIRED")
        require(isinstance(profile.get("args", []), list) and all(isinstance(v, str) for v in profile.get("args", [])), "INVALID_ARGV")
        env = profile.get("env", {})
        require(isinstance(env, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in env.items()), "INVALID_ENV")
        target = StdioServerParameters(command=command, args=profile.get("args", []), env=env, cwd=profile.get("cwd"))
    else:
        require(profile.get("transport") == "http", "UNSUPPORTED_TRANSPORT")
        target = profile.get("url", "")
        parsed = urlsplit(target)
        require(parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", "::1"}), "INVALID_ENDPOINT")
        require(not parsed.username and not parsed.password and not parsed.fragment, "INVALID_ENDPOINT")
        # This catalog does not silently discard HTTP credentials.
        require(not profile.get("headers"), "HTTP_AUTH_UNSUPPORTED")
    return Client(target, read_timeout_seconds=20, mode=mode)


async def tool_catalog(session):
    tools, cursor, seen = [], None, set()
    while True:
        page = await session.list_tools(cursor=cursor)
        tools.extend(t.model_dump(by_alias=True, exclude_none=True) for t in page.tools)
        require(len(tools) <= 500 and len(canonical(tools).encode()) <= 1048576, "CATALOG_TOO_LARGE")
        cursor = page.next_cursor
        if not cursor:
            break
        require(cursor not in seen, "INVALID_PAGINATION")
        seen.add(cursor)
    names = [t["name"] for t in tools]
    require(len(names) == len(set(names)), "DUPLICATE_TOOL_NAME")
    return sorted(tools, key=lambda t: t["name"])


async def invoke(descriptor, profiles, arguments):
    dispatched = False
    try:
        require(isinstance(arguments, dict), "ARGUMENTS_OBJECT_REQUIRED")
        require(len(canonical(arguments).encode()) <= LIMIT, "INPUT_TOO_LARGE")
        profile = profiles.get(descriptor["server"])
        require(profile is not None and digest(profile) == descriptor["profilePin"], "PROFILE_CHANGED")
        expected = descriptor["tool"]
        validate_schema(expected["inputSchema"])
        require(not list(Draft202012Validator(expected["inputSchema"]).iter_errors(arguments)), "ARGUMENT_SCHEMA_INVALID")
        if "outputSchema" in expected:
            validate_schema(expected["outputSchema"])
        async with asyncio.timeout(25):
            async with client(profile) as session:
                tools = await tool_catalog(session)
                actual = next((t for t in tools if t["name"] == expected["name"]), None)
                require(actual is not None and digest(actual) == digest(expected), "TOOL_SCHEMA_CHANGED")
                dispatched = True
                response = await session.call_tool(expected["name"], arguments)
                result = response.model_dump(by_alias=True, exclude_none=True)
                require(len(canonical(result).encode()) <= LIMIT, "RESULT_TOO_LARGE")
                if "outputSchema" in expected and not response.is_error:
                    require(response.structured_content is not None and not list(Draft202012Validator(expected["outputSchema"]).iter_errors(response.structured_content)), "OUTPUT_SCHEMA_INVALID")
                value = {"ok": not response.is_error, "result": result, "outcomeKnown": True, "taskSuccessVerified": False}
                if response.is_error:
                    value["errorType"] = "MCP_TOOL_ERROR"
                return value
    except Exception as error:
        return {"ok": False, "errorType": "OUTCOME_UNKNOWN" if dispatched else error_code(error),
                "outcomeKnown": not dispatched, "retried": False}


def error_code(error):
    if isinstance(error, ContractError):
        return str(error)
    for child in getattr(error, "exceptions", ()):
        code = error_code(child)
        if code != "MCP_TRANSPORT_ERROR":
            return code
    return "MCP_TRANSPORT_ERROR"


def main():
    try:
        descriptor = load_json(Path(__file__).with_name("tool.json"))
        path = Path(os.environ["TASKAND_MCP_PROFILES"])
        require(path.is_absolute() and path.stat().st_mode & 0o077 == 0, "PRIVATE_PROFILES_REQUIRED")
        profiles = load_json(path, 4194304)
        raw = sys.stdin.buffer.read(LIMIT + 1)
        require(len(raw) <= LIMIT, "INPUT_TOO_LARGE")
        value = asyncio.run(invoke(descriptor, profiles, json.loads(raw)))
    except Exception as error:
        value = {"ok": False, "errorType": error_code(error), "outcomeKnown": True, "retried": False}
    print(canonical(value))


if __name__ == "__main__":
    main()
