import json
import subprocess
from gateway.utils import GENERATED
from gateway.auth import check_auth, check_grant
from gateway.middleware.logging import log_event

def handle_orchestrator(request_handler, body: dict) -> None:
    # 1. Auth check
    is_auth, user = check_auth(request_handler.headers)
    if not is_auth:
        request_handler._send(401, {
            "ok": False,
            "error": "Unauthorized: Wymagana autentykacja do orkiestratora",
            "statusCode": 401
        })
        return

    # 2. Grant check
    if not check_grant(user, "proc://taskand.dev/orchestrator/execute/v1", action="call"):
        request_handler._send(403, {
            "ok": False,
            "error": f"Forbidden: Użytkownik '{user.get('name')}' nie ma uprawnień do uruchomienia orkiestratora",
            "statusCode": 403
        })
        return

    binpath = GENERATED / "orchestrator" / "execute" / "taskand.dev" / "v1" / "bin.mjs"
    if not binpath.exists():
        request_handler._send(404, {"ok": False, "error": "Orchestrator process not found"})
        return

    r = subprocess.run(
        ["node", str(binpath)],
        input=json.dumps(body or {}),
        capture_output=True,
        text=True,
        timeout=120
    )
    log_event("orchestrator.execute", {"user": user.get("name"), "exit": r.returncode})
    try:
        res = json.loads(r.stdout.strip())
    except Exception:
        res = {"raw": r.stdout.strip()}

    request_handler._send(200, {
        "ok": r.returncode == 0,
        "result": res,
        "stderr": r.stderr.strip()
    })
