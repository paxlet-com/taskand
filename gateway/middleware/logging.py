import json
import os
import socket
import sys
import time
import uuid

from gateway.utils import BASE

EVENT_LOG = BASE / "log" / "events.jsonl"
NODE = os.environ.get("TASKAND_NODE", socket.gethostname())


def log_event(event_type: str, payload: dict) -> None:
    """Zdarzenie w formacie CloudEvents 1.0 (append-only), wspólny dziennik z registry/core."""
    rec = {
        "specversion": "1.0",
        "id": str(uuid.uuid4()),
        "source": f"taskand://{NODE}/gateway",
        "type": f"dev.taskand.{event_type}",
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "data": payload,
    }
    try:
        with open(EVENT_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError as e:
        sys.stderr.write(f"Log error: {e}\n")
