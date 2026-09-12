from typing import Callable, Dict, Tuple
from gateway.handlers.health import handle_healthz
from gateway.handlers.federation import handle_federation
from gateway.handlers.proc import handle_proc_call
from gateway.handlers.chat import handle_chat
from gateway.handlers.doctor import handle_doctor
from gateway.handlers.planner import handle_planner
from gateway.handlers.orchestrator import handle_orchestrator

ROUTES: Dict[Tuple[str, str], Callable] = {
    ("GET", "/healthz"): handle_healthz,
    ("GET", "/api/federation"): handle_federation,
    ("POST", "/api/proc/call"): handle_proc_call,
    ("POST", "/api/chat"): handle_chat,
    ("POST", "/api/doctor"): handle_doctor,
    ("POST", "/api/planner"): handle_planner,
    ("POST", "/api/orchestrator"): handle_orchestrator,
}

def dispatch(method: str, path: str, request_handler, body: dict) -> None:
    # Normalize path (remove trailing slash except root)
    norm_path = path.rstrip("/") if path != "/" else "/"
    handler = ROUTES.get((method, norm_path))
    if handler:
        handler(request_handler, body)
    else:
        request_handler._send(404, {"ok": False, "error": f"Endpoint not found: {method} {path}"})
