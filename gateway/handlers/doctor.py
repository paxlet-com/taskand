import json
import subprocess
from gateway.utils import GENERATED

def handle_doctor(request_handler, body: dict) -> None:
    binpath = GENERATED / "doctor" / "diagnose" / "taskand.dev" / "v1" / "bin.mjs"
    if not binpath.exists():
        request_handler._send(404, {"ok": False, "error": "Doctor diagnose process not found"})
        return

    r = subprocess.run(["node", str(binpath)], input=json.dumps(body or {}), capture_output=True, text=True)
    try:
        diag = json.loads(r.stdout)
    except Exception:
        diag = {"raw": r.stdout.strip()}
    request_handler._send(200, {"ok": r.returncode == 0, "organism": "doctor", "diagnose": diag})
