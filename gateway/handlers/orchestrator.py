from gateway.auth import require_grant
from gateway.middleware.logging import log_event
from gateway.utils import call_process, status_for

URI = "proc://taskand.dev/orchestrator/execute/v1"


def handle_orchestrator(request_handler, body: dict) -> None:
    user = require_grant(request_handler, URI, "call")
    if not user:
        return
    result = call_process(URI, body or {}, timeout=600)
    log_event("gateway.orchestrator", {"user": user["name"], "status": result.get("status")})
    request_handler._send(status_for(result), {"ok": result.get("status") == "SUCCEEDED", "result": result})
