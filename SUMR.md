# taskand-glm53 v0.4.2 — Autonomiczny Proces w Dockerfile

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
- **generated_from**: Makefile, testql(1), app.doql.less, .env.example, Dockerfile, project/(5 analysis files)

## Architecture

```
SUMD (description) → DOQL/source (code) → taskfile (automation) → testql (verification)
```

### DOQL Application Declaration (`app.doql.less`)

```less markpact:doql path=app.doql.less
// LESS format — define @variables here as needed

app {
  name: glm53;
  version: 0.1.0;
}

interface[type="web"] {
  type: spa;
  framework: static;
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

*15 nodes · 20 edges · 4 modules · CC̄=3.5*

### Hubs (by degree)

| Function | CC | in | out | total |
|----------|----|----|-----|-------|
| `rollback` *(in scripts.history)* | 20 ⚠ | 0 | 59 | **59** |
| `list_history` *(in scripts.history)* | 21 ⚠ | 0 | 52 | **52** |
| `print` *(in gateway.Dockerfile)* | 0 | 51 | 0 | **51** |
| `show_details` *(in scripts.history)* | 12 ⚠ | 0 | 44 | **44** |
| `create_snapshot` *(in scripts.history)* | 9 | 0 | 33 | **33** |
| `verify_and_evolve` *(in scripts.digital_twin)* | 6 | 0 | 30 | **30** |
| `log` *(in scripts.digital_twin)* | 1 | 21 | 1 | **22** |
| `ask_llm_for_repair` *(in scripts.digital_twin)* | 8 | 1 | 20 | **21** |

```toon markpact:analysis path=project/calls.toon.yaml
# code2llm call graph | /home/tom/github/semcod/taskand/glm53
# generated in 0.01s
# nodes: 15 | edges: 20 | modules: 4
# CC̄=3.5

HUBS[20]:
  scripts.history.rollback
    CC=20  in:0  out:59  total:59
  scripts.history.list_history
    CC=21  in:0  out:52  total:52
  gateway.Dockerfile.print
    CC=0  in:51  out:0  total:51
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
  scripts.digital_twin.create_twin_environment
    CC=5  in:1  out:15  total:16
  scripts.digital_twin.run_twin_verification
    CC=9  in:1  out:13  total:14
  scripts.history.compute_dir_hash
    CC=3  in:2  out:12  total:14
  scripts.dod_validator.validate_dod
    CC=19  in:0  out:10  total:10
  scripts.history.ensure_dirs
    CC=2  in:4  out:4  total:8
  scripts.digital_twin.load_env
    CC=6  in:1  out:7  total:8
  scripts.dod_validator.run_cmd
    CC=1  in:3  out:4  total:7

MODULES:
  gateway.Dockerfile  [1 funcs]
    print  CC=0  out:0
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

EDGES:
  scripts.dod_validator.validate_dod → scripts.dod_validator.run_cmd
  scripts.digital_twin.log → gateway.Dockerfile.print
  scripts.digital_twin.create_twin_environment → scripts.digital_twin.log
  scripts.digital_twin.run_twin_verification → scripts.digital_twin.log
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.load_env
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → gateway.Dockerfile.print
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.create_twin_environment
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.run_twin_verification
  scripts.history.create_snapshot → scripts.history.ensure_dirs
  scripts.history.create_snapshot → scripts.history.compute_dir_hash
  scripts.history.create_snapshot → gateway.Dockerfile.print
  scripts.history.list_history → scripts.history.ensure_dirs
  scripts.history.list_history → gateway.Dockerfile.print
  scripts.history.show_details → scripts.history.ensure_dirs
  scripts.history.show_details → gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.ensure_dirs
  scripts.history.rollback → gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.compute_dir_hash
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
# generated in 0.01s
# nodes: 15 | edges: 20 | modules: 4
# CC̄=3.5

HUBS[20]:
  scripts.history.rollback
    CC=20  in:0  out:59  total:59
  scripts.history.list_history
    CC=21  in:0  out:52  total:52
  gateway.Dockerfile.print
    CC=0  in:51  out:0  total:51
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
  scripts.digital_twin.create_twin_environment
    CC=5  in:1  out:15  total:16
  scripts.digital_twin.run_twin_verification
    CC=9  in:1  out:13  total:14
  scripts.history.compute_dir_hash
    CC=3  in:2  out:12  total:14
  scripts.dod_validator.validate_dod
    CC=19  in:0  out:10  total:10
  scripts.history.ensure_dirs
    CC=2  in:4  out:4  total:8
  scripts.digital_twin.load_env
    CC=6  in:1  out:7  total:8
  scripts.dod_validator.run_cmd
    CC=1  in:3  out:4  total:7

MODULES:
  gateway.Dockerfile  [1 funcs]
    print  CC=0  out:0
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

EDGES:
  scripts.dod_validator.validate_dod → scripts.dod_validator.run_cmd
  scripts.digital_twin.log → gateway.Dockerfile.print
  scripts.digital_twin.create_twin_environment → scripts.digital_twin.log
  scripts.digital_twin.run_twin_verification → scripts.digital_twin.log
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.load_env
  scripts.digital_twin.ask_llm_for_repair → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → gateway.Dockerfile.print
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.log
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.create_twin_environment
  scripts.digital_twin.verify_and_evolve → scripts.digital_twin.run_twin_verification
  scripts.history.create_snapshot → scripts.history.ensure_dirs
  scripts.history.create_snapshot → scripts.history.compute_dir_hash
  scripts.history.create_snapshot → gateway.Dockerfile.print
  scripts.history.list_history → scripts.history.ensure_dirs
  scripts.history.list_history → gateway.Dockerfile.print
  scripts.history.show_details → scripts.history.ensure_dirs
  scripts.history.show_details → gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.ensure_dirs
  scripts.history.rollback → gateway.Dockerfile.print
  scripts.history.rollback → scripts.history.compute_dir_hash
```

### Code Analysis (`project/analysis.toon.yaml`)

```toon markpact:analysis path=project/analysis.toon.yaml
# code2llm | 45f 2706L | yaml:7,shell:5,json:3,python:3 | 2026-09-12
# generated in 0.01s
# CC̅=3.5 | critical:3/35 | dups:0 | cycles:0

HEALTH[3]:
  🟡 CC    validate_dod CC=19 (limit:15)
  🟡 CC    list_history CC=21 (limit:15)
  🟡 CC    rollback CC=20 (limit:15)

REFACTOR[1]:
  1. split 3 high-CC methods  (CC>15)

PIPELINES[6]:
  [1] Src [validate_dod]: validate_dod → run_cmd
      PURITY: 100% pure
  [2] Src [verify_and_evolve]: verify_and_evolve → print
      PURITY: 100% pure
  [3] Src [create_snapshot]: create_snapshot → ensure_dirs
      PURITY: 100% pure
  [4] Src [list_history]: list_history → ensure_dirs
      PURITY: 100% pure
  [5] Src [show_details]: show_details → ensure_dirs
      PURITY: 100% pure
  [6] Src [rollback]: rollback → ensure_dirs
      PURITY: 100% pure

LAYERS:
  scripts/                        CC̄=8.7    ←in:0  →out:51  !! split
  │ !! history                    309L  0C    6m  CC=21     ←0
  │ digital_twin               249L  0C    6m  CC=9      ←0
  │ !! dod_validator               79L  0C    2m  CC=19     ←0
  │
  ./                              CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                 369L  0C    2m  CC=0.0    ←0
  │ Makefile                    99L  0C    0m  CC=0.0    ←0
  │ taskand.sh                  59L  0C    1m  CC=0.0    ←0
  │ project.sh                  59L  0C    0m  CC=0.0    ←0
  │ docker-compose.yaml         43L  0C    0m  CC=0.0    ←0
  │ serve.sh                    21L  0C    0m  CC=0.0    ←0
  │ tree.sh                      1L  0C    0m  CC=0.0    ←0
  │
  bootstrap/                      CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                 286L  0C    2m  CC=0.0    ←0
  │
  gateway/                        CC̄=0.0    ←in:51  →out:0
  │ Dockerfile                 199L  1C    8m  CC=0.0    ←2
  │
  history/                        CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                 286L  0C    2m  CC=0.0    ←0
  │ Dockerfile                  63L  1C    6m  CC=0.0    ←0
  │ docker-compose.yaml         56L  0C    0m  CC=0.0    ←0
  │ manifest.json               18L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  17L  0C    0m  CC=0.0    ←0
  │ history.yaml                 9L  0C    0m  CC=0.0    ←0
  │ inbox.yaml                   0L  0C    0m  CC=0.0    ←0
  │
  tasks/                          CC̄=0.0    ←in:0  →out:0
  │ done.yaml                   14L  0C    0m  CC=0.0    ←0
  │ inbox.yaml                   0L  0C    0m  CC=0.0    ←0
  │
  evolution/                      CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  43L  0C    0m  CC=0.0    ←0
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
  │ serve.sh                    21L  0C    0m  CC=0.0    ←0
  │ Dockerfile                   5L  0C    0m  CC=0.0    ←0
  │
  answers/                        CC̄=0.0    ←in:0  →out:0
  │ taskand.answers.yaml         5L  0C    0m  CC=0.0    ←0
  │
  ── zero ──
     history/snapshots/snap-t1789203598/files/taskand/tasks/inbox.yaml  0L
     tasks/inbox.yaml                          0L

COUPLING:
           gateway  scripts
  gateway       ──      ←51  hub
  scripts       51       ──  !! fan-out
  CYCLES: none
  HUB: gateway/ (fan-in=51)
  SMELL: scripts/ fan-out=51 → split needed

EXTERNAL:
  validation: run `vallm batch .` → validation.toon
  duplication: run `redup scan .` → duplication.toon
```

### Duplication (`project/duplication.toon.yaml`)

```toon markpact:analysis path=project/duplication.toon.yaml
# redup/duplication | 0 groups | 11f 4202L | 2026-09-12

SUMMARY:
  files_scanned: 11
  total_lines:   4202
  dup_groups:    0
  actionable:    0
  review:        0
  generated:     0
  actionable_L:  0
  review_L:      0
  generated_L:   0
  dup_fragments: 0
  saved_lines:   0
  scan_ms:       69
```

### Evolution / Churn (`project/evolution.toon.yaml`)

```toon markpact:analysis path=project/evolution.toon.yaml
# code2llm/evolution | 21 func | 6f | 2026-09-12
# generated in 0.00s

NEXT[0]: no refactoring needed

RISKS[0]: none

METRICS-TARGET:
  CC̄:          0.0 → ≤0.0
  max-CC:      0 → ≤0
  god-modules: 0 → 0
  high-CC(≥15): 0 → ≤0
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
  (first run — no previous data)
```

## Intent

taskand-glm53 v0.4.2 — Autonomiczny Proces w Dockerfile
