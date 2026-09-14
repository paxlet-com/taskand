---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "post-deployment-validation-questions",
  "kind": "information",
  "version": 1,
  "title": "Pytania odbiorowe po wdrożeniu planu naprawczego Taskand",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-14",
  "updated": "2026-09-14",
  "review_after": "2026-09-21",
  "source_revision": "cf8c606f46edc17332e66c1f39cc6f14b7ff41b7",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "repo://semcod/taskand-glm53/docs/refactoring/functional-recovery-plan.md",
    "repo://semcod/taskand-glm53/project/ticket-003/intent.json",
    "repo://semcod/taskand-glm53/gateway/auth.py",
    "repo://semcod/taskand-glm53/generated/registry/core/taskand.dev/v1/package.mjs"
  ]
}
---

# Pytania, na które agent musi odpowiedzieć przed dalszą ewolucją

<!-- docs:section purpose -->
## Cel

To instrument odbioru [planu F-01–F-11](../refactoring/functional-recovery-plan.md),
nie raport z wykonanych testów. Agent odpowiada po wdrożeniu wskazanego etapu
i przed rozpoczęciem zależnego etapu [planu ewolucji](../refactoring/continuous-evolution-plan.md).
Nie wystarczy odpowiedź „tak”, zielony healthcheck ani opis możliwości z README.

<!-- docs:section scope -->
## Zakres i sposób odpowiedzi

Najpierw nazwać odbierany zakres: lokalny czat, panel, konkretne procesy,
CI/CD konkretnego repo, jeden peer, określony obserwator lub aktualizacja floty.
Nie wymagać gotowości całej federacji dla niezależnego odbioru lokalnego czatu.
Wymagane pytania dla danego etapu muszą mieć PASS; FAIL/UNKNOWN blokują tylko
zależną promocję. N/A wymaga uzasadnienia i wskazania warunku aktywacji.

Każda odpowiedź zawiera:

| Pole | Co agent ma podać |
| --- | --- |
| questionId, status | stabilne `V-*`; PASS, FAIL, UNKNOWN lub N/A |
| claim, scope | jedno konkretne twierdzenie, repo/instancja/proces/scenariusz |
| subject | source SHA, digest artefaktu, config/policy/schema/model i wersje zależności |
| observation | czas UTC, środowisko/architektura, metoda i rzeczywisty wynik |
| evidence | URI/ścieżka dowodu, SHA-256; kto go wytworzył i jak zweryfikowano |
| limits | nieprzebadane warianty, brak danych, termin/warunek utraty ważności |
| nextAction | minimalna remediacja, właściciel, istniejący ticket albo propozycja |

Jest to projekt formatu odpowiedzi, nie już zarejestrowany schemat runtime.
Nie wkładać tych pól do istniejącej koperty bez nowej wersji kontraktu.
Sekrety i surowa historia człowieka nie trafiają do odpowiedzi. Surowe logi
pozostają w właściwym magazynie dowodów; w docs tylko ograniczone referencje.

<!-- docs:section evidence -->
## Punkt odniesienia

Historyczna diagnoza 2026-09-14: stary panel 8090 nie wysyłał Authorization,
API czatu zwracało 401, a API kontekstu i grafu 404. Zestaw integracji miał
42/43 przez budżet czasu. To scenariusze regresji, a nie aktualny werdykt
w momencie późniejszego uruchomienia tej listy. Agent ma odczytać stan ponownie.
Nowe tickety i równoległe worktrees nie oznaczają automatycznie osieroconej pracy.

<!-- docs:section content -->
## A. Rzeczywista dostawa i odzyskiwanie — F-01

- **V-01:** Jaki dokładnie commit scalono, jakie drzewo źródeł zbudowano i jaki
  digest gateway/UI uruchomiono? Czy wszystkie trzy identyfikatory się zgadzają?
- **V-02:** Które PR, gałęzie, worktrees i niezapisane zmiany nadal istnieją?
  Dla każdego: właściciel, zakres, unikalna praca i kolejny krok; co jest aktywne,
  zintegrowane, zablokowane, a co rzeczywiście nie ma właściciela?
- **V-03:** Czy terminalny receipt pochodzi z właściwego kontrolera i wiąże
  ticket, PR, head, merge SHA i checki? Jak uzgodniono ręczny merge bez fikcyjnego approval?
- **V-04:** Czy governance ocenia właściwy diff i bieżącą bazę? Czy historyczna
  zaległość została oddzielona od nowego zakresu bez wyłączenia sprawdzeń?
- **V-05:** Czy checkpoint można zweryfikować po restarcie? Czy dirty snapshot
  ma skan sekretów, integralność i rzeczywistą lokalizację odzyskania poza checkoutem?
- **V-06:** Czy runtime działa niezależnie od usuwanego worktree, a rollback
  przywraca poprzedni artefakt i zgodny stan danych? Czy wykonano próbę odtworzenia?

## B. Diagnostyka i wydajność — F-02

- **V-07:** Czy niezmienione asercje integracyjne przechodzą w kilku powtórzeniach?
  Ile trwa każda sonda, ile jest timeoutów i co dominuje w czasie krytycznej ścieżki?
- **V-08:** Czy wspólny deadline obejmuje kolejkę, retry i sprzątanie potomków?
  Czy po timeout pozostają procesy, zajęte sloty lub powielone działania?
- **V-09:** Czy pomiary baseline/candidate mają ten sam workload, ograniczenia
  CPU/RAM, architekturę, zależności i cache-state? Jak duży jest szum pomiaru?
- **V-10:** Czy poprawa szybkości zachowała wyniki diagnostyki, bezpieczeństwo,
  świeżość i zużycie zasobów? Czy wolne/błędne żądania nie zniknęły z metryk?
- **V-11:** Jak ograniczono równoległość, rozmiary wejścia/wyjścia, próby i koszt
  obserwacji? Czy nowe limity oparto na dowodach, nie tylko podniesiono timeout?

## C. Czat i spójne wdrożenie — F-03/F-04

- **V-12:** Czy serwowany HTML zawiera właściwy klient auth i odpowiada artefaktowi
  wydania? Czy realna przeglądarka wysyła właściwy nagłówek do właściwego API?
- **V-13:** Jakie są wyniki: brak tokenu, błędny token, poprawny token bez grantu,
  poprawny token z grantem? Czy UI rozróżnia 401, 403, timeout i błąd LLM?
- **V-14:** Czy token jest wyłącznie w dozwolonym magazynie/pamięci, nie w URL,
  logach, snapshotach, localStorage lub historii rozmowy? Czy wylogowanie go usuwa?
- **V-15:** Czy API kontekstu i grafu nie zwraca już 404 dla uprawnionego użytkownika?
  Czy po restarcie zachowują się zgodnie z wersją klienta i schematu?
- **V-16:** Czy jeden odczytowy prompt przechodzi formularz → planner → proces →
  odpowiedź, z identyfikatorami dowodów? Osobno: czy wykonano rzeczywiste LLM E2E?
- **V-17:** Czy canary i rollback sprawdzono na kopii danych bez produkcyjnych
  efektów? Czy migracja nie nadpisała lokalnie wyewoluowanych pakietów ani kontekstu?

## D. Rejestr, DSL i kontrola skutków — F-05/F-06

- **V-18:** Czy każdy wybrany proces URI rozwiązuje się do konkretnej wersji,
  digestu, kontraktu wejścia/wyjścia i dozwolonego runnera? Czy brak daje jawną odmowę?
- **V-19:** Czy procesy, zadania, zdarzenia, błędy, typy i zmienne mają osobne,
  wersjonowane kontrakty i stabilne identyfikatory? Czy nie skopiowano sprzecznych list?
- **V-20:** Czy DSL jest deterministyczną projekcją zwalidowanego modelu intencji?
  Czy round-trip i błędne referencje przechodzą testy, a gramatyka jest sprawdzona u dostawcy?
- **V-21:** Czy każdy handler, CLI, healing, peer i ścieżka deploymentu respektuje
  plan → test w bliźniaku → decyzja? Czy test negatywny wykrywa próbę bocznego wejścia?
- **V-22:** Czy zgoda wiąże dokładny plan, wersje, parametry, cel, zakres i ważność?
  Czy zmiana istotnego wejścia wymaga ponownej oceny, a model nie przyznaje sobie praw?
- **V-23:** Czy restart/retry/duplikat komunikatu nie powiela efektu zewnętrznego?
  Czy brak potwierdzenia po timeout oznacza UNKNOWN, a nie automatyczne ponowienie?

## E. Wierność i kompozycja bliźniaków — F-07

- **V-24:** Jakie podsieci, IP, urządzenia i usługi odzwierciedla model, a czego
  nie odzwierciedla? Czy izolacja zapobiega kolizji adresów i ruchowi do realnej sieci?
- **V-25:** Jak modeluje się nieznane urządzenie? Czy nie zgaduje się firmware,
  uprawnień lub funkcji na podstawie samego portu/MAC/nazwy?
- **V-26:** Czy WWW twin deklaruje granice capture/replay i mockowanego backendu?
  Czy test nie wysyła produkcyjnego formularza i nie przenosi cookies/sekretów?
- **V-27:** Czy można złożyć bliźniak sieci, hosta, usługi, przeglądarki i profilu
  człowieka przez wersjonowane referencje, bez cykli i niejawnego „latest”?
- **V-28:** Czy dwa zadania reużywają ten sam immutable model, a ulepszenie tworzy
  nową rewizję z pochodzeniem, wynikami testów i mierzoną zmianą wierności?

## F. Federacja — F-08

- **V-29:** Czy nvidia i `pi@192.168.188.249`/maskfleet5 potwierdziły swoje tożsamości
  i zakresy zaufania? Czy discovery samo w sobie nie daje uprawnienia do wykonania?
- **V-30:** Czy ARM64 i lokalny host wykonują ten sam zgodny kontrakt przez właściwe
  artefakty? Czy odczyt sprzętu dotyczy hosta, kontenera czy emulacji i jest tak oznaczony?
- **V-31:** Czy po zerwaniu połączenia, restarcie i reconnect nie ma utraty ani
  podwójnego wykonania zadania? Jak rozwiązuje się konflikt lokalnej ewolucji z upstream?
- **V-32:** Czy brak kompatybilnego transportu/wersji daje jawny stan i propozycję
  działania, zamiast nieautoryzowanego SSH, instalacji lub downgrade?

## G. Prompty, profil człowieka i obserwatory — F-09

- **V-33:** Które wejścia rzeczywiście rejestrują prompty i odpowiedzi, z jaką
  zgodą, retencją i ownerem? Czy historyczne luki pozostają jawne?
- **V-34:** Czy profile z różnych urządzeń łączy zweryfikowane przypisanie konta,
  a nie domniemanie „ten sam człowiek”? Czy profil jest modelem, nie obiektywną diagnozą?
- **V-35:** Czy Taskand/Git/testy, CLI/IDE i browser mają osobne dowody z prawdziwych
  adapterów? Które testy nadal używają wyłącznie syntetycznych JSONL?
- **V-36:** Czy cofnięcie zgody zatrzymuje zbieranie na wszystkich powiązanych
  instancjach? Czy prywatne sesje, hasła, schowek i surowe klawisze są wykluczone?
- **V-37:** Czy odbiorca obsługuje rotację, uszkodzony rekord, częściowy UTF-8,
  duplikaty, duży strumień i nacisk na kolejkę bez pełnego odczytu logu przy każdym pollu?

## H. Operacje, priorytety i nauka — F-10/F-11

- **V-38:** Czy panel/shell pokazuje rzeczywisty etap: plan, twin, zgoda, wykonanie,
  CI, review, merge, release, deployment? Czy błędne i nieznane metryki nie są „zielone”?
- **V-39:** Czy istnieje jedno źródło tożsamości ticketu i kontrolowane projekcje
  Planfile/GitHub? Jak deduplikuje się finding, synchronizuje offline i wiąże worktree?
- **V-40:** Czy kolejność pracy uwzględnia URGENT, BUGFIX, FEATURE, SERVICE,
  zależności, trwające efekty, starzenie i czas zarezerwowany na utrzymanie?
- **V-41:** Czy incydent URGENT wybiera uzasadnione ograniczenie skutków, zamiast
  bezwarunkowo wyłączać system? Kto zatwierdza containment i wznowienie?
- **V-42:** Czy historia Git wspiera hipotezy o intencji, lecz nie nadpisuje
  aktualnego polecenia/polityki? Czy każda hipoteza wskazuje SHA/symbol/źródło i niepewność?
- **V-43:** Czy wynik data2dsl/todo2code jest zweryfikowany w testach lub przez
  właściwego właściciela, zanim zostanie uznany za regresję i zadanie naprawcze?
- **V-44:** Czy naprawa ma reproducer i nowy test regresji, a powtarzane próby
  limit, cooldown i eskalację? Czy nie tworzy lawiny ticketów lub procesów?
- **V-45:** Czy trzy zadania doctor-agent mają osobne dowody realizacji i zakresy?
  Czy brak uprawnienia/środowiska jest raportowany zamiast zastępowany pozornym sukcesem?

## I. Pytania po kolejnych etapach ewolucji — E-01–E-09

Ta sekcja jest warunkowa: nie blokuje wcześniejszego odbioru czatu.

- **V-46:** Czy release manifest pinuje pełne zależności i artefakty dla każdej
  platformy, a nie tylko tag Git? Czy rzeczywiste bajty są zweryfikowane podpisem i hashem?
- **V-47:** Czy węzeł po długim offline uzupełnia zależności i rotację kluczy,
  wykrywa przeterminowane metadane i nie aktywuje niekompletnej paczki?
- **V-48:** Czy aktualizacja w trakcie zadania zachowuje wersję tego zadania,
  dziennik skutków i fencing? Czy przerwanie zasilania w każdej fazie jest odtwarzalne?
- **V-49:** Czy lokalny mirror Git, magazyn paczek i registry polityki mają
  rozdzielone role? Czy push mirror nie nadpisuje chronionego upstream?
- **V-50:** Czy minimalny węzeł działa bez Gitea i bez dostępu do Internetu na już
  zaakceptowanych artefaktach, w granicach nadal ważnej polityki/uprawnień?
- **V-51:** Czy pakiet MJS i Python da się zbudować oraz wywołać w obcym projekcie
  bez dostępu do checkoutu Taskand? Czy README i metadane są projekcjami jednego manifestu?
- **V-52:** Czy lokalny CI weryfikuje dokładny wynik scalenia, a niezależny Validator
  zatwierdza dokładny head bez dostępu kandydata do kluczy lub własnych required checks?
- **V-53:** Czy tryb onboard najpierw inwentaryzuje nieuporządkowane repo read-only,
  zachowuje każdy unikalny diff i nie wykonuje bootstrapu nad cudzą pracą?
- **V-54:** Czy eksperyment wydajności przynosi powtarzalną poprawę przy zachowaniu
  jakości, bezpieczeństwa i kosztu, a wdrożenie potwierdza wynik osobno od bliźniaka?
- **V-55:** Czy nowa wersja Taskand nie może sama zmienić trust root, wyłączyć
  testów, zatwierdzić własnego PR albo zwiększyć limitów autonomii?
- **V-56:** Czy operator widzi mapę desired/observed version, ostatni kontakt,
  rollout cohort, blokadę i następny bezpieczny krok dla każdego węzła/repo?

<!-- docs:section limitations -->
## Granice odbioru

To nie jest gotowy walidator ani komplet pytań dla dowolnego produktu. Agent
dodaje kryteria specyficzne dla ryzyka i zakresu, nie usuwa niewygodnych pytań.
Wynik traci ważność po zmianie istotnego SHA, konfiguracji, zakresu, polityki,
modelu, danych lub warunków pomiaru. Nie utrzymywać nieskończenie ważnego PASS.

<!-- docs:section next_actions -->
## Handoff następnemu agentowi

1. Odczytaj aktualne pliki i stan runtime; nie zakładaj, że poprzedni plan wdrożono.
2. Wybierz zakres, wymagane pytania i próg świeżości dowodów.
3. Odpowiedz z referencjami; osobno wymień FAIL, UNKNOWN i uzasadnione N/A.
4. Wskaż pierwszy niespełniony warunek i najmniejszą bezpieczną remediację.
5. Kontynuuj niezależne gotowe etapy; nie uruchamiaj efektu bez wymaganej zgody.
6. Zapisz ograniczony raport odbioru i powiązany ticket, nie kopię całych logów.
