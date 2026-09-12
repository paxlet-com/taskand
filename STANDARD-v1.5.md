# Standard taskand v1.5 — Kompletna Specyfikacja Systemu Samo-Replikującego

> **taskand** to samo-replikujący się system organizmów, w którym bootstrap (zygota) czyta genom z rejestru git (Gitea), powołuje organizmy, a każdy z nich może powoływać kolejne. Wszystko jest zasobem URI, ewolucja jest walidowana, a system rośnie organicznie — od jednej komórki do ekosystemu.

---

## Spis treści

**Część I — Fundament**
1. [Zasady nadrzędne (15 reguł)](#cz-i--1)
2. [Jednostki: proces, paczka, zasób, organizm, genom](#cz-i--2)
3. [Schematy URI](#cz-i--3)
4. [Typy artefaktów i tryby ewolucji](#cz-i--4)

**Część II — Organizmy**
5. [Architektura: zygota → organizmy → federacja](#cz-ii--5)
6. [Wszystkie typy organizmów](#cz-ii--6)
7. [Genom (genome.yaml)](#cz-ii--7)
8. [Protokół spawn (peer-to-peer)](#cz-ii--8)
9. [Dozbrajanie (zero-downtime)](#cz-ii--9)
10. [Sejf (Vault) i izolacja LLM](#cz-ii--10)

**Część III — Ewolucja**
11. [Pętla ewolucyjna (7 kroków)](#cz-iii--11)
12. [Digital Twin i bramki kwalifikacji](#cz-iii--12)
13. [Autoleczenie (Self-healing)](#cz-iii--13)
14. [Poznanie środowiska (roszczenia wiedzy)](#cz-iii--14)

**Część IV — Komunikacja**
15. [CloudEvents envelope](#cz-iv--15)
16. [Interfejs konwersacyjny (prompt → proc://)](#cz-iv--16)
17. [Federacja rejestrów](#cz-iv--17)

**Część V — Bezpieczeństwo**
18. [Fail-closed](#cz-v--18)
19. [Uprawnienia (grants.yaml)](#cz-v--19)
20. [Izolacja kontenerowa i tokenowa](#cz-v--20)

**Część VI — Zgodność**
21. [12-punktowa checklista konformacji](#cz-vi--21)
22. [Testy kontraktu](#cz-vi--22)

**Część VII — Praktyka**
23. [Szybki start (od zera do federacji)](#cz-vii--23)
24. [CLI v1.5 — pełna referencja komend](#cz-vii--24)
25. [Typowe scenariusze (przepisy)](#cz-vii--25)

---

<a id="cz-i--1"></a>
## Część I — Fundament

### 1 · Zasady nadrzędne (15 reguł)

1. **Wszystko jest zasobem URI.** Procesy, sesje, artefakty, usługi i organizmy są jednoznacznie adresowalne za pomocą wersji i autorytetu.
2. **Fail-closed.** Błąd autoryzacji, walidacji lub brak odpowiedzi natychmiast blokuje wykonanie (exit code != 0, brak mutacji).
3. **Reprodukcja peer-to-peer.** Każdy dojrzały organizm posiada proces `proc://.../spawn/v1`, umożliwiający powoływanie potomnych organizmów ze zwalidowanych szablonów.
4. **Genom jako źródło prawdy.** `genome.yaml` definiuje docelową kompozycję organizmów, reguły ewolucji i role w ekosystemie.
5. **Separacja sekretów.** Klucze i tokeny LLM (np. GLM-5.3) spoczywają wyłącznie w dedykowanym organizmie `vault` (AES-256-GCM) z dostępem purpose-scoped.
6. **Zero-downtime arming.** Dozbrajanie działających usług (np. nginx na porcie 8090) odbywa się przez transparentny adapter URI bez ich zatrzymywania.
7. **Bramka Digital Twin.** Żaden nowy proces ani mutacja nie trafia do produkcji bez przejścia testów kwalifikacyjnych w Digital Twin Sandbox.
8. **Autoleczenie z limitem 3 prób.** Wykryty błąd skutkuje generowaniem łatki naprawczej (`dev/heal`), weryfikacją w twinie i automatycznym rollbackiem w razie niepowodzenia.
9. **Katalogi z hashami SHA-256.** `proc-catalog.json` każdej paczki zawiera niezmienne hashe kryptograficzne plików binarnych, manifestów i testów.
10. **Federacja rejestrów.** Każda paczka serwuje swój rejestr przez `proc://taskand.dev/registry/serve/v1`, umożliwiając wymianę dynamiczną.
11. **Koperty CloudEvents v1.0.** Wszelka komunikacja międzyprocesowa i międzyorganizmowa zachowuje nagłówki i schematy CloudEvents.
12. **Konwersacyjny dispatcher.** Naturalny język usera jest tłumaczony na wywołania procesów wewnętrznych `proc://` (np. `taskand dev` -> `dev/chat/v1`).
13. **Niezmienne migawki.** Każda mutacja stanu jest poprzedzona migawką plików (snapshot) umożliwiającą natychmiastowy rollback.
14. **Jednoznaczność ścieżki i URI.** URI procesu mapuje się deterministycznie na ścieżkę w systemie plików: `proc/<path>/<authority>/<version>/`.
15. **Samowystarczalność paczki.** Każda paczka w katalogu `packages/` posiada kompletny `Makefile`, `capsule.yaml`, `grants.yaml`, `proc-catalog.json` i własne testy kontraktu.

---

<a id="cz-i--2"></a>
### 2 · Jednostki: proces, paczka, zasób, organizm, genom

* **Proces (`proc://`)**: Najmniejsza wykonywalna jednostka logiki, posiadająca `bin.mjs` (wykonanie), `proc.yaml` (deklaracja) oraz `test.mjs` (test kontraktu).
* **Paczka (`package`)**: Samodzielny moduł w repozytorium (`packages/<name>`), zawierający kapsułę, rejestr procesów, uprawnienia i reguły Makefile.
* **Zasób URI**: Każdy identyfikator w formacie URI reprezentujący proces, sesję, artefakt, usługę lub organizm.
* **Organizm**: Autonomiczna jednostka funkcjonalna (np. `developer`, `doctor`, `vault`, `bootstrap`), zdolna do komunikacji, wykonywania procesów i replikacji (`spawn/v1`).
* **Genom (`genome.yaml`)**: Nadrzędny manifest opisujący strukturę całego ekosystemu, powiązania między organizmami oraz zasady reprodukcji.

---

<a id="cz-i--3"></a>
### 3 · Schematy URI

| Schemat | Przeznaczenie | Przykład |
|---|---|---|
| `proc://` | Procesy wykonywalne | `proc://taskand.dev/dev/chat/v1` |
| `organism://` | Identyfikatory organizmów | `organism://taskand.dev/doctor` |
| `service://` | Usługi zewnętrzne i adaptery | `service://taskand.dev/nginx:8090` |
| `vault://` | Sekrety i poświadczenia | `vault://taskand.dev/secrets/llm/api-key` |
| `session://` | Sesje przeglądarki / kontekstu | `session://browser/s-a1b2c3d4` |
| `artifact://` | Niezmienne artefakty z hashem | `artifact://page-content@sha256:6e49f...` |

---

<a id="cz-i--4"></a>
### 4 · Typy artefaktów i tryby ewolucji

* **`immutable`**: Niezmienny artefakt zabezpieczony hashem kryptograficznym SHA-256. Wszelka modyfikacja wymaga utworzenia nowej wersji URI.
* **`state`**: Stan runtime (np. baza danych, kolejka zadań `inbox.yaml`, pliki sesji), podlegający migracji i migawkowaniu.
* **`adapter`**: Komponent integrujący działającą usługę zewnętrzną z federacją URI.

---

<a id="cz-ii--5"></a>
## Część II — Organizmy

### 5 · Architektura: zygota → organizmy → federacja

```
                  ┌──────────────────────┐
                  │ Gitea / Git Genome   │
                  │     (genome.yaml)    │
                  └──────────┬───────────┘
                             │ czyta genom
                             ▼
                  ┌──────────────────────┐
                  │    taskand-zygote    │
                  │ (packages/bootstrap) │
                  └──────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │  developer  │  │   doctor    │  │    vault    │
     │  (codegen)  │  │ (diagnose)  │  │  (secrets)  │
     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
            │                │                │
            └────────────────┼────────────────┘
                             │ p2p spawn & federation
                             ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │  chat / web │  │ nginx (arm) │  │ nowe paczki │
     └─────────────┘  └─────────────┘  └─────────────┘
```

---

<a id="cz-ii--6"></a>
### 6 · Wszystkie typy organizmów

1. **`nucleus` / `zygote` (bootstrap)**: Inicjalizuje ekosystem, czyta genom, powołuje fundament.
2. **`developer`**: Tworzy i rozwija nowe procesy, naprawia defekty, przeprowadza dozbrajanie usług, powołuje nowe organizmy.
3. **`doctor`**: Prowadzi monitoring stanu zdrowia (health checks), diagnozuje incydenty, rekomenduje decyzje SRE (np. load balancing).
4. **`vault`**: Przechowuje poświadczenia w izolacji kryptograficznej, udostępnia tokeny purpose-scoped dla developera i doctora, rejestruje audyt.
5. **`chat`**: Interfejs konwersacyjny, kolejkowanie intencji i asysta w interakcjach z użytkownikiem.
6. **`web`**: Moduł aplikacji webowej, zarządzanie sesjami browsera, automatyzacja i scraping.
7. **`nginx` / `external-service`**: Dozbrojona zewnętrzna usługa sieciowa udostępniająca adapter stanu.

---

<a id="cz-ii--7"></a>
### 7 · Genom (`genome.yaml`)

Główny plik genomu w korzeniu repozytorium definiuje organizmy, ich role, wersje, ścieżki i reguły replikacji:

```yaml
version: "1.5.0"
kind: TaskandGenome
spec:
  reproduction:
    protocol: proc://taskand.dev/spawn/v1
    templatesDir: templates/
  organisms:
    developer:
      role: agent
      path: packages/developer
      capabilities: [codegen, heal, arm, spawn]
    doctor:
      role: doctor
      path: packages/doctor
      capabilities: [diagnose, prescribe, audit, spawn]
    vault:
      role: security
      path: packages/vault
      capabilities: [secrets-management, isolation, spawn]
```

---

<a id="cz-ii--8"></a>
### 8 · Protokół spawn (peer-to-peer)

Każdy organizm implementuje proces `proc://.../spawn/v1`. Wywołanie protokołu przyjmuje specyfikację potomka (`name`, `role`, `sourceTemplate`) i autonomicznie przygotowuje nową paczkę ze zwalidowanym manifestem, testami i wpisem w katalogu.

---

<a id="cz-ii--9"></a>
### 9 · Dozbrajanie (zero-downtime)

Dozbrajanie (arming) pozwala na włączenie istniejącej usługi zewnętrznej do ekosystemu taskand bez przerw w jej działaniu:
1. Wykrycie portu i protokołu usługi.
2. Wygenerowanie adaptera `proc://taskand.dev/<service>/status/v1`.
3. Utworzenie paczki `packages/<service>` z pełną strukturą kapsuły.
4. Włączenie adaptera do monitoringu doctora bez restartu kontenera produkcyjnego.

---

<a id="cz-ii--10"></a>
### 10 · Sejf (Vault) i izolacja LLM

Klucz do LLM (np. GLM-5.3) jest przechowywany wyłącznie w zaszyfrowanym sejfie Vault:
* `purpose=codegen` dla developera.
* `purpose=diagnosis` dla doctora.
* Zablokowany dostęp globalny (`export-all` -> DENY).
* Pełny rejestr zapytań sprawdzany komendą `taskand sec "kto miał dostęp?"`.

---

<a id="cz-vi--21"></a>
## Część VI · 21 · 12-punktowa checklista konformacji

Każda paczka w systemie taskand v1.5 musi przejść 100% z 12 punktów weryfikacji:

1. **`capsule.yaml`**: Poprawny manifest z listą `processes[]` oraz deklaracją roli.
2. **Proces `proc://`**: Co najmniej 1 proces z plikiem `bin.mjs` i formalnym bindingiem.
3. **Zasada URI = ścieżka**: Ścieżka `proc/<name>/<authority>/<version>/bin.mjs` odpowiada URI `proc://<authority>/<name>/<version>`.
4. **`Makefile`**: Zapewnia targety `build`, `test`, `package-test`, `verify-catalog`.
5. **`proc-catalog.json`**: Zawiera zweryfikowane hashe SHA-256 plików `bin.mjs`, `proc.yaml`, `test.mjs`.
6. **`grants.yaml`**: Posiada zdefiniowaną politykę uprawnień procesów i ról.
7. **Testy kontraktu**: Wszystkie procesy posiadają testy `test.mjs` i zachowują zasadę fail-closed (kod wyjścia 2 przy złym wejściu).
8. **Repozytorium Git**: Śledzenie historii i wersjonowanie kapsuły w rejestrze git.
9. **Ewolucja**: Zdolność do ewolucji, delegacji i kwalifikacji w Digital Twin.
10. **Federacja rejestrów**: Implementacja `registry/serve/v1` lub adaptera zewnętrznego.
11. **Protokół reprodukcji**: Implementacja `proc://.../spawn/v1` dla autonomicznych organizmów.
12. **Interfejs konwersacyjny**: Obsługa zapytań konwersacyjnych usera i kolejkowanie intencji.

---

<a id="cz-vii--24"></a>
## Część VII · 24 · CLI v1.5 — Referencja poleceń

```bash
# Rozmowa z organizmami
taskand dev "<prompt>"        # Dialog z developerem (tworzenie procesów, arming, spawn)
taskand doc ["<prompt>"]      # Diagnoza zdrowia, analiza przyczyn awarii, rekomendacje SRE
taskand sec "<prompt>"        # Zarządzanie sekretami w Vault, audyt uprawnień
taskand chat "<prompt>"       # Dialog z asystentem, rejestracja intencji

# Federacja i inspekcja
taskand procs                 # Lista wszystkich zarejestrowanych procesów proc:// w ekosystemie
taskand fed --can-spawn       # Weryfikacja rejestrów federacji i zdolności reprodukcji (spawn)
taskand proc <uri> [json]     # Bezpośrednie uruchomienie procesu URI z wejściem JSON

# Logi, ewolucja i kontenery
taskand log [n]               # Podgląd n ostatnich linii logu ewolucji (log/evolution.log)
taskand twin <id> [opis]      # Kwalifikacja zmian w bezpiecznym Digital Twin Sandbox
taskand rollback <snap-id>    # Przywrócenie stanu repozytorium z migawki
taskand restart               # Bezpieczny restart kontenerów z weryfikacją przez doktora
```

---

<a id="cz-vii--25"></a>
## Część VII · 25 · Przykłady promptów i zachowań

* `taskand dev "cześć, co potrafisz?"` — prezentuje listę możliwości developera.
* `taskand dev "stwórz vault"` — powołuje organizm bezpieczeństwa protokołem spawn.
* `taskand dev "stwórz proces liczący słowa"` — generuje i kwalifikuje proces `proc://taskand.dev/words/count/v1`.
* `taskand dev "dozbrój nginx na :8090"` — tworzy bezprzerwowy adapter stanu dla Nginx.
* `taskand doc "sprawdź czy wszystko działa"` — uruchamia kompleksową diagnozę systemu.
* `taskand doc "sprawdź czy potrzebujemy LB"` — bada metryki ruchu i rekomenduje skalowanie.
* `taskand sec "migruj token llm"` — przenosi klucz LLM do sejfu z uprawnieniami celowymi.
* `taskand sec "kto miał dostęp?"` — generuje raport audytowy zapytań do sejfu.
