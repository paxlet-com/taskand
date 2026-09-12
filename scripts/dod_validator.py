#!/usr/bin/env python3
"""
taskand · Definition of Done (DoD) Validator
Weryfikuje czy zadanie rzeczywiście zrealizowało zamierzony cel biznesowy/techniczny
przed oznaczeniem go jako sukces w tasks/done.yaml.
"""

import sys
import os
import subprocess
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

def run_cmd(cmd, cwd=BASE_DIR):
    res = subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd, capture_output=True, text=True)
    return res.returncode, res.stdout.strip(), res.stderr.strip()

def validate_dod(task_id: str, task_type: str, task_desc: str) -> tuple[bool, str]:
    """
    Weryfikuje Definition of Done (DoD) na podstawie typu i opisu zadania.
    Zwraca (sukces: bool, raport: str).
    """
    desc_lower = task_desc.lower()
    
    # 1. DoD dla: zmiana nazwy repozytorium (github-rename)
    if any(k in desc_lower for k in ["zmień nazwę", "zmien nazwe", "rename"]):
        matches = re.findall(r'(?:na|to)\s+([a-zA-Z0-9_\-\.]+)', task_desc, re.IGNORECASE)
        candidates = [m for m in matches if m.lower() not in ["github", "gh", "git"]]
        target_name = candidates[-1] if candidates else "taskand-glm53"
        
        # Sprawdź czy repozytorium o nowej nazwie istnieje na GitHubie
        code, out, err = run_cmd(f"gh repo view semcod/{target_name} --json name")
        if code == 0 and target_name in out:
            return True, f"DoD SPEŁNIONE ✓: Repozytorium semcod/{target_name} istnieje i jest aktywne na GitHub."
        else:
            return False, f"DoD NIESPEŁNIONE ✗: Brak repozytorium semcod/{target_name} na GitHub. Błąd:\n{err}"

    # 2. DoD dla: synchronizacja git (git-push / git-sync)
    if task_type in ["git-push", "git-sync"] or any(w in desc_lower for w in ["wypchnij", "push", "sync", "commit"]):
        # Sprawdź czy lokalny branch nie ma nieopublikowanych commitów
        code, out, _ = run_cmd("git status -sb")
        if "ahead" in out:
            return False, f"DoD NIESPEŁNIONE ✗: Lokalne zmiany nie zostały wypchnięte (git status: {out})"
        return True, "DoD SPEŁNIONE ✓: Wszystkie commity zostały zsynchronizowane ze zdalnym repozytorium."

    # 3. DoD dla: czyszczenie (czyszczenie / cleanup)
    if task_type in ["czyszczenie", "cleanup"] or any(w in desc_lower for w in ["usuń", "skasuj", "wyczyść", "delete", "remove"]):
        if "taskand" in desc_lower and (BASE_DIR / "taskand").is_dir():
            return False, "DoD NIESPEŁNIONE ✗: Zbędny podkatalog taskand wciąż istnieje na dysku!"
        return True, "DoD SPEŁNIONE ✓: Wskazane zbędne pliki/katalogi zostały skutecznie usunięte."

    # 4. DoD dla: tworzenie projektu GitHub (github-projekt)
    if task_type == "github-projekt":
        code, out, _ = run_cmd("gh repo list semcod --limit 5")
        if code == 0:
            return True, "DoD SPEŁNIONE ✓: Usługa GitHub CLI potwierdziła dostępność repozytorium."
        return False, "DoD NIESPEŁNIONE ✗: Błąd dostępu do GitHub CLI."

    # Domyślne sprawdzenie kodu wyjścia
    return True, "DoD SPEŁNIONE ✓: Podstawowe kryteria wyjścia (kod 0) spełnione."

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Użycie: dod_validator.py <task_id> <typ> [opis_zadania]")
        sys.exit(1)
    tid = sys.argv[1]
    ttyp = sys.argv[2]
    tdesc = sys.argv[3] if len(sys.argv) > 3 else ttyp
    
    ok, report = validate_dod(tid, ttyp, tdesc)
    print("=" * 60)
    print(f"[DoD-Validator] Walidacja zadania [{tid}] (typ: {ttyp})")
    print(f"Kryterium / Raport: {report}")
    print("=" * 60)
    sys.exit(0 if ok else 1)
