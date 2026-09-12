import json
import subprocess
import os
from gateway.utils import GENERATED, LLM_KEY, LLM_MODEL

def handle_planner(request_handler, body: dict) -> None:
    binpath = GENERATED / "planner" / "plan" / "taskand.dev" / "v1" / "bin.mjs"
    if not binpath.exists():
        request_handler._send(404, {"ok": False, "error": "Planner process not found"})
        return

    env = os.environ.copy()
    if LLM_KEY:
        env["TASKAND_LLM_API_KEY"] = LLM_KEY
        env["TASKAND_LLM_MODEL"] = LLM_MODEL

    r = subprocess.run(
        ["node", str(binpath)],
        input=json.dumps(body or {}),
        capture_output=True,
        text=True,
        timeout=30,
        env=env
    )
    try:
        plan_res = json.loads(r.stdout.strip())
    except Exception:
        plan_res = {"raw": r.stdout.strip()}
    request_handler._send(200, {"ok": r.returncode == 0, "plan": plan_res})
