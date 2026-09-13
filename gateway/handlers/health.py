import os
import socket

from gateway.utils import LLM_KEY, LLM_MODEL, registry

NODE = os.environ.get("TASKAND_NODE", socket.gethostname())


def handle_healthz(request_handler, body: dict) -> None:
    listing = registry("list", {"status": "active"}, timeout=30)
    request_handler._send(200, {
        "ok": listing.get("ok", False),
        "node": NODE,
        "version": "3.0.0",
        "processes": listing.get("total", 0),
        "llm_configured": bool(LLM_KEY),
        "model": LLM_MODEL if LLM_KEY else None,
    })
