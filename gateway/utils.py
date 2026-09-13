import json
import os
import pathlib
import subprocess

BASE = pathlib.Path("/taskand") if pathlib.Path("/taskand/generated").exists() else pathlib.Path(__file__).resolve().parent.parent
GENERATED = BASE / "generated"
REGISTRY_BIN = GENERATED / "registry" / "core" / "taskand.dev" / "v1" / "bin.mjs"
(BASE / "log").mkdir(parents=True, exist_ok=True)

# .env ładowany do środowiska gateway; registry/core przekazuje procesom tylko zmienne z ich proc.yaml (env: [...])
env_path = BASE / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

LLM_KEY = os.environ.get("TASKAND_LLM_API_KEY", "")
LLM_MODEL = os.environ.get("TASKAND_LLM_MODEL", "glm-5.3")

# Kody HTTP dla błędów rejestru
ERROR_STATUS = {"NOT_FOUND": 404, "DENIED": 403, "OUTCOME_UNKNOWN": 504, "REGISTRY_ERROR": 502}


def registry(action: str, payload: dict, timeout: int = 900) -> dict:
    """Jedyna droga gateway → procesy: registry/core (URI, status, bindingHash, izolacja env)."""
    try:
        r = subprocess.run(
            ["node", str(REGISTRY_BIN)],
            input=json.dumps({"action": action, **payload}),
            capture_output=True, text=True, timeout=timeout + 5, env=os.environ.copy(),
        )
        return json.loads(r.stdout)
    except subprocess.TimeoutExpired:
        return {"ok": False, "errorType": "OUTCOME_UNKNOWN", "error": f"registry/{action}: timeout {timeout}s"}
    except ValueError:
        return {"ok": False, "errorType": "REGISTRY_ERROR", "error": f"registry/{action}: niepoprawna odpowiedź"}


def call_process(uri: str, data: dict, timeout: int = 900) -> dict:
    return registry("call", {"uri": uri, "input": data, "timeout_ms": timeout * 1000}, timeout)


def status_for(result: dict) -> int:
    return ERROR_STATUS.get(result.get("errorType"), 200)
