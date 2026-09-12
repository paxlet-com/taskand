#!/usr/bin/env python3
import sys
import os
import shutil
import hashlib
import json
import datetime

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HISTORY_DIR = os.path.join(PROJECT_DIR, "history")
SNAPS_DIR = os.path.join(HISTORY_DIR, "snapshots")
EVO_DIR = os.path.join(PROJECT_DIR, "evolution")
HISTORY_YAML = os.path.join(HISTORY_DIR, "history.yaml")
DONE_YAML = os.path.join(PROJECT_DIR, "tasks", "done.yaml")

def ensure_dirs():
    os.makedirs(SNAPS_DIR, exist_ok=True)
    if not os.path.exists(HISTORY_YAML):
        with open(HISTORY_YAML, "w", encoding="utf-8") as f:
            f.write("# taskand · historia migawek i zadań\n")

def compute_dir_hash(directory):
    file_hashes = {}
    hasher = hashlib.sha256()
    for root, _, files in os.walk(directory):
        for f in sorted(files):
            p = os.path.join(root, f)
            rel = os.path.relpath(p, directory)
            with open(p, "rb") as fp:
                data = fp.read()
                h = hashlib.sha256(data).hexdigest()
                file_hashes[rel] = h
                hasher.update(f"{rel}:{h}".encode())
    return hasher.hexdigest(), file_hashes

def create_snapshot(target_rel_path, desc, task_id=None):
    ensure_dirs()
    target_abs = os.path.join(PROJECT_DIR, target_rel_path)
    if not os.path.exists(target_abs):
        print(f"Błąd: ścieżka '{target_rel_path}' nie istnieje na dysku.")
        sys.exit(1)

    snap_id = f"snap-{task_id or datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    snap_path = os.path.join(SNAPS_DIR, snap_id)
    files_dir = os.path.join(snap_path, "files", target_rel_path)
    os.makedirs(os.path.dirname(files_dir), exist_ok=True)

    if os.path.isdir(target_abs):
        shutil.copytree(target_abs, files_dir, dirs_exist_ok=True)
    else:
        shutil.copy2(target_abs, files_dir)

    dockerfile_rel = None
    dockerfile_sha = None
    if task_id:
        src_df = os.path.join(EVO_DIR, task_id, "Dockerfile")
        if os.path.exists(src_df):
            dst_df = os.path.join(snap_path, "Dockerfile")
            shutil.copy2(src_df, dst_df)
            dockerfile_rel = f"evolution/{task_id}/Dockerfile"
            with open(src_df, "rb") as fp:
                dockerfile_sha = hashlib.sha256(fp.read()).hexdigest()

    overall_hash, file_hashes = compute_dir_hash(os.path.join(snap_path, "files"))
    manifest = {
        "snapshot_id": snap_id,
        "task_id": task_id or "-",
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "type": "backup",
        "description": desc,
        "target": target_rel_path,
        "sha256": overall_hash,
        "file_count": len(file_hashes),
        "dockerfile": dockerfile_rel,
        "dockerfile_sha256": dockerfile_sha,
        "files": file_hashes
    }

    with open(os.path.join(snap_path, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    with open(HISTORY_YAML, "a", encoding="utf-8") as f:
        f.write(f"\n- id: {snap_id}\n"
                f"  task_id: {task_id or '-'}\n"
                f"  created_at: \"{manifest['created_at']}\"\n"
                f"  type: backup\n"
                f"  description: \"{desc}\"\n"
                f"  target: \"{target_rel_path}\"\n"
                f"  sha256: {overall_hash}\n"
                f"  dockerfile: \"{dockerfile_rel or '-'}\"\n"
                f"  status: backed_up\n")

    print(f"✓ Utworzono migawkę [{snap_id}] (SHA256: {overall_hash[:12]}...) dla '{target_rel_path}'")
    return snap_id

def list_history():
    ensure_dirs()
    print("\033[1m=== HISTORIA ZADAŃ I MIGAWEK (ROLLBACK & POWIĄZANIA DOCKERFILE) ===\033[0m\n")

    snaps = []
    snap_map = {}
    if os.path.exists(SNAPS_DIR):
        for s in sorted(os.listdir(SNAPS_DIR), reverse=True):
            m_path = os.path.join(SNAPS_DIR, s, "manifest.json")
            if os.path.exists(m_path):
                try:
                    with open(m_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        snaps.append(data)
                        if data.get("task_id"):
                            snap_map[data["task_id"]] = data
                        snap_map[data.get("snapshot_id")] = data
                except Exception:
                    pass

    if snaps:
        print("\033[36m1. Dostępne punkty przywracania (Snapshots) z hashami i procesami Dockerfile:\033[0m")
        print(f"  {'ID MIGAWEKI':<18} {'DATA':<20} {'CEL':<10} {'HASH SHA-256':<16} {'PROCES DOCKERFILE':<32} OPIS")
        print("  " + "-" * 115)
        for sn in snaps:
            sid = sn.get("snapshot_id", "-")
            ca = sn.get("created_at", "-")
            tgt = sn.get("target", "-")
            h = sn.get("sha256", "-")[:12] + "..."
            tid = sn.get("task_id", "-")
            df_path = sn.get("dockerfile") or (f"evolution/{tid}/Dockerfile" if os.path.exists(os.path.join(EVO_DIR, tid, "Dockerfile")) else "-")
            desc = sn.get("description", "-")
            print(f"  \033[32m{sid:<18}\033[0m {ca:<20} {tgt:<10} {h:<16} \033[33m{df_path:<32}\033[0m {desc}")
        print("")
    else:
        print("(Brak zapisanych migawek w history/snapshots/)\n")

    print("\033[35m2. Pełny rejestr wykonanych zadań z powiązanymi procesami Dockerfile:\033[0m")
    tasks = []
    if os.path.exists(DONE_YAML):
        with open(DONE_YAML, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("- id:"):
                    # format: - id: t1789203598 · typ: czyszczenie · 2026-09-12 09:00:04
                    parts = [p.strip() for p in line.replace("- id:", "").split("·")]
                    tid = parts[0] if len(parts) > 0 else "-"
                    typ = parts[1].replace("typ:", "").strip() if len(parts) > 1 else "-"
                    ts = parts[2] if len(parts) > 2 else "-"
                    tasks.append((tid, typ, ts))

    if tasks:
        print(f"  {'ID ZADANIA':<15} {'TYP':<16} {'DATA ZAKOŃCZENIA':<22} {'POWIĄZANY PROCES DOCKERFILE':<36} MIGAWKA")
        print("  " + "-" * 115)
        for tid, typ, ts in reversed(tasks):
            df_file = os.path.join("evolution", tid, "Dockerfile")
            df_exists = os.path.exists(os.path.join(PROJECT_DIR, df_file))
            df_display = f"\033[32m{df_file} ✓\033[0m" if df_exists else "\033[90m(brak)\033[0m"
            sn = snap_map.get(tid)
            sn_display = f"\033[36m{sn['snapshot_id']}\033[0m" if sn else "\033[90m-\033[0m"
            print(f"  \033[1m{tid:<15}\033[0m {typ:<16} {ts:<22} {df_display:<45} {sn_display}")
        print("")
        print("\033[90mPodgląd kodu procesu: taskand show <ID_ZADANIA_LUB_MIGAWEKI>\033[0m\n")
    else:
        print("  (Brak wykonanych zadań w tasks/done.yaml)\n")

def show_details(target_id):
    ensure_dirs()
    # 1. Szukaj w migawkach
    m_path = os.path.join(SNAPS_DIR, target_id, "manifest.json")
    if not os.path.exists(m_path):
        for s in os.listdir(SNAPS_DIR):
            cand = os.path.join(SNAPS_DIR, s, "manifest.json")
            if os.path.exists(cand):
                try:
                    with open(cand, "r", encoding="utf-8") as f:
                        d = json.load(f)
                        if d.get("task_id") == target_id or d.get("snapshot_id") == target_id:
                            m_path = cand
                            break
                except Exception:
                    pass

    print(f"\033[1m=== SZCZEGÓŁY ZADANIA / MIGAWEKI [{target_id}] ===\033[0m\n")
    tid = target_id
    if os.path.exists(m_path):
        with open(m_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        tid = meta.get("task_id", tid)
        print(f"ID Migawki:    \033[36m{meta.get('snapshot_id')}\033[0m")
        print(f"Powiązane zad: \033[1m{tid}\033[0m")
        print(f"Data utworz.:  {meta.get('created_at')}")
        print(f"Typ / Opis:    {meta.get('type')} — {meta.get('description')}")
        print(f"Cel archiw.:   {meta.get('target')}")
        print(f"Hash SHA-256:  \033[32m{meta.get('sha256')}\033[0m")
        print(f"Liczba plików: {meta.get('file_count')}")
        print("\n\033[33mZarchiwizowane pliki z sumami SHA-256:\033[0m")
        for p, h in meta.get("files", {}).items():
            print(f"  - {p} (SHA256: {h[:16]}...)")
        print("")

    # 2. Szukaj powiązanego Dockerfile procesu
    evo_paths = [
        os.path.join(EVO_DIR, tid, "Dockerfile"),
        os.path.join(SNAPS_DIR, target_id, "Dockerfile")
    ]
    df_found = None
    for ep in evo_paths:
        if os.path.exists(ep):
            df_found = ep
            break

    if df_found:
        print(f"\033[35m=== POWIĄZANY PROCES DOCKERFILE ({os.path.relpath(df_found, PROJECT_DIR)}) ===\033[0m")
        with open(df_found, "r", encoding="utf-8") as f:
            print(f.read())
        print("-" * 60)
    else:
        print(f"\033[90m(Brak dedykowanego Dockerfile w evolution/{tid}/Dockerfile)\033[0m")

def rollback(target_id_or_hash=None):
    ensure_dirs()
    snaps = []
    if os.path.exists(SNAPS_DIR):
        for s in os.listdir(SNAPS_DIR):
            m_path = os.path.join(SNAPS_DIR, s, "manifest.json")
            if os.path.exists(m_path):
                try:
                    with open(m_path, "r", encoding="utf-8") as f:
                        snaps.append(json.load(f))
                except Exception:
                    pass

    if not snaps:
        print("Błąd: brak dostępnych migawek do przywrócenia w history/snapshots/.")
        sys.exit(1)

    selected = None
    if not target_id_or_hash:
        snaps.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        selected = snaps[0]
        print(f"Nie podano ID/hasha. Wybrano najnowszą migawkę: {selected['snapshot_id']}")
    else:
        for sn in snaps:
            if sn.get("snapshot_id") == target_id_or_hash or sn.get("sha256", "").startswith(target_id_or_hash) or sn.get("task_id") == target_id_or_hash:
                selected = sn
                break

    if not selected:
        print(f"Błąd: nie znaleziono migawki odpowiadającej '{target_id_or_hash}'.")
        print("Dostępne migawki:")
        for sn in snaps:
            print(f"  - {sn['snapshot_id']} (hash: {sn['sha256'][:12]}...) - {sn.get('description', '')}")
        sys.exit(1)

    snap_id = selected["snapshot_id"]
    snap_path = os.path.join(SNAPS_DIR, snap_id)
    files_dir = os.path.join(snap_path, "files")

    print(f"\n→ Weryfikacja integralności migawki [{snap_id}]...")
    expected_hash = selected.get("sha256")
    current_hash, _ = compute_dir_hash(files_dir)
    if expected_hash and expected_hash != current_hash:
        print(f"Ostrzeżenie: suma kontrolna migawki różni się od zapisanego manifestu!")
        print(f"  Oczekiwana: {expected_hash}")
        print(f"  Obecna:     {current_hash}")
    else:
        print(f"✓ Suma SHA-256 zgodna: {current_hash}")

    print(f"→ Przywracanie danych do katalogu roboczego...")
    for item in os.listdir(files_dir):
        src = os.path.join(files_dir, item)
        dst = os.path.join(PROJECT_DIR, item)
        if os.path.exists(dst):
            print(f"  Nadpisywanie istniejącego: {item}")
            if os.path.isdir(dst):
                shutil.rmtree(dst)
            else:
                os.remove(dst)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
        print(f"  ✓ Przywrócono: {item}")

    log_path = os.path.join(PROJECT_DIR, "log", "evolution.log")
    if os.path.exists(os.path.dirname(log_path)):
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().strftime('%F %T')}] [rollback] Przywrócono migawkę {snap_id} (target: {selected.get('target')})\n")

    print(f"\n\033[32m✓ Pomyślnie wykonano rollback do stanu z migawki [{snap_id}]!\033[0m")
    print(f"  Przywrócony cel: {selected.get('target')}")
    print(f"  Data migawki:   {selected.get('created_at')}")
    print(f"  Hash SHA256:    {selected.get('sha256')}")

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "list"
    if action in ("list", "history"):
        list_history()
    elif action in ("show", "inspect", "info"):
        if len(sys.argv) < 3:
            print("Użycie: history.py show <ID_ZADANIA_LUB_MIGAWEKI>")
            sys.exit(1)
        show_details(sys.argv[2])
    elif action in ("snap", "snapshot", "create"):
        tgt = sys.argv[2] if len(sys.argv) > 2 else "taskand"
        desc = sys.argv[3] if len(sys.argv) > 3 else "Ręczna migawka"
        tid = sys.argv[4] if len(sys.argv) > 4 else None
        create_snapshot(tgt, desc, tid)
    elif action in ("rollback", "restore"):
        target_arg = sys.argv[2] if len(sys.argv) > 2 else None
        rollback(target_arg)
    else:
        print(f"Użycie: {sys.argv[0]} [list|show <id>|snapshot <ścieżka> <opis>|rollback <id_lub_hash>]")
