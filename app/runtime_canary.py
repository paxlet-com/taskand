#!/usr/bin/env python3
"""Read-only authenticated local canary for protected Taskand projections.

The credential is supplied through a runtime environment variable and is never
returned in the report. Only bounded JSON shape/count observations are emitted;
the canary never writes context, registry, peers, grants or observer state.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import http.client
import ipaddress
import json
import math
import os
import re
import socket
import time


SCHEMA = "taskand.authenticated-canary/v1"
BODY_LIMIT = 512 * 1024
TOKEN_LIMIT = 4096
TOKEN_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PROBES = (
    ("federation", "GET", "/api/federation", False),
    ("catalog", "GET", "/.well-known/catalog.json", False),
    ("context", "GET", "/api/context?kind=user_twin", True),
    ("mesh", "GET", "/api/mesh/state", True),
    ("registry", "POST", "/api/registry", True),
)


def _loopback(host: str) -> bool:
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host in {"localhost", "ip6-localhost"}


def _token(name: str) -> str:
    if not TOKEN_NAME.fullmatch(name):
        raise ValueError("CANARY_TOKEN_ENV_INVALID")
    value = os.environ.get(name, "")
    if not value or len(value) > TOKEN_LIMIT or any(ord(c) < 33 for c in value):
        return ""
    return value


def _request(host: str, port: int, name: str, method: str, path: str,
             requires_auth: bool, token: str, deadline: float) -> dict:
    result = {"probe": name, "httpStatus": None, "code": "PROBE_FAILED"}
    connection = None
    try:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError
        connection = http.client.HTTPConnection(host, port, timeout=remaining)
        headers = {"Accept": "application/json", "Accept-Encoding": "identity",
                   "Connection": "close"}
        if requires_auth:
            headers["Authorization"] = "Bearer " + token
        body = b'{"action":"list","status":"active"}' if method == "POST" else None
        if body is not None:
            headers["Content-Type"] = "application/json"
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        result["httpStatus"] = response.status
        raw = response.read(BODY_LIMIT + 1)
        if len(raw) > BODY_LIMIT:
            result["code"] = "RESPONSE_TOO_LARGE"
            return result
        try:
            value = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError):
            result["code"] = "INVALID_JSON"
            return result
        if not isinstance(value, dict):
            result["code"] = "INVALID_JSON_OBJECT"
            return result
        result["code"] = "HTTP_OBSERVED"
        if response.status == 200:
            if name in {"federation", "catalog"}:
                if value.get("ok") is not True or not isinstance(value.get("processes"), list):
                    result["code"] = "INVALID_CATALOG"
                else:
                    result["count"] = len(value["processes"])
            elif name == "context":
                if value.get("ok") is not True or not isinstance(value.get("objects"), list):
                    result["code"] = "INVALID_CONTEXT"
                else:
                    result["count"] = len(value["objects"])
            elif name == "mesh":
                if (value.get("ok") is not True or
                        value.get("schema") != "taskand.mesh-observation/v1" or
                        not isinstance(value.get("counts"), dict)):
                    result["code"] = "INVALID_MESH"
                else:
                    result["counts"] = {k: value["counts"].get(k)
                                         for k in ("processes", "organisms", "configuredPeers", "onlinePeers")}
            elif name == "registry":
                nested = value.get("result")
                if value.get("ok") is not True or not isinstance(nested, dict):
                    result["code"] = "INVALID_REGISTRY"
                else:
                    result["count"] = nested.get("total")
    except (TimeoutError, socket.timeout):
        result["code"] = "PROBE_TIMEOUT"
    except ConnectionRefusedError:
        result["code"] = "CONNECTION_REFUSED"
    except (OSError, http.client.HTTPException):
        result["code"] = "TRANSPORT_ERROR"
    finally:
        if connection is not None:
            connection.close()
    return result


def canary(port: int, timeout: float, token_env: str, host: str = "127.0.0.1") -> dict:
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError("CANARY_PORT_INVALID")
    if not _loopback(host):
        raise ValueError("CANARY_LOOPBACK_ONLY")
    if not math.isfinite(timeout) or not 0.2 <= timeout <= 30:
        raise ValueError("CANARY_TIMEOUT_RANGE_0_2_TO_30")
    token = _token(token_env)
    observed_at = datetime.now(timezone.utc).isoformat()
    base = {"schema": SCHEMA, "grantsAuthority": False, "writes": False,
            "observersActivated": False, "host": host, "port": port,
            "observedAt": observed_at, "credentialStatus": "PRESENT" if token else "MISSING"}
    if not token:
        return {**base, "passed": False, "findings": ["CANARY_CREDENTIAL_MISSING"], "probes": [],
                "nextAction": "SUPPLY_RUNTIME_TOKEN"}
    deadline = time.monotonic() + timeout
    probes = [_request(host, port, *probe, token, deadline) for probe in PROBES]
    findings = []
    for result in probes:
        if result["code"] != "HTTP_OBSERVED":
            findings.append(result["code"] + ":" + result["probe"])
        elif result["httpStatus"] != 200:
            findings.append("UNEXPECTED_HTTP_STATUS:" + result["probe"])
    return {**base, "passed": not findings, "findings": findings, "probes": probes,
            "nextAction": "CONTINUE_WITH_HUMAN_DECISION" if not findings else "RECONCILE_RUNTIME"}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8077)
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument("--token-env", default="TASKAND_CANARY_TOKEN")
    args = parser.parse_args(argv)
    try:
        report = canary(args.port, args.timeout, args.token_env)
    except ValueError as error:
        code = str(error) if str(error).startswith("CANARY_") else "CANARY_INPUT_INVALID"
        report = {"schema": SCHEMA, "grantsAuthority": False, "writes": False,
                  "observersActivated": False, "passed": False, "findings": [code], "probes": []}
    print(json.dumps(report, sort_keys=True))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
