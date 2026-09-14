---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "continuous-evolution-plan",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Taskand po stabilizacji: wydajność, aktualizacje offline i operacje CI/CD",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-14",
  "updated": "2026-09-14",
  "review_after": "2026-09-21",
  "source_revision": "cf8c606f46edc17332e66c1f39cc6f14b7ff41b7",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "repo://semcod/taskand-glm53/docs/refactoring/functional-recovery-plan.md",
    "repo://semcod/taskand-glm53/generated/registry/core/taskand.dev/v1/package.mjs",
    "repo://semcod/taskand-glm53/generated/registry/core/taskand.dev/v1/federation.mjs",
    "repo://semcod/taskand-glm53/generated/registry/core/taskand.dev/v1/lifecycle.mjs",
    "repo://semcod/taskand-glm53/generated/hw/monitor/taskand.dev/v1/proc.yaml",
    "repo://semcod/taskand-glm53/generated/dev/evolve/taskand.dev/v1/bin.mjs",
    "github://wellmanifest/performance/commit/3573a263ec877bd5b67d462712e224742b69024b"
  ]
}
---

# Kolejny plan: kontrolowana ewolucja, aktualizacje i praca w obcych repo

<!-- docs:section goal -->
## 1. Cel i warunek wejścia

Taskand ma zwiększać użyteczność i wydajność podczas długiego działania,
bez utraty zadań, źródeł, uprawnień i możliwości odzyskania poprzedniej wersji.
Ma obsługiwać mały węzeł offline i repo z rozproszoną, nieuporządkowaną pracą.
Nie chodzi o maksymalną liczbę generowanych procesów ani PR, lecz o więcej
poprawnie zakończonych zadań przy ograniczonym koszcie i ryzyku.

Najpierw odebrać wymagane części [planu naprawczego F](functional-recovery-plan.md)
według [pytań V-01–V-56](../information/post-deployment-validation-questions.md).
Nie zakładać ich wdrożenia na podstawie tej prozy. Etap lokalny nie czeka na
niezależną pełną federację. Identyfikatory E są etapami projektu, nie istniejącymi
procesami URI, ticketami ani zgodą na efekty. Ten dokument jest projektem,
nie zarejestrowanym DSL wykonawczym.

<!-- docs:section scope -->
## 2. Zakres

Kontrakty paczek i wydań, aktualizacja autonomicznego runtime, offline i flota,
opcjonalny lokalny Git/registry, CI/CD istniejących projektów, priorytety,
analiza intencji z historii oraz pomiar ewolucji. Implementację dzielić na
małe, osobno odbierane tickety. Zmiany standardów mają własnych właścicieli.

<!-- docs:section non_goals -->
### Poza zakresem tej zmiany

Nie instalujemy Gitea, nie wdrażamy usługi, nie uruchamiamy obserwatorów,
nie zmieniamy chronionych checków, nie synchronizujemy sekretów ani nie
publikujemy paczek. Nie przebudowujemy Taskand od zera i nie zmieniamy gpt6.
Nie kopiujemy implementacji OneDev, Validatora, Planfile i analizatorów do
nowych organizmów, jeżeli wystarcza sprawdzony adapter.

<!-- docs:section evidence -->
## 3. Co sprawdzono, a co jest propozycją

Inspekcja źródeł 2026-09-14, baza Taskand z metadanych:

| Obszar | Stan w kodzie | Brak przed szerokim użyciem |
| --- | --- | --- |
| Pakiet procesu | `proc.yaml`, `bin.mjs`, hash plików, URI i status | Jawny runner wielojęzyczny, zależności, provenance, format paczki |
| Konformacja pakietów | Wymaga `bin.mjs`, płaskiego katalogu; importy `node:*` i lokalne MJS | Python, podkatalogi, standardowe biblioteki zewnętrzne i ich lock |
| Federacja | Katalog HTTP, porównanie hashy, konflikt URI, pobranie paczki | Podpisana pełna mapa wydania, limity całego pobrania, transakcja aktywacji floty |
| Aktywacja | Polityka `evolution`/`peers` może wybrać auto lub manual | Import nie może domyślnie oznaczać bezpiecznego wykonania; zweryfikować każdą ścieżkę |
| Wersje | Procesy mają `/vN`; evolved wybiera następną lokalnie wolną wersję | Jednoczesna generacja na wielu węzłach, globalna tożsamość, kompatybilność zestawu |
| Builtin | `scan` może przeliczyć hash zmienionego w Git pakietu builtin | URI wersji API nie jest jednoznacznym immutable identyfikatorem artefaktu |
| Ewolucja | codegen, guard, test, porównanie regresji, limit trzech prób | Systemowy budżet, trwały dziennik, niezależny pomiar i kontrola promocji |
| `generated/hw` | Jeden monitor MJS, `proc.yaml` i registry | Brak własnego README, package.json i Dockerfile; odczyt zależy od hosta |
| CI | Lokalny profil Validatora dla glm53 wymaga `onedev/local-verify`; `scheduled_scan=false` | Konfiguracja nie dowodzi wdrożenia, wykonania canary ani automatycznej obsługi kolejki |

`subactor/onedev-agent` opisuje oddzielony od poświadczeń executor i weryfikację
dokładnego wyniku scalenia; `subactor/validator-agent` ma lokalny adapter
`bin/run-local-direct-pr.sh`. To kandydaci do reużycia, nie dowód ich poprawnego
działania dla obecnego wydania Taskand. Nazwa repo to **onedev-agent**.

`autogrammar/todo2code` udostępnia ekstrakcję Git/AST, graph, diagnose i plany.
`autogrammar/data2dsl` opisuje adaptery, normalizację i deterministyczne różnice.
Nie wykonywano w tej sesji ich testów E2E ani nie potwierdzono zgodności API
z Taskand. Część README data2dsl miesza „planned” i „implemented”; capability
probe i aktualny kod/test są ważniejsze niż taki opis.

### Ocena wellmanifest/performance

Standard w rewizji `3573a2…` jest przydatny: profile repo/workstation/runtime,
baseline i candidate, budżety, kontrola fan-out/cache, rollback, brak authority
w planie. Znaleziono i lokalnie poprawiono:

- produkcję GBNF repozytorium: wcześniejszy `identifier` nie dopuszczał `/`;
- akceptowanie NaN w metrykach, progach i limitach przez funkcję walidującą;
- przepełnienie `1e999` w JSON: teraz odmowa wejścia, nie nieskończony budżet;
- zbyt ogólne zalecenia wykluczania `generated`, interpretacji trzech próbek,
  progu 15 s i utożsamiania poprawnego planu z niezależnie sprawdzonym wynikiem;
- brak opisu powtarzalnych pomiarów, kosztu eksperymentów, heterogenicznych
  hostów, canary, histerezy i kontroli ciągłej ewolucji.

Lokalne zmiany są w istniejących zakresach standardu: ticket-002 (kontrakt,
gramatyka) i ticket-003 (walidator, testy), w dwóch osobnych worktrees
`wellmanifest/performance/.worktrees/ticket-002--performance-evolution` oraz
`ticket-003--performance-validation`. Oba gate przechodzą; walidator ma 15/15
testów. Nie jest to jeszcze opublikowany pin ani wdrożona adopcja w Taskand.

Pozostają luki: pełna zgodność schema/runtime/GBNF dla błędnych typów, granice
rozmiaru wejścia, bezpieczny i ograniczony traversal audytora oraz rzeczywista
weryfikacja treści/provenance dowodów. Referencyjny audytor nie jest skanerem
bezpieczeństwa dowolnego niezaufanego checkoutu. Nie uruchamiać masowej adopcji
wykluczeń bez klasyfikacji źródeł. `validate` sprawdza deklaracje, nie testuje
sam inwariantów ani nie pobiera artefaktów z referencji.

<!-- docs:section current_state -->
## 4. Czy architektura jest optymalna?

**Jest dobrą bazą prototypu, ale nie ma dowodów, że jest optymalna lub gotowa
na bezobsługową, rozproszoną ewolucję.** Zachować URI, kontrakty i komplementarną
pętlę; rozdzielić planowanie, wykonanie, magazyn artefaktów, trust i rollout.
Największą luką nie jest wybór MJS zamiast innego języka, lecz brak spójnego
cyklu życia wersji, efektów i dowodów na wszystkich wejściach.

Koszt spawn-per-request, synchroniczne odczyty rejestru, rozmiar katalogów,
liczba hashy i fan-out trzeba profilować. Nie przepisywać całości ani nie
uruchamiać procesu/kontenera/Gitea dla każdego małego organizmu „dla autonomii”.
Wspólny broker lub długowieczny runner jest kandydatem dopiero po pomiarze,
z zachowaniem izolacji, deadline i granicy uprawnień.

<!-- docs:section target_design -->
## 5. Architektura docelowa i decyzje

### 5.1 Repozytorium ≠ pakiet ≠ proces ≠ instancja

Domyślnie pozostawić źródła organizmów w jednym repo lub niewielu repo domenowych.
Każdy reużywalny pakiet ma własną wersję i digest; osobne repo tworzyć dopiero,
gdy ma niezależnego właściciela, publiczny cykl wydania i drugiego konsumenta.
Oddzielne repo dla każdego procesu zwiększyłoby koszt CI, review i synchronizacji.

| Tożsamość | Reguła projektu |
| --- | --- |
| Proces URI | adresuje operację i wersję kontraktu, nie zmienny katalog Git |
| Pakiet | stabilny identyfikator właściciela + wersja + immutable digest |
| Artefakt | digest rzeczywistych bajtów; build dla konkretnej platformy |
| Źródło | repo + commit + ścieżka; commit nie jest podpisanym wydaniem |
| Release | immutable manifest wszystkich zgodnych paczek, schematów i polityk |
| Instancja | własna tożsamość węzła, nie sklonowany klucz z obrazu |
| Twin | odrębny model z wersją, pochodzeniem, wiernością i zakresem danych |
| Zadanie/zdarzenie | trwałe ID/URN i referencje do exact wersji użytych w wykonaniu |

URN jest formą URI służącą identyfikacji; adres transportowy może się zmieniać.
Nie wyprowadzać authority z posiadania URN ani URL. Nazwy i schematy nowych
rekordów trzeba najpierw zarejestrować u właściciela kontraktu. Nie mieszamy
API major `/v1`, semver paczki, rewizji modelu i digestu pliku.

### 5.2 Manifest i pakowanie wielojęzyczne

Jeden kanoniczny manifest pakietu powinien deklarować ID, wersję, procesy URI,
wejścia/wyjścia, błędy/stany/typy/zmienne, runner/entrypoint, platformy, zasoby,
uprawnienia, zależności, testy, licencję, provenance i wymagania migracji.
Rejestry szczegółowe referencjonować, nie kopiować sprzecznych list do README.
Z manifestu generować zgodne projekcje:

- **MJS/JS:** `package.json` z wersją, exports/bin, engines i jawną listą plików;
  rzeczywisty tarball i test instalacji w niezależnym konsumencie. Import
  biblioteki nie może od razu czytać stdin ani wykonywać telemetrii.
- **Python:** `pyproject.toml`, build backend, metadane i entrypoints; wheel/sdist,
  test w czystym środowisku, bez zależności od ścieżki checkoutu Taskand.
- **Inne języki:** ich właściwy format, nie obowiązkowy `package.json` wszędzie.
- **Każdy reużywalny pakiet:** README opisujący kontrakt, uruchomienie, efekty,
  ograniczenia, błędy, przykład wejścia/wyjścia i wersjonowanie.
- **Docker:** opcjonalny, generowany Dockerfile lub referencja do przypiętego
  wspólnego runner image. Wymagany, gdy wybrany profil dostawy korzysta z OCI,
  nie dla każdej biblioteki. Dockerfile nie jest sam gotową paczką ani VM.

Językowe projekcje odpowiadają istniejącym formatom
[npm](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) i
[PyPA](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/).
Źródłowy manifest jest propozycją Taskand; nie jest implementowany tym dokumentem.

Dla `generated/hw` oddzielić bibliotekę pomiaru, adapter CLI i adapter URI.
Deklarować `sensors`, `df`, `/sys`, dostęp do GPIO oraz znaczenie pomiaru
host/container. Nie dodawać `--privileged` ani całego hostowego `/` jako skrótu.
Brak czujnika oznacza UNKNOWN/null. Czysty fixture do testów, jawne read-only
mounty dla pilota. AMD64 i ARM64 wymagają właściwych artefaktów; emulacja nie
potwierdza realnych czujników ani natywnej wydajności.
[Docker opisuje odrębne warianty platform i strategie budowania](https://docs.docker.com/build/building/multi-platform/).

Zmiana pakowania wymaga najpierw nowego kontraktu registry i zgodnego checkera:
obecny płaski MJS checker nie zaakceptuje poprawnego projektu Python.
Dodanie README/Dockerfile zmienia obecny hash paczki; nie podmieniać bez śladu
istniejącej immutable wersji. Biblioteki mogą być zależnościami pakietu, a
operacje z efektami nadal przechodzą przez URI i broker uprawnień.

### 5.3 Gitea i offline

Gitea jako opcjonalny serwis węzła-huba: mirror Git + magazyn paczek.
Mały węzeł potrzebuje przede wszystkim cache artefaktów, registry metadata,
outbox zdarzeń i updatera. Pełny forge na każdym urządzeniu jest opcją profilu,
nie zależnością podstawowego Taskand. Nie wkładać go do tego samego procesu ani
obrazu co gateway; osobne dane, aktualizacja, backup i uprawnienia.

[Gitea mirror](https://docs.gitea.com/usage/repository/repo-mirror/) przenosi
gałęzie, tagi i commity; nie zastępuje synchronizacji ticketów, grants i zdarzeń.
Dokumentacja ostrzega, że push mirror może force-pushować i nadpisywać cel:
**nie używać go do publikacji do chronionego upstream**. Upstream jako pull
mirror, lokalna ewolucja w osobnym namespace/repo; powrót przez normalny PR.
[Registry Gitea](https://docs.gitea.com/usage/packages/overview/) obsługuje różne
formaty paczek; to magazyn bajtów, nie Taskand authority ani resolver semantyki.

Offline catch-up pobiera wybraną zgodną wersję i pełny graf zależności przez
dostępny zatwierdzony transport, z wznowieniem i limitem dysku/pasma. Może
pominąć pośrednie wersje kodu, ale nie wymagane migracje danych i etapy rotacji
zaufania. Sam Git mirror nie zapewnia wheels, obrazów OCI, zależności, LFS,
submodules i artefaktów release — trzeba je zinwentaryzować i zachować osobno.

### 5.4 Ciągła aktualizacja bez porzucania zadań

Proponowany przepływ, nie istniejący dzisiaj kontroler:

```text
chroniony merge → build i niezależna walidacja → podpisany manifest wydania
                                                       ↓
upstream / opcjonalny hub Gitea → cache węzła → verify → stage → twin/canary
                                                                  ↓
                       receipt ← observe ← atomowy switch ← drain/checkpoint
                                      ↘ rollback lub izolacja awarii
```

1. **Discover:** odczytaj kanał wydania, nie `git pull` na aktywnym katalogu.
   Kanał jest wskaźnikiem; zapinamy konkretny manifest i digesty całego zestawu.
2. **Verify:** zaufany podpis, integralność, daty, kompatybilność, odwołania
   kluczy, zasoby i stan węzła. Hash przesłany razem z kodem nie dowodzi autora.
3. **Stage:** pobierz do oddzielnego katalogu/cache, nigdy na działający kod.
   Lock i journal obejmują plan aktualizacji; częściowy transfer nie aktywuje się.
4. **Validate:** test kontraktów, fixture twin, migracja kopii danych, canary
   z ograniczonym dostępem. Oddziel dowód poprawności kodu od readiness hosta.
5. **Drain/checkpoint:** nowe zadania trafiają do gotowej generacji; stare
   kończą na przypiętym zestawie albo zatrzymują się na bezpiecznej granicy.
   Otwarte zewnętrzne efekty rozliczyć przez idempotency key i receipt.
6. **Switch:** atomowo zmień wskaźnik aktywnego zestawu, z CAS i fencing;
   wydziel mały supervisor/updater, który nie znika wraz z aktualizowanym workerem.
7. **Observe:** health, prawdziwy autoryzowany scenariusz, SLO i budżet błędów.
   Dopiero potem kolejny węzeł/cohort. Dla pojedynczego węzła możliwe okno
   niedostępności; nie obiecywać zero-downtime bez zasobów i zgodności danych.
8. **Recover:** przywróć dozwolony poprzedni zestaw i zgodny stan danych albo
   ogranicz uszkodzoną zdolność. Irrewersyjna migracja wyklucza prosty rollback.

Po długim offline weryfikować metadane anty-rollback/anty-freeze i ciąg rotacji
zaufania; przeterminowany grant nie wraca do życia wraz z siecią. Projekt
powinien reużyć sprawdzoną implementację, np. mechanizmy opisane w
[TUF](https://theupdateframework.github.io/specification/latest/), nie własny
protokół „podpis + latest”. Odrzucona aktualizacja nie oznacza automatycznego
wyłączenia działającej wersji: jej dalsza praca zależy od osobnej polityki
bezpieczeństwa i ważności uprawnień. Rollback operacyjny także wymaga jawnej
polityki; nie wyłącza zabezpieczeń przed odtworzeniem starego złośliwego wydania.

Updater nie zmienia sam swoich trust roots, required checks lub limitów zgody.
Ewolucja może zaproponować następne wydanie i PR, ale nie zatwierdzić własnego
review. Rozmnażanie tworzy nową tożsamość i parowanie, nie kopiuje klucza węzła.
W offline dopuszczalne są tylko wcześniej autoryzowane, nadal ważne zdolności.

### 5.5 Taskand jako warstwa operacyjna istniejącego projektu

Najprostszy model: instalacja jednego node runtime poza checkoutem + jawne
przypięcie repo i jego profilu. Tryby kolejno: observe, propose, sandbox,
authorized-execute. CLI/web pokazują ten sam stan i ten sam kontrakt zadania.
Instalacja nie uruchamia automatycznie skryptów/hooków obcego repo.

Przy onboard najpierw read-only inventory: primary/linked worktrees, lokalne i
odczytane remote refs, ancestry, dirty/staged/untracked, PR/checki, tickety,
leases, uruchomione procesy i deploymenty z mountami. Osobno pozyskać zgodę na
konkretne repo/efekty. Nie instalować nad repo nowego szablonu `project.sh`.
Nieznany runtime/gate → plan ograniczonej adopcji, nie fikcyjna zgodność.

Następnie uzgodnić mapę intent ↔ diff ↔ branch ↔ worktree ↔ PR; wskazać
unikalne commity i nakładające się zakresy. Najpierw pomóc zakończyć gotowy PR,
jeżeli to usuwa zależność. Bez konfliktu treści nie ogłaszać merge-conflict;
oddzielić blokadę authority, CI, checkoutu i transportu. Małe disjoint zmiany
mogą iść równolegle, integracja chronionego celu pozostaje serializowana.

Każda diagnoza daje kod, dowód, owner, najkrótszą bezpieczną remediację,
prerequisites, rollback i kryterium zamknięcia. Unknown work zachować; nie
resetować, force-pushować, usuwać branchu czy worktree po samej nazwie „legacy”.
Po zweryfikowanej integracji osobno zwolnić lease i kwalifikować dokładny
checkout do odzyskiwalnego sprzątania. Nie mnożyć ticketów na ten sam finding.

### 5.6 CI/CD bez zależności wykonania od GitHub Actions

Reużyć OneDev jako executor/scheduler oraz niezależny Validator jako granicę
review/publikacji. Taskand planuje, deleguje przez zwalidowane adaptery i
pokazuje stan; nie zastępuje ich fikcyjnymi zielonymi checkami.

Minimalny pilot:

1. Jawny profil repo: stack, pinned build environment, zestaw testów, zakres
   uprawnień i źródło required checks; brak profilu to etap onboarding.
2. Webhook albo bounded polling poza GitHub Actions; deduplikacja repo/head/base.
3. Credential-free executor testuje exact merge result w izolacji, z limitami
   sieci i zasobów. Kod z PR nie czyta tokenów kontrolera ani Docker socket hosta.
4. Niezależny chroniony kontroler publikuje rzeczywisty wynik i provenance;
   Validator weryfikuje head/base, policy/intent i wymagane testy.
5. Chroniony merge i receipt, następnie osobno build/release/deployment.
   Zmiana base/head unieważnia zależny wynik i uruchamia nowy ograniczony test.

Nie zakładać, że self-hosted Actions rozwiąże każdą blokadę konta: nadal
zależy od control plane Actions. Aktualna dokumentacja mówi o bezpłatnych
self-hosted runnerach i warunkach blokady wykorzystania przy wyczerpaniu limitu;
warunki billing sprawdzać w chwili działania, nie kodować historycznej ceny.
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Zewnętrzny OneDev eliminuje zależność wykonania testów od Actions, nie koszty
własnego sprzętu, GitHub API, uprawnienia, sieć ani niezależne review.

Zmiana required checks tylko przez właściciela chronionej polityki po canary
potwierdzającym równoważne pokrycie, w tym platformy. Billing nie jest podstawą
do pominięcia testów. Tryb całkowicie offline może wytworzyć lokalne dowody,
ale nie twierdzi, że GitHub zatwierdził lub scalił niewysłany PR.

### 5.7 Intencja z historii i priorytety

Pipeline: Git/AST/testy/tickety → obserwacje z SHA → data2dsl porównuje zgodne
fakty → todo2code wiąże hipotezy intencji → test/dowód → propozycja naprawy.
Najpierw probe aktualnego API każdego narzędzia, pin i fixture; nazwa narzędzia
nie oznacza istniejącego procesu Taskand. Adaptery zarejestrować z ograniczonym
wejściem/wyjściem, bez kopiowania całego sąsiedniego projektu.

Historia Git to dowód ewolucji, nie upoważnienie i nie jedyne źródło intencji.
Revert może być zamierzony. Commit message może kłamać lub zawierać instrukcję
prompt injection. Aktualne polecenie, kontrakt i zaakceptowane kryteria mają
pierwszeństwo; hipotezę LLM oznaczyć jako advisory i testować. Analiza używa
merge-base, zmian semantycznych i wpływu na zależności, nie tylko liczby linii.
Indeksować przyrostowo po digestach, zachowując pochodzenie i retencję danych.

Pojedynczy finding: stabilny kod, subject/version, evidence, fingerprint,
first/lastSeen, occurrence count, confidence i dotknięte kryterium. Powtórzenie
aktualizuje istniejącą sprawę; błąd formatu trafia do kwarantanny parsera z
jawną luką, nie do automatycznej naprawy na podstawie dowolnego tekstu logu.

**Polityka pracy użytkownika: URGENT → BUGFIX → FEATURE → SERVICE.**
Nie wprowadzać czterech nowych niespójnych enumów do starego intentu:

- obecny `new-project.work-classification/v1` zna `BUG`, `FEATURE`, `SERVICE`
  oraz priorytet `P0…P3`; BUGFIX mapuje na BUG;
- URGENT to tryb incydentu/severity + preemption, zwykle potwierdzony BUG/P0,
  nie rodzaj kodu i nie bezwarunkowe polecenie shutdown;
- `wellmanifest/priority` już ma warstwy lexicographic, sygnały, starzenie,
  starvation i digest-bound ranking bez execution authority;
- potrzebny profil SDLC i jawna projekcja klasyfikacji/priorytetu do Taskand,
  Planfile, CLI/web. Dzisiejsza kolejność kind-before-priority nie modeluje
  samodzielnie awaryjnego przerwania zadań ani rezerwacji utrzymania.

Zachować zwykłą kolejność w ramach gotowych zadań, lecz rezerwować mierzoną
pojemność/cadence na preventive SERVICE i BUGFIX, z maksymalnym wiekiem kolejki.
Nie deklarować, że samo zwiększenie wagi SERVICE pokona stałą wyższą warstwę.
Zależności mogą wymagać przygotowawczego SERVICE przed FEATURE; rejestr decyzji
ma wyjaśnić wybór i wpływ na opóźnione prace. Wagi i rezerwy są wartościami
projektu, nie uniwersalnymi procentami narzuconymi przez standard.

URGENT: potwierdzić ryzyko, ograniczyć efekty, odizolować dotkniętą zdolność
lub wycofać grant, zachować dowody, uruchomić ograniczoną ścieżkę naprawy.
Wyłączenie usługi/hosta/floty jest osobną decyzją opartą o zasięg szkody,
bezpieczeństwo i uprawnienie; może być właściwe, ale nie zawsze. Po incydencie
reproducer, analiza przyczyny i profilaktyczny SERVICE ograniczają nawroty.

<!-- docs:section migration -->
## 6. Wdrożenie etapami

Każdy etap: własny ograniczony intent, istniejący matching ticket jeśli jest,
test w odizolowanym twin/fixture, dowód i dopiero uprawnione efekty. Nie tworzyć
z góry dziewięciu worktrees ani blokować niezależnej dokumentacji i analizy
repo-wide rezerwacją writera, gdy polityka dopuszcza disjoint zakresy.

| Etap | Kroki | Warunek wejścia i odbiór |
| --- | --- | --- |
| **E-01: obserwowalny baseline** | Odczytać F/V; zapisać source/runtime/config digests; wdrożyć profile performance w audit mode; mierzyć koszt diagnozy, registry i wykonania zadania. | Lokalny F-01–F-04 odebrany. Porównywalne, powtarzalne pomiary; żadnego fikcyjnego p99 z trzech prób. V-01–V-17, V-54. |
| **E-02: pakiet i release manifest** | Zaprojektować zamknięte schema/GBNF; rozdzielić API/paczkę/artefakt; dodać runner MJS i Python, metadane/README, dependency closure i lock; pilot hw + mała funkcja Python. | F-05. Dwa niezależne konsumery, czysta instalacja, negatywne testy registry; żadnych zmian starego digestu. V-18–V-20, V-46, V-51. |
| **E-03: updater jednego węzła** | Stage/journal/lock; test migracji i drain/checkpoint; atomowy switch; observe/rollback; fault injection przy każdym kroku. | E-01/E-02 i F-06. Brak zgubionych/podwójnych efektów po crashu, stary zestaw odtwarzalny, klucze niezależne. V-21–V-23, V-46–V-48, V-55. |
| **E-04: offline i opcjonalny hub** | Porównać lekki cache z Gitea; read-only mirror, cache wszystkich artefaktów, podpisane metadane; test długiego offline, rotacji kluczy i konfliktu lokalnej ewolucji. | E-02/E-03. Test bez sieci i przerwanego transferu; upstream nietknięty; niedostępność huba nie odbiera lokalnej zaakceptowanej zdolności. V-47–V-50. |
| **E-05: rollout dwóch węzłów** | Sparować nvidia/RPi; osobne tożsamości, architektury i cohorts; limit aktualizacji, jitter/backpressure, reconciler desired/observed. | F-08 + E-03/E-04. Jeden węzeł błędny/offline nie aktualizuje pozostałych w nieskończonej pętli; receipts per node. V-29–V-32, V-56. |
| **E-06: pilot obcego repo i CI** | Observe-only inventory; wybrać jeden istniejący mały ticket/PR; dry-run uzgodnienia; adapter OneDev; exact merge result; Validator; chroniona dostawa i oddzielny deploy. | F-10, E-02, jawny profil i authority. Repo z dirty worktree i zaległym PR zachowuje każdą unikalną zmianę; billing nie usuwa bramek. V-02–V-06, V-38–V-39, V-52–V-53. |
| **E-07: intencja historyczna** | Probe/pin data2dsl i todo2code; fixture zmiany zamierzonej i regresji; przyrostowy graf; wyjaśnialny finding i deduplikowane zadanie. | E-06 i F-05. Test rozróżnia zamierzony revert od regresji; treść Git nie steruje agentem; brak danych ≠ zero. V-42–V-44. |
| **E-08: profil priorytetów SDLC** | Uzgodnić mapę BUGFIX/URGENT, zależności, starvation, rezerwę SERVICE i containment; wygenerować projekcje DSL/rankingu dla CLI/web; testy kolejki i czasu. | F-10/E-06; właściciele priority/new-project. Pilny incydent nie czeka za zwykłą pracą, SERVICE ma ograniczony czas oczekiwania, przerwanie nie uszkadza efektu. V-40–V-41. |
| **E-09: kontrolowany eksperyment ewolucji** | Jeden hotspot, baseline/candidate, twin, quality gate, niezależne review, release i ograniczony rollout; porównać wynik wdrożenia; cooldown/rollback/next ticket. | E-01–E-03, E-06–E-08; flota tylko po E-05. Poprawa praktycznie istotna bez regresji i samoprzyznania praw; skończony koszt eksperymentu. V-44–V-56 adekwatnie do zakresu. |

Nie traktować poprawki starego testu lub nowego README jako zakończenia E-01.
Zaakceptować dane obserwacyjne, nie „nie znaleziono błędu”.

<!-- docs:section acceptance -->
## 7. Kryteria sukcesu i metryki

- Mniej czasu od zgłoszenia do bezpiecznej naprawy i mniej nawrotów na ten sam
  fingerprint, bez obniżenia pokrycia testów i ochrony danych.
- Wydajność: ukończone poprawnie zadania/czas, latency wraz z queue time,
  error/timeout rate, CPU/RAM/I/O, rozmiar cache i koszt na ukończone zadanie.
- Dystrybucja: wiek nieopublikowanej zmiany, lead time do PR/merge/deploy,
  liczba aktywnych writerów, wiek blokady i skuteczność remediacji.
- Flota: desired/observed digest, czas offline i catch-up, liczba niezgodnych
  węzłów, czas odtworzenia i liczba powielonych efektów (wymagane zero w testach).
- UI pokazuje źródło/czas/przedział metryk i UNKNOWN. Radar nie zastępuje
  bezwzględnych SLO ani nie ukrywa krytycznej porażki średnią oceną.

Budżety ustalić z pomiarów i ryzyka. Nie narzucać jednego timeoutu, liczby
kontenerów ani prób na wszystkie języki, urządzenia i projekty.

<!-- docs:section validation -->
## 8. Minimalna macierz testów

1. **Kontrakty:** round-trip schema/DSL, nieznane pola i typy, NaN/overflow,
   brak URN, konflikt tej samej wersji, cykl zależności, niezgodny runner/ABI.
2. **Pakiety:** build i instalacja MJS/Python bez checkoutu rodzica; README i
   manifest zgodne; SBOM/provenance/digest; brak sekretów w paczce i obrazie.
3. **Update:** crash przed/po stage, podczas migracji, drain i switch; pełny dysk,
   zerwana sieć, brak zależności, stary podpis, odwołany klucz, clock skew,
   rollback wersji kodu przy nowym formacie danych, równoczesny updater.
4. **Offline/flota:** przestarzały węzeł, split-brain, konflikt lokalnego fork,
   kilka jednoczesnych reconnect, utrata huba, upgrade ARM64/AMD64, różne polityki.
5. **Obce repo:** brak standardu, zły remote, wiele worktrees, unique dirty data,
   PR z nowym head/base, brak billing, brak profilu CI, złośliwy hook/commit text.
6. **Uczenie:** zamierzona zmiana API, regresja wydajności i poprawności,
   fałszywy alarm, powrót znalezionego błędu, niedostępny dowód, nieznany format.
7. **Priorytety:** pilne zdarzenie w trakcie efektu, stale readings, dużo
   FEATURE, starzejący SERVICE, DAG/cykl, freeze PR, brak zgody na shutdown.

Weryfikować najpierw offline fixture/twin, potem ograniczony pilot i dopiero
rollout. Wyniki referencyjnego checkera, CI, niezależnego review i produkcji
raportować oddzielnie. Nie twierdzić „dowolny projekt wspierany”, gdy brak
profilu platformy lub zezwolenia na konkretny efekt.

<!-- docs:section risks -->
## 9. Ryzyka

Samopotwierdzające benchmarki, prompt injection w historii/logach, zatrucie
registry, dependency confusion, ukryte nowe grants, schema drift, duplicate
effects, retencja prywatnych danych i nadmierne koszty obserwacji. Standard
ma dawać ograniczoną remediację i niezależną ścieżkę pracy, nie generować
jednego globalnego BLOCKED dla każdej luki. Brak dowodu nadal nie jest zgodą.

<!-- docs:section rollback -->
## 10. Odzyskanie i zakończenie etapu

Utrzymywać przypięty działający zestaw, plan odtworzenia stanu i sprawdzony
snapshot. Cofanie kodu oddzielić od migracji danych i wycofania uprawnień.
Nie usuwać lokalnego forka, cudzej pracy ani historycznego artefaktu w ramach
automatycznego „sync”. Każda awaria ma lokalny stan końcowy, ograniczony retry
i widocznego właściciela; inne niepowiązane zdolności mogą pracować dalej.

<!-- docs:section ownership -->
## 11. Właściciele i zmiany w standardach

| Właściciel | Bounded follow-up |
| --- | --- |
| `wellmanifest/performance` | Opublikować i przyjąć poprawki kontraktu/runtime; domknąć parity, bezpieczny audyt i weryfikację dowodów. Nie HOME runtime Taskand. |
| `wellmanifest/priority` | Profil SDLC, jawne mapowanie URGENT/BUGFIX, starvation/preemption/cadence utrzymania; ranking pozostaje propose-only. |
| `wellmanifest/new-project` | Spójna projekcja profilu i klasyfikacji, scoped receipts, zgodność compact intent z continuity; żadnej ręcznej edycji adopcji. |
| `wellmanifest/git-lifecycle`, `ticket-lifecycle`, `worktrees` | Inventory i reconciliation przed nowym writerem; mapa własności, osobne rezerwacje disjoint zakresów, zachowanie unknown work i exact cleanup. |
| `wellmanifest/dsl` i istniejący właściciel kontraktu registry | Zarejestrować wersjonowane schematy release/package/observation, request-only grammar i reguły kompatybilności; najpierw sprawdzić rejestr, nie wymyślać repo o niezweryfikowanej nazwie. |
| `subactor/onedev-agent`, `validator-agent` | Adaptery i chronione profile exact-head/base, niezależność credentials/executor, rzeczywiste receipts i canary. |
| `autogrammar/data2dsl`, `todo2code` | Factual adapters i hipotezy intencji z provenance, probe kompatybilności, testy celowej zmiany i regresji. |
| Taskand-glm53 | Integracja runtime, UI/CLI, registry runners, updater, offline cache, twin i scheduler; osobne małe tickety etapów E. |

Najbliższy krok po odbiorze F: **E-01 oraz projekt kontraktu E-02**, nie
instalacja pełnego Gitea na każdym urządzeniu i nie masowy podział repozytoriów.
