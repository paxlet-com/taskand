# taskand-glm53 v1.5 — Samo-Replikujący się Ekosystem Organizmów (Standard v1.5)

Kompletna implementacja **Standardu taskand v1.5**: samo-replikujący się system organizmów, w którym bootstrap (zygota) czyta genom (`genome.yaml`) z rejestru git, powołuje autonomiczne organizmy, a każdy z nich może powoływać kolejne protokołem peer-to-peer (`proc://.../spawn/v1`). Wszystko jest zasobem URI (`proc://`, `session://`, `vault://`, `artifact:`), ewolucja podlega bramkom kwalifikacji w Digital Twin, a użytkownik komunikuje się z organizmami przez konwersacyjne CLI v1.5 lub Web Cockpit.

* Oficjalne repozytorium: **https://github.com/semcod/taskand-glm53**
* Kompletna specyfikacja Standardu v1.5: [docs/standard-v1.5.md](docs/standard-v1.5.md) oraz [STANDARD-v1.5.md](STANDARD-v1.5.md)
* Architektura federacji, LLM i rollbacków: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
* Standard zarządzania sekretami i sejfem Vault: [docs/SECRETS.md](docs/SECRETS.md)

---

## 🧬 Ekosystem Organizmów (Pakiety jako Autonomiczne Kapsuły)

W systemie taskand v1.5 każda paczka w `packages/` stanowi niezależny organizm z własnym manifestem `capsule.yaml`, uprawnieniami `grants.yaml`, procesami `proc://`, protokołem reprodukcji `spawn/v1` oraz interfejsem konwersacyjnym:

| Organizm (Paczka) | Alias CLI | Rola w ekosystemie | Kluczowe procesy URI | Zdolność Reprodukcji (Spawn) |
|---|---|---|---|---|
| **`taskand-developer`** | `taskand dev` | **Regeneracja i ewolucja**: generowanie procesów, autotesty, Digital Twin, dozbrajanie usług | `dev/chat`, `dev/codegen`, `dev/heal`, `developer/spawn` | **✓ CAN-SPAWN (`developer/spawn/v1`)** |
| **`taskand-doctor`** | `taskand doc` | **Strażnik zdrowia (SRE)**: ciągła diagnostyka WWW (:8090) i API (:8077), autoleczenie, trendy LB | `doctor/chat`, `doctor/diagnose`, `doctor/spawn` | **✓ CAN-SPAWN (`doctor/spawn/v1`)** |
| **`taskand-vault`** | `taskand sec` | **Sejf poświadczeń**: szyfrowanie AES-256-GCM, audyt dostępu, purpose-scoped grants | `vault/chat`, `vault/secrets`, `vault/spawn` | **✓ CAN-SPAWN (`vault/spawn/v1`)** |
| **`taskand-chat` & `web`**| `taskand chat`| **Zmysły i interakcja**: dialog z użytkownikiem, Web Speech API, sesje browsera, analizy stron | `chat/message`, `browser/session`, `flow/login`, `web/spawn` | **✓ CAN-SPAWN (`chat/spawn/v1`, `web/spawn/v1`)** |
| **`taskand-bootstrap`**| `bootstrap` | **Narodziny i rozruch (zygota)**: czytanie genomu, onboarding, przekazanie kontroli | `bootstrap/onboarding`, `bootstrap/handover`, `bootstrap/spawn` | **✓ CAN-SPAWN (`bootstrap/spawn/v1`)** |
| **`taskand-nginx`** | `taskand arm` | **Dozbrojona usługa zewnętrzna**: bezprzerwowy adapter HTTP (:8090) jako kapsuła | `nginx/status` | — (adapter zewnętrzny) |
| **`taskand-demo`** | `demo` | **Przykłady i szablony**: referencyjne procesy testowe | `hello-world/v1` | — (baza demonstracyjna) |

---

## 💬 Interfejs Konwersacyjny CLI (Standard v1.5)

```bash
# Rozmawiaj bezpośrednio z developerem (tworzenie procesów, arming, spawn potomków)
taskand dev "cześć, co potrafisz?"
taskand dev "stwórz proces liczący słowa"
taskand dev "dozbrój nginx na :8090"
taskand dev "stwórz vault"

# Rozmawiaj ze strażnikiem zdrowia doctor (diagnoza, autoleczenie, rekomendacje SRE)
taskand doc "sprawdź czy wszystko działa"
taskand doc "co nie działa?"
taskand doc "sprawdź czy potrzebujemy LB"

# Rozmawiaj z sejfem Vault (migracja tokenów LLM, audyt dostępu purpose-scoped)
taskand sec "migruj token llm"
taskand sec "kto miał dostęp?"

# Inspekcja ekosystemu i procesów
taskand procs                 # Pełna lista zarejestrowanych procesów proc:// we wszystkich rejestrach
taskand fed --can-spawn       # Weryfikacja federacji rejestrów i statusu zdolności spawn
taskand log 50                # Podgląd ostatnich 50 linii z dziennika ewolucji log/evolution.log
taskand proc "proc://taskand.dev/words/count/v1" '{"text": "ala ma kota"}'
```

---

## ⚡ Szybki start

```bash
# 1. Sprawdź 12/12 punktów konformacji Standardu v1.5
make conformance

# 2. Przetestuj wszystkie autonomiczne paczki i ich procesy kontraktowe
make packages-test

# 3. Zweryfikuj sumy SHA-256 w katalogu procesów
make verify

# 4. Sprawdź status federacji i zdolność reprodukcji
taskand fed --can-spawn
taskand procs
```

---

## 🛠️ Polecenia Makefile

| Komenda | Opis |
|---|---|
| `make conformance` | Automatyczny audyt 12/12 punktów Listy Sprawdzającej Standardu v1.5 |
| `make packages-test` | Uruchamia testy kontraktu, weryfikację sum i konformację dla wszystkich paczek |
| `make test` | Uruchamia testy kontraktu (`test.mjs`) procesów URI (fail-closed: 0/1/2) |
| `make verify` | Sprawdza sumy SHA-256 `bin.mjs` i `proc.yaml` względem `proc-catalog.json` |
| `make run URI=...` | Uruchamia wskazany proces URI z payloadem JSON przez stdin |
| `make pack` | Buduje archiwum `.tgz` paczki do `dist/` po pomyślnej walidacji konformacji |
| `make web` | Uruchamia stronę landing page i Web Cockpit na porcie 8090 |
| `make up` / `make down` | Uruchomienie / zatrzymanie kontenerów w tle (`docker compose`) |
| `make status` | Status aktywnych kontenerów i usług |
