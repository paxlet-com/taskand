import json
from gateway.utils import BASE, GENERATED

def handle_federation(request_handler, body: dict) -> None:
    cat_path = BASE / "proc-catalog.json"
    if cat_path.exists():
        try:
            with open(cat_path, "r", encoding="utf-8") as f:
                cat = json.load(f)
                procs = [p["uri"] for p in cat.get("processes", []) if "uri" in p]
                request_handler._send(200, {"ok": True, "total": len(procs), "processes": procs})
                return
        except Exception:
            pass

    procs = []
    for p in sorted(GENERATED.rglob("bin.mjs")):
        rel = p.parent.relative_to(GENERATED)
        parts = str(rel).split("/")
        if len(parts) >= 3 and parts[-2] == "taskand.dev":
            uri = f"proc://taskand.dev/{parts[0]}/{parts[1]}/{parts[-1]}"
        else:
            uri = f"proc://taskand.dev/{rel}"
        procs.append(uri)
    request_handler._send(200, {"ok": True, "total": len(procs), "processes": procs})
