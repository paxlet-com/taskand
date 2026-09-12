# taskand-glm53 v1.1 — Standard taskand v1.1, Federacja Rejestrów & Ekosystem Organizmów

Kompletna implementacja **Standardu taskand v1.1**: federacyjny ekosystem, w którym wszystko jest zasobem URI (`proc://`, `session://`, `artifact:`), każda paczka jest **autonomicznym organizmem** i rejestrem procesów, ewolucja podlega kwalifikacji w piaskownicy **Digital Twin**, a poświadczenia podlegają ścisłym regułom bezpieczeństwa.

* Oficjalne repozytorium: **https://github.com/semcod/taskand-glm53**
* Kompletna specyfikacja standardu: [docs/standard-v1.1.md](docs/standard-v1.1.md) oraz [STANDARD-v1.1.md](STANDARD-v1.1.md)
* Architektura federacji, LLM i rollbacków: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
* Standard zarządzania sekretami i tokenami: [docs/SECRETS.md](docs/SECRETS.md)

---

## 🧬 Ekosystem Organizmów (Pakiety jako Autonomiczne Kapsuły)

W systemie taskand każda paczka w `packages/` stanowi niezależny organizm z własnym manifestem `capsule.yaml`, uprawnieniami `grants.yaml`, procesami `proc://` oraz serwerem rejestru federacji `proc://.../registry/serve/v1`:

| Organizm (Paczka) | Rola w ekosystemie | Kluczowe procesy URI | Dostęp do LLM (GLM-5.3) |
|---|---|---|---|
| **`taskand-bootstrap`** | **Narodziny i rozruch**: weryfikacja środowiska, onboarding i przekazanie kontroli | `bootstrap/onboarding`, `bootstrap/handover` | Nie (deterministyczny start) |
| **`taskand-core`** | **Układ nerwowy**: demon nucleus, supervisor zadań i bramka REST API (:8077) | `controller`, `supervisor`, `gateway` | Tak (planista zadań przez `.env`) |
| **`taskand-chat` & `taskand-web`** | **Zmysły i mowa**: dialog z użytkownikiem, Web Speech API (PL), synteza głosu TTS | `chat/message`, `chat/voice`, `browser/session`, `web/navigate`, `web/analyze` | Kontekstowy przez proces czatu |
| **`taskand-developer`** | **Regeneracja i ewolucja**: generowanie procesów przez LLM, autotesty, Digital Twin | `dev/codegen`, `dev/plan`, `dev/heal`, `developer/test-auto` | **Tak (runtime API key do kodowania)** |
| **`taskand-doctor`** | **Strażnik zdrowia (SRE)**: ciągła diagnostyka WWW (:8090) i API (:8077), autoleczenie | `doctor/diagnose`, `doctor/prescribe` | **Nie (deleguje naprawę do developera)** |
| **`taskand-demo`** | **Przykłady i szablony**: referencyjne procesy testowe | `hello-world/v1` | Nie |

---

## ⚡ Szybki start

```bash
# 1. Sprawdź 9/9 punktów konformacji Standardu v1.0 / v1.1
make conformance

# 2. Przetestuj wszystkie autonomiczne paczki (bootstrap, chat, developer, doctor, web, demo)
make packages-test

# 3. Zweryfikuj sumy SHA-256 w katalogu procesów
make verify

# 4. Spakuj paczkę kapsuły do formatu dystrybucyjnego .tgz
make pack

# 5. Uruchom Web Cockpit ze sterowaniem głosowym i diagnostyką
make web
# → Otwórz w przeglądarce: http://localhost:8090
```

---

## 🌐 Uniwersalna Bramka REST API (port 8077)

Kontener `taskand-gateway` udostępnia pełne API dla frontendu, procesów zewnętrznych i systemów federacyjnych:

| Metoda i Endpoint | Opis operacji | Przykładowe wywołanie |
|---|---|---|
| `GET /api/federation` | Zwraca listę wszystkich 6 rejestrów federacji i procesów | `curl http://localhost:8077/api/federation` |
| `POST /api/chat` | Wywołuje proces konwersacji `proc://taskand.dev/chat/message/v1` | `curl -X POST :8077/api/chat -d '{"message":"..."}'` |
| `POST /api/voice` | Translacja mowy Web Speech API przez `proc://taskand.dev/chat/voice/v1` | `curl -X POST :8077/api/voice -d '{"transcript":"..."}'` |
| `POST /api/proc/call` | Wywołuje dowolny proces URI (JSON stdin -> JSON stdout) | `curl -X POST :8077/api/proc/call -d '{"uri":"..."}'` |
| `GET /api/doctor` | Raport diagnostyczny zdrowia stron i usług | `curl http://localhost:8077/api/doctor` |
| `POST /api/doctor` | Diagnostyka z automatycznym zleceniem naprawy do dewelopera | `curl -X POST :8077/api/doctor -d '{"autoSubmit":true}'` |
| `POST /api/restart` | Bezpieczny restart kontenera (np. landing :8090) z weryfikacją | `curl -X POST :8077/api/restart -d '{"service":"landing"}'` |
| `GET /api/tasks` | Lista zadań w kolejce `inbox.yaml` oraz wykonanych `done.yaml` | `curl http://localhost:8077/api/tasks` |
| `POST /api/tasks` | Dodanie nowego zadania do wykonania | `curl -X POST :8077/api/tasks -d '{"z":"..."}'` |
| `POST /api/twin` | Uruchomienie testu w piaskownicy Digital Twin | `curl -X POST :8077/api/twin -d '{"prompt":"..."}'` |
| `POST /api/rollback` | Przywrócenie stanu z wybranej migawki | `curl -X POST :8077/api/rollback -d '{"id":"snap-..."}'` |

---

## 🔒 Bezpieczeństwo, Tokeny LLM i Reguły Restartu

Szczegółowy opis w [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) oraz [docs/SECRETS.md](docs/SECRETS.md):

1. **Dostęp do tokenu GLM-5.3**:
   - Klucz API znajduje się wyłącznie w pliku `.env` na hoście i jest montowany w runtime.
   - `taskand-developer` posiada dostęp do tokenu, aby generować kod (`dev/codegen`) i tworzyć łatki naprawcze.
   - `taskand-doctor` **nie posiada bezpośredniego dostępu do klucza LLM** (Zasada Najmniejszych Uprawnień). Doctor wykonuje szybkie, deterministyczne testy HTTP i w razie problemu **zleca zadanie `evolve-fix` deweloperowi**.
2. **Restart usług z poziomu interfejsu Web (:8090)**:
   - Zgodnie z zasadą `self-restart = DENY`, kontener WWW (`taskand-landing`) nie ma dostępu do gniazda Dockera (`docker.sock`).
   - Użytkownik zleca restart z poziomu przeglądarki lub komendy głosowej (*"zrestartuj stronę"*).
   - Przeglądarka wysyła żądanie do `taskand-gateway`, która weryfikuje uprawnienia, wykonuje restart i odpytuje `taskand-doctor`, aby upewnić się, że usługa wstała i odpowiada kodem HTTP 200.
3. **Procedura automatycznego rollbacku**:
   - Jeśli usługa po restarcie nie wstanie w czasie 3 sekund lub zwróci błąd, bramka API i `taskand-doctor` natychmiast zgłaszają awarię `502 Bad Gateway` i przywracają poprzednią migawkę (`history.py rollback <snap_id>`).

---

## 🛠️ Polecenia Makefile

| Komenda | Opis |
|---|---|
| `make conformance` | Automatyczny audyt 9/9 punktów Listy Sprawdzającej Standardu |
| `make packages-test` | Uruchamia testy, weryfikację sum i konformację dla wszystkich 6 paczek |
| `make test` | Uruchamia testy kontraktu (`test.mjs`) procesów URI (fail-closed: 0/1/2) |
| `make verify` | Sprawdza sumy SHA-256 `bin.mjs` i `proc.yaml` względem `proc-catalog.json` |
| `make run URI=...` | Uruchamia wskazany proces URI z payloadem JSON przez stdin |
| `make pack` | Buduje archiwum `.tgz` paczki do `dist/` po pomyślnej walidacji konformacji |
| `make web` | Uruchamia stronę landing page i Web Cockpit na porcie 8090 |
| `make up` / `make down` | Uruchomienie / zatrzymanie kontenerów w tle (`docker compose`) |
| `make status` | Status aktywnych kontenerów i usług |

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

Przywrócenie stanu z wybranej migawki:
```bash
taskand rollback snap-t1789203598
# lub przez API:
curl -X POST http://localhost:8077/api/rollback -H "Content-Type: application/json" -d '{"id":"snap-t1789203598"}'
```
