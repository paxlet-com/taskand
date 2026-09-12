from gateway.utils import GENERATED, LLM_KEY, LLM_MODEL

def handle_healthz(request_handler, body: dict) -> None:
    procs = list(GENERATED.rglob("bin.mjs"))
    request_handler._send(200, {
        "ok": True,
        "version": "2.2.0",
        "processes": len(procs),
        "llm_configured": bool(LLM_KEY),
        "model": LLM_MODEL if LLM_KEY else None
    })
