import json
import subprocess
from gateway.utils import find_proc_bin
from gateway.auth import check_auth, check_grant
from gateway.middleware.logging import log_event

def handle_proc_call(request_handler, body: dict) -> None:
    # 1. Sprawdź autentykację (Bearer token / API key)
    is_auth, user = check_auth(request_handler.headers)
    if not is_auth:
        request_handler._send(401, {
            "ok": False,
            "error": "Unauthorized: Wymagana autentykacja (Authorization: Bearer <token> lub X-Taskand-Key)",
            "statusCode": 401
        })
        return

    uri = body.get("uri", "")
    data = body.get("data", {})
    if not uri:
        request_handler._send(400, {"ok": False, "error": "Brak wymaganego pola 'uri'"})
        return

    # 2. Sprawdź uprawnienia w grants.yaml dla danego usera i URI
    if not check_grant(user, uri, action="call"):
        request_handler._send(403, {
            "ok": False,
            "error": f"Forbidden: Użytkownik '{user.get('name')}' (rola: {user.get('role')}) nie posiada grantu do wywołania '{uri}'",
            "statusCode": 403
        })
        return

    # 3. Rozwiąż ścieżkę procesu
    binpath = find_proc_bin(uri)
    if not binpath or not binpath.exists():
        request_handler._send(404, {"ok": False, "error": f"Proces URI nie znaleziony w katalogu: {uri}"})
        return

    # 4. Wykonaj proces z izolacją i timeoutem
    try:
        r = subprocess.run(
            ["node", str(binpath)],
            input=json.dumps(data),
            capture_output=True,
            text=True,
            timeout=30
        )
        log_event("proc.call", {"uri": uri, "user": user.get("name"), "exit": r.returncode})
        try:
            res = json.loads(r.stdout.strip())
        except Exception:
            res = r.stdout.strip()

        request_handler._send(200, {
            "ok": r.returncode == 0,
            "uri": uri,
            "user": user.get("name"),
            "exit": r.returncode,
            "result": res,
            "stderr": r.stderr.strip()
        })
    except subprocess.TimeoutExpired:
        request_handler._send(504, {"ok": False, "error": f"Przekroczono limit czasu (timeout 30s) dla procesu: {uri}"})
    except Exception as e:
        request_handler._send(500, {"ok": False, "error": str(e)})
