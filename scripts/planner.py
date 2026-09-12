#!/usr/bin/env python3
"""
taskand-glm53 · Context-Aware Planner (wellmanifest/llm & wellmanifest/logs)
Zapewnia świadomość środowiska, ciągłość konwersacji oraz bezpieczeństwo sekretów.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(BASE_DIR, "environment.yaml")
CONV_LOG = os.path.join(BASE_DIR, "log", "conversations.jsonl")
DOT_ENV = os.path.join(BASE_DIR, ".env")
ANSWERS_FILE = os.path.join(BASE_DIR, "answers", "taskand.answers.yaml")

def load_dot_env():
    env_vars = {}
    if os.path.exists(DOT_ENV):
        with open(DOT_ENV, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

def parse_simple_yaml(path):
    data = {}
    if not os.path.exists(path):
        return data
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and ":" in line:
                k, v = line.split(":", 1)
                data[k.strip()] = v.strip().strip('"').strip("'")
    return data

def get_environment():
    dot_env = load_dot_env()
    # Domyślne wartości z autodetekcją
    env_data = {
        "project_name": "taskand-glm53",
        "org": "semcod",
        "repository": "https://github.com/semcod/taskand-glm53.git",
        "branch": "main",
        "model": dot_env.get("TASKAND_LLM_MODEL", "glm-5.3"),
        "endpoint": dot_env.get("TASKAND_LLM_ENDPOINT", "https://api.z.ai/api/paas/v4/chat/completions"),
        "api_key": dot_env.get("TASKAND_LLM_API_KEY", os.environ.get("TASKAND_LLM_API_KEY", ""))
    }
    
    # Odczytaj z answers jeśli dostępne
    answers = parse_simple_yaml(ANSWERS_FILE)
    if answers.get("org"):
        env_data["org"] = answers["org"]
        
    return env_data

def get_recent_conversations(limit=3):
    conversations = []
    if not os.path.exists(CONV_LOG):
        return conversations
    try:
        with open(CONV_LOG, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
            for line in lines[-limit:]:
                try:
                    conversations.append(json.loads(line))
                except Exception:
                    pass
    except Exception:
        pass
    return conversations

def log_conversation(task_id, env_snapshot, messages, response_text, result_data):
    os.makedirs(os.path.dirname(CONV_LOG), exist_ok=True)
    entry = {
        "timestamp": datetime.now().isoformat(),
        "task_id": task_id,
        "standard": "wellmanifest/logs@v1",
        "environment": {
            "project_name": env_snapshot.get("project_name"),
            "org": env_snapshot.get("org"),
            "repository": env_snapshot.get("repository"),
            "branch": env_snapshot.get("branch"),
            "model": env_snapshot.get("model")
        },
        "messages": messages,
        "response_raw": response_text,
        "result": result_data
    }
    with open(CONV_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

def call_llm(task_id, user_prompt, env_data):
    api_key = env_data.get("api_key")
    if not api_key:
        return None, "Brak klucza API w .env (TASKAND_LLM_API_KEY)"

    recent_convs = get_recent_conversations(3)
    history_context = ""
    if recent_convs:
        history_context = "Ostatnie zrealizowane zadania i konwersacje:\n"
        for c in recent_convs:
            tid = c.get("task_id", "")
            res = c.get("result", {})
            history_context += f"- Zadanie [{tid}]: repo={res.get('repo')} status={res.get('status')}\n"

    system_prompt = f"""Jesteś wyspecjalizowanym planistą systemu autonomicznego {env_data['project_name']} (standard wellmanifest/llm).
KONTEKST ŚRODOWISKA:
- Projekt: {env_data['project_name']} (BARDZO WAŻNE: Nazwa repozytorium to {env_data['project_name']}, NIGDY nie używaj starej nazwy 'taskand'!)
- Organizacja GitHub: {env_data['org']}
- Oficjalny URL repozytorium: {env_data['repository']}
- Główna gałąź: {env_data['branch']}
- Zasady bezpieczeństwa sekretów:
  1. NIGDY nie umieszczaj haseł, tokenów ani kluczy bezpośrednio w pliku Dockerfile.
  2. Sekrety muszą być przekazywane w fazie runtime przez zmienne środowiskowe (.env / Vault) lub montowane jako wolumen :ro.
{history_context}
ZADANIE UŻYTKOWNIKA:
Wygeneruj plan dla zadania. Twoja odpowiedź MUSI ściśle zawierać poniższe markery:
REPO: {env_data['project_name']}
ORG: {env_data['org']}
README_START
<treść README w formacie markdown dla projektu {env_data['project_name']}>
README_END
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    payload = {
        "model": env_data["model"],
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1500
    }

    req = urllib.request.Request(
        env_data["endpoint"],
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            return content, None
    except Exception as e:
        return None, str(e)

def parse_plan(raw_text, default_repo, default_org):
    repo = default_repo
    org = default_org
    readme = ""

    if raw_text:
        lines = raw_text.splitlines()
        for line in lines:
            if line.startswith("REPO:"):
                cand = line.split(":", 1)[1].strip()
                if cand and cand != "-":
                    repo = cand
            elif line.startswith("ORG:"):
                cand = line.split(":", 1)[1].strip()
                if cand:
                    org = cand

        if "README_START" in raw_text and "README_END" in raw_text:
            parts = raw_text.split("README_START", 1)[1].split("README_END", 1)
            readme = parts[0].strip()

    if not readme:
        readme = f"""# {repo}

Autonomiczny system zadań sterowany procesami-Dockerfile w organizacji {org}.
Projekt wykorzystuje standard wellmanifest/logs oraz wellmanifest/llm do zarządzania kontekstem.
"""

    return repo, org, readme

def main():
    if len(sys.argv) < 2:
        print("Użycie: planner.py <opis_zadania> [task_id]")
        sys.exit(1)

    user_prompt = sys.argv[1]
    task_id = sys.argv[2] if len(sys.argv) > 2 else f"t{int(time.time())}"

    env_data = get_environment()
    raw_response, err = call_llm(task_id, user_prompt, env_data)

    repo, org, readme = parse_plan(raw_response, env_data["project_name"], env_data["org"])

    # Zawsze zabezpiecz przed cofnięciem nazwy na stary 'taskand' jeśli użytkownik nie prosił o inne repo
    if repo.lower() == "taskand":
        repo = env_data["project_name"]

    result = {
        "repo": repo,
        "org": org,
        "status": "success" if not err else "fallback",
        "error": err
    }

    # Zapisz do rejestru konwersacji (wellmanifest/logs standard)
    log_conversation(
        task_id=task_id,
        env_snapshot=env_data,
        messages=[{"role": "user", "content": user_prompt}],
        response_text=raw_response or f"[fallback] {err}",
        result_data=result
    )

    # Zwróć ustandaryzowany output dla kontrolera
    print(f"REPO: {repo}")
    print(f"ORG: {org}")
    print("README_START")
    print(readme)
    print("README_END")

if __name__ == "__main__":
    main()
