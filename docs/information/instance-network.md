---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "instance-network",
  "kind": "information",
  "version": 1,
  "title": "Sieć instancji, obserwatory i decyzje po teście bliźniaka",
  "status": "draft",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-13",
  "updated": "2026-09-13",
  "review_after": "2026-09-20",
  "source_revision": "3e195de57d77426021e537dcd3243d41899529ad",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": ["gateway/router.py", "gateway/handlers/mesh.py", "gateway/handlers/observers.py", "tests/mesh_test.py", "tests/observers_test.py", "index.html", "bin/bootstrap.manifest"]
}
---

# Sieć instancji i obserwatory Taskand

<!-- docs:section purpose -->
## Cel i granica wdrożenia

Aktualny stan oraz plan sieci współpracujących instancji, ze sprawdzeniem zadań
w bliźniaku przed decyzją człowieka. Właścicielem implementacji jest
[ticket-001](../../project/ticket-001/README.md). Nowy dashboard i pilotaż są
lokalnymi zmianami w istniejącym worktree, **nie wdrożeniem na port 8090**.
Nie są działającym kolektorem historii człowieka ani kompletną federacją.

<!-- docs:section scope -->
## Co rzeczywiście istnieje — obserwacja 2026-09-13

| Obszar | Zweryfikowany stan | Czego to nie dowodzi |
| --- | --- | --- |
| Chat `localhost:8090` | HTTP 200; nginx serwuje prosty `index.html` z formularzem i adresem API `localhost:8077` | Nie jest instalatorem, nowym dashboardem ani dowodem powodzenia zadania LLM. |
| Wywołanie przez chat | `/api/chat`, organizm `hw`, wiadomość `stan`: `ok=true`, odpowiedź telemetryczna CPU/RAM/dysk | Potwierdza tę ścieżkę odczytową, nie zadania LLM, obserwatory ani samonaprawę. |
| Gateway `localhost:8077/healthz` | HTTP 200, `node=nvidia`, 30 procesów, stały napis wersji `3.0.0` w kodzie | Nie dowodzi wersji wdrożenia przypiętej do SHA ani dostępności każdego procesu. |
| Discovery | Gateway udostępnia `/.well-known/catalog.json`; na porcie landing 8090 ten adres daje 404 | Brak automatycznego odkrywania przez landing, mDNS, relay czy chat. |
| Federacja | `peers`, `peer add/remove`, HTTP export/pull; pakiet importowany jako candidate | Pobieranie kodu nie jest zdalnym wykonaniem ani uwierzytelnieniem węzła. |
| Replikacja | `taskand occupy` tworzy operatorski plan SSH/rsync/Compose, dopiero `--run` ma skutki | Brak kontrolera autonomicznego wdrożenia, rollbacku i potwierdzonego VPS. |
| Modele użytkownika | Lokalny, niewdrożony Store ma wersjonowane syntetyczne profile i izolację właścicieli | Nazwa `admin` lub lokalny UID nie identyfikuje tego samego człowieka na wielu hostach. |
| Historia promptów | Prywatny Store w worktree zapisuje referencje i HMAC; treść tylko opt-in | Działający gateway na 8077 nie ma jeszcze `/api/context` (HTTP 404). Brak pokrycia wszystkich historycznych sesji. |
| Ticketing | `planfile.yaml` zawiera wygenerowany backlog prefact; `project/ticket-001/intent.json` opisuje pracę w repo | To nie jest jeden działający rozproszony kontroler zadań. |

README z hasłem „5 plików”, opis architektury v1.1 i federacja v0.20 są
historyczne. Nie wolno wyprowadzać z nich dostępności obecnych funkcji.
Źródłem aktualnej nawigacji są ten dokument oraz
[kontekst komplementarny](complementary-runtime.md).

## Stan publikacji

`refactor/phase-a` jest wypchnięty, ale ma 8 commitów ponad `origin/main` i
7 ponad lokalnym `main`. `origin/main` jest przodkiem, nie występują wpisy
unmerged w indeksie. **To nie oznacza, że zmiany scalono.** Taskand nie ma
otwartego PR; dwa checkouty zawierają materialne niezacommitowane zmiany,
dlatego nie są automatycznie usuwalnymi sierotami.

Zależny [Validator PR #448](https://github.com/subactor/validator-agent/pull/448)
pozostaje otwarty. Lokalny zestaw Validatora przeszedł 990 testów, ale wymagany
OneDev zatrzymał zbieranie testów na `ModuleNotFoundError: subllm.routing_contract`.
Wynik lokalny ani inne zielone checki nie zastępują tej bramki. Profil Taskand
nie został przez to aktywowany; brakuje także osobnego wykonawcy jego testów.

Pełna brama Taskand nadal wymaga uzgodnienia adopcji standardu, zakresów
workstreamów i podziału istniejącej zmiany na zatwierdzone części. Nowe modele
nie uzasadniają zwiększenia budżetów, wyłączenia hooka ani nadpisania primary.
Ostatni pełny przebieg wykazał 9 błędów: architektura, budżet, intent, scope,
dwa findings secret scan, nieuzgodniona adopcja i dwa findings workstream.
Zgłoszenia secret scan dotyczą wcześniejszych `gateway/auth.py` i pakietu
Telegram; wymagają klasyfikacji, nie stanowią same w sobie dowodu wycieku.
Próba zabezpieczenia pełnego dirty worktree przez istniejącego producenta
snapshotów Autonom została odrzucona na syntetycznej próbce hasła w
`tests/context_test.py`. Nie powstał nowy pełny snapshot ani zweryfikowany
checkpoint odtwarzania; worktree pozostaje zachowany. Nie wolno przedstawiać
starszego backupu jako kopii nowych zmian ani omijać skanera.

<!-- docs:section content -->
## Dashboard: obserwacje zamiast umownego „poziomu autonomii”

Nowe `GET /api/mesh/state` wymaga istniejącego grantu `read` do rejestru.
Zwraca `taskand.mesh-observation/v1`, graf instancja → organizm → proces oraz
osobne peery `UNOBSERVED`. Nie wykonuje skanów ani zapytań do peerów. Nie czyta
historii użytkownika. Odrzuca błędne/za duże odpowiedzi i adresy zawierające
poświadczenia, ścieżki, query lub fragmenty.

Radar prezentuje procent aktywnych wpisów, wpisów z zadeklarowanym SHA-256
i wersjonowanych URI. Dostępność peerów i wierność bliźniaków mają `null`,
bo nie istnieje pomiar. Nieznane nie jest zerem ani sukcesem. Kontur radaru
jest rysowany tylko dla kompletu wartości. Tabela podaje liczniki i mianowniki;
błąd odświeżenia oznacza stary wykres jako nieaktualny. Opcjonalny polling
odbywa się co 5 s tylko w widocznej karcie; token pozostaje w pamięci strony.

Obecny rejestr potrafi zamienić błąd odczytu pojedynczego pliku na pusty rejestr.
Dashboard nie naprawia tej wcześniejszej luki i opisuje pokrycie jako odpowiedź
rejestru, nie niezależny audyt dysku. Weryfikacja hashów i kompletności jest
osobnym wymaganiem. Graf żądania z `/api/state` pokazuje granice wywołań,
nie każdą instrukcję procesu i nie wszystkie zdarzenia z innych maszyn.

## Pilotaż wszystkich trzech obserwatorów

```text
użytkownik wybiera pilotaż
          ↓
zamknięty AST + deterministyczny DSL + digest implementacji/fixture
          ↓
zapis wersjonowanego planu URN przed symulacją
          ↓
bliźniak danych: izolowane pliki JSONL, trzy normalizatory
          ↓
wynik URN → referencja do dokładnego planu
          ↓
WAIT_FOR_HUMAN_DECISION w web / wynik JSON w shell
          ↓
osobny plan kolektorów live + dokładny zakres i zgoda człowieka
```

`POST /api/observers/pilot` akceptuje wyłącznie `{"action":"simulate"}`.
Używa tylko wbudowanych syntetycznych fixture; użytkownik nie może podać
ścieżki swojej sesji ani polecenia wykonania. Plan jest obiektem
`observer_plan` z payloadem `taskand.observer-pilot-plan/v1`, a wynik
`observer_receipt` z payloadem `taskand.observer-pilot-receipt/v1`.
Obiekty mają URN i odczyt przez istniejące API kontekstu, tylko dla właściciela.
Zmiana AST, fixture lub implementacji unieważnia dopasowanie planu.

| Źródło fixture | Testowane zdarzenia | Zachowane dane |
| --- | --- | --- |
| Taskand/Git/testy | `test.completed`, `git.changed` | wynik testu albo liczba zmienionych ścieżek |
| CLI/IDE | `command.exit`, `ide.action` | dozwolona nazwa programu/kod wyjścia albo nazwa działania IDE |
| Przeglądarka | `navigation`, `click` | domena `example.invalid` albo kontrolowany identyfikator `demo-run` |

Każdy normalizator usuwa treść komendy, pełną ścieżkę, query URL oraz pola
z wartościami formularzy/sekretami. Nieznane formaty są odrzucane, nie stają
się automatycznie materiałem do uczenia. Ślad ma
`taskand.observation/v1`, `synthetic=true`, `authority=NONE`.

**Zakres dowodu:** symulacja testuje normalizację sześciu rekordów, nie
zbieranie realnych zdarzeń przez rozszerzenie Chrome, Codex, Claude czy IDE.
Nie otwiera istniejących sesji i nie uruchamia kolektora live. Wynik jawnie
wymienia brakujące natywne adaptery, kontroler zgody i wspólną tożsamość.
Przycisk kolejnego etapu wypełnia prompt i referencję do wyniku; niczego nie
wysyła i nie zatwierdza automatycznie.

Nie jest to jeszcze globalna bramka dla wszystkich zadań Taskand. Dotychczasowe
bezpośrednie wywołania CLI/rejestru i automatyczne healing wymagają osobnego
kontrolera: bez zgodnego planu, receiptu testu bliźniaka i decyzji człowieka
efekt produkcyjny musi być odrzucony. Sam napis `WAIT_FOR_HUMAN_DECISION`
w wyniku pilotażu nie egzekwuje tej zasady w pozostałych ścieżkach.

### Wymagania dla obserwacji rzeczywistych danych — następny etap

Każde źródło wymaga osobnego, jawnego adaptera i konfiguracji: host, właściciel,
ścieżki sesji lub dozwolone domeny, rodzaje zdarzeń, czas działania, retencja,
odbiorcy i budżet. Wykluczenia obejmują sekrety, schowek, surowe klawisze,
formularze haseł, cookies, sesje prywatne i niezatwierdzone repozytoria.
Preferowane są API/hooki narzędzi i rozszerzenie włączane przez użytkownika,
nie przejmowanie profilu przeglądarki, zrzuty ekranu ani śledzenie całego OS.

Aktywację musi obsługiwać kontroler wiążący zgodę z dokładnym planem,
wynikiem bliźniaka, hashem adaptera, konkretnym źródłem i TTL. UI pokazuje
zbieranie, pauzę, błędy, budżet i cofnięcie zgody. Po zmianie źródeł lub
uprawnień poprzednia zgoda nie obowiązuje. Brak adaptera albo nieznany format
oznacza brak pokrycia, a nie poprawne działanie. „Wszystkie powyżej” obejmuje
trzy pilotaże, nie nieograniczoną obserwację cudzych danych.

## Docelowa sieć instancji — projekt, nie aktualna zdolność

Każda instancja potrzebuje trwałego `instanceId` niezależnego od hostname,
klucza urządzenia, manifestu zdolności, listy transportów i wersji protokołu.
Tożsamość procesu pozostaje URI; wywołanie wiąże ją dodatkowo z konkretnym
węzłem, wersją i hashem. Ten sam URI na dwóch maszynach nie jest tym samym
wykonaniem ani wspólnym prawem do danych.

Warstwa transportowa jest wymienna: lokalny IPC, uwierzytelnione HTTPS,
WebSocket, SSH/tunel albo kolejka store-and-forward. Adaptery negocjują
wersję, limity i zdolności. „Dostępna warstwa” nie oznacza dowolnego
niezabezpieczonego połączenia; fallback nie może osłabiać tożsamości, poufności
ani zakresu grantu. Powinny istnieć testy utraty sieci, NAT, duplikatów,
zmienionego certyfikatu, replay i niezgodnej wersji.

Discovery zaczyna się od jawnych seedów lub kodu parowania. Opcjonalne
ogłoszenia LAN/mDNS i `/.well-known/taskand.json` mogą reklamować minimalny
manifest bez prywatnych danych. Są tylko kandydatami: wymagają parowania,
potwierdzenia tożsamości i przyznania zdolności. Chat/landing może pokazać
taką ofertę i poprosić o zgodę, ale jego HTML nie jest granicą zaufania.
Skan podsieci nie uruchamia się jako skutek otwarcia strony.

Żądanie zdalne musi wiązać task/step URN, correlation/causation ID, autora,
odbiorcę, proces i schemat wejścia, digest planu i bliźniaka, zakres zasobów,
grant, deadline, budżet oraz idempotency key. Odpowiedź to niezależny receipt.
Timeout po wysłaniu ma stan `OUTCOME_UNKNOWN`: najpierw uzgodnienie wyniku,
nie ponowne wykonanie deploymentu. Zdarzenia i tekst LLM nigdy nie udzielają
autoryzacji. Multiplikacja zachowuje ograniczenia rodzica, nie powiela sekretów.

## VPS, landing i bliźniak urządzenia

1. Wskazać host, dostęp operatorski i zakres; przed pierwszym kontaktem
   przygotować plan bootstrapu oraz bezpieczny model testowy na developerze.
2. Przetestować bootstrap w izolowanym VM/kontenerze zgodnym z wymaganym OS.
   Nie nazywać tego dokładnym bliźniakiem nieznanego VPS.
3. Po decyzji człowieka zainstalować przypiętą wersję minimalnej instancji
   lub zaoferować podpisany instalator na opcjonalnym landing page.
4. Sparować urządzenie; dopiero z grantem wykonać odczytową inwentaryzację
   sprzętu, OS, usług, sieci i zatwierdzonych danych. Nie kopiować poświadczeń.
5. Z inwentaryzacji utworzyć wersjonowany model VPS: konfiguracja, fixture,
   manifest OCI/VM, granice nieznanego i pochodzenie. Takie same podsieci/IP
   odtwarzać w izolowanej przestrzeni sieci, bez kolizji z hostem.
6. Na developerze wykonać zadanie na tym modelu, przedstawić wynik, różnice,
   ryzyka i rollback w shell/web. Po zgodzie wykonać na VPS ten sam związany
   plan i zapisać receipt. Odchylenie modelu uruchamia kolejny plan, nie bypass.

Obecny `occupy` nie spełnia jeszcze tego kontraktu: kopiuje workspace, ma
polecenia SSH składane z argumentów, opcję przekazywania tokenu oraz kopiuje
`grants.yaml`. Nie używać go do automatycznego wdrożenia bez uszczelnienia
argumentów, pinów, tożsamości i dystrybucji poświadczeń. Brak adresu VPS
uniemożliwia potwierdzenie rzeczywistej replikacji w tym pilotażu.

Nie każdy organizm potrzebuje Dockerfile. Kontrakt organizmu powinien być
niezależnym od języka manifestem; runtime Node/Python, kontener, VM czy
emulator jest wybieranym backendem. Model urządzenia może składać się z modeli
sieci, usług, przeglądarki i OS, przypiętych do dokładnych rewizji.

## Wspólny model człowieka i system ticketowy

Model człowieka przechowuje wyłącznie deklarowane preferencje i zatwierdzone
fakty z pochodzeniem; hipotezy pozostają hipotezami. Urządzenia trzeba jawnie
powiązać z jednym `subjectId` przez parowanie lub dostawcę tożsamości. Nie
łączyć profili po nazwie loginu, IP, stylu pisania czy wspólnym tokenie admina.
Synchronizacja wymaga zakresu odbiorców, szyfrowania, cofnięcia zgody i
polityki retencji/usuwania; nie replikuje całej historii między wszystkimi
węzłami. Rewizje modeli są niezmienne, kompozycja wskazuje dokładne URN/digesty.

Proponowany podział: **Planfile** jako backlog/projekcja zadań, kontrakt
**wellmanifest/ticket-lifecycle** jako bounded intent i przejścia, GitHub
Issues/PR jako adapter dostarczania zmian repozytoriów. Nie tworzyć trzech
niezależnych źródeł statusu. Niezbędny jest jeden kanoniczny task URN oraz
zarejestrowany allocator/kontroler z CAS, lease i fencing; lokalne `ticket-NNN`
jest tylko tożsamością w repozytorium, nie globalnym licznikiem dla klonów.
Offline można zbierać propozycje, nie przyznawać sobie kolidującej authority.

Rekomendacje kolejnych prac mają zawierać źródłowe event URN, korzyść, ryzyko,
koszt, zasoby, zależności, brakujące granty i scenariusz bliźniaka. UI ma
odróżniać propozycję od zaakceptowanego zadania. Priorytetem jest wznowienie
istniejącej pracy i naprawa konkretnych blokad, nie tworzenie nowych worktree.

<!-- docs:section evidence -->
## Sprawdzenia

- `python3 -m unittest discover -s tests -p mesh_test.py`: model, brakujące
  pomiary, granty, limity, redakcja, plus odizolowany Chromium z rzeczywistym
  gateway testowym i syntetycznym rejestrem; nie używa portu produkcyjnego API.
- `python3 -m unittest discover -s tests -p observers_test.py`: trzy źródła,
  plan przed symulacją, brak skutków live, odrzucanie zmienionego planu,
  separacja właścicieli i usuwanie wrażliwych pól.
- `python3 -m unittest discover -s tests -p context_test.py`: dotychczasowy
  kontekst, DSL, ACL i graf requestu.
- Test UI obejmuje desktop i viewport 390 px, brak błędów JS, brak zapisu
  tokenu w localStorage oraz przekazanie receipt URN do kolejnego promptu.
- Łącznie 50 testów Python przeszło lokalnie (31 kontekstu, 11 mesh/UI,
  8 pilotażu). Test przeglądarkowy korzysta z opcjonalnego Playwright/Chrome;
  jego pominięcie na innym hoście nie potwierdza pokrycia UI.
- `docker compose config --quiet` przeszedł z ostrzeżeniem o starym polu
  `version`; nie wykonano build/restartu ani wdrożenia nowego runtime.
- Pełne `make test` przerwano (exit 130), bez wyniku PASS: test kontraktu
  wywołuje aktywne procesy z `{}`, w tym skaner v3 działający poza bliźniakiem.
  Testy negatywne mają też na sztywno bramę `127.0.0.1:8077`. Potrzebny jest
  osobny izolowany runner z testowym rejestrem i zablokowanym egress.
  Obecny Makefile nie dołącza nowego zestawu Python do `make test`.

<!-- docs:section limitations -->
## Otwarte ograniczenia

Brak pełnego transport-neutral RPC, globalnej tożsamości, parowania,
ograniczonego discovery, rzeczywistych kolektorów i kontrolera zgody.
Brak kompletnego cyfrowego bliźniaka urządzenia lub człowieka. Brak dowodu
wdrożenia nowego interfejsu na 8090. Uprawnienia i modele nie mogą być
rozszerzane przez analizowany log ani proponowaną samonaprawę.

<!-- docs:section next_actions -->
## Kolejność kolejnych dostaw

1. Uzgodnić istniejący delta/adopcję Taskand; naprawić odtwarzalność środowiska
   OneDev Validatora i dostarczyć niezależny gate dla Taskand. Odizolować
   istniejące testy od rzeczywistej sieci/API i włączyć testy Python do gate.
2. Dostarczyć dashboard/pilotaż przez chroniony PR, dopiero potem aktywować
   dokładny zatwierdzony runtime i sprawdzić realny URL operatora.
3. Wdrożyć kontroler zgody oraz po jednym adapterze live dla wybranych źródeł;
   każde uruchomienie: nowy związany plan, bliźniak i decyzja człowieka.
4. Przetestować dwa izolowane węzły: parowanie, wywołanie idempotentne,
   utrata transportu i konflikt wersji. Następnie wskazany VPS.
5. Dodać wspólną tożsamość człowieka, synchronizację minimalnych faktów,
   kontroler task URN i propozycje następnych etapów z mierzalnym pokryciem.
