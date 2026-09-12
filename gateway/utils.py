import os
import pathlib
import json
import hashlib

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

def proc_hash(binpath: pathlib.Path) -> str:
    """bindingHash procesu: wszystkie moduły .mjs w katalogu procesu (bez test.mjs).
    Ten sam algorytm co generated/_lib/catalog.mjs:procHash."""
    h = hashlib.sha256()
    for name in sorted(f.name for f in binpath.parent.iterdir() if f.suffix == ".mjs" and f.name != "test.mjs"):
        h.update(name.encode() + b"\0")
        h.update((binpath.parent / name).read_bytes())
        h.update(b"\0")
    return "sha256:" + h.hexdigest()


def find_proc_bin(uri: str):
    """URI → wpis w proc-catalog.json → ścieżka z weryfikacją bindingHash. Brak heurystyk."""
    try:
        catalog = json.loads((BASE / "proc-catalog.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    entry = next((p for p in catalog.get("processes", []) if p.get("uri") == uri), None)
    if not entry or not entry.get("path"):
        return None
    path = BASE / entry["path"]
    if not path.is_file():
        return None
    if entry.get("bindingHash") and proc_hash(path) != entry["bindingHash"]:
        return None
    return path
