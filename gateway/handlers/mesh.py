"""Bounded, non-authorizing projection of local registry and configured peers.

No discovery probes, remote calls, history reads, process execution or writes.
Configured peers and declared package hashes are not verified observations.
"""

import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

from gateway.auth import require_grant
from gateway.utils import registry

REGISTRY_URI = "proc://taskand.dev/registry/core/v1"
SCHEMA = "taskand.mesh-observation/v1"
URI = re.compile(
    r"^proc://taskand\.dev/([a-z0-9][a-z0-9-]*)/([a-z0-9][a-z0-9-]*)/v[0-9]+$"
)
HASH = re.compile(r"^sha256:[0-9a-f]{64}$")
STATES = {"active", "candidate", "deprecated"}


class MeshError(ValueError):
    pass


def peer_url(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 512:
        raise MeshError("MESH_PEER_INVALID")
    if any(ord(c) < 33 or ord(c) == 127 for c in value):
        raise MeshError("MESH_PEER_INVALID")
    try:
        url = urlsplit(value)
        port = url.port
    except ValueError:
        raise MeshError("MESH_PEER_INVALID") from None
    if (
        url.scheme not in {"http", "https"}
        or not url.hostname
        or url.username is not None
        or url.password is not None
        or url.query
        or url.fragment
        or url.path not in {"", "/"}
        or (port is not None and not 1 <= port <= 65535)
    ):
        raise MeshError("MESH_PEER_INVALID")
    host = url.hostname
    if not re.fullmatch(r"[a-zA-Z0-9.:-]+", host):
        raise MeshError("MESH_PEER_INVALID")
    host = "[" + host + "]" if ":" in host else host.lower()
    return url.scheme + "://" + host + (":" + str(port) if port else "")


def projection(catalog, peers):
    if not isinstance(catalog, dict) or catalog.get("ok") is not True:
        raise MeshError("MESH_REGISTRY_UNAVAILABLE")
    processes = catalog.get("processes")
    if not isinstance(processes, list) or len(processes) > 1000:
        raise MeshError("MESH_REGISTRY_INVALID")
    if not isinstance(peers, dict) or peers.get("ok") is not True:
        raise MeshError("MESH_PEERS_UNAVAILABLE")
    urls = peers.get("peers")
    if not isinstance(urls, list) or len(urls) > 128:
        raise MeshError("MESH_PEERS_INVALID")
    # UI-local identifiers are explicitly not globally authenticated node URNs.
    nodes = [
        {
            "id": "local",
            "kind": "instance",
            "label": "Ta instancja",
            "state": "RESPONDED",
            "identityVerified": False,
        }
    ]
    edges, seen, active, hashes = [], set(), 0, 0
    organisms = set()
    for row in processes:
        if not isinstance(row, dict) or not isinstance(row.get("uri"), str):
            raise MeshError("MESH_REGISTRY_INVALID")
        match = URI.fullmatch(row["uri"])
        state = row.get("status")
        if not match or row["uri"] in seen or state not in STATES:
            raise MeshError("MESH_REGISTRY_INVALID")
        seen.add(row["uri"])
        organism = match[1]
        oid = "organism:" + organism
        if organism not in organisms:
            organisms.add(organism)
            nodes.append(
                {"id": oid, "kind": "organism", "label": organism, "state": "DECLARED"}
            )
            edges.append({"source": "local", "target": oid, "relation": "declares"})
        pid = "process:" + row["uri"]
        nodes.append(
            {
                "id": pid,
                "kind": "process",
                "label": row["uri"],
                "state": state,
                "uri": row["uri"],
            }
        )
        edges.append({"source": oid, "target": pid, "relation": "declares"})
        active += state == "active"
        hashes += isinstance(row.get("hash"), str) and bool(HASH.fullmatch(row["hash"]))
    canonical_peers = sorted({peer_url(url) for url in urls})
    for url in canonical_peers:
        pid = "configured-peer:" + hashlib.sha256(url.encode()).hexdigest()
        nodes.append(
            {
                "id": pid,
                "kind": "peer",
                "label": url,
                "state": "UNOBSERVED",
                "identityVerified": False,
                "lastSeen": None,
            }
        )
        edges.append(
            {"source": "local", "target": pid, "relation": "configured-not-verified"}
        )
    count = len(processes)

    def metric(key, label, numerator, denominator):
        return {
            "id": key,
            "label": label,
            "numerator": numerator,
            "denominator": denominator,
            "unit": "percent",
            "value": round(numerator * 100 / denominator, 1) if denominator else None,
        }

    return {
        "schema": SCHEMA,
        "ok": True,
        "authority": "NONE",
        "observedAt": datetime.now(timezone.utc).isoformat(),
        "coverage": "local-registry-response-and-configured-peers-only",
        "remoteExecutionVerified": False,
        "taskSuccessVerified": False,
        "nodes": nodes,
        "edges": edges,
        "counts": {
            "processes": count,
            "organisms": len(organisms),
            "configuredPeers": len(canonical_peers),
            "onlinePeers": None,
        },
        "metrics": [
            metric("active", "Aktywne wpisy", active, count),
            metric("hash-declared", "Zadeklarowany SHA-256", hashes, count),
            metric("versioned", "Wersjonowane URI", count, count),
            {
                "id": "peer-health",
                "label": "Dostępność peerów",
                "value": None,
                "numerator": None,
                "denominator": len(canonical_peers),
                "unit": "percent",
            },
            {
                "id": "twin-coverage",
                "label": "Wierność bliźniaków",
                "value": None,
                "numerator": None,
                "denominator": None,
                "unit": "percent",
            },
        ],
        "limitations": [
            "HASH_DECLARATION_NOT_VERIFICATION",
            "PEERS_NOT_PROBED",
            "NO_GLOBAL_IDENTITY",
            "NO_ACTIVITY_COLLECTION",
        ],
    }


def handle_mesh(handler, body):
    if not require_grant(handler, REGISTRY_URI, "read"):
        return
    try:
        result = projection(
            registry("list", {}, timeout=5), registry("peers", {}, timeout=5)
        )
        handler._send(200, result)
    except (MeshError, OSError):
        # Registry errors and URLs can carry credentials; never echo input.
        handler._send(
            503,
            {
                "ok": False,
                "schema": SCHEMA,
                "error": "MESH_OBSERVATION_UNAVAILABLE",
                "authority": "NONE",
            },
        )
