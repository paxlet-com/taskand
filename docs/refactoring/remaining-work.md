---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "remaining-work",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Pozostałe prace po naprawach i publikacji PR 17",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-14",
  "updated": "2026-09-14",
  "review_after": "2026-09-21",
  "source_revision": "0f9df49f33d6cd85006fe4e41378f06b7347d7dd",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "https://github.com/semcod/taskand-glm53/commit/0f9df49f33d6cd85006fe4e41378f06b7347d7dd",
    "https://github.com/semcod/taskand-glm53/pull/14",
    "https://github.com/semcod/taskand-glm53/pull/16",
    "https://github.com/semcod/taskand-glm53/pull/17",
    "repo://semcod/taskand-glm53/docs/refactoring/functional-recovery-plan.md",
    "repo://semcod/taskand-glm53/docs/analysis/diagnostic-recovery.md",
    "https://github.com/wellmanifest/new-project/issues/357"
  ]
}
---

# Co jeszcze zostało do zrobienia

<!-- docs:section goal -->
## Cel

Najpierw odebrać działający lokalny czat i panel, następnie skracać dostawę
przez automatyzację powtarzalnych operacji. Miarą jest poprawnie zakończone
zadanie i zweryfikowane wdrożenie, nie liczba zmian standardów ani zielony health.

To aktualizacja obrazu prac na 2026-09-14 po PR #17, nie nowa specyfikacja
produktu. Szczegółowe kryteria F-01–F-11 pozostają w
[planie naprawczym](functional-recovery-plan.md); jego wcześniejsze obserwacje
runtime i blokad są historyczne, nie są automatycznie stanem bieżącym.

<!-- docs:section current_state -->
## Co już zrobiono, a czego to nie dowodzi

| Obszar | Potwierdzony wynik w źródłach | Nadal niepotwierdzone tym wynikiem |
| --- | --- | --- |
| Diagnostyka i budżety | [PR #4](https://github.com/semcod/taskand-glm53/pull/4): wspólny deadline, ograniczona współbieżność, metryki i jawne parametry budżetu | Globalny adaptacyjny scheduler, wydajność produkcji i automatyczne strojenie wszystkich limitów |
| Panel, auth i gotowość | [PR #5](https://github.com/semcod/taskand-glm53/pull/5), [#10](https://github.com/semcod/taskand-glm53/pull/10), [#13](https://github.com/semcod/taskand-glm53/pull/13): UX autoryzacji, strumień readiness i identyfikacja wydania gateway | Aktualny stan serwowanego panelu, realny prompt i spójność działającego gateway z UI |
| Odwracalne wdrożenie | [PR #12](https://github.com/semcod/taskand-glm53/pull/12), [#14](https://github.com/semcod/taskand-glm53/pull/14), [#15](https://github.com/semcod/taskand-glm53/pull/15): narzędzia recovery, weryfikowany snapshot/restore i uwierzytelniony canary | Backup rzeczywistych danych, przełączenie konkretnej usługi i produkcyjny odbiór F-04 |
| Przeglądarka | [PR #7](https://github.com/semcod/taskand-glm53/pull/7), [#16](https://github.com/semcod/taskand-glm53/pull/16): start CDP, wykrywanie Chrome i odmowa zamiast ukrytego skipu w CI | Działanie na każdym systemie/architekturze i rzeczywiste kolektory live |
| Dostawa | [PR #8](https://github.com/semcod/taskand-glm53/pull/8), [#9](https://github.com/semcod/taskand-glm53/pull/9): wznawialny kontroler i przypięty runtime lease; PR #14/#16/#17 scalone | Pełna automatyczna kolejka całej floty i automatyczny deploy po merge |
| Dokumentacja | [PR #17](https://github.com/semcod/taskand-glm53/pull/17): kompaktowe plany tematyczne | Implementacja E-01–E-09 ani chroniona adopcja walidatora nowego formatu docs |

Odczyt GitHub API podczas tego podsumowania: **brak otwartych PR w Taskand**.
Nie oznacza to braku pracy lokalnej: obserwowano osobny `ticket-016`,
`IN_PROGRESS / EDIT`, zakres `infra/portable-runtime/**`. To przenośny profil
gateway w przygotowaniu, nie odebrane wydanie; sprawdzić jego bieżący wynik
przed rozpoczęciem następcy. Nie przejmować tego zakresu ani odtwarzać starego
ticket-012 jako konkurencyjnej implementacji.

<!-- docs:section scope -->
## Zakres podsumowania

Lokalny produkt Taskand, jego testy, adaptery dostawy i adopcja opublikowanych
standardów. Poniższe P1/P2/P3 oznaczają proponowaną kolejność, nie zmianę
klasyfikacji istniejących ticketów. Odwołania do zewnętrznych projektów opisują
zależności Taskand; nie zastępują audytu całej floty.

<!-- docs:section non_goals -->
## Poza zakresem

Ten dokument nie wdraża runtime, nie czyta sekretów, nie włącza obserwatorów,
nie zmienia limitów ani protected checks i nie przyznaje zgody na efekty.
Nie otwiera nowych repozytoriów i nie powiela szczegółowych planów E/F.

<!-- docs:section evidence -->
## Dowody i ograniczenia obserwacji

Bazą jest commit `0f9df49f33d6cd85006fe4e41378f06b7347d7dd`, historia scalonych
PR oraz wskazane plany i źródła. PR #16 scalono jako
`a58a2db13c0f97005c452083f437cddee47e44dc`, a PR #14 jako
`2b160182ac1f6314a04e2ea63062fbd4a4739d9e`.
Stan ticket-016 jest obserwacją lokalnego intentu, nie publicznym receipt.

Przy pisaniu nie powtarzano pełnej macierzy runtime, testów RPi ani płatnego
LLM. Nie zmierzono bieżącej instancji. Historyczne wyniki diagnostyki
43/43 i 16 590 / 15 507 / 17 211 ms są opisane w
[raporcie F-02](../analysis/diagnostic-recovery.md), nie są nowym benchmarkiem.
Nie ma tu dowodu, że Taskand/Koru wykonuje cały proces szybciej niż agent LLM.

<!-- docs:section target_design -->
## Docelowy podział

Taskand pokazuje stan i proponuje kolejne kroki; deterministyczne kontrolery
obsługują kolejkę, deduplikację, retry i receipts. OneDev wykonuje testy,
niezależny Validator ocenia dokładny HEAD, a chroniony proces publikuje.
Standardy wellmanifest definiują kontrakty i diagnostykę; runtime narzędzi
pozostaje u właścicieli `semcod/*` lub `subactor/*`. MCP jest transportem
dostępu do zdolności, nie dowodem kompletności automatu ani źródłem uprawnień.

<!-- docs:section migration -->
## Kolejność pozostałych prac

| Priorytet / etap | Co pozostało | Następny wynik i warunek odbioru |
| --- | --- | --- |
| P1 — F-04 | Zweryfikować aktualny runtime, dane i możliwość bezpiecznego przełączenia | Obserwacja SHA/digest gateway i HTML; test snapshotu na kopii; canary; dopiero uprawnione przełączenie, test 401/403, kontekstu, grafu i odczytowego promptu; przetestowany rollback |
| P1 — portable runtime / ticket-016 | Dokończyć osobny profil obrazu i pakowanie | Start bez instalowania pakietów, host network i Docker socket; non-root/read-only, trwały kontekst, sekrety poza obrazem; test czystej instalacji i jawna lista wspieranych platform |
| P1 — F-01 / dostawa | Utrzymać zgodny stan ticket/lease/PR/receipt po sukcesie i awarii | Powtórzona operacja nie tworzy drugiego efektu; zmiana HEAD/base unieważnia zależne dowody; terminalny receipt zwalnia rezerwację; nie zamykać przez commit samych nośników śledzenia |
| P2 — adopcja standardów | Zastąpić ręczne poprawianie kolejnych wersji kontrolowanym updaterem | Inventory pinów → plan zgodności/diff → test migracji → niezależna publikacja → readback; idempotencja, wersjonowane recepty i rollback; LLM tylko dla nierozstrzygniętych przypadków |
| P2 — E-01, F-02 / limity | Zmierzyć całą ścieżkę i rozszerzać adaptację na podstawie dowodów | Baseline/candidate na tych samych fixtures; ukończone zadania/czas, pierwszy komunikat, kolejka, błędy, koszt; lepszy wynik bez utraty pokrycia, konfliktów writerów i przekroczenia budżetu rodzica |
| P2 — F-05, E-02 | Ujednolicić manifesty procesów i pakiety MJS/Python | Zamknięte schematy I/O/błędów/stanów, URI/URN/version/hash, generowane kontrakty plannera; dwa konsumery, czysta instalacja i negatywne testy niezgodności |
| P2 — F-06 | Domknąć kontrolę efektów na każdej ścieżce | Chat, CLI, registry, healing i zdalne wykonanie wymagają zgodnego planu, pokrycia twin i właściwego grantu; timeout po wysłaniu daje OUTCOME_UNKNOWN i readback, nie ślepy retry |
| P2 — F-10, E-06 | Dokończyć nadzorcę i operacyjną kolejkę | Jeden taskId, jawne source/CI/review/release/deploy, freshness/UNKNOWN, nextAction; bez duplikatów po restarcie i bez samodzielnego approval; benchmark Taskand/Koru na jednakowych scenariuszach |
| P3 — F-07/F-08 | Rozszerzać modele i odebrać pilot federacji | Reużywalne wersje twin z provenance/coverage; osobno ARM64, tożsamość peerów, odłączenie/restart/reconnect i rzeczywisty round-trip nvidia ↔ maskfleet5 |
| P3 — F-09 | Uruchamiać rzeczywiste obserwatory dopiero po kwalifikacji | Jawny owner/scope/zgoda/retencja/redakcja, start/pause/end; brak haseł, cookies i niejawnego łączenia tożsamości; syntetyczny normalizator nie zamyka kryterium live |
| P3 — F-11, E-09 | Kontrolowane uczenie, naprawy i aktualizacje offline | Incydent → regresja → ograniczona recepta → twin → review → artefakt → canary → pomiar/rollback; skończone próby, brak resetowania budżetu przez kolejne sesje |

Portable runtime i przygotowanie odbioru F-04 mogą postępować rozłącznie;
nie uzależniać naprawy lokalnego czatu od przebudowy całego ekosystemu.
Rozszerzona autonomia wymaga wcześniej F-05/F-06.

### Zależności poza Taskand

- [new-project #357](https://github.com/wellmanifest/new-project/issues/357)
  pozostaje otwarte w obserwacji: audyt po merge nie powinien udawać nowej
  dostawy przez sztuczny diff `project/TICKETS.md`. Potrzebne regresje dla
  no-change/terminal receipt bez osłabienia odmowy rzeczywistego carrier-only PR.
  Nie traktować tej luki jako dowodu, że każda publikacja Taskand jest zablokowana.
- Automatyczna adopcja i zgodność snapshot-migration: właściciel
  wellmanifest/new-project oraz istniejące przekazania
  [EXT](external-dependencies-handoff.md). Ponownie sprawdzić ich aktualny stan;
  historyczny opis zaległej migracji/PR nie jest poleceniem powtórzenia merge.
- wellmanifest/goal: rozliczyć kryteria formalizacji istniejących reguł Goal,
  przypięcie przez konsumentów i podział do istniejących właścicieli standardów.
  Samo publiczne repo nie potwierdza kompletności ani adopcji; pełnego odbioru
  tego zewnętrznego zakresu nie weryfikowano przy niniejszym podsumowaniu.
- OneDev/Validator: potwierdzić wdrożony profil automatycznej kolejki, retry i
  odzyskiwania po restarcie. Scalone PR dowodzą działającej ścieżki publikacji,
  nie automatyzacji każdego repo. Integracje semcod/Koru/autogrammar MCP oceniać
  przez wykonanie ograniczonego scenariusza, nie samo `tools/list`.
- wellmanifest/docs: uzgodnić opublikowany format i jego adopcję w CI.
  Ten dokument stosuje v1 z docs 0.1.1, rewizja
  `ebe7501063ef4f3e63ded610c2d3183010ca636e`; istniejące pliki v2 w
  `docs/REFACTORING/` pozostają pilotem. Nie zmieniono ich ani pinów standardu.

<!-- docs:section acceptance -->
## Kiedy uznać pozostały etap za zakończony

Każdy etap ma właściciela, mały intent, niezmienny zestaw wejść, wynik testu,
stan publikacji i brakujące kryteria. `MERGED`, `RELEASED`, `DEPLOYED` oraz
`VERIFIED` są osobne. Otwarte pytanie lub nieznany wynik nie jest zaliczonym
kryterium. Odbiór produktu korzysta z
[pytań po wdrożeniu](../information/post-deployment-validation-questions.md).

<!-- docs:section validation -->
## Testy i pomiary

Dla tego podsumowania: checker opublikowanego docs 0.1.1 dla nowego dokumentu,
indeks i linki lokalne, `git diff --check` oraz zarządzany governance gate.
Walidacja tego pliku nie oznacza zgodności całego historycznego katalogu docs.

Wynik lokalny: governance PASS (0 błędów/ostrzeżeń), linki i whitespace PASS,
konfiguracja Compose poprawna (historyczne ostrzeżenie o polu `version`).
Checker docs sprawdził nowy dokument bez nowych findingów. Pełny audyt pozostaje
FAIL: te same 5 findingów występuje na bazowym main — adopcja `docs.json`,
placeholder w `diagnostic-recovery.md` i metadane w `digital-twin.md`,
`complementary-runtime.md`, `instance-network.md`. Ich naprawa/adopcja wymaga
osobnego zakresu; nie wyłączono żadnej kontroli.

Przy publikacji porównać findings z dokładną bazą PR. Brak nowych findingów
nie jest pełnym PASS docs i nie uprawnia do obejścia chronionego review.
Naprawę odziedziczonych problemów zacząć od opublikowanego checkera oraz
zgodnego pinu adopcji; dopiero potem migrować wskazane metadane. Nie poprawiać
poprawnych przykładów JSON wyłącznie pod błędne rozpoznawanie placeholderów.

Dla implementacji uruchamiać właściwe testy context/mesh/observers, snapshot,
auth canary, registry/contracts/negative, izolowaną integrację i twin.
Nie uruchamiać mutujących fixtures przeciw aktywnemu runtime. Wymagany test
przeglądarkowy bez browsera ma odmówić, nie dać pozornego PASS.
Budżet może zmienić się w zaakceptowanym zakresie po pomiarze; nie może
wyłączyć testów, zwiększyć uprawnień ani ukryć konfliktu lub niedotrzymanego SLA.

<!-- docs:section rollback -->
## Wycofanie

Dokument można wycofać niezależnie od implementacji. Adopcja wybiera poprzedni
zweryfikowany pin przez obsługiwany mechanizm. Runtime wymaga osobnego planu
powrotu artefaktu i danych; nie nadpisywać nowszego deploymentu ani usuwać
unikalnych snapshotów przy sprzątaniu Git.

<!-- docs:section risks -->
## Ryzyka

Największe: pomylenie merge z wdrożeniem, powielanie zakończonych prac z dawnych
planów, mnożenie standardów zamiast małych dostaw, ukrywanie błędu zwiększonym
timeoutem oraz równoległe przejęcie cudzych ścieżek. Przed działaniem ponownie
odczytać Git/PR/receipt i aktywny intent. To datowane podsumowanie, nie żywy status.

<!-- docs:section ownership -->
## Odpowiedzialność i najbliższy krok

Taskand odpowiada za produkt, testy i adaptery; właściciele standardów za
kontrakty/checkery, a OneDev/Validator za swoje chronione procesy. Niezależne
review pozostaje poza wykonawcą. Najbliższy krok wykonawczy: odczytać wynik
ticket-016 i bieżący runtime, następnie wybrać jeden brakujący warunek F-04.
Szczegóły dalszego pakowania, offline, onboardingu i wydajności są w
[indeksie planów tematycznych](../README.md), bez tworzenia drugiej specyfikacji.
