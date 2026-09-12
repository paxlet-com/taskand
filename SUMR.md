# taskand-glm53 v1.5 — Samo-Replikujący się Ekosystem Organizmów (Standard v1.5)

SUMD - Structured Unified Markdown Descriptor for AI-aware project refactorization

## Contents

- [Metadata](#metadata)
- [Architecture](#architecture)
- [Workflows](#workflows)
- [Call Graph](#call-graph)
- [Test Contracts](#test-contracts)
- [Refactoring Analysis](#refactoring-analysis)
- [Intent](#intent)

## Metadata

- **name**: `glm53`
- **version**: `0.0.0`
- **ecosystem**: SUMD + DOQL + testql + taskfile
- **generated_from**: Makefile, testql(1), app.doql.less, goal.yaml, .env.example, Dockerfile, package.json, project/(5 analysis files)

## Architecture

```
SUMD (description) → DOQL/source (code) → taskfile (automation) → testql (verification)
```

### DOQL Application Declaration (`app.doql.less`)

```less markpact:doql path=app.doql.less
// LESS format — define @variables here as needed

app {
  name: taskand-glm53;
  version: 1.0.0;
}

interface[type="web"] {
  type: spa;
  framework: static;
}

workflow[name="conformance"] {
  trigger: manual;
  step-1: run cmd=node scripts/verify-conformance.mjs;
}

workflow[name="test"] {
  trigger: manual;
  step-1: run cmd=node proc/browser/session/taskand.dev/v1/test.mjs;
  step-2: run cmd=node proc/web/navigate/taskand.dev/v1/test.mjs;
  step-3: run cmd=node proc/web/analyze/taskand.dev/v1/test.mjs;
  step-4: run cmd=node proc/flow/login/taskand.dev/v1/test.mjs;
  step-5: run cmd=echo "✓ Wszystkie procesy URI spełniają kontrakt (fail-closed)";
}

workflow[name="packages-test"] {
  trigger: manual;
  step-1: run cmd=for pkg in packages/*; do \;
  step-2: run cmd=if [ -d "$$pkg" ]; then \;
  step-3: run cmd=echo "=== Testowanie paczki $$pkg ==="; \;
  step-4: run cmd=(cd "$$pkg" && make conformance && make test && make verify && make run) || exit 1; \;
  step-5: run cmd=fi; \;
  step-6: run cmd=done;
  step-7: run cmd=echo "✓ Wszystkie wydzielone paczki przeszły pomyślnie testy i konformację!";
}

workflow[name="pack"] {
  trigger: manual;
  step-1: run cmd=mkdir -p dist;
  step-2: run cmd=tar -czf dist/taskand-glm53-v1.0.0.tgz proc/ schemas/ capsule.yaml grants.yaml proc-catalog.json;
  step-3: run cmd=tar -tzf dist/taskand-glm53-v1.0.0.tgz >/dev/null && echo "pack ✓ (archiwum dist/taskand-glm53-v1.0.0.tgz gotowe)";
}

workflow[name="verify"] {
  trigger: manual;
  step-1: run cmd=node verify-catalog.mjs;
  step-2: run cmd=node scripts/verify-conformance.mjs;
}

workflow[name="run"] {
  trigger: manual;
  step-1: run cmd=printf '%s' '{"task":{"site":"semcod.com"}}' | node scripts/taskand-runner.mjs $(URI);
}

workflow[name="observe"] {
  trigger: manual;
  step-1: run cmd=node --input-type=module -e 'import {readFileSync} from "node:fs"; const m = "$(URI)".match(/^proc:\/\/([^/]+)\/(.+)\/(v\d+)$$/); if(m) console.log(readFileSync("proc/"+m[2]+"/"+m[1]+"/"+m[3]+"/proc.yaml","utf8"));';
}

workflow[name="extract"] {
  trigger: manual;
  step-1: run cmd=mkdir -p dist/extracted;
  step-2: run cmd=cp -r schemas/ dist/extracted/;
  step-3: run cmd=echo "extract ✓ (wyekstrahowano artefakty do dist/extracted)";
}

workflow[name="bootstrap"] {
  trigger: manual;
  step-1: run cmd=sh taskand.sh;
}

workflow[name="install-cli"] {
  trigger: manual;
  step-1: run cmd=mkdir -p ~/.local/bin;
  step-2: run cmd=chmod +x taskand.cli;
  step-3: run cmd=ln -sf "$(shell pwd)/taskand.cli" ~/.local/bin/taskand;
  step-4: run cmd=ln -sf "$(shell pwd)/taskand.cli" "$(shell pwd)/taskand";
  step-5: run cmd=echo "✓ Narzędzie 'taskand' zainstalowane w ~/.local/bin/taskand";
}

workflow[name="up"] {
  trigger: manual;
  step-1: run cmd=docker compose up -d;
}

workflow[name="down"] {
  trigger: manual;
  step-1: run cmd=docker compose down;
}

workflow[name="restart"] {
  trigger: manual;
  step-1: run cmd=docker compose restart;
}

workflow[name="status"] {
  trigger: manual;
  step-1: run cmd=docker compose ps;
}

workflow[name="ps"] {
  trigger: manual;
  step-1: depend target=status;
}

workflow[name="logs"] {
  trigger: manual;
  step-1: run cmd=docker compose logs -f nucleus;
}

workflow[name="logs-all"] {
  trigger: manual;
  step-1: run cmd=docker compose logs -f;
}

workflow[name="tasks"] {
  trigger: manual;
  step-1: run cmd=echo "\033[33m=== Oczekujące zadania (tasks/inbox.yaml) ===\033[0m";
  step-2: run cmd=if [ -s tasks/inbox.yaml ]; then cat tasks/inbox.yaml; else echo "(brak zadań w kolejce)"; fi;
  step-3: run cmd=echo "";
  step-4: run cmd=echo "\033[32m=== Wykonane zadania (tasks/done.yaml) ===\033[0m";
  step-5: run cmd=if [ -s tasks/done.yaml ]; then cat tasks/done.yaml; else echo "(brak wykonanych zadań)"; fi;
}

workflow[name="add"] {
  trigger: manual;
  step-1: run cmd=if [ -z "$(TASK)" ]; then \;
  step-2: run cmd=echo "Błąd: podaj treść zadania, np.: make add TASK=\"stwórz projekt w organizacji semcod z README\""; \;
  step-3: run cmd=exit 1; \;
  step-4: run cmd=fi;
  step-5: run cmd=./taskand.cli add "$(TASK)";
}

workflow[name="add-watch"] {
  trigger: manual;
  step-1: run cmd=if [ -z "$(TASK)" ]; then \;
  step-2: run cmd=echo "Błąd: podaj treść zadania, np.: make add-watch TASK=\"monitoruj stan usług\""; \;
  step-3: run cmd=exit 1; \;
  step-4: run cmd=fi;
  step-5: run cmd=./taskand.cli add -t obserwuj "$(TASK)";
}

workflow[name="gateway-health"] {
  trigger: manual;
  step-1: run cmd=curl -s http://localhost:8077/api/health | grep -q '"ok": true' && echo "✓ Gateway REST API działa (port 8077)" || echo "✗ Gateway nie odpowiada";
}

workflow[name="web"] {
  trigger: manual;
  step-1: run cmd=docker compose up -d landing && echo "✓ Web Cockpit działa pod adresem: http://localhost:8090" || sh landing/serve.sh $(PORT);
}

workflow[name="check"] {
  trigger: manual;
  step-1: run cmd=docker build --check .;
  step-2: run cmd=docker build --check -f gateway/Dockerfile gateway/;
  step-3: run cmd=echo "✓ Wszystkie Dockerfile poprawne składniowo";
}

workflow[name="history"] {
  trigger: manual;
  step-1: run cmd=./taskand.cli history;
}

workflow[name="show"] {
  trigger: manual;
  step-1: run cmd=./taskand.cli show $(ID);
}

workflow[name="twin"] {
  trigger: manual;
  step-1: run cmd=./taskand.cli twin $(ID) "$(DESC)";
}

workflow[name="rollback"] {
  trigger: manual;
  step-1: run cmd=./taskand.cli rollback $(ID);
}

workflow[name="snapshot"] {
  trigger: manual;
  step-1: run cmd=./taskand.cli snapshot "$(TARGET)" "$(DESC)";
}

workflow[name="clean-duplicates"] {
  trigger: manual;
  step-1: run cmd=./taskand.cli clean;
}

workflow[name="clean"] {
  trigger: manual;
  step-1: run cmd=docker compose down -v;
  step-2: run cmd=echo "✓ Kontenery zatrzymane i wyczyszczone";
}

tests {
  import: testql-scenarios/**/*.testql.toon.yaml;
}

env_vars {
  keys: TASKAND_LLM_API_KEY, TASKAND_LLM_ENDPOINT, TASKAND_LLM_MODEL, TASKAND_HOST_DIR;
}

deploy {
  target: docker-compose;
  compose_file: docker-compose.yaml;
}

environment[name="local"] {
  runtime: docker-compose;
  env_file: .env;
  template_file: .env.example;
  vars: TASKAND_HOST_DIR, TASKAND_LLM_API_KEY, TASKAND_LLM_ENDPOINT, TASKAND_LLM_MODEL;
}
```

## Workflows

## Call Graph

*41 nodes · 41 edges · 9 modules · CC̄=3.2*

### Hubs (by degree)

| Function | CC | in | out | total |
|----------|----|----|-----|-------|
| `rollback` *(in scripts.history)* | 20 ⚠ | 0 | 59 | **59** |
| `print` *(in history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile)* | 0 | 57 | 0 | **57** |
| `list_history` *(in scripts.history)* | 21 ⚠ | 0 | 52 | **52** |
| `show_details` *(in scripts.history)* | 12 ⚠ | 0 | 44 | **44** |
| `create_snapshot` *(in scripts.history)* | 9 | 0 | 33 | **33** |
| `verify_and_evolve` *(in scripts.digital_twin)* | 6 | 0 | 30 | **30** |
| `log` *(in scripts.digital_twin)* | 1 | 21 | 1 | **22** |
| `ask_llm_for_repair` *(in scripts.digital_twin)* | 8 | 1 | 20 | **21** |

```toon markpact:analysis path=project/calls.toon.yaml
# code2llm call graph | /home/tom/github/semcod/taskand/glm53
# generated in 0.05s
# nodes: 41 | edges: 41 | modules: 9
# CC̄=3.2

HUBS[20]:
  scripts.history.rollback
    CC=20  in:0  out:59  total:59
  history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
    CC=0  in:57  out:0  total:57
  scripts.history.list_history
    CC=21  in:0  out:52  total:52
  scripts.history.show_details
    CC=12  in:0  out:44  total:44
  scripts.history.create_snapshot
    CC=9  in:0  out:33  total:33
  scripts.digital_twin.verify_and_evolve
    CC=6  in:0  out:30  total:30
  scripts.digital_twin.log
    CC=1  in:21  out:1  total:22
  scripts.digital_twin.ask_llm_for_repair
    CC=8  in:1  out:20  total:21
  scripts.planner.main
    CC=6  in:0  out:16  total:16
  scripts.digital_twin.create_twin_environment
    CC=5  in:1  out:15  total:16
  scripts.planner.call_llm
    CC=5  in:1  out:14  total:15
  scripts.digital_twin.run_twin_verification
    CC=9  in:1  out:13  total:14
  scripts.history.compute_dir_hash
    CC=3  in:2  out:12  total:14
  scripts.planner.log_conversation
    CC=1  in:1  out:12  total:13
  packages.developer.proc.dev.chat.taskand.dev.v1.bin.out
    CC=5  in:0  out:12  total:12
  scripts.planner.parse_plan
    CC=11  in:1  out:10  total:11
  scripts.planner.load_dot_env
    CC=6  in:1  out:9  total:10
  scripts.dod_validator.validate_dod
    CC=19  in:0  out:10  total:10
  scripts.planner.parse_simple_yaml
    CC=6  in:1  out:9  total:10
  packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
    CC=3  in:3  out:7  total:10

MODULES:
  history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile  [1 funcs]
    print  CC=0  out:0
  packages.developer.proc.dev.chat.taskand.dev.v1.bin  [2 funcs]
    getRepoRoot  CC=8  out:5
    out  CC=5  out:12
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin  [8 funcs]
    allowed  CC=3  out:3
    consumer  CC=3  out:3
    envPath  CC=4  out:5
    found  CC=4  out:5
    logAudit  CC=2  out:4
    match  CC=2  out:3
    purpose  CC=3  out:3
    secretName  CC=3  out:3
  packages.web.proc.flow.login.taskand.dev.v1.bin  [4 funcs]
    analysis  CC=1  out:1
    callUri  CC=3  out:7
    page  CC=2  out:2
    session  CC=3  out:1
  scripts.digital_twin  [6 funcs]
    ask_llm_for_repair  CC=8  out:20
    create_twin_environment  CC=5  out:15
    load_env  CC=6  out:7
    log  CC=1  out:1
    run_twin_verification  CC=9  out:13
    verify_and_evolve  CC=6  out:30
  scripts.dod_validator  [2 funcs]
    run_cmd  CC=1  out:4
    validate_dod  CC=19  out:10
  scripts.history  [6 funcs]
    compute_dir_hash  CC=3  out:12
    create_snapshot  CC=9  out:33
    ensure_dirs  CC=2  out:4
    list_history  CC=21  out:52
    rollback  CC=20  out:59
    show_details  CC=12  out:44
  scripts.planner  [8 funcs]
    call_llm  CC=5  out:14
    get_environment  CC=2  out:7
    get_recent_conversations  CC=7  out:6
    load_dot_env  CC=6  out:9
    log_conversation  CC=1  out:12
    main  CC=6  out:16
    parse_plan  CC=11  out:10
    parse_simple_yaml  CC=6  out:9
  scripts.verify-conformance  [4 funcs]
    cat  CC=1  out:1
    check  CC=3  out:3
    hasInteractive  CC=1  out:1
    hasServe  CC=1  out:2

EDGES:
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.envPath → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.match
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.found → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.match
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.consumer → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.purpose → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.secretName → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.allowed → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.developer.proc.dev.chat.taskand.dev.v1.bin.out → packages.developer.proc.dev.chat.taskand.dev.v1.bin.getRepoRoot
  packages.web.proc.flow.login.taskand.dev.v1.bin.session → packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
  packages.web.proc.flow.login.taskand.dev.v1.bin.page → packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
  packages.web.proc.flow.login.taskand.dev.v1.bin.analysis → packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
  scripts.dod_validator.validate_dod → scripts.dod_validator.run_cmd
  scripts.planner.get_environment → scripts.planner.load_dot_env
  scripts.planner.get_environment → scripts.planner.parse_simple_yaml
  scripts.planner.call_llm → scripts.planner.get_recent_conversations
  scripts.planner.main → scripts.planner.get_environment
  scripts.planner.main → scripts.planner.call_llm
  scripts.planner.main → scripts.planner.parse_plan
  scripts.planner.main → scripts.planner.log_conversation
  scripts.planner.main → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.create_snapshot → scripts.history.ensure_dirs
  scripts.history.create_snapshot → scripts.history.compute_dir_hash
  scripts.history.create_snapshot → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.list_history → scripts.history.ensure_dirs
  scripts.history.list_history → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.show_details → scripts.history.ensure_dirs
  scripts.history.show_details → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.ensure_dirs
  scripts.history.rollback → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.compute_dir_hash
  scripts.digital_twin.log → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.digital_twin.create_twin_environment → scripts.digital_twin.log
  scripts.digital_twin.run_twin_verification → scripts.digital_twin.log
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.load_env
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.create_twin_environment
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.run_twin_verification
  scripts.verify-conformance.cat → scripts.verify-conformance.check
  scripts.verify-conformance.hasServe → scripts.verify-conformance.check
  scripts.verify-conformance.hasInteractive → scripts.verify-conformance.check
```

## Test Contracts

*Scenarios as contract signatures — what the system guarantees.*

### Api (1)

**`Auto-generated API Smoke Tests`**
- assert `_status < 500`
- assert `_status >= 200`
- detectors: ConfigEndpointDetector

## Refactoring Analysis

*Pre-refactoring snapshot — use this section to identify targets. Generated from `project/` toon files.*

### Call Graph & Complexity (`project/calls.toon.yaml`)

```toon markpact:analysis path=project/calls.toon.yaml
# code2llm call graph | /home/tom/github/semcod/taskand/glm53
# generated in 0.05s
# nodes: 41 | edges: 41 | modules: 9
# CC̄=3.2

HUBS[20]:
  scripts.history.rollback
    CC=20  in:0  out:59  total:59
  history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
    CC=0  in:57  out:0  total:57
  scripts.history.list_history
    CC=21  in:0  out:52  total:52
  scripts.history.show_details
    CC=12  in:0  out:44  total:44
  scripts.history.create_snapshot
    CC=9  in:0  out:33  total:33
  scripts.digital_twin.verify_and_evolve
    CC=6  in:0  out:30  total:30
  scripts.digital_twin.log
    CC=1  in:21  out:1  total:22
  scripts.digital_twin.ask_llm_for_repair
    CC=8  in:1  out:20  total:21
  scripts.planner.main
    CC=6  in:0  out:16  total:16
  scripts.digital_twin.create_twin_environment
    CC=5  in:1  out:15  total:16
  scripts.planner.call_llm
    CC=5  in:1  out:14  total:15
  scripts.digital_twin.run_twin_verification
    CC=9  in:1  out:13  total:14
  scripts.history.compute_dir_hash
    CC=3  in:2  out:12  total:14
  scripts.planner.log_conversation
    CC=1  in:1  out:12  total:13
  packages.developer.proc.dev.chat.taskand.dev.v1.bin.out
    CC=5  in:0  out:12  total:12
  scripts.planner.parse_plan
    CC=11  in:1  out:10  total:11
  scripts.planner.load_dot_env
    CC=6  in:1  out:9  total:10
  scripts.dod_validator.validate_dod
    CC=19  in:0  out:10  total:10
  scripts.planner.parse_simple_yaml
    CC=6  in:1  out:9  total:10
  packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
    CC=3  in:3  out:7  total:10

MODULES:
  history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile  [1 funcs]
    print  CC=0  out:0
  packages.developer.proc.dev.chat.taskand.dev.v1.bin  [2 funcs]
    getRepoRoot  CC=8  out:5
    out  CC=5  out:12
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin  [8 funcs]
    allowed  CC=3  out:3
    consumer  CC=3  out:3
    envPath  CC=4  out:5
    found  CC=4  out:5
    logAudit  CC=2  out:4
    match  CC=2  out:3
    purpose  CC=3  out:3
    secretName  CC=3  out:3
  packages.web.proc.flow.login.taskand.dev.v1.bin  [4 funcs]
    analysis  CC=1  out:1
    callUri  CC=3  out:7
    page  CC=2  out:2
    session  CC=3  out:1
  scripts.digital_twin  [6 funcs]
    ask_llm_for_repair  CC=8  out:20
    create_twin_environment  CC=5  out:15
    load_env  CC=6  out:7
    log  CC=1  out:1
    run_twin_verification  CC=9  out:13
    verify_and_evolve  CC=6  out:30
  scripts.dod_validator  [2 funcs]
    run_cmd  CC=1  out:4
    validate_dod  CC=19  out:10
  scripts.history  [6 funcs]
    compute_dir_hash  CC=3  out:12
    create_snapshot  CC=9  out:33
    ensure_dirs  CC=2  out:4
    list_history  CC=21  out:52
    rollback  CC=20  out:59
    show_details  CC=12  out:44
  scripts.planner  [8 funcs]
    call_llm  CC=5  out:14
    get_environment  CC=2  out:7
    get_recent_conversations  CC=7  out:6
    load_dot_env  CC=6  out:9
    log_conversation  CC=1  out:12
    main  CC=6  out:16
    parse_plan  CC=11  out:10
    parse_simple_yaml  CC=6  out:9
  scripts.verify-conformance  [4 funcs]
    cat  CC=1  out:1
    check  CC=3  out:3
    hasInteractive  CC=1  out:1
    hasServe  CC=1  out:2

EDGES:
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.envPath → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.match
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.found → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.match
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.consumer → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.purpose → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.secretName → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.vault.proc.vault.secrets.taskand.dev.v1.bin.allowed → packages.vault.proc.vault.secrets.taskand.dev.v1.bin.logAudit
  packages.developer.proc.dev.chat.taskand.dev.v1.bin.out → packages.developer.proc.dev.chat.taskand.dev.v1.bin.getRepoRoot
  packages.web.proc.flow.login.taskand.dev.v1.bin.session → packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
  packages.web.proc.flow.login.taskand.dev.v1.bin.page → packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
  packages.web.proc.flow.login.taskand.dev.v1.bin.analysis → packages.web.proc.flow.login.taskand.dev.v1.bin.callUri
  scripts.dod_validator.validate_dod → scripts.dod_validator.run_cmd
  scripts.planner.get_environment → scripts.planner.load_dot_env
  scripts.planner.get_environment → scripts.planner.parse_simple_yaml
  scripts.planner.call_llm → scripts.planner.get_recent_conversations
  scripts.planner.main → scripts.planner.get_environment
  scripts.planner.main → scripts.planner.call_llm
  scripts.planner.main → scripts.planner.parse_plan
  scripts.planner.main → scripts.planner.log_conversation
  scripts.planner.main → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.create_snapshot → scripts.history.ensure_dirs
  scripts.history.create_snapshot → scripts.history.compute_dir_hash
  scripts.history.create_snapshot → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.list_history → scripts.history.ensure_dirs
  scripts.history.list_history → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.show_details → scripts.history.ensure_dirs
  scripts.history.show_details → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.ensure_dirs
  scripts.history.rollback → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.compute_dir_hash
  scripts.digital_twin.log → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.digital_twin.create_twin_environment → scripts.digital_twin.log
  scripts.digital_twin.run_twin_verification → scripts.digital_twin.log
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.load_env
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → history.snapshots.snap-t1789203598.files.taskand.gateway.Dockerfile.print
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.create_twin_environment
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.run_twin_verification
  scripts.verify-conformance.cat → scripts.verify-conformance.check
  scripts.verify-conformance.hasServe → scripts.verify-conformance.check
  scripts.verify-conformance.hasInteractive → scripts.verify-conformance.check
```

### Code Analysis (`project/analysis.toon.yaml`)

```toon markpact:analysis path=project/analysis.toon.yaml
# code2llm | 230f 11023L | yaml:77,javascript:77,json:29,shell:5,python:4 | 2026-09-12
# generated in 0.06s
# CC̅=3.2 | critical:21/501 | dups:0 | cycles:0

HEALTH[20]:
  🟡 CC    portIdx CC=15 (limit:15)
  🟡 CC    port CC=15 (limit:15)
  🟡 CC    server CC=15 (limit:15)
  🟡 CC    low CC=17 (limit:15)
  🟡 CC    norm CC=17 (limit:15)
  🟡 CC    low CC=20 (limit:15)
  🟡 CC    norm CC=20 (limit:15)
  🟡 CC    webUrl CC=19 (limit:15)
  🟡 CC    gatewayUrl CC=19 (limit:15)
  🟡 CC    mockResults CC=19 (limit:15)
  🟡 CC    validate_dod CC=19 (limit:15)
  🟡 CC    list_history CC=21 (limit:15)
  🟡 CC    rollback CC=20 (limit:15)
  🟡 CC    targetDevice CC=15 (limit:15)
  🟡 CC    VNC CC=15 (limit:15)
  🟡 CC    portIdx CC=15 (limit:15)
  🟡 CC    port CC=15 (limit:15)
  🟡 CC    server CC=15 (limit:15)
  🟡 CC    portIdx CC=15 (limit:15)
  🟡 CC    port CC=15 (limit:15)

REFACTOR[1]:
  1. split 20 high-CC methods  (CC>15)

PIPELINES[407]:
  [1] Src [updateMode]: updateMode
      PURITY: 100% pure
  [2] Src [binContent]: binContent
      PURITY: 100% pure
  [3] Src [yamlContent]: yamlContent
      PURITY: 100% pure
  [4] Src [testContent]: testContent
      PURITY: 100% pure
  [5] Src [catalog]: catalog
      PURITY: 100% pure
  [6] Src [errCount]: errCount
      PURITY: 100% pure
  [7] Src [curBinHash]: curBinHash
      PURITY: 100% pure
  [8] Src [curYamlHash]: curYamlHash
      PURITY: 100% pure
  [9] Src [raw]: raw
      PURITY: 100% pure
  [10] Src [dir]: dir
      PURITY: 100% pure
  [11] Src [r]: r
      PURITY: 100% pure
  [12] Src [raw]: raw
      PURITY: 100% pure
  [13] Src [checkDocker]: checkDocker
      PURITY: 100% pure
  [14] Src [checkGit]: checkGit
      PURITY: 100% pure
  [15] Src [checkEnv]: checkEnv
      PURITY: 100% pure
  [16] Src [dir]: dir
      PURITY: 100% pure
  [17] Src [bad]: bad
      PURITY: 100% pure
  [18] Src [good]: good
      PURITY: 100% pure
  [19] Src [raw]: raw
      PURITY: 100% pure
  [20] Src [targetRole]: targetRole
      PURITY: 100% pure
  [21] Src [dir]: dir
      PURITY: 100% pure
  [22] Src [bad]: bad
      PURITY: 100% pure
  [23] Src [good]: good
      PURITY: 100% pure
  [24] Src [raw]: raw
      PURITY: 100% pure
  [25] Src [targetOrg]: targetOrg
      PURITY: 100% pure
  [26] Src [getRepoRoot]: getRepoRoot
      PURITY: 100% pure
  [27] Src [cur]: cur
      PURITY: 100% pure
  [28] Src [content]: content
      PURITY: 100% pure
  [29] Src [pkgDir]: pkgDir
      PURITY: 100% pure
  [30] Src [alreadyExists]: alreadyExists
      PURITY: 100% pure
  [31] Src [gTxt]: gTxt
      PURITY: 100% pure
  [32] Src [dir]: dir
      PURITY: 100% pure
  [33] Src [bad]: bad
      PURITY: 100% pure
  [34] Src [noOrg]: noOrg
      PURITY: 100% pure
  [35] Src [good]: good
      PURITY: 100% pure
  [36] Src [out]: out
      PURITY: 100% pure
  [37] Src [loadCatalog]: loadCatalog
      PURITY: 100% pure
  [38] Src [p]: p
      PURITY: 100% pure
  [39] Src [portIdx]: portIdx
      PURITY: 100% pure
  [40] Src [port]: port
      PURITY: 100% pure
  [41] Src [catalog]: catalog
      PURITY: 100% pure
  [42] Src [server]: server
      PURITY: 100% pure
  [43] Src [processes]: processes
      PURITY: 100% pure
  [44] Src [m]: m
      PURITY: 100% pure
  [45] Src [filePath]: filePath
      PURITY: 100% pure
  [46] Src [raw]: raw
      PURITY: 100% pure
  [47] Src [action]: action
      PURITY: 100% pure
  [48] Src [dir]: dir
      PURITY: 100% pure
  [49] Src [bad]: bad
      PURITY: 100% pure
  [50] Src [good]: good
      PURITY: 100% pure

LAYERS:
  scripts/                        CC̄=4.7    ←in:0  →out:57  !! split
  │ !! history                    309L  0C    6m  CC=21     ←0
  │ digital_twin               249L  0C    6m  CC=9      ←0
  │ planner                    234L  0C    8m  CC=11     ←0
  │ verify-conformance.mjs     199L  0C   25m  CC=7      ←0
  │ taskand-new-pkg.sh         165L  0C    0m  CC=0.0    ←0
  │ !! dod_validator               79L  0C    2m  CC=19     ←0
  │ taskand-runner.mjs          54L  0C    9m  CC=2      ←0
  │
  packages/                       CC̄=3.2    ←in:0  →out:0
  │ bin.mjs                    318L  0C   36m  CC=8      ←0
  │ bin.mjs                    147L  0C   15m  CC=4      ←0
  │ bin.mjs                    145L  0C   16m  CC=2      ←0
  │ !! bin.mjs                    133L  0C   11m  CC=15     ←0
  │ !! bin.mjs                    133L  0C   11m  CC=15     ←0
  │ !! bin.mjs                    133L  0C   11m  CC=15     ←0
  │ !! bin.mjs                    125L  0C   12m  CC=19     ←0
  │ !! bin.mjs                    120L  0C    7m  CC=15     ←0
  │ bin.mjs                    108L  0C   12m  CC=8      ←0
  │ bin.mjs                    108L  0C   12m  CC=8      ←0
  │ bin.mjs                    108L  0C   12m  CC=8      ←0
  │ bin.mjs                    108L  0C   12m  CC=8      ←0
  │ bin.mjs                    108L  0C   12m  CC=8      ←0
  │ bin.mjs                    108L  0C   12m  CC=8      ←0
  │ !! bin.mjs                     94L  0C   11m  CC=20     ←0
  │ bin.mjs                     82L  0C    9m  CC=3      ←0
  │ bin.mjs                     76L  0C    3m  CC=10     ←0
  │ !! bin.mjs                     73L  0C    9m  CC=17     ←0
  │ capsule.yaml                63L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           63L  0C    0m  CC=0.0    ←0
  │ capsule.yaml                62L  0C    0m  CC=0.0    ←0
  │ test.mjs                    61L  0C    8m  CC=3      ←0
  │ bin.mjs                     52L  0C    3m  CC=2      ←0
  │ capsule.yaml                51L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           49L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           49L  0C    0m  CC=0.0    ←0
  │ bin.mjs                     47L  0C    5m  CC=3      ←0
  │ capsule.yaml                45L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           42L  0C    0m  CC=0.0    ←0
  │ capsule.yaml                42L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           42L  0C    0m  CC=0.0    ←0
  │ capsule.yaml                42L  0C    0m  CC=0.0    ←0
  │ capsule.yaml                42L  0C    0m  CC=0.0    ←0
  │ capsule.yaml                42L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ Makefile                    40L  0C    0m  CC=0.0    ←0
  │ bin.mjs                     39L  0C    2m  CC=2      ←0
  │ bin.mjs                     39L  0C    3m  CC=2      ←0
  │ bin.mjs                     38L  0C    3m  CC=2      ←0
  │ bin.mjs                     37L  0C    2m  CC=2      ←0
  │ bin.mjs                     36L  0C    4m  CC=2      ←0
  │ test.mjs                    36L  0C    4m  CC=7      ←0
  │ test.mjs                    35L  0C    5m  CC=6      ←0
  │ test.mjs                    35L  0C    6m  CC=9      ←0
  │ bin.mjs                     35L  0C    2m  CC=2      ←0
  │ bin.mjs                     35L  0C    4m  CC=7      ←0
  │ proc-catalog.json           35L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           35L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           35L  0C    0m  CC=0.0    ←0
  │ bin.mjs                     34L  0C    3m  CC=10     ←0
  │ bin.mjs                     33L  0C    5m  CC=2      ←0
  │ test.mjs                    33L  0C    4m  CC=6      ←0
  │ Makefile                    33L  0C    0m  CC=0.0    ←0
  │ test.mjs                    30L  0C    5m  CC=7      ←0
  │ test.mjs                    30L  0C    5m  CC=7      ←0
  │ bin.mjs                     30L  0C    3m  CC=2      ←0
  │ test.mjs                    30L  0C    5m  CC=7      ←0
  │ bin.mjs                     30L  0C    1m  CC=2      ←0
  │ test.mjs                    30L  0C    5m  CC=7      ←0
  │ test.mjs                    30L  0C    5m  CC=7      ←0
  │ test.mjs                    30L  0C    5m  CC=7      ←0
  │ capsule.yaml                30L  0C    0m  CC=0.0    ←0
  │ qualification.yaml          30L  0C    0m  CC=0.0    ←0
  │ bin.mjs                     29L  0C    2m  CC=2      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ test.mjs                    27L  0C    4m  CC=3      ←0
  │ bin.mjs                     26L  0C    2m  CC=2      ←0
  │ bin.mjs                     26L  0C    2m  CC=2      ←0
  │ test.mjs                    24L  0C    4m  CC=7      ←0
  │ bin.mjs                     24L  0C    3m  CC=2      ←0
  │ test.mjs                    24L  0C    4m  CC=6      ←0
  │ capsule.yaml                24L  0C    0m  CC=0.0    ←0
  │ test.mjs                    23L  0C    3m  CC=3      ←0
  │ test.mjs                    23L  0C    3m  CC=3      ←0
  │ test.mjs                    22L  0C    3m  CC=3      ←0
  │ test.mjs                    22L  0C    3m  CC=4      ←0
  │ proc-catalog.json           21L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   20L  0C    0m  CC=0.0    ←0
  │ test.mjs                    19L  0C    3m  CC=3      ←0
  │ test.mjs                    19L  0C    3m  CC=3      ←0
  │ bin.mjs                     19L  0C    1m  CC=2      ←0
  │ test.mjs                    17L  0C    3m  CC=1      ←0
  │ test.mjs                    16L  0C    3m  CC=3      ←0
  │ claim-crm-retry.yaml        16L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ claim-environment-immutable.yaml    14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   14L  0C    0m  CC=0.0    ←0
  │ bin.mjs                     13L  0C    1m  CC=2      ←0
  │ twin.compose.yaml           13L  0C    0m  CC=0.0    ←0
  │ test.mjs                    12L  0C    3m  CC=1      ←0
  │ test.mjs                    12L  0C    3m  CC=1      ←0
  │ test.mjs                    12L  0C    3m  CC=1      ←0
  │ test.mjs                    12L  0C    3m  CC=1      ←0
  │ test.mjs                    11L  0C    2m  CC=1      ←0
  │ grants.yaml                 11L  0C    0m  CC=0.0    ←0
  │ qualification.yaml          11L  0C    0m  CC=0.0    ←0
  │ qualification.yaml          11L  0C    0m  CC=0.0    ←0
  │ grants.yaml                 11L  0C    0m  CC=0.0    ←0
  │ grants.yaml                 11L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   10L  0C    0m  CC=0.0    ←0
  │ grants.yaml                 10L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   10L  0C    0m  CC=0.0    ←0
  │ proc.yaml                   10L  0C    0m  CC=0.0    ←0
  │ package.json                10L  0C    0m  CC=0.0    ←0
  │ package.json                10L  0C    0m  CC=0.0    ←0
  │ test.mjs                     9L  0C    3m  CC=1      ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    9L  0C    0m  CC=0.0    ←0
  │ claim-developer.yaml         8L  0C    0m  CC=0.0    ←0
  │ claim-chat.yaml              8L  0C    0m  CC=0.0    ←0
  │ test.mjs                     7L  0C    2m  CC=1      ←0
  │ test.mjs                     7L  0C    2m  CC=1      ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ package.json                 5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ spec.yaml                    3L  0C    0m  CC=0.0    ←0
  │
  ./                              CC̄=1.8    ←in:0  →out:0
  │ !! planfile.yaml              643L  0C    0m  CC=0.0    ←0
  │ !! goal.yaml                  523L  0C    0m  CC=0.0    ←0
  │ Dockerfile                 374L  0C    2m  CC=0.0    ←0
  │ genome.yaml                149L  0C    0m  CC=0.0    ←0
  │ Makefile                   139L  0C    0m  CC=0.0    ←0
  │ prefact.yaml                94L  0C    0m  CC=0.0    ←0
  │ capsule.yaml                82L  0C    0m  CC=0.0    ←0
  │ docker-compose.yaml         81L  0C    0m  CC=0.0    ←0
  │ verify-catalog.mjs          71L  0C    8m  CC=5      ←0
  │ taskand.sh                  59L  0C    1m  CC=0.0    ←0
  │ project.sh                  59L  0C    0m  CC=0.0    ←0
  │ environment.yaml            43L  0C    0m  CC=0.0    ←0
  │ proc-catalog.json           42L  0C    0m  CC=0.0    ←0
  │ federation-spec.yaml        37L  0C    0m  CC=0.0    ←0
  │ grants.yaml                 34L  0C    0m  CC=0.0    ←0
  │ serve.sh                    21L  0C    0m  CC=0.0    ←0
  │ package.json                10L  0C    0m  CC=0.0    ←0
  │
  templates/                      CC̄=1.8    ←in:0  →out:0
  │ status.template.mjs         25L  0C    4m  CC=2      ←0
  │ capsule.template.yaml       13L  0C    0m  CC=0.0    ←0
  │
  bootstrap/                      CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                 374L  0C    2m  CC=0.0    ←0
  │
  history/                        CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                  63L  1C    6m  CC=0.0    ←3
  │ docker-compose.yaml         56L  0C    0m  CC=0.0    ←0
  │ manifest.json               18L  0C    0m  CC=0.0    ←0
  │ history.yaml                 9L  0C    0m  CC=0.0    ←0
  │
  gateway/                        CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                 453L  1C   10m  CC=0.0    ←0
  │
  schemas/                        CC̄=0.0    ←in:0  →out:0
  │ capsule.v1.json             39L  0C    0m  CC=0.0    ←0
  │ envelope.v1.json            30L  0C    0m  CC=0.0    ←0
  │ cloudevents.v1.json         22L  0C    0m  CC=0.0    ←0
  │ browser-session.v1.json     15L  0C    0m  CC=0.0    ←0
  │ browser-command.v1.json     14L  0C    0m  CC=0.0    ←0
  │
  strategy/                       CC̄=0.0    ←in:0  →out:0
  │ default.yaml                13L  0C    0m  CC=0.0    ←0
  │
  tasks/                          CC̄=0.0    ←in:0  →out:0
  │ done.yaml                   16L  0C    0m  CC=0.0    ←0
  │ inbox.yaml                   0L  0C    0m  CC=0.0    ←0
  │
  testql-scenarios/               CC̄=0.0    ←in:0  →out:0
  │ generated-api-smoke.testql.toon.yaml    39L  0C    0m  CC=0.0    ←0
  │
  skills/                         CC̄=0.0    ←in:0  →out:0
  │ browser-automation.yaml     11L  0C    0m  CC=0.0    ←0
  │
  evolution/                      CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  24L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  24L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  24L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  24L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  23L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  23L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  23L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  17L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  17L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  17L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  16L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  10L  0C    0m  CC=0.0    ←0
  │ Dockerfile                   7L  0C    0m  CC=0.0    ←0
  │ TWIN_VERIFIED.json           6L  0C    0m  CC=0.0    ←0
  │ TWIN_VERIFIED.json           6L  0C    0m  CC=0.0    ←0
  │ Dockerfile                   4L  0C    0m  CC=0.0    ←0
  │ Dockerfile                   4L  0C    0m  CC=0.0    ←0
  │ Dockerfile                   3L  0C    0m  CC=0.0    ←0
  │
  landing/                        CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                   5L  0C    0m  CC=0.0    ←0
  │
  answers/                        CC̄=0.0    ←in:0  →out:0
  │ taskand.answers.yaml         5L  0C    0m  CC=0.0    ←0
  │
  proc/                           CC̄=0.0    ←in:0  →out:0
  │ spawn-remote.sh             35L  0C    0m  CC=0.0    ←0
  │
  vms/                            CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                   9L  0C    0m  CC=0.0    ←0
  │
  ── zero ──
     tasks/inbox.yaml                          0L

COUPLING:
                     history.snapshots            scripts
  history.snapshots                 ──                ←57  hub
            scripts                 57                 ──  !! fan-out
  CYCLES: none
  HUB: history.snapshots/ (fan-in=57)
  SMELL: scripts/ fan-out=57 → split needed

EXTERNAL:
  validation: run `vallm batch .` → validation.toon
  duplication: run `redup scan .` → duplication.toon
```

### Duplication (`project/duplication.toon.yaml`)

```toon markpact:analysis path=project/duplication.toon.yaml
# redup/duplication | 5 groups | 67f 9673L | 2026-09-12

SUMMARY:
  files_scanned: 67
  total_lines:   9673
  dup_groups:    5
  actionable:    0
  review:        0
  generated:     5
  actionable_L:  0
  review_L:      0
  generated_L:   746
  dup_fragments: 48
  saved_lines:   746
  scan_ms:       413

DUPLICATES[5] (ranked by impact):
  [d9d13a264318e0a6] !! EXAC  arrow_function  L=54 N=10 saved=486 sim=1.00
      provenance=vendored_copy action=generated
      packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/chat/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/demo/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/developer/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/doctor/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/vault/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      packages/web/proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
      proc/registry/serve/taskand.dev/v1/bin.mjs:32-85  (arrow_function)
  [c6b7020e3edde9ae] ! EXAC  loadCatalog  L=11 N=10 saved=99 sim=1.00
      provenance=vendored_copy action=generated
      packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/chat/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/demo/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/developer/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/doctor/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/vault/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      packages/web/proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
      proc/registry/serve/taskand.dev/v1/bin.mjs:14-24  (loadCatalog)
  [55f8d531985fb8f5] ! EXAC  arrow_function  L=5 N=20 saved=95 sim=1.00
      provenance=vendored_copy action=generated
      packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/chat/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/chat/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/demo/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/demo/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/developer/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/developer/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/doctor/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/doctor/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/vault/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/vault/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      packages/web/proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      packages/web/proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
      proc/registry/serve/taskand.dev/v1/bin.mjs:45-49  (arrow_function)
      proc/registry/serve/taskand.dev/v1/bin.mjs:109-113  (arrow_function)
  [79487b97cdb77325] ! EXAC  getRepoRoot  L=10 N=6 saved=50 sim=1.00
      provenance=vendored_copy action=generated
      packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/bin.mjs:29-38  (getRepoRoot)
      packages/chat/proc/chat/spawn/taskand.dev/v1/bin.mjs:29-38  (getRepoRoot)
      packages/developer/proc/developer/spawn/taskand.dev/v1/bin.mjs:29-38  (getRepoRoot)
      packages/doctor/proc/doctor/spawn/taskand.dev/v1/bin.mjs:29-38  (getRepoRoot)
      packages/vault/proc/vault/spawn/taskand.dev/v1/bin.mjs:29-38  (getRepoRoot)
      packages/web/proc/web/spawn/taskand.dev/v1/bin.mjs:29-38  (getRepoRoot)
  [48ac384d5bff9801]   EXAC  arrow_function  L=16 N=2 saved=16 sim=1.00
      provenance=deployment_mirror action=generated
      packages/web/proc/flow/login/taskand.dev/v1/bin.mjs:8-23  (arrow_function)
      proc/flow/login/taskand.dev/v1/bin.mjs:8-23  (arrow_function)

METRICS-TARGET:
  dup_groups:  5 → 0
  saved_lines: 746 lines recoverable
```

### Evolution / Churn (`project/evolution.toon.yaml`)

```toon markpact:analysis path=project/evolution.toon.yaml
# code2llm/evolution | 445 func | 80f | 2026-09-12
# generated in 0.00s

NEXT[10] (ranked by impact):
  [1] !  SPLIT-FUNC      low  CC=20  fan=17
      WHY: CC=20 exceeds 15
      EFFORT: ~1h  IMPACT: 340

  [2] !  SPLIT-FUNC      norm  CC=20  fan=17
      WHY: CC=20 exceeds 15
      EFFORT: ~1h  IMPACT: 340

  [3] !  SPLIT-FUNC      targetDevice  CC=15  fan=15
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 225

  [4] !  SPLIT-FUNC      VNC  CC=15  fan=15
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 225

  [5] !  SPLIT-FUNC      low  CC=17  fan=12
      WHY: CC=17 exceeds 15
      EFFORT: ~1h  IMPACT: 204

  [6] !  SPLIT-FUNC      norm  CC=17  fan=12
      WHY: CC=17 exceeds 15
      EFFORT: ~1h  IMPACT: 204

  [7] !  SPLIT-FUNC      portIdx  CC=15  fan=11
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 165

  [8] !  SPLIT-FUNC      port  CC=15  fan=11
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 165

  [9] !  SPLIT-FUNC      server  CC=15  fan=11
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 165

  [10] !  SPLIT-FUNC      portIdx  CC=15  fan=11
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 165


RISKS[2]:
  ⚠ Splitting planfile.yaml may break 0 import paths
  ⚠ Splitting goal.yaml may break 0 import paths

METRICS-TARGET:
  CC̄:          3.0 → ≤2.1
  max-CC:      20 → ≤10
  god-modules: 2 → 0
  high-CC(≥15): 18 → ≤9
  hub-types:   0 → ≤0

PATTERNS (language parser shared logic):
  _extract_declarations() in base.py — unified extraction for:
    - TypeScript: interfaces, types, classes, functions, arrow funcs
    - PHP: namespaces, traits, classes, functions, includes
    - Ruby: modules, classes, methods, requires
    - C++: classes, structs, functions, #includes
    - C#: classes, interfaces, methods, usings
    - Java: classes, interfaces, methods, imports
    - Go: packages, functions, structs
    - Rust: modules, functions, traits, use statements

  Shared regex patterns per language:
    - import: language-specific import/require/using patterns
    - class: class/struct/trait declarations with inheritance
    - function: function/method signatures with visibility
    - brace_tracking: for C-family languages ({ })
    - end_keyword_tracking: for Ruby (module/class/def...end)

  Benefits:
    - Consistent extraction logic across all languages
    - Reduced code duplication (~70% reduction in parser LOC)
    - Easier maintenance: fix once, apply everywhere
    - Standardized FunctionInfo/ClassInfo models

HISTORY:
  prev CC̄=3.4 → now CC̄=3.0
```

## Intent

taskand-glm53 v1.5 — Samo-Replikujący się Ekosystem Organizmów (Standard v1.5)
