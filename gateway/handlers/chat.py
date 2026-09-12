import os
import json
import subprocess
from gateway.utils import GENERATED, LLM_KEY, LLM_MODEL, LLM_ENDPOINT, find_proc_bin
from gateway.middleware.logging import log_event

def llm_env() -> dict:
    env = os.environ.copy()
    if LLM_KEY:
        env.update(TASKAND_LLM_API_KEY=LLM_KEY, TASKAND_LLM_MODEL=LLM_MODEL, TASKAND_LLM_ENDPOINT=LLM_ENDPOINT)
    return env


def handle_chat(request_handler, body: dict) -> None:
    msg = body.get("message", "").strip()
    org = body.get("organism", "").strip().lower()

    log_event("chat.message", {"message": msg, "organism": org})

    # 1. Explicit organism routing
    if org in ["dev", "developer"]:
        binpath = GENERATED / "dev" / "chat" / "taskand.dev" / "v1" / "bin.mjs"
        if not binpath.exists():
            binpath = GENERATED / "developer" / "spawn" / "taskand.dev" / "v1" / "bin.mjs"
        env = os.environ.copy()
        if LLM_KEY:
            env["TASKAND_LLM_API_KEY"] = LLM_KEY
            env["TASKAND_LLM_MODEL"] = LLM_MODEL
        r = subprocess.run(
            ["node", str(binpath)],
            input=json.dumps({"message": msg}),
            capture_output=True,
            text=True,
            timeout=900,
            env=env
        )
        try:
            res = json.loads(r.stdout)
            reply = res.get("reply", r.stdout)
        except Exception:
            reply = r.stdout
        request_handler._send(200, {"ok": r.returncode == 0, "organism": "developer", "reply": reply})
        return

    if org in ["doc", "doctor"]:
        binpath = GENERATED / "doctor" / "diagnose" / "taskand.dev" / "v1" / "bin.mjs"
        r = subprocess.run(["node", str(binpath)], input=json.dumps({}), capture_output=True, text=True)
        diag = json.loads(r.stdout) if r.returncode == 0 else {}
        reply = f"[doctor] Diagnoza systemu taskand v2.2: zdrowy={diag.get('healthy')}. Kontrole: {', '.join(diag.get('details', []))}"
        request_handler._send(200, {"ok": True, "organism": "doctor", "reply": reply})
        return

    if org in ["sec", "vault"]:
        binpath = GENERATED / "vault" / "secrets" / "taskand.dev" / "v1" / "bin.mjs"
        r = subprocess.run(["node", str(binpath)], input=json.dumps({"action": "status"}), capture_output=True, text=True)
        v = json.loads(r.stdout) if r.returncode == 0 else {}
        reply = f"[vault] Stan sejfu: {v.get('status')} ({v.get('cipher')}). Liczba zarządzanych poświadczeń: {v.get('secrets_count')}."
        request_handler._send(200, {"ok": True, "organism": "vault", "reply": reply})
        return

    if org in ["file", "file-ops"]:
        binpath = GENERATED / "file" / "ops" / "taskand.dev" / "v1" / "bin.mjs"
        r = subprocess.run(["node", str(binpath)], input=json.dumps({"op": "list"}), capture_output=True, text=True)
        f_res = json.loads(r.stdout) if r.returncode == 0 else {}
        reply = f"[file-ops] Pliki na węźle {f_res.get('device')}: {', '.join(f_res.get('files', []))}"
        request_handler._send(200, {"ok": True, "organism": "file-ops", "reply": reply})
        return

    if org in ["hw", "hw-monitor"]:
        binpath = GENERATED / "hw" / "monitor" / "taskand.dev" / "v1" / "bin.mjs"
        r = subprocess.run(["node", str(binpath)], input=json.dumps({}), capture_output=True, text=True)
        h_res = json.loads(r.stdout) if r.returncode == 0 else {}
        reply = f"[hw-monitor] CPU: {h_res.get('cpu_usage_pct')}% ({h_res.get('cpu_temp')}°C), Dysk wolny: {h_res.get('disk_free_gb')}GB, GPIO: {h_res.get('gpio_pins')}"
        request_handler._send(200, {"ok": True, "organism": "hw-monitor", "reply": reply})
        return

    if org in ["browser"]:
        binpath = GENERATED / "browser" / "session" / "taskand.dev" / "v1" / "bin.mjs"
        r = subprocess.run(["node", str(binpath)], input=json.dumps({"action": "open", "url": msg}), capture_output=True, text=True)
        b = json.loads(r.stdout) if r.returncode == 0 else {}
        reply = f"[browser] Sesja noVNC: {b.get('novnc_url')}. Akcja: {b.get('action')} -> {b.get('session')}"
        request_handler._send(200, {"ok": True, "organism": "browser", "reply": reply})
        return

    # 2. Organizmy dynamiczne (np. admin): interfejs <org>/chat, a bez niego dev/act z kontekstem organizmu
    if org:
        binpath = find_proc_bin(f"proc://taskand.dev/{org}/chat/v1")
        payload = {"message": msg, "prompt": msg}
        if not binpath:
            binpath = find_proc_bin("proc://taskand.dev/dev/act/v1")
            payload = {"message": msg, "organism": org}
        r = subprocess.run(["node", str(binpath)], input=json.dumps(payload), capture_output=True, text=True, timeout=600, env=llm_env())
        try:
            reply = json.loads(r.stdout).get("reply", r.stdout)
        except ValueError:
            reply = r.stdout or r.stderr
        request_handler._send(200, {"ok": r.returncode == 0, "organism": org, "reply": reply})
        return

    # 2. Generic chat keyword matching (when org not specified)
    if "sprawdź" in msg or "sprawdz" in msg:
        binpath = GENERATED / "doctor" / "diagnose" / "taskand.dev" / "v1" / "bin.mjs"
        r = subprocess.run(["node", str(binpath)], input=json.dumps({}), capture_output=True, text=True)
        diag = json.loads(r.stdout) if r.returncode == 0 else {}
        reply = f"[doctor] Diagnoza systemu taskand v2.2: zdrowy={diag.get('healthy')}."
        request_handler._send(200, {"ok": True, "organism": "doctor", "reply": reply})
        return

    if "zbuduj" in msg or "monitoring" in msg or "stwórz" in msg or "stworz" in msg:
        binpath = GENERATED / "dev" / "chat" / "taskand.dev" / "v1" / "bin.mjs"
        env = os.environ.copy()
        if LLM_KEY:
            env["TASKAND_LLM_API_KEY"] = LLM_KEY
            env["TASKAND_LLM_MODEL"] = LLM_MODEL
        r = subprocess.run(["node", str(binpath)], input=json.dumps({"message": msg}), capture_output=True, text=True, timeout=900, env=env)
        try:
            res = json.loads(r.stdout)
            reply = res.get("reply", r.stdout)
        except Exception:
            reply = r.stdout
        request_handler._send(200, {"ok": r.returncode == 0, "organism": "developer", "reply": reply})
        return

    # Default: chat/message
    binpath = GENERATED / "chat" / "message" / "taskand.dev" / "v1" / "bin.mjs"
    r = subprocess.run(
        ["node", str(binpath)],
        input=json.dumps({"message": msg}),
        capture_output=True,
        text=True,
        timeout=10
    )
    try:
        out = json.loads(r.stdout)
        reply = out.get("reply", r.stdout)
    except Exception:
        reply = r.stdout
    request_handler._send(200, {"ok": r.returncode == 0, "reply": reply})
