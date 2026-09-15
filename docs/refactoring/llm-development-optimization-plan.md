---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "llm-development-optimization-plan",
  "kind": "refactoring-plan",
  "version": 1,
  "title": "Plan optymalizacji developmentu z LLM i ekosystemem Taskand",
  "status": "proposed",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-15",
  "updated": "2026-09-15",
  "review_after": "2026-09-22",
  "source_revision": "bc7d54d0ca92a9e2a832ab3b73d709a116302dd3",
  "affected_repositories": [
    "semcod/taskand-glm53"
  ],
  "evidence": [
    "repo://semcod/taskand-glm53/docs/refactoring/external-dependencies-handoff.md",
    "https://github.com/subactor/docs/issues/196",
    "https://github.com/semcod/planfile/issues/89",
    "https://github.com/subactor/onedev-agent/pull/342",
    "https://github.com/semcod/goal/pull/155"
  ]
}
---

# Plan optymalizacji developmentu z LLM i ekosystemem Taskand

<!-- docs:section goal -->

| Metadana | Wartość |
| --- | --- |
| Data | 2026-09-15 |
| Status | Propozycja robocza, nie wdrożona polityka ani raport gotowości floty |
| Zakres | Lokalny plan konsumenta Taskand, wykorzystujący obserwacje współpracy z Koru, Goal, Planfile, OneDev, Validator i Wellmanifest |
| Proponowany właściciel planu przekrojowego | `subactor/docs`; implementacje u właścicieli narzędzi |
| Istniejący punkt koordynacji | [subactor/docs#196](https://github.com/subactor/docs/issues/196) |
| Lokalizacja docelowa po przyjęciu | Dokument refaktoryzacyjny w `subactor/docs`, z indeksem według przyjętego kontraktu Docs |
| Ograniczenie | Ten plik jest trwałym lokalnym draftem; nie został dodany do Git, opublikowany ani zwalidowany checkerem Docs |

## 1. Wniosek i cel

Największą potencjalną poprawę dla Taskand daje przeniesienie **powtarzalnych operacji z rozmowy do istniejących, testowanych kontrolerów**, a nie samo użycie szybszego modelu. Zewnętrzne repozytoria zachowują własność swoich kontraktów i otrzymują osobne zadania; ten dokument nie jest przekrojowym raportem floty.

LLM powinien przede wszystkim rozumieć problem, zaprojektować ograniczoną zmianę i ocenić niejednoznaczne wyniki. Nie powinien przy każdym wznowieniu od nowa odkrywać interpretera, szukać ticketów, rekonstruować konfiguracji CI, przepisywać hashy ani ręcznie sprawdzać kilkunastu identycznych mapowań.

Optymalizujemy czas do **zaakceptowanego wyniku użytkowego** i koszt jego utrzymania. Liczba zamkniętych ticketów, commitów, zielonych komunikatów CLI lub wygenerowanych dokumentów nie jest samodzielną miarą sukcesu.

Nie proponujemy usuwania ochrony historii, izolacji, testów ani niezależnego review. P1/P2 nie mają blokować ukończenia obecnych prac P0. Najpierw audyt aktualnych możliwości, potem adopcja albo udokumentowane `NO_CHANGE`, dopiero na końcu brakująca implementacja.

<!-- docs:section current_state -->
## 2. Dowody z sesji i granice diagnozy

Poniższe fakty pochodzą z odczytów wykonanych w sesji. Nie są nowym audytem dzisiejszego stanu wszystkich repozytoriów.

| Obserwacja | Wniosek, którego wolno użyć |
| --- | --- |
| OneDev PR #342 został scalony jako `9b5251a8f40cca27d4ab544fe70770b4936fc7c2` | Naprawa łańcucha przypięć weszła do źródeł; nie dowodzi to aktywacji obrazu |
| Goal PR #155 został scalony jako `ad8f1253d0168e0b7d4fa069ecab2a3017edb660` | Wznowienie nie powinno ponownie próbować publikować tego samego PR |
| Obraz-kandydat `sha256:082520666007230cc0046122c2de51938dad8c335cfa56a3f7977507355d62d5` zbudował się i przeszedł próbę zależności | Był lokalnym kandydatem, nie potwierdzonym wydaniem lub wdrożeniem |
| Pełne próby obu wersji Pythona zakończyły się kodem 3 przed testami; wykonywalny skrypt governance znajdował się na `noexec` | Błąd przygotowania próby przez agenta, nie wykazana regresja Goal; nie wolno liczyć tej próby jako zaliczonego zestawu |
| Różne listy plików Compose wskazywały ten sam obraz; override ustawiał tylko obraz | Różnica deklaracji nie dowodzi różnicy efektywnej konfiguracji ani potrzeby rollbacku |
| Trzy sprawdzone piloty miały referencje do issues, ale brak konfiguracji GitHub i `integration=null` | Referencja/projekcja nie jest dowodem synchronizacji |
| Zainstalowany Planfile 0.1.124 przechwytuje błędy poszczególnych synchronizacji; warstwa CLI może dalej zgłosić zakończenie | Potrzebne są jednoznaczny wynik operacji i readback; nie wystarczy kod procesu lub zielony komunikat |
| Przez SDK Planfile i jego adapter potwierdzono 17 mapowań w 16 repozytoriach: 10 nowych issues, 7 uzupełnionych | Ten konkretny przebieg zadziałał; nie dowodzi odporności na równoległych writerów, awarie i dowolne kolejne wznowienie |

<!-- docs:section evidence -->
Dowody i handoffy:

- [Indeks issues](https://github.com/subactor/docs/issues/196), [OneDev #342](https://github.com/subactor/onedev-agent/pull/342), [Goal #155](https://github.com/semcod/goal/pull/155).
- [Odczyty synchronizacji i hashe treści](./results.json), digest zapisanego zestawu: `b66e4be9c080dbed6e77907af9c4d08b7cec07ca8a157d020dc85b17088f307b`.
- Handoff obrazu-kandydata: `private-recovery://onedev-goal-pin-deployment-20260914/candidate-9b5251a8/candidate-handoff.json`.
- Klasyfikacja nieudanej próby testów: `private-recovery://onedev-goal-pin-deployment-20260914/candidate-9b5251a8/full-goal-canary/result.json`, digest logu: `c88878818201df9bb0cedf003f8eaefa2aa2d6c2d0de970aff5b75d50769fa23`.

Nie wykonano pełnego pomiaru czasu, kosztu tokenów ani porównywalnego eksperymentu przed/po. Procentowe cele poniżej są propozycjami, nie wynikami.

<!-- docs:section scope -->
## 3. Co warto zachować

- Rozdzielenie autora, CI, niezależnego review i chronionego merge.
- Przypinanie dokładnych źródeł, wejść i obrazów oraz zachowanie historii.
- Reuse istniejących issues zamiast tworzenia kolejnych kopii tego samego zamiaru.
- Realny readback GitHub oraz projektowe mapowania Planfile.
- Oddzielenie canary środowiska od testu produktu i aktywacji usługi.
- Kontynuowanie rozłącznych prac bez uzależniania lokalnego czatu od całej federacji.

<!-- docs:section non_goals -->
## Granice planu

Plan nie zmienia kodu aplikacji ani bieżącego runtime, nie nadaje uprawnień
do merge, deployu lub sekretów i nie zastępuje istniejących standardów.
Nie przenosi surowych logów, prywatnych receiptów ani pełnych transkryptów
do repozytorium. P1/P2 nie stają się automatycznie bramkami P0.

<!-- docs:section target_design -->
## 4. Problemy i działania o największej wartości

| ID | Priorytet | Problem | Proponowana zmiana | Właściciel / istniejący punkt pracy |
| --- | --- | --- | --- | --- |
| OPT-01 | P0 | Wznawianie rozmowy wymaga ręcznej rekonstrukcji stanu; PR może być już scalony | Jeden odczytowy pakiet wznowienia: aktualny zamiar, ticket, zakres, worktree, lease, PR/head/base, receipts i `nextAction`; przed skutkiem świeży odczyt | Goal [#161](https://github.com/semcod/goal/issues/161), Planfile [#89](https://github.com/semcod/planfile/issues/89), Validator [#497](https://github.com/subactor/validator-agent/issues/497) |
| OPT-02 | P0 | Lokalny ticket lub zakończenie CLI wygląda jak skuteczna publikacja | Wynik każdego elementu: potwierdzony, oczekujący, błąd lub nieznany; trwały outbox i niezależny readback | Planfile #89 |
| OPT-03 | P0 | Kosztowny test startuje w niezgodnym środowisku | Tani preflight dokładnego runnera: interpreter, importy, piny, prawa wykonania, mounty, limity i wymagane pliki; potem pełna próba | OneDev [#322](https://github.com/subactor/onedev-agent/issues/322), [#304](https://github.com/subactor/onedev-agent/issues/304) |
| OPT-04 | P0 | Przyjęte źródło, zbudowany obraz i uruchomiona usługa mają różne stany | Jedna kontrolowana promocja kandydata z właścicielem wdrożenia, porównaniem efektywnej konfiguracji, stanem kolejki i sprawdzonym rollbackiem | OneDev; nie nowy publikator w Taskand |
| OPT-05 | P1 | Za dużo operacyjnych wywołań LLM i ponownego odkrywania CLI | Rejestr możliwości istniejących adapterów, strukturalne wyniki i ograniczone pakiety kontekstu; LLM pracuje na różnicy stanu | Goal, Koru i właściciele adapterów |
| OPT-06 | P1 | Częste aktualizacje standardów angażują autora każdej aplikacji | Przypięte, zgodne zestawy standardów, jawne migracje i chroniony updater wykorzystujący istniejący kontroler adopcji | New Project, Goal, Koru |
| OPT-07 | P1 | Długie oczekiwanie na CI/review i częsty polling | Trwała kolejka, zdarzenia, watchdog i ograniczony polling awaryjny z właścicielem zastoju | Koru, Planfile, Validator #497 |
| OPT-08 | P1 | Limit plików mylony z limitami diffu i API | Kontrakt możliwości per provider, endpoint, wersja i operacja; dowód kompletności pobranego materiału | Git lifecycle [#17](https://github.com/wellmanifest/git-lifecycle/issues/17), Validator |
| OPT-09 | P1 | Rozproszone plany, indeksy i lokalne skrypty operacyjne | Jeden raport przekrojowy, powiązane plany właścicieli, generowany indeks; trwałe funkcje przenoszone do właściwego produktu | [subactor/docs #196](https://github.com/subactor/docs/issues/196), Docs, Report, Logs |
| OPT-10 | P2 | Nie wiadomo, czy bardziej kosztowny model lub agent poprawia wynik | Mały zestaw ocen z incydentów sesji; dobór modelu do rodzaju zadania i ryzyka na podstawie pomiarów | Właściciel orkiestracji LLM; wykonanie w Koru/Taskand zgodnie z przyjętym podziałem |

`OPT-*` to identyfikatory sekcji tej propozycji, nie nowe tickety ani zarejestrowane operacje. Tabela nie rozszerza automatycznie istniejących intentów.

## 5. Docelowy podział odpowiedzialności

| Element | Odpowiedzialność | Czego nie powinien przejmować |
| --- | --- | --- |
| Taskand | Intencja użytkownika, DSL, zależności, bliźniak i ocena wyniku użytkowego | Klucze merge i drugi kontroler publikacji |
| Koru | Kolejka, przydział pracy, priorytety, ograniczenia równoległości i wznowienie zadania | Uznawanie propozycji LLM za zgodę na skutek |
| Planfile | Tożsamość intake, projekcja i synchronizacja trackerów, stan dostawy | Dowolne nadpisywanie scope lub zgód z danych GitHub |
| Goal | Kontrolowane operacje workspace/commit/push/PR oraz transakcja adopcji | Niezależny review własnej zmiany |
| OneDev | Przypięte środowisko i faktyczne wykonanie wymaganych sprawdzeń | Zgoda na merge lub dowód wdrożenia produktu |
| Validator | Chronione rozstrzygnięcie na podstawie bieżącego subjectu i wymaganych dowodów | Zaufanie do repozytoryjnej samodeklaracji PASS |
| Wellmanifest | Małe, wersjonowane kontrakty, semantyka i conformance | Hosting kolejnego produktowego demona w repo standardu |

Wspólna operacja `deliver` może być wygodnym wejściem użytkowym, ale powinna komponować te adaptery, a nie duplikować ich stan i logikę. Nazwa jest propozycją interfejsu, nie twierdzeniem o istniejącym produkcyjnym poleceniu.

Najpierw trzeba uzgodnić jeden authority/ownership map. Rejestr zdarzeń nie zastępuje kontrolera skutku, a koperta receipt nie staje się zaufana przez samą zgodność ze schematem.

## 6. Standard pracy agenta: mniej operacji, lepszy kontekst

1. Na początku pobrać jeden ograniczony pakiet wznowienia. Oddzielić trwały zamiar od obserwacji, które już wygasły. Czytać aktualny status PR przed retry publikacji.
2. Przed eksploracją wyznaczyć zakres plików i pytania, na które trzeba odpowiedzieć. Łączyć zgodne odczyty; nie przeglądać całych repozytoriów bez potrzeby.
3. Używać identyfikacji runtime narzędzia: rzeczywista ścieżka CLI, jego interpreter, wersja pakietu i obsługiwane możliwości. W sesji systemowy Python nie importował Planfile, choć CLI działało w innym środowisku; zgadywane pole `baseRefOid` także nie działało w dostępnym `gh`.
4. Utrzymywać mały indeks przeczytanych plików i ich rewizji. Przyszła polityka powinna jasno określać, kiedy zmiana digestu lub błąd uprawnia do ponownego odczytu. Nie wolno wprowadzać tego wyjątku wbrew bieżącym instrukcjom.
5. Wykonywać małe, spójne porcje zmian. Najpierw test środowiska i regresja bliska zmianie, potem pełne bramki wymagane dla skutku. Nie zastępować pełnego CI samym zestawem selektywnym.
6. Zamiast wielu krótkich pętli `wait` preferować oczekiwanie na zmianę stanu. Raportować użytkownikowi materialny postęp, nowy blokujący warunek lub potrzebną decyzję, nie sam upływ kilku sekund.
7. Diagnostyka ma zwracać od razu zredagowane: klasę błędu, operację, kod/errno, bezpieczny kontekst ścieżki, subject i odnośnik do logu. Samo `PermissionError` było zbyt mało użyteczne i wymusiło kolejną eksplorację.
8. Rozdzielać autoryzację zadania od zaufanego approval publikacji. W przyszłych regułach rutynowa korekta własnego harnessu w zaakceptowanym zakresie powinna mieć jasną ścieżkę; zmiana izolacji, cudzych danych lub wdrożenia nadal wymaga właściwej decyzji. Obecne ograniczenia pozostają wiążące.
9. Po błędzie własnym wskazać przyczynę i granice dowodu. Nie przenosić diagnozy na produkt i nie zwiększać timeoutu bez pomiaru.
10. Na granicy etapu zapisać krótki checkpoint: wynik, dokładny subject, brakujące kryteria, właściciel i najmniejszy następny krok. Pełna rozmowa nie powinna być obowiązkowym wejściem kolejnego agenta.

Delegowanie ma sens tylko dla niezależnych zakresów, gdy jest dozwolone. Koszt przekazania kontekstu i konfliktów może przewyższyć zysk z równoległości. W pilocie: jeden writer integracyjny i najwyżej jeden niezależny tor infrastruktury.

## 7. Konkretne wymagania techniczne

### 7.1. Synchronizacja i niepewny wynik

Planfile powinien posiadać trwały rekord zamiaru przed zewnętrznym zapisem, projektowy klucz deduplikacji oraz powiązanie backend/repo/local ID/remote ID. Migracja dawnych pól `issue` do obsługiwanego mapowania `id` musi zachować pochodzenie i zweryfikować repozytorium.

Po timeoutie zapis ma stan nieznany, dopóki readback nie ustali skutku. Lista issues, a następnie POST, nie zapewnia atomowej deduplikacji dwóch writerów. Potrzebny jest serializowany kontroler kooperujących zapisów i test awarii między efektem a lokalnym zapisem. Nie deklarować gwarancji exactly-once, której backend nie zapewnia.

Aktualizacja istniejącego issue ma zachować cudzą treść i pola. Sam odczyt przed i po zapisie nie dowodzi ochrony przed utraconym równoległym zapisem. Przyjąć kontrakt własności fragmentu, obsługę konfliktu i warunkowy zapis tam, gdzie provider go wspiera. Zredagowane błędy i `sync_pending` muszą być widoczne w CLI/API.

Prywatny skrypt wykorzystany w tej sesji był ograniczonym wywołaniem SDK i dodatkowym readbackiem, nie gotowym daemonem ani atestacją. Powtarzalny mechanizm należy przenieść do testowanej funkcji Planfile, zamiast wymagać kolejnego skryptu od LLM.

### 7.2. Środowisko i promocja

Preflight ma sprawdzić nie tylko obecność binarek, lecz także możliwość wykonania obowiązkowego skryptu w rzeczywistym katalogu roboczym. Wymagania katalogu wykonywalnego i katalogu danych powinny być osobne. `exec` i `noexec` są jawnymi opcjami mountów; `noexec` nie jest kompletnym sandboxem dla interpretowanego kodu. [Docker: tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/).

Nie naprawiać próby przez `--privileged`, montowanie HOME lub automatyczne osłabienie izolacji. Wybrany profil ma wykazywać wymagane blokady sieci/plików, sprzątanie potomków, limity CPU/RAM/PID i wspólny deadline. Własna próba środowiska nie zastępuje wymaganych testów aplikacji.

Przypięcia dependency manifests, instalatora, preparatora i checkera powinny pochodzić z jednego kontraktu. Ten fragment poprawiono już w OneDev #342: należy dokończyć kwalifikację i adopcję, nie wdrażać go drugi raz. Kandydat nie może sam wybierać dowolnego checkera ani obrazu bramki.

### 7.3. Cache i aktualizacje standardów

Cache obejmuje tylko deterministyczny wynik dla jawnie zamkniętego zbioru wejść: working tree i indeks, używane pliki nieśledzone, head/base/merge-base, intent, polityka, lock, polecenia, interpreter, obraz i istotna konfiguracja. Klucz powinien powstawać automatycznie; cache hit ma wskazywać oryginalny dowód.

Nie cache'ować zgody, lease, freeze, zewnętrznych checks ani stanu zdalnego przed skutkiem. Nie utrzymywać PASS po materialnej zmianie subjectu.

Adopcja standardów powinna korzystać z przypiętego zestawu zgodnych wersji, jawnych migracji, dry-runu i kontrolowanego PR. Proponowane kanały stabilny/pilot oraz okno kompatybilności wymagają decyzji właścicieli. Aktualizacje bezpieczeństwa mają osobną ścieżkę pilną; nie wolno zamrażać wadliwej wersji tylko dla wygody.

Pre-commit sprawdza lokalny pin i nie pobiera aktualizacji. Updater odpowiada za świeżość, grupowanie kompatybilnych zmian i rollout etapami. Nie zwiększać globalnych limitów ani masowo aktualizować wszystkich adopterów.

### 7.4. API, kolejka i kompletność review

Webhooki powinny budzić trwały rekord pracy, a ograniczony reconciler naprawiać utracone zdarzenia. Webhook wymaga weryfikacji i deduplikacji; sam nie jest zgodą na skutek. GitHub zaleca ograniczanie pollingu, warunkowe odczyty oraz respektowanie `Retry-After`. [GitHub: REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

Limity trzeba opisywać per endpoint i operacja. GitHub dokumentuje dla listy plików PR maksimum 3000 plików; to nie jest limit zwykłego diffu ani budżet governance. Historyczne HTTP 406 z komunikatem o 20 000 liniach pozostaje obserwacją konkretnej próby. [GitHub: list pull request files](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files).

Fallback do Git musi dowieść kompletnego zbioru zmian i dokładnego subjectu, z uwzględnieniem usunięć, rename, plików binarnych i obciętych odpowiedzi. Przekroczenie budżetu kontekstu modelu wymaga jawnego podziału review i rejestru pokrycia, a nie przemilczenia reszty diffu.

## 8. Organizacja, dokumentacja i standardy

- Jedna osoba lub kontroler odpowiada za domknięcie danej dostawy. Oczekiwanie na obcy check ma właściciela zależności, termin kolejnego odczytu i warunek eskalacji.
- Zakończenie pisania kodu zwalnia niepotrzebną rezerwację edycji, ale nie zamyka nierozliczonego zamiaru publikacji. Wznowienie wymaga bieżącego lease/fencing zgodnie z kontraktem.
- Intenty, README, plany, issues i wykresy są powiązane, nie kopiowane jako konkurujące źródła prawdy. Każde pole ma właściciela; synchronizacja nie stosuje bezwarunkowego last-write-wins.
- Przyjęcie nowego standardu wymaga oceny kosztu adopcji i kompatybilności z pozostałymi pakietami, nie tylko testów jego własnego repozytorium.
- Rozbieżne instrukcje hostów i agentów powinny powstawać z jednego przyjętego kontraktu. Zmiany reguł są wersjonowane; nie negocjuje się ich od nowa w każdym komunikacie `kontynuuj`.
- Reguły dla odczytu, lokalnej edycji, testów, publikacji, dostępu do sekretów i wdrożenia mają być odrębne. Cache rozmowy nie zastępuje żadnej z tych granic.
- Jeden indeks przekrojowy pozostaje w `subactor/docs`. Docs/Report określają miejsce i cykl dokumentu, Logs dowody surowe, New Project powiązanie z intentem. Nie tworzyć nowego standardu tylko dlatego, że trudno odnaleźć istniejący.
- Trwały plan musi docelowo trafić do wersjonowanego miejsca. Ten draft nie omija publikującego się ticketu-014 Taskand ani nie rozszerza jego `allowedPaths`; właściciel `subactor/docs` ma go przyjąć w swoim zakresie i zaindeksować.

### Granica adopcji tego planu

Ten commit publikuje treść planu i jej lokalny indeks, ale nie deklaruje adopcji
polityki Docs w `.governance`. Taka adopcja musi pozostać osobnym, przypiętym
zakresem: najpierw odczyt źródłowej rewizji i digestu polityki, następnie
walidacja zgodności oraz chroniony PR właściciela adopcji. Do czasu terminalnego
receiptu brak wpisu adopcyjnego oznacza `UNADOPTED`, a nie błąd tego planu ani
zgodę na używanie go jako runtime policy.

<!-- docs:section validation -->
## 9. Mierniki i eksperyment

W pierwszej fazie zebrać baseline z 5-10 porównywalnych zadań, potem pilot na 10 kolejnych. Przy tak małej próbie publikować medianę, maksimum i surowe liczności, nie pozornie precyzyjne p95 ani twierdzenia o istotności statystycznej. Oddzielać zimny/ciepły cache, typ zmiany, rozmiar diffu, profil CI i architekturę.

| Miernik | Sposób liczenia | Proponowany cel pilota |
| --- | --- | --- |
| Czas wznowienia | Od przyjęcia zadania do pierwszej poprawnej materialnej akcji | Mediana krótsza o 50% wobec porównywalnego baseline |
| Narzut operacyjny | Czas narzędzi i interwencji niezwiązanych z implementacją/testem koniecznym dla zakresu | Redukcja o 30%, bez pomijania dowodów |
| Koszt kontynuacji | Tokeny wejścia/wyjścia, koszt modelu i liczba wywołań narzędzi na zaakceptowane zadanie | Mniejszy koszt przy zachowanej jakości; próg po baseline |
| Kolejka kontra wykonanie | Osobno oczekiwanie, praca agenta, CI, review i publikacja | Każdy zastój ma widoczny powód i właściciela |
| Dublowane kontrole | Powtórzenie deterministycznej bramy dla identycznego pełnego subjectu | Zero nieuzasadnionych powtórzeń w jednej transakcji |
| Fałszywy sukces | Zgłoszony sukces bez wymaganego skutku/dowodu | Zero; naruszenie zatrzymuje promocję pilota |
| Wierność synchronizacji | Poprawne repo/ID/treść/mapowanie po readback | 100% potwierdzonych pozycji; reszta jawnie pending/unknown |
| Jakość dostawy | Regresje po przyjęciu, odrzucenia review, rework i awarie wdrożenia | Brak pogorszenia; krytyczna regresja zatrzymuje rollout |
| Błędy harnessu | Próby niewykonujące testów z powodu przewidywalnych braków środowiska | Zero dla pokrytych preflightem przypadków |

Nie optymalizować przez usuwanie trudnych zadań z próby, obniżanie zakresu testów, zwiększanie limitów autonomii ani liczenie `UNKNOWN` jako sukcesu. Rejestrować również nieudane i odrzucone próby.

<!-- docs:section migration -->
## 10. Kolejność wdrożenia

1. **Pierwszy etap: domknąć aktualny P0.** W OneDev #322 poprawnie zakwalifikować harness i kandydata; osobno rozliczyć bramki i wdrożenie. W Planfile #89 przygotować regresję fałszywego sukcesu i minimalny kontrakt wyniku. Bez przebudowy floty.
2. **Drugi etap: jeden pilot wznowienia.** Na jednym projekcie sprawdzić Planfile -> Goal -> istniejący Validator: restart, timeout po skutku, zmiana head/base oraz brak uprawnień. Koru ma użyć tych operacji, nie otrzymać drugiej implementacji publikacji.
3. **Trzeci etap: eliminacja powtarzalnego narzutu.** Dodać odczytowy pakiet wznowienia, profil capabilities, strukturalną diagnostykę i bezpieczny reuse walidacji. Porównać mierniki z baseline.
4. **Czwarty etap: stabilne adopcje.** Przyjąć macierz kompatybilności i pilotaż updatera standardów. Rozszerzać kohorty dopiero po zgodnych wynikach i sprawdzonym rollbacku.
5. **Dalsza optymalizacja LLM.** Ocenić routing modeli i dozwolone delegowanie na zapisanych przypadkach. Proste odczyty/klasyfikacje powinny być deterministyczne, trudny projekt i review otrzymać właściwy budżet. Żaden model nie staje się trust root.

Minimalny zestaw regresji pilota: utrata odpowiedzi po utworzeniu issue; dwóch writerów; wrong-repo mapping; zmiana HEAD po teście; PR już scalony podczas wznowienia; brak interpretera; `noexec`; timeout z potomkami; utracony webhook; niepełny diff; sekret lub instrukcja w logu. Testy mają używać fixtures, nie prawdziwych sesji i danych produkcyjnych.

<!-- docs:section acceptance -->
## 11. Odbiór i warunki zatrzymania

Odbieramy osobno implementację kontraktu, opublikowany artefakt i aktywny runtime. Krótszy czas developmentu nie kompensuje gorszej jakości lub osłabienia kontroli.

Pilot zostaje zatrzymany przy utracie danych, sekrecie w publicznym wyniku, fałszywym PASS, nieautoryzowanym skutku lub nieskutecznym rollbacku. Cofnięcie pilota przywraca poprzedni zaakceptowany artefakt; nie usuwa outboxu, receipts ani nierozliczonego zamiaru. Po nieznanym wyniku najpierw readback, nie ponowienie zapisu.

**Rekomendacja końcowa:** najpierw niezawodne wznowienie, prawdziwy wynik operacji i gotowe środowisko; potem cache, zdarzenia i automatyczna adopcja; dopiero później więcej agentów, większa autonomia i kolejne standardy. To zmniejsza liczbę decyzji operacyjnych oddawanych LLM bez odbierania kontroli człowiekowi i chronionym kontrolerom.

<!-- docs:section rollback -->
## Rollback

Wycofanie pilota przywraca poprzedni zaakceptowany artefakt i zachowuje
outbox, receipts oraz nierozliczony zamiar. Nie usuwa danych tylko dlatego,
że istnieje następca. Po nieznanym wyniku najpierw wykonuje się readback,
a dopiero potem ewentualnie powtarza operację zgodnie z jej idempotency key.

<!-- docs:section risks -->
## Risks

Największe ryzyka to fałszywy PASS po niepełnym odczycie, wyciek danych z logu,
niezgodna konfiguracja runnera, duplikat skutku po timeout oraz uzależnienie
P0 od przebudowy całej floty. Pilot zatrzymuje się przy utracie danych,
sekrecie w publicznym wyniku, nieautoryzowanym skutku lub nieskutecznym
rollbacku. Zmiana zewnętrznego stanu pozostaje osobno weryfikowana.

<!-- docs:section ownership -->
## Ownership

Taskand owns intent, DSL, twin and user-facing outcome. Koru owns queue and
execution scheduling. Planfile owns intake projection and tracker sync. Goal
owns controlled workspace/PR operations. OneDev owns pinned execution, while
Validator owns protected review and merge evidence. Wellmanifest repositories
own their respective contracts. `subactor/docs` owns the cross-repository
index; no owner is transferred by this document.
