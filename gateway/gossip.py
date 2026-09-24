"""Autonomous background gossip and continuous registry synchronization for Taskand cluster nodes."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from gateway.utils import registry

logger = logging.getLogger("taskand.gossip")

_GLOBAL_ENGINE: Optional[GossipEngine] = None
_GLOBAL_LOCK = threading.Lock()


class GossipEngine:
    """Background daemon engine performing periodic peer health probes, catalog discovery,

    package pull/approval, and gossip peer exchange.
    """

    def __init__(
        self,
        interval: Optional[float] = None,
        auto_approve: Optional[bool] = None,
        auth_token: Optional[str] = None,
    ) -> None:
        self.interval = (
            interval
            if interval is not None
            else float(os.environ.get("TASKAND_GOSSIP_INTERVAL", "5.0"))
        )
        self.auto_approve = (
            auto_approve
            if auto_approve is not None
            else os.environ.get("TASKAND_GOSSIP_AUTO_APPROVE", "1") in ("1", "true", "True")
        )
        self.auth_token = auth_token or os.environ.get("TASKAND_AUTH_TOKEN", "taskand-admin-key")

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        self._last_sync_ts: Optional[str] = None
        self._peers_status: Dict[str, Dict[str, Any]] = {}
        self._synced_uris: Set[str] = set()

    def discover_peers(self) -> List[str]:
        """Collect configured peers from local registry and optional environment variables."""
        peers: List[str] = []
        try:
            reg_peers = registry("peers", {}, timeout=5)
            if reg_peers.get("ok") and isinstance(reg_peers.get("peers"), list):
                peers = [p.rstrip("/") for p in reg_peers["peers"] if isinstance(p, str)]
        except Exception as e:
            logger.warning("Failed to query peers from registry: %s", e)

        # Seed from TASKAND_PEERS if configured
        env_peers = os.environ.get("TASKAND_PEERS", "")
        if env_peers:
            for p in env_peers.split(","):
                clean = p.strip().rstrip("/")
                if clean and clean not in peers:
                    try:
                        registry("peer_add", {"url": clean}, timeout=5)
                        peers.append(clean)
                    except Exception as e:
                        logger.warning("Failed to auto-add peer %s: %s", clean, e)

        return sorted(set(peers))

    def _http_get_json(self, url: str, timeout: float = 3.0) -> Optional[dict]:
        """Fetch JSON payload with a short timeout and authorization headers."""
        headers = {
            "Accept": "application/json",
            "User-Agent": "taskand-gossip/1.0",
        }
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if 200 <= resp.status < 300:
                    raw = resp.read()
                    return json.loads(raw.decode("utf-8"))
        except Exception:
            return None
        return None

    def sync_once(self) -> dict:
        """Perform a single round of gossip and continuous replication across all peers."""
        now_iso = datetime.now(timezone.utc).isoformat()
        peers = self.discover_peers()

        # Step 1: Query local active processes
        local_uris: Set[str] = set()
        try:
            local_reg = registry("list", {"status": "active"}, timeout=10)
            if local_reg.get("ok") and isinstance(local_reg.get("processes"), list):
                for p in local_reg["processes"]:
                    if isinstance(p, dict) and "uri" in p:
                        local_uris.add(p["uri"])
        except Exception as e:
            logger.warning("Failed to list local active processes: %s", e)

        synced_in_this_round: List[str] = []
        peers_status_round: Dict[str, Dict[str, Any]] = {}

        for peer_url in peers:
            status_entry: Dict[str, Any] = {
                "peer": peer_url,
                "up": False,
                "health": None,
                "offered_processes": 0,
                "missing_processes": [],
                "pulled_count": 0,
                "last_seen": None,
                "error": None,
            }

            # 1. Health probe
            health = self._http_get_json(f"{peer_url}/healthz", timeout=3.0)
            if health is None or not health.get("ok"):
                status_entry["error"] = "Health check failed or unreachable"
                peers_status_round[peer_url] = status_entry
                continue

            status_entry["up"] = True
            status_entry["health"] = health
            status_entry["last_seen"] = now_iso

            # 2. Peer discovery / gossip peer exchange
            remote_gossip = self._http_get_json(f"{peer_url}/api/cluster/gossip", timeout=3.0)
            if remote_gossip and remote_gossip.get("ok") and isinstance(remote_gossip.get("peers"), dict):
                for discovered_peer in remote_gossip["peers"].keys():
                    if discovered_peer and discovered_peer not in peers and discovered_peer != peer_url:
                        try:
                            registry("peer_add", {"url": discovered_peer}, timeout=5)
                            peers.append(discovered_peer)
                        except Exception:
                            pass

            # 3. Catalog discovery
            catalog = self._http_get_json(f"{peer_url}/.well-known/catalog.json", timeout=5.0)
            if not catalog or not catalog.get("ok"):
                status_entry["error"] = "Failed to fetch remote catalog"
                peers_status_round[peer_url] = status_entry
                continue

            remote_procs = catalog.get("processes", [])
            status_entry["offered_processes"] = len(remote_procs)

            missing: List[str] = []
            for proc in remote_procs:
                uri = proc.get("uri")
                if uri and uri not in local_uris:
                    missing.append(uri)

            status_entry["missing_processes"] = missing

            # 4. Pull missing packages autonomously
            if missing:
                try:
                    pull_res = registry(
                        "pull",
                        {"peer": peer_url, "token": self.auth_token, "uris": missing},
                        timeout=30,
                    )
                    pulled_count = pull_res.get("imported", 0)
                    status_entry["pulled_count"] = pulled_count

                    # 5. Autonomous approval if auto_approve is configured
                    if pulled_count > 0:
                        report = pull_res.get("report", [])
                        for rep in report:
                            if rep.get("result") in ("imported", "same") and "uri" in rep:
                                uri = rep["uri"]
                                synced_in_this_round.append(uri)
                                with self._lock:
                                    self._synced_uris.add(uri)
                                local_uris.add(uri)

                                if self.auto_approve:
                                    try:
                                        registry("approve", {"uri": uri}, timeout=10)
                                    except Exception as e:
                                        logger.warning("Failed to approve %s: %s", uri, e)
                except Exception as e:
                    status_entry["error"] = f"Pull failed: {e}"

            peers_status_round[peer_url] = status_entry

        with self._lock:
            self._last_sync_ts = now_iso
            self._peers_status = peers_status_round

        return {
            "ok": True,
            "timestamp": now_iso,
            "peers_count": len(peers),
            "synced_this_round": synced_in_this_round,
            "total_synced": sorted(list(self._synced_uris)),
            "peers": peers_status_round,
        }

    def _loop(self) -> None:
        """Background loop executing sync_once at regular intervals."""
        while not self._stop_event.is_set():
            try:
                self.sync_once()
            except Exception as e:
                logger.error("Error in gossip loop: %s", e)
            self._stop_event.wait(self.interval)

    def start(self) -> None:
        """Start the background gossip thread."""
        with self._lock:
            if self._running:
                return
            self._running = True
            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._loop, name="TaskandGossipWorker", daemon=True
            )
            self._thread.start()
            logger.info("Taskand gossip engine started (interval: %.1fs)", self.interval)

    def stop(self) -> None:
        """Stop the background gossip thread."""
        with self._lock:
            if not self._running:
                return
            self._running = False
            self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        logger.info("Taskand gossip engine stopped")

    def get_status(self) -> dict:
        """Return a thread-safe snapshot of gossip engine state."""
        with self._lock:
            return {
                "ok": True,
                "running": self._running,
                "interval": self.interval,
                "auto_approve": self.auto_approve,
                "last_sync": self._last_sync_ts,
                "peers": dict(self._peers_status),
                "synced_uris": sorted(list(self._synced_uris)),
            }


def get_gossip_engine() -> GossipEngine:
    """Return the global GossipEngine instance, creating one if not present."""
    global _GLOBAL_ENGINE
    with _GLOBAL_LOCK:
        if _GLOBAL_ENGINE is None:
            _GLOBAL_ENGINE = GossipEngine()
        return _GLOBAL_ENGINE


def start_gossip_service() -> GossipEngine:
    """Ensure the global gossip engine is created and running."""
    engine = get_gossip_engine()
    engine.start()
    return engine


def stop_gossip_service() -> None:
    """Stop the global gossip engine if running."""
    global _GLOBAL_ENGINE
    with _GLOBAL_LOCK:
        if _GLOBAL_ENGINE is not None:
            _GLOBAL_ENGINE.stop()
            _GLOBAL_ENGINE = None
