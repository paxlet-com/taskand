"""Bounded synchronization over configured peers; discovery never grants trust."""
from __future__ import annotations

import copy
import json
import logging
import math
import os
import re
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from gateway.utils import registry

logger = logging.getLogger("taskand.gossip")
MAX_PEERS = 16
MAX_CATALOG_ENTRIES = 256
MAX_IMPORTS = 16
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_PACKAGE_BYTES = 64 * 1024 * 1024
ROUND_SECONDS = 30.0
HTTP_SECONDS = 3.0
PROCESS_URI = re.compile(r"proc://taskand\.dev/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*/v[0-9]+")
DIGEST = re.compile(r"sha256:[0-9a-f]{64}")
CATALOG_NODE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
_GLOBAL_ENGINE = None
_GLOBAL_LOCK = threading.Lock()


def peer_origin(value: str) -> str:
    if not isinstance(value, str) or any(ord(c) <= 32 or ord(c) >= 127 for c in value) or any(c in value for c in "%\\?#"):
        raise ValueError("peer must be an HTTP(S) origin without credentials, path, query or fragment")
    try:
        parsed = urlsplit(value)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname
                or parsed.username is not None or parsed.password is not None or parsed.path not in {"", "/"}):
            raise ValueError()
        host = parsed.hostname.lower()
        if not re.fullmatch(r"[a-z0-9.:-]+", host):
            raise ValueError()
        port = parsed.port
        if port == 0:
            raise ValueError()
    except ValueError as exc:
        raise ValueError("invalid peer origin") from exc
    if ":" in host:
        host = f"[{host}]"
    port_text = f":{port}" if port is not None and port != (443 if parsed.scheme == "https" else 80) else ""
    return f"{parsed.scheme}://{host}{port_text}"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("peer redirects are not allowed")


def _json_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def _json_constant(value):
    raise ValueError("non-finite JSON number")


class GossipEngine:
    def __init__(self, interval=None, auto_approve=None, auth_token=None, *, peer_tokens=None):
        self.interval = float(interval if interval is not None else os.environ.get("TASKAND_GOSSIP_INTERVAL", "5"))
        if not math.isfinite(self.interval) or not 0.1 <= self.interval <= 3600:
            raise ValueError("gossip interval must be between 0.1 and 3600 seconds")
        if auth_token:
            raise ValueError("use peer_tokens / TASKAND_GOSSIP_PEER_TOKENS; shared admin credentials are not peer credentials")
        if auto_approve is None:
            setting = os.environ.get("TASKAND_GOSSIP_AUTO_APPROVE", "0").lower()
            if setting not in {"0", "1", "true", "false"}:
                raise ValueError("TASKAND_GOSSIP_AUTO_APPROVE must be boolean")
            auto_approve = setting in {"1", "true"}
        if not isinstance(auto_approve, bool):
            raise ValueError("auto_approve must be boolean")
        self.auto_approve = auto_approve
        if peer_tokens is None:
            peer_tokens = json.loads(os.environ.get("TASKAND_GOSSIP_PEER_TOKENS", "{}"), object_pairs_hook=_json_object)
        if not isinstance(peer_tokens, dict) or len(peer_tokens) > MAX_PEERS:
            raise ValueError("peer token mapping must be a bounded object")
        self._peer_tokens = {}
        for endpoint, token in peer_tokens.items():
            origin = peer_origin(endpoint)
            if origin in self._peer_tokens or not isinstance(token, str) or not re.fullmatch(r"[\x21-\x7e]{1,4096}", token):
                raise ValueError("invalid or duplicate peer credential mapping")
            self._peer_tokens[origin] = token
        # Authenticated catalog peer transport is separate opt-in: each mapped
        # origin asserts exactly one node identity for apply_snapshot.
        mapping = json.loads(os.environ.get("TASKAND_CATALOG_PEERS", "{}"), object_pairs_hook=_json_object)
        if not isinstance(mapping, dict) or len(mapping) > MAX_PEERS:
            raise ValueError("catalog peer mapping must be a bounded object")
        self._catalog_peers = {}
        for endpoint, node in mapping.items():
            origin = peer_origin(endpoint)
            if origin in self._catalog_peers or not isinstance(node, str) or not CATALOG_NODE.fullmatch(node):
                raise ValueError("invalid or duplicate catalog peer mapping")
            self._catalog_peers[origin] = node
        # Do not inherit proxy routing from ambient HTTP_PROXY/HTTPS_PROXY.
        self._http = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
        self._lock = threading.Lock()
        self._round_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None
        self._running = False
        self._last_sync_ts = None
        self._peers_status = {}
        self._synced_uris = []
        self._last_error = None

    def discover_peers(self):
        configured = registry("peers", {}, timeout=5)
        if not isinstance(configured, dict) or configured.get("ok") is not True or not isinstance(configured.get("peers"), list):
            raise ValueError("local peer configuration unavailable")
        values = configured["peers"] + [v.strip() for v in os.environ.get("TASKAND_PEERS", "").split(",") if v.strip()]
        if len(values) > MAX_PEERS * 2:
            raise ValueError("configured peer count exceeds limit")
        peers = sorted({peer_origin(value) for value in values})
        if len(peers) > MAX_PEERS:
            raise ValueError("configured peer count exceeds limit")
        return peers

    def _http_get_json(self, url, timeout=HTTP_SECONDS, *, authenticated=False):
        parsed = urlsplit(url)
        origin = peer_origin(f"{parsed.scheme}://{parsed.netloc}")
        if parsed.path not in {"/healthz", "/api/cluster/gossip", "/.well-known/catalog.json",
                               "/api/catalog/snapshot"} or parsed.query or parsed.fragment:
            raise ValueError("unsupported peer request")
        headers = {"Accept": "application/json", "User-Agent": "taskand-gossip/2"}
        # Public health/catalog probes carry no credentials. Status can use an
        # explicitly configured read-only token for exactly this peer origin.
        if authenticated and origin in self._peer_tokens:
            headers["Authorization"] = "Bearer " + self._peer_tokens[origin]
        deadline = time.monotonic() + timeout
        req = urllib.request.Request(url, headers=headers)
        with self._http.open(req, timeout=timeout) as response:
            if response.status != 200 or response.headers.get("Content-Encoding", "identity") != "identity":
                raise ValueError("unsupported peer response")
            length = response.headers.get("Content-Length")
            if length is not None and (not length.isdigit() or int(length) > MAX_RESPONSE_BYTES):
                raise ValueError("peer response exceeds size limit")
            payload = bytearray()
            while True:
                if time.monotonic() >= deadline or self._stop_event.is_set():
                    raise TimeoutError("peer request deadline exceeded")
                block = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - len(payload)))
                if not block:
                    break
                payload.extend(block)
                if len(payload) > MAX_RESPONSE_BYTES:
                    raise ValueError("peer response exceeds size limit")
            if length is not None and len(payload) != int(length):
                raise ValueError("truncated peer response")
        try:
            result = json.loads(payload.decode("utf-8"), object_pairs_hook=_json_object, parse_constant=_json_constant)
        except RecursionError as exc:
            raise ValueError("peer response nesting exceeds parser limit") from exc
        if not isinstance(result, dict):
            raise ValueError("peer response must be a JSON object")
        return result

    def _http_get_bytes(self, url, timeout=HTTP_SECONDS, *, authenticated=False):
        parsed = urlsplit(url)
        origin = peer_origin(f"{parsed.scheme}://{parsed.netloc}")
        if parsed.scheme != "http" or parsed.path != "/api/catalog/package" \
                or not parsed.query.startswith("digest=sha256:") or parsed.fragment:
            raise ValueError("unsupported peer request")
        headers = {"User-Agent": "taskand-gossip/2"}
        if authenticated and origin in self._peer_tokens:
            headers["Authorization"] = "Bearer " + self._peer_tokens[origin]
        deadline = time.monotonic() + timeout
        req = urllib.request.Request(url, headers=headers)
        with self._http.open(req, timeout=timeout) as response:
            if response.status != 200 or response.headers.get("Content-Encoding", "identity") != "identity":
                raise ValueError("unsupported peer response")
            length = response.headers.get("Content-Length")
            if length is not None and (not length.isdigit() or int(length) > MAX_PACKAGE_BYTES):
                raise ValueError("peer response exceeds size limit")
            payload = bytearray()
            while True:
                if time.monotonic() >= deadline or self._stop_event.is_set():
                    raise TimeoutError("peer request deadline exceeded")
                block = response.read1(min(65536, MAX_PACKAGE_BYTES + 1 - len(payload)))
                if not block:
                    break
                payload.extend(block)
                if len(payload) > MAX_PACKAGE_BYTES:
                    raise ValueError("peer response exceeds size limit")
            if length is not None and len(payload) != int(length):
                raise ValueError("truncated peer response")
        return bytes(payload)

    def _sync_catalog(self, peer, node_id, budget):
        """Pull a mapped peer's Paxlet catalog snapshot; failures never break the round."""
        report = {"node": node_id, "applied": False, "changed": False, "revision": None, "error": None}
        try:
            root = os.environ.get("TASKAND_CATALOG_ROOT", "").strip()
            if not root:
                report["error"] = "catalog replication is not configured locally"
                return report
            from app.paxlet_catalog import Catalog
            from paxlet.store import get_package
            snapshot = self._http_get_json(peer + "/api/catalog/snapshot", budget(), authenticated=True)
            entries = Catalog._check_snapshot(snapshot, node_id)
            catalog = Catalog(root)
            archives, temp = {}, None
            try:
                missing = [e["digest"] for e in entries
                           if not e["withdrawn"] and get_package(e["digest"]) is None][:MAX_IMPORTS]
                for digest in missing:
                    if temp is None:
                        temp = tempfile.TemporaryDirectory(prefix="taskand-catalog-pull-")
                    target = Path(temp.name) / (digest[7:] + ".paxlet.zip")
                    target.write_bytes(self._http_get_bytes(
                        peer + "/api/catalog/package?digest=" + digest, budget(20), authenticated=True))
                    archives[digest] = target
                outcome = catalog.apply_snapshot(snapshot, authenticated_origin=node_id, archives=archives)
                report.update(applied=True, changed=outcome["changed"], revision=outcome["revision"])
            finally:
                if temp is not None:
                    temp.cleanup()
        except Exception:
            # Category only: peer errors must not reflect hostile bodies or
            # credentials into gossip status.
            report["error"] = "catalog synchronization failed"
        return report

    @staticmethod
    def _entries(value, *, remote=False):
        if not isinstance(value, dict) or value.get("ok") is not True or not isinstance(value.get("processes"), list):
            raise ValueError("invalid process catalog")
        if remote and (value.get("standard") != "taskand-registry/1" or len(value["processes"]) > MAX_CATALOG_ENTRIES):
            raise ValueError("unsupported or oversized peer catalog")
        result = {}
        for entry in value["processes"]:
            if (not isinstance(entry, dict) or not isinstance(entry.get("uri"), str)
                    or len(entry["uri"]) > 512 or not PROCESS_URI.fullmatch(entry["uri"]) or not isinstance(entry.get("hash"), str)
                    or not DIGEST.fullmatch(entry["hash"]) or entry["uri"] in result):
                raise ValueError("invalid or duplicate process catalog entry")
            result[entry["uri"]] = entry
        return result

    def sync_once(self):
        if not self._round_lock.acquire(blocking=False):
            return {"ok": False, "error": "SYNC_IN_PROGRESS", "busy": True}
        now = datetime.now(timezone.utc).isoformat()
        statuses, synced = {}, []
        failure = None
        deadline = time.monotonic() + ROUND_SECONDS
        remaining_imports = MAX_IMPORTS
        def budget(maximum=HTTP_SECONDS):
            remaining = deadline - time.monotonic()
            if remaining <= 0 or self._stop_event.is_set():
                raise TimeoutError("sync round stopped or scheduling deadline exceeded")
            return min(maximum, remaining)
        try:
            peers = self.discover_peers()
            # Candidate/deprecated entries also reserve an immutable URI. Merely
            # seeing them advertised must never resurrect or approve them.
            local = self._entries(registry("list", {}, timeout=budget(5)))
            for peer in peers:
                status = {"peer": peer, "up": False, "last_seen": None, "offered_processes": 0,
                          "missing_processes": [], "discovered_peers": [], "conflicts": [],
                          "pulled_count": 0, "approved_count": 0, "deferred_count": 0, "error": None}
                statuses[peer] = status
                try:
                    health = self._http_get_json(peer + "/healthz", budget())
                    if health.get("ok") is not True:
                        raise ValueError("peer health check failed")
                    status.update(up=True, last_seen=now)
                    # Peer exchange is advisory. Failure of this optional status
                    # endpoint does not prevent catalog replication.
                    try:
                        gossip = self._http_get_json(peer + "/api/cluster/gossip", budget(), authenticated=True)
                        advertised = gossip.get("peers", {})
                        if gossip.get("ok") is True and isinstance(advertised, dict) and len(advertised) <= MAX_PEERS:
                            status["discovered_peers"] = sorted({peer_origin(v) for v in advertised})
                    except (ValueError, OSError, TimeoutError):
                        pass
                    remote = self._entries(self._http_get_json(peer + "/.well-known/catalog.json", budget()), remote=True)
                    status["offered_processes"] = len(remote)
                    for uri, entry in remote.items():
                        if uri in local and local[uri]["hash"] != entry["hash"]:
                            status["conflicts"].append(uri)
                    missing = [uri for uri in remote if uri not in local]
                    status["missing_processes"] = missing
                    chosen = missing[:remaining_imports]
                    status["deferred_count"] = len(missing) - len(chosen)
                    if chosen:
                        remaining_imports -= len(chosen)
                        response = registry("pull", {"peer": peer, "token": self._peer_tokens.get(peer),
                            "uris": chosen, "expected": {uri: remote[uri]["hash"] for uri in chosen},
                            "hold": True}, timeout=budget(20))
                        if not isinstance(response, dict) or response.get("ok") is not True or not isinstance(response.get("report"), list):
                            raise ValueError("peer import failed")
                        reports = response["report"]
                        if (len(reports) != len(chosen)
                                or any(not isinstance(r, dict) or not isinstance(r.get("uri"), str) for r in reports)
                                or {r["uri"] for r in reports} != set(chosen)):
                            raise ValueError("incomplete peer import report")
                        for report in reports:
                            uri = report["uri"]
                            if report.get("result") not in ("imported", "same"):
                                status["error"] = "one or more package imports failed"
                                continue
                            if report.get("result") == "imported":
                                status["pulled_count"] += 1
                            synced.append(uri)
                            local[uri] = remote[uri]
                            if self.auto_approve and report.get("status") == "candidate":
                                approved = registry("approve", {"uri": uri}, timeout=budget(5))
                                if not isinstance(approved, dict) or approved.get("ok") is not True:
                                    status["error"] = "package approval failed"
                                else:
                                    status["approved_count"] += 1
                    if status["conflicts"]:
                        status["error"] = "immutable URI content conflict"
                    node_id = self._catalog_peers.get(peer)
                    if node_id is not None:
                        status["catalog"] = self._sync_catalog(peer, node_id, budget)
                except (ValueError, OSError, TimeoutError) as exc:
                    # Report categories only: peer errors must not reflect tokens
                    # or hostile response bodies into logs/status endpoints.
                    status["error"] = type(exc).__name__ + ": peer synchronization failed"
        except (ValueError, OSError, TimeoutError) as exc:
            failure = type(exc).__name__ + ": local synchronization unavailable"
        finally:
            with self._lock:
                self._last_sync_ts = now
                self._peers_status = statuses
                self._synced_uris = sorted(set(synced))
                self._last_error = failure
            self._round_lock.release()
        return {"ok": failure is None and not any(v["error"] for v in statuses.values()),
                "timestamp": now, "peers_count": len(statuses), "synced_this_round": sorted(set(synced)),
                "error": failure, "peers": copy.deepcopy(statuses)}

    def _loop(self):
        try:
            while not self._stop_event.is_set():
                try:
                    self.sync_once()
                except Exception:
                    logger.exception("Unexpected gossip round failure")
                self._stop_event.wait(self.interval)
        finally:
            with self._lock:
                self._running = False

    def start(self):
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._running = True
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._loop, name="TaskandGossipWorker", daemon=True)
            self._thread.start()

    def stop(self):
        self._stop_event.set()
        with self._lock:
            thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=ROUND_SECONDS + 10)
        return thread is None or not thread.is_alive()

    def get_status(self):
        with self._lock:
            return {"ok": True, "running": self._running, "interval": self.interval,
                    "auto_approve": self.auto_approve, "last_sync": self._last_sync_ts,
                    "error": self._last_error, "peers": copy.deepcopy(self._peers_status),
                    "synced_uris": list(self._synced_uris)}


def get_gossip_engine():
    global _GLOBAL_ENGINE
    with _GLOBAL_LOCK:
        if _GLOBAL_ENGINE is None:
            _GLOBAL_ENGINE = GossipEngine()
        return _GLOBAL_ENGINE


def start_gossip_service():
    engine = get_gossip_engine()
    engine.start()
    return engine


def stop_gossip_service():
    global _GLOBAL_ENGINE
    with _GLOBAL_LOCK:
        if _GLOBAL_ENGINE is not None and _GLOBAL_ENGINE.stop():
            _GLOBAL_ENGINE = None
