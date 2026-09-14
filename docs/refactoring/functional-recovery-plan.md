---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "functional-recovery-plan",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Stan funkcjonalny Taskand i plan przywrócenia czatu oraz rozwoju",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-14",
  "updated": "2026-09-14",
  "review_after": "2026-09-21",
  "source_revision": "cf8c606f46edc17332e66c1f39cc6f14b7ff41b7",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "repo://semcod/taskand-glm53/index.html",
    "repo://semcod/taskand-glm53/gateway/auth.py",
    "repo://semcod/taskand-glm53/gateway/router.py",
    "repo://semcod/taskand-glm53/generated/planner/plan/taskand.dev/v1/bin.mjs",
    "repo://semcod/taskand-glm53/tests/mesh_test.py",
    "repo://semcod/taskand-glm53/project/ticket-003/intent.json",
    "receipt:sha256:64d6c78ad565085abab6bb2ade6c0db4acbb759ca6517b2c59e398f6db6acdeb"
  ]
}
---

# Taskand-glm53: stan funkcji i kolejność dalszych prac

<!-- docs:section goal -->
## 1. Cel i granica tego dokumentu

Przywrócić użyteczny, uwierzytelniony czat oraz wdrożyć i rozwijać Taskand
według sprawdzalnych etapów. **Scalenie kodu nie oznacza działającego wdrożenia.**
Plan powstał na żądanie użytkownika w [ticket-003](../../project/ticket-003/README.md).
Nie wykonuje napraw, nie uruchamia obserwatorów i nie udziela zgody na produkcję.
Identyfikatory `F-*` poniżej są sekcjami planu, nie przydzielonymi ticketami
ani działającymi procesami URI. Tickety wykonawcze powstają dopiero przy
podjęciu ograniczonego etapu przez zarządzany lifecycle.

<!-- docs:section evidence -->
### Źródła dowodów

Stan repo i HTTP sprawdzono 2026-09-14; testy tego samego drzewa pochodzą
z poprzedniej sesji tego dnia. Nie uruchamiano ponownie pełnej macierzy testów
przy zmianie samej dokumentacji. Nie badano w tej sesji RPi przez SSH,
historycznych sesji człowieka ani płatnego wywołania LLM.

<!-- docs:section current_state -->
## 2. Nad czym pracowaliśmy

Historia funkcjonalna miała siedem powiązanych kierunków:

1. **Komplementarność zadania:** prompt → kontekst → plan → test w bliźniaku
   → decyzja człowieka → wykonanie → dowody → propozycja kolejnego etapu.
2. **Bliźniaki:** sieć z zachowaniem podsieci/IP; modele urządzeń; capture/replay
   stron i API, m.in. scenariusze dla GitHub i `subactor.com/login_up.php`.
3. **Reużycie organizmów:** najpierw rejestr i zgodny proces URI, dopiero potem
   uzasadnione utworzenie nowej zdolności; adresacja, wersje i hashe pakietów.
4. **Planner i kontekst:** deterministyczny DSL, istniejące referencje URN,
   rejestr promptów/odpowiedzi, syntetyczne profile użytkownika i ich wersje.
5. **Panel:** graf aktualnego żądania, struktura instancji/organizmów/procesów,
   radar zmierzonych parametrów i jawne oznaczanie brakujących danych.
6. **Federacja i obserwatory:** współpraca nvidia ↔ RPi `maskfleet5`, replikacja,
   wspólny jawnie powiązany profil użytkownika, pilotaże Taskand/Git/testów,
   CLI/IDE i przeglądarki, zawsze z kontrolą zgody i prywatności.
7. **Ewolucja i dostawa:** diagnoza → propozycja naprawy → test regresji,
   kontrolowany push/PR/merge, brak narastających osieroconych zmian, widoczny
   stan wydania i możliwość odzyskania pracy.

Ostatnia część rozmowy dotyczyła głównie odzyskania, scalenia i uporządkowania
tej pracy, a nie ukończenia wszystkich powyższych funkcji.

### Git, testy i runtime — trzy różne stany

| Warstwa | Obserwacja | Wniosek |
| --- | --- | --- |
| Kod | PR #1, #3, #4, #5, #7, #8, #9 i #10 są scalone; `origin/main` = `cf8c606f46edc17332e66c1f39cc6f14b7ff41b7` | Zdalny checkout nie ma otwartego PR ani zdalnej gałęzi `ticket/*`; samo scalenie nadal nie oznacza wdrożenia. |
| Workspace | Jedyny lokalny worktree to checkout główny na `ticket/003-functional-recovery-plan`; dokumenty ticketu-003 pozostają nieśledzone i nie są jeszcze opublikowane | Nie wolno ich nadpisywać ani uznawać za część `origin/main`; przed publikacją trzeba wykonać osobny przegląd i walidację ticketu. |
| Testy Python | 50/50 PASS, w tym panel w realnym Chromium | Dowód kontekstu, uprawnień, grafu i syntetycznych obserwatorów na kopii źródeł. |
| WWW twin | 8/8 PASS z Chromium/bwrap i lokalnymi fixtures | Capture/replay działa dla testowanych scenariuszy; nie potwierdza backendu obcej strony. |
| Procesy i sieć | Konformacja, kontrakty, negatywne i 8 testów bliźniaka sieci PASS | Ograniczone kontrakty są sprawdzone; nie pełna kopia całej infrastruktury. |
| Integracja | 42/43; 26.209 s i 25.694 s przy limicie 20 s | Funkcjonalne asercje przechodzą; zestaw jako całość FAIL. |
| Governance po merge | 11 findingów dla starego aktywnego zakresu ticket-001 | Ręczny merge nie naprawił lifecycle, zakresów ani skanera; nie deklarować zielonego CI. |
| Gateway 8077 | `/healthz` 200, `ok=true`, nvidia, 30 procesów, LLM skonfigurowany | To tylko liveness/readiness obserwowanego procesu; nie potwierdza realizacji dowolnego promptu. |
| Panel 8090 | HTTP 200, stary HTML bez Authorization i pola tokenu | Nowy panel nie został wdrożony. |
| Nowe API na działającej usłudze | `/api/context` i `/api/mesh/state`: 404 | Działa starszy gateway, nie spójny zestaw nowych funkcji. |
| Wydanie | Brak GitHub Releases w audycie po merge; VERSION `3.0.0-dev` | Nie ma potwierdzonej nowej paczki/wdrożenia. |

Ostatni szczegółowy raport lokalny: prywatny katalog
`~/.local/state/taskand/repository-change-controller/handoffs/taskand-post-merge-20260914.SgeQVb/`.
`verification.md` ma digest podany w metadanych. To lokalna referencja dowodowa,
nie publiczny resolver ani dowód odzyskiwalności na drugim komputerze.

### Dlaczego czat zwraca 401

Odtworzono żądanie bez poświadczenia do `/api/chat`; odpowiedź:
`401`, wymagany `Authorization: Bearer <token>`. Serwowany HTML nie wysyła
tego nagłówka i nie daje użytkownikowi pola tokenu. To potwierdzona przyczyna
niedziałania obecnego formularza, nie dowód awarii LLM ani przyczyna do
wyłączenia uwierzytelniania. Nie sprawdzano prywatnego tokenu użytkownika.

W [aktualnym index.html](../../index.html) są pole tokenu i nagłówek Bearer.
[Gateway](../../gateway/auth.py) osobno sprawdza poświadczenie i grant do URI.
Dlatego po wdrożeniu nadal potrzebne jest prawidłowe poświadczenie:
brak/błędny token → 401; poprawny token bez właściwego grantu → 403.
Klucz dostawcy LLM z `.env` **nie jest** tokenem dostępu do czatu.

Aktualny runtime jest odłączony od Git i używa snapshotu
`/home/tom/.local/share/taskand-glm53-runtime-20260913.i4WtVa`.
Sam `git pull`, merge, odświeżenie strony albo restart istniejącego kontenera
nie wymienia jego źródeł na nowy kod.

### Funkcje: co istnieje i jakie ma granice

| Funkcja | Stan kodu przy wskazanym SHA | Brakująca część |
| --- | --- | --- |
| Rejestr procesów | URI `proc://taskand.dev/.../vN`, select/resolve, hash, candidate/active i import pakietu | Wspólny kompletny kontrakt błędów, stanów, typów, zmiennych i I/O dla każdego organizmu; backendy inne niż MJS. |
| Planner DSL | `TASKAND_PLANNER`, VERSION 1, request-only, digest rejestru, lokalna walidacja referencji i DAG | Niezweryfikowane provider GBNF; pełne schematy większości procesów niedostępne. Akceptowany kandydat kończy się `NEEDS_EXECUTION_CONTRACT`, nie wykonaniem. |
| Pokrycie wejść plannera | Jawne kontrakty dla odczytowego file/ops i monitor/cpu | WWW jest celowo odrzucane jako nieposiadające pełnego schematu; pozostałe procesy mogą zwrócić `DSL_PROCESS_INPUT_CONTRACT_UNAVAILABLE`. |
| Prompty i profile | Store SQLite, owner ACL, URN, rewizje, referencje, opt-in treści | Nie wszystkie dawne prompty i wejścia CLI są rejestrowane; brak wspólnej tożsamości między komputerami. |
| Bliźniak sieci | Model IPv4/IPv6, parzystość podsieci/zakresów, odmowa konfiguracji w namespace źródła | Nie odtwarza automatycznie firmware, wszystkich usług, routingu, DHCP/DNS, NAT/ACL, VLAN i danych każdego hosta. |
| Bliźniak WWW | Publiczny capture, izolowany replay, jawne mocks, blokada nieznanych żądań | Nie klonuje bazy ani prywatnego backendu; pozytywny mock nie zatwierdza produkcyjnej operacji. |
| Profile człowieka | Jawne syntetyczne scenariusze, kompozycja i wersje | Nie kopia psychiki/osobowości i nie automatyczne łączenie człowieka po loginie/IP/stylu promptu. |
| Graf i radar | Nowe handlery oraz UI, przetestowane na fixture | Brak wdrożenia; graf żądania pokazuje granice gateway/proces, nie wszystkie instrukcje i węzły. Dostępność peerów/wierność modeli pozostają nieznane. |
| Obserwatory | Trzy normalizatory syntetycznych zdarzeń i plan → symulacja → WAIT_FOR_HUMAN_DECISION | Brak natywnych kolektorów live i kontrolera zgód do ich aktywacji. |
| Federacja | Lista peerów, katalog HTTP, pobieranie pakietów jako candidate; occupy jako plan operatorski | To nie zaufane zdalne wykonywanie zadań; brak pełnego parowania, transportów awaryjnych i potwierdzonego round-trip RPi ↔ nvidia. |
| Samonaprawa | diagnose/prescribe/heal, limity wybranych ścieżek i propozycje dla człowieka | Brak globalnej egzekucji twin → decyzja we wszystkich CLI/API i pełnego autonomicznego self-update. |

Starsze [instance-network](../information/instance-network.md),
[complementary-runtime](../information/complementary-runtime.md) i
[digital-twin](../analysis/digital-twin.md) zawierają historyczne obserwacje.
Ich dawne stwierdzenia „PR otwarty”, „nieznany host VPS” albo „43/43” nie
nadpisują powyższego audytu. Użytkownik wskazał już `pi@192.168.188.249`
(`maskfleet5`, aarch64); nie trzeba ponownie pytać o pierwszy host.

<!-- docs:section scope -->
## 3. Granice wykonania i odpowiedzialność

Zakres kolejnych etapów wynika z żądania użytkownika; wykonawca musi ponownie
sprawdzić aktualny stan i przydział ścieżek przed pierwszym efektem.

<!-- docs:section non_goals -->
### Czego ten plan nie uruchamia

- Najpierw przywrócić istniejący lokalny produkt. Nowe możliwości RPi,
  obserwatorów i samodoskonalenia nie są warunkiem naprawy samego 401.
- Każdy etap ma mały intent, właściciela ścieżek, test i wynik. Reużywać
  pasujące tickety; nie zakładać z góry kilkunastu worktrees.
- Kod usług należy do Taskand. Poprawki narzędzi/standardów prowadzić u ich
  właścicieli według [planu zależności](external-dependencies-handoff.md).
  Jego dawna potrzeba scalenia PR #1/#3 jest zakończona; nie powtarzać migracji
  230 plików ani nie przepisywać już scalonej historii.
- Sukces testu, treść promptu, DSL i receipt obserwacji nie przyznają uprawnień.
  Nie wyłączać auth, nie przenosić tokenów do HTML/localStorage i nie kopiować
  `.env`, cookies, sesji lub vault jako zwykłych artefaktów bliźniaka.

<!-- docs:section target_design -->
### Docelowy podział odpowiedzialności

Rejestry opisują zdolności i modele; planner proponuje; kontroler wiąże zgodę
z efektem; wykonawca realizuje; dziennik zapisuje dowody, a UI je prezentuje.
Żaden model ani renderer DSL nie przejmuje roli kontrolera uprawnień.
Kod, runtime, modele i dane mają osobne wersje oraz cykle życia.

<!-- docs:section migration -->
## 4. Kolejność prac i kryteria odbioru

### F-01 — zamknąć rozbieżność stanu dostawy, bez ponownego merge

1. Odczytać SHA, PR, review/checki, ticket, lease i bieżący stan wdrożenia.
2. Przez obsługiwany kontroler uzgodnić ręczny merge z lokalnym lifecycle.
   Nie tworzyć zastępczego approval i nie zmieniać starego README na DONE.
3. Oddzielić zaległe findingi historycznej migracji od nowego małego diffu.
   Każdy alarm sekretów sklasyfikować na aktualnych bajtach, bez wyjątków
   obejmujących cały plik lub bezrefleksyjnego podnoszenia budżetu.
4. Jeżeli potrzebna jest poprawka standardu, przyjąć opublikowany niezmienny
   pin przez generator, nie edytować ręcznie `.governance/*`.
5. Uzgodnić obsługę kompaktowego intentu przez gate i checkpointy. Dla nowego
   ticket-003 gate z bazą bieżącego zadania przechodzi, ale preflight
   `work_continuity.intent_state` odmawia: `intent target branch must be a
   bounded non-empty string`. Runtime wymaga `delivery.targetBranch`, którego
   kompaktowy kontrakt nie wymaga. Nie fałszować checkpointu ani rozbudowywać
   scope wyłącznie po to, by ukryć tę niespójność; zachować skanowany snapshot
   i naprawić zgodność kontraktów u właściciela standardu.

Odbiór: gate rozlicza właściwy zakres; historia zachowana; brak fałszywej
aktywnej rezerwacji i fałszywych zielonych checków. Może wymagać zewnętrznego
właściciela — nie włączać tej naprawy ukradkiem do zmiany czatu.

### F-02 — naprawić powtarzalny budżet diagnostyki

1. Odtworzyć niezmieniony test integracyjny w networkless fixture.
2. Zmierzyć osobno sondy usług, CDP, peerów i wywołania rejestru. Poprzedni
   pomiar: chat z diagnozą 10.556 s, heal w trybie plan 10.848 s.
3. Zaprojektować ograniczoną równoległość sond, jeden deadline i jawny wynik
   niedostępności. Nie uruchamiać produkcyjnego healing w celu testowania.
4. Testować odmowę połączenia, wolny DNS, timeout, częściową odpowiedź i brak
   usług. Fixture nie może wymagać działającego RPi ani aktualnego hosta.

Odbiór: 43/43 w kilku powtórzeniach, bez podniesienia limitu wyłącznie dla
zielonego wyniku; niezmienione rozpoznanie błędów i brak pominiętych testów.

### F-03 — przygotować zgodny zestaw gateway + UI i kontrakt auth

1. Reużyć scalone pole tokenu i helper nagłówków; nie pisać kolejnego czatu.
2. W izolacji sprawdzić 401 bez tokenu/z błędnym tokenem, 403 bez grantu,
   poprawny odczyt z grantem, CORS oraz błędy/timeout API.
3. Dodać czytelny komunikat w UI przed wysłaniem bez tokenu i rozróżniać
   odmowę auth od błędu LLM. Token wyłącznie w pamięci; wyczyścić przy wylogowaniu.
4. Powiązać oba artefakty z jednym SHA/manifestem. Health i UI powinny pokazywać
   commit/wersję API, nie tylko stałe `3.0.0`. Rozróżnić readiness i liveness.

Odbiór: test prawdziwej przeglądarki przechodzi ścieżkę formularz → nagłówek →
API; brak sekretów w logach, URL i artefaktach; stary klient zgłasza niezgodność.

### F-04 — wdrożyć lokalnie i potwierdzić działanie po przełączeniu

Warunki: F-01 i wymagane bramki, F-02/F-03 oraz uprawnienie do konkretnego
deploymentu. Sam ten plan nie zastępuje zgody na zmianę działającej usługi.

1. Przygotować przypięty snapshot runtime poza Git, spójny gateway i HTML.
   Porównać seed/state, zachować wyewoluowane pakiety i dane; nie nadpisywać
   automatycznie registry/genome nową kopią z repo.
2. Zachować konfigurację i poprzedni snapshot jako rollback. Przetestować
   migrację kontekstu na kopii danych; stara wersja nie może uszkodzić nowej bazy.
3. Uruchomić canary bez portów/danych produkcyjnych. Sprawdzić procesy,
   endpointy, auth, UI i diagnostykę; bez hostowego Docker socket.
4. Przełączyć wyłącznie uzgodnione gateway/landing. Nie uruchamiać całego
   Compose ze starego manifestu jako niejawnego deployera.
5. Sprawdzić serwowany hash HTML, SHA aplikacji, 401/403 i jeden odczytowy
   prompt z grantem. Oddzielnie, w ustalonym budżecie, sprawdzić wywołanie LLM.

Odbiór: 8090 serwuje nowy panel, API kontekstu i grafu nie zwraca 404,
uwierzytelniony odczyt działa, requestId i zdarzenia dają się odnaleźć.
Brak obserwatorów live lub zgody na efekt nie może być prezentowany jako awaria czatu.

### F-05 — ujednolicić kontrakty organizmów, DSL i wejścia zadań

1. Zinwentaryzować istniejące URI/schematy i brakujące błędy, stany, typy,
   deklaracje zmiennych, modele wejścia/wyjścia oraz możliwości runtime.
2. Uzgodnić jeden językowo niezależny manifest, wersję schematu, resolver
   URI/URN, kompatybilność i hash. Konkretne nowe nazwy zarejestrować przed użyciem.
3. Dodać zamknięte schematy procesów do rejestru i generować z nich kontrakt
   plannera. Usunąć potrzebę ręcznej listy wyjątków dla każdego procesu.
4. Weryfikować, które wejścia naprawdę spełniają request-only GBNF/Schema.
   Rozdzielić kopertę zadania, zdarzenia diagnostycznego i decyzji/autoryzacji;
   wspólna korelacja nie oznacza identycznej semantyki ani praw do efektów.
5. Testować oba backendy MJS/Python, niezgodną wersję, brak URI, zmianę hasha,
   uszkodzony rejestr i niedostępny resolver. Błąd odczytu nie może dawać pustego
   katalogu uznanego za pełny sukces.

Odbiór: nowe procesy można opisać i walidować bez zmiany plannera dla każdej
rodziny. Dockerfile per organizm nie jest wymagany z zasady: manifest deklaruje
runtime, a obraz OCI/VM/emulator jest przypiętym backendem wykonania.

### F-06 — egzekwować plan → twin → decyzja na wszystkich ścieżkach

1. Zinwentaryzować efekty dostępne z chat, CLI, bezpośredniego registry/proc,
   orchestratora, healing, occupy i przyszłych wywołań zdalnych.
2. Odczyty/kompilację oddzielić od skutków produkcyjnych; plan binduje task/step,
   URI, schemat, hash, cel, zasoby, deadline i budżet.
3. Controller sprawdza pokrycie testu bliźniaka oraz zgodę na ten dokładny efekt.
   Zmieniony plan/model/target wymaga ponownej kwalifikacji; timeout po wysłaniu
   daje OUTCOME_UNKNOWN i uzgodnienie, a nie ślepe powtórzenie.
4. Negatywne testy muszą próbować ominąć UI przez CLI, registry i healing.

Odbiór: bez zgodnych dowodów żadna ścieżka nie wykonuje efektu. Poprawny DSL
pozostaje propozycją do czasu spełnienia rzeczywistego kontraktu wykonania.
Ten etap poprzedza autonomiczne zadania i aktywację kolektorów.

### F-07 — rozszerzać bliźniaki według mierzonej wierności

1. Ujednolicić rejestr modeli: właściciel, źródło, czas, wersja, digest,
   dokładne składowe, znane/nieznane cechy, coverage scenariuszy i retencja.
2. Sieć: testować IPv4/IPv6, te same podsieci i zakresy w izolowanym namespace;
   osobno dodawać routing/VLAN/DNS/DHCP/ACL, tylko z uprawnionych obserwacji.
3. Nieznane urządzenie rejestrować jako UNKNOWN z dowodami, nie zgadywać OS
   lub firmware po IP. Model protokołu/mock, kontener i pełna VM to różne
   poziomy wierności. Rzeczywisty firmware wymaga dostępnego/legalnego obrazu.
4. WWW: reużyć capture/replay, testy nieznanego requestu i rozdział synthetic/
   captured. GitHub i login_up.php nie są zgodą na wysyłanie formularzy produkcyjnych.
5. Kompozycja przypina rewizje: urządzenie → OS/usługi → przeglądarka → model
   WWW. Android/iOS, CPU i peryferia mogą wymagać emulatora/VM zamiast Dockera.

Odbiór: dwa zadania reużywają ten sam niezmieniony model; ulepszenie tworzy nową
rewizję bez psucia poprzedniego replay. „Pełny bliźniak” wymaga jawnej listy
odtworzonych cech, nie tylko zgodności IP.

### F-08 — bezpieczny pilot nvidia ↔ maskfleet5

1. Zacząć od wskazanego hosta `pi@192.168.188.249`, weryfikacji host key,
   architektury i obecnej instalacji. Nie pytać ponownie o znany adres i nie
   traktować historycznego SSH jako bieżącego dowodu zdrowia Taskand.
2. Przetestować przypięty bootstrap i rollback w modelu testowym ARM64;
   `occupy` wymaga audytu argumentów, kopiowanych grants i dystrybucji sekretów.
3. Po kwalifikacji efektu sparować trwałe instanceId i tożsamości urządzeń,
   przyznać ograniczone granty. Wykonać odczytową inwentaryzację, zbudować model
   RPi na developerze i dopiero testować kolejne zadania.
4. Rozdzielić katalog/import pakietu od zdalnego wykonania. Najpierw jeden
   uwierzytelniony transport, potem adaptery HTTPS/SSH/WS/kolejki bez osłabienia
   ochrony przy fallbacku. Discovery ogłasza kandydata, nie automatyczne zaufanie.
5. Sprawdzić round-trip w obu kierunkach, restart, utratę sieci, duplikat,
   idempotencję, wygaśnięcie grantu i niezgodność wersji. Nie używać produkcyjnego
   deploymentu jako pierwszego testu transportu.

Odbiór: zdalny odczyt ma task/step URN i receipt z konkretnym węzłem; po reconnect
efekt nie wykonuje się drugi raz. Landing może być opcjonalny, z manifestem
instalacji i zgodnością API; otwarcie go nie uruchamia skanu sieci.

### F-09 — prompty, profile i wszystkie trzy obserwatory

1. Sprawdzić rejestrację wejść web/shell/agentów: requestId, owner, causation,
   czas, redakcję i odczyt przez resolver. Treść tylko z określoną retencją;
   nie deklarować odzyskania historycznych promptów, których nie zarejestrowano.
2. Powiązać człowieka na wielu urządzeniach przez jawne parowanie/IdP i zgodę,
   nie nazwę admin, IP lub podobny tekst. Preferencje/fakty odróżniać od hipotez.
3. Reużyć trzy normalizatory pilota; natywne adaptery Taskand/Git/testy, CLI/IDE
   i browser wdrażać osobnymi małymi etapami, z fixture i testem realnego źródła.
4. Wymagać dokładnego źródła, typów zdarzeń, czasu pracy, retencji, odbiorców,
   hashów adaptera/planu oraz zgody po teście bliźniaka. Widoczne start/pauza/stop
   i cofnięcie zgody; bez haseł, schowka, surowych klawiszy, cookies i formularzy.

Odbiór: wszystkie trzy adaptery mają osobne dowody zbierania, redakcji, odmowy
nieznanego formatu i zatrzymania. Symulacja sześciu rekordów nie wystarcza do
deklaracji, że rzeczywiste kolektory działają.

### F-10 — widoczny stan, zadania następcze i małe dostawy

1. Reużyć graf/radar; dodać mierzone lastSeen, freshness, kolejkę i postęp etapów.
   Unknown pozostaje unknown. Osobno pokazywać source SHA, push, PR, CI, merge,
   wydanie, deployment i wynik zadania, wraz z następnym działaniem/odmową.
2. Kontynuować projekt read-only nadzorcy z [ticket-002](../../project/ticket-002/README.md),
   po aktualizacji jego wąskiego intentu, nie jako równoległy konkurencyjny writer.
3. Reużyć Planfile jako projekcję/intake i adapter GitHub Issues; ustalić trwały
   taskId oraz authority kontrolera. Obecny lokalny pilot nie jest gotowym
   rozproszonym systemem synchronizacji. Unikać dwóch niezależnych „prawd” o statusie.
4. Propozycje kolejnych prac wyprowadzać z jawnych braków/potrzeb, zależności,
   historii wyników i wskazanego zakresu lokalnych repo. Każda propozycja podaje
   dowody, koszt, test w twin i wymagane decyzje; nie wykonuje się sama.
5. Intake → jeden aktywny zakres → mały commit/PR → kontrolowana integracja;
   alertować opóźniony push i odchylenie runtime od main. Po zaginionej odpowiedzi
   najpierw odczytać efekt; nie mnożyć branchy po tym samym błędzie.

Odbiór: człowiek z panelu/shell rozumie, co trwa, co zakończono i dlaczego coś
czeka, bez czytania logów agenta. Przekroczenie budżetu zatrzymuje tylko dotknięty etap.

### F-11 — uczenie się i samoaktualizacja dopiero na stabilnej podstawie

1. Normalizować JSON/JSONL, tekst, stderr, exit status i CI przez wersjonowane
   adaptery z redakcją, pochodzeniem i confidence. Nieznany format → UNKNOWN,
   nie komenda ani automatycznie zaakceptowany przykład treningowy.
2. Z incydentu robić odtwarzalny test i wersjonowaną receptę, z limitem prób
   wspólnym między sesjami/instancjami. Log i wynik LLM są niezaufanymi danymi.
3. Kandydat naprawy/self-update: ograniczony ticket → twin → regresje →
   niezależne review/chroniony merge → podpisany artefakt → canary → rollback.
   Multiplikacja nie tworzy nowych uprawnień ani nie resetuje budżetu rodzica.
4. Dopiero wtedy podjąć trzy wskazane zadania doctor-agent: odczytać aktualną
   listę Issues, wybrać zakres, powiązać lokalne repo i przetestować przed efektem.
   Nie traktować pobrania Issue lub wygenerowania planu jako wykonania zadania.

Odbiór: test kontrolowanej awarii pokazuje naprawę i brak regresji; taskand
nie zatwierdza sam własnego kodu i nie naprawia awarii przez osłabienie bramek.

<!-- docs:section acceptance -->
### Odbiór planu i poszczególnych etapów

Plan jest przydatny, gdy identyfikuje przyczynę 401, granicę source/deployed,
brakujące funkcje oraz kolejny bezpieczny efekt. Odbiór implementacji następuje
oddzielnie według warunków „Odbiór” w F-01–F-11; nie ma zbiorczego automatycznego
zatwierdzenia wszystkich etapów. Nowa obserwacja zmienia plan, nie historię dowodów.

<!-- docs:section validation -->
## 5. Walidacja i minimalna ścieżka do użytecznego produktu

```text
F-01 lifecycle ─┐
F-02 diagnostyka ─┼→ F-04 canary/deploy → działający lokalny czat i nowy panel
F-03 UI + auth ─┘
                          ↓
F-05 kontrakty → F-06 kontrola efektów → F-07 modele / F-08 federacja / F-09 obserwatory
                          ↓
                   F-10 obserwowalność → F-11 kontrolowana ewolucja
```

Przygotowanie testów i dokumentacji może przebiegać niezależnie. Ten graf
nie nakazuje przebudowy wszystkich standardów przed odczytowym testem czatu
i nie zezwala na pominięcie wymaganej bramki konkretnego wdrożenia.

- Dla każdego etapu: dokładny SHA/digest kodu, fixture, narzędzi i kontraktu;
  pozytywne oraz negatywne przypadki, brak skipów wymaganych scenariuszy.
- Relewantne zestawy: `tests/context_test.py`, `tests/mesh_test.py`,
  `tests/observers_test.py`, `tests/web_twin.test.mjs`,
  `tests/digital_twin.test.mjs`, konformacja, kontrakty, negatywne i integracja.
- `make test` nie uruchamiać bezpośrednio przeciw aktywnemu hostowi:
  część testów zmienia registry/genome i odpytuje 8077. Użyć kopii źródeł,
  networkless runtime oraz własnego gateway; WWW z działającą izolacją Chromium.
- E2E LLM i RPi to odrębne testy z zakresem i budżetem. Nie zastępować ich
  mockami bez oznaczenia i nie przedstawiać health jako ich zaliczenia.
- Raportować osobno testy developerskie, CI, review, release i deployment.
  Po zmianie istotnego wejścia unieważnić zależny dowód, nie całą historię projektu.

<!-- docs:section risks -->
## 6. Ryzyka i zakazy

Najważniejsze ryzyka to fałszywe „gotowe” po merge, niekompletny model,
obejście kontroli efektów przez drugi interfejs, powielenie deploymentu po
timeout oraz ujawnienie sekretów/historii człowieka. Nieznany stan i format
muszą mieć własną reprezentację. Nie dodawać kolejnej funkcji do zaległego
dużego changesetu pod pretekstem odblokowania publikacji.

<!-- docs:section rollback -->
## 7. Rollback i koniec etapu

Przed deploymentem zapisać dokładny poprzedni artefakt, konfigurację mountów
i sposób odtworzenia danych; przetestować rollback w izolacji. Po awarii
sprawdzić bieżący digest, żeby nie zastąpić nowszego wdrożenia innego operatora.
Nie usuwać snapshotów/unikalnych danych przy sprzątaniu Git. Cofnięcie grantu
zatrzymuje obserwację/zdalne efekty; nie usuwa bez zgody materiału dowodowego.

Etap jest zakończony dopiero po jego kryterium odbioru. „Działający Taskand”
oznacza jawnie wybrany zakres: najpierw lokalny czat i panel, potem konkretne
modele/peery, a nie obietnicę pełnej autonomii dla dowolnego przyszłego zadania.

<!-- docs:section ownership -->
## 8. Właściciele dalszej pracy

Taskand-glm53 odpowiada za handlery, UI, procesy, modele, testy i integrację
wdrożenia. Właściciele narzędzi i standardów odpowiadają wyłącznie za swoje
kontrakty, checkery i profile, zgodnie z planem zależności. Człowiek decyduje
o dostępie do danych/hostów i wymaganych efektach; niezależny proces review
odpowiada za zatwierdzenie kodu. Żaden wykonawca nie zmienia tu taskand-gpt6.
