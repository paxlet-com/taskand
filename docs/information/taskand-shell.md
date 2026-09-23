# Taskand shell: nl-dsl-sh i Paxlet przez CLI, HTTP i MCP

Wymagane: Node.js, Python 3.11+, Bash oraz oba lokalne repozytoria.
Z katalogu dostarczonego checkoutu Taskand:

```bash
bash packages/taskand-shell/install.sh /home/tom/github/paxlet-com/paxlet /home/tom/github/paxlet-com/nl-dsl-sh
export TASKAND_SHELL_PYTHON="$PWD/.subactor/cache/shell-venv/bin/python"
export TASKAND_SHELL_WORKSPACE="$PWD/log/shell"
node bin/taskand shell compile '{"plan":{"schema_version":"0.1","name":"hello","steps":[{"id":"hello","kind":"generate","language":"python","code":"print(42)\n"}]}}' --json
```

`taskand shell <operacja> '<JSON>'` obsługuje też `@plik.json`.
CLI używa dostępnego gateway, a bez niego lokalnego rejestru i audytu.
Ścieżki w JSON odnoszą się do workspace **węzła wykonującego**, nie klienta.

| Operacja | Proces URI | Wejście |
|---|---|---|
| plan | `proc://taskand.dev/mcp/shell-build/v1` | `prompt`, opcjonalnie `catalog`, `language`, `reuse_only`, `use_llm` |
| compile | ten sam | `plan`, opcjonalnie `catalog`, `format` |
| export | ten sam | `plan`, `id`, `urn`, `permissions`, opcjonalnie `catalog` |
| verify | ten sam | `id` |
| run | `proc://taskand.dev/mcp/shell-run/v1` | `id`, `expected_digest`, opcjonalnie `stdin`, `timeout` |

Proces `shell-build` wymaga pola `operation`; proces `shell-run` wykonuje wyłącznie
`run` i odrzuca to pole. CLI dodaje je sam. Odpowiedź procesu to `{ok, result}`;
gateway i MCP opakowują ją swoim wynikiem i identyfikatorem żądania audytu.
`compile` zwraca kod bez wykonania. `export` zapisuje nową paczkę i zwraca digest.
`run` wymaga digestu paczki po przejrzeniu jej kodu.

## Przykład eksportu i wykonania

```bash
node bin/taskand shell export '{"id":"hello","urn":"urn:paxlet:taskand:hello","permissions":{},"plan":{"schema_version":"0.1","name":"hello","steps":[{"id":"hello","kind":"generate","language":"python","code":"print(42)\n"}]}}' --json
node bin/taskand shell verify '{"id":"hello"}' --json
# Wstaw digest otrzymany przy eksporcie i sprawdź wygenerowany kod:
node bin/taskand shell run '{"id":"hello","expected_digest":"sha256:..."}' --json
```

Katalogi skryptów nl-dsl-sh umieszczaj w `$TASKAND_SHELL_WORKSPACE/catalogs/<id>.json`.
Paczki trafiają do `packages/<id>`. Identyfikatory nie są ścieżkami hosta;
przejścia `../` i dowiązania w ścieżce workspace są odrzucane.
Workspace jest wspólny dla uprawnionych operatorów węzła, bez izolacji tenantów.

## Gateway i MCP

Nie potrzeba nowych endpointów ani narzędzi MCP. Użyj istniejącego
`POST /api/proc/call` z `{uri, data}` lub narzędzia MCP `call_process` z
`{uri, input_data}`. W `data` / `input_data` przekazujesz obiekt z powyższej tabeli.

Przyznaj użytkownikowi przygotowującemu kod wyłącznie grant `call` na
`proc://taskand.dev/mcp/shell-build/v1`. Wykonawca wymaga osobnego grantu na
`proc://taskand.dev/mcp/shell-run/v1`. Widoczność w katalogu nie przyznaje dostępu.
Nie dawaj przygotowującemu kod szerokiego grantu `registry/core` lub `proc://*`:
istniejące procesy złożone nie propagują wszystkich grantów użytkownika.

Gateway musi używać tego samego release co wrapper i `app/shell_workflow.py`.
Wrapper sprawdza pin SHA-256 adaptera oraz korzysta z integralności rejestru.
Ustaw `TASKAND_SHELL_PYTHON` i `TASKAND_SHELL_WORKSPACE` w środowisku gateway.
Instalator nie restartuje istniejących usług ani kontenerów. W obrazie/kontenerze
zależności muszą być zainstalowane osobno; nie zakładaj dostępności venv hosta.

NL działa offline przez dokładny alias katalogu. `use_llm: true` wymaga
operatorowego `TASKAND_SHELL_ENV_FILE`; klient nie wybiera ścieżki konfiguracji.
Nie wykonano połączenia z płatnym dostawcą modelu podczas testów tej integracji.

`run` wykonuje dowolny zatwierdzony kod z uprawnieniami użytkownika węzła.
Deklaracje permissions i digest nie są sandboxem OS. Timeout nie gwarantuje
zakończenia całego drzewa potomnego; używaj krótkich zadań, bez demonów.

## Testy integracyjne

```bash
# SDK jest potrzebne tylko do testu rzeczywistego transportu MCP:
"$TASKAND_SHELL_PYTHON" -m pip install ./packages/taskand-mcp
node --test tests/cli_routing.test.mjs
./project/governance-check.sh
```

Test uruchamia własny gateway na losowym porcie loopback, dwa tymczasowe granty,
rzeczywisty klient i serwer MCP oraz biblioteki nl-dsl-sh/Paxlet. Potwierdza NL
reuse, eksport, oddzielny grant wykonania, odmowę jego obejścia i receipt.
Bez zainstalowanych zależności testy zależne od nich zgłaszają jawne pominięcie.
