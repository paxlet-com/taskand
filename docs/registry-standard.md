# taskand — standard rejestru i pakietów (registry/1)

## Pakiet procesu (samodzielny byt)

```
generated/<organizm>/<zdolność>/taskand.dev/<wersja>/
├── proc.yaml             # manifest (płaski YAML: klucz: wartość, listy [a, b])
├── bin.mjs               # wejście: JSON na stdin → jedna linia JSON na stdout z polem ok (boolean)
├── <moduł>.mjs           # opcjonalne moduły siostrzane (≤ 180 linii dla pakietów evolved)
├── registry-client.mjs   # tylko gdy pakiet wywołuje inne procesy
└── test.mjs              # opcjonalny test kontraktu
```

- URI: `proc://taskand.dev/<organizm>/<zdolność>/v<N>` — lokalizacja wynika z URI przez regex, nigdy przez `replace()` na ścieżce.
- Importy: wyłącznie `node:*` i `./moduł.mjs`. Inny proces = `call(uri, input)` przez `registry-client.mjs`.
- `bindingHash` = sha256 po wszystkich plikach pakietu (nazwa + `\0` + treść + `\0`, posortowane).

```yaml
uri: proc://taskand.dev/alert/telegram/v1
organism: alert
kind: task                                  # task | interface | service
origin: builtin                             # builtin | evolved | peer:<węzeł>
desc: "Alert CPU na Telegram przez Bot API"
env: [TASKAND_EXAMPLE_SETTING]              # zmienne, które broker przekaże procesowi
credentials: [vault://telegram/*]           # credentialRef, które broker może odszyfrować
```

## Rejestr organizmu

`generated/<organizm>/registry.json` — pisany wyłącznie przez `proc://taskand.dev/registry/core/v1` (blokada `.registry.lock`, zapis atomowy).

| Status | Wywoływalny | Przejście |
|--------|-------------|-----------|
| `candidate` | nie | `approve` → active |
| `active` | tak | `deprecate` → deprecated |
| `deprecated` | nie | — |

Status początkowy: builtin → active; evolved → `policy.evolution` (auto/manual) w `genome.yaml`; peer → `policy.peers` (domyślnie manual).
Wersje evolved/peer są niezmienne (zmiana = nowa wersja). Pakiety builtin po edycji w git: `make catalog` (`refresh`).

## Akcje registry/core

`call` `resolve` `list` `register` `refresh` `approve` `deprecate` `verify` `scan` `export` `package` `pull`

`call` wykonuje: URI → wpis → status `active` → `bindingHash` → env `{PATH, HOME, LANG, TASKAND_CALL_DEPTH}` + zadeklarowane `env` + `TASKAND_CREDENTIAL` → spawn → audyt CloudEvents.
Błędy: `NOT_FOUND`, `DENIED`, `OUTCOME_UNKNOWN` (timeout), `EXEC_ERROR`, `CONTRACT_ERROR`, `REGISTRY_ERROR`.

## Wymiana między węzłami

1. DISCOVER — `GET /.well-known/catalog.json` (aktywne procesy: uri, desc, hash, pliki).
2. PULL — `POST /api/registry {"action":"package","uri":…}` z tokenem (grant `read`).
3. VERIFY — hash pobranych plików = hash z katalogu peera; konformacja pakietu.
4. INSTALL — status `candidate`; uruchomienie dopiero po `taskand approve <uri>`.

Lokalny pakiet o tym samym URI i innym hashu = `conflict` (bez nadpisania).

## Samonaprawa (doctor)

`doctor/diagnose` → `findings[]` → `doctor/prescribe` → recepty `organism` | `human` → `doctor/heal {"run": true}`.

| Kod | Wykonawca | Recepta |
|-----|-----------|---------|
| `PROCESS_FAILING` (3 ostatnie wywołania: EXEC/CONTRACT/OUTCOME_UNKNOWN), evolved/peer | organizm | `dev/evolve {supersedes, failure}` |
| `PACKAGE_TAMPERED`, evolved/peer | organizm | `registry deprecate` → `dev/evolve {supersedes}` |
| `PACKAGE_TAMPERED` / `PROCESS_FAILING`, builtin | człowiek | kod w git (zasada 8: brak samomodyfikacji) |
| `SERVICE_DOWN`, `BROWSER_CDP_UNAVAILABLE` | człowiek | infrastruktura Docker (brak gniazda w gateway) |
| `VAULT_UNINITIALIZED` | człowiek | sekrety nie są generowane przez organizmy |
| `CANDIDATE_PENDING` | człowiek | przegląd kodu i `taskand approve` |
| `PEER_NEW_PACKAGES` | organizm | `cluster/monitor {pull:true}` — pobranie nowych pakietów peera jako candidate |
| `PEER_DOWN` | człowiek | `taskand occupy <user@host>` / restart — wymaga dostępu SSH do hosta |
| `PEER_DEGRADED` | człowiek | diagnoza po stronie zdalnego węzła |

Granice: `policy.healing` (auto/manual/off), maks. 2 naprawy na przebieg, 30 min odstępu dla obiektu, każda naprawa w dzienniku (`dev.taskand.organism.heal`).

**Bramka regresji** (`dev/evolve/gate.mjs`) — nowa wersja uruchamiana na tym samym wejściu co zastępowana, kolejność rozstrzygania:

1. **Awarie** (bez LLM): `ok:false` przy działającej poprzedniej = `worse`; poprzednia zepsuta = `better`.
2. **Liczności** (`compareCounts`, bez LLM, `deterministic: true`): mniej elementów w którejkolwiek tablicy (brak tablicy = 0) = `worse`; więcej i nigdzie mniej = `better`. Dzięki temu regresja jest wychwytywana także bez klucza LLM i nie zależy od oceny modelu.
3. **Ocena LLM** (`deterministic: false`) tylko gdy liczności są równe — na skrótach (pełne liczności + próbki), bo surowy obcięty JSON mylił oceniającego.

`worse` → kolejna próba z uzasadnieniem, `unknown` → `candidate`, `better|equal` → nowa `active`, poprzednia `deprecated` (rollback: `taskand approve <poprzednia>`). Uwaga: krok 2 uznaje „więcej” za lepsze, więc nie wykryje wersji zawyżającej wynik duplikatami — to zostaje dla testu kontraktu i przeglądu człowieka.

## Klaster węzłów (peery, cluster/monitor, occupy)

`peers:` w `genome.yaml` to adresy innych węzłów. `taskand peers` / `taskand peer add|remove <url>` (rejestr: `peers`, `peer_add`, `peer_remove`).

`cluster/monitor/v1`: dla każdego peera sonda `/healthz` + katalog; `findings` `PEER_DOWN` / `PEER_DEGRADED` / `PEER_NEW_PACKAGES`; z `{"pull":true}` pobiera brakujące pakiety jako candidate. Wpięte w `doctor/diagnose` (delegacja do `cluster`).

**Powoływanie węzła — `taskand occupy <user@host>`** kopiuje pliki z `bin/bootstrap.manifest` przez SSH/rsync, uruchamia `docker compose up -d --build`, czeka na `/healthz`, dopisuje węzeł jako peer, a z `--token` wykonuje handshake (nowy węzeł pobiera pakiety mastera jako candidate).

- **Operacja operatorska, nie autonomiczna.** Domyślnie tylko **plan (dry-run)**; realne działanie wymaga `--run` i dostępu SSH operatora. Organizmy jej **nie uruchamiają** — mogą jedynie zaproponować (`doctor`: `PEER_DOWN → człowiek`). Wykrywanie hostów (`admin/network-device-discovery`) daje kandydatów do przeglądu, nie do automatycznego zajęcia — granica przeciw samoreplikacji w stylu robaka.
- **Sekrety** (`.env`, `vault/`, ozn. `@secret`) nie są kopiowane bez `--with-secrets`; węzeł federacyjny (`TASKAND_BIND=0.0.0.0`) i tak odrzuca domyślne tokeny z `grants.yaml` (patrz `gateway/auth.py`) — operator ustawia własne. Bez sekretów `occupy` zapisuje świeży `.env` (nowy `TASKAND_VAULT_KEY`, pusty klucz LLM → szablony wbudowane).
- **Flagi**: `--dir` (domyślnie `/opt/taskand`), `--with-secrets`, `--master http://ip:8077`, `--token <token-mastera>`, `--port`, `--run`.
