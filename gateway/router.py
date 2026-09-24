from typing import Callable, Dict, Tuple
from gateway.handlers.health import handle_healthz
from gateway.handlers.federation import handle_federation, handle_registry, handle_well_known_catalog
from gateway.handlers.proc import handle_proc_call
from gateway.handlers.chat import handle_chat, handle_conversation
from gateway.handlers.doctor import handle_doctor
from gateway.handlers.planner import handle_planner
from gateway.handlers.orchestrator import handle_orchestrator
from gateway.handlers.context import handle_context, handle_state, handle_mcp_catalog
from gateway.handlers.mesh import handle_mesh
from gateway.handlers.observers import handle_pilot
from gateway.handlers.monag_handler import handle_monag_status, handle_monag_resume, handle_notify
from gateway.handlers.gossip import handle_gossip_status, handle_gossip_trigger
from urllib.parse import urlsplit

ROUTES: Dict[Tuple[str, str], Callable] = {
    ('GET', '/api/mcp/catalog'): handle_mcp_catalog,
    ('POST', '/api/conversation'): handle_conversation,
    ('GET', '/api/mesh/state'): handle_mesh,
    ('POST', '/api/observers/pilot'): handle_pilot,
    ('GET', '/api/context'): handle_context,
    ('POST', '/api/context'): handle_context,
    ('GET', '/api/state'): handle_state,
    ("GET", "/healthz"): handle_healthz,
    ("GET", "/api/federation"): handle_federation,
    ("GET", "/.well-known/catalog.json"): handle_well_known_catalog,
    ("POST", "/api/registry"): handle_registry,
    ("POST", "/api/proc/call"): handle_proc_call,
    ("POST", "/api/chat"): handle_chat,
    ("POST", "/api/doctor"): handle_doctor,
    ("POST", "/api/planner"): handle_planner,
    ("POST", "/api/orchestrator"): handle_orchestrator,
    ("GET", "/api/monag/status"): handle_monag_status,
    ("GET", "/api/monag/resume"): handle_monag_resume,
    ("POST", "/api/notify"): handle_notify,
    ("GET", "/api/cluster/gossip"): handle_gossip_status,
    ("POST", "/api/cluster/gossip"): handle_gossip_trigger,
}

def dispatch(method: str, path: str, request_handler, body: dict) -> None:
    # Normalize path (remove trailing slash except root)
    route_path = urlsplit(path).path
    norm_path = route_path.rstrip('/') if route_path != '/' else '/'
    handler = ROUTES.get((method, norm_path))
    if handler:
        handler(request_handler, body)
    else:
        request_handler._send(404, {"ok": False, "error": f"Endpoint not found: {method} {path}"})
