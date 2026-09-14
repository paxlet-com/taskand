from gateway.auth import require_grant
from gateway.utils import registry, status_for

REGISTRY_URI = "proc://taskand.dev/registry/core/v1"
# Akcje rejestru dostępne przez /api/registry i wymagany rodzaj grantu
ACTION_GRANTS = {
    "list": "read", "resolve": "read", "select": "read", "verify": "read", "export": "read", "package": "read", "peers": "read", "policy": "read",
    "approve": "admin", "refresh": "admin", "deprecate": "admin", "scan": "admin", "pull": "admin",
    "peer_add": "admin", "peer_remove": "admin",
}


def handle_well_known_catalog(request_handler, body: dict) -> None:
    """DISCOVER: publiczny katalog aktywnych procesów węzła (URI, opis, hash) do wymiany z peerami."""
    result = registry("export", {}, timeout=30)
    request_handler._send(status_for(result), result)


def handle_federation(request_handler, body: dict) -> None:
    result = registry("list", {"status": "active"}, timeout=30)
    uris = [p["uri"] for p in result.get("processes", [])]
    request_handler._send(200, {"ok": result.get("ok", False), "total": len(uris), "processes": uris})


def handle_registry(request_handler, body: dict) -> None:
    action = body.get("action", "")
    grant = ACTION_GRANTS.get(action)
    if not grant:
        request_handler._send(400, {"ok": False, "error": f"Nieobsługiwana akcja rejestru: '{action}'", "actions": sorted(ACTION_GRANTS)})
        return
    target = body.get("uri") or REGISTRY_URI
    if not require_grant(request_handler, target, grant):
        return
    payload = {k: v for k, v in body.items() if k != "action"}
    result = registry(action, payload, timeout=300)
    request_handler._send(status_for(result), {"ok": result.get("ok", False), "result": result})
