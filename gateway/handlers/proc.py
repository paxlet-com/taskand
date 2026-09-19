from gateway.auth import require_grant
from gateway.middleware.logging import log_event
from gateway.utils import call_process, status_for
from gateway.handlers.mcp_control import URI as MCP_URI, authorize as authorize_mcp


def handle_proc_call(request_handler, body: dict) -> None:
    uri = body.get("uri", "")
    if not uri:
        request_handler._send(400, {"ok": False, "error": "Brak wymaganego pola 'uri'"})
        return
    user = require_grant(request_handler, uri, "call")
    if not user:
        return
    data = body.get("data", {})
    if uri == MCP_URI:
        data = authorize_mcp(request_handler, user, data)
        if data is None:
            return
    result = call_process(uri, data, timeout=40 if uri == MCP_URI else int(body.get("timeout", 60)))
    log_event("gateway.proc.call", {"uri": uri, "user": user["name"], "errorType": result.get("errorType")})
    request_handler._send(status_for(result), {"ok": result.get("ok") is not False, "uri": uri, "user": user["name"], "result": result})
