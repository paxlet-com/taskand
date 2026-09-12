# Standard taskand v1.1 — Kompletna Specyfikacja

> **taskand** to federacyjny system, w którym wszystko — od komunikatu po kontener z przeglądarką — jest zasobem URI, a ewolucja jest procesem podlegającym walidacji. Każda paczka może być rejestrem; developer z LLM tworzy nowe procesy; wymiana odbywa się przez wersjonowane URI i koperty CloudEvents.

---

## Spis treści

1. [Filozofia i zasady nadrzędne](#1-filozofia-i-zasady-nadrzędne)
2. [Jednostki: proces, paczka, zasób URI](#2-jednostki-proces-paczka-zasób-uri)
3. [Typy artefaktów i tryby ewolucji](#3-typy-artefaktów-i-tryby-ewolucji)
4. [Typy paczek (role i koncepcja organizmu)](#4-typy-paczek-role-i-koncepcja-organizmu)
5. [Schematy URI](#5-schematy-uri)
6. [Federacja rejestrów](#6-federacja-rejestrów)
7. [Standardy komunikacji](#7-standardy-komunikacji)
8. [Ewolucja i pipeline wdrożenia](#8-ewolucja-i-pipeline-wdrożenia)
9. [Konfiguracja runtime (.env, broker, sekrety)](#9-konfiguracja-runtime-env-broker-sekrety)
10. [Operacje zdalne (SSH, pliki poza git)](#10-operacje-zdalne-ssh-pliki-poza-git)
11. [Poznanie środowiska (roszczenia wiedzy)](#11-poznanie-środowiska-roszczenia-wiedzy)
12. [Digital twin i bramki kwalifikacji](#12-digital-twin-i-bramki-kwalifikacji)
13. [Bezpieczeństwo: granty, sejf, broker](#13-bezpieczeństwo-granty-sejf-broker)
14. [Skalowanie](#14-skalowanie)
15. [Dev-kit: środowisko developerskie](#15-dev-kit-środowisko-developerskie)
16. [Struktura plików standardu](#16-struktura-plików-standardu)
17. [Lista konformacji](#17-lista-konformacji)
18. [Wzorce federacji](#18-wzorce-federacji)
19. [Aneks A — Słownik](#aneks-a--słownik)
20. [Aneks B — Wersje standardu](#aneks-b--wersje-standardu)

---

## 1. Filozofia i zasady nadrzędne

| # | Zasada | Konsekwencja praktyczna |
|---|--------|------------------------|
| 1 | **URI = tożsamość, nie adres** | `proc://…` identyfikuje proces; runtime (docker/node/remote) jest realizacją z bindingu |
| 2 | **Ewolucja = nowa wersja, nie edycja in-place** | Zmiana = commit + tag; stara wersja pozostaje immutable |
| 3 | **Brak wiedzy blokuje strategię** | Roszczenie `status: nieznana` → `until_resolved` egzekwowane przez nadzorcę |
| 4 | **Rozdział wykonanie ≠ wersjonowanie** | Proces wykonuje; paczka wersjonuje; ewoluuje zewnętrzny developer |
| 5 | **Zero importów kodu między paczkami** | Wywołanie = URI + JSON stdin → JSON stdout; paczka = granica kodu |
| 6 | **Sekrety nigdy w plikach, obrazach ani kopertach** | Broker poświadczeń, purpose-scoped, runtime-only |
| 7 | **Dane między krokami = artefakty URI** | `artifact:…@sha256:…` (CAS, manifest, chunki) — nie pliki inline |
| 8 | **Porażka jest poprawnym wynikiem** | 3 próby → raport z powodami → poprzednia wersja zostaje |
| 9 | **Samomodyfikacja w runtime = DENY** | Aplikacja montuje własne repo read-only; ewolucja przez developera |
| 10 | **Audytowalność przez historię git** | Merge `--no-ff`, tagi, dziennik zdarzeń; przepisywanie historii = DENY |
| 11 | **Każda paczka może być rejestrem** | Wystarczy proces `serve` — paczka serwuje swoje procesy innym |
| 12 | **Git kontroluje PROCES, nie STAN** | Pliki na zdalnych serwerach: dziennik skutków + snapshoty CAS, nie git |
| 13 | **`.env` nie jest plikiem do edycji** | To zasób URI przez brokera; zmiana = URI operation, nie SSH+vim |

---

## 2. Jednostki: proces, paczka, zasób URI

### Proces (`proc://…`)

```
proc://<org>/<rejestr>/<zdolność>/<wersja>
      ↑ scheme    ↑ org     ↑ pakiet    ↑ funkcja    ↑ wersja
```

*Przykład:* `proc://taskand.dev/chat/message/v1`

| Cecha | Opis |
|-------|------|
| **Jednostka** | wykonania — jedno zadanie z jednoznacznym kontraktem |
| **Interfejs** | JSON stdin → JSON stdout, kody wyjścia: `0` (sukces), `1` (fail-closed/błąd wykonania), `2` (naruszenie kontraktu JSON/schema) |
| **Wersjonowanie** | własna wersja w URI (v1/v2, immutable); wersje współistnieją równolegle |
| **Runtime** | określony w bindingu (`proc.yaml`): node / docker / make / python / remote |
| **Wołanie** | `printf '%s' "$JSON" | <runtime> <ścieżka_do_bin>` lub przez bramkę HTTP CloudEvents |
| **Granica** | URI; **bezwzględny zakaz importowania kodu innego procesu** |
| **Rejestr** | prefiks URI wskazuje rejestr pakietu (własny lub cudzy — federacja) |

### Paczka (kapsuła = repozytorium git)

| Cecha | Opis |
|-------|------|
| **Jednostka** | wersjonowania, bezpieczeństwa i ewolucji |
| **Zawartość** | N procesów + wspólne artefakty (`schemas/`, `grants.yaml`, `claims/`, `twin/`) |
| **Wersjonowanie** | tag git `capsule-v…` — atomowo zamraża wersję paczki |
| **Ewolucja** | przez zewnętrznego developera (`twin-first`, max 3 próby w Digital Twin) |
| **Rejestr** | wbudowany proces `proc://…/registry/serve/v1` → udostępnia katalog i procesy innym |
| **Granica kodu** | paczka = granica kompilacji i repozytorium; URI = granica wywołania |

---

## 3. Typy artefaktów i tryby ewolucji

| Klasa | Przykłady | Tryb ewolucji | Bramka przed commitem |
|-------|-----------|---------------|----------------------|
| **process** | Dockerfile, bin.mjs, Makefile | `versioned` | validator + build + przypięcie digest SHA-256 |
| **strategy** | `strategy/*.yaml` | `versioned` | validator + historyczne przypadki testowe |
| **schema** | `schemas/*.json` (kontrakty) | `versioned-validated` | kompatybilność wstecz (addytywność) |
| **skill** | `skills/*.yaml` | `reviewed` | przegląd + testy na zapisanych przebiegach |
| **knowledge** (claims) | `claims/*.yaml` | `append-only` | claims-delete = DENY |
| **twin** (kwalifikacja) | `twin/*.yaml` | `requalified` | ponowna bramka A po każdej zmianie |

---

## 4. Typy paczek (role i koncepcja organizmu)

W standardzie taskand każda paczka (kapsuła) to **organizm** z własnym genomem (`capsule.yaml`), zmysłami/narządami (procesy `proc://`), układem immunologicznym (`grants.yaml` DENY domyślnie), pamięcią (`claims/`, `log/`) oraz cyklem regeneracji (`twin/` delegowane do developera).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORGANIZM TASKAND                              │
│                                                                         │
│   ┌───────────────────┐    ┌────────────────────┐    ┌──────────────┐   │
│   │ taskand-bootstrap │    │    taskand-core    │    │ taskand-web  │   │
│   │   (narodziny /    │───>│   (kontroler /     │<──>│    (czat /   │   │
│   │   onboarding)     │    │    supervisor)     │    │   interfejs) │   │
│   └───────────────────┘    └────────────────────┘    └──────────────┘   │
│                                      │                       │          │
│                                      ▼                       ▼          │
│                            ┌────────────────────┐    ┌──────────────┐   │
│                            │ taskand-developer  │    │   workers    │   │
│                            │   (LLM-codegen /   │    │  (browser /  │   │
│                            │   twin / ewolucja) │    │   ops / ssh) │   │
│                            └────────────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Inicjalizacja: `taskand-bootstrap`
- **Rola**: start systemu, onboarding, instalacja środowiska (`install-*`), przekazanie kontroli (`handover`).
- Odpowiada za pierwszy rozruch i wygenerowanie bazowych kapsuł.

### 2. Rdzeń: `taskand-core` & `taskand-supervisor`
- **Rola**: kontroler cyklu życia, routing URI, nadzór nad stanem.
- `taskand-gateway`: bramka HTTP udostępniająca uniwersalne REST API i routing zadań.

### 3. Interfejs i zmysły: `taskand-web` (Czat & Voice)
- **Rola**: dialog z użytkownikiem, rozpoznawanie mowy (Web Speech API), synteza mowy (TTS), delegacja zadań.
- **Kluczowe procesy**:
  - `proc://taskand.dev/chat/message/v1` — analiza komunikatów, wyciąganie intencji, budowa odpowiedzi kontekstowej.
  - `proc://taskand.dev/chat/voice/v1` — translacja głosu na akcje URI.
  - `proc://taskand.dev/registry/serve/v1` — serwowanie katalogu czatu.

### 4. Ewolucja i samoleczenie: `taskand-developer`
- **Rola**: tworzenie i naprawa procesów z udziałem LLM, prowadzenie testów w piaskownicy Digital Twin.
- **Kluczowe procesy**:
  - `proc://taskand.dev/dev/codegen/v1` — generowanie kodu, weryfikacja kontraktu i samorejestracja w `proc-catalog.json`.
  - `proc://taskand.dev/dev/plan/v1` — planowanie etapów wdrożenia.
  - `proc://taskand.dev/dev/heal/v1` — diagnoza i propozycja poprawek.

### 5. Wykonawcy (workers): `taskand-browser`, `taskand-web-ops`, `taskand-remote-ops`
- **Rola**: realizacja zadań zewnętrznych (przeglądarka, manipulacja stronami, operacje SSH).

---

## 5. Schematy URI

```
proc://<org>/<rejestr>/<zdolność>/<wersja>       ← proces wykonywalny
registry://<org>/<nazwa>                        ← rejestr paczki
session://<typ>/<id>                            ← sesja (przeglądarka, ssh)
artifact:<nazwa>@sha256:<digest>                ← niemutowalny artefakt CAS
urn:taskand:schema:<nazwa>:<wersja>             ← schemat kontraktu JSON
urn:taskand:claim:<id>                          ← roszczenie wiedzy
urn:taskand:task:<id>                           ← identyfikator zadania
urn:taskand:capsule:<nazwa>[@<wersja>]          ← paczka (kapsuła)
grants:<podmiot>→<cel>[@<wersja>]               ← grant uprawnień
secret:<zakres>/<nazwa>                         ← sekret (przez brokera)
```

### Reguła bijekcji URI ↔ Ścieżka pliku

Dla URI procesu: `proc://<org>/<rejestr>/<zdolność>/<wersja>`
Ścieżka w systemie plików: `proc/<rejestr>/<zdolność>/<org>/<wersja>/`
Zawartość:
- `proc.yaml` — metadane i interfejs,
- `bin.mjs` — wykonywalny plik wejściowy (JSON stdin → JSON stdout),
- `test.mjs` — automatyczny test kontraktu (0/1/2).

---

## 6. Federacja rejestrów

### Zasada
Każda paczka **może być autonomicznym rejestrem**. Wystarczy dołączyć proces `proc://.../registry/serve/v1`.

### Endpointy rejestru:
- `GET /.well-known/catalog.json` — publiczny katalog procesów z hashami SHA-256.
- `GET /proc-catalog.json` — pełny katalog z deklaracją interfejsów i rewizji git.
- `POST /proc/<rejestr>/<zdolność>/<wersja>` — wykonanie procesu w kopercie CloudEvents.
- `GET /healthz` — stan gotowości rejestru.

### Protokół wymiany między rejestrami
1. **DISCOVER**: odpytanie `GET /.well-known/catalog.json`.
2. **VERIFY**: weryfikacja `sha256(bin.mjs) == hash_katalogu`.
3. **GRANTS**: weryfikacja w `grants.yaml` prawa do wykonania zdalnego URI.
4. **CALL**: wywołanie procesu z identycznym kontraktem wejścia/wyjścia.

---

## 7. Standardy komunikacji

### Koperta CloudEvents 1.0 z rozszerzeniem taskand

```json
{
  "specversion": "1.0",
  "id": "evt-2026-09-12-001",
  "source": "urn:taskand:web:chat",
  "type": "org.taskand.proc.call.v1",
  "time": "2026-09-12T14:00:00Z",
  "taskand": {
    "cel": "taskand-chat",
    "uri": "proc://taskand.dev/chat/message/v1",
    "idempotencykey": "msg-891230",
    "grantsref": "grants:web→chat:v1",
    "schema": "urn:taskand:schema:envelope:v1"
  },
  "data": {
    "message": "Zbuduj nowy proces podsumowujący"
  }
}
```

### Bramki walidacji:
1. Walidacja schematu JSON Schema — kod 422 przy błędzie.
2. Weryfikacja uprawnień (grants) — kod 403 przy braku prawa.
3. Idempotentność (`idempotencykey`) — ignorowanie duplikatów.

---

## 8. Ewolucja i pipeline wdrożenia

### Podział uprawnień

| | Paczka aplikacji (`web`, `chat`, `ops`) | Paczka dewelopera (`developer`) |
|---|---|---|
| Własne repo w runtime | **read-only** (`:ro`) | read-write (swoje) |
| Repozytorium celu | — | **rw wyłącznie przez grant** |
| Dostęp do docker.sock | tylko kontroler/nucleus | **brak dostępu** |
| Restart instancji | **DENY** (samomodyfikacja) | przez `request-deploy` |

### Pipeline Digital Twin (max 3 próby)
```
Zadanie evolve-* → Developer: gałąź evo/<id>
  → Budowa Digital Twin w izolacji (np. port :8180, produkcja nienaruszona)
  → Próba 1: testy kontraktu → błąd → analiza przyczyny → poprawka
  → Próba 2: testy kontraktu → błąd → analiza przyczyny → poprawka
  → Próba 3: testy kontraktu → SUKCES (DoD spełnione)
  → Merge do main (--no-ff) + tag capsule-v... → wdrożenie na produkcję
  (Gdy 3/3 niepowodzenia: wycofanie zmian, raport z przyczynami, brak wdrożenia)
```

---

## 9. Konfiguracja runtime (.env, broker, sekrety)

1. **`.env` nie jest edytowany w locie**: montowany w kontenerach w trybie `:ro`.
2. **Klucze API i hasła**: przekazywane wyłącznie przez brokera poświadczeń w runtime (nigdy w obrazach Docker, plikach gita ani kopertach zdarzeń).
3. **Rotacja sekretu**: realizowana przez wywołanie URI do brokera (`POST supervisor/config/update`), restart procesu w tle i weryfikację health check przed podmienieniem wersji aktywnej.

---

## 10. Operacje zdalne (SSH, pliki poza git)

1. **Git kontroluje proces (program), a nie stan (plik na serwerze)**.
2. Zmiany na zdalnych maszynach wymagają:
   - wykonania migawki przed zmianą (`cat plik > artifact:...`),
   - klasyfikacji skutku: `reversible`, `idempotent`, `compensable`, `irreversible`,
   - wykonania przez wersjonowany proces w gicie (np. `bin.mjs`),
   - weryfikacji Definition of Done (DoD),
   - automatycznego rollbacku w razie niepowodzenia.
3. **Zawsze zabronione (DENY)**: root-shell bez ograniczeń, `rm -rf`, modyfikacje bez migawki i bez DoD.

---

## 11. Poznanie środowiska (roszczenia wiedzy)

- Brak wiedzy o środowisku jest formalnym stanem blokującym (`status: nieznana`).
- Reguła `until_resolved`: brak wiedzy blokuje podejmowanie ryzykownych strategii (np. wielokrotnego zapisu do nieznanego API).
- Wiedza jest dopisywana wyłącznie w trybie `append-only` do `claims/*.yaml`.

---

## 12. Digital twin i bramki kwalifikacji

- **Bramka A (przydatność bliźniaka)**: Czy model środowiska odpowiada rzeczywistości?
- **Bramka B (poprawność procesu)**: Czy kryteria Definition of Done zostały spełnione w 100%?

---

## 13. Bezpieczeństwo: granty i polityka DENY

Domyślna polityka w każdej kapsule: **DENY-ALL**, poza jawnymi uprawnieniami w `grants.yaml`.
Zabronione bezwzględnie:
- samomodyfikacja kodu w runtime,
- usuwanie roszczeń wiedzy (`claims-delete`),
- pushowanie do gita bez przejścia bramek testowych,
- ujawnianie sekretów poza proces brokera.

---

## 14. Skalowanie

- **Niemutowalne i nieskalowalne**: URI procesu, kontrakt JSON Schema, granty, kwalifikacja twin.
- **Skalowalne**: liczba instancji procesów worker, przydział zasobów CPU/RAM.

---

## 15. Dev-kit i scaffoldowanie

Nowe pakiety tworzone są przez standaryzowany skrypt:
```bash
bash scripts/taskand-new-pkg.sh <nazwa> [rola]
```
Skrypt generuje strukturę zgodną w 100% z 10 punktami listy konformacji.

---

## 16. Struktura plików paczki (kapsuły)

```
taskand-<nazwa>/                      ← 1 paczka = 1 repozytorium git = 1 kapsuła
├── capsule.yaml                      ← manifest kapsuły (role, processes, deploy)
├── Makefile                          ← API operacyjne: test·pack·verify·run·observe
├── grants.yaml                       ← uprawnienia i reguły bezpieczeństwa
├── proc-catalog.json                 ← katalog procesów z hashami SHA-256
├── .env.example                      ← szablon konfiguracji
│
├── proc/                             ← katalog procesów (URI = ścieżka)
│   └── <rejestr>/<zdolność>/<org>/<wersja>/
│       ├── proc.yaml                 ← binding procesu
│       ├── bin.mjs                   ← realizacja fail-closed (0/1/2)
│       └── test.mjs                  ← automatyczny test kontraktu
│
├── schemas/                          ← kontrakty JSON Schema
├── strategy/                         ← strategie operacyjne
├── skills/                           ← umiejętności agentowe
├── claims/                           ← roszczenia wiedzy (append-only)
├── twin/                             ← definicje kwalifikacji Digital Twin
│
├── tasks/                            ← kolejki zadań (inbox/done)
├── patches/                          ← wymiana zmian (git format-patch)
├── deps/                             ← zależności
└── dist/                             ← archiwa dystrybucyjne .tgz
```

---

## 17. Lista konformacji (10/10)

| # | Wymaganie | Narzędzie weryfikacji |
|---|-----------|-----------------------|
| 1 | `capsule.yaml` z listą `processes[]` i zdefiniowaną rolą | `make verify` / `make conformance` |
| 2 | Co najmniej 1 proces `proc://` z plikiem `bin.mjs` i bindingiem | `make test` |
| 3 | Reguła bijekcji URI ↔ ścieżka (`proc/<rejestr>/<zdolność>/<org>/<wersja>/`) | `make conformance` |
| 4 | Makefile z targetami: `test`, `pack`, `verify`, `run`, `observe`, `extract` | `make help` |
| 5 | `proc-catalog.json` ze sprawdzonymi sumami kontrolnymi SHA-256 | `make verify` |
| 6 | `grants.yaml` definiujący uprawnienia i domyślne DENY | `make verify` |
| 7 | Testy kontraktu wszystkich procesów (fail-closed, kody 0/1/2) | `make test` |
| 8 | Wersjonowanie w gicie i nienaruszalność tagów `capsule-v…` | `git log` |
| 9 | Ewolucja: delegacja do developera (twin-first, max 3 próby) | `capsule.yaml` |
| 10 | [FEDERACJA] Rejestr z procesem `proc://…/registry/serve/v1` | `GET /.well-known/catalog.json` |

---

## 18. Wzorce federacji

1. **Monorepo / Wolumen Lokalny**: Rejestry współdzielą system plików; router wywołuje lokalne procesy.
2. **Rejestr Gwiazda (Star)**: Developer jako hub tworzący i serwujący nowe procesy, aplikacje jako konsumenci.
3. **Siatka Pełna (Mesh)**: Każda kapsuła działa jako niezależny mikroserwis HTTP/CloudEvents, wymieniając procesy peer-to-peer.

---

## Aneks A — Słownik

- **Kapsuła / Organizm**: Autonomiczna jednostka oprogramowania wersjonowana w gicie, posiadająca własne procesy, uprawnienia, testy i historię.
- **Proces**: Wykonywalna zdolność z kontraktem wejścia/wyjścia (JSON stdin → JSON stdout).
- **Binding**: Metadane wiążące logiczny identyfikator URI z fizycznym kodem i runtime.
- **Fail-closed**: Zasada bezpieczeństwa nakazująca natychmiastowe przerwanie pracy z kodem błędu w przypadku jakiejkolwiek anomalii wejścia.
- **Digital Twin**: Izolowane środowisko testowe replikujące produkcję, w którym procesy muszą dowieść poprawności przed wdrożeniem.
- **CAS (Content-Addressed Storage)**: Magazyn danych adresowany sumą SHA-256 z podziałem na chunki i weryfikacją integralności.

---

## Aneks B — Ewolucja wersji standardu

- `v0.1`–`v0.4`: Monolityczny kontroler z kolejką inbox.yaml.
- `v0.5`–`v0.9`: Wprowadzenie koncepcji kapsuł, Digital Twin i bramek kwalifikacji.
- `v0.10`–`v0.15`: Standardy komunikacji CloudEvents, schemat URI `proc://`, bijekcja ścieżek.
- `v0.16`–`v0.19`: Skalowanie, broker poświadczeń, operacje SSH.
- `v0.20`: Federacja rejestrów (każda paczka staje się rejestrem, procesy LLM-generated).
- **`v1.1`**: Pełna integracja organizmów (Czat/Web, Developer, Bootstrap, Core) z federacją rejestrów, bezpośrednim wywoływaniem procesów przez bramkę REST API oraz egzekwowaniem kontraktu 10/10.
