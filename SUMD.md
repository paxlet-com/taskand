# taskand-glm53 v1.5 — Samo-Replikujący się Ekosystem Organizmów (Standard v1.5)

taskand-glm53 v1.5 — Samo-Replikujący się Ekosystem Organizmów (Standard v1.5)

## Contents

- [Metadata](#metadata)
- [Architecture](#architecture)
- [Interfaces](#interfaces)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Environment Variables (`.env.example`)](#environment-variables-envexample)
- [Release Management (`goal.yaml`)](#release-management-goalyaml)
- [Makefile Targets](#makefile-targets)
- [Node.js Scripts (`package.json`)](#nodejs-scripts-packagejson)
- [Code Analysis](#code-analysis)
- [Call Graph](#call-graph)
- [Test Contracts](#test-contracts)
- [Intent](#intent)

## Metadata

- **name**: `glm53`
- **version**: `0.0.0`
- **ecosystem**: SUMD + DOQL + testql + taskfile
- **generated_from**: Makefile, testql(1), app.doql.less, goal.yaml, .env.example, Dockerfile, package.json, project/(3 analysis files)

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
npm install taskand-glm53
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

## Release Management (`goal.yaml`)

- **versioning**: `semver`
- **commits**: `conventional` scope=`glm53`
- **changelog**: `keep-a-changelog`
- **build strategies**: `python`, `nodejs`, `rust`
- **version files**: `VERSION`

## Makefile Targets

- `SHELL`
- `help`
- `conformance`
- `test`
- `packages-test`
- `pack`
- `verify`
- `run`
- `observe`
- `extract`
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

## Node.js Scripts (`package.json`)

Standard taskand v1.0 — referencyjna paczka procesów URI

- `npm run test` — `node verify-catalog.mjs && node proc/flow/login/taskand.dev/v1/test.mjs`
- `npm run verify` — `node verify-catalog.mjs`

## Code Analysis

### `project/map.toon.yaml`

```toon markpact:analysis path=project/map.toon.yaml
# glm53 | 230f 11023L | json:29,shell:5,yaml:77,javascript:77,python:4 | 2026-09-12
# generated in 0.04s
# producer: code2llm | artifact: map.toon.yaml | schema: 1
# stats: 501 func | 0 cls | 230 mod | CC̄=3.2 | critical:21 | cycles:0
# alerts[5]: fan-out rollback=24; fan-out list_history=22; fan-out create_snapshot=20; CC list_history=21; CC low=20
# hotspots[5]: rollback fan=24; list_history fan=22; create_snapshot fan=20; low fan=17; norm fan=17
# evolution: CC̄ 3.4→3.2 (improved -0.2)
# Keys: M=modules, D=details, i=imports, e=exports, c=classes, f=functions, m=methods
M[230]:
  Dockerfile,374
  Makefile,139
  answers/taskand.answers.yaml,5
  bootstrap/Dockerfile,374
  capsule.yaml,82
  docker-compose.yaml,81
  environment.yaml,43
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
  evolution/t1789216034/Dockerfile,24
  evolution/t1789216176/Dockerfile,24
  federation-spec.yaml,37
  gateway/Dockerfile,453
  genome.yaml,149
  goal.yaml,523
  grants.yaml,34
  history/history.yaml,9
  history/snapshots/snap-t1789203598/files/taskand/docker-compose.yaml,56
  history/snapshots/snap-t1789203598/files/taskand/gateway/Dockerfile,63
  history/snapshots/snap-t1789203598/manifest.json,18
  landing/Dockerfile,5
  package.json,10
  packages/bootstrap/Makefile,40
  packages/bootstrap/capsule.yaml,42
  packages/bootstrap/grants.yaml,11
  packages/bootstrap/package.json,5
  packages/bootstrap/proc-catalog.json,42
  packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/bin.mjs,29
  packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/proc.yaml,9
  packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/test.mjs,19
  packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/bin.mjs,36
  packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/proc.yaml,9
  packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/test.mjs,19
  packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/bin.mjs,108
  packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/proc.yaml,9
  packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/test.mjs,30
  packages/bootstrap/proc/hello-world/taskand.dev/v1/bin.mjs,13
  packages/bootstrap/proc/hello-world/taskand.dev/v1/proc.yaml,10
  packages/bootstrap/proc/hello-world/taskand.dev/v1/test.mjs,11
  packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs,133
  packages/bootstrap/proc/registry/serve/taskand.dev/v1/proc.yaml,14
  packages/bootstrap/proc/registry/serve/taskand.dev/v1/test.mjs,27
  packages/chat/Makefile,40
  packages/chat/capsule.yaml,51
  packages/chat/claims/claim-chat.yaml,8
  packages/chat/package.json,5
  packages/chat/proc-catalog.json,35
  packages/chat/proc/chat/message/taskand.dev/v1/bin.mjs,35
  packages/chat/proc/chat/message/taskand.dev/v1/proc.yaml,14
  packages/chat/proc/chat/message/taskand.dev/v1/test.mjs,27
  packages/chat/proc/chat/spawn/taskand.dev/v1/bin.mjs,108
  packages/chat/proc/chat/spawn/taskand.dev/v1/proc.yaml,9
  packages/chat/proc/chat/spawn/taskand.dev/v1/test.mjs,30
  packages/chat/proc/chat/voice/taskand.dev/v1/bin.mjs,52
  packages/chat/proc/chat/voice/taskand.dev/v1/proc.yaml,14
  packages/chat/proc/chat/voice/taskand.dev/v1/test.mjs,27
  packages/chat/twin/qualification.yaml,11
  packages/demo/Makefile,33
  packages/demo/capsule.yaml,30
  packages/demo/package.json,5
  packages/demo/proc-catalog.json,21
  packages/demo/proc/hello-world/taskand.dev/v1/bin.mjs,19
  packages/developer/Makefile,40
  packages/developer/capsule.yaml,62
  packages/developer/claims/claim-developer.yaml,8
  packages/developer/package.json,5
  packages/developer/proc-catalog.json,63
  packages/developer/proc/dev/chat/taskand.dev/v1/bin.mjs,318
  packages/developer/proc/dev/chat/taskand.dev/v1/proc.yaml,9
  packages/developer/proc/dev/chat/taskand.dev/v1/test.mjs,35
  packages/developer/proc/dev/codegen/taskand.dev/v1/bin.mjs,145
  packages/developer/proc/dev/codegen/taskand.dev/v1/proc.yaml,14
  packages/developer/proc/dev/codegen/taskand.dev/v1/test.mjs,23
  packages/developer/proc/dev/heal/taskand.dev/v1/bin.mjs,37
  packages/developer/proc/dev/heal/taskand.dev/v1/proc.yaml,14
  packages/developer/proc/dev/heal/taskand.dev/v1/test.mjs,27
  packages/developer/proc/dev/plan/taskand.dev/v1/bin.mjs,39
  packages/developer/proc/dev/plan/taskand.dev/v1/proc.yaml,14
  packages/developer/proc/dev/plan/taskand.dev/v1/test.mjs,27
  packages/developer/proc/developer/spawn/taskand.dev/v1/bin.mjs,108
  packages/developer/proc/developer/spawn/taskand.dev/v1/proc.yaml,9
  packages/developer/proc/developer/spawn/taskand.dev/v1/test.mjs,30
  packages/developer/proc/developer/test-auto/taskand.dev/v1/bin.mjs,30
  packages/developer/proc/developer/test-auto/taskand.dev/v1/proc.yaml,14
  packages/developer/proc/developer/test-auto/taskand.dev/v1/test.mjs,17
  packages/developer/proc/words/count/taskand.dev/v1/bin.mjs,24
  packages/developer/proc/words/count/taskand.dev/v1/proc.yaml,9
  packages/developer/proc/words/count/taskand.dev/v1/test.mjs,9
  packages/developer/twin/qualification.yaml,11
  packages/doctor/Makefile,40
  packages/doctor/capsule.yaml,45
  packages/doctor/package.json,5
  packages/doctor/proc-catalog.json,49
  packages/doctor/proc/doctor/chat/taskand.dev/v1/bin.mjs,94
  packages/doctor/proc/doctor/chat/taskand.dev/v1/proc.yaml,9
  packages/doctor/proc/doctor/chat/taskand.dev/v1/test.mjs,24
  packages/doctor/proc/doctor/diagnose/taskand.dev/v1/bin.mjs,125
  packages/doctor/proc/doctor/diagnose/taskand.dev/v1/proc.yaml,9
  packages/doctor/proc/doctor/diagnose/taskand.dev/v1/test.mjs,33
  packages/doctor/proc/doctor/prescribe/taskand.dev/v1/bin.mjs,76
  packages/doctor/proc/doctor/prescribe/taskand.dev/v1/proc.yaml,9
  packages/doctor/proc/doctor/prescribe/taskand.dev/v1/test.mjs,36
  packages/doctor/proc/doctor/spawn/taskand.dev/v1/bin.mjs,108
  packages/doctor/proc/doctor/spawn/taskand.dev/v1/proc.yaml,9
  packages/doctor/proc/doctor/spawn/taskand.dev/v1/test.mjs,30
  packages/file-ops/Makefile,40
  packages/file-ops/capsule.yaml,42
  packages/file-ops/grants.yaml,11
  packages/file-ops/package.json,10
  packages/file-ops/proc-catalog.json,35
  packages/file-ops/proc/file-ops/chat/taskand.dev/v1/bin.mjs,34
  packages/file-ops/proc/file-ops/chat/taskand.dev/v1/proc.yaml,9
  packages/file-ops/proc/file-ops/chat/taskand.dev/v1/test.mjs,12
  packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/bin.mjs,26
  packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/proc.yaml,5
  packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/test.mjs,7
  packages/file-ops/proc/file/ops/taskand.dev/v1/bin.mjs,47
  packages/file-ops/proc/file/ops/taskand.dev/v1/proc.yaml,9
  packages/file-ops/proc/file/ops/taskand.dev/v1/test.mjs,12
  packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs,133
  packages/file-ops/proc/registry/serve/taskand.dev/v1/proc.yaml,14
  packages/file-ops/proc/registry/serve/taskand.dev/v1/test.mjs,27
  packages/hw-monitor/Makefile,40
  packages/hw-monitor/capsule.yaml,42
  packages/hw-monitor/grants.yaml,11
  packages/hw-monitor/package.json,10
  packages/hw-monitor/proc-catalog.json,35
  packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/bin.mjs,35
  packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/proc.yaml,9
  packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/test.mjs,12
  packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/bin.mjs,26
  packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/proc.yaml,5
  packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/test.mjs,7
  packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/bin.mjs,38
  packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/proc.yaml,9
  packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/test.mjs,12
  packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs,133
  packages/hw-monitor/proc/registry/serve/taskand.dev/v1/proc.yaml,14
  packages/hw-monitor/proc/registry/serve/taskand.dev/v1/test.mjs,27
  packages/nginx/Makefile,40
  packages/nginx/capsule.yaml,24
  packages/nginx/grants.yaml,10
  packages/nginx/proc-catalog.json,14
  packages/nginx/proc/nginx/status/taskand.dev/v1/bin.mjs,33
  packages/nginx/proc/nginx/status/taskand.dev/v1/proc.yaml,9
  packages/nginx/proc/nginx/status/taskand.dev/v1/test.mjs,16
  packages/nginx/twin/spec.yaml,3
  packages/vault/Makefile,40
  packages/vault/capsule.yaml,42
  packages/vault/package.json,5
  packages/vault/proc-catalog.json,42
  packages/vault/proc/vault/chat/taskand.dev/v1/bin.mjs,73
  packages/vault/proc/vault/chat/taskand.dev/v1/proc.yaml,9
  packages/vault/proc/vault/chat/taskand.dev/v1/test.mjs,24
  packages/vault/proc/vault/secrets/taskand.dev/v1/bin.mjs,147
  packages/vault/proc/vault/secrets/taskand.dev/v1/proc.yaml,9
  packages/vault/proc/vault/secrets/taskand.dev/v1/test.mjs,35
  packages/vault/proc/vault/spawn/taskand.dev/v1/bin.mjs,108
  packages/vault/proc/vault/spawn/taskand.dev/v1/proc.yaml,9
  packages/vault/proc/vault/spawn/taskand.dev/v1/test.mjs,30
  packages/web/Makefile,40
  packages/web/capsule.yaml,63
  packages/web/claims/claim-crm-retry.yaml,16
  packages/web/claims/claim-environment-immutable.yaml,14
  packages/web/package.json,5
  packages/web/proc-catalog.json,49
  packages/web/proc/browser/session/taskand.dev/v1/bin.mjs,120
  packages/web/proc/browser/session/taskand.dev/v1/proc.yaml,20
  packages/web/proc/browser/session/taskand.dev/v1/test.mjs,61
  packages/web/proc/flow/login/taskand.dev/v1/bin.mjs,82
  packages/web/proc/flow/login/taskand.dev/v1/proc.yaml,14
  packages/web/proc/flow/login/taskand.dev/v1/test.mjs,22
  packages/web/proc/web/analyze/taskand.dev/v1/bin.mjs,30
  packages/web/proc/web/analyze/taskand.dev/v1/proc.yaml,10
  packages/web/proc/web/analyze/taskand.dev/v1/test.mjs,22
  packages/web/proc/web/navigate/taskand.dev/v1/bin.mjs,39
  packages/web/proc/web/navigate/taskand.dev/v1/proc.yaml,10
  packages/web/proc/web/navigate/taskand.dev/v1/test.mjs,23
  packages/web/proc/web/spawn/taskand.dev/v1/bin.mjs,108
  packages/web/proc/web/spawn/taskand.dev/v1/proc.yaml,9
  packages/web/proc/web/spawn/taskand.dev/v1/test.mjs,30
  packages/web/twin/qualification.yaml,30
  packages/web/twin/twin.compose.yaml,13
  planfile.yaml,643
  prefact.yaml,94
  proc-catalog.json,42
  proc/bootstrap/spawn-remote.sh,35
  project.sh,59
  schemas/browser-command.v1.json,14
  schemas/browser-session.v1.json,15
  schemas/capsule.v1.json,39
  schemas/cloudevents.v1.json,22
  schemas/envelope.v1.json,30
  scripts/digital_twin.py,249
  scripts/dod_validator.py,79
  scripts/history.py,309
  scripts/planner.py,234
  scripts/taskand-new-pkg.sh,165
  scripts/taskand-runner.mjs,54
  scripts/verify-conformance.mjs,199
  serve.sh,21
  skills/browser-automation.yaml,11
  strategy/default.yaml,13
  taskand.sh,59
  tasks/done.yaml,16
  tasks/inbox.yaml,0
  templates/adapters/status.template.mjs,25
  templates/organism-vault/capsule.template.yaml,13
  testql-scenarios/generated-api-smoke.testql.toon.yaml,39
  verify-catalog.mjs,71
  vms/fedora-minimal/Dockerfile,9
D:
  scripts/history.py:
    e: ensure_dirs,compute_dir_hash,create_snapshot,list_history,show_details,rollback
    ensure_dirs()
    compute_dir_hash(directory)
    create_snapshot(target_rel_path;desc;task_id)
    list_history()
    show_details(target_id)
    rollback(target_id_or_hash)
  packages/doctor/proc/doctor/chat/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:fs,node:path,node:url
    e: dir,diagBin,prescBin,raw,prompt,low,norm,d,diagData,p,prescData,d,diagData
    dir()
    diagBin()
    prescBin()
    raw()
    prompt()
    low()
    norm()
    d()
    diagData()
    p()
    prescData()
    d()
    diagData()
  packages/doctor/proc/doctor/diagnose/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,webUrl,gatewayUrl,mockResults,candidateWebUrls,webOk,webErr,webStatus,usedWebUrl,res,res,catExists,healthy
    raw()
    webUrl()
    gatewayUrl()
    mockResults()
    candidateWebUrls()
    webOk()
    webErr()
    webStatus()
    usedWebUrl()
    res()
    res()
    catExists()
    healthy()
  scripts/dod_validator.py:
    e: run_cmd,validate_dod
    run_cmd(cmd;cwd)
    validate_dod(task_id;task_type;task_desc)
  packages/vault/proc/vault/chat/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:fs,node:path,node:url
    e: dir,secretsBin,raw,prompt,low,norm,p,data,p,data,count,p,data
    dir()
    secretsBin()
    raw()
    prompt()
    low()
    norm()
    p()
    data()
    p()
    data()
    count()
    p()
    data()
  packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs:
    i: node:fs,node:http,node:path
    e: loadCatalog,p,portIdx,port,catalog,server,processes,m,filePath,raw,action,catalog,processes
    loadCatalog()
    p()
    portIdx()
    port()
    catalog()
    server()
    processes()
    m()
    filePath()
    raw()
    action()
    catalog()
    processes()
  packages/web/proc/browser/session/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:crypto,node:fs
    e: raw,targetDevice,VNC,url,file,dummyPng,hash
    raw()
    targetDevice()
    VNC()
    url()
    file()
    dummyPng()
    hash()
  packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs:
    i: node:fs,node:http,node:path
    e: loadCatalog,p,portIdx,port,catalog,server,processes,m,filePath,raw,action,catalog,processes
    loadCatalog()
    p()
    portIdx()
    port()
    catalog()
    server()
    processes()
    m()
    filePath()
    raw()
    action()
    catalog()
    processes()
  packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs:
    i: node:fs,node:http,node:path
    e: loadCatalog,p,portIdx,port,catalog,server,processes,m,filePath,raw,action,catalog,processes
    loadCatalog()
    p()
    portIdx()
    port()
    catalog()
    server()
    processes()
    m()
    filePath()
    raw()
    action()
    catalog()
    processes()
  scripts/planner.py:
    e: load_dot_env,parse_simple_yaml,get_environment,get_recent_conversations,log_conversation,call_llm,parse_plan,main
    load_dot_env()
    parse_simple_yaml(path)
    get_environment()
    get_recent_conversations(limit)
    log_conversation(task_id;env_snapshot;messages;response_text;result_data)
    call_llm(task_id;user_prompt;env_data)
    parse_plan(raw_text;default_repo;default_org)
    main()
  packages/doctor/proc/doctor/prescribe/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,issues,targetPath
    raw()
    issues()
    targetPath()
  packages/file-ops/proc/file-ops/chat/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,msg,dev
    raw()
    msg()
    dev()
  packages/developer/proc/dev/chat/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,out,testFile,out3
    dir()
    bad()
    good()
    out()
    testFile()
    out3()
  scripts/digital_twin.py:
    e: load_env,log,create_twin_environment,run_twin_verification,ask_llm_for_repair,verify_and_evolve
    load_env()
    log(msg;tag)
    create_twin_environment(task_id)
    run_twin_verification(task_id;dockerfile_path;twin_workspace)
    ask_llm_for_repair(task_id;original_dockerfile;error_logs;task_desc)
    verify_and_evolve(task_id;task_desc;max_attempts)
  packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs,node:path,node:url
    e: raw,targetOrg,role,template,getRepoRoot,cur,root,genomePath,content,pkgDir,alreadyExists,gTxt
    raw()
    targetOrg()
    role()
    template()
    getRepoRoot()
    cur()
    root()
    genomePath()
    content()
    pkgDir()
    alreadyExists()
    gTxt()
  packages/vault/proc/vault/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs,node:path,node:url
    e: raw,targetOrg,role,template,getRepoRoot,cur,root,genomePath,content,pkgDir,alreadyExists,gTxt
    raw()
    targetOrg()
    role()
    template()
    getRepoRoot()
    cur()
    root()
    genomePath()
    content()
    pkgDir()
    alreadyExists()
    gTxt()
  packages/developer/proc/developer/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs,node:path,node:url
    e: raw,targetOrg,role,template,getRepoRoot,cur,root,genomePath,content,pkgDir,alreadyExists,gTxt
    raw()
    targetOrg()
    role()
    template()
    getRepoRoot()
    cur()
    root()
    genomePath()
    content()
    pkgDir()
    alreadyExists()
    gTxt()
  packages/developer/proc/dev/chat/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:crypto,node:fs,node:fs,node:fs,node:path,node:path,node:url,node:url
    e: raw,prompt,low,norm,getRepoRoot,cur,service,port,repoRoot,pkgDir,procDir,targetUrl,status,ok,latencyMs,res,folderMatch,fileMatch,contentMatch,targetDir,fileName,content,fullPath,parentDir,spawnBin,procDir,raw,text,words,dir,res,out,bHash,yHash,tHash,catPath,cat,bindings,idx
    raw()
    prompt()
    low()
    norm()
    getRepoRoot()
    cur()
    service()
    port()
    repoRoot()
    pkgDir()
    procDir()
    targetUrl()
    status()
    ok()
    latencyMs()
    res()
    folderMatch()
    fileMatch()
    contentMatch()
    targetDir()
    fileName()
    content()
    fullPath()
    parentDir()
    spawnBin()
    procDir()
    raw()
    text()
    words()
    dir()
    res()
    out()
    bHash()
    yHash()
    tHash()
    catPath()
    cat()
    bindings()
    idx()
  packages/web/proc/web/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs,node:path,node:url
    e: raw,targetOrg,role,template,getRepoRoot,cur,root,genomePath,content,pkgDir,alreadyExists,gTxt
    raw()
    targetOrg()
    role()
    template()
    getRepoRoot()
    cur()
    root()
    genomePath()
    content()
    pkgDir()
    alreadyExists()
    gTxt()
  packages/chat/proc/chat/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs,node:path,node:url
    e: raw,targetOrg,role,template,getRepoRoot,cur,root,genomePath,content,pkgDir,alreadyExists,gTxt
    raw()
    targetOrg()
    role()
    template()
    getRepoRoot()
    cur()
    root()
    genomePath()
    content()
    pkgDir()
    alreadyExists()
    gTxt()
  packages/doctor/proc/doctor/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs,node:path,node:url
    e: raw,targetOrg,role,template,getRepoRoot,cur,root,genomePath,content,pkgDir,alreadyExists,gTxt
    raw()
    targetOrg()
    role()
    template()
    getRepoRoot()
    cur()
    root()
    genomePath()
    content()
    pkgDir()
    alreadyExists()
    gTxt()
  packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,noOrg,good,out
    dir()
    bad()
    noOrg()
    good()
    out()
  packages/vault/proc/vault/chat/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,out
    dir()
    bad()
    good()
    out()
  packages/vault/proc/vault/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,noOrg,good,out
    dir()
    bad()
    noOrg()
    good()
    out()
  packages/developer/proc/developer/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,noOrg,good,out
    dir()
    bad()
    noOrg()
    good()
    out()
  packages/web/proc/web/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,noOrg,good,out
    dir()
    bad()
    noOrg()
    good()
    out()
  packages/chat/proc/chat/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,noOrg,good,out
    dir()
    bad()
    noOrg()
    good()
    out()
  packages/doctor/proc/doctor/prescribe/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,out
    dir()
    bad()
    good()
    out()
  packages/doctor/proc/doctor/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,noOrg,good,out
    dir()
    bad()
    noOrg()
    good()
    out()
  scripts/verify-conformance.mjs:
    i: node:child_process,node:crypto,node:fs,node:path
    e: passed,failed,findProjectRoot,cur,check,res,c,cat,first,cat,m,m,cat,bin,yaml,binHash,yamlHash,g,cat,testFile,run,root,res,c,cat,hasServe,cat,hasSpawn,cap,cat,hasInteractive,root,genomePath,g,root,composePath,comp
    passed()
    failed()
    findProjectRoot()
    cur()
    check()
    res()
    c()
    cat()
    first()
    cat()
    m()
    m()
    cat()
    bin()
    yaml()
    binHash()
    yamlHash()
    g()
    cat()
    testFile()
    run()
    root()
    res()
    c()
    cat()
    hasServe()
    cat()
    hasSpawn()
    cap()
    cat()
    hasInteractive()
    root()
    genomePath()
    g()
    root()
    composePath()
    comp()
  packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,msg,dev,temp
    raw()
    msg()
    dev()
    temp()
  packages/vault/proc/vault/secrets/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,out,denied
    dir()
    bad()
    good()
    out()
    denied()
  packages/doctor/proc/doctor/chat/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,out
    dir()
    bad()
    good()
    out()
  packages/doctor/proc/doctor/diagnose/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,out
    dir()
    bad()
    good()
    out()
  verify-catalog.mjs:
    i: node:crypto,node:fs
    e: updateMode,binContent,yamlContent,testContent,catalog,errCount,curBinHash,curYamlHash
    updateMode()
    binContent()
    yamlContent()
    testContent()
    catalog()
    errCount()
    curBinHash()
    curYamlHash()
  packages/vault/proc/vault/secrets/taskand.dev/v1/bin.mjs:
    i: node:crypto,node:fs,node:path
    e: raw,action,auditDir,auditFile,logAudit,envPath,found,content,match,val,consumer,purpose,secretName,allowed,lines
    raw()
    action()
    auditDir()
    auditFile()
    logAudit()
    envPath()
    found()
    content()
    match()
    val()
    consumer()
    purpose()
    secretName()
    allowed()
    lines()
  packages/web/proc/flow/login/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r1,res,r2
    r1()
    res()
    r2()
  packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good
    dir()
    bad()
    good()
  packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good
    dir()
    bad()
    good()
  packages/bootstrap/proc/registry/serve/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/nginx/proc/nginx/status/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,res,out
    dir()
    res()
    out()
  packages/developer/proc/dev/heal/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/developer/proc/dev/plan/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/developer/proc/dev/codegen/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,r,res
    dir()
    r()
    res()
  packages/web/proc/web/analyze/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r1,res,r2
    r1()
    res()
    r2()
  packages/web/proc/web/navigate/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r1,res,r2
    r1()
    res()
    r2()
  packages/web/proc/flow/login/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:fs,node:path
    e: callUri,m,targetScript,r,raw,site,session,page,analysis
    callUri()
    m()
    targetScript()
    r()
    raw()
    site()
    session()
    page()
    analysis()
  packages/chat/proc/chat/voice/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/chat/proc/chat/message/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/web/proc/browser/session/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r1,res1,r2,res2,r3,res3,r4,r5
    r1()
    res1()
    r2()
    res2()
    r3()
    res3()
    r4()
    r5()
  packages/file-ops/proc/file/ops/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,dev,targetPath,files,data
    raw()
    dev()
    targetPath()
    files()
    data()
  packages/file-ops/proc/registry/serve/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/hw-monitor/proc/registry/serve/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good,res
    dir()
    bad()
    good()
    res()
  packages/bootstrap/proc/hello-world/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw
    raw()
  packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,checkDocker,checkGit,checkEnv
    raw()
    checkDocker()
    checkGit()
    checkEnv()
  packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,targetRole
    raw()
    targetRole()
  packages/nginx/proc/nginx/status/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: targetUrl,status,ok,latencyMs,res
    targetUrl()
    status()
    ok()
    latencyMs()
    res()
  packages/demo/proc/hello-world/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw
    raw()
  packages/developer/proc/words/count/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,text,words
    raw()
    text()
    words()
  packages/developer/proc/developer/test-auto/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,text,sentences
    raw()
    text()
    sentences()
  packages/developer/proc/dev/heal/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,errorContext
    raw()
    errorContext()
  packages/developer/proc/dev/plan/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,task
    raw()
    task()
  packages/developer/proc/dev/codegen/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:crypto,node:fs,node:fs,node:path,node:path,node:url
    e: raw,name,desc,org,ver,targetDir,raw,text,sentences,dir,bad,good,testRun,binSha256,yamlSha256,testSha256,catFile
    raw()
    name()
    desc()
    org()
    ver()
    targetDir()
    raw()
    text()
    sentences()
    dir()
    bad()
    good()
    testRun()
    binSha256()
    yamlSha256()
    testSha256()
    catFile()
  packages/web/proc/web/analyze/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw
    raw()
  packages/web/proc/web/navigate/taskand.dev/v1/bin.mjs:
    i: node:crypto,node:fs
    e: raw,cleanUrl,digest
    raw()
    cleanUrl()
    digest()
  packages/chat/proc/chat/voice/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,transcript,normalized
    raw()
    transcript()
    normalized()
  packages/chat/proc/chat/message/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,message
    raw()
    message()
  templates/adapters/status.template.mjs:
    i: node:fs
    e: targetUrl,status,ok,res
    targetUrl()
    status()
    ok()
    res()
  scripts/taskand-runner.mjs:
    i: node:child_process,node:fs,node:path
    e: uri,inlinePayload,m,org,ability,ver,procDir,binPath,child
    uri()
    inlinePayload()
    m()
    org()
    ability()
    ver()
    procDir()
    binPath()
    child()
  packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,childName
    raw()
    childName()
  packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,childName
    raw()
    childName()
  packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,dev,pin
    raw()
    dev()
    pin()
  packages/bootstrap/proc/hello-world/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,r
    dir()
    r()
  packages/developer/proc/words/count/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,res,out
    dir()
    res()
    out()
  packages/developer/proc/developer/test-auto/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,bad,good
    dir()
    bad()
    good()
  packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,res
    dir()
    res()
  packages/file-ops/proc/file-ops/chat/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,r1,r2
    dir()
    r1()
    r2()
  packages/file-ops/proc/file/ops/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,r1,r2
    dir()
    r1()
    r2()
  packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,res
    dir()
    res()
  packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,r1,r2
    dir()
    r1()
    r2()
  packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: dir,r1,r2
    dir()
    r1()
    r2()
  proc-catalog.json:
  serve.sh:
  goal.yaml:
  Makefile:
  grants.yaml:
  taskand.sh:
    e: safe_curl
    safe_curl()
  federation-spec.yaml:
  environment.yaml:
  package.json:
  Dockerfile:
    e: plan,gh_child
    plan()
    gh_child()
  project.sh:
  capsule.yaml:
  schemas/browser-session.v1.json:
  schemas/cloudevents.v1.json:
  schemas/browser-command.v1.json:
  schemas/capsule.v1.json:
  schemas/envelope.v1.json:
  packages/bootstrap/proc-catalog.json:
  packages/bootstrap/Makefile:
  packages/bootstrap/grants.yaml:
  packages/bootstrap/package.json:
  packages/bootstrap/capsule.yaml:
  packages/bootstrap/proc/hello-world/taskand.dev/v1/proc.yaml:
  packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/proc.yaml:
  packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/proc.yaml:
  packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/proc.yaml:
  packages/bootstrap/proc/registry/serve/taskand.dev/v1/proc.yaml:
  packages/vault/proc-catalog.json:
  packages/vault/Makefile:
  packages/vault/package.json:
  packages/vault/capsule.yaml:
  packages/vault/proc/vault/secrets/taskand.dev/v1/proc.yaml:
  packages/vault/proc/vault/chat/taskand.dev/v1/proc.yaml:
  packages/vault/proc/vault/spawn/taskand.dev/v1/proc.yaml:
  packages/nginx/proc-catalog.json:
  packages/nginx/Makefile:
  packages/nginx/grants.yaml:
  packages/nginx/capsule.yaml:
  packages/nginx/twin/spec.yaml:
  packages/nginx/proc/nginx/status/taskand.dev/v1/proc.yaml:
  packages/demo/proc-catalog.json:
  packages/demo/Makefile:
  packages/demo/package.json:
  packages/demo/capsule.yaml:
  packages/developer/Makefile:
  packages/developer/package.json:
  packages/developer/capsule.yaml:
  packages/developer/claims/claim-developer.yaml:
  packages/developer/twin/qualification.yaml:
  packages/developer/proc/words/count/taskand.dev/v1/proc.yaml:
  packages/developer/proc/developer/test-auto/taskand.dev/v1/proc.yaml:
  packages/developer/proc/developer/spawn/taskand.dev/v1/proc.yaml:
  packages/developer/proc/dev/heal/taskand.dev/v1/proc.yaml:
  packages/developer/proc/dev/plan/taskand.dev/v1/proc.yaml:
  packages/developer/proc/dev/codegen/taskand.dev/v1/proc.yaml:
  packages/developer/proc/dev/chat/taskand.dev/v1/proc.yaml:
  packages/web/Makefile:
  packages/web/package.json:
  packages/web/capsule.yaml:
  packages/web/claims/claim-environment-immutable.yaml:
  packages/web/claims/claim-crm-retry.yaml:
  packages/web/twin/qualification.yaml:
  packages/web/twin/twin.compose.yaml:
  packages/web/proc/web/analyze/taskand.dev/v1/proc.yaml:
  packages/web/proc/web/navigate/taskand.dev/v1/proc.yaml:
  packages/web/proc/web/spawn/taskand.dev/v1/proc.yaml:
  packages/web/proc/flow/login/taskand.dev/v1/proc.yaml:
  packages/web/proc/browser/session/taskand.dev/v1/proc.yaml:
  packages/chat/proc-catalog.json:
  packages/chat/Makefile:
  packages/chat/package.json:
  packages/chat/capsule.yaml:
  packages/chat/claims/claim-chat.yaml:
  packages/chat/twin/qualification.yaml:
  packages/chat/proc/chat/voice/taskand.dev/v1/proc.yaml:
  packages/chat/proc/chat/message/taskand.dev/v1/proc.yaml:
  packages/chat/proc/chat/spawn/taskand.dev/v1/proc.yaml:
  packages/doctor/proc-catalog.json:
  packages/doctor/Makefile:
  packages/doctor/package.json:
  packages/doctor/capsule.yaml:
  packages/doctor/proc/doctor/chat/taskand.dev/v1/proc.yaml:
  packages/doctor/proc/doctor/prescribe/taskand.dev/v1/proc.yaml:
  packages/doctor/proc/doctor/diagnose/taskand.dev/v1/proc.yaml:
  packages/doctor/proc/doctor/spawn/taskand.dev/v1/proc.yaml:
  genome.yaml:
  templates/organism-vault/capsule.template.yaml:
  strategy/default.yaml:
  tasks/inbox.yaml:
  tasks/done.yaml:
  scripts/taskand-new-pkg.sh:
  testql-scenarios/generated-api-smoke.testql.toon.yaml:
  skills/browser-automation.yaml:
  evolution/t1789203531/Dockerfile:
  evolution/t1789216176/Dockerfile:
  evolution/t1789205406/Dockerfile:
  evolution/t1789203055/Dockerfile:
  evolution/install-cache/Dockerfile:
  evolution/install-ghauth/Dockerfile:
  evolution/t1789203624/Dockerfile:
  evolution/t1789204317/TWIN_VERIFIED.json:
  evolution/t1789204317/Dockerfile:
  evolution/t1789203289/Dockerfile:
  evolution/t1789205596/Dockerfile:
  evolution/t1789204647/Dockerfile:
  evolution/t1789203850/TWIN_VERIFIED.json:
  evolution/t1789203850/Dockerfile:
  evolution/install-answers/Dockerfile:
  evolution/t1789203598/Dockerfile:
  evolution/t1789204506/Dockerfile:
  evolution/orchestrator/Dockerfile:
  evolution/t1789203378/Dockerfile:
  evolution/t1789216034/Dockerfile:
  evolution/t1789204816/Dockerfile:
  evolution/t1789204046/Dockerfile:
  evolution/t1789205131/Dockerfile:
  landing/Dockerfile:
  answers/taskand.answers.yaml:
  history/history.yaml:
  history/snapshots/snap-t1789203598/manifest.json:
  history/snapshots/snap-t1789203598/files/taskand/docker-compose.yaml:
  bootstrap/Dockerfile:
    e: plan,gh_child
    plan()
    gh_child()
  history/snapshots/snap-t1789203598/files/taskand/gateway/Dockerfile:
    e: Gateway,yaml_value,send_json,do_GET,do_POST,log_message,print
    Gateway:
    yaml_value()
    send_json()
    do_GET()
    do_POST()
    log_message()
    print()
  docker-compose.yaml:
  packages/developer/proc-catalog.json:
  packages/web/proc-catalog.json:
  packages/file-ops/Makefile:
  prefact.yaml:
  planfile.yaml:
  packages/file-ops/grants.yaml:
  packages/file-ops/package.json:
  packages/file-ops/proc-catalog.json:
  packages/file-ops/proc/registry/serve/taskand.dev/v1/proc.yaml:
  packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/proc.yaml:
  packages/hw-monitor/proc-catalog.json:
  packages/file-ops/proc/file/ops/taskand.dev/v1/proc.yaml:
  packages/hw-monitor/grants.yaml:
  packages/hw-monitor/package.json:
  packages/file-ops/proc/file-ops/chat/taskand.dev/v1/proc.yaml:
  packages/file-ops/capsule.yaml:
  packages/hw-monitor/capsule.yaml:
  packages/hw-monitor/Makefile:
  packages/hw-monitor/proc/registry/serve/taskand.dev/v1/proc.yaml:
  packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/proc.yaml:
  packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/proc.yaml:
  packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/proc.yaml:
  proc/bootstrap/spawn-remote.sh:
  gateway/Dockerfile:
    e: Gateway,parse_yaml_tasks,resolve_proc_file,execute_proc,send_cors_headers,do_OPTIONS,send_json,do_GET,do_POST,print,log_message,print
    Gateway:
    parse_yaml_tasks()
    resolve_proc_file()
    execute_proc()
    send_cors_headers()
    do_OPTIONS()
    send_json()
    do_GET()
    do_POST()
    print()
    log_message()
    print()
  vms/fedora-minimal/Dockerfile:
```

### `project/logic.pl`

```prolog markpact:analysis path=project/logic.pl
% ── Project Metadata ─────────────────────────────────────
project_metadata('glm53', '1.0.0', 'javascript').

% ── Project Files ────────────────────────────────────────
project_file('app.doql.less', 216, 'less').
project_file('landing/serve.sh', 22, 'shell').
project_file('packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/bin.mjs', 30, 'javascript').
project_file('packages/bootstrap/proc/bootstrap/handover/taskand.dev/v1/test.mjs', 20, 'javascript').
project_file('packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/bin.mjs', 37, 'javascript').
project_file('packages/bootstrap/proc/bootstrap/onboarding/taskand.dev/v1/test.mjs', 20, 'javascript').
project_file('packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/bin.mjs', 109, 'javascript').
project_file('packages/bootstrap/proc/bootstrap/spawn/taskand.dev/v1/test.mjs', 31, 'javascript').
project_file('packages/bootstrap/proc/hello-world/taskand.dev/v1/bin.mjs', 14, 'javascript').
project_file('packages/bootstrap/proc/hello-world/taskand.dev/v1/test.mjs', 12, 'javascript').
project_file('packages/bootstrap/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/bootstrap/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/chat/proc/chat/message/taskand.dev/v1/bin.mjs', 36, 'javascript').
project_file('packages/chat/proc/chat/message/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/chat/proc/chat/spawn/taskand.dev/v1/bin.mjs', 109, 'javascript').
project_file('packages/chat/proc/chat/spawn/taskand.dev/v1/test.mjs', 31, 'javascript').
project_file('packages/chat/proc/chat/voice/taskand.dev/v1/bin.mjs', 53, 'javascript').
project_file('packages/chat/proc/chat/voice/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/chat/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/chat/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/demo/proc/hello-world/taskand.dev/v1/bin.mjs', 20, 'javascript').
project_file('packages/demo/proc/hello-world/taskand.dev/v1/test.mjs', 12, 'javascript').
project_file('packages/demo/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/demo/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/developer/proc/dev/chat/taskand.dev/v1/bin.mjs', 319, 'javascript').
project_file('packages/developer/proc/dev/chat/taskand.dev/v1/test.mjs', 36, 'javascript').
project_file('packages/developer/proc/dev/codegen/taskand.dev/v1/bin.mjs', 146, 'javascript').
project_file('packages/developer/proc/dev/codegen/taskand.dev/v1/test.mjs', 24, 'javascript').
project_file('packages/developer/proc/dev/heal/taskand.dev/v1/bin.mjs', 38, 'javascript').
project_file('packages/developer/proc/dev/heal/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/developer/proc/dev/plan/taskand.dev/v1/bin.mjs', 40, 'javascript').
project_file('packages/developer/proc/dev/plan/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/developer/proc/developer/spawn/taskand.dev/v1/bin.mjs', 109, 'javascript').
project_file('packages/developer/proc/developer/spawn/taskand.dev/v1/test.mjs', 31, 'javascript').
project_file('packages/developer/proc/developer/test-auto/taskand.dev/v1/bin.mjs', 31, 'javascript').
project_file('packages/developer/proc/developer/test-auto/taskand.dev/v1/test.mjs', 18, 'javascript').
project_file('packages/developer/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/developer/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/developer/proc/words/count/taskand.dev/v1/bin.mjs', 25, 'javascript').
project_file('packages/developer/proc/words/count/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('packages/doctor/proc/doctor/chat/taskand.dev/v1/bin.mjs', 95, 'javascript').
project_file('packages/doctor/proc/doctor/chat/taskand.dev/v1/test.mjs', 25, 'javascript').
project_file('packages/doctor/proc/doctor/diagnose/taskand.dev/v1/bin.mjs', 126, 'javascript').
project_file('packages/doctor/proc/doctor/diagnose/taskand.dev/v1/test.mjs', 34, 'javascript').
project_file('packages/doctor/proc/doctor/prescribe/taskand.dev/v1/bin.mjs', 77, 'javascript').
project_file('packages/doctor/proc/doctor/prescribe/taskand.dev/v1/test.mjs', 37, 'javascript').
project_file('packages/doctor/proc/doctor/spawn/taskand.dev/v1/bin.mjs', 109, 'javascript').
project_file('packages/doctor/proc/doctor/spawn/taskand.dev/v1/test.mjs', 31, 'javascript').
project_file('packages/doctor/proc/hello-world/taskand.dev/v1/bin.mjs', 14, 'javascript').
project_file('packages/doctor/proc/hello-world/taskand.dev/v1/test.mjs', 12, 'javascript').
project_file('packages/doctor/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/doctor/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/file-ops/proc/file/ops/taskand.dev/v1/bin.mjs', 48, 'javascript').
project_file('packages/file-ops/proc/file/ops/taskand.dev/v1/test.mjs', 13, 'javascript').
project_file('packages/file-ops/proc/file-ops/chat/taskand.dev/v1/bin.mjs', 35, 'javascript').
project_file('packages/file-ops/proc/file-ops/chat/taskand.dev/v1/test.mjs', 13, 'javascript').
project_file('packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/bin.mjs', 27, 'javascript').
project_file('packages/file-ops/proc/file-ops/spawn/taskand.dev/v1/test.mjs', 8, 'javascript').
project_file('packages/file-ops/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/file-ops/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/bin.mjs', 39, 'javascript').
project_file('packages/hw-monitor/proc/hw/monitor/taskand.dev/v1/test.mjs', 13, 'javascript').
project_file('packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/bin.mjs', 36, 'javascript').
project_file('packages/hw-monitor/proc/hw-monitor/chat/taskand.dev/v1/test.mjs', 13, 'javascript').
project_file('packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/bin.mjs', 27, 'javascript').
project_file('packages/hw-monitor/proc/hw-monitor/spawn/taskand.dev/v1/test.mjs', 8, 'javascript').
project_file('packages/hw-monitor/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/hw-monitor/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/nginx/proc/nginx/status/taskand.dev/v1/bin.mjs', 34, 'javascript').
project_file('packages/nginx/proc/nginx/status/taskand.dev/v1/test.mjs', 17, 'javascript').
project_file('packages/vault/proc/hello-world/taskand.dev/v1/bin.mjs', 14, 'javascript').
project_file('packages/vault/proc/hello-world/taskand.dev/v1/test.mjs', 12, 'javascript').
project_file('packages/vault/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/vault/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/vault/proc/vault/chat/taskand.dev/v1/bin.mjs', 74, 'javascript').
project_file('packages/vault/proc/vault/chat/taskand.dev/v1/test.mjs', 25, 'javascript').
project_file('packages/vault/proc/vault/secrets/taskand.dev/v1/bin.mjs', 148, 'javascript').
project_file('packages/vault/proc/vault/secrets/taskand.dev/v1/test.mjs', 36, 'javascript').
project_file('packages/vault/proc/vault/spawn/taskand.dev/v1/bin.mjs', 109, 'javascript').
project_file('packages/vault/proc/vault/spawn/taskand.dev/v1/test.mjs', 31, 'javascript').
project_file('packages/web/proc/browser/session/taskand.dev/v1/bin.mjs', 121, 'javascript').
project_file('packages/web/proc/browser/session/taskand.dev/v1/test.mjs', 62, 'javascript').
project_file('packages/web/proc/flow/login/taskand.dev/v1/bin.mjs', 83, 'javascript').
project_file('packages/web/proc/flow/login/taskand.dev/v1/test.mjs', 23, 'javascript').
project_file('packages/web/proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('packages/web/proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('packages/web/proc/web/analyze/taskand.dev/v1/bin.mjs', 31, 'javascript').
project_file('packages/web/proc/web/analyze/taskand.dev/v1/test.mjs', 23, 'javascript').
project_file('packages/web/proc/web/navigate/taskand.dev/v1/bin.mjs', 40, 'javascript').
project_file('packages/web/proc/web/navigate/taskand.dev/v1/test.mjs', 24, 'javascript').
project_file('packages/web/proc/web/spawn/taskand.dev/v1/bin.mjs', 109, 'javascript').
project_file('packages/web/proc/web/spawn/taskand.dev/v1/test.mjs', 31, 'javascript').
project_file('proc/bootstrap/spawn-remote.sh', 36, 'shell').
project_file('proc/browser/session/taskand.dev/v1/bin.mjs', 52, 'javascript').
project_file('proc/browser/session/taskand.dev/v1/test.mjs', 34, 'javascript').
project_file('proc/flow/login/taskand.dev/v1/bin.mjs', 83, 'javascript').
project_file('proc/flow/login/taskand.dev/v1/test.mjs', 23, 'javascript').
project_file('proc/registry/serve/taskand.dev/v1/bin.mjs', 134, 'javascript').
project_file('proc/registry/serve/taskand.dev/v1/test.mjs', 28, 'javascript').
project_file('proc/web/analyze/taskand.dev/v1/bin.mjs', 31, 'javascript').
project_file('proc/web/analyze/taskand.dev/v1/test.mjs', 23, 'javascript').
project_file('proc/web/navigate/taskand.dev/v1/bin.mjs', 40, 'javascript').
project_file('proc/web/navigate/taskand.dev/v1/test.mjs', 24, 'javascript').
project_file('project.sh', 59, 'shell').
project_file('scripts/digital_twin.py', 250, 'python').
project_file('scripts/dod_validator.py', 80, 'python').
project_file('scripts/history.py', 310, 'python').
project_file('scripts/planner.py', 235, 'python').
project_file('scripts/taskand-new-pkg.sh', 166, 'shell').
project_file('scripts/taskand-runner.mjs', 55, 'javascript').
project_file('scripts/verify-conformance.mjs', 200, 'javascript').
project_file('serve.sh', 22, 'shell').
project_file('taskand.sh', 60, 'shell').
project_file('templates/adapters/status.template.mjs', 26, 'javascript').
project_file('verify-catalog.mjs', 72, 'javascript').

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
python_function('scripts/planner.py', 'load_dot_env', 0, 6, 5).
python_function('scripts/planner.py', 'parse_simple_yaml', 1, 6, 5).
python_function('scripts/planner.py', 'get_environment', 0, 2, 3).
python_function('scripts/planner.py', 'get_recent_conversations', 1, 7, 5).
python_function('scripts/planner.py', 'log_conversation', 5, 1, 8).
python_function('scripts/planner.py', 'call_llm', 3, 5, 10).
python_function('scripts/planner.py', 'parse_plan', 3, 11, 4).
python_function('scripts/planner.py', 'main', 0, 6, 10).

% ── Python Classes ───────────────────────────────────────

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('SHELL', '').
makefile_target('help', '').
makefile_target('conformance', '').
makefile_target('test', '').
makefile_target('packages-test', '').
makefile_target('pack', '').
makefile_target('verify', '').
makefile_target('run', '').
makefile_target('observe', '').
makefile_target('extract', '').
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
sumd_declared_file('app.doql.less', 'doql').
sumd_declared_file('testql-scenarios/generated-api-smoke.testql.toon.yaml', 'testql').
sumd_declared_file('project/map.toon.yaml', 'analysis').
sumd_declared_file('project/logic.pl', 'analysis').
sumd_declared_file('project/calls.toon.yaml', 'analysis').
sumd_interface('web', '').
sumd_workflow('conformance', 'manual').
sumd_workflow_step('conformance', 1, 'node scripts/verify-conformance.mjs').
sumd_workflow('test', 'manual').
sumd_workflow_step('test', 1, 'node proc/browser/session/taskand.dev/v1/test.mjs').
sumd_workflow_step('test', 2, 'node proc/web/navigate/taskand.dev/v1/test.mjs').
sumd_workflow_step('test', 3, 'node proc/web/analyze/taskand.dev/v1/test.mjs').
sumd_workflow_step('test', 4, 'node proc/flow/login/taskand.dev/v1/test.mjs').
sumd_workflow_step('test', 5, 'echo "✓ Wszystkie procesy URI spełniają kontrakt (fail-closed)"').
sumd_workflow('packages-test', 'manual').
sumd_workflow_step('packages-test', 1, 'for pkg in packages/*').
sumd_workflow_step('packages-test', 2, 'if [ -d "$$pkg" ]').
sumd_workflow_step('packages-test', 3, 'echo "=== Testowanie paczki $$pkg ==="').
sumd_workflow_step('packages-test', 4, '(cd "$$pkg" && make conformance && make test && make verify && make run) || exit 1').
sumd_workflow_step('packages-test', 5, 'fi').
sumd_workflow_step('packages-test', 6, 'done').
sumd_workflow_step('packages-test', 7, 'echo "✓ Wszystkie wydzielone paczki przeszły pomyślnie testy i konformację!"').
sumd_workflow('pack', 'manual').
sumd_workflow_step('pack', 1, 'mkdir -p dist').
sumd_workflow_step('pack', 2, 'tar -czf dist/taskand-glm53-v1.0.0.tgz proc/ schemas/ capsule.yaml grants.yaml proc-catalog.json').
sumd_workflow_step('pack', 3, 'tar -tzf dist/taskand-glm53-v1.0.0.tgz >/dev/null && echo "pack ✓ (archiwum dist/taskand-glm53-v1.0.0.tgz gotowe)"').
sumd_workflow('verify', 'manual').
sumd_workflow_step('verify', 1, 'node verify-catalog.mjs').
sumd_workflow_step('verify', 2, 'node scripts/verify-conformance.mjs').
sumd_workflow('run', 'manual').
sumd_workflow('observe', 'manual').
sumd_workflow('extract', 'manual').
sumd_workflow_step('extract', 1, 'mkdir -p dist/extracted').
sumd_workflow_step('extract', 2, 'cp -r schemas/ dist/extracted/').
sumd_workflow_step('extract', 3, 'echo "extract ✓ (wyekstrahowano artefakty do dist/extracted)"').
sumd_workflow('bootstrap', 'manual').
sumd_workflow_step('bootstrap', 1, 'sh taskand.sh').
sumd_workflow('install-cli', 'manual').
sumd_workflow_step('install-cli', 1, 'mkdir -p ~/.local/bin').
sumd_workflow_step('install-cli', 2, 'chmod +x taskand.cli').
sumd_workflow_step('install-cli', 3, 'ln -sf "$(shell pwd)/taskand.cli" ~/.local/bin/taskand').
sumd_workflow_step('install-cli', 4, 'ln -sf "$(shell pwd)/taskand.cli" "$(shell pwd)/taskand"').
sumd_workflow_step('install-cli', 5, 'echo "✓ Narzędzie \'taskand\' zainstalowane w ~/.local/bin/taskand"').
sumd_workflow('up', 'manual').
sumd_workflow_step('up', 1, 'docker compose up -d').
sumd_workflow('down', 'manual').
sumd_workflow_step('down', 1, 'docker compose down').
sumd_workflow('restart', 'manual').
sumd_workflow_step('restart', 1, 'docker compose restart').
sumd_workflow('status', 'manual').
sumd_workflow_step('status', 1, 'docker compose ps').
sumd_workflow('ps', 'manual').
sumd_workflow('logs', 'manual').
sumd_workflow_step('logs', 1, 'docker compose logs -f nucleus').
sumd_workflow('logs-all', 'manual').
sumd_workflow_step('logs-all', 1, 'docker compose logs -f').
sumd_workflow('tasks', 'manual').
sumd_workflow_step('tasks', 1, 'echo "\033[33m=== Oczekujące zadania (tasks/inbox.yaml) ===\033[0m"').
sumd_workflow_step('tasks', 2, 'if [ -s tasks/inbox.yaml ]').
sumd_workflow_step('tasks', 3, 'echo ""').
sumd_workflow_step('tasks', 4, 'echo "\033[32m=== Wykonane zadania (tasks/done.yaml) ===\033[0m"').
sumd_workflow_step('tasks', 5, 'if [ -s tasks/done.yaml ]').
sumd_workflow('add', 'manual').
sumd_workflow_step('add', 1, 'if [ -z "$(TASK)" ]').
sumd_workflow_step('add', 2, 'echo "Błąd: podaj treść zadania, np.: make add TASK=\"stwórz projekt w organizacji semcod z README\""').
sumd_workflow_step('add', 3, 'exit 1').
sumd_workflow_step('add', 4, 'fi').
sumd_workflow_step('add', 5, './taskand.cli add "$(TASK)"').
sumd_workflow('add-watch', 'manual').
sumd_workflow_step('add-watch', 1, 'if [ -z "$(TASK)" ]').
sumd_workflow_step('add-watch', 2, 'echo "Błąd: podaj treść zadania, np.: make add-watch TASK=\"monitoruj stan usług\""').
sumd_workflow_step('add-watch', 3, 'exit 1').
sumd_workflow_step('add-watch', 4, 'fi').
sumd_workflow_step('add-watch', 5, './taskand.cli add -t obserwuj "$(TASK)"').
sumd_workflow('gateway-health', 'manual').
sumd_workflow_step('gateway-health', 1, 'curl -s http://localhost:8077/api/health | grep -q \'"ok": true\' && echo "✓ Gateway REST API działa (port 8077)" || echo "✗ Gateway nie odpowiada"').
sumd_workflow('web', 'manual').
sumd_workflow_step('web', 1, 'docker compose up -d landing && echo "✓ Web Cockpit działa pod adresem: http://localhost:8090" || sh landing/serve.sh $(PORT)').
sumd_workflow('check', 'manual').
sumd_workflow_step('check', 1, 'docker build --check .').
sumd_workflow_step('check', 2, 'docker build --check -f gateway/Dockerfile gateway/').
sumd_workflow_step('check', 3, 'echo "✓ Wszystkie Dockerfile poprawne składniowo"').
sumd_workflow('history', 'manual').
sumd_workflow_step('history', 1, './taskand.cli history').
sumd_workflow('show', 'manual').
sumd_workflow_step('show', 1, './taskand.cli show $(ID)').
sumd_workflow('twin', 'manual').
sumd_workflow_step('twin', 1, './taskand.cli twin $(ID) "$(DESC)"').
sumd_workflow('rollback', 'manual').
sumd_workflow_step('rollback', 1, './taskand.cli rollback $(ID)').
sumd_workflow('snapshot', 'manual').
sumd_workflow_step('snapshot', 1, './taskand.cli snapshot "$(TARGET)" "$(DESC)"').
sumd_workflow('clean-duplicates', 'manual').
sumd_workflow_step('clean-duplicates', 1, './taskand.cli clean').
sumd_workflow('clean', 'manual').
sumd_workflow_step('clean', 1, 'docker compose down -v').
sumd_workflow_step('clean', 2, 'echo "✓ Kontenery zatrzymane i wyczyszczone"').
```

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

## Intent

taskand-glm53 v1.5 — Samo-Replikujący się Ekosystem Organizmów (Standard v1.5)
