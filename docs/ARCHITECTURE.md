# Architektura Systemu taskand (v1.1)

Niniejszy dokument opisuje architekturę federacyjną systemu **taskand**, model organizmów-kapsuł, zasady dostępu do modeli LLM (GLM-5.3), reguły bezpieczeństwa przy restartach usług oraz procedury automatycznego rollbacku.

---

## 1. Ekosystem Organizmów (Pakiety jako Autonomiczne Kapsuły)

W standardzie taskand każda paczka w `packages/` jest **autonomicznym organizmem**:
- posiada własny manifest [`capsule.yaml`](capsule.yaml),
- własne procesy `proc://` z interfejsem JSON stdin/stdout i kodami fail-closed (0/1/2),
- własny rejestr federacji `proc://.../registry/serve/v1` wystawiający `/.well-known/catalog.json`,
- układ immunologiczny [`grants.yaml`](grants.yaml) (domyślne DENY),
- procedurę ewolucji w piaskownicy Digital Twin (`twin/qualification.yaml`).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORGANIZM TASKAND                              │
│                                                                         │
│   ┌───────────────────┐    ┌────────────────────┐    ┌──────────────┐   │
│   │ taskand-bootstrap │    │    taskand-core    │    │ taskand-web  │   │
│   │ (onboarding/start)│───>│(nucleus/supervisor)│<──>│(czat/speech) │   │
│   └───────────────────┘    └────────────────────┘    └──────────────┘   │
│                                      │                       │          │
│                                      ▼                       ▼          │
│   ┌───────────────────┐    ┌────────────────────┐    ┌──────────────┐   │
│   │  taskand-doctor   │    │ taskand-developer  │    │   workers    │   │
│   │ (diagnostyka/SRE) │───>│ (LLM-codegen/twin) │    │  (browser/   │   │
│   └───────────────────┘    └────────────────────┘    │   web-ops)   │   │
│                                                      └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Role organizmów:
1. **`taskand-bootstrap`** (`packages/bootstrap`):
   - Odpowiedzialny za inicjalizację, onboarding i weryfikację środowiska (`bootstrap/onboarding`).
   - Przekazuje kontrolę do kontrolera po poprawnym rozruchu (`bootstrap/handover`).
2. **`taskand-core`** (`nucleus` / `supervisor`):
   - Kontroler cyklu życia zadań, daemon wykonawczy i bramka REST API (`taskand-gateway`, port 8077).
3. **`taskand-chat` & `taskand-web`** (`packages/chat`, `packages/web`, `landing`):
   - Zmysły systemu: Web Speech API (rozpoznawanie mowy), TTS (synteza głosu), pamięć konwersacji (`chat/message`, `chat/voice`).
   - Web Cockpit na porcie 8090 umożliwiający pełne sterowanie systemem.
4. **`taskand-developer`** (`packages/developer`):
   - Autonomiczny ewolutor: generuje nowe procesy przez LLM (`dev/codegen`), planuje zadania (`dev/plan`) i diagnozuje błędy (`dev/heal`).
   - Przeprowadza testy kandydatów w Digital Twin przed zatwierdzeniem zmian.
5. **`taskand-doctor`** (`packages/doctor`):
   - Strażnik zdrowia (SRE): ciągła diagnostyka endpointów WWW (:8090), bramki API (:8077) oraz integralności katalogów SHA-256 (`doctor/diagnose`).
   - W razie awarii wystawia receptę i automatycznie zleca naprawę (`doctor/prescribe`) do `taskand-developer`.

---

## 2. Dostęp do Tokenu LLM (GLM-5.3 / ZhipuAI)

### Gdzie znajduje się klucz API?
Zgodnie z zasadą nr 6 Standardu taskand oraz dokumentem [`docs/SECRETS.md`](SECRETS.md):
- **Klucz API NIGDY nie znajduje się w repozytorium Git, obrazach Dockerfile ani kopertach zdarzeń CloudEvents.**
- Klucz znajduje się w pliku `.env` na maszynie hosta (`ZHIPUAI_API_KEY=...` lub `GLM_API_KEY=...`).
- Demon `taskand-nucleus` montuje `.env` w fazie uruchomienia kontenera (`docker-compose.yaml` -> `env_file: .env`).

### Czy `taskand-developer` ma dostęp do GLM-5.3?
- **TAK.** `taskand-developer` jest organizmem tworzącym i naprawiającym kod.
- Gdy zachodzi potrzeba utworzenia nowego procesu (`evolve-create`) lub wygenerowania poprawki (`dev/codegen`), developer korzysta z klucza wstrzykniętego w środowisku runtime (lub przez brokera poświadczeń).
- Token jest ograniczony wyłącznie do celu generacji/ewolucji (purpose-scoped).

### Czy `taskand-doctor` ma dostęp do GLM-5.3?
- **NIE bezpośrednio — i z zasady nie powinien go posiadać.**
- **Uzasadnienie architektoniczne (Zasada Najmniejszych Uprawnień & Rozdział Obowiązków)**:
  1. `doctor` wykonuje szybkie, deterministyczne sprawdzenia (proby HTTP, statusy kodów, czasy opóźnień, sumy SHA-256). Użycie LLM do prostego sprawdzenia czy port 8090 odpowiada byłoby powolne, kosztowne i podatne na halucynacje.
  2. Jeśli `doctor` wykryje awarię (np. `web-landing` zwraca status `DOWN` lub błąd konfiguracji), **nie naprawia jej samemu**, lecz generuje formalne zadanie `evolve-fix` i **zleca je do `taskand-developer`**.
  3. To deweloper (z dostępem do GLM-5.3) bada przyczynę, generuje kod poprawki, testuje w Digital Twin i wdraża rozwiązanie.

---

## 3. Restart Usług z Poziomu Web Cockpit (np. `http://localhost:8090/`)

### Czy usługa webowa może zrestartować samą siebie?
- **Reguła bezpieczeństwa nr 9 (Samomodyfikacja w runtime = DENY)**:
  Kontener `taskand-landing` (serwer Nginx na porcie 8090) ma zamontowane pliki w trybie tylko do odczytu (`:ro`) oraz **NIE posiada dostępu do `/var/run/docker.sock`**.
  Dzięki temu ewentualne przełamanie serwera WWW nie pozwala intruzowi na sterowanie Dockerem na maszynie hosta.

### Jak w praktyce realizowany jest restart `taskand-landing`?
1. Użytkownik w Web Cockpicie klika przycisk **`🔄 Restart WWW (:8090)`** lub wydaje polecenie głosowe (*"zrestartuj stronę"*, *"restart www"*).
2. Przeglądarka wysyła żądanie `POST /api/restart` z payloadem `{"service": "landing"}` do **`taskand-gateway`** (port 8077).
3. Bramka API:
   - Weryfikuje uprawnienia i sprawdza, czy żądany kontener znajduje się na liście dozwolonych (`allowed_containers`: `taskand-landing`, `taskand-gateway`, `taskand-nucleus`).
   - Wykonuje kontrolowane polecenie restartu kontenera przez Docker API.
   - Po restarcie bramka natychmiast wywołuje `proc://taskand.dev/doctor/diagnose/v1` w celu weryfikacji Health Check (potwierdzenie kodu HTTP 200 na porcie 8090).
   - Zwraca raport do interfejsu użytkownika.

---

## 4. Co w przypadku, gdy restartowana usługa nie wstanie? (Procedura Rollbacku)

System taskand posiada wielopoziomowy mechanizm ochrony przed awariami wdrożeniowymi:

```
                  ┌─────────────────────────────────────┐
                  │    Zmiana kodu / Wdrożenie nowej     │
                  │               wersji                │
                  └─────────────────────────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │  Bramka prewencyjna (Digital Twin)  │
                  │   Testy w izolacji (max 3 próby)    │
                  └─────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │ Sukces                          │ Błąd (3 próby)
                    ▼                                 ▼
       ┌─────────────────────────┐       ┌─────────────────────────┐
       │ Wdrożenie na produkcję  │       │  BLOKADA WDROŻENIA      │
       │ (commit --no-ff + tag)  │       │ Poprzednia wersja zostaje│
       └─────────────────────────┘       │ Raport dla dewelopera   │
                    │                    └─────────────────────────┘
                    ▼
       ┌─────────────────────────┐
       │ Health Check po restarcie│
       │ (taskand-doctor)        │
       └─────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │ PASS                  │ FAIL
        ▼                       ▼
┌──────────────┐       ┌─────────────────────────────────────┐
│ System ZDROWY│       │ AUTOMATYCZNY ROLLBACK:              │
│ Gotowy do    │       │ 1. Przywrócenie poprzedniej migawki │
│ pracy        │       │    (history.py rollback <snap_id>)  │
└──────────────┘       │ 2. Alert krytyczny do dewelopera    │
                       └─────────────────────────────────────┘
```

1. **Bramka prewencyjna (Digital Twin)**:
   - Żaden nowy kod nie trafia na produkcję bez uprzedniej kwalifikacji w piaskownicy Digital Twin (Bramki A i B).
   - Jeśli kandydat nie spełnia Definition of Done (DoD), proces ewolucji zatrzymuje się po 3 próbach, a działająca wersja produkcyjna nie zostaje naruszona.

2. **Awaria po restarcie (Post-restart Health Check)**:
   - Jeśli usługa produkcyjna (np. po restarcie lub zmianie konfiguracji) nie wstanie w wyznaczonym czasie (timeout 3000ms) lub zwraca błędy 5xx:
     - `taskand-doctor` natychmiast rejestruje stan `DOWN` / `CRITICAL`.
     - Bramka REST API raportuje błąd `502 Bad Gateway`.
     - Jeśli zdefiniowano `rollbackSnapId`, system automatycznie wywołuje rollback do ostatniej zweryfikowanej migawki CAS:
       ```bash
       python3 /taskand/scripts/history.py rollback snap-<id>
       # lub przez CLI:
       taskand rollback snap-<id>
       ```
     - `taskand-doctor` generuje zlecenie `evolve-fix` o priorytecie `user-blocking` do `taskand-developer`, informując o nieudanej próbie restartu.
