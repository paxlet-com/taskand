# taskand-glm53 v1.4 — Standard taskand v1.4: Konwersacyjny Interfejs CLI/Web, Ekosystem Organizmów & Security Vault

Kompletna implementacja **Standardu taskand v1.4**: federacyjny ekosystem, w którym wszystko jest zasobem URI (`proc://`, `session://`, `artifact:`), a użytkownik komunikuje się **bezpośrednio z każdym autonomicznym organizmem** przez CLI (`taskand <organizm> "prompt"`) lub Web Cockpit. Poświadczenia i tokeny LLM są chronione przez dedykowany sejf **`taskand-vault`** w oparciu o uprawnienia purpose-scoped (`developer:codegen`, `doctor:diagnosis`).

* Oficjalne repozytorium: **https://github.com/semcod/taskand-glm53**
* Kompletna specyfikacja Standardu v1.4: [docs/standard-v1.4.md](docs/standard-v1.4.md) oraz [STANDARD-v1.4.md](STANDARD-v1.4.md)
* Architektura federacji, LLM i rollbacków: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
* Standard zarządzania sekretami i sejfem Vault: [docs/SECRETS.md](docs/SECRETS.md)

---

## 🧬 Ekosystem Organizmów (Pakiety jako Autonomiczne Kapsuły)

W systemie taskand każda paczka w `packages/` stanowi niezależny organizm z własnym manifestem `capsule.yaml`, uprawnieniami `grants.yaml`, procesami `proc://` oraz interfejsem konwersacyjnym:

| Organizm (Paczka) | Alias CLI | Rola w ekosystemie | Kluczowe procesy URI | Zarządzanie Tokenem LLM (GLM-5.3) |
|---|---|---|---|---|
| **`taskand-developer`** | `taskand dev` | **Regeneracja i ewolucja**: generowanie procesów przez LLM, autotesty, Digital Twin, dozbrajanie usług | `dev/chat`, `dev/codegen`, `dev/plan`, `dev/heal`, `developer/test-auto` | **Izolowany w Vault (`purpose=codegen`)** |
| **`taskand-doctor`** | `taskand doc` | **Strażnik zdrowia (SRE)**: ciągła diagnostyka WWW (:8090) i API (:8077), autoleczenie, trendy | `doctor/chat`, `doctor/diagnose`, `doctor/prescribe` | **Dostęp brokerski w Vault (`purpose=diagnosis`)** |
| **`taskand-vault`** | `taskand sec` | **Sejf poświadczeń**: szyfrowanie AES-256-GCM, migracja z `.env`, audyt dostępu, purpose grants | `vault/chat`, `vault/secrets` | **Główny dysponent i broker poświadczeń** |
| **`taskand-chat` & `web`**| `taskand chat`| **Zmysły i mowa**: dialog z użytkownikiem, Web Speech API (PL), synteza TTS, analiza stron | `chat/message`, `chat/voice`, `browser/session`, `flow/login` | Kontekstowy przez proces czatu |
| **`taskand-nginx`** | `taskand arm` | **Dozbrojona usługa zewnętrzna**: bezprzerwowy adapter HTTP (:8090) jako kapsuła | `nginx/status` | Nie wymaga tokenu |
| **`taskand-bootstrap`**| `bootstrap` | **Narodziny i rozruch**: onboarding, weryfikacja środowiska i przekazanie kontroli | `bootstrap/onboarding`, `bootstrap/handover` | Deterministyczny start |
| **`taskand-demo`** | `demo` | **Przykłady i szablony**: referencyjne procesy testowe | `hello-world/v1` | Nie |

---

## 💬 Interfejs Konwersacyjny CLI (Standard v1.4)

```bash
# Rozmawiaj bezpośrednio z developerem (dozbrajanie usług, tworzenie procesów)
taskand dev "dozbrój nginx na :8090"
taskand dev "stwórz nowy proces proc://taskand.dev/auth/v1"

# Rozmawiaj ze strażnikiem zdrowia doctor (diagnoza, autoleczenie, trendy SRE)
taskand doc "sprawdź stan całego systemu"
taskand doc "coś nie działa ze stroną WWW"

# Rozmawiaj z sejfem Vault (migracja tokenów LLM, audyt dostępu)
taskand sec "migruj token llm do vaulta"
taskand sec "pokaż audyt uprawnień"

# Rozmowa z asystentem czatu i kolejkowanie zadań
taskand chat "jaki jest aktualny status środowiska?"

# Szybkie dozbrojenie dowolnej działającej usługi w trybie zero-downtime:
taskand arm nginx 8090
```

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
