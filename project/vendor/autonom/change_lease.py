"""Durable Wellmanifest change leases for multi-agent repository effects."""
from __future__ import annotations

import copy
import fcntl
import hashlib
import json
import os
import re
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterator


LEASE_SCHEMA = "wellmanifest.change-lease/v1"
TRANSITION_SCHEMA = "wellmanifest.change-lease-transition/v1"
RECEIPT_SCHEMA = "wellmanifest.change-lease-receipt/v1"
STORE_SCHEMA = "subactor.repository-change-lease-store/v1"
SHA = re.compile(r"^[0-9a-f]{40,64}$")
DIGEST = re.compile(r"^[0-9a-f]{64}$")
REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
TERMINAL_PHASES = {"closed", "cancelled", "expired", "released"}
TRANSITION_FIELDS = {
    "schema", "requestId", "leaseId", "action", "expectedRevision",
    "expectedFencingToken", "expectedPhase", "requestedBy",
    "idempotencyKey", "targetHeadSha", "replacementReceiptRef",
    "authorityRef", "requestedAt",
}
PHASE_BY_ACTION = {
    ("claimed", "heartbeat"): "claimed",
    ("claimed", "begin-edit"): "editing",
    ("editing", "heartbeat"): "editing",
    ("editing", "begin-validation"): "validating",
    ("validating", "heartbeat"): "validating",
    ("validating", "begin-edit"): "editing",
    ("validating", "freeze-publication"): "publication_frozen",
    ("publication_frozen", "heartbeat"): "publication_frozen",
    ("publication_frozen", "dispatch-validation"): "dispatching",
    ("dispatching", "heartbeat"): "dispatching",
    ("dispatching", "approve"): "approved",
    ("approved", "heartbeat"): "approved",
    ("approved", "record-merge"): "merged",
    ("merged", "close"): "closed",
    ("closed", "release"): "released",
    ("cancelled", "release"): "released",
    ("expired", "release"): "released",
}
for _phase in ("claimed", "editing", "validating", "publication_frozen", "dispatching", "approved"):
    PHASE_BY_ACTION[(_phase, "cancel")] = "cancelled"
    PHASE_BY_ACTION[(_phase, "expire")] = "expired"
    PHASE_BY_ACTION[(_phase, "supersede")] = "cancelled"


class ChangeLeaseError(RuntimeError):
    """A lease request is malformed or conflicts with authoritative state."""


def _stamp(value: datetime) -> str:
    if value.tzinfo is None:
        raise ChangeLeaseError("change_lease_time_timezone_required")
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _parse_stamp(value: Any) -> datetime:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError) as failure:
        raise ChangeLeaseError("change_lease_timestamp_invalid") from failure
    if parsed.tzinfo is None:
        raise ChangeLeaseError("change_lease_timestamp_invalid")
    return parsed.astimezone(UTC)


def _text(value: Any, field: str, maximum: int) -> str:
    normalized = str(value or "").strip()
    if not normalized or len(normalized) > maximum:
        raise ChangeLeaseError(f"change_lease_{field}_invalid")
    return normalized


def _hash(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(value, stream, sort_keys=True, separators=(",", ":"))
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temporary.exists():
            temporary.unlink()


class ChangeLeaseStore:
    """Serialize lease ownership and transitions across local agent processes."""

    def __init__(
        self,
        root: Path,
        *,
        ttl_seconds: int = 900,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        if not isinstance(ttl_seconds, int) or not 30 <= ttl_seconds <= 86400:
            raise ChangeLeaseError("change_lease_ttl_invalid")
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.path = self.root / "state.json"
        self.lock_path = self.root / ".lock"
        self.ttl_seconds = ttl_seconds
        self.now = now or (lambda: datetime.now(UTC))

    @staticmethod
    def _empty() -> dict[str, Any]:
        return {
            "schema": STORE_SCHEMA,
            "nextFencingToken": 0,
            "leases": {},
            "active": {},
            "acquisitions": {},
            "requests": {},
        }

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return self._empty()
        try:
            value = json.loads(self.path.read_text("utf-8"))
        except (OSError, json.JSONDecodeError) as failure:
            raise ChangeLeaseError("change_lease_state_invalid") from failure
        if not isinstance(value, dict) or set(value) != set(self._empty()) or value.get("schema") != STORE_SCHEMA:
            raise ChangeLeaseError("change_lease_state_invalid")
        if not all(isinstance(value[field], dict) for field in ("leases", "active", "acquisitions", "requests")):
            raise ChangeLeaseError("change_lease_state_invalid")
        if not isinstance(value["nextFencingToken"], int) or value["nextFencingToken"] < 0:
            raise ChangeLeaseError("change_lease_state_invalid")
        return value

    @contextmanager
    def _locked(self) -> Iterator[dict[str, Any]]:
        descriptor = os.open(self.lock_path, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            os.fchmod(descriptor, 0o600)
            fcntl.flock(descriptor, fcntl.LOCK_EX)
            state = self._read()
            yield state
            _atomic_json(self.path, state)
        finally:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
            os.close(descriptor)

    @staticmethod
    def _resource(repository_ref: str, target_branch: str) -> str:
        return _hash({"repositoryRef": repository_ref, "targetBranch": target_branch})

    @staticmethod
    def _expire(lease: dict[str, Any], state: dict[str, Any], resource: str, now: datetime) -> None:
        if lease["phase"] in TERMINAL_PHASES or _parse_stamp(lease["expiresAt"]) > now:
            return
        lease.update({
            "phase": "expired",
            "leaseRevision": lease["leaseRevision"] + 1,
            "eventSequence": lease["eventSequence"] + 1,
            "heartbeatAt": _stamp(now),
        })
        if state["active"].get(resource) == lease["leaseId"]:
            del state["active"][resource]

    def acquire(
        self,
        *,
        request_id: str,
        repository_ref: str,
        target_branch: str,
        ticket_id: str,
        workstream: str,
        scope_hash: str,
        branch_ref: str,
        worktree_id: str,
        owner_actor: str,
        owner_session: str,
        plan_hash: str,
    ) -> dict[str, Any]:
        request_id = _text(request_id, "request_id", 160)
        repository_ref = _text(repository_ref, "repository_ref", 160)
        target_branch = _text(target_branch, "target_branch", 255)
        values = {
            "ticketId": _text(ticket_id, "ticket_id", 160),
            "workstream": _text(workstream, "workstream", 160),
            "branchRef": _text(branch_ref, "branch_ref", 255),
            "worktreeId": _text(worktree_id, "worktree_id", 255),
            "ownerActor": _text(owner_actor, "owner_actor", 160),
            "ownerSession": _text(owner_session, "owner_session", 255),
        }
        if REPOSITORY.fullmatch(repository_ref) is None:
            raise ChangeLeaseError("change_lease_repository_ref_invalid")
        if DIGEST.fullmatch(scope_hash) is None or DIGEST.fullmatch(plan_hash) is None:
            raise ChangeLeaseError("change_lease_digest_invalid")
        request = {
            "requestId": request_id,
            "repositoryRef": repository_ref,
            "targetBranch": target_branch,
            "scopeHash": scope_hash,
            "planHash": plan_hash,
            **values,
        }
        request_hash = _hash(request)
        resource = self._resource(repository_ref, target_branch)
        now = self.now().astimezone(UTC)
        with self._locked() as state:
            previous = state["acquisitions"].get(request_id)
            if previous:
                if previous.get("requestHash") != request_hash:
                    raise ChangeLeaseError("change_lease_acquisition_idempotency_collision")
                return copy.deepcopy(state["leases"][previous["leaseId"]])
            active_id = state["active"].get(resource)
            if active_id:
                active = state["leases"].get(active_id)
                if not isinstance(active, dict):
                    raise ChangeLeaseError("change_lease_state_invalid")
                self._expire(active, state, resource, now)
                if active["phase"] not in TERMINAL_PHASES:
                    raise ChangeLeaseError("change_lease_resource_already_claimed")
            state["nextFencingToken"] += 1
            fencing_token = state["nextFencingToken"]
            lease_id = f"lease-{_hash(request)[:32]}"
            lease = {
                "schema": LEASE_SCHEMA,
                "leaseId": lease_id,
                "repositoryRef": repository_ref,
                "targetBranch": target_branch,
                **values,
                "scopeHash": scope_hash,
                "phase": "claimed",
                "leaseRevision": 1,
                "fencingToken": fencing_token,
                "issuedAt": _stamp(now),
                "expiresAt": _stamp(now + timedelta(seconds=self.ttl_seconds)),
                "heartbeatAt": _stamp(now),
                "headSha": None,
                "pullRequest": None,
                "validatorRunId": None,
                "publicationFrozen": False,
                "planHash": plan_hash,
                "previousReceiptRef": None,
                "eventSequence": 1,
            }
            state["leases"][lease_id] = lease
            state["active"][resource] = lease_id
            state["acquisitions"][request_id] = {"requestHash": request_hash, "leaseId": lease_id}
            return copy.deepcopy(lease)

    @staticmethod
    def _receipt(
        request: dict[str, Any], lease: dict[str, Any], *, previous_revision: int,
        phase_before: str, outcome: str, code: str | None, occurred_at: str,
    ) -> dict[str, Any]:
        receipt = {
            "schema": RECEIPT_SCHEMA,
            "requestId": request["requestId"],
            "leaseId": lease["leaseId"],
            "previousRevision": previous_revision,
            "leaseRevision": lease["leaseRevision"],
            "previousFencingToken": lease["fencingToken"],
            "fencingToken": lease["fencingToken"],
            "action": request["action"],
            "outcome": outcome,
            "code": code,
            "phaseBefore": phase_before,
            "phaseAfter": lease["phase"],
            "headSha": lease["headSha"],
            "pullRequest": lease["pullRequest"],
            "receiptRef": "",
            "occurredAt": occurred_at,
        }
        receipt["receiptRef"] = f"receipt://change-lease/{_hash({k: v for k, v in receipt.items() if k != 'receiptRef'})}"
        return receipt

    def transition(self, request: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(request, dict) or set(request) != TRANSITION_FIELDS:
            raise ChangeLeaseError("change_lease_transition_invalid")
        if request.get("schema") != TRANSITION_SCHEMA:
            raise ChangeLeaseError("change_lease_transition_schema_invalid")
        for field, maximum in (
            ("requestId", 160), ("leaseId", 160), ("requestedBy", 160),
            ("idempotencyKey", 255), ("authorityRef", 512),
        ):
            _text(request.get(field), field, maximum)
        if request.get("targetHeadSha") is not None and SHA.fullmatch(str(request["targetHeadSha"])) is None:
            raise ChangeLeaseError("change_lease_target_head_invalid")
        _parse_stamp(request.get("requestedAt"))
        request_hash = _hash(request)
        now = self.now().astimezone(UTC)
        occurred_at = _stamp(now)
        with self._locked() as state:
            replay = state["requests"].get(request["idempotencyKey"])
            if replay:
                if replay.get("requestHash") != request_hash:
                    raise ChangeLeaseError("change_lease_transition_idempotency_collision")
                return {**copy.deepcopy(replay["receipt"]), "outcome": "idempotent"}
            lease = state["leases"].get(request["leaseId"])
            if not isinstance(lease, dict):
                raise ChangeLeaseError("change_lease_not_found")
            resource = self._resource(lease["repositoryRef"], lease["targetBranch"])
            phase_before = lease["phase"]
            previous_revision = lease["leaseRevision"]
            self._expire(lease, state, resource, now)
            code = None
            if phase_before != lease["phase"]:
                code = "change_lease_expired"
            elif request.get("expectedFencingToken") != lease["fencingToken"]:
                code = "change_lease_fencing_token_mismatch"
            elif request.get("expectedRevision") != lease["leaseRevision"]:
                code = "change_lease_revision_mismatch"
            elif request.get("expectedPhase") != lease["phase"]:
                code = "change_lease_phase_mismatch"
            target_phase = PHASE_BY_ACTION.get((lease["phase"], request.get("action")))
            if code is None and target_phase is None:
                code = "change_lease_transition_forbidden"
            target_head = request.get("targetHeadSha")
            if code is None and request["action"] == "freeze-publication" and target_head is None:
                code = "change_lease_freeze_head_required"
            if code is None and lease["headSha"] is not None and target_head not in {None, lease["headSha"]}:
                code = "change_lease_frozen_head_mismatch"
            if code is None and request["action"] in {"dispatch-validation", "approve", "record-merge"} and target_head != lease["headSha"]:
                code = "change_lease_frozen_head_required"
            if code is None and request["action"] == "supersede" and not request.get("replacementReceiptRef"):
                code = "change_lease_replacement_receipt_required"
            if code is None:
                lease["phase"] = target_phase
                lease["leaseRevision"] += 1
                lease["eventSequence"] += 1
                lease["heartbeatAt"] = occurred_at
                if request["action"] == "heartbeat":
                    lease["expiresAt"] = _stamp(now + timedelta(seconds=self.ttl_seconds))
                if request["action"] == "freeze-publication":
                    lease["headSha"] = target_head
                    lease["publicationFrozen"] = True
                if target_phase in TERMINAL_PHASES and state["active"].get(resource) == lease["leaseId"]:
                    del state["active"][resource]
                receipt = self._receipt(
                    request, lease, previous_revision=previous_revision,
                    phase_before=phase_before, outcome="accepted", code=None,
                    occurred_at=occurred_at,
                )
                lease["previousReceiptRef"] = receipt["receiptRef"]
            else:
                receipt = self._receipt(
                    request, lease, previous_revision=previous_revision,
                    phase_before=phase_before, outcome="rejected", code=code,
                    occurred_at=occurred_at,
                )
            state["requests"][request["idempotencyKey"]] = {
                "requestHash": request_hash,
                "receipt": receipt,
            }
            return copy.deepcopy(receipt)

    def lease(self, lease_id: str) -> dict[str, Any]:
        descriptor = os.open(self.lock_path, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            fcntl.flock(descriptor, fcntl.LOCK_SH)
            lease = self._read()["leases"].get(lease_id)
            if not isinstance(lease, dict):
                raise ChangeLeaseError("change_lease_not_found")
            return copy.deepcopy(lease)
        finally:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
            os.close(descriptor)
