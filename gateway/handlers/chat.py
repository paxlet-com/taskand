from gateway.auth import require_grant
from gateway.middleware.logging import log_event
from gateway.utils import call_process, status_for

DEV_CHAT = "proc://taskand.dev/dev/chat/v1"
LLM_URI = 'proc://taskand.dev/dev/llm/v1'


def handle_conversation(handler, body):
    """A conversation uses a fixed LLM process; it never dispatches tools."""
    if not require_grant(handler, LLM_URI, 'call'):
        return
    messages = body.get('messages')
    if (not isinstance(messages, list) or not 1 <= len(messages) <= 24
            or any(not isinstance(m, dict) or set(m) != {'role', 'content'}
                   or m['role'] not in {'user', 'assistant'}
                   or not isinstance(m['content'], str) or not m['content'].strip()
                   or len(m['content']) > 12000 for m in messages)
            or messages[-1]['role'] != 'user'
            or sum(len(m['content']) for m in messages) > 48000):
        handler._send(400, {'ok': False, 'error': 'CONVERSATION_MESSAGES_INVALID'})
        return
    result = call_process(LLM_URI, {'messages': [{'role': 'system', 'content':
        'Odpowiadaj po polsku. To rozmowa i przygotowanie zadań. Nie masz narzędzi '
        'w tym trybie. Nie twierdź, że wykonałeś operacje ani odczytałeś aktualny stan usług.'},
        *messages], 'max_tokens': 2500, 'reasoning_effort': 'low'}, timeout=100)
    if not isinstance(result, dict) or result.get('ok') is not True or not isinstance(result.get('content'), str) or not result['content'].strip():
        handler._send(503, {'ok': False, 'error': 'CONVERSATION_MODEL_UNAVAILABLE'})
        return
    handler._send(200, {'ok': True, 'reply': result['content'], 'mode': 'conversation', 'toolsExecuted': False})


def handle_chat(request_handler, body: dict) -> None:
    """Jedna ścieżka: dev/chat trasuje organizmy i intencje; gateway nie zna organizmów ani LLM."""
    message = str(body.get("message", "")).strip()
    if not message:
        request_handler._send(400, {"ok": False, "error": "Wymagane pole 'message'"})
        return
    user = require_grant(request_handler, DEV_CHAT, "call")
    if not user:
        return
    organism = str(body.get("organism", "")).strip().lower()
    log_event("gateway.chat", {"user": user["name"], "organism": organism})
    result = call_process(DEV_CHAT, {"message": message, "organism": organism})
    response = {
        "ok": result.get("ok", False),
        "organism": result.get("organism", organism),
        "intent": result.get("intent"),
        "reply": result.get("reply") or result.get("error"),
    }
    for key in ("devices", "topology", "networks", "result", "data", "summary", "twinId", "projects"):
        if key in result and result[key] is not None:
            response[key] = result[key]
    request_handler._send(status_for(result), response)
