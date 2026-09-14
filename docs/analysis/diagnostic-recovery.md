---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "diagnostic-recovery",
  "kind": "analysis",
  "version": 1,
  "title": "Taskand: krótsza diagnostyka, elastyczne budżety i stan dostawy",
  "status": "implemented",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-14",
  "updated": "2026-09-14",
  "review_after": "2026-09-21",
  "source_revision": "8b4e26a36824bef650042e2e1dc69018ebc6fc6a",
  "affected_repositories": ["semcod/taskand-glm53"],
  "evidence": [
    "repo://semcod/taskand-glm53/project/ticket-004/intent.json",
    "repo://semcod/taskand-glm53/tests/doctor_diagnostics.test.mjs",
    "repo://semcod/taskand-glm53/tests/isolated_integration.sh",
    "receipt:github:semcod/taskand-glm53:pull/3:merge/8b4e26a36824bef650042e2e1dc69018ebc6fc6a"
  ]
}
---

# Krótsza diagnostyka i sprawdzalna dostawa Taskand

<!-- docs:section question -->
## Pytanie

Czy Taskand może szybciej przechodzić od diagnozy do wdrożenia, zachowując
standardy jakości? Ten etap realizuje F-02 planu functional-recovery-plan oraz
lokalne uzgodnienie F-01. Nie jest ukończeniem pozostałych etapów produktu.

<!-- docs:section scope -->
## Zakres

Właścicielem implementacji i tego raportu jest Taskand. Zbadano wpływ dostępnych
narzędzi na jego konkretną ścieżkę dostawy. Pełny audyt floty pozostaje w
[subactor/docs](https://github.com/subactor/docs/blob/main/architecture/analysis/local-ci-adoption.md).
Nie zmieniano usług OneDev, standardów innych repozytoriów, prywatnych danych
ani aktywnego snapshotu produkcyjnego. Polecenia MCP nie uruchamiały LLM ani
mutujących narzędzi. Brak nowej zależności runtime.

<!-- docs:section method -->
## Metoda

Odczyt manifestu, aktywnych intentów i rzeczywistego PR #3; sprawdzenie resolvera
terminalnych receiptów; izolowana kopia publicznych źródeł z wyłączoną siecią,
bez .env i vault. Najpierw jeden pomiar starego kodu, potem trzy powtórzenia
niezmienionego zestawu 43 asercji. Osobne testy kontrolują granice czasu,
DNS, TCP, HTTP i procesy potomne. Pomiary nie są benchmarkiem statystycznym
ani testem wydajności produkcji.

<!-- docs:section evidence -->
## Wyniki

| Kontrola | Wynik lokalny |
| --- | --- |
| Integracja przed zmianą | 43/43, 19 435 ms; blisko istniejącego limitu 20 s |
| Integracja po zmianie | 43/43 w każdym z 3 przebiegów: 16 590, 15 507, 17 211 ms |
| Regresje diagnostyki | 13/13, zero pominięć na Linux |
| Konformacja / kontrakty procesów | 4/4 oraz 30/30 na izolowanych kopiach |
| Governance przed uzgodnieniem | 11 błędów starego ticket-001 |
| Resolver po odczycie PR i weryfikacji ancestry | ticket-001 inactive, authority=terminal-receipt |
| Governance nowego worktree | passed, 0 błędów, 0 ostrzeżeń |
| Chroniony Validator preflight | LOCAL_EXECUTOR_MISSING; publication_ready=false |

Średnia trzech nowych pomiarów to 16 436 ms, około 15% mniej od pojedynczego
pomiaru bazowego. Historyczne 25–26 s nie odtworzyło się w tej dokładnej
izolacji; nie przedstawiamy dawnych wyników jako nowego benchmarku.

Powtarzalne polecenia z worktree ticket-004:

```sh
node --test tests/doctor_diagnostics.test.mjs
bash tests/isolated_integration.sh 3
bash tests/isolated_integration.sh 1 conformance
bash tests/isolated_integration.sh 1 contracts
./project/governance-check.sh
```

Fixture jest usuwany po zakończeniu testu. Źródła, registry i genome aktywnego
runtime nie są celem testów. Testy HTTP pracują na własnych losowych portach.

<!-- docs:section facts -->
## Fakty i zmiana działania

Sondy usług oraz odczyty URI korzystają ze wspólnego deadline. Klient rejestru
jest asynchroniczny; wywołania nadal przechodzą przez istniejący broker z
weryfikacją statusu, bindingHash i grantów. Timeout na Linux kończy własną
grupę procesów, także potomków brokera. Stderr nie trafia do odpowiedzi.
Brak odpowiedzi, wadliwy katalog lub niewykonana kontrola mają jawny finding.

Pole `metrics` zawiera czas całkowity, przyjęty budżet, czasy siedmiu etapów
i prób HTTP oraz informację o wyczerpaniu deadline. Odpowiedź 401 potwierdza
wyłącznie dostępność HTTP, nie uwierzytelnienie ani gotowość czatu. Istniejące
kody SERVICE_DOWN, PACKAGE_TAMPERED i BROWSER_CDP_UNAVAILABLE zachowano.

Budżet można dostosować osobno dla wywołania doctor/diagnose:

```json
{"budget":{"deadline_ms":8000,"concurrency":3,"probe_timeout_ms":2000}}
```

| Zasób | Domyślnie | Dozwolona zmiana |
| --- | --- | --- |
| Deadline diagnozy | 6000 ms | 250–15 000 ms, jawnie w żądaniu |
| Kontrole w toku | połowa dostępnych CPU, ograniczona do 1–4 | 1–4 |
| Timeout próby HTTP | 2000 ms | 50–5000 ms, dodatkowo ograniczony pozostałym deadline |
| Test integracyjny | 20 s | Bez zmiany w tym etapie |
| Dostawa kodu | M, 9 plików, 3 komponenty | Bez zmiany limitów standardu |

Niepoprawny, nieznany lub przekroczony parametr jest odrzucany. Wzrost
deadline pozwala zebrać więcej informacji z wolnego środowiska; sam nie
oznacza szybszej odpowiedzi. Wynik pokazuje faktyczny czas i wybrany budżet.
Domyślny wybór współbieżności reaguje na dostępność CPU, nie na historię
pomiarów ani globalne obciążenie wszystkich klientów.

Standardy pomogły rozwiązać dwa konkretne problemy: zarządzany resolver
zwolnił historyczną rezerwację na podstawie obserwowanego merge, a jawne
przypisanie wcześniej nieposiadanych ścieżek doctor do integration umożliwiło
mały, rozliczalny diff. Zmieniono wyłącznie docelową konfigurację ownership;
zarządzane checkery, locki i piny nie zostały osłabione ani przepisane.

Dodatkowy audyt dokumentacji wykrył rzeczywisty błąd wellmanifest/docs:
checker rozpoznawał dowolne sąsiednie zamykające klamry JSON jako placeholder.
Poprawka HOME w ticket-006 rozpoznaje znaczniki szablonu; 40 testów przechodzi,
w tym pozytywne przykłady JSON i negatywne przykłady niewypełnionych szablonów.
Nie zadeklarowano jej adopcji w Taskand przed chronioną publikacją. Osobno
pozostają historyczne braki metadanych/indeksu oraz brak przypięcia docs.json;
cały audyt docs nie jest zielony. Lokalny audyt workspace przechodzi przy
dwóch dokładnie wskazanych aktywnych checkoutach, z zachowaniem planu ticket-003.

Przy tej naprawie zastosowano również autoryzowaną korektę klasy dostawy XS → S:
ukryty w checkerze limit XS wynosi 10 minut. Zakres pozostał równy dwóm plikom,
bez nowych komponentów, zależności lub interfejsów; lease ponownie związano
z poprawionym intentem. To ograniczona adaptacja budżetu, a nie podnoszenie
limitu testów lub omijanie kontroli konfliktów.

Odczytowy `wellmanifest/performance` przy rewizji
`3573a263ec877bd5b67d462712e224742b69024b` działa jako CLI i znalazł cztery
heurystyczne ostrzeżenia o nieograniczonym Promise.all w starszym discovery
i cluster/monitor. Nowy worker pool nie został zgłoszony. To materiał na
kolejne ograniczone naprawy, a nie dowód błędu każdej wskazanej linii.
Nowszy HOME new-project ma już zmianę batchowania odczytów ticket activity
(`a4178b9cf6fa12540ee7406d7f38391dd4fa1f30`); nie adoptowano jej bez
zgodnego, wdrożonego profilu CI. Bieżąca poprawka działa na obecnym pinie.

MCP sprawdzono przez rzeczywiste stdio initialize i tools/list:

| Narzędzie | Obserwacja przydatna Taskand |
| --- | --- |
| Todo2code, `c0d8abdcdf6ed8ffba9b2336507f842bd06e6686` | 28 narzędzi; dostęp do diff/reality/diagnose, bez uruchamiania ekstrakcji ani apply |
| Iterun, `29cf63045fa7f5624f5c961b577acb300d02d3d2` | 10 narzędzi; iterun_schema wykonało się bez błędu |
| TestQL, `d08d033607eb57f9c094856d0fb0d1adef88c8d5` | Samo venv: ModuleNotFoundError dla nlp2env; po wskazaniu lokalnego src zależności: 5 narzędzi i poprawne list_sources przez MCP |
| Metrun, `7cdf3cc5183bd3af2b42fe1427a5d159bb31e83b` | Kod i dokumentacja opisują profilowanie Pythona; nie zastępuje pomiarów czasu subprocessów Node |

To sprawdzenie dostępności i odczytowego kontraktu, nie dowód gotowości
automatycznego healing, deploymentu ani połączenia tych narzędzi z Taskand.

<!-- docs:section hypotheses -->
## Hipotezy

Rosnący dziennik zdarzeń, nieograniczona liczba peerów i jednoczesne żądania
diagnozy mogą stać się następnymi wąskimi gardłami. Obecny limit dotyczy jednej
diagnozy, nie całej instancji. Przed zmianą limitów globalnych potrzebne są
pomiary kolejki, pamięci, p95 i współdzielonych zasobów.

<!-- docs:section limitations -->
## Ograniczenia dostawy

Aktualny chroniony profil Validator wymaga onedev/local-verify. Preflight
wykonano z wdrożonego release `d8dc1872f62d2d3f710e187d4e38060c0243619c`,
chronionego registry o SHA-256
`8cf454032de49c42c68f65844c82abacef6fe2efd216e163c83183979ffa814a`
i konfiguracji rzeczywiście zamontowanej w działającym koordynatorze
(SHA-256 `ea2c5e6022b653c73e8f61c018baa8481210da3d79485c8bbabc7b85cdceb008`).
Brakuje w niej executora dla Taskand, choć profil istnieje w źródłach
onedev-agent. Przyczyną blokady nie jest billing GitHub Actions.

Ta zmiana nie wdraża gateway/UI i nie deklaruje działania produkcyjnego czatu.
Nie potwierdza Windows, RPi, LLM, live streaming ani zbiorczego budżetu wszystkich
żądań. Weryfikacja potomków jest wykonywana na Linux; Windows wymaga własnego
mechanizmu zamykania drzewa procesów przed deklaracją pełnej zgodności.

<!-- docs:section recommendations -->
## Następne działania

1. Właściciel onedev-agent wdraża istniejący profil i canary wymaganych testów;
   potem niezależny Validator może sprawdzić dokładny head/base.
2. Kontynuować F-03: komunikaty auth, zgodność gateway/UI oraz SHA artefaktów;
   F-04 uruchomić po wymaganych bramkach na spójnym snapshotcie z rollbackiem.
3. Budżety dostosowywać w granicach zaakceptowanego intentu na podstawie czasu,
   pokrycia i zajętości zasobów. Zmiana współbieżności nie zmienia ownership,
   granic uprawnień, wymaganego review ani kryterium poprawności.
4. Integracje MCP zaczynać od odczytowych narzędzi i jawnie przypiętych
   zależności. Błąd bootstrapu ma wskazywać brakujący pakiet i następny krok;
   nie powinien blokować niezależnego testowania i naprawy Taskand.
