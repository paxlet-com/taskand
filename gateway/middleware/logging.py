import json
import time
import sys
import pathlib

BASE = pathlib.Path("/taskand") if pathlib.Path("/taskand/log").exists() else pathlib.Path(__file__).resolve().parent.parent.parent
LOG_DIR = BASE / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)
EVENT_LOG = LOG_DIR / "events.jsonl"

def log_event(event_type: str, payload: dict) -> None:
    try:
        rec = {
            "type": event_type,
            "ts": time.time(),
            "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "payload": payload
        }
        with open(EVENT_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception as e:
        sys.stderr.write(f"Log error: {e}\n")
