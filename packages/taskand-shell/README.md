# Taskand: NL → skrypt → Paxlet

Lokalny moduł `python -m app.shell_workflow` używa API **nl-dsl-sh 0.2.0**
i **Paxlet 0.1.4**. Polecenia uruchamiaj z katalogu Taskand (lub jego worktree).
Moduł nie jest jeszcze podłączony do `bin/taskand`, gateway ani rejestru URI.

## Instalacja z lokalnych źródeł

Python 3.11+. Osobne środowisko zachowuje opcjonalny charakter integracji:

```bash
python -m venv .subactor/cache/shell-venv
. .subactor/cache/shell-venv/bin/activate
pip install /home/tom/github/paxlet-com/paxlet /home/tom/github/paxlet-com/nl-dsl-sh
python -m app.shell_workflow --help
```

Nie kopiujemy implementacji bibliotek do Taskand. Ścieżki instalacji możesz
zmienić na swoje checkouty. `nl-dsl-sh` nie wymaga publikacji w PyPI.

## Przykład bez klucza API

```bash
python -m app.shell_workflow compile packages/taskand-shell/hello.plan.json --output /tmp/taskand-hello.py
python -m app.shell_workflow export packages/taskand-shell/hello.plan.json /tmp/taskand-hello-paxlet \
  --urn urn:paxlet:taskand:hello --permissions packages/taskand-shell/hello.permissions.json
python -m app.shell_workflow verify /tmp/taskand-hello-paxlet
```

`export` zwraca `digest` paczki. Po przeczytaniu wygenerowanego kodu uruchom ją
jawnym poleceniem, podając ten digest (łącznie z prefiksem, jeśli występuje):

```bash
python -m app.shell_workflow run /tmp/taskand-hello-paxlet --expected-digest '<digest z export>'
```

Wynik zawiera wyjście akcji, receipt Paxlet i ścieżkę zapisanego receipt.
Zmiana zawartości paczki wymaga ponownego sprawdzenia i podania nowego digestu.
Nie modyfikuj paczki równolegle z wykonaniem; sprawdzenie digestu nie jest blokadą plików.
Katalog eksportu i plik kompilacji muszą być nowe.

## Język naturalny i ponowne użycie skryptów

```bash
nl-dsl-sh import ./hello.sh --id urn:nl-dsl-sh:taskand:hello --description 'Przywitanie' \
  --alias 'przywitaj się' --catalog /tmp/taskand-scripts.json
python -m app.shell_workflow plan 'przywitaj się' --catalog /tmp/taskand-scripts.json > /tmp/taskand-plan.json
python -m app.shell_workflow export /tmp/taskand-plan.json /tmp/taskand-reused-paxlet \
  --catalog /tmp/taskand-scripts.json --urn urn:paxlet:taskand:reused \
  --permissions packages/taskand-shell/hello.permissions.json
```

Domyślnie działa wyłącznie dokładny lokalny alias. LLM włączasz jawnie przez
`plan --env-file /ścieżka/do/.env`; konfiguracja jest obsługiwana przez
`nl_dsl_sh.LLMConfig`. Możesz dodać `--reuse-only`. Zapytanie i metadane katalogu
mogą wtedy trafić do wybranego dostawcy. Wynik `plan` to JSON do kolejnego kroku.

`plan`, `compile`, `export` i `verify` nie wykonują zadań. `run` uruchamia kod
lokalnie z uprawnieniami użytkownika, bez sandboxa OS. Uprawnienia w przykładzie
dotyczą wyłącznie wypisania tekstu; dla własnych zadań podaj własne deklaracje.
Limit czasu `run` domyślnie wynosi 30 sekund i korzysta z runtime Paxlet;
nie gwarantuje zakończenia całego drzewa procesów potomnych. Moduł służy do
krótkich, sprawdzonych zadań lokalnych, nie do usług w tle.

## Testy

```bash
python tests/shell_workflow_test.py
./project/governance-check.sh
```

Testy używają rzeczywistych bibliotek oraz interpreterów Python i Bash.
Nie potrzebują LLM, sieci ani sekretów.
