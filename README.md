# taskand-glm53 v1.0.0 — Standard taskand v1.0 & Autonomiczne Procesy URI

Pełna implementacja **Standardu taskand v1.0**: w którym wszystko jest zasobem URI (`proc://`, `session://`, `artifact:`), procesy wykonują się fail-closed przez stdin/stdout JSON, ewolucja podlega kwalifikacji w piaskownicy **Digital Twin**, a poświadczenia podlegają ścisłym regułom bezpieczeństwa (patrz [docs/SECRETS.md](docs/SECRETS.md)).

Oficjalne repozytorium: **https://github.com/semcod/taskand-glm53**

---

## ⚡ Szybki start (Standard v1.0)

```bash
# 1. Sprawdź 9/9 punktów konformacji Standardu v1.0
make conformance

# 2. Uruchom testy kontraktów wszystkich procesów URI
make test

# 3. Zweryfikuj sumy SHA-256 w katalogu procesów
make verify

# 4. Uruchom proces URI przez uniwersalny runner
make run URI=proc://taskand.dev/flow/login/v1 PAYLOAD='{"username":"admin","siteUrl":"https://semcod.com"}'

# 5. Spakuj paczkę kapsuły do formatu dystrybucyjnego .tgz
make pack

# 6. Uruchom Web Cockpit ze sterowaniem głosowym
make web
# → http://localhost:8090
```

---

## 🛠️ Polecenia Makefile — Pełne API Standardu v1.0

### Standardowe cele v1.0 (Wymagane specyfikacją):
| Komenda | Opis |
|---|---|
| `make test` | Uruchamia testy kontraktu (`test.mjs`) wszystkich procesów w `proc/` (fail-closed) |
| `make pack` | Buduje archiwum `.tgz` paczki do `dist/` po pomyślnej walidacji konformacji |
| `make verify` | Sprawdza sumy SHA-256 `bin.mjs` i `proc.yaml` względem `proc-catalog.json` |
| `make run URI=...` | Uruchamia wskazany proces URI z payloadem JSON przez stdin |
| `make observe` | Raportuje stan wykonania i historię procesów w formacie JSONL |
| `make extract` | Wypisuje manifest `capsule.yaml` i `proc-catalog.json` |
| `make deploy` | Pipeline wdrożenia paczki (testy -> twin qualification -> tag) |
| `make rollback` | Przywraca stan z wyznaczonej migawki lub tagu git |
| `make conformance` | Automatyczny audyt 9/9 punktów Listy Sprawdzającej Standardu v1.0 |

### Cele operacyjne i pomocnicze:
| Komenda | Opis |
|---|---|
| `make up` | Uruchamia usługi taskand w tle (`docker compose up -d`) |
| `make down` | Zatrzymuje kontenery (`docker compose down`) |
| `make restart` | Restartuje kontenery (`docker compose restart`) |
| `make status` / `make ps` | Sprawdza status usług (`docker compose ps`) |
| `make web` | Uruchamia stronę landing page i Web Cockpit na porcie 8090 |
| `make logs` | Śledzi logi kontrolera nucleus na żywo |
| `make add TASK="..."` | Dodaje zadanie do kolejki (automatycznie rozpoznaje typ) |
| `make twin ID=...` | Testuje proces w cyfrowym bliźniaku (Digital Twin Sandbox) |
| `make gateway-health` | Sprawdza stan uniwersalnej bramki REST API (port 8077) |

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

## 🎙️ Web Cockpit & Sterowanie Głosowe (port 8090)

Interfejs webowy dostępny pod adresem **`http://localhost:8090`** oferuje 100% parzystości z poleceniami CLI:
* **Sterowanie głosem (Web Speech API)**: rozpoznawanie mowy w języku polskim (`pl-PL`) z przyciskiem `🎙️ Mów do taskand`.
* **Polecenia głosowe**: rozpoznaje intencje sterujące cockpitem (*„pokaż logi”*, *„pokaż zadania”*, *„cyfrowy bliźniak”*, *„cofnij”*, *„historia”*) oraz dyktowanie dowolnych zadań.
* **Synteza mowy (TTS)**: potwierdza przyjęcie zadań i status wykonania głosem.
* **Szybkie akcje**: przyciski dla `Digital Twin Test`, `Rollback`, `Historia & Dockerfile`, `Kolejka zadań` i `Logi kontrolera`.

---

## 🌐 Uniwersalna Bramka REST API (port 8077)

Usługa `taskand-gateway` nasłuchuje na porcie `8077` z nagłówkami CORS (`Access-Control-Allow-Origin: *`):

| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/health` | Status i wersja usługi bramki |
| `GET` | `/api/tasks` | Lista zadań: kolejka `inbox` oraz wykonane `done` |
| `POST` | `/api/tasks` | Dodanie zadania: `{"z": "opis zadania"}` |
| `GET` | `/api/logs` | Strumień ostatnich wpisów z `log/evolution.log` |
| `GET` | `/api/history` | Historia zadań, powiązania Dockerfile oraz punkty przywracania |
| `POST` | `/api/twin` | Uruchomienie testu procesu w Digital Twin Sandbox |
| `POST` | `/api/rollback` | Przywrócenie plików z migawki: `{"id": "snap-xxx"}` |

### Przykład wysłania zadania przez cURL:

```bash
curl -X POST http://localhost:8077/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"z": "wypchnij zmiany na github"}'
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

## 📂 Struktura katalogów — Standard taskand v1.0

```text
.
├── capsule.yaml                    # Główny manifest kapsuły v1.0 (role, procesy, ewolucja)
├── grants.yaml                     # Polityka uprawnień i zakazy (policy-write, git-push)
├── proc-catalog.json               # Wiązania URI -> ścieżki + SHA-256 (bin.mjs, proc.yaml, test.mjs)
├── environment.yaml                # Deklaratywny manifest środowiska i infrastruktury
├── Makefile                        # Standardowe API: test, pack, verify, run, conformance...
├── proc/                           # Drzewo procesów: proc/<zdolność>/<organizacja>/<wersja>/
│   ├── flow/login/taskand.dev/v1/          # bin.mjs, proc.yaml, test.mjs (orkiestrator URI)
│   ├── browser/session/taskand.dev/v1/     # bin.mjs, proc.yaml, test.mjs (sesje przeglądarki)
│   ├── web/navigate/taskand.dev/v1/        # bin.mjs, proc.yaml, test.mjs (nawigacja i CAS)
│   └── web/analyze/taskand.dev/v1/         # bin.mjs, proc.yaml, test.mjs (analiza treści)
├── schemas/                        # Schematy walidacji JSON: envelope, browser, capsule
├── claims/                         # Roszczenia wiedzy o środowisku (rejestr ze stanami)
├── twin/                           # Cyfrowy bliźniak: bramki Gate A & Gate B, twin.compose
├── strategy/                       # Strategie decyzyjne planistów
├── skills/                         # Deklaracje umiejętności operacyjnych
├── patches/                        # Wymiana poprawek w standardzie git format-patch
├── dist/                           # Pakiety dystrybucyjne .tgz budowane przez make pack
├── docs/
│   └── SECRETS.md                  # Architektura bezpieczeństwa haseł i sekretów (Vault/Env)
├── log/
│   ├── conversations.jsonl         # Dziennik pamięci i interakcji z LLM (wellmanifest/logs@v1)
│   └── evolution.log               # Logi kontrolera nucleus
├── scripts/
│   ├── planner.py                  # Wstrzykiwanie pamięci i środowiska do LLM (wellmanifest/llm)
│   ├── taskand-runner.mjs          # Uniwersalny launcher procesów URI
│   ├── taskand-new-pkg.sh          # Generator zgodnych paczek 9/9
│   └── verify-conformance.mjs      # Walidator 9/9 punktów konformacji Standardu
├── gateway/                        # Bramka HTTP REST (:8077) z CORS
└── landing/                        # Web Cockpit i Nginx (:8090) z Web Speech API
```

---

## 🔒 Bezpieczeństwo i Sekrety (Hasła, Klucze, Vault)

Zgodnie z zasadą nr 7 Standardu v1.0, sekrety **nigdy** nie są zapisywane w Dockerfile, commitach ani plikach obrazów:
* **Runtime Environment**: przekazywanie przez zmienne środowiskowe wyłącznie w momencie `docker run` / `docker-compose.yaml` (klucze w `.env` ignorowanym przez git).
* **Vault Agent**: dynamiczne pobieranie tokenów do pamięci RAM (`tmpfs` w `/vault/secrets`).
* **BuildKit Secret Mount**: montaż poświadczeń podczas budowy (`--mount=type=secret`) bez zapisu w warstwach obrazu.
* **Read-Only Host Mount**: bezpieczny montaż poświadczeń CLI (np. `~/.config/gh:ro`) z uprawnieniami `0600`.

Pełną dokumentację ze wzorcami wdrożeniowymi znajdziesz w pliku [docs/SECRETS.md](docs/SECRETS.md).

