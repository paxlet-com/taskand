# taskand · opcjonalna bramka HTTP dla zadań
# POST /tasks z JSON-em: {"id":"t001","typ":"obserwuj","z":"opis zadania"}
FROM python:3.13-alpine

WORKDIR /app

COPY <<'PY' /app/gateway.py
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TASKS = "/taskand/tasks/inbox.yaml"

def yaml_value(value):
    return str(value).replace("\\", "\\\\").replace("\n", " ").replace("\r", " ").replace(r"\u", " ")

class Gateway(BaseHTTPRequestHandler):
    server_version = "taskand-gateway/0.4"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"ok": True, "service": "taskand-gateway"})
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/tasks":
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            task_id = payload.get("id") or "t-http"
            task_type = payload.get("typ") or "obserwuj"
            description = payload.get("z") or "-"
            os.makedirs(os.path.dirname(TASKS), exist_ok=True)
            with open(TASKS, "a", encoding="utf-8") as stream:
                stream.write(
                    f"- id: {yaml_value(task_id)}\n"
                    f"  typ: {yaml_value(task_type)}\n"
                    f"  z: {yaml_value(description)}\n"
                )
            self.send_json(201, {"ok": True, "id": task_id})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": str(error)})

    def log_message(self, format, *args):
        print("[gateway] " + format % args, flush=True)

ThreadingHTTPServer(("0.0.0.0", 8077), Gateway).serve_forever()
PY

RUN mkdir -p /taskand/tasks
EXPOSE 8077
ENTRYPOINT ["python", "/app/gateway.py"]
