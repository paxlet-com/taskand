# Standard taskand v1.4 — Konwersacyjny Interfejs CLI/Web z Organizmami

> User rozmawia z **każdym organizmem bezpośrednio** — przez shell CLI lub Web Cockpit. Każdy prompt to **proces wewnętrzny proc://** który jest tłumaczony na zadanie. Developer tworzy, doctor diagnozuje, vault zarządza sekretami — wszystko przez **konwersację**, nie przez manualne komendy make.

---

## 1 · Architektura konwersacyjna

```
user@shell:~$ taskand dev "dozbrój nginx na :8090"
user@shell:~$ taskand doctor "sprawdź czy wszystko działa"
user@shell:~$ taskand vault "migruj token llm do vaulta"
  │
  ▼
┌─────────────────────────────────────────────────┐
│  taskand CLI (bin/taskand)                      │
│  → wykrywa organizm z komendy (dev/doctor/vault)│
│  → tworzy kopertę CloudEvents                   │
│  → POST gateway:8077/api/organism/<name>/chat   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  gateway (:8077)                                 │
│  → route: /api/organism/<name> → organism        │
│  → wywołuje proc://…/<organism>/chat/v1          │
│  → zwraca JSON (odpowiedź organizmu)             │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  ORGANIZM (np. developer)                       │
│  proc://taskand.dev/dev/chat/v1                 │
│  → parsuje prompt (intent)                      │
│  → deleguje do właściwego procesu:              │
│     dev/codegen, dev/plan, dev/heal             │
│  → zwraca odpowiedź tekstową + status           │
└─────────────────────────────────────────────────┘
```

### Kluczowa zasada

> **Każdy prompt = proces proc://**. Komenda `taskand dev "dozbrój nginx"` wywołuje `proc://taskand.dev/dev/chat/v1` który wewnętrznie deleguje do `dev/codegen` (tworzenie adaptera). User NIE musi znać URI — CLI tłumaczy naturalny język na właściwy proces.

---

## 2 · CLI: `taskand` — komenda główna

### Instalacja

```bash
# Po make setup — bin/taskand jest w PATH
# (symlink do scripts/taskand-cli.sh)
taskand --help
```

### Struktura komendy

```bash
taskand <organizm> "<prompt>"
         ↑          ↑
         │          └─ naturalny język (co chcesz zrobić)
         └─ organizm docelowy: dev · doctor · vault · chat · web
```

### Aliasy (krótkie formy)

| Pełna komenda | Alias | Organizm |
|---------------|-------|----------|
| `taskand developer "..."` | `taskand dev "..."` | developer |
| `taskand doctor "..."` | `taskand doc "..."` | doctor |
| `taskand vault "..."` | `taskand sec "..."` | vault |
| `taskand chat "..."` | `taskand c "..."` | chat |
| `taskand web "..."` | `taskand w "..."` | web |
| `taskand federation` | `taskand fed` | federacja (status) |
| `taskand all` | `taskand status` | wszystkie organizmy |

---

## 3 · Konwersacja z developerem

### Dozbrajanie istniejącej usługi

```bash
# user@shell
taskand dev "dozbrój nginx działający na localhost:8090"
```

```
[developer] Przyjąłem zadanie: dozbrój nginx na localhost:8090.
[developer] Plan:
  1. Analiza usługi: nginx, port :8090
  2. Generuję adapter: proc://…/nginx/status/v1
  3. Test kontraktu: fail-closed
  4. Rejestracja w moim registry + federacja
[developer] Rozpoczynam...

[dev/codegen] Generuję adapter (lokalnie, bez LLM — brak klucza):
[dev/codegen] → bin.mjs: fetch http://localhost:8090/healthz → JSON
[dev/codegen] → proc.yaml: binding (node, adapters/status.template)
[dev/codegen] → test.mjs: fail-closed (exit 0/1/2)

[dev/test] Test kontraktu: ✓ (fail-closed zachowany)

[dev/register] Tworzę kapsułę: packages/nginx/
[dev/register] → capsule.yaml, grants.yaml, proc-catalog.json
[dev/register] → git commit: "arm: nginx → kapsuła taskand"
[dev/register] → proc://taskand.dev/nginx/status/v1 zarejestrowany ✓

[developer] Gotowe! Nginx (:8090) działa bez przerwy.
            Adapter dostępny: proc://taskand.dev/nginx/status/v1
            Doctor może go teraz diagnozować.
            Sprawdź: taskand doc "sprawdź nginx"
```

---

## 4 · Konwersacja z doctorem

### Pełna diagnoza

```bash
taskand doc "sprawdź czy wszystko działa"
```

```
[doctor] Rozpoczynam pełną diagnozę...
[doctor] Sprawdzam: gateway :8077, landing :8090, nginx :8090

[doctor] gateway :8077 → 200 OK ✓
[doctor] landing :8090 → 200 OK ✓
[doctor] nginx :8090   → 200 OK ✓ (przez adapter!)

[doctor] Federacja: 7 rejestrów (bootstrap, chat, dev, doc, web, demo, nginx)

[doctor] Wynik: healthy ✓ (3/3 checks passed)
[doctor] Wszystkie usługi działają poprawnie.
```

---

## 5 · Konwersacja z vaultem

```bash
taskand sec "migruj token llm/api-key z .env do vaulta"
```

```
[vault] Migracja sekretu: llm/api-key
[vault] 1. Odczyt z .env: TASKAND_LLM_API_KEY=sk-...
[vault] 2. Zapis do vault: AES-256-GCM, scope: llm
[vault] 3. Restart developer (z VAULT_URL zamiast KEY)
[vault] 4. Weryfikacja: developer może pobrać token ✓

[vault] Token zmigrowany! .env pozostaje jako fallback.
[vault] Developer pobiera teraz z vault: purpose=codegen
[vault] Grant dla doctora: purpose=diagnosis (dostępny)
```

---

## 6 · Web Cockpit — rozmowa z organizmami

### Wybór organizmu w Web Cockpit

| Przycisk | Organizm | Co możesz powiedzieć |
|----------|----------|---------------------|
| **developer** | dev | "stwórz proces...", "dozbrój...", "popraw..." |
| **doctor** | doc | "sprawdź...", "diagnozuj...", "co nie działa?" |
| **vault** | sec | "migruj token...", "pokaż dostęp...", "rotuj..." |
| **chat** | c | cokolwiek — czat ogólny |
| **wszyscy** | all | diagnoza + raport całości |

---

## 7 · Jak prompt staje się procesem

### Pipeline: naturalny język → proc://

```
user: "dozbrój nginx na :8090"
  │
  ▼
[proc://…/dev/chat/v1] (proces konwersacyjny developera)
  │
  ├── parsuj prompt → intent: "arm-service"
  │   target: "nginx", url: "localhost:8090"
  │
  ├── utwórz zadanie:
  │   { type: "evolve-create", description: "nginx adapter",
  │     params: {service: "nginx", url: ":8090"} }
  │
  ├── deleguj do dev/codegen (WEWNĄTRZ developera):
  │   printf '%s' '{"service":"nginx","url":"localhost:8090"}' |
  │     node /app/proc/dev/codegen/taskand.dev/v1/bin.mjs
  │
  ├── zbierz wynik:
  │   { adapter: "bin.mjs", test: "✓", capsule: "packages/nginx/" }
  │
  └── odpowiedz userowi (naturalny język):
      "Gotowe! Nginx (:8090) działa bez przerwy.
       Adapter: proc://taskand.dev/nginx/status/v1"
```

---

## 8 · CLI: pełny podręcznik

```bash
taskand dev "<prompt>"       # rozmowa z developerem
taskand doc "<prompt>"       # rozmowa z doctorem
taskand sec "<prompt>"       # rozmowa z vaultem
taskand c "<prompt>"         # czat ogólny
taskand status               # wszystkie organizmy + health
taskand fed                  # federacja (lista rejestrów)
taskand procs                # wszystkie procesy
taskand proc <uri> "<json>"  # wywołaj proces przez URI
```

---

> **Standard taskand v1.4** — konwersacyjny interfejs CLI i Web, w którym user komunikuje się bezpośrednio z poszczególnymi organizmami, a każdy prompt to wywołanie procesu `proc://`. Dozbrajanie usług zachowuje ciągłość ich pracy, a sejf Vault gwarantuje purpose-scoped dystrybucję poświadczeń.
