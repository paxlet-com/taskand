# Standard taskand v0.20 — Federacja Rejestrów i Procesów URI

> **Federacja Rejestrów**: Każda paczka posiadająca `proc-catalog.json` i proces `proc://…/registry/serve/v1` jest autonomicznym **rejestrem**. Developer z dostępem do LLM tworzy i rejestruje nowe procesy w **swoim rejestrze**, a pozostałe paczki odkrywają je i konsumują przez wersjonowane URI w kopercie CloudEvents.

---

## 1. Zasady Architektury Federacyjnej

1. **Każda paczka = potencjalny rejestr (Self-Contained Registry)**:
   - Paczka wystawia proces `proc://<org>/registry/serve/v1`.
   - Udostępnia punkty końcowe:
     - `/.well-known/catalog.json`: publiczny punkt odkrywania dostępnych zdolności.
     - `/proc-catalog.json`: pełny katalog z sumami kryptograficznymi SHA-256.
     - `/packages/<pkg>/proc/<path>`: bezpieczne pobieranie kodu i deklaracji.
2. **URI z prefiksem rejestru**:
   - `proc://<org>/<rejestr>/<zdolność>/<wersja>`
   - Przykład: `proc://taskand.dev/developer/summarize/v1` (proces w rejestrze developera).
   - `proc://taskand.dev/web/navigate/v1` (proces w rejestrze web).
   - Konsument wywołuje proces identycznie jak proces lokalny — supervisor lub runner realizuje przezroczysty routing i weryfikację.
3. **Wymiana w standardzie CloudEvents**:
   - Każdy komunikat federacyjny opakowany jest w kopertę CloudEvents z atrybutami `type: "org.taskand.registry.updated.v1"`, `source`, `id`, `data`.
4. **Developer + LLM jako fabryka procesów**:
   - Developer przyjmuje intencję użytkownika (np. `evolve-create: summarize`).
   - LLM (klucz API wyłącznie w runtime z `.env`) generuje kod `bin.mjs` i kontrakt `test.mjs`.
   - Developer uruchamia test kontraktu fail-closed.
   - Po zdaniu testu oblicza sumę SHA-256 i rejestruje proces w **swoim rejestrze** (`proc-catalog.json`).
   - Pozostałe węzły federacji odkrywają nową zdolność przez `/.well-known/catalog.json`.

---

## 2. Trzy Wzorce Federacji

| Wzorzec | Kiedy stosować | Topologia | Mechanizm wymiany |
|---|---|---|---|
| **Pojedynczy (Monolit)** | 1–5 paczek w jednym repozytorium | 1 centralny rejestr, montaż wolumenu | Polling lokalnego `proc-catalog.json` |
| **Gwiazda (Hub-and-Spoke)** | Typowy projekt: 5–30 paczek, 1 developer | Hub = deweloper (tworzy procesy), Spokes = aplikacje (konsumują) | Spoke → Hub: discover + pull; Hub → Spoke: powiadomienie o nowej wersji |
| **Siatka (Mesh P2P)** | Rozproszony ekosystem, wielu deweloperów | Każda paczka = pełny rejestr | Peer-to-peer: discover + pull + verify bez centralnego punktu awarii |

---

## 3. Protokół Wymiany (Krok po Kroku)

1. **Discovery**:
   ```http
   GET http://developer:8095/.well-known/catalog.json
   ```
   Odpowiedź:
   ```json
   {
     "registry": "taskand.dev/developer",
     "processes": [
       { "uri": "proc://taskand.dev/developer/summarize/v1", "hash": "sha256:abc...", "runtimes": ["node>=20"] }
     ]
   }
   ```
2. **Hash Verification**:
   - Konsument sprawdza, czy `sha256(plik)` zgadza się z deklaracją w katalogu.
3. **Grant Policy Check**:
   - Sprawdzenie uprawnienia `consume-from-registry:developer` w `grants.yaml`.
4. **Execution**:
   - Uruchomienie przez uniwersalny runner:
   ```bash
   printf '{"text":"..."}' | make run URI=proc://taskand.dev/developer/summarize/v1
   ```
