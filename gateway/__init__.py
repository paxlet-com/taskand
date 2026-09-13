import os
import sys
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from gateway.router import dispatch
from gateway.middleware.cors import add_cors_headers
from gateway.auth import bind_address, is_loopback_bind

class GatewayHTTPHandler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict) -> None:
        b = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        add_cors_headers(self)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        add_cors_headers(self)
        self.end_headers()

    def do_GET(self) -> None:
        dispatch("GET", self.path, self, {})

    def do_POST(self) -> None:
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n) if n > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            body = {}
        dispatch("POST", self.path, self, body)

    def log_message(self, format, *args):
        # Silence default stderr spam during normal testing
        if os.environ.get("TASKAND_DEBUG"):
            super().log_message(format, *args)

def main() -> None:
    port = int(os.environ.get("PORT", 8077))
    bind = bind_address()
    print(f"Taskand Gateway listening on {bind}:{port}")
    if not is_loopback_bind():
        print("UWAGA: bind poza loopback — domyślne tokeny z grants.yaml są odrzucane; ustaw własne tokeny.")
    server = ThreadingHTTPServer((bind, port), GatewayHTTPHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGateway stopped.")
