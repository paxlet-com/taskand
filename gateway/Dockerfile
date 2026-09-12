# taskand · Uniwersalna Bramka REST API dla zadań, logów, historii i Digital Twin
FROM python:3.13-alpine

RUN apk add --no-cache bash docker-cli git nodejs

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

def resolve_proc_file(uri):
    # 1. Root proc-catalog.json
    root_cat = os.path.join(BASE_DIR, "proc-catalog.json")
    if os.path.exists(root_cat):
        try:
            with open(root_cat, "r", encoding="utf-8") as f:
                cat = json.load(f)
                for b in cat.get("bindings", []):
                    if b.get("uri") == uri:
                        return os.path.join(BASE_DIR, b.get("path"), "bin.mjs")
        except Exception:
            pass
    # 2. Packages/*/proc-catalog.json
    pkgs_dir = os.path.join(BASE_DIR, "packages")
    if os.path.exists(pkgs_dir):
        for pkg in sorted(os.listdir(pkgs_dir)):
            pkg_cat = os.path.join(pkgs_dir, pkg, "proc-catalog.json")
            if os.path.exists(pkg_cat):
                try:
                    with open(pkg_cat, "r", encoding="utf-8") as f:
                        cat = json.load(f)
                        for b in cat.get("bindings", []):
                            if b.get("uri") == uri:
                                return os.path.join(pkgs_dir, pkg, b.get("path"), "bin.mjs")
                except Exception:
                    pass
    return None

def execute_proc(uri, input_data):
    bin_path = resolve_proc_file(uri)
    if not bin_path or not os.path.exists(bin_path):
        return {
            "ok": False,
            "error": f"Nie znaleziono procesu dla URI: {uri}",
            "exit_code": 404
        }
    cmd = ["node", bin_path]
    try:
        raw_in = json.dumps(input_data)
        res = subprocess.run(cmd, input=raw_in, text=True, capture_output=True, timeout=30)
        parsed_out = None
        try:
            parsed_out = json.loads(res.stdout.strip())
        except Exception:
            parsed_out = res.stdout.strip()
        return {
            "ok": res.returncode == 0,
            "uri": uri,
            "exit_code": res.returncode,
            "output": parsed_out,
            "stderr": res.stderr.strip()
        }
    except Exception as e:
        return {"ok": False, "uri": uri, "error": str(e), "exit_code": 500}

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
        elif path in ["/federation", "/api/federation"]:
            registries = {}
            pkgs_dir = os.path.join(BASE_DIR, "packages")
            if os.path.exists(pkgs_dir):
                for pkg in sorted(os.listdir(pkgs_dir)):
                    cat_p = os.path.join(pkgs_dir, pkg, "proc-catalog.json")
                    if os.path.exists(cat_p):
                        try:
                            with open(cat_p, "r", encoding="utf-8") as f:
                                registries[pkg] = json.load(f).get("bindings", [])
                        except Exception:
                            pass
            self.send_json(200, {
                "ok": True,
                "standard": "taskand-v0.20-federation",
                "total_registries": len(registries),
                "registries": registries
            })
        elif path in ["/doctor", "/api/doctor"]:
            diag = execute_proc("proc://taskand.dev/doctor/diagnose/v1", {})
            self.send_json(200 if diag.get("ok") else 500, diag)
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
        elif path in ["/proc", "/api/proc", "/api/proc/call"]:
            uri = payload.get("uri") or payload.get("taskand", {}).get("uri")
            data = payload.get("data") if "data" in payload else payload.get("input", payload)
            if not uri:
                self.send_json(400, {"ok": False, "error": "Brak wymaganego pola 'uri'"})
                return
            result = execute_proc(uri, data)
            status_code = 200 if result.get("ok") else (422 if result.get("exit_code") == 2 else 500)
            self.send_json(status_code, result)
        elif path in ["/chat", "/api/chat"]:
            msg = payload.get("message") or payload.get("text") or payload.get("prompt")
            conv_id = payload.get("conversationId") or "conv-web"
            if not msg:
                self.send_json(400, {"ok": False, "error": "Brak treści wiadomości ('message')"})
                return
            chat_input = {"message": msg, "conversationId": conv_id}
            result = execute_proc("proc://taskand.dev/chat/message/v1", chat_input)
            conv_dir = os.path.join(BASE_DIR, "log")
            os.makedirs(conv_dir, exist_ok=True)
            conv_file = os.path.join(conv_dir, "conversations.jsonl")
            log_entry = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "conversationId": conv_id,
                "user": msg,
                "proc": "proc://taskand.dev/chat/message/v1",
                "result": result.get("output") if result.get("ok") else result.get("error")
            }
            try:
                with open(conv_file, "a", encoding="utf-8") as cf:
                    cf.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
            except Exception:
                pass
            self.send_json(200 if result.get("ok") else 500, result)
        elif path in ["/voice", "/api/voice"]:
            transcript = payload.get("transcript") or payload.get("spoken")
            if not transcript:
                self.send_json(400, {"ok": False, "error": "Brak transkrypcji ('transcript')"})
                return
            voice_input = {"transcript": transcript}
            result = execute_proc("proc://taskand.dev/chat/voice/v1", voice_input)
            self.send_json(200 if result.get("ok") else 500, result)
        elif path in ["/doctor", "/api/doctor"]:
            diag_in = payload.get("diagnose", {})
            auto_submit = payload.get("autoSubmit", True)
            diag = execute_proc("proc://taskand.dev/doctor/diagnose/v1", diag_in)
            presc = None
            if diag.get("ok") and not diag.get("output", {}).get("healthy", True):
                issues = diag.get("output", {}).get("issues", [])
                presc = execute_proc("proc://taskand.dev/doctor/prescribe/v1", {
                    "issues": issues,
                    "autoSubmit": auto_submit
                })
        elif path in ["/restart", "/api/restart", "/service/restart", "/api/service/restart"]:
            target = payload.get("service") or payload.get("target") or "landing"
            container_map = {
                "landing": "taskand-landing",
                "web": "taskand-landing",
                "taskand-landing": "taskand-landing",
                "8090": "taskand-landing",
                "gateway": "taskand-gateway",
                "nucleus": "taskand-nucleus"
            }
            container = container_map.get(str(target).lower(), target)
            allowed_containers = ["taskand-landing", "taskand-gateway", "taskand-nucleus"]
            if container not in allowed_containers:
                self.send_json(403, {"ok": False, "error": f"Usługa '{container}' niedozwolona do restartu przez API (dozwolone: {allowed_containers})"})
                return

            print(f"[gateway] Żądanie restartu kontenera: {container}...", flush=True)
            res = subprocess.run(["docker", "restart", container], capture_output=True, text=True, timeout=20)
            if res.returncode != 0:
                self.send_json(500, {"ok": False, "error": f"Błąd restartu: {res.stderr.strip()}"})
                return

            time.sleep(1)
            health_ok = True
            error_detail = ""
            if container == "taskand-landing":
                diag = execute_proc("proc://taskand.dev/doctor/diagnose/v1", {"timeoutMs": 3000})
                web_check = next((c for c in diag.get("output", {}).get("checks", []) if c.get("target") == "web-landing"), None)
                if not web_check or not web_check.get("ok"):
                    health_ok = False
                    error_detail = "Usługa WWW nie odpowiada po restarcie!"
                    rollback_id = payload.get("rollbackSnapId")
                    if rollback_id:
                        subprocess.run(["python3", "/taskand/scripts/history.py", "rollback", rollback_id], capture_output=True, text=True)
                        error_detail += f" Wykonano automatyczny rollback do {rollback_id}."

            self.send_json(200 if health_ok else 502, {
                "ok": health_ok,
                "container": container,
                "restarted": True,
                "healthCheck": "PASS" if health_ok else "FAIL",
                "error": error_detail if not health_ok else None,
                "message": f"Kontener {container} zrestartowany pomyślnie i zweryfikowany przez taskand-doctor" if health_ok else error_detail
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
