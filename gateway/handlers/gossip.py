"""Gossip observation and synchronization use the registry's operation grants."""
from gateway.auth import require_grant
from gateway.gossip import get_gossip_engine
from gateway.handlers.federation import REGISTRY_URI


def handle_gossip_status(handler, body):
    if not require_grant(handler, REGISTRY_URI, "read"):
        return
    handler._send(200, get_gossip_engine().get_status())


def handle_gossip_trigger(handler, body):
    if not require_grant(handler, REGISTRY_URI, "admin"):
        return
    if body:
        handler._send(400, {"ok": False, "error": "gossip trigger accepts an empty object"})
        return
    report = get_gossip_engine().sync_once()
    handler._send(409 if report.get("busy") else (200 if report["ok"] else 503), report)
