#!/usr/bin/env python3
"""
taskand · Digital Twin Sandbox & Verification Engine
Tworzy efemerycznego cyfrowego bliźniaka (Digital Twin) środowiska produkcyjnego,
uruchamia w nim nowo wygenerowany proces Dockerfile, sprawdza bezpieczeństwo i poprawność,
a w razie błędu realizuje pętlę samonaprawy (self-healing) z wykorzystaniem modelu LLM.
"""

import os
import sys
import shutil
import subprocess
import tempfile
import json
import time
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
EVO_DIR = BASE_DIR / "evolution"
ENV_FILE = BASE_DIR / ".env"

def load_env():
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def log(msg, tag="digital-twin"):
    print(f"[{tag}] {msg}")

def create_twin_environment(task_id: str) -> Path:
    """Tworzy izolowaną kopię środowiska (workspace + compose)."""
    twin_dir = Path(tempfile.mkdtemp(prefix=f"taskand_twin_{task_id}_"))
    log(f"Inicjalizacja Digital Twin w: {twin_dir}")
    
    # Kopiuj strukturę projektu z pominięciem ciężkich i poufnych danych
    ignore_patterns = shutil.ignore_patterns(
        ".git", ".env", "log", "history", "*.tar.gz", "__pycache__", "twin_*"
    )
    for item in BASE_DIR.iterdir():
        if item.name in [".git", ".env", "log", "history"]:
            continue
        dest = twin_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest, ignore=ignore_patterns)
        else:
            shutil.copy2(item, dest)
            
    # Przygotuj w bliźniaku lokalne, izolowane repozytorium git do testów
    try:
        subprocess.run(["git", "init", "-b", "main"], cwd=twin_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "twin-tester"], cwd=twin_dir, check=True)
        subprocess.run(["git", "config", "user.email", "tester@digitaltwin.local"], cwd=twin_dir, check=True)
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", "*"], cwd=twin_dir, check=True)
        subprocess.run(["git", "add", "-A"], cwd=twin_dir, check=True)
        subprocess.run(["git", "commit", "-m", "initial twin state"], cwd=twin_dir, check=True)
    except Exception as e:
        log(f"Ostrzeżenie przy inicjalizacji git w twin: {e}")
        
    return twin_dir

def run_twin_verification(task_id: str, dockerfile_path: Path, twin_workspace: Path):
    """Buduje i uruchamia proces w cyfrowym bliźniaku z izolacją."""
    image_tag = f"taskand-twin:{task_id}"
    build_dir = dockerfile_path.parent
    
    log(f"Krok 1/3: Budowanie obrazu kandydata w Digital Twin ({image_tag})...")
    build_cmd = ["docker", "build", "-t", image_tag, "-f", str(dockerfile_path), str(build_dir)]
    res = subprocess.run(build_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return False, f"Błąd budowania Dockerfile:\n{res.stderr}\n{res.stdout}"

    log("Krok 2/3: Uruchomienie procesu w izolowanym środowisku bliźniaka...")
    gh_conf = Path.home() / ".config" / "gh"
    mounts = [
        "-v", f"{twin_workspace}:/project",
        "-v", f"{twin_workspace}:/work"
    ]
    if gh_conf.exists():
        mounts.extend(["-v", f"{gh_conf}:/root/.config/gh:ro"])

    run_cmd = [
        "docker", "run", "--rm",
        "--name", f"twin_runner_{task_id}_{int(time.time())}",
        *mounts,
        image_tag
    ]
    
    try:
        run_res = subprocess.run(run_cmd, capture_output=True, text=True, timeout=120)
        logs = f"{run_res.stdout}\n{run_res.stderr}"
        
        log("Krok 3/3: Audyt bezpieczeństwa i integralności po wykonaniu w Twin...")
        # Sprawdź kod wyjścia
        if run_res.returncode != 0:
            return False, f"Proces zakończył się kodem błędu {run_res.returncode}:\n{logs}"
            
        # Sprawdź czy kluczowe pliki projektu przetrwały
        critical_files = ["Makefile", "START-HERE.md", "taskand.cli"]
        missing = [f for f in critical_files if not (twin_workspace / f).exists()]
        if missing:
            return False, f"Naruszenie bezpieczeństwa: proces usunął kluczowe pliki: {missing}\nLogi:\n{logs}"
            
        return True, logs
    except subprocess.TimeoutExpired:
        return False, "Błąd: Przekroczono limit czasu (120s) - proces zawiesił się w Digital Twin."
    except Exception as e:
        return False, f"Nieoczekiwany błąd wykonania: {e}"

def ask_llm_for_repair(task_id: str, original_dockerfile: str, error_logs: str, task_desc: str) -> str:
    """Wysyła błąd z Digital Twin do LLM w celu wygenerowania samonaprawionego Dockerfile."""
    env = load_env()
    api_key = env.get("TASKAND_LLM_API_KEY")
    endpoint = env.get("TASKAND_LLM_ENDPOINT", "https://api.z.ai/api/paas/v4/chat/completions")
    model = env.get("TASKAND_LLM_MODEL", "glm-5.3")

    if not api_key:
        log("Brak klucza LLM w .env — samonaprawa automatyczna niedostępna.", tag="twin-repair")
        return ""

    log(f"Odpytywanie planisty {model} o samonaprawę procesu po błędzie w Digital Twin...", tag="twin-repair")
    
    prompt = f"""Jesteś silnikiem samonaprawy (Self-Healing Engine) w systemie taskand.
Wygenerowany wcześniej proces Dockerfile dla zadania: "{task_desc}"
zakończył się BŁĘDEM podczas weryfikacji w cyfrowym bliźniaku (Digital Twin).

BŁĄD Z LOGÓW DIGITAL TWIN:
\"\"\"
{error_logs[-2000:]}
\"\"\"

ORGINALNY DOCKERFILE:
\"\"\"
{original_dockerfile}
\"\"\"

Zadanie: Napraw Dockerfile, aby proces wykonał się bezbłędnie (zwracając kod 0), był w pełni bezpieczny i poprawnie zrealizował cel zadania.
Odpowiedz wyłącznie pełną treścią nowego pliku Dockerfile w jednym bloku ```dockerfile ... ``` bez zbędnego wstępu i bez komentarzy na końcu."""

    try:
        import urllib.request
        body = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 1500
        }).encode("utf-8")
        
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
        )
        with urllib.request.urlopen(req, timeout=45) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            content = resp_data["choices"][0]["message"]["content"]
            
            # Wyszukaj blok kodu z Dockerfile
            blocks = re.findall(r"```(?:dockerfile|Dockerfile)?\s*(.*?)```", content, re.DOTALL)
            for b in blocks:
                if "FROM " in b:
                    return b.strip()
            # fallback jeśli nie było tagów
            if "FROM " in content:
                lines = [l for l in content.splitlines() if not l.startswith("```")]
                return "\n".join(lines).strip()
            return ""
    except Exception as e:
        log(f"Błąd komunikacji z modelem LLM: {e}", tag="twin-repair")
        return ""

def verify_and_evolve(task_id: str, task_desc: str = "zadanie systemowe", max_attempts: int = 3):
    """Główna pętla weryfikacji i ewolucji w Digital Twin."""
    task_dir = EVO_DIR / task_id
    dockerfile = task_dir / "Dockerfile"
    
    if not dockerfile.exists():
        log(f"Brak Dockerfile dla zadania {task_id} w {task_dir}", tag="error")
        return False

    print("=" * 75)
    log(f"ROZPOCZĘCIE CYKLU CYFROWEGO BLIŹNIAKA (DIGITAL TWIN GATE) DLA [{task_id}]")
    print("=" * 75)
    
    current_dockerfile = dockerfile
    
    for attempt in range(1, max_attempts + 1):
        log(f"--- Próba {attempt}/{max_attempts} weryfikacji w Digital Twin ---")
        twin_ws = create_twin_environment(task_id)
        try:
            success, logs = run_twin_verification(task_id, current_dockerfile, twin_ws)
            if success:
                log(f"✓ SUKCES: Proces zaliczył wszystkie testy w Digital Twin bez błędów!", tag="twin-success")
                log(f"Raport z Twin:\n{logs.strip()}", tag="twin-report")
                
                # Oznacz proces jako certyfikowany
                cert_file = task_dir / "TWIN_VERIFIED.json"
                with open(cert_file, "w") as f:
                    json.dump({
                        "task_id": task_id,
                        "verified_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "attempts": attempt,
                        "status": "APPROVED_FOR_PRODUCTION"
                    }, f, indent=2)
                log(f"Certyfikat bezpieczeństwa wygenerowany: {cert_file.name}")
                return True
            else:
                log(f"✗ OSTRZEŻENIE: Proces w Digital Twin zawiódł w próbie {attempt}!", tag="twin-failed")
                log(f"Szczegóły błędu:\n{logs.strip()}", tag="twin-details")
                
                if attempt < max_attempts:
                    log(f"Uruchamianie samonaprawy (Self-Healing Loop) przez model LLM...", tag="twin-evolve")
                    with open(current_dockerfile, "r", encoding="utf-8") as df:
                        df_code = df.read()
                        
                    repaired_code = ask_llm_for_repair(task_id, df_code, logs, task_desc)
                    if repaired_code:
                        new_version_file = task_dir / f"Dockerfile.v{attempt + 1}"
                        with open(new_version_file, "w", encoding="utf-8") as nf:
                            nf.write(repaired_code)
                        log(f"Utworzono nową generację procesu: {new_version_file.name}")
                        current_dockerfile = new_version_file
                    else:
                        log("Nie udało się uzyskać poprawki od LLM. Przerywanie prób.")
                        break
        finally:
            shutil.rmtree(twin_ws, ignore_errors=True)
            log(f"Sprzątanie środowiska Digital Twin zakończone.")

    log(f"✗ Proces [{task_id}] ODRZUCONY przez bramkę Digital Twin. Wstrzymano uruchomienie na produkcji.", tag="twin-blocked")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Użycie: digital_twin.py <task_id> [opis_zadania]")
        sys.exit(1)
    tid = sys.argv[1]
    desc = sys.argv[2] if len(sys.argv) > 2 else "zadanie"
    ok = verify_and_evolve(tid, desc)
    sys.exit(0 if ok else 1)
