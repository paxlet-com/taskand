"""Synthetic observer-normalizer pilot. Never reads real sessions or enables capture.

The fixture twin models event inputs, not a complete machine/browser/IDE.
Native session adapters and human-authorized live collection are not implemented.
"""

import hashlib
import json
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from gateway.auth import require_grant
from gateway.context import default_store

SOURCES = ("taskand", "cli-ide", "browser")
FIXTURES = {
    "taskand": [
        {
            "type": "test.completed",
            "data": {"outcome": "passed", "token": "fixture-secret"},
        },
        {"type": "git.changed", "data": {"count": 2, "path": "/private/project"}},
    ],
    "cli-ide": [
        {
            "kind": "command.exit",
            "program": "pytest",
            "exitCode": 0,
            "command": "pytest --token=fixture-secret",
        },
        {
            "kind": "ide.action",
            "action": "test.run",
            "file": "/private/project/code.py",
        },
    ],
    "browser": [
        {
            "kind": "navigation",
            "url": "https://example.invalid/demo?token=fixture-secret#private",
        },
        {"kind": "click", "element": "demo-run", "value": "fixture-secret"},
    ],
}


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def plan():
    ast = {
        "schema": "taskand.observer-pilot-plan/v1",
        "mode": "FIXTURE_TWIN_ONLY",
        "sources": list(SOURCES),
        "fixtureDigest": digest(FIXTURES),
        "implementationDigest": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "effects": [
            "read-generated-fixtures",
            "normalize-metadata",
            "store-owner-receipt",
        ],
        "forbidden": [
            "read-real-history",
            "enable-observers",
            "remote-call",
            "production-task",
        ],
    }
    # DSL is a deterministic projection of the closed AST, not assembled NL instructions.
    ast["dsl"] = "\n".join(
        [
            "DOCUMENT TASKAND_OBSERVER_PILOT",
            "VERSION 1",
            "MODE REQUEST_ONLY",
            "TWIN FIXTURE_EVENTS",
            "AUTHORITY NONE",
            *[
                "SOURCE " + json.dumps(source) + " ACTION NORMALIZE_METADATA"
                for source in ast["sources"]
            ],
            "ASSERT LIVE_SOURCE_COUNT = 0",
            "NEXT WAIT_FOR_HUMAN_DECISION",
        ]
    )
    return ast


def normalize(source, event):
    if source not in SOURCES or not isinstance(event, dict):
        raise ValueError("OBSERVER_EVENT_UNSUPPORTED")
    kind = event.get("type") if source == "taskand" else event.get("kind")
    data = {}
    if source == "taskand":
        raw = event.get("data")
        if not isinstance(raw, dict):
            raise ValueError("OBSERVER_EVENT_INVALID")
        if kind == "test.completed" and raw.get("outcome") in {"passed", "failed"}:
            data = {"outcome": raw["outcome"]}
        elif (
            kind == "git.changed"
            and type(raw.get("count")) is int
            and 0 <= raw["count"] <= 100000
        ):
            data = {"changedPathsCount": raw["count"]}
    elif source == "cli-ide":
        if (
            kind == "command.exit"
            and event.get("program") in {"pytest", "git", "taskand"}
            and type(event.get("exitCode")) is int
            and -255 <= event["exitCode"] <= 255
        ):
            data = {"program": event["program"], "exitCode": event["exitCode"]}
        elif kind == "ide.action" and event.get("action") in {"test.run", "file.saved"}:
            data = {"action": event["action"]}
    elif kind == "navigation":
        try:
            url = urlsplit(event.get("url", ""))
            # The pilot admits only its synthetic domain; it is not a general observer.
            if (
                url.scheme == "https"
                and url.hostname == "example.invalid"
                and url.username is None
            ):
                data = {"domain": url.hostname}
        except (ValueError, TypeError):
            pass
    elif kind == "click" and event.get("element") == "demo-run":
        data = {"element": "demo-run"}
    if not data:
        raise ValueError("OBSERVER_EVENT_UNSUPPORTED")
    return {
        "schema": "taskand.observation/v1",
        "source": source,
        "type": kind,
        "subject": "synthetic-person",
        "device": "synthetic-workstation",
        "synthetic": True,
        "authority": "NONE",
        "data": data,
    }


def simulate(candidate):
    if candidate != plan():
        raise ValueError("OBSERVER_PLAN_CHANGED")
    results = []
    with tempfile.TemporaryDirectory(
        prefix="taskand-observer-fixture-twin-"
    ) as directory:
        root = Path(directory)
        for source in candidate["sources"]:
            path = root / (source + ".jsonl")
            path.write_text("".join(json.dumps(row) + "\n" for row in FIXTURES[source]))
            rows = [
                normalize(source, json.loads(line))
                for line in path.read_text().splitlines()
            ]
            encoded = json.dumps(rows)
            if any(
                text in encoded
                for text in ("fixture-secret", "/private/", "?token=", "--token=")
            ):
                raise ValueError("OBSERVER_PRIVACY_CHECK_FAILED")
            results.append(
                {
                    "source": source,
                    "status": "SIMULATED",
                    "events": rows,
                    "normalizedCount": len(rows),
                    "liveCollectorVerified": False,
                }
            )
    return {
        "schema": "taskand.observer-pilot-receipt/v1",
        "status": "WAIT_FOR_HUMAN_DECISION",
        "planDigest": digest(candidate),
        "twinKind": "synthetic-event-fixtures",
        "results": results,
        "liveSources": [],
        "observersEnabled": False,
        "productionExecuted": False,
        "authority": "NONE",
        "missingCapabilities": [
            "NATIVE_SESSION_ADAPTERS",
            "SCOPED_CONSENT_CONTROLLER",
            "LIVE_COLLECTION",
            "FEDERATED_SUBJECT_IDENTITY",
        ],
        "nextAction": "Choose exact sources, retention and duration; implement and test missing live adapters before activation.",
    }


def handle_pilot(handler, body):
    user = require_grant(handler, "proc://taskand.dev/planner/plan/v1", "call")
    if not user:
        return
    if body != {"action": "simulate"}:
        handler._send(
            400, {"ok": False, "error": "OBSERVER_FIXTURE_ONLY_REQUEST_REQUIRED"}
        )
        return
    store = default_store()
    candidate = plan()
    with store.connect() as db:
        record = store._put(db, user["name"], "observer_plan", candidate)
    result = simulate(candidate)
    with store.connect() as db:
        receipt = store._put(
            db, user["name"], "observer_receipt", result, [record["urn"]]
        )
    handler._send(
        200,
        {
            "ok": True,
            "planRef": record["urn"],
            "receiptRef": receipt["urn"],
            "plan": candidate,
            "result": result,
        },
    )
