# Standard taskand v2.2 — Planowanie Złożonych Zadań i Kontrolowana Orkiestracja

> **taskand v2.2** wprowadza deterministyczną dekompozycję złożonych zadań wieloetapowych: **Planner (proponuje) → Walidator + Resolver (weryfikuje i zatwierdza) → Orkiestrator (trwale i asynchronicznie wykonuje)**. Rozwiązuje 12 kluczowych błędów architektonicznych poprzednich wersji: eliminuje fałszywe fallbacki, blokuje kroki zależne po błędzie, zapewnia łańcuchowy przepływ danych (`deps` = data flow), izoluje środowisko wykonawcze od wycieków sekretów oraz zapisuje stan wykonania na dysku (`log/orchestrations/`).

---

## Spis treści

1. [Problem: proste Intent Routing a zadania złożone](#1-problem)
2. [3 Poprawki Architektoniczne](#2-architektura)
3. [12 Rozwiązanych Problemów Implementacyjnych](#3-problemy)
4. [Architektura: Planner → Walidator → Orkiestrator](#4-przeplyw)
5. [Organizm PLANNER (`proc://taskand.dev/planner/plan/v1`)](#5-planner)
6. [Organizm WALIDATOR + RESOLVER (`proc://taskand.dev/validator/resolve/v1`)](#6-walidator)
7. [Organizm ORKIESTRATOR (`proc://taskand.dev/orchestrator/execute/v1`)](#7-orkiestrator)
8. [Dynamiczny Kontekst Zdolności (Capability Context)](#8-kontekst)
9. [Scenariusz referencyjny End-to-End: Monitoring → Alert → Dashboard](#9-scenariusz)
10. [Instrukcja testowania i weryfikacji](#10-testy)

---

<a id="1-problem"></a>
## 1 · Problem: proste Intent Routing a zadania złożone

Prosty intent routing (`1 prompt → 1 intent → 1 proces`) jest niewystarczający w scenariuszach takich jak:
`"zbuduj system monitoringu z alertami na Telegram i dashboardem"`.

Taki cel wymaga:
1. Rozłożenia celu na graf podzadań (DAG).
2. Sprawdzenia, czy wymagane zdolności istnieją w katalogu (`proc-catalog.json`).
3. Przekazania wyników z pomiaru (monitor) do ewaluacji progu (alert) i interfejsu (dashboard).
4. Ochrony poświadczeń (brak jawnych tokenów).
5. Trwałego śledzenia stanu na dysku i nieblokującej obsługi usług tła.

---

<a id="2-architektura"></a>
## 2 · 3 Poprawki Architektoniczne

* **Korekta 1: Krok ≠ Organizm**
  Krok to pojedyncza operacja w grafie wykonania. Organizm to kontekst celu, stanu i uprawnień. Proces to zdolność z kontraktem URI.
  Dla monitoringu z alertami nie tworzymy 3 oddzielnych kontenerów — wykorzystujemy precyzyjne procesy `proc://` współpracujące w ramach ekosystemu.
* **Korekta 2: Tworzenie ≠ Uruchomienie**
  Brak zdolności w katalogu nie skutkuje natychmiastowym, niekontrolowanym uruchomieniem wygenerowanego przez AI kodu. Powstaje osobne zadanie ewolucji: kandydat → test w sandboxie → zatwierdzenie → rejestracja w katalogu → upoważnienie → uruchomienie.
* **Korekta 3: Planner proponuje, nie wykonuje**
  Planner generuje kandydat blueprintu. Deterministyczny Walidator sprawdza graf, cykle i uprawnienia przed przekazaniem do Orkiestratora.

---

<a id="3-problemy"></a>
## 3 · 12 Rozwiązanych Problemów Implementacyjnych

| # | Zidentyfikowany problem | Rozwiązanie w Standardzie v2.2 |
|---|---|---|
| 1 | **Cichy fallback planisty** | Zamiast fałszywego `doctor+web`, planner zwraca `{"status":"PLANNING_UNAVAILABLE","goalPreserved":true}` zachowując cel usera. |
| 2 | **Błąd kroku nie blokował zależnych** | Orkiestrator weryfikuje status poprzedników w `deps`. Jeśli poprzednik nie jest `SUCCEEDED`, krok zależny otrzymuje status `BLOCKED`. |
| 3 | **Brak przepływu danych między krokami** | Wynik poprzednika jest mapowany do `input.dependencies[depName]` (np. `alert` otrzymuje dokładny odczyt `cpu_pct` z `monitor`). |
| 4 | **Blokowanie przez usługi długotrwałe** | Rozróżnienie `task` (wykonanie i wyjście) oraz `service` (asynchroniczny demon w tle z weryfikacją portu). |
| 5 | **Fałszywy sukces przy `{"ok":false}` z exit 0** | Orkiestrator parsuje JSON i bada pole `ok`/`status`. Zwrócenie `ok: false` oznacza `FAILED`. |
| 6 | **Uszkodzenie JSON przez `.slice(0,500)`** | Bezpieczne parsowanie pełnego bufora JSON bez ucinania w połowie tokenów. |
| 7 | **Podatność path traversal w URI** | Mapowanie URI wyłącznie przez zaufany rejestr `proc-catalog.json` na zweryfikowane ścieżki. |
| 8 | **Wyciek sekretów do procesów potomnych** | Izolacja środowiska: potomne procesy otrzymują minimalny zestaw zmiennych; klucz `TASKAND_LLM_API_KEY` nie jest przekazywany. |
| 9 | **Jawne tokeny w parametrach** | Zakaz jawnych sekretów w `params`. Wymagane bezpieczne referencje `credentialRef: "vault://..."`. |
| 10 | **Brak detekcji cykli i duplikatów** | Walidator stosuje 3-kolorowy algorytm DFS (Biały/Szary/Czarny) oraz sprawdza unikalność ID i nazw kroków. |
| 11 | **Brak trwałego stanu (Persistent State)** | Każda orkiestracja zapisuje swój pełny stan krok po kroku do `log/orchestrations/<runId>.json`. |
| 12 | **Brak bramki walidacyjnej** | Wprowadzenie bramki `validator/resolve` pomiędzy Plannerem a Orkiestratorem. |

---

<a id="4-przeplyw"></a>
## 4 · Architektura: Planner → Walidator → Orkiestrator

```
user: "zbuduj monitoring z alertami na Telegram i dashboardem"
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ ① PLANNER (`proc://taskand.dev/planner/plan/v1`)        │
│   Introspekcja proc-catalog.json → Capability Context   │
│   Generuje KANDYDAT Blueprint (graf kroków i deps)      │
│   Brak LLM → PLANNING_UNAVAILABLE (bez fałszywek)       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ ② WALIDATOR (`proc://taskand.dev/validator/resolve/v1`) │
│   Weryfikacja unikalności ID i nazw kroków              │
│   Detekcja cykli (3-kolorowy DFS)                       │
│   Weryfikacja URI w proc-catalog.json                   │
│   Blokada jawnych tokenów (wymóg credentialRef: vault://│
│   Sortowanie topologiczne → ZATWIERDZONY PLAN           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ ③ ORKIESTRATOR (`proc://.../orchestrator/execute/v1`)   │
│   Asynchroniczny, trwały silnik wykonania               │
│   Izolowane środowisko bez dziedziczenia kluczy LLM     │
│   Przekazywanie wyników (deps: data flow chaining)      │
│   Błąd poprzednika → zależne BLOCKED                    │
│   Trwały zapis do log/orchestrations/<runId>.json       │
└─────────────────────────────────────────────────────────┘
```

---

<a id="5-planner"></a>
## 5 · Organizm PLANNER (`proc://taskand.dev/planner/plan/v1`)

* Odpowiedzialność: Przyjmuje cel (`task`), odpytuje katalog o dostępne procesy i proponuje Blueprint.
* Kontrakt:
  * Wejście: `{ "task": string }`
  * Wyjście: `{ "valid": boolean, "status": "PROPOSED" | "PLANNING_UNAVAILABLE", "blueprint": { ... } }`

---

<a id="6-walidator"></a>
## 6 · Organizm WALIDATOR + RESOLVER (`proc://taskand.dev/validator/resolve/v1`)

* Odpowiedzialność: Weryfikuje graf zależności (brak cykli), unikalność kroków, poprawność referencji do sejfu Vault oraz rozwiązuje identyfikatory URI na bezpieczne ścieżki plików.
* Kontrakt:
  * Wejście: `{ "blueprint": object }`
  * Wyjście: `{ "valid": boolean, "status": "APPROVED" | "REJECTED" | "NEEDS_EVOLUTION", "approvedPlan": { ... }, "errors": [] }`

---

<a id="7-orkiestrator"></a>
## 7 · Organizm ORKIESTRATOR (`proc://taskand.dev/orchestrator/execute/v1`)

* Odpowiedzialność: Wykonuje zatwierdzony plan krok po kroku. Zapewnia przepływ danych, izolację środowiska, rozróżnienie zadań od usług oraz trwały zapis postępu na dysk.
* Kontrakt:
  * Wejście: `{ "approvedPlan": object, "runId"?: string }`
  * Wyjście: `{ "runId": string, "status": "SUCCEEDED" | "FAILED" | "BLOCKED", "succeeded": number, "steps": object, "stateFile": string }`

---

<a id="8-kontekst"></a>
## 8 · Dynamiczny Kontekst Zdolności (Capability Context)

Kontekst możliwości systemu nie jest wpisany na stałe w kodzie, lecz budowany dynamicznie z pliku `proc-catalog.json`. Przy każdym planowaniu planista otrzymuje aktualną listę zarejestrowanych procesów federacji.

---

<a id="9-scenariusz"></a>
## 9 · Scenariusz referencyjny End-to-End: Monitoring → Alert → Dashboard

Wywołanie:
```bash
taskand dev "zbuduj system monitoringu z alertami na Telegram i dashboardem"
```

Przebieg:
1. **Planner**: Generuje plan 3 kroków: `monitor_cpu` → `alert_telegram` (deps: monitor_cpu) → `dashboard_ui` (deps: monitor_cpu).
2. **Validator**: Weryfikuje brak cykli, potwierdza procesy w `proc-catalog.json`, zatwierdza użycie `credentialRef: "vault://telegram/token"`.
3. **Orchestrator**:
   * Krok 1 (`monitor_cpu`): Odczytuje obciążenie CPU (np. 77.1%).
   * Krok 2 (`alert_telegram`): Otrzymuje pomiar z Kroku 1 przez `dependencies.monitor_cpu`, sprawdza warunek `77.1% < 80%`, zwraca status `THRESHOLD_NOT_EXCEEDED` z ochroną limitu 1 alert/5min.
   * Krok 3 (`dashboard_ui`): Sprawdza/uruchamia Web Cockpit na porcie :8090.
4. **Zapis stanu**: Pełny raport zapisany w `log/orchestrations/orch-<timestamp>.json`.

---

<a id="10-testy"></a>
## 10 · Instrukcja testowania i weryfikacji

```bash
# 1. Wszystkie testy kontraktu (17 procesów) i testy negatywne (10 testów)
make test

# 2. Test prosty (odczyt istnienia pliku)
taskand dev "czy plik /home/tom/tom.md istnieje?"

# 3. Test tworzenia procesu
taskand dev "stwórz proces liczący linie w pliku"

# 4. Test złożony (pełna orkiestracja wieloetapowa)
taskand dev "zbuduj system monitoringu z alertami na Telegram i dashboardem"

# 5. Sprawdzenie zapisanego stanu orkiestracji
ls -la log/orchestrations/
cat log/orchestrations/*.json
```

---

<a id="11-gateway"></a>
## 11 · Architektura Modularna Gateway (`gateway/`)

Monolityczny plik `gateway.py` został zastąpiony pakietem modularnym z pojedynczą odpowiedzialnością (SRP):

```
gateway/
├── __init__.py          ← start serwera HTTPServer i obsługa cyklu życia
├── router.py            ← cienki dyspozytor URI → handler (<30 linii)
├── auth.py              ← check_auth (Bearer/API key) i check_grant (grants.yaml)
├── utils.py             ← rozwiązywanie URI i konfiguracja środowiska
├── middleware/
│   ├── cors.py          ← nagłówki CORS dla aplikacji Web/Cockpit
│   └── logging.py       ← append-only log zdarzeń (log/events.jsonl)
└── handlers/
    ├── health.py        ← GET /healthz
    ├── federation.py    ← GET /api/federation
    ├── proc.py          ← POST /api/proc/call (kontrola grantów i wykonanie)
    ├── chat.py          ← POST /api/chat (routing organizmów)
    ├── doctor.py        ← POST /api/doctor
    ├── planner.py       ← POST /api/planner
    └── orchestrator.py  ← POST /api/orchestrator
```

Plik `gateway.py` w katalogu głównym pozostaje minimalistycznym punktem wejścia (wrapperem), zachowując 100% kompatybilności wstecznej dla `python3 gateway.py` oraz `docker compose`.

---

<a id="12-grants"></a>
## 12 · Kontrola Dostępu i Autentykacja (`grants.yaml`)

Wszystkie bezpośrednie wywołania procedur (`/api/proc/call`) oraz silnika orkiestracji podlegają ścisłej autoryzacji:

1. **Autentykacja**:
   * Każde żądanie musi zawierać nagłówek `Authorization: Bearer <token>` lub `X-Taskand-Key: <token>`.
   * Brak poświadczeń skutkuje natychmiastowym kodem **HTTP 401 Unauthorized**.
2. **Autoryzacja (Granty)**:
   * Uprawnienia użytkownika są sprawdzane w `grants.yaml`.
   * Użytkownik o ograniczonej roli (np. `guest`) próbujący uzyskać dostęp do zasobów administracyjnych/plikowych otrzymuje kod **HTTP 403 Forbidden**.
   * Role:
     - `admin`: pełen dostęp do `proc://taskand.dev/*` (akcje `*`).
     - `operator`: dostęp do `chat/*`, `doctor/*`, `monitor/*`, `hw/*` (akcje `call`, `read`).
     - `guest`: dostęp wyłącznie do `proc://taskand.dev/chat/message/v1` (akcja `call`).

---

<a id="13-resume"></a>
## 13 · Wznowienie po Awarii (Orchestrator Crash Resume) i Taksonomia Błędów

### Wznowienie po awarii (Crash Resume)
Orkiestrator (`orchestrator/execute/v1`) ładuje stan z `log/orchestrations/<runId>.json`:
* Kroki ze statusem `SUCCEEDED` lub `SKIPPED` **nigdy nie są wykonywane ponownie** (ochrona przed powtórnymi efektami ubocznymi).
* Wykonanie wznawiane jest deterministycznie od pierwszego nieukończonego kroku.

### Taksonomia błędów (Error Taxonomy)
Każdy krok w stanie `FAILED` lub `BLOCKED` otrzymuje jednoznaczny typ błędu `errorType`:
* `DEPENDENCY_BLOCKED`: Awaria lub brak kroku nadrzędnego w grafie DAG.
* `RETRYABLE`: Przekroczenie limitu czasu (timeout) lub przejściowy błąd sieciowy.
* `DENIED`: Brak uprawnień do zasobu lub odmowa dostępu w systemie plików (EACCES).
* `VALIDATION_FAILED`: Naruszenie kontraktu wyjścia procesu (np. zwrócenie `{"ok": false}`).
* `FATAL`: Brak pliku wykonywalnego na dysku lub błąd krytyczny.
* `EXEC_ERROR`: Standardowy błąd wykonania z kodem wyjścia różnym od zera.

---

<a id="14-wersjonowanie"></a>
## 14 · Wersjonowanie Wydań i Integralność (`bindingHash`)

W `proc-catalog.json` każdy proces posiada:
* `release`: Wersję wydania (np. `"1.0.0"`).
* `bindingHash`: Sumę kontrolną SHA-256 pliku wykonywalnego (`sha256:<hash>`).
* `created`: Sygnaturę czasową publikacji.

Walidator (`validator/resolve/v1`) weryfikuje sumę kontrolną pliku wykonywalnego przed zatwierdzeniem planu — jakakolwiek nieautoryzowana modyfikacja kodu na dysku skutkuje odrzuceniem planu z błędem naruszenia integralności.

---

<a id="15-negatywne"></a>
## 15 · Zestaw Testów Negatywnych (Negative Test Suite)

Automatyczny pakiet testów weryfikuje odporność systemu na błędy brzegowe (`make test-negative`):
1. **Detekcja cyklu (A → B → A)**: Walidator wykrywa cykl 3-kolorowym DFS i odrzuca plan.
2. **Zduplikowane ID kroków**: Odrzucenie planu z listą powielonych identyfikatorów.
3. **Jawne tokeny w parametrach**: Odrzucenie planu przy braku prefiksu `vault://`.
4. **Path traversal / nieznany proces URI**: Odrzucenie prób odwołania do plików spoza katalogu.
5. **Blokowanie kroków zależnych**: Awaria poprzednika ustawia status `BLOCKED` na krokach potomnych.
6. **Weryfikacja błędu w kontrakcie**: `{"ok": false}` przy kodzie 0 traktowane jako `FAILED`.
7. **Crash resume**: Pomijanie ponownego wykonania zakończonych pomyślnie kroków.
8. **Brak autentykacji na gateway**: HTTP 401 Unauthorized.
9. **Brak grantu na gateway**: HTTP 403 Forbidden dla roli o ograniczonych uprawnieniach.
10. **Poprawny token administratora**: HTTP 200 OK.

