import json
import os
import pathlib
import subprocess
import threading
import uuid
from gateway.context import ACTIVE

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
ERROR_STATUS = {"NOT_FOUND": 404, "DENIED": 403, "OUTCOME_UNKNOWN": 504,
                "REGISTRY_ERROR": 502, "REGISTRY_UNAVAILABLE": 503, "BUSY": 503}


def _capacity(name: str) -> int:
    value = int(os.environ.get(name, '2'))
    if not 1 <= value <= 32:
        raise ValueError(f'{name} must be between 1 and 32')
    return value


# Admission belongs at the common subprocess boundary, including registry('call')
# from HTTP federation. Separate control capacity remains available during calls.
_CALL_SLOTS = threading.BoundedSemaphore(_capacity('TASKAND_MAX_CONCURRENT_CALLS'))
_CONTROL_SLOTS = threading.BoundedSemaphore(_capacity('TASKAND_MAX_CONCURRENT_CONTROL'))


def registry(action: str, payload: dict, timeout: int = 900) -> dict:
    """Jedyna droga gateway → procesy: registry/core (URI, status, bindingHash, izolacja env)."""
    slots = _CALL_SLOTS if action == 'call' else _CONTROL_SLOTS
    if not slots.acquire(blocking=False):
        return {"ok": False, "errorType": "BUSY", "error": "Gateway registry capacity exhausted; no process started"}
    try:
        r = subprocess.run(
            ["node", str(REGISTRY_BIN)],
            input=json.dumps({**payload, "action": action}),
            capture_output=True, text=True, timeout=timeout + 5, env=os.environ.copy(),
        )
        result = json.loads(r.stdout)
        if not isinstance(result, dict) or (r.returncode and result.get('ok') is not False):
            return {"ok": False, "errorType": "REGISTRY_ERROR", "error": "Invalid registry result"}
        return result
    except subprocess.TimeoutExpired:
        return {"ok": False, "errorType": "OUTCOME_UNKNOWN", "error": f"registry/{action}: timeout {timeout}s"}
    except ValueError:
        return {"ok": False, "errorType": "REGISTRY_ERROR", "error": f"registry/{action}: niepoprawna odpowiedź"}
    except OSError:
        return {"ok": False, "errorType": "REGISTRY_UNAVAILABLE", "error": "Registry process could not start"}
    finally:
        slots.release()


def call_process(uri: str, data: dict, timeout: int = 900) -> dict:
    context = ACTIVE.get()
    node = 'call:' + str(uuid.uuid4())
    if context:
        context['store'].event(context['owner'], context['requestId'], node, 'CALLING', uri)
        if uri == 'proc://taskand.dev/planner/plan/v1':
            refs = list(dict.fromkeys([*context.get('refs', []), *data.get('contextRefs', [])]))
            objects = [context['store'].get(context['owner'], ref) for ref in refs]
            data = {**data, '_context': {'promptRef': context['promptRef'],
                    'objects': [{'urn': obj['urn'], 'kind': obj['kind'], 'digest': obj['digest']} for obj in objects]}}
    result = registry('call', {'uri': uri, 'input': data, 'timeout_ms': timeout * 1000}, timeout)
    if context:
        context['store'].event(context['owner'], context['requestId'], node,
                               'FAILED' if result.get('ok') is False else 'RETURNED', uri)
    return result


def status_for(result: dict) -> int:
    return ERROR_STATUS.get(result.get("errorType"), 502 if result.get('ok') is False else 200)
