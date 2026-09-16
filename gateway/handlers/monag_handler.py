import json
import os
import subprocess
import shutil
from pathlib import Path

MONAG_SRC = Path(os.environ.get("MONAG_SRC", "/home/tom/github/semcod/monag/src"))
WORKSPACE_ROOT = Path(os.environ.get("MONAG_WORKSPACE_ROOT", "/home/tom/github"))

def _run_monag_json(subcommand: str, extra_args=None) -> dict:
    if not MONAG_SRC.exists():
        return {"ok": False, "error": f"MONAG_SRC not found at {MONAG_SRC}"}
    
    env = {**os.environ, "PYTHONPATH": str(MONAG_SRC)}
    args = [
        "python3", "-m", "monag",
        "--root", str(WORKSPACE_ROOT),
        "--json",
        subcommand
    ]
    if extra_args:
        args.extend(extra_args)
    
    try:
        proc = subprocess.run(
            args,
            env=env,
            capture_output=True,
            text=True,
            timeout=25
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return {"ok": True, "data": json.loads(proc.stdout)}
        else:
            return {
                "ok": False,
                "exit": proc.returncode,
                "stderr": proc.stderr.strip() or "No output from monag"
            }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"monag {subcommand} timed out"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def handle_monag_status(request_handler, body: dict) -> None:
    res = _run_monag_json("status")
    code = 200 if res.get("ok") else 500
    request_handler._send(code, res)

def handle_monag_resume(request_handler, body: dict) -> None:
    res = _run_monag_json("resume")
    code = 200 if res.get("ok") else 500
    request_handler._send(code, res)

def handle_notify(request_handler, body: dict) -> None:
    """Desktop popup (notify-send) + Web notification payload."""
    title = body.get("title", "Taskand Alert")
    msg = body.get("message", "Powiadomienie z systemu Taskand")
    urgency = body.get("urgency", "normal") # low, normal, critical

    desktop_sent = False
    notify_send = shutil.which("notify-send")
    if notify_send:
        try:
            subprocess.run([
                notify_send,
                "-u", urgency,
                "-a", "Taskand",
                title,
                msg
            ], timeout=5)
            desktop_sent = True
        except Exception:
            desktop_sent = False

    request_handler._send(200, {
        "ok": True,
        "desktopNotificationSent": desktop_sent,
        "notification": {
            "title": title,
            "message": msg,
            "urgency": urgency
        }
    })
