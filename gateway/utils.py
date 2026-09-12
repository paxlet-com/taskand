import os
import pathlib
import json

BASE = pathlib.Path("/taskand") if pathlib.Path("/taskand/generated").exists() else pathlib.Path(__file__).resolve().parent.parent
GENERATED = BASE / "generated"
LOG_DIR = BASE / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Load .env if present
env_path = BASE / ".env"
if env_path.exists():
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if k not in os.environ:
                        os.environ[k] = v
    except Exception:
        pass

LLM_KEY = os.environ.get("TASKAND_LLM_API_KEY", "")
LLM_ENDPOINT = os.environ.get("TASKAND_LLM_ENDPOINT", "https://api.z.ai/api/paas/v4/chat/completions")
LLM_MODEL = os.environ.get("TASKAND_LLM_MODEL", "glm-5.3")

def find_proc_bin(uri: str) -> pathlib.Path:
    # 1. Lookup in proc-catalog.json first (source of truth)
    cat_path = BASE / "proc-catalog.json"
    if cat_path.exists():
        try:
            with open(cat_path, "r", encoding="utf-8") as f:
                cat = json.load(f)
                for p in cat.get("processes", []):
                    if p.get("uri") == uri and p.get("path"):
                        full = BASE / p.get("path")
                        if full.exists():
                            return full
        except Exception:
            pass

    # 2. Heuristic resolution
    clean = uri.replace("proc://taskand.dev/", "").strip("/")
    parts = clean.split("/")
    if len(parts) >= 2:
        version = parts[-1]
        proc_path = "/".join(parts[:-1])
        c1 = GENERATED / proc_path / "taskand.dev" / version / "bin.mjs"
        if c1.exists():
            return c1
        c2 = GENERATED / parts[0] / parts[1] / "taskand.dev" / version / "bin.mjs"
        if c2.exists():
            return c2

    for p in GENERATED.rglob("bin.mjs"):
        rel = str(p.relative_to(GENERATED))
        if all(part in rel for part in parts):
            return p
    return None
