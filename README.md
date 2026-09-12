# taskand v0.4 — Bootstrap + Landing + Planista GLM-5.3

Autonomiczny system zadań sterowany procesami-Dockerfile i docker-compose. Każdy krok instalacji i każde zadanie jest izolowanym procesem w kontenerze Docker.

---

## ⚡ Szybki start

Najprostszym sposobem zarządzania projektem jest narzędzie **`make`** lub dedykowane CLI **`taskand`**.

```bash
# 1. Sprawdź dostępne polecenia i stan systemu
make

# 2. Zainstaluj globalne CLI w ~/.local/bin/taskand (jeśli jeszcze nie zainstalowano)
make install-cli

# 3. Sprawdź status kontenerów
make status

# 4. Dodaj pierwsze zadanie
make add TASK="stwórz projekt w organizacji semcod z README"

# 5. Podgląd logów planisty GLM-5.3
make logs
```

---

## 🛠️ Polecenia Makefile

| Komenda | Opis |
|---------|------|
| `make` / `make help` | Wyświetla listę poleceń oraz aktualny stan kontenerów |
| `make bootstrap` | Uruchamia interaktywny onboarding i instalację (`sh taskand.sh`) |
| `make install-cli` | Instaluje / linkuje narzędzie `taskand` do `~/.local/bin/taskand` |
| `make up` | Uruchamia usługi taskand w tle (`docker compose up -d`) |
| `make down` | Zatrzymuje kontenery (`docker compose down`) |
| `make restart` | Restartuje kontenery (`docker compose restart`) |
| `make status` / `make ps` | Sprawdza status usług (`docker compose ps`) |
| `make logs` | Śledzi logi kontrolera nucleus (planisty) na żywo |
| `make logs-all` | Śledzi logi wszystkich usług (`nucleus` + `gateway`) |
| `make tasks` | Wyświetla kolejkę zadań (`inbox.yaml`) i historię (`done.yaml`) |
| `make history` | Wyświetla pełną historię wykonania zadań oraz migawki z sumami SHA-256 |
| `make rollback [ID=snap-xxx]` | Przywraca pliki z wybranej migawki bezpieczeństwa |
| `make snapshot TARGET=... DESC=...` | Tworzy nową migawkę wskazanego katalogu lub pliku |
| `make clean-duplicates` | Uruchamia proces czyszczenia zbędnego podkatalogu `taskand` |
| `make add TASK="..."` | Dodaje zadanie (automatycznie rozpoznaje typ i śledzi logi na żywo) |
| `make add-watch TASK="..."`| Dodaje zadanie typu `obserwuj` |
| `make gateway-health` | Sprawdza stan bramki HTTP (port 8077) |
| `make web [PORT=8080]` | Uruchamia serwer landing page (domyślnie port 8080) |
| `make check` | Sprawdza poprawność składniową plików Dockerfile |
| `make clean` | Zatrzymuje kontenery i czyści wolumeny |

---

## 💻 Użycie przez CLI `taskand`

Polecenie `taskand` jest dostępne bezpośrednio w terminalu (`~/.local/bin/taskand`):

```bash
# Wyświetlenie statusu i pomocy
taskand

# Dodanie zadania dla planisty GitHub (śledzi wykonanie na żywo)
taskand add "stwórz projekt w organizacji semcod z README"

# Dodanie zadania w tle (async)
taskand add -d "zadanie w tle"

# Automatyczne rozpoznanie intencji (np. czyszczenie)
taskand add "Usuń zbędny podkatalog taskand"

# Podgląd kolejki zadań (inbox) oraz wykonanych (done)
taskand tasks

# Pełna historia wykonania zadań oraz migawek (SHA-256)
taskand history

# Przywrócenie stanu z wybranej migawki (Rollback)
taskand rollback snap-t1789203598

# Utworzenie ręcznej migawki bezpieczeństwa
taskand snapshot taskand "Kopia zapasowa przed eksperymentem"

# Śledzenie logów na żywo
taskand logs

# Uruchomienie lokalnej strony landing
taskand web 8080
```

---

## ↺ Historia zadań, Migawki i Rollback

W katalogu `history/` system utrzymuje rejestr migawek stanu plików oraz sumy kontrolne SHA-256 każdego zarchiwizowanego pliku:

```text
history/
├── history.yaml            # Rejestr migawek i zrealizowanych zadań
└── snapshots/
    └── snap-t1789203598/   # Dedykowany punkt przywracania
        ├── manifest.json   # Manifest z sumami SHA-256 plików i całości
        └── files/          # Bezpieczna kopia danych (np. katalog taskand)
```

### Przywracanie stanu (Rollback):

1. Wyświetl dostępne punkty przywracania:
   ```bash
   taskand history
   # lub: make history
   ```
2. Przywróć wybrany stan z weryfikacją sumy SHA-256:
   ```bash
   taskand rollback snap-t1789203598
   # lub: make rollback ID=snap-t1789203598
   ```
   System automatycznie:
   * Obliczy sumy SHA-256 plików w migawce i porówna je z `manifest.json`.
   * Przywróci katalog lub pliki na ich pierwotne miejsce.
   * Odnotuje operację przywrócenia w rejestrze ewolucji.

---

## 📥 Alternatywne sposoby dodawania zadań

### 1. Bezpośrednio do pliku `tasks/inbox.yaml`

```bash
printf -- "- id: t001\n  typ: github-projekt\n  z: stwórz projekt w organizacji semcod z README\n" >> tasks/inbox.yaml
```

### 2. Przez HTTP Gateway (port 8077)

Bramka HTTP `taskand-gateway` nasłuchuje na porcie `8077` i automatycznie dopisuje zgłoszenia do kolejki:

```bash
curl -X POST http://localhost:8077/tasks \
  -H "Content-Type: application/json" \
  -d '{"id":"t002","typ":"github-projekt","z":"nowe repozytorium"}'
```

Sprawdzenie stanu bramki:
```bash
curl http://localhost:8077/health
# Odpowiedź: {"ok": true, "service": "taskand-gateway"}
```

---

## 🎯 Obsługiwane typy zadań

1. **`github-projekt`**:
   - Planista GLM-5.3 generuje strukturę repozytorium oraz plik `README.md`.
   - Proces potomny tworzy repozytorium GitHub za pomocą narzędzia `github-cli` (`gh`) wykorzystując poświadczenia hosta (`~/.config/gh`).
   - Usługa dopisywana jest dynamicznie do `docker-compose.yaml` jako `task-<id>`.
2. **`obserwuj`**:
   - Uruchamia lekki proces w `alpine:3.20` raportujący stan w zadanym interwale.
3. **`handover`**:
   - Przekazuje kontrolę nad `docker-compose` do potomka `orchestrator` po osiągnięciu limitu wersji.

---

## 🔑 Konfiguracja planisty GLM-5.3 (`.env`)

Skopiuj plik `.env.example` do `.env` i uzupełnij klucz API:

```env
TASKAND_LLM_API_KEY=twój_klucz_z_ai
TASKAND_LLM_ENDPOINT=https://api.z.ai/api/paas/v4/chat/completions
TASKAND_LLM_MODEL=glm-5.3
```

*Jeśli klucz nie zostanie podany, system działa w trybie planu lokalnego (bez połączenia z zewnętrznym API).*

---

## 📂 Struktura katalogów

```
.
├── Makefile                # Skróty poleceń administracyjnych
├── START-HERE.md           # Podręczny przewodnik szybkiego startu
├── Dockerfile              # Główny obraz bootstrap + controller (nucleus)
├── bootstrap/
│   └── Dockerfile          # Kopia obrazu bootstrap (sekcja 04)
├── docker-compose.yaml     # Definicja usług nucleus i gateway
├── gateway/
│   └── Dockerfile          # Bramka HTTP REST (:8077) w Python 3.13 Alpine
├── landing/
│   ├── Dockerfile          # Kontener Nginx serwujący stronę projektu
│   ├── index.html          # Samowystarczalna strona WWW (sekcje 01-04)
│   └── serve.sh            # Skrypt lokalnego serwowania bez dockera
├── tasks/
│   ├── inbox.yaml          # Kolejka zadań wejściowych
│   └── done.yaml           # Rejestr wykonanych zadań
├── answers/
│   └── taskand.answers.yaml # Zapisane odpowiedzi z onboardingu
├── evolution/              # Dockerfile-y generowane dynamicznie dla zadań
├── history/                # Rejestr migawek i punktów przywracania z sumami SHA-256
│   ├── history.yaml        # Metadane i historia zadań
│   └── snapshots/          # Zarchiwizowane dane wraz z manifest.json
├── log/                    # Logi ewolucji systemu
├── scripts/
│   └── history.py          # Narzędzie obsługi migawek i procedury rollback
├── taskand.cli             # Skrypt CLI instalowany w ~/.local/bin/taskand
└── taskand.sh              # Interaktywny instalator bootstrap
```
