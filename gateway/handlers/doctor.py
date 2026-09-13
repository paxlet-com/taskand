from gateway.auth import require_grant
from gateway.utils import call_process, status_for

URI = "proc://taskand.dev/doctor/diagnose/v1"


def handle_doctor(request_handler, body: dict) -> None:
    if not require_grant(request_handler, URI, "call"):
        return
    result = call_process(URI, body or {}, timeout=30)
    request_handler._send(status_for(result), {"ok": result.get("ok", False), "organism": "doctor", "diagnose": result})
