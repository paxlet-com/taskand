"""HTTP Handlers for Taskand Cluster Gossip and Auto-Discovery."""

from __future__ import annotations

from typing import Any

from gateway.gossip import get_gossip_engine


def handle_gossip_status(handler: Any, body: dict) -> None:
    """GET /api/cluster/gossip: returns current gossip engine status, peer metrics, and synced packages."""
    engine = get_gossip_engine()
    status = engine.get_status()
    handler._send(200, status)


def handle_gossip_trigger(handler: Any, body: dict) -> None:
    """POST /api/cluster/gossip: immediately triggers an out-of-band gossip synchronization cycle."""
    engine = get_gossip_engine()
    report = engine.sync_once()
    handler._send(200, report)
