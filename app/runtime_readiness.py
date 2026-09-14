#!/usr/bin/env python3
"""Read-only loopback deployment preflight, not authenticated functional approval.

Example: python app/runtime_readiness.py --expected-sha <40-character SHA> --stream
Only fixed public routes are read. No credentials, proxies, redirects, Git writes,
service changes or raw response bodies enter the report. Each invocation creates
at most four disposable probe processes sharing one deadline.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import http.client
import json
import math
import multiprocessing
from multiprocessing.connection import wait
from pathlib import Path
import re
import socket
import subprocess
import time
import uuid

SHA = re.compile(r"[0-9a-f]{40}")
BODY_LIMIT = 2 * 1024 * 1024
HEALTH_LIMIT = 16384
ROUTES = {"health": "/healthz", "panel": "/", "context": "/api/context", "mesh": "/api/mesh/state"}


def source_identity(root, revision):
    if not SHA.fullmatch(revision):
        raise ValueError("READINESS_IMMUTABLE_SHA_REQUIRED")

    def git(*args):
        return subprocess.run(["git", "-C", str(root), *args], capture_output=True,
                              check=True, timeout=5).stdout

    git("cat-file", "-e", revision + "^{commit}")
    entry = git("ls-tree", "-z", revision, "--", "index.html").decode("ascii").rstrip("\0")
    if not re.fullmatch(r"100(?:644|755) blob [0-9a-f]{40}\tindex.html", entry):
        raise ValueError("READINESS_PANEL_BLOB_REQUIRED")
    size = int(git("cat-file", "-s", revision + ":index.html"))
    if not 0 < size <= BODY_LIMIT:
        raise ValueError("READINESS_PANEL_SIZE_INVALID")
    body = git("show", revision + ":index.html")
    return {"sha": revision, "panelSha256": hashlib.sha256(body).hexdigest()}


def _probe(sender, name, port, deadline):
    start = time.monotonic()
    connection = None
    result = {"probe": name, "httpStatus": None, "code": "PROBE_FAILED"}
    try:
        remaining = deadline - start
        if remaining <= 0:
            raise TimeoutError()
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=remaining)
        connection.request("GET", ROUTES[name], headers={"Accept-Encoding": "identity", "Connection": "close"})
        response = connection.getresponse()
        result["httpStatus"] = response.status
        result["code"] = "HTTP_OBSERVED"
        if response.status == 200 and name in {"panel", "health"}:
            limit = BODY_LIMIT if name == "panel" else HEALTH_LIMIT
            body = response.read(limit + 1)
            if len(body) > limit:
                result["code"] = "RESPONSE_TOO_LARGE"
            elif name == "panel":
                result.update(panelSha256=hashlib.sha256(body).hexdigest(), bytesRead=len(body))
            else:
                value = json.loads(body)
                if not isinstance(value, dict) or type(value.get("ok")) is not bool:
                    result["code"] = "INVALID_HEALTH"
                else:
                    reported_sha = value.get("commit") or value.get("sha")
                    result.update(healthy=value["ok"], sourceSha=(
                        reported_sha if isinstance(reported_sha, str) and SHA.fullmatch(reported_sha) else None))
    except (TimeoutError, socket.timeout):
        result["code"] = "PROBE_TIMEOUT"
    except ConnectionRefusedError:
        result["code"] = "CONNECTION_REFUSED"
    except (ValueError, UnicodeError):
        result["code"] = "INVALID_HEALTH"
    except (OSError, http.client.HTTPException):
        result["code"] = "TRANSPORT_ERROR"
    finally:
        if connection is not None:
            connection.close()
        result["durationMs"] = round((time.monotonic() - start) * 1000)
        try:
            sender.send(result)
        finally:
            sender.close()


def probe_all(gateway_port, ui_port, timeout=3.0, emit=None):
    """Hard parent deadline also covers trickled headers/bodies and worker failure."""
    if not math.isfinite(timeout) or not 0.2 <= timeout <= 15:
        raise ValueError("READINESS_TIMEOUT_RANGE_0_2_TO_15")
    if any(type(port) is not int or not 1 <= port <= 65535 for port in (gateway_port, ui_port)):
        raise ValueError("READINESS_PORT_INVALID")
    context = multiprocessing.get_context("spawn")
    deadline = time.monotonic() + timeout
    active, processes, results = {}, [], {}

    def record(result):
        result["endpoint"] = {"host": "127.0.0.1", "path": ROUTES[result["probe"]],
                              "port": ui_port if result["probe"] == "panel" else gateway_port}
        results[result["probe"]] = result
        if emit:
            emit({"schema": "taskand.runtime-readiness-event/v1", "grantsAuthority": False, **result})

    try:
        for name in ROUTES:
            receiver, sender = context.Pipe(duplex=False)
            process = context.Process(target=_probe, args=(
                sender, name, ui_port if name == "panel" else gateway_port, deadline))
            try:
                process.start()
            except BaseException:
                receiver.close()
                sender.close()
                raise
            sender.close()
            active[receiver] = name
            processes.append(process)
        while active and time.monotonic() < deadline:
            for receiver in wait(active, timeout=max(0, deadline - time.monotonic())):
                name = active.pop(receiver)
                try:
                    result = receiver.recv()
                except EOFError:
                    result = {"probe": name, "httpStatus": None, "code": "PROBE_WORKER_FAILED"}
                finally:
                    receiver.close()
                record(result)
        for name in active.values():
            record({"probe": name, "httpStatus": None, "code": "PROBE_TIMEOUT"})
    finally:
        for receiver in active:
            receiver.close()
        for process in processes:
            if process.is_alive():
                process.terminate()
        for process in processes:
            process.join(timeout=0.2)
            if process.is_alive():
                process.kill()
                process.join(timeout=0.2)
            process.close()
    return results


def assess(source, probes):
    findings = []

    def finding(code, probe):
        findings.append({"code": code, "probe": probe})

    for name in ROUTES:
        result = probes[name]
        status = result.get("httpStatus")
        if result["code"] != "HTTP_OBSERVED":
            finding(result["code"], name)
        elif status is not None and 300 <= status < 400:
            finding("REDIRECT_NOT_FOLLOWED", name)
        elif status == 404:
            finding("ENDPOINT_NOT_FOUND", name)
        elif name in {"context", "mesh"}:
            if status == 200:
                finding("UNAUTHENTICATED_API_RESPONSE", name)
            elif status not in {401, 403}:
                finding("UNEXPECTED_HTTP_STATUS", name)
        elif status != 200:
            finding("UNEXPECTED_HTTP_STATUS", name)
        elif name == "panel" and result.get("panelSha256") != source["panelSha256"]:
            finding("PANEL_SOURCE_MISMATCH", name)
        elif name == "health":
            if not result.get("healthy"):
                finding("GATEWAY_UNHEALTHY", name)
            if not result.get("sourceSha"):
                finding("GATEWAY_SOURCE_UNREPORTED", name)
            elif result["sourceSha"] != source["sha"]:
                finding("GATEWAY_SOURCE_MISMATCH", name)
    return {"schema": "taskand.runtime-readiness/v1", "scope": "unauthenticated-loopback-preflight",
            "grantsAuthority": False, "runtimeVerified": False,
            "source": source, "preflightPassed": not findings, "findings": findings,
            "probes": [probes[name] for name in ROUTES],
            "nextAction": "RECONCILE_RUNTIME" if findings else "AUTHENTICATED_FUNCTIONAL_CANARY_REQUIRED"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--expected-sha", required=True, help="Exact accepted commit; never a moving branch name")
    parser.add_argument("--gateway-port", type=int, default=8077)
    parser.add_argument("--ui-port", type=int, default=8090)
    parser.add_argument("--timeout", type=float, default=3.0, help="Shared probe deadline in seconds (0.2..15)")
    parser.add_argument("--stream", action="store_true", help="Emit completed probes as JSONL before the final report")
    args = parser.parse_args(argv)
    start = time.monotonic()
    observation = {"observationId": uuid.uuid4().hex,
                   "observedAt": datetime.now(timezone.utc).isoformat(),
                   "probeDeadlineSeconds": args.timeout if math.isfinite(args.timeout) else None}
    try:
        source = source_identity(args.repo, args.expected_sha)
        emit = (lambda event: print(json.dumps({**event, **observation, "sourceSha": source["sha"]}),
                                    flush=True)) if args.stream else None
        probes = probe_all(args.gateway_port, args.ui_port, args.timeout, emit)
        report = assess(source, probes)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        # Never expose a Git stderr, local path or untrusted response body.
        code = str(error) if isinstance(error, ValueError) and str(error).startswith("READINESS_") else (
            "READINESS_SOURCE_OR_RUNTIME_UNAVAILABLE")
        report = {"schema": "taskand.runtime-readiness/v1", "grantsAuthority": False,
                  "runtimeVerified": False, "preflightPassed": False, "findings": [{"code": code}]}
    report.update(observation)
    report["durationMs"] = round((time.monotonic() - start) * 1000)
    print(json.dumps(report, indent=None if args.stream else 2), flush=True)
    return 0 if report["preflightPassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
