---
{
  "schema": "wellmanifest.docs/document/v1",
  "id": "mcp-uri-catalog",
  "kind": "information",
  "version": 2,
  "title": "Lokalne MCP jako natywne procesy URI",
  "status": "implemented",
  "owner": "semcod/taskand-glm53",
  "created": "2026-09-19",
  "updated": "2026-09-19",
  "review_after": "2026-09-26",
  "source_revision": "8fa9d47b389a9c0ab4b7a12601fad1b8ac23b95b",
  "affected_repositories": [
    "semcod/taskand-glm53"
  ],
  "evidence": [
    "repo://semcod/taskand-glm53/project/ticket-030/intent.json",
    "repo://semcod/taskand-glm53/mcp/catalog.py",
    "repo://semcod/taskand-glm53/tests/mcp_catalog_test.py",
    "repo://semcod/taskand-glm53/tests/mcp_registry.test.mjs"
  ]
}
---

# Lokalne MCP jako natywne procesy URI

<!-- docs:section purpose -->
## Cel

Udostępnić narzędzia lokalnych serwerów MCP przez istniejący rejestr i gateway Taskand.
Importer tworzy samodzielne pakiety w `mcp/`, zgodne z układem `generated/**`.
Wynik ticket-030: 45 dostępnych serwerów, 422 zarejestrowane narzędzia.
Każdy pakiet ma wersjonowany URI; import rejestruje kandydatów.

<!-- docs:section scope -->
## Zakres obserwacji

Pomiar z 2026-09-19 obejmuje konfiguracje Codex, Cursor, Claude Desktop,
Claude CLI i VS Code na tym hoście oraz cztery doinstalowane implementacje
z repozytorium [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers).
To wszystkie unikalne nazwy w tych konfiguracjach, nie katalog wszystkich MCP w internecie.
Sprawdzono również konfiguracje projektowe Claude; nie dodawały serwerów.
46 nazw obejmuje 45 serwerów oraz wykluczony adapter `taskand`, którego ponowny
import tworzyłby rekurencyjne połączenie Taskand → MCP → Taskand.

Powtarzające się nazwy mają jawny priorytet: naprawiony profil, Codex, Cursor,
Claude Desktop, Claude CLI, VS Code, dodatkowe serwery. `--prefer-first` zapisuje
pominięte lokalizacje w raporcie; bez tej opcji sprzeczne konfiguracje są błędem. Niedostępny serwer zachowuje
częściowy raport i powoduje niezerowy kod zakończenia importera.
Nie zmieniono konfiguracji klientów ani kodu repozytoriów serwerów.

Ticket-029/PR #38 pozostaje osobną zmianą kontrolera MCP. Po autoryzowanym
przekazaniu jego rezerwacji pracy nowy zakres przydzielono ticket-030.
Gateway 8077 i pilot 8082 zachowują swój dotychczasowy stan.

<!-- docs:section content -->
## Implementacja i użycie

`mcp/catalog.py` odczytuje zaufane konfiguracje operatora, wykonuje inicjalizację
MCP i `tools/list`, a następnie projektuje kontrakty na pakiety:

```text
mcp/
  catalog.py, bridge.py, pyproject.toml, uv.lock
  mcp-<nazwa-serwera>-<hash>/
    registry.json
    <nazwa-narzędzia>-<hash>/taskand.dev/v1/
      proc.yaml
      bin.mjs
      bridge.py
      tool.json
```

Przykład:
`proc://taskand.dev/mcp-filesystem-cbf61858/read-text-file-e862d61b/v1`.
Hash w nazwie zapobiega kolizjom po normalizacji znaków. Przestrzeń `mcp-*`
ma jeden katalog główny; istniejące procesy nadal korzystają z `generated/`.
Rejestr eksportuje `inputSchema`, opcjonalne `outputSchema` oraz metadane MCP.
Pakiety i prywatne profile są niezmienne: zmiana wymaga nowej wersji oraz nowego
pliku profili. Ponowne wykonanie identycznego importu jest idempotentne.

Przykład importu z pliku JSON `mcpServers` lub TOML `mcp_servers`:

```bash
uv sync --frozen --project mcp
uv run --frozen --project mcp python mcp/catalog.py \
  --config /absolute/path/client-config.json \
  --output /absolute/path/taskand-release/mcp \
  --profiles /absolute/private/state/profiles-v1.json \
  --report /absolute/private/state/import-v1.json --register
```

`--config` można powtarzać; `--only NAZWA` ogranicza import. Przy zmianie
kontraktu należy użyć np. `--version 2`. Katalog nadrzędny `mcp/` musi zawierać
Taskand z tą wersją registry/core. Profile zawierają konfigurację uruchomienia
oraz wymagane wartości środowiska, pozostają poza repozytorium z trybem `0600`.
Pakiety `mcp/mcp-*/` są ignorowanymi artefaktami wdrożenia, odtwarzanymi importerem;
Git przechowuje kompilator, lock zależności, integrację rejestru i testy.

Gateway potrzebuje `TASKAND_MCP_PYTHON` wskazującego absolutną ścieżkę interpretera
z zależnościami `mcp/uv.lock` oraz `TASKAND_MCP_PROFILES` wskazującego właściwy
prywatny snapshot. Sam import nie przyznaje praw do wykonywania narzędzi.
Operator dopuszcza wybrany URI istniejącą akcją rejestru `approve` i nadaje grant
`call` temu URI. Zwykłe wywołanie korzysta z `/api/proc/call`:

```json
{"uri":"proc://taskand.dev/mcp-filesystem-cbf61858/read-text-file-e862d61b/v1",
 "data":{"path":"/absolute/allowed/workspace/example.txt"},"timeout":35}
```

Most używa oficjalnego SDK: stdio oraz Streamable HTTP. Sprawdza schemat wejścia,
odcisk profilu i świeży kontrakt narzędzia przed wywołaniem; waliduje też wynik
strukturalny, jeśli serwer deklaruje jego schemat. Nie pobiera zewnętrznych
referencji JSON Schema. Limity: 500 narzędzi/serwer, katalog 1 MiB,
wejście/wynik 256 KiB, wywołanie MCP 25 s, wrapper 30 s. HTTPS jest dopuszczony;
zwykły HTTP wyłącznie na loopback. Brak obsługi nagłówków uwierzytelniających
HTTP jest zgłaszany jawnie. Wyjątek po wysłaniu wywołania daje
`OUTCOME_UNKNOWN`, `outcomeKnown:false`, bez automatycznego ponowienia.
`taskSuccessVerified:false` odróżnia odpowiedź narzędzia od niezależnego odbioru zadania.

## Naprawione środowiska i źródła

| Serwer | Potwierdzony problem i rozwiązanie |
| --- | --- |
| diff-dsl | Nieistniejący interpreter z konfiguracji Cursor. Osobna kopia `git archive` rewizji `c47973075671047a9d4be413d3e259bb9a5ebca5`, uruchamiana jako `python -m diff_dsl.mcp_server`. Ta przypięta rewizja udostępnia 2 narzędzia; roboczy katalog źródłowy udostępniał 4. |
| tillm | Brak lokalnego `.venv/bin/mcp2tillm`; drugi znaleziony launcher również importował brakujący moduł. Osobny runtime z rewizji `26c87bfcdd6f2c26f34035cc2a987ec9443d9e44`, z pakietami tillm, dsl2tillm, nlp2tillm i mcp2tillm. |
| microsoft/markitdown | `markitdown-mcp==0.0.1a4` używa MCP 1.8.x i nie obsługuje poprawnie sondy `server/discover`. Osobny runtime i jawne `taskand_protocol_mode: legacy` przywracają inicjalizację. |

Dodatkowe implementacje mają przypięte wersje potwierdzone w
[wydaniach projektu](https://github.com/modelcontextprotocol/servers/releases):

| Serwer | Zainstalowany pakiet | Ograniczenie lokalnego profilu |
| --- | --- | --- |
| filesystem | `@modelcontextprotocol/server-filesystem@2026.8.31` | Osobny katalog testowy. |
| memory | `@modelcontextprotocol/server-memory@2026.8.31` | Osobny plik grafu pamięci. |
| git | `mcp-server-git==2026.8.18` | Repozytorium ticket-030; test tylko odczytu statusu. |
| fetch | `mcp-server-fetch==2026.8.18` | Test pobiera publiczny README źródłowego projektu. |

npm zainstalowano z `--save-exact --ignore-scripts`; Python w osobnych środowiskach uv.
Lock npm i środowiska serwerów pozostają lokalnymi artefaktami instalacji.
Import istniejącej konfiguracji przypina polecenie, argumenty, środowisko i schemat;
nie zamraża całego drzewa zależności ani zawartości każdej istniejącej instalacji.
W szczególności konfiguracje operatora zawierające ruchome wersje nadal wymagają
kontrolowanej aktualizacji. Pin profilu nie jest podpisem ani izolacją systemową.

## Katalog lokalny

| Serwer | Narzędzia |
| --- | ---: |
| algitex-aider | 3 |
| algitex-code2llm | 4 |
| algitex-planfile | 6 |
| algitex-proxym | 4 |
| algitex-vallm | 6 |
| chrome-devtools | 29 |
| code2logic | 4 |
| code2schema | 4 |
| curllm | 7 |
| data2dsl | 4 |
| diff-dsl | 2 |
| doql | 12 |
| env2llm | 7 |
| fetch | 1 |
| filesystem | 14 |
| gillm | 7 |
| git | 12 |
| hillm | 3 |
| ifuri-marketing | 14 |
| imgl | 3 |
| intract | 7 |
| iterun | 10 |
| koru | 36 |
| llx | 17 |
| memory | 9 |
| microsoft/markitdown | 1 |
| monag | 11 |
| nexu | 16 |
| nlp2cmd | 5 |
| nlp2dsl | 4 |
| nlp2env | 19 |
| nlp2uri | 15 |
| op3 | 4 |
| planfile | 9 |
| pycharm | 42 |
| redup | 8 |
| subactor-search | 3 |
| sumd | 13 |
| testql | 9 |
| text2dsl | 3 |
| tillm | 6 |
| todomat | 6 |
| toonic | 5 |
| vallm | 7 |
| vql | 11 |

<!-- docs:section evidence -->
## Walidacja i uruchomiony pilot

- Dotychczasowy adapter Taskand MCP: 9/9 testów; kontroler ticket-029: 11/11.
- Końcowy `make test` z 422 zarejestrowanymi kandydatami: konformacja 4/4,
  kontrakty 30/30, negatywne 17/17, twin 9, web twin 8, CLI 7,
  MCP Python 11 i rejestr MCP Node 1; wszystkie przeszły.
- `node --test tests/doctor_diagnostics.test.mjs`: 14/14. Nowy test najpierw
  odtworzył ucięcie JSON na potoku; po poprawce oba rzeczywiste programy
  zachowują wszystkie 1024 ustalenia, ostatni rekord i tryb planowania.
- Integracja jest lokalnym commitem `9384699affb303d1ad31831eeea7181116e34680`.
  Zależność ticket-031, commit `8fa9d47b389a9c0ab4b7a12601fad1b8ac23b95b`,
  zastępuje asynchroniczny zapis stdout synchronicznym `writeFileSync(1, ...)`
  przed istniejącym `process.exit`. Poprawka obejmuje doctor/prescribe i
  doctor/heal oraz odświeża wyłącznie ich bindingHash. Dołączono ją lokalnie
  do gałęzi ticket-030 przez fast-forward.
- `./project/governance-check.sh`: zero błędów i ostrzeżeń.
- Testy MCP uruchamiają prawdziwe serwery SDK stdio/HTTP i rzeczywisty rejestr;
  sprawdzają schematy, zmianę profilu/kontraktu, kandydaturę/dopuszczenie,
  niezmienność pakietów, kolizje nazw, symlinki oraz brak ponowienia niepewnego efektu.
- Pełna droga adapter Taskand MCP → gateway 8084 → natywny URI → filesystem MCP
  przeszła test; `describe_process` udostępnia schemat, a `call_process` zwraca
  oczekiwaną zawartość znanego pliku.
- Import 45 serwerów zakończył się bez niedostępnych integracji i zarejestrował
  422 kandydatów w roboczym `mcp/`.
- Pilot `http://127.0.0.1:8084`, jednostka użytkownika
  `taskand-mcp030-release.service`, ma 7 dopuszczonych narzędzi i 415 kandydatów.
  Profile, token i surowe odpowiedzi przechowuje prywatny magazyn hosta.
  Po wdrożeniu powtórzono wszystkie siedem wywołań i test adaptera.
  Health zgłasza `LOCAL_CODE_MATCH`; sprawdzono odciski 447 plików źródłowych
  manifestu wydania. Doctor/prescribe zwraca pełny JSON 230708 bajtów,
  a doctor/heal 217052 bajtów; oba zawierają 416 rekordów. Heal pozostaje
  w trybie planowania bez wykonanych napraw.
- Rzeczywiste wywołania URI: odczyt pliku filesystem, odczyt memory,
  status git, fetch publicznego README, konwersja lokalnego HTML MarkItDown,
  tillm health i analiza dwóch manifestów diff-dsl. Odpowiedzi sprawdzono
  względem znanych danych testowych; health tillm jest diagnostyką zależności.
- Pierwsza analiza diff-dsl dostała pusty katalog bez wymaganych dwóch manifestów.
  Serwer zwrócił błąd JSON-RPC, zaklasyfikowany zachowawczo jako `OUTCOME_UNKNOWN`.
  Po odczycie źródła potwierdzono odczytowy charakter operacji i wykonano nowy
  test na dwóch odrębnych, poprawnych manifestach. Nie ponawiano go automatycznie.

Powtarzalne dowody są w testach repozytorium. Lokalne obserwacje wdrożenia:
- `final-import.json`: SHA-256 `f75187b4f538fcff8e529513e0242f03274330286b6aea61fc31438cac3d4b51`.
- `gateway-canaries-verified.json`: SHA-256 `d4ab73a6998e2691636e36d72cb848a9434aae605c1218ffd3223e90ece28b93`.

- `deployed-verification.json`: SHA-256 `75cd58a9263facf54284189e44fc9784ccfb388fe1b0272b7208e73f665ff915`.

Magazyn operacyjny: `~/.local/state/taskand/mcp-local-import-20260919/`;
instalacje i pilot: `~/.local/share/taskand/mcp-import/`.
Te ścieżki pomagają operatorowi lokalnemu; nie zastępują dostępnego w repo kodu
ani niezależnych dowodów publikacji. Rewizja w metadanych wskazuje wdrożony commit implementacji. Późniejszy
commit odbioru aktualizuje wyłącznie ten dokument i kryteria ticket-030.

<!-- docs:section limitations -->
## Ograniczenia odbioru

`tools/list` sprawdzono dla wszystkich 45 serwerów; logikę narzędzi sprawdzono
na siedmiu wybranych wywołaniach, nie na wszystkich 422. Nie wykonano działań
płatnych, publikacji ani arbitralnych operacji zapisu z importowanych katalogów.
Tillm health zgłasza brak opcjonalnych pakietów nlp2dsl, intract, redsl, proxym,
llx i env2llm w jego izolowanym środowisku. Nie dowodzi to gotowości jego
komend wykonujących zadania; odpowiednie samodzielne MCP są osobno w katalogu.

Most uruchamia zaufane programy operatora pod jego kontem; nie jest sandboxem
systemowym. Schemat MCP ani adnotacja readOnly nie przyznają uprawnień.
Utrata odpowiedzi może pozostawić efekt i wymaga uzgodnienia stanu przed kolejnym
wywołaniem. Hostowe profile mogą zawierać sekrety i nie trafiają do Git.

Integracja jest lokalnie wdrożona, lecz nie jest scalona z main ani wypchnięta.
Zachowany PR #38 ma HEAD `803771c0877ed7a2e21bdc049602efd4ad9a1fd8` i czeka na chronione
lokalne CI: brak `/run/onedev-docker-gate/taskand-browser.socket`, zależność
[onedev-agent #304](https://github.com/subactor/onedev-agent/issues/304).
Nowa implementacja nie obchodzi tej kontroli. Po ponownej decyzji użytkownika
zatrzymano dokładną sesję dashboardu i zwolniono jej lease przez CAS. Jej czysty
checkout, w tym ignorowane dane, zachowano w prywatnym archiwum przed zwolnieniem
katalogu; gałąź, PR38 i wdrożenie na 8082 pozostały zachowane. Audyt dokumentacji wykazuje
cztery istniejące wcześniej problemy metadanych/placeholderów w innych dokumentach;
zapisano je w kolejce PLF-010. Nowy dokument nie dodaje takiego problemu.

<!-- docs:section next_actions -->
## Obsługa i dalsza dostawa

Dodatkowe narzędzia dopuszczać indywidualnie po ocenie konkretnego działania;
import sam zachowuje stan candidate. Zmiany konfiguracji importować jako nowe
wersje z osobnym snapshotem profili. Wersja uruchomiona na 8084 pochodzi z `8fa9d47`; manifest plików wiąże ją
z commitem. Poprzedni dziennik żądań skopiowano po zatrzymaniu starej jednostki
pilota, zachowując również poprzedni katalog jako punkt odtworzenia.
Pełna publikacja wymaga chronionego
przeglądu i działającego lokalnego wykonawcy CI.

Rollback pilota: `systemctl --user stop taskand-mcp030-release.service`.
Zachować katalog pilota, profile i receipts do uzgodnienia efektów; istniejące
instancje 8077/8082 pozostają niezależne. Jednostka jest lokalnym pilotem sesji,
nie deklaracją wdrożenia produkcyjnego ani konfiguracji startu po restarcie hosta.

## Odzyskanie zgodności po przeniesieniu profilu

`PROFILE_CHANGED` oznacza, że prywatny profil różni się od przypiętego kontraktu.
Nie edytuj `tool.json` istniejącej wersji i nie wyłączaj sprawdzania skrótu.
Sprawdź również, czy polecenie i katalog wskazują istniejące zasoby: archiwum
kodu bez `.git` nie jest repozytorium dla `mcp-server-git --repository`.

Dla wcześniej dopuszczonego narzędzia przygotuj osobny snapshot profili (0600)
i nową wersję pakietu w izolowanym wydaniu:

```sh
python mcp/reprofile.py --root /path/to/staged-runtime \
  --profiles /private/profiles.json \
  --uri proc://taskand.dev/mcp-git-9a881b9b/git-status-798e060c/v1 --version 2
```

Polecenie sprawdza integralność starego pakietu, pobiera świeży katalog MCP
i wymaga identycznego kontraktu narzędzia. Nie wywołuje narzędzia i tworzy
wyłącznie kandydata. Operator osobno dopuszcza nową wersję, sprawdza ją oraz
przenosi istniejący grant na nowy URI; poprzednia wersja pozostaje niezmienna.
Zmiana schematu, niezmieniony profil i niedopuszczony pakiet są odrzucane.
Przy wdrożeniu zachowaj poprzednie pliki rejestru/grantów i konfigurację systemd;
cofanie dotyczy tych powiązań, nie bazy kontekstu ani integracji shell.
