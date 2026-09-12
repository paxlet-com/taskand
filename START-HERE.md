# taskand v0.4 — Szybki start

System autonomiczny sterowany zadaniami (procesami-Dockerfile) i docker-compose.

## Jak tego używać?

Komenda `taskand` została zainstalowana w `~/.local/bin/taskand` i jest dostępna w Twoim terminalu:

```bash
# 1. Sprawdzenie statusu usług
taskand status

# 2. Dodanie zadania dla planisty / GitHub (tworzy repo w wybranej organizacji)
taskand add "stwórz projekt w organizacji semcod z README"

# 3. Podgląd kolejki zadań (inbox) i historii wykonanych (done)
taskand tasks

# 4. Historia migawek i zrealizowanych procesów z hashami SHA-256
taskand history

# 5. Przywrócenie stanu z migawki (Rollback)
taskand rollback snap-t1789203598

# 6. Test w cyfrowym bliźniaku (Digital Twin Sandbox) z samonaprawą
taskand twin t1789204317 "wypchnij zmiany na github"

# 7. Śledzenie logów planisty i orkiestratora na żywo
taskand logs

# 8. Uruchomienie lokalnej strony landing (Nginx w kontenerze)
make web
# → http://localhost:8090
```

## Alternatywne sposoby dodawania zadań

### A. Bezpośrednio do pliku `tasks/inbox.yaml`

```bash
printf -- "- id: t001\n  typ: github-projekt\n  z: stwórz projekt z README\n" >> tasks/inbox.yaml
```

### B. Przez HTTP Gateway (port 8077)

```bash
curl -X POST http://localhost:8077/tasks \
  -H "Content-Type: application/json" \
  -d '{"id":"t002","typ":"github-projekt","z":"drugi projekt semcod"}'
```

Dostępne typy zadań:
- `github-projekt` — planista GLM-5.3 tworzy plan i generuje repozytorium GitHub przez narzędzie `gh`
- `obserwuj` — proces potomny monitorujący
- `handover` — przekazanie kontroli do potomka `orchestrator`
