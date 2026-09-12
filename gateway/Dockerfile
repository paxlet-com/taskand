# taskand · Uniwersalna Bramka REST API dla zadań, logów, historii i Digital Twin
FROM python:3.13-alpine

RUN apk add --no-cache bash docker-cli git

WORKDIR /app

COPY <<'PY' /app/gateway.py
import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = "/taskand"
INBOX_FILE = os.path.join(BASE_DIR, "tasks", "inbox.yaml")
DONE_FILE = os.path.join(BASE_DIR, "tasks", "done.yaml")
LOG_FILE = os.path.join(BASE_DIR, "log", "evolution.log")
HISTORY_FILE = os.path.join(BASE_DIR, "history", "history.yaml")

def parse_yaml_tasks(file_path):
    tasks = []
    if not os.path.exists(file_path):
        return tasks
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Prosty parser bloków zadań YAML
    raw_blocks = re.split(r'\n(?=-\s+id:)', content)
    for block in raw_blocks:
        block = block.strip()
        if not block:
            continue
        task = {}
        # Obsługa formatu jednoliniowego: - id: t123 · typ: xyz · data
        if "·" in block:
            parts = [p.strip() for p in block.lstrip("-").split("·")]
            for p in parts:
                if ":" in p:
                    k, v = p.split(":", 1)
                    task[k.strip()] = v.strip()
                else:
                    task["date"] = p.strip()
            if "id" in task:
                tasks.append(task)
                continue
        # Obsługa formatu wieloliniowego
        for line in block.splitlines():
            line = line.strip().lstrip("-").strip()
            if ":" in line:
                k, v = line.split(":", 1)
                task[k.strip()] = v.strip().strip('"').strip("'")
        if "id" in task:
            tasks.append(task)
    return tasks

class Gateway(BaseHTTPRequestHandler):
    server_version = "taskand-gateway/0.4.2"

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ["/health", "/api/health"]:
            self.send_json(200, {
                "ok": True,
                "version": "0.4.2",
                "service": "taskand-gateway",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            })
        elif path in ["/tasks", "/api/tasks"]:
            inbox = parse_yaml_tasks(INBOX_FILE)
            done = parse_yaml_tasks(DONE_FILE)
            self.send_json(200, {
                "ok": True,
                "inbox": inbox,
                "done": done,
                "total_inbox": len(inbox),
                "total_done": len(done)
            })
        elif path in ["/logs", "/api/logs"]:
            logs = []
            if os.path.exists(LOG_FILE):
                with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
                    logs = f.readlines()[-150:]
            self.send_json(200, {
                "ok": True,
                "logs": [l.rstrip("\r\n") for l in logs]
            })
        elif path in ["/history", "/api/history"]:
            # Uruchom skrypt history.py w trybie json lub zwróć manifesty
            cmd = ["python3", "/taskand/scripts/history.py", "list"]
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.send_json(200, {
                "ok": True,
                "output": res.stdout,
                "done_tasks": parse_yaml_tasks(DONE_FILE)
            })
        elif path in ["/environment", "/api/environment"]:
            env_file = os.path.join(BASE_DIR, "environment.yaml")
            content = ""
            if os.path.exists(env_file):
                with open(env_file, "r", encoding="utf-8") as f:
                    content = f.read()
            self.send_json(200, {"ok": True, "environment": content})
        elif path in ["/conversations", "/api/conversations"]:
            conv_file = os.path.join(BASE_DIR, "log", "conversations.jsonl")
            convs = []
            if os.path.exists(conv_file):
                with open(conv_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            try:
                                convs.append(json.loads(line.strip()))
                            except Exception:
                                pass
            self.send_json(200, {"ok": True, "conversations": convs[-50:]})
        elif path in ["/catalog", "/api/catalog"]:
            cat_file = os.path.join(BASE_DIR, "proc-catalog.json")
            if os.path.exists(cat_file):
                with open(cat_file, "r", encoding="utf-8") as f:
                    self.send_json(200, json.load(f))
            else:
                self.send_json(404, {"ok": False, "error": "Catalog not found"})
        elif path in ["/capsule", "/api/capsule"]:
            cap_file = os.path.join(BASE_DIR, "capsule.yaml")
            content = ""
            if os.path.exists(cap_file):
                with open(cap_file, "r", encoding="utf-8") as f:
                    content = f.read()
            self.send_json(200, {"ok": True, "capsule": content})
        else:
            self.send_json(404, {"ok": False, "error": "Endpoint not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception as e:
            self.send_json(400, {"ok": False, "error": f"Invalid JSON: {e}"})
            return

        if path in ["/tasks", "/api/tasks"]:
            desc = payload.get("z") or payload.get("description") or payload.get("task") or ""
            if not desc:
                self.send_json(400, {"ok": False, "error": "Brak opisu zadania ('z')"})
                return

            task_id = payload.get("id") or f"t{int(time.time())}"
            task_type = payload.get("typ")

            # Automatyczne rozpoznanie intencji jeśli typ niepodany
            if not task_type:
                dl = desc.lower()
                if any(w in dl for w in ["usuń", "skasuj", "wyczyść", "delete", "clean", "remove"]):
                    task_type = "czyszczenie"
                elif any(w in dl for w in ["zmień nazwę", "zmien nazwe", "rename"]):
                    task_type = "github-rename"
                elif any(w in dl for w in ["wypchnij", "push", "sync", "commit"]):
                    task_type = "git-push"
                elif any(w in dl for w in ["obserwuj", "monitor", "watch", "ping"]):
                    task_type = "obserwuj"
                elif "handover" in dl:
                    task_type = "handover"
                else:
                    task_type = "github-projekt"

            os.makedirs(os.path.dirname(INBOX_FILE), exist_ok=True)
            clean_desc = desc.replace("\n", " ").replace("\r", " ").replace('"', '\\"')
            with open(INBOX_FILE, "a", encoding="utf-8") as stream:
                stream.write(f"- id: {task_id}\n  typ: {task_type}\n  z: \"{clean_desc}\"\n")

            self.send_json(201, {
                "ok": True,
                "id": task_id,
                "typ": task_type,
                "z": desc,
                "message": f"Zadanie [{task_id}] dodane pomyślnie do kolejki"
            })
        elif path in ["/twin", "/api/twin"]:
            task_id = payload.get("id") or f"t{int(time.time())}"
            desc = payload.get("z") or payload.get("prompt") or payload.get("task") or "test"
            cmd = ["python3", "/taskand/scripts/digital_twin.py", task_id, desc]
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.send_json(200 if res.returncode == 0 else 422, {
                "ok": res.returncode == 0,
                "output": res.stdout,
                "error": res.stderr
            })
        elif path in ["/rollback", "/api/rollback"]:
            snap_id = payload.get("id")
            if not snap_id:
                self.send_json(400, {"ok": False, "error": "Brak ID migawki"})
                return
            cmd = ["python3", "/taskand/scripts/history.py", "rollback", snap_id]
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.send_json(200 if res.returncode == 0 else 500, {
                "ok": res.returncode == 0,
                "output": res.stdout,
                "error": res.stderr
            })
        else:
            self.send_json(404, {"ok": False, "error": "Endpoint not found"})

    def log_message(self, format, *args):
        print(f"[gateway] {format % args}", flush=True)

print("[gateway] Serwer REST API uruchomiony na porcie 8077 (CORS włączony)...", flush=True)
ThreadingHTTPServer(("0.0.0.0", 8077), Gateway).serve_forever()
PY

EXPOSE 8077
ENTRYPOINT ["python", "/app/gateway.py"]
