import os
import sys
import json
import time
import urllib.request
import urllib.error
import subprocess
import pathlib
from http.server import BaseHTTPRequestHandler, HTTPServer

# Path resolution for generated processes and logs
if pathlib.Path("/taskand/generated").exists():
    GENERATED = pathlib.Path("/taskand/generated")
    LOG_DIR = pathlib.Path("/taskand/log")
else:
    BASE = pathlib.Path(__file__).parent.resolve()
    GENERATED = BASE / "generated"
    LOG_DIR = BASE / "log"

LOG_DIR.mkdir(parents=True, exist_ok=True)
EVENT_LOG = LOG_DIR / "events.jsonl"

# Auto-load .env if available
env_path = pathlib.Path(__file__).parent / ".env"
if env_path.exists():
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip()
    except Exception:
        pass

LLM_KEY = os.environ.get("TASKAND_LLM_API_KEY", "")
LLM_ENDPOINT = os.environ.get("TASKAND_LLM_ENDPOINT", "https://api.z.ai/api/paas/v4/chat/completions")
LLM_MODEL = os.environ.get("TASKAND_LLM_MODEL", "glm-5.3")

def log_event(event_type, payload):
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

def call_glm_llm(prompt, system_prompt="Jesteś autonomicznym organizmem taskand v2.0."):
    if not LLM_KEY:
        return None
    try:
        headers = {
            "Authorization": f"Bearer {LLM_KEY}",
            "Content-Type": "application/json"
        }
        req_data = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "stream": False
        }
        req = urllib.request.Request(
            LLM_ENDPOINT,
            data=json.dumps(req_data).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except Exception as err:
        sys.stderr.write(f"LLM API call error: {err}\n")
        return None

def find_proc_bin(uri):
    # URI format: proc://taskand.dev/<path>/<version>
    # e.g. proc://taskand.dev/chat/message/v1
    clean = uri.replace("proc://taskand.dev/", "").strip("/")
    parts = clean.split("/")
    if len(parts) >= 2:
        version = parts[-1]
        proc_path = "/".join(parts[:-1])
        candidate1 = GENERATED / proc_path / "taskand.dev" / version / "bin.mjs"
        if candidate1.exists():
            return candidate1
        candidate2 = GENERATED / parts[0] / parts[1] / "taskand.dev" / version / "bin.mjs"
        if candidate2.exists():
            return candidate2
    for p in GENERATED.rglob("bin.mjs"):
        rel = str(p.relative_to(GENERATED))
        if all(part in rel for part in parts):
            return p
    return None

class H(BaseHTTPRequestHandler):
    def _send(self, code, body):
        b = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/healthz":
            procs = list(GENERATED.rglob("bin.mjs"))
            self._send(200, {
                "ok": True,
                "version": "2.0.0",
                "processes": len(procs),
                "llm_configured": bool(LLM_KEY),
                "model": LLM_MODEL if LLM_KEY else None
            })
        elif self.path == "/api/federation":
            procs = []
            for p in sorted(GENERATED.rglob("bin.mjs")):
                rel = p.parent.relative_to(GENERATED)
                parts = str(rel).split("/")
                if len(parts) >= 3 and parts[-2] == "taskand.dev":
                    uri = f"proc://taskand.dev/{parts[0]}/{parts[1]}/{parts[-1]}"
                else:
                    uri = f"proc://taskand.dev/{rel}"
                procs.append(uri)
            self._send(200, {"ok": True, "total": len(procs), "processes": procs})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n) if n > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            body = {}

        if self.path == "/api/proc/call":
            uri = body.get("uri", "")
            data = body.get("data", {})
            binpath = find_proc_bin(uri)
            if not binpath or not binpath.exists():
                self._send(404, {"ok": False, "error": f"process URI not found: {uri}"})
                return

            try:
                r = subprocess.run(
                    ["node", str(binpath)],
                    input=json.dumps(data),
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                log_event("proc.call", {"uri": uri, "exit": r.returncode})
                try:
                    res = json.loads(r.stdout.strip())
                except Exception:
                    res = r.stdout.strip()
                self._send(200, {
                    "ok": r.returncode == 0,
                    "uri": uri,
                    "exit": r.returncode,
                    "result": res,
                    "stderr": r.stderr.strip()
                })
            except Exception as e:
                self._send(500, {"ok": False, "error": str(e)})

        elif self.path == "/api/chat":
            msg = body.get("message", "").strip()
            org = body.get("organism", "").strip().lower()

            log_event("chat.message", {"message": msg, "organism": org})

            # 1. Routing to doctor
            if org in ["doc", "doctor"] or "sprawdź" in msg or "sprawdz" in msg:
                binpath = GENERATED / "doctor" / "diagnose" / "taskand.dev" / "v1" / "bin.mjs"
                r = subprocess.run(["node", str(binpath)], input=json.dumps({}), capture_output=True, text=True)
                diag = json.loads(r.stdout) if r.returncode == 0 else {}
                reply = f"[doctor] Diagnoza systemu taskand v2.0: zdrowy={diag.get('healthy')}. Kontrole: {', '.join(diag.get('details', []))}"
                self._send(200, {"ok": True, "organism": "doctor", "reply": reply})
                return

            # 2. Routing to vault
            if org in ["sec", "vault"] or "sejf" in msg or "token" in msg or "klucz" in msg:
                binpath = GENERATED / "vault" / "secrets" / "taskand.dev" / "v1" / "bin.mjs"
                r = subprocess.run(["node", str(binpath)], input=json.dumps({"action": "status"}), capture_output=True, text=True)
                v = json.loads(r.stdout) if r.returncode == 0 else {}
                reply = f"[vault] Stan sejfu: {v.get('status')} ({v.get('cipher')}). Liczba zarządzanych poświadczeń: {v.get('secrets_count')}."
                self._send(200, {"ok": True, "organism": "vault", "reply": reply})
                return

            # 3. Routing to browser
            if org in ["browser"] or "otwórz" in msg or "przeglądark" in msg:
                binpath = GENERATED / "browser" / "session" / "taskand.dev" / "v1" / "bin.mjs"
                r = subprocess.run(["node", str(binpath)], input=json.dumps({"action": "open", "url": msg}), capture_output=True, text=True)
                b = json.loads(r.stdout) if r.returncode == 0 else {}
                reply = f"[browser] Sesja noVNC: {b.get('novnc_url')}. Akcja: {b.get('action')} -> {b.get('session')}"
                self._send(200, {"ok": True, "organism": "browser", "reply": reply})
                return

            # 4. Routing to file-ops
            if org in ["file", "file-ops"] or "plik" in msg or "katalog" in msg:
                binpath = GENERATED / "file" / "ops" / "taskand.dev" / "v1" / "bin.mjs"
                r = subprocess.run(["node", str(binpath)], input=json.dumps({"op": "list"}), capture_output=True, text=True)
                f_res = json.loads(r.stdout) if r.returncode == 0 else {}
                reply = f"[file-ops] Pliki na węźle {f_res.get('device')}: {', '.join(f_res.get('files', []))}"
                self._send(200, {"ok": True, "organism": "file-ops", "reply": reply})
                return

            # 5. Routing to hw-monitor
            if org in ["hw", "hw-monitor"] or "sprzęt" in msg or "temperatura" in msg:
                binpath = GENERATED / "hw" / "monitor" / "taskand.dev" / "v1" / "bin.mjs"
                r = subprocess.run(["node", str(binpath)], input=json.dumps({}), capture_output=True, text=True)
                h_res = json.loads(r.stdout) if r.returncode == 0 else {}
                reply = f"[hw-monitor] CPU: {h_res.get('cpu_usage_pct')}% ({h_res.get('cpu_temp')}°C), Dysk wolny: {h_res.get('disk_free_gb')}GB, GPIO: {h_res.get('gpio_pins')}"
                self._send(200, {"ok": True, "organism": "hw-monitor", "reply": reply})
                return

            # 6. Routing to developer
            if org in ["dev", "developer"] or "stwórz" in msg or "stworz" in msg:
                if LLM_KEY:
                    llm_reply = call_glm_llm(msg, "Jesteś organizmem deweloperskim taskand v2.0 (LLM GLM-5.3). Odpowiedz krótko i konstruktywnie z planem generowania kodu procesu.")
                    if llm_reply:
                        self._send(200, {"ok": True, "organism": "developer", "reply": f"[developer/LLM] {llm_reply}"})
                        return
                binpath = GENERATED / "developer" / "spawn" / "taskand.dev" / "v1" / "bin.mjs"
                r = subprocess.run(["node", str(binpath)], input=json.dumps({"organism": msg}), capture_output=True, text=True)
                d = json.loads(r.stdout) if r.returncode == 0 else {}
                reply = f"[developer] Przyjąłem zlecenie ewolucji: {msg}. Tryb: {d.get('mode')} (LLM: {d.get('llm') or 'fallback template'})."
                self._send(200, {"ok": True, "organism": "developer", "reply": reply})
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
            self._send(200, {"ok": r.returncode == 0, "reply": reply})
        else:
            self._send(404, {"error": "endpoint not found"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8077))
    print(f"Taskand v2.0 Gateway listening on 0.0.0.0:{port} (processes: {len(list(GENERATED.rglob('bin.mjs')))})")
    server = HTTPServer(("0.0.0.0", port), H)
    server.serve_forever()
