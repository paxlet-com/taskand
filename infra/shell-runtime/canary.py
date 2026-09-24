#!/usr/bin/env python3
"""Run a staged gateway on an ephemeral loopback port and verify shell delivery."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

BUILD = "proc://taskand.dev/mcp/shell-build/v1"
RUN = "proc://taskand.dev/mcp/shell-run/v1"


def canary(release, python):
    release, python = Path(release).absolute(), Path(python).absolute()
    inventory = json.loads((release / "source-inventory.json").read_text())
    for name, expected in inventory["files"].items():
        path = release / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError("Source inventory mismatch: " + name)
    if (release / ".env").exists() or (release / "log").exists():
        raise ValueError("Canary requires a fresh release without runtime configuration/state")
    versions = json.loads(subprocess.check_output([str(python), "-c",
        "import json; from importlib.metadata import version; "
        "print(json.dumps({n:version(n) for n in ('paxlet','nl-dsl-sh')}))"], text=True))
    if versions != {"paxlet": "0.1.4", "nl-dsl-sh": "0.2.0"}:
        raise ValueError("Unsupported shell dependencies")
    manifest = release / "release-manifest.json"
    pin = hashlib.sha256(manifest.read_bytes()).hexdigest()
    auth_value = secrets.token_urlsafe(32)
    with tempfile.TemporaryDirectory(prefix="taskand-shell-canary-") as temporary:
        tmp = Path(temporary)
        # Only explicit environment is inherited; canary never uses production credentials.
        env = {k: os.environ[k] for k in ("PATH", "LANG") if k in os.environ}
        env.update(TASKAND_BIND="127.0.0.1", TASKAND_AUTH_TOKEN=auth_value,
                   TASKAND_SHELL_PYTHON=str(python), TASKAND_SHELL_WORKSPACE=str(tmp / "shell"),
                   TASKAND_RELEASE_MANIFEST=str(manifest), TASKAND_RELEASE_SHA256=pin,
                   PYTHONPATH=str(release), PYTHONDONTWRITEBYTECODE="1")
        # Child binds port zero and reports the actual port; no reserve/rebind race.
        entry = """import pathlib,sys
from http.server import ThreadingHTTPServer
from gateway import GatewayHTTPHandler
server=ThreadingHTTPServer(('127.0.0.1',0),GatewayHTTPHandler)
pathlib.Path(sys.argv[1]).write_text(str(server.server_port))
server.serve_forever()
"""
        port_file = tmp / "port"
        with (tmp / "gateway.log").open("w") as log:
            process = subprocess.Popen([str(python), "-c", entry, str(port_file)],
                                       cwd=release, env=env, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 15
                while not port_file.exists():
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError("Canary failed to start")
                    time.sleep(.05)
                base = "http://127.0.0.1:" + port_file.read_text()
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

                def request(path, data=None, authenticated=True):
                    headers = {"Content-Type": "application/json"}
                    if authenticated:
                        headers["Authorization"] = "Bearer " + auth_value
                    req = urllib.request.Request(base + path, headers=headers,
                        data=json.dumps(data).encode() if data is not None else None)
                    with opener.open(req, timeout=40) as response:
                        return json.load(response)

                health = request("/healthz")
                if not health.get("ok") or health.get("commit") != inventory["sourceSha"] or health.get("identityStatus") != "LOCAL_CODE_MATCH":
                    raise RuntimeError("Canary identity mismatch")

                def call(uri, data):
                    value = request("/api/proc/call", {"uri": uri, "data": data})
                    result = value.get("result", {})
                    if value.get("ok") is not True or result.get("ok") is not True:
                        raise RuntimeError("Shell canary operation failed: " + str(data.get("operation", "run")))
                    return result["result"]

                try:
                    request("/api/proc/call", {"uri": RUN, "data": {}}, authenticated=False)
                except urllib.error.HTTPError as error:
                    if error.code != 401:
                        raise
                else:
                    raise RuntimeError("Anonymous execution accepted")
                plan = {"schema_version": "0.1", "name": "runtime canary", "steps": [
                    {"id": "hello", "kind": "generate", "language": "python",
                     "code": "print('Taskand shell canary')\n"}]}
                exported = call(BUILD, {"operation": "export", "plan": plan, "id": "canary",
                    "urn": "urn:paxlet:taskand:runtime-canary", "permissions": {}})
                verified = call(BUILD, {"operation": "verify", "id": "canary"})
                if verified["digest"] != exported["digest"]:
                    raise RuntimeError("Canary digest mismatch")
                ran = call(RUN, {"id": "canary", "expected_digest": verified["digest"], "timeout": 10})
                if ran["output"]["stdout"] != "Taskand shell canary\n" or not ran["receipt"]:
                    raise RuntimeError("Canary output/receipt mismatch")
                return {"ok": True, "sourceSha": inventory["sourceSha"], "health": health,
                        "dependencies": versions, "digest": verified["digest"],
                        "executionReceipt": ran["receipt"], "anonymousDenied": True,
                        "gatewayStoppedAfterTest": True}
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("release", type=Path)
    parser.add_argument("--python", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(canary(args.release, args.python), indent=2))
