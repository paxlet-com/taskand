# taskand-glm53 v1.6 — Multi-Device + Digital Twin + noVNC (Standard v1.6)

Kompletna implementacja **Standardu taskand v1.6**: samo-replikujący się system organizmów w architekturze Multi-Device Mesh. Bootstrap na stacji roboczej (master) powołuje bootstrapy na urządzeniach zdalnych (worker RPi5/Fedora) oraz wirtualnych maszynach (Digital Twin). Przez nie kontroluje sprzęt, usługi, pliki oraz sesje przeglądarki (noVNC z CAS screenshotami). Wszystko jest zasobem URI (`proc://`, `session://`, `vault://`, `artifact://`), ewolucja podlega bramkom kwalifikacji w Digital Twin, a historia zdarzeń i rollback działają ponad wszystkimi węzłami sieci.

* Oficjalne repozytorium: **https://github.com/semcod/taskand-glm53**
* Kompletna specyfikacja Standardu v1.6: [docs/standard-v1.6.md](docs/standard-v1.6.md) oraz [STANDARD-v1.6.md](STANDARD-v1.6.md)
* Standard v1.5: [docs/standard-v1.5.md](docs/standard-v1.5.md) | Standard v1.4: [docs/standard-v1.4.md](docs/standard-v1.4.md) | Standard v1.1: [docs/standard-v1.1.md](docs/standard-v1.1.md)
* Architektura federacji, LLM i rollbacków: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
* Standard zarządzania sekretami i sejfem Vault: [docs/SECRETS.md](docs/SECRETS.md)

---

## 🧬 Ekosystem Organizmów (Pakiety jako Autonomiczne Kapsuły)

W systemie taskand v1.6 każda paczka w `packages/` stanowi niezależny organizm z własnym manifestem `capsule.yaml`, uprawnieniami `grants.yaml`, procesami `proc://`, protokołem reprodukcji `spawn/v1` oraz interfejsem konwersacyjnym:

| Organizm (Paczka) | Alias CLI | Rola w ekosystemie | Kluczowe procesy URI | Zdolność Reprodukcji (Spawn) |
|---|---|---|---|---|
| **`taskand-developer`** | `taskand dev` | **Regeneracja i ewolucja**: generowanie procesów, autotesty, Digital Twin, dozbrajanie usług | `dev/chat`, `dev/codegen`, `dev/heal`, `developer/spawn` | **✓ CAN-SPAWN (`developer/spawn/v1`)** |
| **`taskand-doctor`** | `taskand doc` | **Strażnik zdrowia (SRE)**: ciągła diagnostyka WWW (:8090) i API (:8077), autoleczenie, trendy LB | `doctor/chat`, `doctor/diagnose`, `doctor/spawn` | **✓ CAN-SPAWN (`doctor/spawn/v1`)** |
| **`taskand-vault`** | `taskand sec` | **Sejf poświadczeń**: szyfrowanie AES-256-GCM, audyt dostępu, purpose-scoped grants | `vault/chat`, `vault/secrets`, `vault/spawn` | **✓ CAN-SPAWN (`vault/spawn/v1`)** |
| **`taskand-file-ops`** | `taskand file` | **Zarządca plików zdalnych**: odczyt, zapis, listowanie i snapshoty CAS na urządzeniach mesh | `file/ops`, `file-ops/chat`, `file-ops/spawn` | **✓ CAN-SPAWN (`file-ops/spawn/v1`)** |
| **`taskand-hw-monitor`** | `taskand hw` | **Telemetria sprzętu**: monitorowanie CPU, temperatury, dysku i stanów GPIO | `hw/monitor`, `hw-monitor/chat`, `hw-monitor/spawn` | **✓ CAN-SPAWN (`hw-monitor/spawn/v1`)** |
| **`taskand-web` & `chat`**| `taskand chat` / `browser` | **Zmysły i interakcja**: sesje noVNC, screenshoty CAS, dialog z użytkownikiem | `browser/session`, `chat/message`, `flow/login`, `web/spawn` | **✓ CAN-SPAWN (`chat/spawn/v1`, `web/spawn/v1`)** |
| **`taskand-bootstrap`**| `taskand boot` | **Narodziny i rozruch (zygota)**: cross-bootstrap remote SSH, provisioning VM | `bootstrap/onboarding`, `bootstrap/handover`, `bootstrap/spawn` | **✓ CAN-SPAWN (`bootstrap/spawn/v1`)** |
| **`taskand-nginx`** | `taskand arm` | **Dozbrojona usługa zewnętrzna**: bezprzerwowy adapter HTTP (:8090) jako kapsuła | `nginx/status` | — (adapter zewnętrzny) |
| **`taskand-demo`** | `demo` | **Przykłady i szablony**: referencyjne procesy testowe | `hello-world/v1` | — (baza demonstracyjna) |

---

## 💬 Interfejs Konwersacyjny CLI (Standard v1.6)

```bash
# 1. Zarządzanie urządzeniami (Multi-Device Mesh)
taskand devices                       # Tabela skonfigurowanych urządzeń (master, worker, digital twin VM)
taskand devices --health              # Odpytanie o stan zdrowia i ping wszystkich węzłów

# 2. Cross-bootstrap (Powoływanie węzłów zdalnych i VM)
taskand boot "spawn worker on rpi5@192.168.1.50"
taskand boot "spawn worker on vm-test@localhost"

# 3. Zdalna przeglądarka (noVNC + CAS Screenshots)
taskand browser "otwórz https://example.com na rpi5 i zrób zrzut ekranu"
taskand browser "kliknij Zaloguj na vm-test"

# 4. Operacje na plikach na urządzeniu zdalnym
taskand file "pokaż pliki w /home/taskand na rpi5"
taskand file "przeczytaj /etc/os-release na vm-test"
taskand file "zapisz config.json w /home/taskand/app na rpi5"

# 5. Monitorowanie sprzętu (CPU, Temperatura, GPIO)
taskand hw "stan sprzętu na rpi5"
taskand hw "ustaw pin 17 na HIGH na rpi5"

# 6. Dziennik zdarzeń, rollback i audyt cross-device
taskand log --cross-device            # Agregacja logów ze wszystkich węzłów mesh
taskand rollback --device rpi5 --to "14:23:04" # Przywrócenie stanu z migawki CAS
taskand audit --all-devices           # Tabela dostępu i bezpieczeństwa per urządzenie

# 7. Standardowe komendy organizmów (dev, doc, sec, fed)
taskand dev "stwórz proces liczący słowa"
taskand dev "dozbrój nginx na :8090"
taskand doc "sprawdź czy wszystko działa"
taskand sec "migruj token llm"
taskand fed --can-spawn               # Weryfikacja zdolności samoreplikacji (8/8 organizmów)
taskand procs                         # 45 zarejestrowanych procesów proc:// w federacji
```

---

## ⚡ Szybki start i walidacja

```bash
# 1. Sprawdź 14/14 punktów konformacji Standardu v1.6
make conformance

# 2. Przetestuj wszystkie 10 autonomicznych paczek i ich procesy kontraktowe
make packages-test

# 3. Zweryfikuj sumy SHA-256 w katalogach procesów
make verify

# 4. Sprawdź status urządzeń i federacji
taskand devices --health
taskand fed --can-spawn
```

---

## 🛠️ Polecenia Makefile

| Komenda | Opis |
|---|---|
| `make conformance` | Automatyczny audyt 14/14 punktów Listy Sprawdzającej Standardu v1.6 |
| `make packages-test` | Uruchamia testy kontraktu, weryfikację sum i konformację dla wszystkich 10 paczek |
| `make test` | Uruchamia testy kontraktu (`test.mjs`) procesów URI (fail-closed: 0/1/2) |
| `make verify` | Sprawdza sumy SHA-256 `bin.mjs` i `proc.yaml` względem `proc-catalog.json` |
| `make run URI=...` | Uruchamia wskazany proces URI z payloadem JSON przez stdin |
| `make pack` | Buduje archiwum `.tgz` paczki do `dist/` po pomyślnej walidacji konformacji |
| `make web` | Uruchamia stronę landing page i Web Cockpit na porcie 8090 |
| `make up` / `make down` | Uruchomienie / zatrzymanie kontenerów w tle (`docker compose`) |
| `make status` | Status aktywnych kontenerów i usług |
