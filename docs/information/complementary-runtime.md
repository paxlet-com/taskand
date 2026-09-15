---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "complementary-runtime",
  "kind": "information",
  "version": 8,
  "title": "Kontekst, profile użytkowników i obserwowalność taskand",
  "status": "draft",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-13",
  "updated": "2026-09-13",
  "review_after": "2026-09-20",
  "source_revision": "3e195de57d77426021e537dcd3243d41899529ad",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": ["gateway/context.py", "gateway/__init__.py", "index.html", "generated/planner/plan/taskand.dev/v1/bin.mjs", "tests/context_test.py", "project/lease-controller.py"]
}
---

# Kontekst komplementarny taskand

<!-- docs:section purpose -->
## Cel i granica wdrożenia

Aktualizacja v8: użytkownik jawnie zatwierdził **jednorazowy snapshot ratunkowy
na gałęzi roboczej i draft PR mimo niezaliczonego governance**. Snapshot obejmuje
129 dotychczasowych ścieżek pending oraz opis tego wyjątku; nie dodaje kolejnych
funkcji. Nie jest zgodą na merge, wydanie, wdrożenie ani usunięcie danych.
Gałąź dostawy to `ticket/001-complementary-runtime`; dokładny commit i wynik push
potwierdza GitHub, nie sam ten dokument. Budżety, zabezpieczenia `main` i
konfiguracja hooków pozostają niezmienione. Zwykła odmowa admission pozostaje
odmową także wtedy, gdy zatwierdzony snapshot jest zapisany transakcją Git.
Pełny kod aplikacji jest zgodny z wcześniej testowaną kopią v7. Warianty indeksu
i plików obu checkoutów zachowuje zweryfikowane prywatne archiwum
`receipt:sha256:25af843ab82f0b3cdec52542f801f069650f480e3cf51d88eafa5034ca77c447`.
Archiwum nie jest publikowanym backupem sekretów ani dowodem chronionego merge.
Projekt nadzorcy w ticket-002 pozostaje w BACKLOG. Historyczne obserwacje v7
poniżej opisują stan sprzed publikacji ratunkowej.
Bieżący status portu 8090, federacji i pilotażu wszystkich
trzech obserwatorów opisuje [sieć instancji](instance-network.md). Poniższe
wyniki pozostają dowodami lokalnego worktree, nie wdrożenia. Pilot normalizuje
syntetyczne zdarzenia; nie uruchamia kolektorów prawdziwych sesji.

Ticket: [ticket-001](../../project/ticket-001/README.md). Metadane wskazują bazę
snapshotu, nie zatwierdzone wydanie. Chroniony merge pozostaje zablokowany.
Model użytkownika jest
jawnym syntetycznym profilem testowym, nie kopią tożsamości, osobowości ani praw
człowieka. Realne modele sieci i WWW pozostają oddzielnymi procesami opisanymi
w [raporcie digital-twin](../analysis/digital-twin.md).

<!-- docs:section content -->
## Pozostałe blokady i granica wyjątku — v8

Zwykły publikator Goal nadal odrzuca zakres: dziewięć findingów obejmuje historię
sprzed intentu, budżet, scope/ownership, adopcję i dwa alarmy skanera sekretów.
Sprawdzono, że alarmy dotyczą wyrażeń `os.environ.get`, `api_key_header` oraz
`process.env.TASKAND_CREDENTIAL`, nie zapisanych poświadczeń. Nie wyłączono
skanera ani nie nadano fałszywego wyniku PASS. Log próby ma digest
`45fdf38a8095340eec726bfe04d1cb6bf626302f92690fc13c58c51a91d29828`.
Publikacja ratunkowa nie rozwiązuje tych findingów ani podwójnego dirty checkoutu.
Primary pozostaje nietknięty ze względu na zachowanie wariantów i mounty runtime.

Wydanie [new-project v0.20.27](https://github.com/wellmanifest/new-project/releases/tag/v0.20.27)
jest już dostępne pod `6d83b42f79058f95e265df47092dcfc2c5f3b56a`.
Snapshot zachowuje dotychczasową adopcję; upgrade nie jest dokładany do ratunkowego
pushu. Następne kroki to zgodna adopcja, uzgodnienie historycznego zakresu oraz
profil i canary OneDev ([zgłoszenie #304](https://github.com/subactor/onedev-agent/issues/304)).
Dopiero później możliwe są niezależna walidacja exact-head, chroniony merge
i osobne wydanie. `VERSION=3.0.0-dev` nie oznacza paczki opublikowanej w registry.

## Rejestracja istniejącej dostawy i ponowione testy — v7

Jedna istniejąca dostawa ma następujące powiązania:

| Tożsamość | Obserwowany obiekt |
| --- | --- |
| Intent | `project/ticket-001/intent.json` |
| Worktree / lokalny branch | `.worktrees/ticket-001--complementary-runtime` / `ticket/001-complementary-runtime` |
| Zgłoszenie GitHub | [taskand-glm53 #2](https://github.com/semcod/taskand-glm53/issues/2) |
| Planfile | `semcod/taskand-glm53:PLF-001`, stan `blocked` |
| Publikacja | [draft PR #1](https://github.com/semcod/taskand-glm53/pull/1), branch `refactor/phase-a` |

Pilot Planfile używa jawnego katalogu projektu
`.subactor/recovery/planfile`, SDK 0.1.125 przypiętego do
`b9b1603f12799b30bb3400c3090edc904f6d1735` i stabilnego klucza
`github:semcod/taskand-glm53:issue:2`. Ponowne wykonanie intake rozwiązuje ten
sam rekord. Nie zmieniono śledzonego `planfile.yaml` używanego do analizy kodu.
To lokalna projekcja z jednorazowym powiązaniem GitHub, **nie automatyczna
synchronizacja, obowiązkowa zależność wszystkich projektów ani authority**.
Nie utworzono nowego worktree. Issue pozostaje otwarte do rozliczenia dostawy.

Stan źródeł: primary ma 102 ścieżki staged, istniejący worktree 129 ścieżek
pending, częściowo wspólnych. Nie sumujemy ich jako 231 unikalnych plików.
Kopiowanie wyłącznie `git ls-files --cached` pomija siedem plików nieśledzonych,
w tym handlery mesh/observers i publiczne metadane vault; taki niepełny pakiet
nie nadaje się do oceny całości. Druga kopia uwzględnia te pliki, wyklucza
`.env` i prywatny `/vault/`, a jej manifest zawartości ma SHA-256
`51bd5d75f65d3f02c0644153ada5dda7f5cbd6667212ce262c07985ad1aee586`.

Ponowiona walidacja tej kopii: konformacja **4/4**, kontrakty **30/30**,
negatywne **17/17**, digital-twin **8/8**. Każdy zestaw miał osobny kontener,
`network=none`, brak mountów hosta i sekretów, read-only root oraz limit czasu.
Obraz: `sha256:1c97759e999daec41599d98911fb834a5d88dbdc67ba8fb78626111e0b7cfce6`.
Wynik zbiorczy: `receipt:sha256:b8004dcd4a662c8a1d9a0c6c973f02061b1e8241013c87cb4ed91cc2fcc79503`.
WWW: **8/8** na tej samej kopii, Node 20.19.5 i Chrome 153.0.8010.36,
z izolacją Chromium przez `bwrap` i wyłącznie lokalnymi serwerami-fixtures.
Log WWW: `receipt:sha256:d03701eb43c0312285023aaa204320e59159efda98cd1a96da3d1c116a7d4148`.
Surowe dowody są w prywatnym audycie `taskand-intake-checks-20260913.uyzT7a`.
Nie jest to pełny test produkcji, zdalnej federacji, LLM ani profilu OneDev.

[New-project PR #332](https://github.com/wellmanifest/new-project/pull/332)
scalił poprawkę odziedziczonej historii do
`51ea009bcbff13607b4c2778abcd1bae9a15f0ca`; Linux i Windows CI przeszły.
Generator adopcji odrzuca ten SHA jako wydanie v0.20.26, ponieważ istniejący
tag wskazuje inną rewizję. Potrzebne jest następne niezmienne wydanie związane
z materialną zmianą standardu, nie ręczna podmiana plików zarządzanych.
Integracja rejestracji jest osobną pracą
[new-project #330](https://github.com/wellmanifest/new-project/issues/330);
obserwacja ticket-220 nie dowodzi jej zakończenia lub wdrożenia.

Ponowiony preflight chronionego publikatora zwrócił `LOCAL_EXECUTOR_MISSING`
i `REQUEST_EXECUTOR_PROFILE_AND_CANARY`. Konfiguracja OneDev ma digest
`c896fe54579a013db99c6ada9a3d1febaef7e5f10918446f38f177ac3de7e5d4`;
obecny profil Validatora nadal wymaga `onedev/local-verify`. Zachowujemy
bramki, wszystkie warstwy Git oraz oba checkouty. Nie zrestartowano 8090,
nie zmieniono obserwatorów ani konfiguracji CI. Starsze obserwacje v6 poniżej
są historią i nie nadpisują tego statusu.

## Projekt operacyjnego nadzorcy — ticket-002

[Ticket-002](../../project/ticket-002/README.md) jest propozycją kolejnego,
ograniczonego etapu, zależnego od rozliczenia dostawy ticket-001. Nie rozpoczęto
jego implementacji ani wdrożenia. Runtime pozostaje w `semcod/taskand-glm53`;
`wellmanifest/taskand` jest HOME kontraktu, nie usługą nadzorczą.

```text
Git / CI / lease / rejestr incydentów
                ↓ odczyt + okresowa resynchronizacja
zamknięta obserwacja → evaluator przypiętego standardu
                ↓
raport: freshness + dowody + reguła + brakująca decyzja
                ↓
shell / web: propozycja, bez uprawnień do wykonania
                ↓ dopiero w osobno zakwalifikowanym etapie
twin → bounded repair → bramki exact-head → chroniony kontroler → receipt
```

Pierwszy etap obserwuje wszystkie zarejestrowane checkouty wybranego repo,
pełny zakres od zaakceptowanej bazy, warstwy indeksu i plików, rezerwacje,
zdalne SHA i PR. Odczyt nie wykonuje fetch/prune, hooków ani kodu znalezionego
w obcym repo. Nie rozwiązuje konfliktu przez wybór całego `ours/theirs`.
Wspólna historia jest kontekstem; konkurencję potwierdzają różne delty,
własność zakresu i bieżące procesy, nie sama liczba drzew lub agentów.

Warstwa incydentów normalizuje tekst, JSON, exit status i wyniki CI. Zachowuje
bezpieczną referencję oryginału, wersję parsera, kod błędu, czas i niepewność.
Tekst logu jest niezaufany: nie zmienia polityki, poleceń ani uprawnień.
Nieznany format lub niedostępny store dają UNKNOWN, nie automatyczną naprawę.
URI/URN obserwacji, incydentu, decyzji i twin-replay muszą mieć istniejące,
kontrolowane resolvery oraz wersję/digest. Ich przyszłe procesy nie są jeszcze
zarejestrowane — nie należy wywoływać wymyślonych adresów z tej propozycji.

Nadzorca używa istniejących ticketów i lease projektu docelowego. Incydent
wiąże repo, zaakceptowany cel, zakres i stabilną przyczynę; przechowuje licznik
prób, brak postępu i wspólny deadline niezależnie od sesji lub potomka.
Awaria nie otwiera automatycznie nowego ticketa/worktree. W panelu pokazuje
jedną eskalację na brakującą decyzję, np. „potrzebny właściciel tych ścieżek”
lub „executor wyłączony”, zamiast ponawiać ogólne pytanie o push.

| Scenariusz pilota w bliźniaku | Oczekiwany wynik |
| --- | --- |
| Push wykonał się, odpowiedź zaginęła | RECONCILE_EFFECT i odczyt zdalnego SHA; bez drugiego efektu. |
| Ten sam błąd po kolejnych promptach/restartach | Wspólny licznik, HALT_AFFECTED_SCOPE po limicie. |
| Brak działającego CI lub właściciela | Jawna blokada; brak generowania kolejnej funkcji w tym zakresie. |
| Main/HEAD zmienia się po teście | Unieważnienie zależnych dowodów i ponowna walidacja. |
| Zmiana daje nową regresję | Zatrzymanie promocji kandydata, bez usuwania zmian. |
| Utracony event / opóźniona obserwacja | UNKNOWN, pełny odczyt, widoczny wiek danych. |
| Niezależny projekt bez przecięcia scope | Może kontynuować w granicach własnej zgody i WIP. |

Plan ma trzy osobno kwalifikowane etapy: (1) read-only raport/replay w shell,
(2) projekcja live w istniejącym web z pomiarem świeżości i deduplikacją,
(3) pilot jednej klasy napraw z idempotency/CAS/fencing, twin i kontrolerem.
Ticket-002 obejmuje **wyłącznie etap 1**. Integracja web i efekty nie wchodzą
tylnymi drzwiami do obecnego zakresu. Budżety pilota ustala się w intent przed
implementacją; nie przenosi się tu zaległych zmian ticket-001.

Podstawa to lokalny draft `wellmanifest/taskand` TKD-013–014, schema
`urn:taskand:schema:delivery-observation:v1` i `operations/delivery.py`.
Referencja ma 46 testów, w tym 12 nowych przypadków recovery; nie implementuje
trwałego rejestru incydentów, event-watchera ani efektów. Adopcja wymaga
opublikowanej niezmiennej rewizji i testów adaptera, nie kopiowania roboczych
plików `.governance`. `new-project` odpowiada za admission i egzekwowanie w
repo, `ticket-lifecycle` za WIP/intent, `git-lifecycle` za bezstratną dostawę,
`worktrees` za inwentaryzację, a Taskand za użycie tych granic przez scheduler.

## Identyfikatory, trwałość i ponowne użycie

| Zasób | Tożsamość / wersja | Lokalizacja i znaczenie |
| --- | --- | --- |
| Proces | `proc://taskand.dev/<organizm>/<zdolność>/vN` + bindingHash | Rejestr organizmu; wersja procesu nie wersjonuje automatycznie jego JSON wejściowego. |
| Prompt, odpowiedź, profil testowy | `urn:uuid:…`, `taskand.context-object/v1` | Prywatny `log/context/context.sqlite3`; odczyt `/api/context?urn=…`, tylko właściciel. |
| Rewizja profilu | nowy URN, wspólne `family`, rosnące `revision`, `parent` | Stara wersja nie jest nadpisywana; próba rozwinięcia nieaktualnej wersji jest odrzucana. |
| Zdarzenie żądania | `urn:taskand:request-event:<uuid-żądania>:<seq>`, v1 | Odczyt przez `/api/context?urn=…`; fakt nie udziela uprawnień. |
| Graf żądania | `taskand.request-graph/v1`, requestId | `/api/state?requestId=…`; projekcja rzeczywistych zdarzeń gateway. |
| DSL planisty | `DOCUMENT TASKAND_PLANNER`, `VERSION 1`, SHA-256 dokumentu | AST generowany z katalogu URI i przekazanego kontekstu; nie jest jeszcze uniwersalną kopertą wszystkich organizmów. |

URN jest rodzajem URI: identyfikuje obiekt niezależnie od jego adresu HTTP.
W profilu `refs` wskazuje dokładne rewizje innych profili; rodzic wersji jest
oddzielny od składowych. Odczyt, tworzenie i symulacja sprawdzają istnienie oraz
właściciela referencji. Rewizje są niemutowalne w API. Hash wiąże treść i
tożsamość obiektu, ale lokalna baza nie jest niezależną, podpisaną atestacją.

Nie twierdzimy, że każdy wykryty host ma model zachowania. Obecne migawki
`log/twins/` i `log/web-models/` nie są automatycznie rejestrowane jako profile
użytkowników; nie istnieje jeszcze uniwersalny resolver wszystkich rodzajów
bliźniaków. Dockerfile opisuje runtime, nie pełny model urządzenia ani człowieka.

## Praca krok po kroku

1. Otwórz lokalny Web Cockpit i podaj token. Nowy interfejs nie zapisuje tokenu
   w localStorage. CORS dopuszcza tylko lokalne pochodzenia portu 8090.
   W wersji developerskiej można jednorazowo uruchomić panel adresem
   `http://localhost:8090/?taskand_dev=1&taskand_dev_token=TOKEN`. Działa to
   wyłącznie na `localhost`, `127.0.0.1` lub `::1`; panel usuwa oba parametry
   przez `history.replaceState` przed użyciem tokenu i trzyma go tylko w polu
   pamięci. Przykładowym lokalnym tokenem jest `taskand-admin-key` z
   `grants.yaml`; jeżeli `.env` ustawia `TASKAND_AUTH_TOKEN`, użyj jego wartości.
   Nie używaj tego trybu dla adresu LAN/VPS: URL może trafić do historii,
   logów proxy lub zrzutu ekranu. Klucz `TASKAND_LLM_API_KEY` nie jest tokenem
   panelu.
2. Wybierz tryb `DSL bez LLM i bez wykonania`, wpisz zadanie i opcjonalne,
   istniejące URN kontekstu. Nieznana referencja blokuje przekazanie do procesu.
3. Każde przyjęte, uwierzytelnione żądanie POST gateway otrzymuje requestId,
   promptRef i po odpowiedzi answerRef. CLI używające lokalnego registry zapisuje
   te same rodzaje referencji pod odrębną tożsamością `local-uid:<uid>`.
4. Utwórz syntetyczny profil z nazwą i promptami testowymi. Wskaż `parent` dla
   nowej wersji oraz `refs` dla kompozycji. Nie przenoś sekretów ani cudzych danych.
5. `Generuj i sprawdź DSL testów` rozwija profile i kompiluje prompty przez
   istniejący proces planisty. Wynik `COMPILED_FIXTURES` weryfikuje referencje i
   kompilację, a nie działanie produkcyjnej aplikacji; `executed:false`.
6. Obserwuj graf podczas żądania. `CALLING` jest zapisywane przed wywołaniem URI;
   `RETURNED` i `RESPONDED` nie oznaczają osiągnięcia celu użytkownika.

```text
promptRef ──→ obserwowane wywołanie URI ──→ answerRef
   │                    │                    │
   └── kontekst         └── zdarzenia         └── możliwy kolejny prompt

profil v1 ──parent──→ profil v2       profil A + profil B ──refs──→ profil C

NL + rejestr URI + rozstrzygnięte referencje
                  ↓
             DSL request-only
                  ↓
       walidacja kandydata i braków
                  ↓
   wymagane: kontrakty + twin + dowody + authority
                  ↓
       dopiero kontrolowane wykonanie
```

## Prywatność i pokrycie audytu

Domyślny zapis obejmuje metadane, relacje oraz HMAC wejścia, bez surowej treści.
Treść jest zapisywana tylko po `retainPrompt:true` i redakcji typowych sekretów.
Redakcja nie rozpoznaje dowolnego sekretu w języku naturalnym. Nie należy wysyłać
sekretów w promptach. Katalog ma prawa 0700, baza 0600; nie trafia do Git.
Nie wdrożono polityki retencji, usuwania na żądanie ani szyfrowania całej bazy.

Historycznych, niezapisanych promptów nie da się odzyskać z obecnych logów.
Bezpośrednie wywołanie `node generated/.../bin.mjs` omija nową granicę intake;
nie zgłaszamy stuprocentowego pokrycia wszystkich możliwych wejść. CLI lokalne
i konto gateway nie są automatycznie uznawane za tę samą osobę.

Graf obejmuje granice gateway → proces. Zagnieżdżone wywołania brokerów nie mają
jeszcze propagowanego, uwierzytelnionego kontekstu trace. Zawieszony lub zabity
proces pozostawia stan niezakończony; sam upływ czasu nie tworzy sukcesu.

## DSL i ograniczenia autonomii

Planista nie buduje już promptu systemowego przez wklejenie opisów do swobodnej
prozy. Serializuje AST z regułami, pełnym katalogiem procesów, referencjami i
zamkniętym kształtem żądania. Odrzuca pusty plan, cykle, nieznane URI, zagnieżdżone
sekrety i błędny kontrakt `file/ops` (`op`, nie `action`). Nie wymyśla wpisów Vault.

Klient LLM nie ma obecnie potwierdzonej obsługi request-only GBNF. Kontrakty
wejściowe części procesów nie są maszynowo kompletne. Dlatego poprawny kandydat
wraca jako `NEEDS_EXECUTION_CONTRACT`, `valid:false`, bez wykonywalnego
`blueprint`. Dotychczasowy `dev/composite` zatrzymuje się w tym miejscu. To
zabezpieczenie przed fałszywą aprobatą, nie dowód kompletnej autonomii.

Dotychczasowe koperty nie są jednolite: broker używa `{action,uri,input}`, a
orkiestrator `{params,dependencies,ts}`; część procesów nie rozpakowuje `params`.
CloudEvents w `log/events.jsonl` to osobny format logowania, nie DSL polecenia.
Wersja specyfikacji CloudEvents nie zastępuje wersji payloadu, reguł ani modelu.

Zmiana dotyczy planisty, nie wszystkich promptów systemu: generator `dev/evolve`
nadal ma instrukcje prozą. Runtime glm53 nie implementuje jeszcze nowego profilu
koperty `urn:taskand:schema:envelope:v2` przygotowanego w `wellmanifest/taskand`.
Zadanie `taskand.task-request/v1` oraz log `taskand.log-event/v1` mają w nim
oddzielne, zamknięte definicje i niezależne referencje do gramatyki/payloadu.

Ewolucja `dev/evolve` ma trzy próby, kontrolę pakietu i regresji; `doctor/heal`
wykonuje tylko jawnie zlecone naprawy dozwolone polityką. Nie jest to kompletny
kontroler publikacji GitHub ani dowód izolacji dowolnego wygenerowanego kodu.
Nowa wersja aplikacji wymaga osobnego, autoryzowanego kontrolera, testów,
niezależnego approval exact-head i receiptu publikacji. Worker nie zmienia sobie
grantów, nie zatwierdza własnej pracy i nie omija odrzuconej bramy.

Potwierdzone luki starej ewolucji: `nextVersion()` sprawdza istnienie katalogu
bez atomowej rezerwacji; guard jest regexem, a `contractTest()` uruchamia Node
z ograniczonym env, bez izolacji filesystemu/sieci. Test akceptuje samo istnienie
boolean `ok`, również `false`. Limit głębokości brokera 12 nie jest globalnym
budżetem potomków. `doctor/heal` ma domyślne 2 naprawy i cooldown, lecz parametr
`max` nie ma twardego górnego limitu. Są to luki implementacji, nie powód do
usunięcia niezależnego review, izolacji czy ograniczeń grantów ze standardu.

## Próba trzech issues doctor-agent

Źródła z `semcod/planfile` sprawdzono przez `git show` i AST, bez uruchamiania
kodu i bez zmian w brudnym checkoutcie. Wszystkie issues są zleceniami diagnozy,
nie naprawy. Revision: `55e86324ff666984cca92e421162fe65c046573a`.

| Issue | Niezależnie odtworzony finding | Zachowanie taskand |
| --- | --- | --- |
| #396 | `planfile/sync/github.py:61`, `except Exception: pass`; komentarz opisuje best-effort tworzenie etykiet. | Stary planista: `valid:true`, lecz `action` zamiast `op` i nieobsługiwane parametry. Nowy composite po ponowieniu: `REJECTED / DSL_GOAL_CHANGED`. |
| #395 | `planfile/core/fastio.py:181`, `except Exception: return None`; docstring jawnie dopuszcza nieparsowalny plik. | Stary planista: błędna ścieżka i wymyślone parametry weryfikacji rewizji/hashu. Nowy composite po korekcie timeoutu: `REJECTED / DSL_CLOSED_REQUEST_REQUIRED`. |
| #394 | `planfile/analysis/parsers/text_parser.py:114`, `except Exception: pass`; komentarz mówi o pomijaniu nieczytelnego tekstu. | Stary planista: błędna ścieżka, odczyt `.git/HEAD` zamiast dowodu konkretnej rewizji, dwa `spawn:`. Nowy composite: `REJECTED`. |

To nie jest kompletna diagnoza intencji autora: szeroki catch może ukrywać błędy
inne niż te przewidziane komentarzem. Szczególnie #395 pokazuje, że finding
heurystyczny nie jest automatycznie defektem. Taskand nie dostarczył wymaganego
raportu ani niezależnie nie odtworzył AST: **0/3 zakończonych diagnoz**.

Pierwsza próba worktree zakończyła się `PLANNING_UNAVAILABLE` z powodu braku
lokalnej konfiguracji. Po wskazaniu przez użytkownika primary `.env` zamontowano
go tylko do odczytu w tymczasowym namespace; broker potwierdził `glm-5.3` i
`configured:true`. Nie kopiowano ani nie wyświetlano kluczy. Nowy kod oraz
rejestry były read-only, a wyłącznie testowy log zapisywalny. Klient CLI miał
60-sekundowy limit zewnętrzny, sprzeczny z dłuższym przebiegiem composite;
uzgodniono go z istniejącym limitem gateway 900 s. Dodatkowe stabilne przyczyny
odmowy trafiają teraz do odpowiedzi composite bez surowego błędu dostawcy.

Pierwsze wywołanie #395 z LLM miało `OUTCOME_UNKNOWN` po 60 s. Ponowienie było
testem po sprawdzeniu ścieżki wykonania, nie automatycznym replay efektu.
W obserwowanym logu prób nie było wywołań `dev/evolve` ani `orchestrator/execute`.
`doctor/heal --plan` nie zaplanował napraw; zgłosił kwestie infrastruktury do
operatora. Poprawki timeoutu, walidacji i diagnostyki wykonał agent prowadzący,
**nie sam taskand**. Nie wytworzono nowych modeli urządzeń ani PR do tych issues.

Ostatnie requestId z konfiguracją LLM:

- #396: `urn:uuid:327d7e95-0228-4469-9ccc-a4743ac8188c`.
- #395: `urn:uuid:ebd18e8f-3379-43b8-b98b-34b135543d5b`.
- #394: `urn:uuid:716cc2af-3041-48ab-87b3-18dc8226bd0e`.

Odpowiedzi mają osobne promptRef/answerRef w prywatnej bazie worktree, pod
tożsamością lokalnego UID. Nie są automatycznie widoczne jako konto admin gateway.

## Governance i odtwarzalność

### Dlaczego zmiany nie dotarły do main

Ponowny odczyt Git i GitHub 2026-09-13 potwierdził:

- zdalny `main`: `9f6da15c928ad6ecb89b54502d84a1d419c3f173`;
- zdalny `refactor/phase-a`: `3e195de57d77426021e537dcd3243d41899529ad`;
- brak zdalnej gałęzi `ticket/001-complementary-runtime` oraz PR;
- dwa zarejestrowane checkouty na tym samym HEAD: primary ma 102 ścieżki
  staged, worktree dostawczy 129 zmienionych ścieżek (w tym dwa nowe pliki
  backlogu ticket-002). Zbiory nakładają się; nie należy sumować ich jako
  231 różnych plików;
- osiem commitów ponad zdalnym main zmienia 209 plików. Lokalny main ma już
  jeden nieprzeniesiony do zdalnego main commit, stąd wcześniejsze porównania
  względem lokalnego main dawały inną liczbę. Brak wpisów unmerged w indeksie,
  a zdalny main jest przodkiem obu HEAD — to nie rozbieżny konflikt scalania.

Przyczyną operacyjną było kontynuowanie kolejnych funkcji w niewypchniętym
zakresie bez zamknięcia poprzedniego etapu dostawy. Przyczyną proceduralną było
aktywowanie nowego hooka dla całego klonu, gdy primary nadal używał gałęzi bez
ticketu, a intent umieszczono w innym checkoutcie. Późna walidacja objęła także
historię sprzed adopcji, która nie miała tego intentu ani obecnego budżetu.
Kolejne lokalne snapshoty zabezpieczały dane, ale nie przybliżały same przez się
commitu, PR ani merge. To błąd prowadzenia pracy i brak egzekwowanej kontroli
narastania zaległej dostawy, nie brak zgody użytkownika na publikację.

Nowsze New-project ma kontrolę work-start, której nie zawiera przygotowany
tutaj pakiet 0.20.16. Sama aktualizacja instrukcji nadal nie wystarczy:
potrzebne jest wywołanie kontroli przed kontynuacją, nie tylko alokacją,
oraz test migracji istniejącego, brudnego klonu przed aktywacją hooków.
Zielony test produktu nie zastępuje bramki zakresu i zdalnej publikacji.

W istniejącym tickecie `wellmanifest/taskand` dodano lokalny, opt-in kontrakt
`urn:taskand:schema:delivery-observation:v1`, evaluator `operations/delivery.py`
oraz reguły TKD-013 / TKD-EVO-005–007 w `docs/information/evolution.md`.
Kontrola liczy sumę unikalnych ścieżek historycznej delty i wszystkich warstw
roboczych; rozróżnia ownership, adopcję, budżet, deadline, commit, push i PR.
To nieopublikowana referencja standardu, **nie wdrożona bramka glm53**.
Źródło referencyjne musi najpierw przejść chronioną publikację, a dopiero potem
przypiętą adopcję i canary adaptera w Taskand.

Pozostała kolejność naprawy: uzgodnić bazę i zachowany zakres sprzed adopcji,
podzielić materialną dostawę bez podnoszenia limitów, rozstrzygnąć klasyfikację
findings i overlap guard, zweryfikować dostępność chronionego CI, następnie
commit → push → odczyt SHA/PR → niezależny review i merge. Po zmianie bazy
trzeba ponowić testy dokładnego wyniku integracji. Dopiero terminalny receipt
i weryfikacja zachowanych źródeł pozwalają rozważyć cleanup. Oba checkouty
zawierają potrzebną pracę; nie zostały uznane za osierocone dane do usunięcia.

### Zachowane źródła i istniejące bramki

Adoptowano źródło `wellmanifest/new-project` 0.20.16,
`6d2da011088b69ebe1636f3bf681e5ec21a062ab`. Plików zarządzanych nie poprawiamy
ręcznie. `project/lease-controller.py` łączy przypięty backend blokad Autonom
z walidatorem przejść zaadoptowanego standardu. Stan kontrolera jest poza
checkoutem; lokalna projekcja lease nie jest źródłem authority. Adapter nie
obsługuje zatwierdzania ani merge. Nie jest kontrolerem rozproszonym.

Naprawiono lokalnie lukę powielania przez Git: wzorzec `/vault/` chroni prywatny
sejf w katalogu głównym, ale nie ukrywa publicznych metadanych `generated/vault/`.
Oba niesekretne artefakty oraz siedem plików istniejących dotychczas tylko w
primary są teraz obecne w istniejącym worktree ticket-001. Obejmuje to test
web-twin i poprawkę izolacji transportu przeglądarki. Zachowano oddzielnie
oryginalne bajty indeksu i katalogu roboczego obu checkoutów; primary i jego
działające bind mounty nie zostały wyczyszczone ani przełączone.

Procedura na przyszłość jest opublikowana w
[git-lifecycle: lossless handoff](https://github.com/wellmanifest/git-lifecycle/blob/24cfe7cbbbc0d95f6b66f89124b471bee7287d0d/docs/information/worktree-lifecycle-handoff.md)
(PR #20, niezależny Validator, chroniony merge). W granicach już zleconej
publikacji kontynuacja nie wymaga ponownego pytania. Przejęcie nadal wymaga
zweryfikowanego przekazania własności, ochrony wszystkich warstw danych i
aktualnego fencing tokenu. Zapis procedury nie dowodzi automatyzacji tych
operacji w Taskand. Adopcja standardu i profil chronionego CI są osobnymi
wymaganiami; żadnego z nich nie zastępuje zielony lokalny test.

<!-- docs:section references -->
## Sprawdzenia i odniesienia

- `python3 -m unittest discover -s tests -p context_test.py`: 31 testów PASS;
  obejmuje działający serwer HTTP, referencje zdarzeń i równoległość.
- Ponowiona walidacja uzgodnionych źródeł: konformacja 4/4, kontrakty 30/30,
  negatywne 17/17, digital-twin 8/8, kontekst 31/31, obserwatory 8/8.
  Mesh: 11 przypadków, 10 PASS i 1 SKIP. Testy wykonywano w prywatnej kopii
  źródeł, bez `.env`, z izolacją sieci i zapisu. Test adaptera lease otrzymał
  tylko przypięty plik backendu do odczytu; nie dowodzi to przenośnej instalacji.
- Web-twin 8/8 PASS na tej samej uzgodnionej kopii: prawdziwy Chromium,
  odtworzenie po wyłączeniu źródła oraz odmowa dostępu do sieci i plików hosta.
  Test nie kontaktował się z prawdziwym GitHubem ani formularzem Subactor.
  Starszy wynik integracji 43/43 nie został w tej iteracji ponowiony.
- Build obrazu bootstrap zakończony. Nie uruchamiano entrypointu bootstrap,
  który może generować lub nadpisywać procesy. Piny baz OCI są niezmienne, ale
  instalacja APK nadal nie jest przypięta jako pełny odtwarzalny lock zależności.
- Canary w odizolowanym Chromium: PASS. Rzeczywisty gateway i kompilator DSL,
  syntetyczna autoryzacja/baza, trzy węzły grafu, tworzenie profilu i kompilacja
  jego scenariusza; mobilny viewport 390 px bez poziomego overflow. Test nie
  wdraża interfejsu na produkcyjny/local operator port 8090.
- Pełna brama publikacji nadal **BLOCKED**. Zakres od zdalnego `main`
  (`9f6da15`) obejmuje osiem wcześniejszych commitów, sprzed adopcji standardu,
  bez ówczesnego intentu. Występują błędy historii, budżetu, scope, ownership
  i dowodu adopcji oraz dwa wymagające klasyfikacji wskazania skanera sekretów.
  Nie zmieniono limitów ani bazy tylko w celu ukrycia historycznej delty.
  Domyślny katalog starszego wydania Validatora nie zawiera profilu Taskand,
  ale rzeczywisty resolver uruchomiony z konfiguracją chronionej usługi
  potwierdził `semcod/taskand-glm53`, `json-only / protected-json` oraz wymagany
  `onedev/local-verify`. Digest wybranego rejestru:
  `f3d9f7f626a975eddbc4fb6b1c49c37e18720eb650bee7ba17afdab6d7d4fdef`.
  Samo istnienie profilu nie dowodzi wykonania CI ani możliwości merge obecnej
  delty. Weryfikacja musi korzystać z konfiguracji działającej usługi, nie
  przypadkowego lokalnego checkoutu lub domyślnego katalogu starszego wydania.
  Ponowny odczyt v6 wykazał nowy chroniony rejestr wskazany przez
  `DIRECT_PR_REGISTRY_PATH`, digest
  `b60043b6eae0842f5daa27bc8b46f167591c6b7f7c0a6a0434dcf7262bb08907`.
  Nadal zawiera profil Taskand dla `main`, wymaga `onedev/local-verify` i ma
  `scheduled_scan=false`. Nie dowodzi to uruchomienia testów przez OneDev.
- Koordynator `ifuri-onedev-pr-coordinator-1` działa, ale faktycznie zamontowany
  plik nie jest jedynym źródłem konfiguracji. Poprzedni wniosek o wyłączeniu
  usługi na podstawie `enabled=false` był nieuprawniony. Aktualny mount to
  `report-ci-298/repositories.toml`; oba kontenery mają niesekretny override
  `ONEDEV_AGENT_PR_VERIFICATION=true`. Wywołanie ich rzeczywistego `load_config`
  potwierdziło `enabled=true` oraz 107 profili. **Brakuje profilu
  `semcod/taskand-glm53` w koordynatorze i executorze.** Profil Validatora
  wymagający `onedev/local-verify` nie tworzy automatycznie profilu OneDev.
  Potrzebna jest chroniona dostawa właściwych testów w HOME `onedev-agent`,
  canary i wdrożenie tego profilu, nie globalna zmiana przełącznika.
  Nie zmieniono konfiguracji, kontenerów ani kolejki innych projektów.
- Read-only admission w opublikowanym `new-project` 0.20.26 dla ścieżek
  poprawki overlap guard zwraca RECONCILE: niezwiązany z branchem aktywny
  `ticket-198` w primary oraz trzy aktywne tickety przy limicie jednego
  workstreamu governance. Sam brak procesu lub stare daty nie upoważniają
  do przejęcia cudzych rezerwacji. Nie otwarto nowego worktree naprawczego.
- Odizolowany reproducer wykazał błąd `contested_paths`: porównanie względem
  wspólnego przodka jest zastępowane porównaniem względem default branch,
  co ponownie dolicza odziedziczone commity. Kandydat przecina oba zbiory
  wkładu przed dodaniem dirty paths. Trzy fixtures: wspólna historia i jeden
  dirty writer — brak konfliktu; dwóch dirty writerów — konflikt; własny
  commit peera i dirty writer — konflikt. Obecny kod myli pierwszy przypadek,
  kandydat przechodzi 3/3. To test atrybucji, nie pełny test standardu ani
  wdrożenie. Rzeczywiste nakładanie niezapisanych zmian adopcji pozostaje
  osobnym problemem; poprawka nie usuwa go i nie zezwala na jego ignorowanie.
  Błąd odtworzono zarówno w zaadoptowanym 0.20.16, jak w opublikowanym
  0.20.26; oba pliki mają różne hashe i strukturę funkcji, dlatego kandydat
  dla HOME został sprawdzony osobno względem źródła `8d86cd6`.
  Dowody tej korekty: prywatny audit `publication-unblock-20260913.gsWt6G`,
  obserwacja efektywna SHA-256
  `b576108a42201cd7e569277d29f753e297cc25b2f620dea0b04e9d07b77809ae`,
  reproducer SHA-256
  `1c6d2e4a5f8f9da62a2b5e6ede705ff9aaf04e414183e386cb8dff17a8b03a9b`.
- Nie wykonano restartu nowej wersji gateway/landing. Dotychczasowy serwer
  zachowano; nie uruchamiano bootstrapu nad istniejącymi procesami.

Prywatny raport: `~/.local/state/taskand/audits/complementary-20260913-0920/audit.json`,
SHA-256 `a9bc8245b78b565765e690e7d8726a0cfc32cdb671ecf359a85284b4a9c3569d`. Zawiera wejścia prób, odpowiedzi,
ich hashe oraz wyniki bram. To lokalne dowody, nie receipt zaufanego merge.

Nowy dokument i kod pozostają lokalne. Pełna zgodność wszystkich organizmów,
globalny rejestr modeli urządzeń i bezobsługowa publikacja GitHub są niezrealizowane.

Bieżące surowe wyniki są poza Git w prywatnym audycie
`reconciliation-20260913.SYpaAP`, w `source-fixture-tzkcxz2i/.audit-results/`.
Przykładowe SHA-256 strumieni: kontrakty
`0dbe369e9e4a4558e97b3410936d9468517aa6cb676d82cd28ecac29ffa4568c`,
kontekst `66a0dd991f4140b464dbfd46396c63346c78ee76c8c49ad97ae333e15c3a9101`.
Są to dowody lokalnej walidacji, nie kopia zapasowa na innej maszynie, podpis
niezależnego CI ani potwierdzenie wdrożenia portu 8090.
