"""Native Paxlet Adapter and AttemptStore for Taskand task orchestration."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
import hashlib
import json
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger("taskand.paxlet_adapter")

DEFAULT_ATTEMPTS_DIR = Path(os.environ.get("TASKAND_ATTEMPTS_DIR", Path(__file__).resolve().parents[1] / "log/attempts"))


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()


@dataclass
class AttemptRecord:
    attempt_id: str
    urn: str
    action: str
    digest: str
    status: str  # SUCCESS, FAILED
    input_payload: Any
    output: Any
    receipt: Dict[str, Any]
    receipt_digest: str
    started_at: str
    finished_at: str
    duration_ms: float
    exit_code: int
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AttemptStore:
    """Persistent storage for task execution attempts and Paxlet receipts."""

    def __init__(self, store_dir: Optional[Path] = None):
        self.store_dir = store_dir or DEFAULT_ATTEMPTS_DIR
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.store_dir / "attempts_index.jsonl"
        self._in_memory: List[AttemptRecord] = []

    def record_attempt(
        self,
        urn: str,
        action: str,
        digest: str,
        status: str,
        input_payload: Any,
        output: Any,
        receipt: Dict[str, Any],
        started_at: str,
        finished_at: str,
        duration_ms: float,
        exit_code: int,
        error: Optional[str] = None,
    ) -> AttemptRecord:
        attempt_id = f"att_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        receipt_digest = compute_digest(receipt)

        record = AttemptRecord(
            attempt_id=attempt_id,
            urn=urn,
            action=action,
            digest=digest,
            status=status,
            input_payload=input_payload,
            output=output,
            receipt=receipt,
            receipt_digest=receipt_digest,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=round(duration_ms, 2),
            exit_code=exit_code,
            error=error,
        )

        # Write individual attempt record JSON
        attempt_file = self.store_dir / f"{attempt_id}.json"
        try:
            attempt_file.write_text(json.dumps(record.to_dict(), indent=2) + "\n", encoding="utf-8")
        except Exception as e:
            logger.warning("Could not persist attempt file %s: %s", attempt_file, e)

        # Append to index
        try:
            with open(self.index_file, "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "attempt_id": attempt_id,
                    "urn": urn,
                    "action": action,
                    "digest": digest,
                    "status": status,
                    "receipt_digest": receipt_digest,
                    "started_at": started_at,
                    "exit_code": exit_code,
                }) + "\n")
        except Exception as e:
            logger.warning("Could not append to attempts index: %s", e)

        self._in_memory.append(record)
        return record

    def get_attempt(self, attempt_id: str) -> Optional[AttemptRecord]:
        for rec in reversed(self._in_memory):
            if rec.attempt_id == attempt_id:
                return rec
        attempt_file = self.store_dir / f"{attempt_id}.json"
        if attempt_file.is_file():
            try:
                data = json.loads(attempt_file.read_text(encoding="utf-8"))
                return AttemptRecord(**data)
            except Exception:
                return None
        return None

    def list_attempts(self, urn: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        results = []
        if self.index_file.is_file():
            try:
                for line in reversed(self.index_file.read_text(encoding="utf-8").splitlines()):
                    if not line.strip():
                        continue
                    entry = json.loads(line)
                    if urn and entry.get("urn") != urn:
                        continue
                    results.append(entry)
                    if len(results) >= limit:
                        break
            except Exception as e:
                logger.warning("Error reading attempts index: %s", e)
        return results


class PaxletTaskandExecutor:
    """Executes capability packages identified by URN and records receipts in AttemptStore."""

    def __init__(self, attempt_store: Optional[AttemptStore] = None):
        self.attempt_store = attempt_store or AttemptStore()

    def execute_urn(
        self,
        package_directory: Path | str,
        action: str = "run",
        input_data: Optional[Dict[str, Any]] = None,
        expected_digest: Optional[str] = None,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """Executes a Paxlet package directory, verifies signature/digest, and records attempt."""
        from paxlet.manifest import load_manifest, package_digest, validate_manifest
        from paxlet.runtime import run_action

        package_path = Path(package_directory).resolve()
        manifest_path, manifest = load_manifest(package_path)
        val = validate_manifest(manifest_path.parent, manifest)
        if not val.ok:
            raise ValueError("Invalid Paxlet package manifest: " + "; ".join(val.errors))

        actual_digest = package_digest(manifest_path.parent, manifest)
        urn = manifest["identity"]["urn"]

        if expected_digest and expected_digest != actual_digest:
            raise ValueError(f"Paxlet digest mismatch: expected {expected_digest}, actual {actual_digest}")

        payload = input_data or {}
        started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        t0 = time.perf_counter()

        status = "SUCCESS"
        error_msg = None
        exit_code = 0
        output = {}
        receipt = {}
        receipt_path_str = ""

        try:
            output, receipt, receipt_path = run_action(
                package_path, action, payload, expected_digest=actual_digest, timeout=timeout,
            )
            receipt_path_str = str(receipt_path)
            exit_code = output.get("exit_code", 0) if isinstance(output, dict) else 0
            if exit_code != 0:
                status = "FAILED"
        except Exception as exc:
            status = "FAILED"
            error_msg = str(exc)
            exit_code = 1
            finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            duration_ms = (time.perf_counter() - t0) * 1000.0

            # Generate synthetic error receipt
            receipt = {
                "receipt": "paxlet/0.1",
                "identity": manifest["identity"],
                "package_digest": actual_digest,
                "action": action,
                "input_digest": compute_digest(payload),
                "output_digest": compute_digest({"error": error_msg}),
                "runtime": "taskand-executor/1.0",
                "node": "urn:paxlet:node:taskand",
                "started_at": started_at,
                "finished_at": finished_at,
                "exit_code": 1,
                "granted_secret_names": [],
                "artifact_refs": [],
            }

        finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        duration_ms = (time.perf_counter() - t0) * 1000.0

        attempt = self.attempt_store.record_attempt(
            urn=urn,
            action=action,
            digest=actual_digest,
            status=status,
            input_payload=payload,
            output=output,
            receipt=receipt,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
            exit_code=exit_code,
            error=error_msg,
        )

        if error_msg:
            raise RuntimeError(f"Paxlet execution failed: {error_msg}")

        return {
            "urn": urn,
            "action": action,
            "digest": actual_digest,
            "output": output,
            "receipt": receipt,
            "receipt_path": receipt_path_str,
            "attempt_id": attempt.attempt_id,
            "receipt_digest": attempt.receipt_digest,
        }


# Global singleton instances
attempt_store = AttemptStore()
paxlet_executor = PaxletTaskandExecutor(attempt_store=attempt_store)
