# taskand-glm53 v0.4.2 — Autonomiczny Proces w Dockerfile

taskand-glm53 v0.4.2 — Autonomiczny Proces w Dockerfile

## Contents

- [Metadata](#metadata)
- [Architecture](#architecture)
- [Interfaces](#interfaces)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Environment Variables (`.env.example`)](#environment-variables-envexample)
- [Makefile Targets](#makefile-targets)
- [Code Analysis](#code-analysis)
- [Call Graph](#call-graph)
- [Test Contracts](#test-contracts)
- [Intent](#intent)

## Metadata

- **name**: `glm53`
- **version**: `0.0.0`
- **ecosystem**: SUMD + DOQL + testql + taskfile
- **generated_from**: Makefile, testql(1), app.doql.less, .env.example, Dockerfile, project/(3 analysis files)

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

## Interfaces

### testql Scenarios

#### `testql-scenarios/generated-api-smoke.testql.toon.yaml`

```toon markpact:testql path=testql-scenarios/generated-api-smoke.testql.toon.yaml
# SCENARIO: Auto-generated API Smoke Tests
# TYPE: api
# GENERATED: true
# DETECTORS: ConfigEndpointDetector

CONFIG[5]{key, value}:
  base_url, http://localhost:8101
  timeout_ms, 10000
  retry_count, 3
  retry_backoff_ms, 1000
  detected_frameworks, ConfigEndpointDetector

# Wait for service to be ready
WAIT 1000

# Health check
API GET /api/health 200
ASSERT_STATUS 200

# REST API Endpoints (1 unique)
API[1]{method, endpoint, expected_status}:
  GET, /, 200

# Capture useful values from responses for subsequent tests
# CAPTURE request_id FROM 'headers.x-request-id'
# CAPTURE session_token FROM 'body.token'

ASSERT[2]{field, operator, expected}:
  _status, <, 500
  _status, >=, 200

# Conditional flow for error handling
FLOW[2]{condition, action}:
  _status >= 500, LOG 'Server error detected'
  _status == 429, WAIT 2000  # Rate limit - wait and retry


# Summary by Framework:
#   docker: 2 endpoints
```

## Workflows

## Configuration

```yaml
project:
  name: glm53
  version: 0.0.0
  env: local
```

## Deployment

```bash markpact:run
pip install glm53

# development install
pip install -e .[dev]
```

### Docker

- **base image**: `docker:27-cli`
- **entrypoint**: `["/usr/local/bin/taskand-entry"]`
- **label** `org.taskand.role`: bootstrap+controller

## Environment Variables (`.env.example`)

| Variable | Default | Description |
|----------|---------|-------------|
| `TASKAND_LLM_API_KEY` | `*(not set)*` | .env trzymaj poza git (.gitignore) — wchodzi tylko do runtime nucleusa |
| `TASKAND_LLM_ENDPOINT` | `https://api.z.ai/api/paas/v4/chat/completions` |  |
| `TASKAND_LLM_MODEL` | `glm-5.3` |  |

## Makefile Targets

- `SHELL`
- `help`
- `bootstrap`
- `install-cli`
- `up`
- `down`
- `restart`
- `status`
- `ps`
- `logs`
- `logs-all`
- `tasks`
- `add`
- `add-watch`
- `gateway-health`
- `web`
- `check`
- `history`
- `show`
- `twin`
- `rollback`
- `snapshot`
- `clean-duplicates`
- `clean`

## Code Analysis

### `project/map.toon.yaml`

```toon markpact:analysis path=project/map.toon.yaml
# glm53 | 45f 2706L | yaml:7,shell:5,json:3,python:3 | 2026-09-12
# generated in 0.01s
# producer: code2llm | artifact: map.toon.yaml | schema: 1
# stats: 35 func | 0 cls | 45 mod | CC̄=3.5 | critical:3 | cycles:0
# alerts[5]: fan-out rollback=24; fan-out list_history=22; fan-out create_snapshot=20; CC list_history=21; CC rollback=20
# hotspots[5]: rollback fan=24; list_history fan=22; create_snapshot fan=20; ask_llm_for_repair fan=16; verify_and_evolve fan=14
# evolution: baseline
# Keys: M=modules, D=details, i=imports, e=exports, c=classes, f=functions, m=methods
M[45]:
  Dockerfile,369
  Makefile,99
  answers/taskand.answers.yaml,5
  bootstrap/Dockerfile,286
  docker-compose.yaml,43
  evolution/install-answers/Dockerfile,16
  evolution/install-cache/Dockerfile,3
  evolution/install-ghauth/Dockerfile,4
  evolution/orchestrator/Dockerfile,10
  evolution/t1789203055/Dockerfile,4
  evolution/t1789203289/Dockerfile,7
  evolution/t1789203378/Dockerfile,23
  evolution/t1789203531/Dockerfile,23
  evolution/t1789203598/Dockerfile,17
  evolution/t1789203624/Dockerfile,17
  evolution/t1789203850/Dockerfile,17
  evolution/t1789203850/TWIN_VERIFIED.json,6
  evolution/t1789204046/Dockerfile,23
  evolution/t1789204317/Dockerfile,43
  evolution/t1789204317/TWIN_VERIFIED.json,6
  evolution/t1789204506/Dockerfile,24
  evolution/t1789204647/Dockerfile,43
  evolution/t1789204816/Dockerfile,43
  evolution/t1789205131/Dockerfile,43
  evolution/t1789205406/Dockerfile,43
  evolution/t1789205596/Dockerfile,24
  gateway/Dockerfile,199
  history/history.yaml,9
  history/snapshots/snap-t1789203598/Dockerfile,17
  history/snapshots/snap-t1789203598/files/taskand/Dockerfile,286
  history/snapshots/snap-t1789203598/files/taskand/docker-compose.yaml,56
  history/snapshots/snap-t1789203598/files/taskand/gateway/Dockerfile,63
  history/snapshots/snap-t1789203598/files/taskand/tasks/inbox.yaml,0
  history/snapshots/snap-t1789203598/manifest.json,18
  landing/Dockerfile,5
  landing/serve.sh,21
  project.sh,59
  scripts/digital_twin.py,249
  scripts/dod_validator.py,79
  scripts/history.py,309
  serve.sh,21
  taskand.sh,59
  tasks/done.yaml,14
  tasks/inbox.yaml,0
  tree.sh,1
D:
  scripts/history.py:
    e: ensure_dirs,compute_dir_hash,create_snapshot,list_history,show_details,rollback
    ensure_dirs()
    compute_dir_hash(directory)
    create_snapshot(target_rel_path;desc;task_id)
    list_history()
    show_details(target_id)
    rollback(target_id_or_hash)
  scripts/dod_validator.py:
    e: run_cmd,validate_dod
    run_cmd(cmd;cwd)
    validate_dod(task_id;task_type;task_desc)
  scripts/digital_twin.py:
    e: load_env,log,create_twin_environment,run_twin_verification,ask_llm_for_repair,verify_and_evolve
    load_env()
    log(msg;tag)
    create_twin_environment(task_id)
    run_twin_verification(task_id;dockerfile_path;twin_workspace)
    ask_llm_for_repair(task_id;original_dockerfile;error_logs;task_desc)
    verify_and_evolve(task_id;task_desc;max_attempts)
  docker-compose.yaml:
  serve.sh:
  tree.sh:
  project.sh:
  taskand.sh:
    e: safe_curl
    safe_curl()
  tasks/inbox.yaml:
  tasks/done.yaml:
  Dockerfile:
    e: plan,gh_child
    plan()
    gh_child()
  Makefile:
  bootstrap/Dockerfile:
    e: plan,gh_child
    plan()
    gh_child()
  evolution/install-ghauth/Dockerfile:
  gateway/Dockerfile:
    e: Gateway,parse_yaml_tasks,send_cors_headers,do_OPTIONS,send_json,do_GET,do_POST,log_message,print
    Gateway:
    parse_yaml_tasks()
    send_cors_headers()
    do_OPTIONS()
    send_json()
    do_GET()
    do_POST()
    log_message()
    print()
  evolution/t1789203624/Dockerfile:
  evolution/t1789204317/Dockerfile:
  evolution/t1789204317/TWIN_VERIFIED.json:
  evolution/t1789204647/Dockerfile:
  evolution/t1789203850/TWIN_VERIFIED.json:
  evolution/t1789203850/Dockerfile:
  evolution/install-answers/Dockerfile:
  evolution/t1789204506/Dockerfile:
  evolution/t1789203378/Dockerfile:
  evolution/t1789205596/Dockerfile:
  evolution/t1789204816/Dockerfile:
  evolution/t1789204046/Dockerfile:
  evolution/orchestrator/Dockerfile:
  evolution/t1789205131/Dockerfile:
  landing/Dockerfile:
  evolution/t1789203055/Dockerfile:
  landing/serve.sh:
  history/snapshots/snap-t1789203598/manifest.json:
  history/snapshots/snap-t1789203598/files/taskand/docker-compose.yaml:
  evolution/t1789203598/Dockerfile:
  answers/taskand.answers.yaml:
  evolution/t1789203289/Dockerfile:
  evolution/install-cache/Dockerfile:
  history/snapshots/snap-t1789203598/files/taskand/tasks/inbox.yaml:
  history/history.yaml:
  evolution/t1789203531/Dockerfile:
  evolution/t1789205406/Dockerfile:
  history/snapshots/snap-t1789203598/files/taskand/gateway/Dockerfile:
    e: Gateway,yaml_value,send_json,do_GET,do_POST,log_message,print
    Gateway:
    yaml_value()
    send_json()
    do_GET()
    do_POST()
    log_message()
    print()
  history/snapshots/snap-t1789203598/files/taskand/Dockerfile:
    e: plan,gh_child
    plan()
    gh_child()
  history/snapshots/snap-t1789203598/Dockerfile:
```

### `project/logic.pl`

```prolog markpact:analysis path=project/logic.pl
% ── Project Metadata ─────────────────────────────────────
project_metadata('glm53', '0.0.0', 'python').

% ── Project Files ────────────────────────────────────────
project_file('app.doql.less', 157, 'less').
project_file('landing/serve.sh', 22, 'shell').
project_file('project.sh', 59, 'shell').
project_file('scripts/digital_twin.py', 250, 'python').
project_file('scripts/dod_validator.py', 80, 'python').
project_file('scripts/history.py', 310, 'python').
project_file('serve.sh', 22, 'shell').
project_file('taskand.sh', 60, 'shell').
project_file('tree.sh', 2, 'shell').

% ── Python Functions ─────────────────────────────────────
python_function('scripts/digital_twin.py', 'load_env', 0, 6, 5).
python_function('scripts/digital_twin.py', 'log', 2, 1, 1).
python_function('scripts/digital_twin.py', 'create_twin_environment', 1, 5, 9).
python_function('scripts/digital_twin.py', 'run_twin_verification', 3, 9, 8).
python_function('scripts/digital_twin.py', 'ask_llm_for_repair', 4, 8, 15).
python_function('scripts/digital_twin.py', 'verify_and_evolve', 3, 6, 14).
python_function('scripts/dod_validator.py', 'run_cmd', 2, 1, 3).
python_function('scripts/dod_validator.py', 'validate_dod', 3, 19, 5).
python_function('scripts/history.py', 'ensure_dirs', 0, 2, 4).
python_function('scripts/history.py', 'compute_dir_hash', 1, 3, 10).
python_function('scripts/history.py', 'create_snapshot', 3, 9, 20).
python_function('scripts/history.py', 'list_history', 0, 21, 16).
python_function('scripts/history.py', 'show_details', 1, 12, 11).
python_function('scripts/history.py', 'rollback', 1, 20, 22).

% ── Python Classes ───────────────────────────────────────

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('SHELL', '').
makefile_target('help', '').
makefile_target('bootstrap', '').
makefile_target('install-cli', '').
makefile_target('up', '').
makefile_target('down', '').
makefile_target('restart', '').
makefile_target('status', '').
makefile_target('ps', '').
makefile_target('logs', '').
makefile_target('logs-all', '').
makefile_target('tasks', '').
makefile_target('add', '').
makefile_target('add-watch', '').
makefile_target('gateway-health', '').
makefile_target('web', '').
makefile_target('check', '').
makefile_target('history', '').
makefile_target('show', '').
makefile_target('twin', '').
makefile_target('rollback', '').
makefile_target('snapshot', '').
makefile_target('clean-duplicates', '').
makefile_target('clean', '').

% ── Taskfile Tasks ───────────────────────────────────────

% ── Environment Variables ────────────────────────────────
env_variable('TASKAND_LLM_API_KEY', '*(not set)*', '.env trzymaj poza git (.gitignore) — wchodzi tylko do runtime nucleusa').
env_variable('TASKAND_LLM_ENDPOINT', 'https://api.z.ai/api/paas/v4/chat/completions', '').
env_variable('TASKAND_LLM_MODEL', 'glm-5.3', '').

% ── TestQL Scenarios ─────────────────────────────────────
testql_scenario('generated-api-smoke.testql.toon.yaml', 'api').

% ── Semantic Facts from SUMD.md ──────────────────────────
```

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

## Intent

taskand-glm53 v0.4.2 — Autonomiczny Proces w Dockerfile
