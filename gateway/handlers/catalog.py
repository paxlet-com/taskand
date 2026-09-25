"""Opt-in native Paxlet catalog surface; inert unless TASKAND_CATALOG_ROOT is set.

Resolution pins declarations; nothing here executes packages or mutates the
legacy proc:// registry. Peers authenticate with ordinary grants.
"""
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from gateway.auth import require_grant

CATALOG_URI = "proc://taskand.dev/catalog/core/v1"
DIGEST = re.compile(r"sha256:[0-9a-f]{64}")
MAX_PACKAGE_BYTES = 64 * 1024 * 1024


def catalog_root():
    value = os.environ.get("TASKAND_CATALOG_ROOT", "").strip()
    return Path(value) if value else None


def _catalog(handler):
    root = catalog_root()
    if root is None:
        handler._send(503, {"ok": False, "error": "CATALOG_NOT_CONFIGURED"})
        return None
    try:
        from app.paxlet_catalog import Catalog
        return Catalog(root)
    except Exception:
        handler._send(503, {"ok": False, "error": "CATALOG_UNAVAILABLE"})
        return None


def handle_catalog(handler, body):
    """Operator read: node identity and all declaration records."""
    if not require_grant(handler, CATALOG_URI, "read"):
        return
    catalog = _catalog(handler)
    if catalog is None:
        return
    try:
        handler._send(200, {"ok": True, "node": catalog.node_id, "records": catalog.records()})
    except Exception:
        handler._send(503, {"ok": False, "error": "CATALOG_UNAVAILABLE"})


def handle_catalog_snapshot(handler, body):
    """Peer pull source: the bounded declaration snapshot for this node."""
    if not require_grant(handler, CATALOG_URI, "read"):
        return
    catalog = _catalog(handler)
    if catalog is None:
        return
    try:
        handler._send(200, catalog.snapshot())
    except Exception:
        handler._send(503, {"ok": False, "error": "CATALOG_UNAVAILABLE"})


def handle_catalog_snapshot_apply(handler, body):
    """Explicit local operator assertion of a peer snapshot, as the apply CLI."""
    if not require_grant(handler, CATALOG_URI, "admin"):
        return
    catalog = _catalog(handler)
    if catalog is None:
        return
    if not isinstance(body, dict) or set(body) != {"origin", "snapshot"} \
            or not isinstance(body["origin"], str) or not isinstance(body["snapshot"], dict):
        handler._send(400, {"ok": False, "error": "CATALOG_SNAPSHOT_REQUEST_INVALID"})
        return
    try:
        from app.paxlet_catalog import CatalogError
        result = catalog.apply_snapshot(body["snapshot"], authenticated_origin=body["origin"])
        handler._send(200, {"ok": True, **result})
    except CatalogError as error:
        handler._send(400, {"ok": False, "error": str(error)})
    except Exception:
        handler._send(503, {"ok": False, "error": "CATALOG_UNAVAILABLE"})


def handle_catalog_package(handler, body):
    """Digest-pinned package archive download for authenticated catalog peers."""
    if not require_grant(handler, CATALOG_URI, "read"):
        return
    if catalog_root() is None:
        handler._send(503, {"ok": False, "error": "CATALOG_NOT_CONFIGURED"})
        return
    digest = parse_qs(urlsplit(handler.path).query).get("digest", [""])[0]
    if not DIGEST.fullmatch(digest):
        handler._send(400, {"ok": False, "error": "CATALOG_DIGEST_INVALID"})
        return
    from paxlet.store import get_package
    package = get_package(digest)
    archive = package.parent / "package.paxlet.zip" if package is not None else None
    if archive is None or not archive.is_file() or archive.is_symlink():
        handler._send(404, {"ok": False, "error": "CATALOG_PACKAGE_NOT_FOUND"})
        return
    size = archive.stat().st_size
    if size > MAX_PACKAGE_BYTES:
        handler._send(413, {"ok": False, "error": "CATALOG_PACKAGE_TOO_LARGE"})
        return
    handler.send_response(200)
    handler.send_header("Content-Type", "application/zip")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(size))
    handler.end_headers()
    with archive.open("rb") as stream:
        while block := stream.read(65536):
            handler.wfile.write(block)
