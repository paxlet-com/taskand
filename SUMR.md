# taskand v2.2 — Planowanie złożonych zadań + generowanie organizmów na żądanie (Standard v2.2)

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

workflow[name="up"] {
  trigger: manual;
  step-1: run cmd=docker compose up -d;
}

workflow[name="down"] {
  trigger: manual;
  step-1: run cmd=docker compose down;
}

workflow[name="status"] {
  trigger: manual;
  step-1: run cmd=docker compose ps;
  step-2: run cmd=./bin/taskand status;
}

workflow[name="test"] {
  trigger: manual;
  step-1: depend target=test-contracts;
  step-2: depend target=test-negative;
}

workflow[name="test-contracts"] {
  trigger: manual;
  step-1: run cmd=echo "=== Weryfikacja kontraktów procesów taskand v2.2 (fail-closed) ===";
  step-2: run cmd=passed=0; total=0; \;
  step-3: run cmd=for bin in $$(find generated -name "bin.mjs" | sort); do \;
  step-4: run cmd=total=$$((total + 1)); \;
  step-5: run cmd=if echo '{}' | node "$$bin" >/dev/null 2>&1; then \;
  step-6: run cmd=echo "  $$bin: PASS ✓"; \;
  step-7: run cmd=passed=$$((passed + 1)); \;
  step-8: run cmd=else \;
  step-9: run cmd=echo "  $$bin: FAIL ✗"; \;
  step-10: run cmd=fi \;
  step-11: run cmd=done; \;
  step-12: run cmd=echo "Wynik kontraktów: $$passed/$$total PASS ✓"; \;
  step-13: run cmd=[ "$$passed" -eq "$$total" ];
}

workflow[name="test-negative"] {
  trigger: manual;
  step-1: run cmd=node tests/negative_tests.mjs;
}

workflow[name="integration"] {
  trigger: manual;
  step-1: run cmd=node tests/integration_test.mjs;
}

workflow[name="catalog"] {
  trigger: manual;
  step-1: run cmd=node generated/_lib/catalog.mjs rehash;
}

workflow[name="bootstrap"] {
  trigger: manual;
  step-1: run cmd=docker compose run --rm bootstrap;
}

workflow[name="gateway"] {
  trigger: manual;
  step-1: run cmd=python3 gateway.py;
}

workflow[name="clean"] {
  trigger: manual;
  step-1: run cmd=rm -rf log/events.jsonl;
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

*83 nodes · 70 edges · 23 modules · CC̄=3.1*

### Hubs (by degree)

| Function | CC | in | out | total |
|----------|----|----|-----|-------|
| `handle_chat` *(in gateway.handlers.chat)* | 29 ⚠ | 0 | 83 | **83** |
| `handle_proc_call` *(in gateway.handlers.proc)* | 9 | 0 | 26 | **26** |
| `_parse_simple_yaml` *(in gateway.auth)* | 14 ⚠ | 1 | 19 | **20** |
| `mdnsProbe` *(in generated.admin.network-device-discovery.taskand.dev.v1.bin)* | 15 ⚠ | 0 | 18 | **18** |
| `check_auth` *(in gateway.auth)* | 8 | 2 | 15 | **17** |
| `handle_orchestrator` *(in gateway.handlers.orchestrator)* | 6 | 0 | 17 | **17** |
| `handle_federation` *(in gateway.handlers.federation)* | 8 | 0 | 15 | **15** |
| `procHash` *(in generated._lib.catalog)* | 3 | 4 | 10 | **14** |

```toon markpact:analysis path=project/calls.toon.yaml
# code2llm call graph | /home/tom/github/semcod/taskand/glm53
# generated in 0.05s
# nodes: 83 | edges: 70 | modules: 23
# CC̄=3.1

HUBS[20]:
  gateway.handlers.chat.handle_chat
    CC=29  in:0  out:83  total:83
  gateway.handlers.proc.handle_proc_call
    CC=9  in:0  out:26  total:26
  gateway.auth._parse_simple_yaml
    CC=14  in:1  out:19  total:20
  generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe
    CC=15  in:0  out:18  total:18
  gateway.auth.check_auth
    CC=8  in:2  out:15  total:17
  gateway.handlers.orchestrator.handle_orchestrator
    CC=6  in:0  out:17  total:17
  gateway.handlers.federation.handle_federation
    CC=8  in:0  out:15  total:15
  generated._lib.catalog.procHash
    CC=3  in:4  out:10  total:14
  generated.dev.chat.taskand.dev.v1.dispatch.spawnOrganism
    CC=4  in:0  out:13  total:13
  gateway.utils.find_proc_bin
    CC=9  in:3  out:9  total:12
  generated.admin.network-device-discovery.taskand.dev.v1.bin.readArp
    CC=20  in:0  out:12  total:12
  generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
    CC=5  in:8  out:3  total:11
  generated._lib.catalog.addToGenome
    CC=5  in:1  out:10  total:11
  generated._lib.catalog.register
    CC=4  in:0  out:11  total:11
  gateway.auth.load_grants
    CC=7  in:1  out:10  total:11
  generated.admin.network-device-discovery.taskand.dev.v1.bin.loadOui
    CC=11  in:1  out:10  total:11
  gateway.utils.proc_hash
    CC=5  in:1  out:9  total:10
  gateway.GatewayHTTPHandler._send
    CC=1  in:0  out:10  total:10
  gateway.middleware.logging.log_event
    CC=2  in:3  out:7  total:10
  gateway.main
    CC=2  in:0  out:9  total:9

MODULES:
  gateway  [5 funcs]
    _send  CC=1  out:10
    do_GET  CC=1  out:1
    do_OPTIONS  CC=1  out:3
    do_POST  CC=4  out:6
    main  CC=2  out:9
  gateway.auth  [4 funcs]
    _parse_simple_yaml  CC=14  out:19
    check_auth  CC=8  out:15
    check_grant  CC=7  out:3
    load_grants  CC=7  out:10
  gateway.handlers.chat  [1 funcs]
    handle_chat  CC=29  out:83
  gateway.handlers.federation  [1 funcs]
    handle_federation  CC=8  out:15
  gateway.handlers.health  [1 funcs]
    handle_healthz  CC=2  out:5
  gateway.handlers.orchestrator  [1 funcs]
    handle_orchestrator  CC=6  out:17
  gateway.handlers.proc  [1 funcs]
    handle_proc_call  CC=9  out:26
  gateway.middleware.cors  [1 funcs]
    add_cors_headers  CC=1  out:3
  gateway.middleware.logging  [1 funcs]
    log_event  CC=2  out:7
  gateway.router  [1 funcs]
    dispatch  CC=3  out:4
  gateway.utils  [2 funcs]
    find_proc_bin  CC=9  out:9
    proc_hash  CC=5  out:9
  generated._lib.catalog  [8 funcs]
    addToGenome  CC=5  out:10
    cat  CC=5  out:4
    loadCatalog  CC=2  out:2
    procHash  CC=3  out:10
    register  CC=4  out:11
    rehashAll  CC=5  out:6
    resolveUri  CC=6  out:5
    saveCatalog  CC=1  out:4
  generated._lib.proc  [4 funcs]
    adoptOwnership  CC=4  out:9
    callProc  CC=8  out:6
    uriToPath  CC=4  out:7
    walk  CC=2  out:6
  generated.admin.network-device-discovery.taskand.dev.v1.bin  [20 funcs]
    an  CC=5  out:2
    errOut  CC=1  out:1
    fin  CC=2  out:2
    hostname  CC=11  out:6
    len  CC=2  out:0
    loadOui  CC=11  out:10
    mdnsProbe  CC=15  out:18
    off  CC=5  out:4
    out  CC=1  out:3
    probeBudget  CC=3  out:8
  generated.dev.act.taskand.dev.v1.bin  [4 funcs]
    decision  CC=1  out:1
    evolve  CC=7  out:5
    format  CC=8  out:2
    run  CC=3  out:3
  generated.dev.chat.taskand.dev.v1.dispatch  [8 funcs]
    P  CC=1  out:0
    bin  CC=2  out:6
    diagnose  CC=5  out:4
    organismTemplate  CC=6  out:4
    spawnOrganism  CC=4  out:13
    telemetry  CC=8  out:7
    uri  CC=1  out:1
    webStatus  CC=2  out:6
  generated.dev.chat.taskand.dev.v1.intent  [5 funcs]
    hasAny  CC=5  out:2
    low  CC=3  out:1
    match  CC=2  out:0
    matches  CC=5  out:3
    parseIntent  CC=3  out:2
  generated.dev.composite.taskand.dev.v1.bin  [4 funcs]
    done  CC=1  out:2
    say  CC=1  out:2
    val  CC=7  out:6
    validate  CC=5  out:3
  generated.dev.llm.taskand.dev.v1.context  [2 funcs]
    capabilities  CC=4  out:4
    capabilityContext  CC=2  out:3
  generated.doctor.diagnose.taskand.dev.v1.bin  [2 funcs]
    checkService  CC=3  out:1
    probe  CC=2  out:2
  generated.hw.monitor.taskand.dev.v1.bin  [2 funcs]
    cpuTimes  CC=1  out:2
    cpuUsagePct  CC=2  out:4
  generated.monitor.cpu.taskand.dev.v1.bin  [2 funcs]
    cpuPct  CC=5  out:3
    cpus  CC=4  out:2
  generated.validator.resolve.taskand.dev.v1.bin  [3 funcs]
    currentStep  CC=7  out:3
    dfs  CC=7  out:3
    hasCycle  CC=7  out:4

EDGES:
  generated.monitor.cpu.taskand.dev.v1.bin.cpuPct → generated.monitor.cpu.taskand.dev.v1.bin.cpus
  gateway.auth.load_grants → gateway.auth._parse_simple_yaml
  gateway.auth.check_auth → gateway.auth.load_grants
  gateway.handlers.health.handle_healthz → generated.admin.network-device-discovery.taskand.dev.v1.bin.len
  gateway.handlers.federation.handle_federation → generated.admin.network-device-discovery.taskand.dev.v1.bin.len
  gateway.handlers.orchestrator.handle_orchestrator → gateway.auth.check_auth
  gateway.handlers.orchestrator.handle_orchestrator → gateway.middleware.logging.log_event
  gateway.handlers.orchestrator.handle_orchestrator → gateway.auth.check_grant
  gateway.handlers.proc.handle_proc_call → gateway.auth.check_auth
  gateway.handlers.proc.handle_proc_call → gateway.utils.find_proc_bin
  gateway.handlers.proc.handle_proc_call → gateway.auth.check_grant
  generated.validator.resolve.taskand.dev.v1.bin.hasCycle → generated.validator.resolve.taskand.dev.v1.bin.dfs
  generated.validator.resolve.taskand.dev.v1.bin.currentStep → generated.validator.resolve.taskand.dev.v1.bin.dfs
  generated.admin.network-device-discovery.taskand.dev.v1.bin.errOut → generated.admin.network-device-discovery.taskand.dev.v1.bin.out
  generated.admin.network-device-discovery.taskand.dev.v1.bin.vendorFromMac → generated.admin.network-device-discovery.taskand.dev.v1.bin.loadOui
  generated.admin.network-device-discovery.taskand.dev.v1.bin.readArp → generated.admin.network-device-discovery.taskand.dev.v1.bin.run
  generated.admin.network-device-discovery.taskand.dev.v1.bin.tcpProbe → generated.admin.network-device-discovery.taskand.dev.v1.bin.fin
  generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.hostname → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.off → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.qd → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.an → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.r → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.rdlen → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.type → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.probeBudget → generated.admin.network-device-discovery.taskand.dev.v1.bin.tcpProbe
  generated.admin.network-device-discovery.taskand.dev.v1.bin.probeBudget → generated.admin.network-device-discovery.taskand.dev.v1.bin.r
  generated.admin.network-device-discovery.taskand.dev.v1.bin.selfIps → generated.admin.network-device-discovery.taskand.dev.v1.bin.out
  generated.hw.monitor.taskand.dev.v1.bin.cpuUsagePct → generated.hw.monitor.taskand.dev.v1.bin.cpuTimes
  generated.doctor.diagnose.taskand.dev.v1.bin.checkService → generated.doctor.diagnose.taskand.dev.v1.bin.probe
  generated._lib.proc.adoptOwnership → generated._lib.proc.walk
  generated._lib.proc.callProc → generated._lib.proc.uriToPath
  generated._lib.catalog.resolveUri → generated._lib.catalog.loadCatalog
  generated._lib.catalog.resolveUri → generated._lib.catalog.procHash
  generated._lib.catalog.register → generated._lib.catalog.loadCatalog
  generated._lib.catalog.register → generated._lib.catalog.procHash
  generated._lib.catalog.register → generated._lib.catalog.saveCatalog
  generated._lib.catalog.register → generated._lib.catalog.addToGenome
  generated._lib.catalog.cat → generated._lib.catalog.procHash
  generated._lib.catalog.rehashAll → generated._lib.catalog.loadCatalog
  generated._lib.catalog.rehashAll → generated._lib.catalog.procHash
  generated._lib.catalog.rehashAll → generated._lib.catalog.saveCatalog
  generated.dev.composite.taskand.dev.v1.bin.val → generated.dev.composite.taskand.dev.v1.bin.say
  generated.dev.composite.taskand.dev.v1.bin.val → generated.dev.composite.taskand.dev.v1.bin.done
  generated.dev.composite.taskand.dev.v1.bin.val → generated.dev.composite.taskand.dev.v1.bin.validate
  generated.dev.composite.taskand.dev.v1.bin.validate → generated.dev.composite.taskand.dev.v1.bin.say
  generated.dev.llm.taskand.dev.v1.context.capabilityContext → generated.dev.llm.taskand.dev.v1.context.capabilities
  generated.dev.act.taskand.dev.v1.bin.decision → generated.dev.act.taskand.dev.v1.bin.run
  generated.dev.act.taskand.dev.v1.bin.run → generated.dev.act.taskand.dev.v1.bin.format
  generated.dev.act.taskand.dev.v1.bin.evolve → generated.dev.act.taskand.dev.v1.bin.run
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
# nodes: 83 | edges: 70 | modules: 23
# CC̄=3.1

HUBS[20]:
  gateway.handlers.chat.handle_chat
    CC=29  in:0  out:83  total:83
  gateway.handlers.proc.handle_proc_call
    CC=9  in:0  out:26  total:26
  gateway.auth._parse_simple_yaml
    CC=14  in:1  out:19  total:20
  generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe
    CC=15  in:0  out:18  total:18
  gateway.auth.check_auth
    CC=8  in:2  out:15  total:17
  gateway.handlers.orchestrator.handle_orchestrator
    CC=6  in:0  out:17  total:17
  gateway.handlers.federation.handle_federation
    CC=8  in:0  out:15  total:15
  generated._lib.catalog.procHash
    CC=3  in:4  out:10  total:14
  generated.dev.chat.taskand.dev.v1.dispatch.spawnOrganism
    CC=4  in:0  out:13  total:13
  gateway.utils.find_proc_bin
    CC=9  in:3  out:9  total:12
  generated.admin.network-device-discovery.taskand.dev.v1.bin.readArp
    CC=20  in:0  out:12  total:12
  generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
    CC=5  in:8  out:3  total:11
  generated._lib.catalog.addToGenome
    CC=5  in:1  out:10  total:11
  generated._lib.catalog.register
    CC=4  in:0  out:11  total:11
  gateway.auth.load_grants
    CC=7  in:1  out:10  total:11
  generated.admin.network-device-discovery.taskand.dev.v1.bin.loadOui
    CC=11  in:1  out:10  total:11
  gateway.utils.proc_hash
    CC=5  in:1  out:9  total:10
  gateway.GatewayHTTPHandler._send
    CC=1  in:0  out:10  total:10
  gateway.middleware.logging.log_event
    CC=2  in:3  out:7  total:10
  gateway.main
    CC=2  in:0  out:9  total:9

MODULES:
  gateway  [5 funcs]
    _send  CC=1  out:10
    do_GET  CC=1  out:1
    do_OPTIONS  CC=1  out:3
    do_POST  CC=4  out:6
    main  CC=2  out:9
  gateway.auth  [4 funcs]
    _parse_simple_yaml  CC=14  out:19
    check_auth  CC=8  out:15
    check_grant  CC=7  out:3
    load_grants  CC=7  out:10
  gateway.handlers.chat  [1 funcs]
    handle_chat  CC=29  out:83
  gateway.handlers.federation  [1 funcs]
    handle_federation  CC=8  out:15
  gateway.handlers.health  [1 funcs]
    handle_healthz  CC=2  out:5
  gateway.handlers.orchestrator  [1 funcs]
    handle_orchestrator  CC=6  out:17
  gateway.handlers.proc  [1 funcs]
    handle_proc_call  CC=9  out:26
  gateway.middleware.cors  [1 funcs]
    add_cors_headers  CC=1  out:3
  gateway.middleware.logging  [1 funcs]
    log_event  CC=2  out:7
  gateway.router  [1 funcs]
    dispatch  CC=3  out:4
  gateway.utils  [2 funcs]
    find_proc_bin  CC=9  out:9
    proc_hash  CC=5  out:9
  generated._lib.catalog  [8 funcs]
    addToGenome  CC=5  out:10
    cat  CC=5  out:4
    loadCatalog  CC=2  out:2
    procHash  CC=3  out:10
    register  CC=4  out:11
    rehashAll  CC=5  out:6
    resolveUri  CC=6  out:5
    saveCatalog  CC=1  out:4
  generated._lib.proc  [4 funcs]
    adoptOwnership  CC=4  out:9
    callProc  CC=8  out:6
    uriToPath  CC=4  out:7
    walk  CC=2  out:6
  generated.admin.network-device-discovery.taskand.dev.v1.bin  [20 funcs]
    an  CC=5  out:2
    errOut  CC=1  out:1
    fin  CC=2  out:2
    hostname  CC=11  out:6
    len  CC=2  out:0
    loadOui  CC=11  out:10
    mdnsProbe  CC=15  out:18
    off  CC=5  out:4
    out  CC=1  out:3
    probeBudget  CC=3  out:8
  generated.dev.act.taskand.dev.v1.bin  [4 funcs]
    decision  CC=1  out:1
    evolve  CC=7  out:5
    format  CC=8  out:2
    run  CC=3  out:3
  generated.dev.chat.taskand.dev.v1.dispatch  [8 funcs]
    P  CC=1  out:0
    bin  CC=2  out:6
    diagnose  CC=5  out:4
    organismTemplate  CC=6  out:4
    spawnOrganism  CC=4  out:13
    telemetry  CC=8  out:7
    uri  CC=1  out:1
    webStatus  CC=2  out:6
  generated.dev.chat.taskand.dev.v1.intent  [5 funcs]
    hasAny  CC=5  out:2
    low  CC=3  out:1
    match  CC=2  out:0
    matches  CC=5  out:3
    parseIntent  CC=3  out:2
  generated.dev.composite.taskand.dev.v1.bin  [4 funcs]
    done  CC=1  out:2
    say  CC=1  out:2
    val  CC=7  out:6
    validate  CC=5  out:3
  generated.dev.llm.taskand.dev.v1.context  [2 funcs]
    capabilities  CC=4  out:4
    capabilityContext  CC=2  out:3
  generated.doctor.diagnose.taskand.dev.v1.bin  [2 funcs]
    checkService  CC=3  out:1
    probe  CC=2  out:2
  generated.hw.monitor.taskand.dev.v1.bin  [2 funcs]
    cpuTimes  CC=1  out:2
    cpuUsagePct  CC=2  out:4
  generated.monitor.cpu.taskand.dev.v1.bin  [2 funcs]
    cpuPct  CC=5  out:3
    cpus  CC=4  out:2
  generated.validator.resolve.taskand.dev.v1.bin  [3 funcs]
    currentStep  CC=7  out:3
    dfs  CC=7  out:3
    hasCycle  CC=7  out:4

EDGES:
  generated.monitor.cpu.taskand.dev.v1.bin.cpuPct → generated.monitor.cpu.taskand.dev.v1.bin.cpus
  gateway.auth.load_grants → gateway.auth._parse_simple_yaml
  gateway.auth.check_auth → gateway.auth.load_grants
  gateway.handlers.health.handle_healthz → generated.admin.network-device-discovery.taskand.dev.v1.bin.len
  gateway.handlers.federation.handle_federation → generated.admin.network-device-discovery.taskand.dev.v1.bin.len
  gateway.handlers.orchestrator.handle_orchestrator → gateway.auth.check_auth
  gateway.handlers.orchestrator.handle_orchestrator → gateway.middleware.logging.log_event
  gateway.handlers.orchestrator.handle_orchestrator → gateway.auth.check_grant
  gateway.handlers.proc.handle_proc_call → gateway.auth.check_auth
  gateway.handlers.proc.handle_proc_call → gateway.utils.find_proc_bin
  gateway.handlers.proc.handle_proc_call → gateway.auth.check_grant
  generated.validator.resolve.taskand.dev.v1.bin.hasCycle → generated.validator.resolve.taskand.dev.v1.bin.dfs
  generated.validator.resolve.taskand.dev.v1.bin.currentStep → generated.validator.resolve.taskand.dev.v1.bin.dfs
  generated.admin.network-device-discovery.taskand.dev.v1.bin.errOut → generated.admin.network-device-discovery.taskand.dev.v1.bin.out
  generated.admin.network-device-discovery.taskand.dev.v1.bin.vendorFromMac → generated.admin.network-device-discovery.taskand.dev.v1.bin.loadOui
  generated.admin.network-device-discovery.taskand.dev.v1.bin.readArp → generated.admin.network-device-discovery.taskand.dev.v1.bin.run
  generated.admin.network-device-discovery.taskand.dev.v1.bin.tcpProbe → generated.admin.network-device-discovery.taskand.dev.v1.bin.fin
  generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.hostname → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.off → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.qd → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.an → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.r → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.rdlen → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.type → generated.admin.network-device-discovery.taskand.dev.v1.bin.readName
  generated.admin.network-device-discovery.taskand.dev.v1.bin.probeBudget → generated.admin.network-device-discovery.taskand.dev.v1.bin.tcpProbe
  generated.admin.network-device-discovery.taskand.dev.v1.bin.probeBudget → generated.admin.network-device-discovery.taskand.dev.v1.bin.r
  generated.admin.network-device-discovery.taskand.dev.v1.bin.selfIps → generated.admin.network-device-discovery.taskand.dev.v1.bin.out
  generated.hw.monitor.taskand.dev.v1.bin.cpuUsagePct → generated.hw.monitor.taskand.dev.v1.bin.cpuTimes
  generated.doctor.diagnose.taskand.dev.v1.bin.checkService → generated.doctor.diagnose.taskand.dev.v1.bin.probe
  generated._lib.proc.adoptOwnership → generated._lib.proc.walk
  generated._lib.proc.callProc → generated._lib.proc.uriToPath
  generated._lib.catalog.resolveUri → generated._lib.catalog.loadCatalog
  generated._lib.catalog.resolveUri → generated._lib.catalog.procHash
  generated._lib.catalog.register → generated._lib.catalog.loadCatalog
  generated._lib.catalog.register → generated._lib.catalog.procHash
  generated._lib.catalog.register → generated._lib.catalog.saveCatalog
  generated._lib.catalog.register → generated._lib.catalog.addToGenome
  generated._lib.catalog.cat → generated._lib.catalog.procHash
  generated._lib.catalog.rehashAll → generated._lib.catalog.loadCatalog
  generated._lib.catalog.rehashAll → generated._lib.catalog.procHash
  generated._lib.catalog.rehashAll → generated._lib.catalog.saveCatalog
  generated.dev.composite.taskand.dev.v1.bin.val → generated.dev.composite.taskand.dev.v1.bin.say
  generated.dev.composite.taskand.dev.v1.bin.val → generated.dev.composite.taskand.dev.v1.bin.done
  generated.dev.composite.taskand.dev.v1.bin.val → generated.dev.composite.taskand.dev.v1.bin.validate
  generated.dev.composite.taskand.dev.v1.bin.validate → generated.dev.composite.taskand.dev.v1.bin.say
  generated.dev.llm.taskand.dev.v1.context.capabilityContext → generated.dev.llm.taskand.dev.v1.context.capabilities
  generated.dev.act.taskand.dev.v1.bin.decision → generated.dev.act.taskand.dev.v1.bin.run
  generated.dev.act.taskand.dev.v1.bin.run → generated.dev.act.taskand.dev.v1.bin.format
  generated.dev.act.taskand.dev.v1.bin.evolve → generated.dev.act.taskand.dev.v1.bin.run
```

### Code Analysis (`project/analysis.toon.yaml`)

```toon markpact:analysis path=project/analysis.toon.yaml
# code2llm | 72f 3490L | javascript:39,yaml:15,python:13,shell:1,json:1 | 2026-09-12
# generated in 0.02s
# CC̅=3.1 | critical:4/373 | dups:0 | cycles:0

HEALTH[4]:
  🟡 CC    binPath CC=21 (limit:15)
  🟡 CC    readArp CC=20 (limit:15)
  🟡 CC    mdnsProbe CC=15 (limit:15)
  🟡 CC    handle_chat CC=29 (limit:15)

REFACTOR[1]:
  1. split 4 high-CC methods  (CC>15)

PIPELINES[260]:
  [1] Src [r1]: r1
      PURITY: 100% pure
  [2] Src [r2]: r2
      PURITY: 100% pure
  [3] Src [act]: act
      PURITY: 100% pure
  [4] Src [KEY]: KEY
      PURITY: 100% pure
  [5] Src [org]: org
      PURITY: 100% pure
  [6] Src [__dirname]: __dirname
      PURITY: 100% pure
  [7] Src [r]: r
      PURITY: 100% pure
  [8] Src [action]: action
      PURITY: 100% pure
  [9] Src [__dirname]: __dirname
      PURITY: 100% pure
  [10] Src [r]: r
      PURITY: 100% pure
  [11] Src [out]: out
      PURITY: 100% pure
  [12] Src [cpuPct]: cpuPct → cpus
      PURITY: 100% pure
  [13] Src [totalIdle]: totalIdle
      PURITY: 100% pure
  [14] Src [__dirname]: __dirname
      PURITY: 100% pure
  [15] Src [r]: r
      PURITY: 100% pure
  [16] Src [op]: op
      PURITY: 100% pure
  [17] Src [target]: target
      PURITY: 100% pure
  [18] Src [msg]: msg
      PURITY: 100% pure
  [19] Src [cpuVal]: cpuVal
      PURITY: 100% pure
  [20] Src [__dirname]: __dirname
      PURITY: 100% pure
  [21] Src [r]: r
      PURITY: 100% pure
  [22] Src [__filename]: __filename
      PURITY: 100% pure
  [23] Src [__dirname]: __dirname
      PURITY: 100% pure
  [24] Src [plan]: plan
      PURITY: 100% pure
  [25] Src [runId]: runId
      PURITY: 100% pure
  [26] Src [orchDir]: orchDir
      PURITY: 100% pure
  [27] Src [stateFile]: stateFile
      PURITY: 100% pure
  [28] Src [isResume]: isResume
      PURITY: 100% pure
  [29] Src [prev]: prev
      PURITY: 100% pure
  [30] Src [saveState]: saveState
      PURITY: 100% pure
  [31] Src [canExecute]: canExecute
      PURITY: 100% pure
  [32] Src [blockingDep]: blockingDep
      PURITY: 100% pure
  [33] Src [port]: port
      PURITY: 100% pure
  [34] Src [isUp]: isUp
      PURITY: 100% pure
  [35] Src [binPath]: binPath
      PURITY: 100% pure
  [36] Src [r]: r
      PURITY: 100% pure
  [37] Src [errText]: errText
      PURITY: 100% pure
  [38] Src [parsed]: parsed
      PURITY: 100% pure
  [39] Src [hasFailed]: hasFailed
      PURITY: 100% pure
  [40] Src [hasBlocked]: hasBlocked
      PURITY: 100% pure
  [41] Src [r]: r
      PURITY: 100% pure
  [42] Src [out]: out
      PURITY: 100% pure
  [43] Src [desc]: desc
      PURITY: 100% pure
  [44] Src [r]: r
      PURITY: 100% pure
  [45] Src [out]: out
      PURITY: 100% pure
  [46] Src [__filename]: __filename
      PURITY: 100% pure
  [47] Src [__dirname]: __dirname
      PURITY: 100% pure
  [48] Src [intent]: intent
      PURITY: 100% pure
  [49] Src [desc]: desc
      PURITY: 100% pure
  [50] Src [devChatBin]: devChatBin
      PURITY: 100% pure

LAYERS:
  gateway/                        CC̄=5.7    ←in:7  →out:4
  │ !! chat                       138L  0C    2m  CC=29     ←0
  │ auth                       124L  0C    4m  CC=14     ←2
  │ proc                        65L  0C    1m  CC=9      ←0
  │ utils                       56L  0C    2m  CC=9      ←2
  │ orchestrator                49L  0C    1m  CC=6      ←0
  │ __init__                    48L  1C    6m  CC=4      ←0
  │ planner                     29L  0C    1m  CC=5      ←0
  │ router                      27L  0C    1m  CC=3      ←1
  │ federation                  25L  0C    1m  CC=8      ←0
  │ logging                     22L  0C    1m  CC=2      ←3
  │ doctor                      16L  0C    1m  CC=4      ←0
  │ health                      11L  0C    1m  CC=2      ←0
  │ cors                         4L  0C    1m  CC=1      ←1
  │
  generated/                      CC̄=3.0    ←in:0  →out:0
  │ !! bin.mjs                    292L  0C   61m  CC=20     ←3
  │ !! bin.mjs                    242L  0C   22m  CC=21     ←0
  │ bin.mjs                    212L  0C   22m  CC=8      ←0
  │ bin.mjs                    157L  0C   12m  CC=8      ←0
  │ bin.mjs                    112L  0C   24m  CC=4      ←0
  │ catalog.mjs                109L  0C   21m  CC=6      ←0
  │ bin.mjs                     82L  0C   16m  CC=9      ←0
  │ dispatch.mjs                82L  0C   17m  CC=8      ←0
  │ bin.mjs                     79L  0C   18m  CC=8      ←0
  │ bin.mjs                     76L  0C   14m  CC=9      ←0
  │ contract.mjs                61L  0C    4m  CC=9      ←0
  │ bin.mjs                     59L  0C    8m  CC=5      ←0
  │ bin.mjs                     59L  0C   15m  CC=6      ←0
  │ proc.mjs                    58L  0C   15m  CC=8      ←0
  │ bin.mjs                     50L  0C    8m  CC=4      ←0
  │ bin.mjs                     48L  0C    5m  CC=5      ←0
  │ test.mjs                    41L  0C    3m  CC=3      ←0
  │ bin.mjs                     41L  0C    8m  CC=2      ←0
  │ test.mjs                    37L  0C    3m  CC=1      ←0
  │ intent.mjs                  36L  0C    5m  CC=5      ←0
  │ bin.mjs                     24L  0C    2m  CC=12     ←0
  │ bin.mjs                     23L  0C    4m  CC=3      ←0
  │ bin.mjs                     20L  0C    2m  CC=2      ←0
  │ bin.mjs                     20L  0C    3m  CC=2      ←0
  │ bin.mjs                     19L  0C    3m  CC=3      ←0
  │ bin.mjs                     19L  0C    1m  CC=2      ←0
  │ test.mjs                    18L  0C    3m  CC=1      ←0
  │ bin.mjs                     17L  0C    2m  CC=2      ←0
  │ bin.mjs                     17L  0C    4m  CC=2      ←0
  │ context.mjs                 16L  0C    3m  CC=4      ←0
  │ bin.mjs                     16L  0C    3m  CC=2      ←0
  │ test.mjs                    14L  0C    3m  CC=1      ←0
  │ test.mjs                    14L  0C    3m  CC=1      ←0
  │ bin.mjs                     10L  0C    1m  CC=2      ←0
  │ proc.yaml                   10L  0C    0m  CC=0.0    ←0
  │ test.mjs                     9L  0C    3m  CC=2      ←0
  │ test.mjs                     9L  0C    2m  CC=3      ←0
  │ test.mjs                     9L  0C    2m  CC=2      ←0
  │ bin.mjs                      9L  0C    3m  CC=2      ←0
  │ capsule.yaml                 9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    7L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    7L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ test.mjs                     5L  0C    2m  CC=1      ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │
  ./                              CC̄=0.0    ←in:0  →out:0
  │ proc-catalog.json          247L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  68L  0C    0m  CC=0.0    ←0
  │ genome.yaml                 65L  0C    0m  CC=0.0    ←0
  │ project.sh                  59L  0C    0m  CC=0.0    ←0
  │ docker-compose.yaml         52L  0C    0m  CC=0.0    ←0
  │ Makefile                    50L  0C    0m  CC=0.0    ←0
  │ grants.yaml                 31L  0C    0m  CC=0.0    ←0
  │
  tasks/                          CC̄=0.0    ←in:0  →out:0
  │ inbox.yaml                   0L  0C    0m  CC=0.0    ←0
  │
  vms/                            CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                   9L  0C    0m  CC=0.0    ←0
  │
  ── zero ──
     tasks/inbox.yaml                          0L

COUPLING:
                        gateway.handlers             gateway     generated.admin  gateway.middleware
    gateway.handlers                  ──                   7                   4                   3  !! fan-out
             gateway                  ←7                  ──                   2                   2  hub
     generated.admin                  ←4                  ←2                  ──                      hub
  gateway.middleware                  ←3                  ←2                                      ──  hub
  CYCLES: none
  HUB: generated.admin/ (fan-in=6)
  HUB: gateway.middleware/ (fan-in=5)
  HUB: gateway/ (fan-in=7)
  SMELL: gateway.handlers/ fan-out=14 → split needed

EXTERNAL:
  validation: run `vallm batch .` → validation.toon
  duplication: run `redup scan .` → duplication.toon
```

### Duplication (`project/duplication.toon.yaml`)

```toon markpact:analysis path=project/duplication.toon.yaml
# redup/duplication | 0 groups | 50f 3433L | 2026-09-12

SUMMARY:
  files_scanned: 50
  total_lines:   3433
  dup_groups:    0
  actionable:    0
  review:        0
  generated:     0
  actionable_L:  0
  review_L:      0
  generated_L:   0
  dup_fragments: 0
  saved_lines:   0
  scan_ms:       199
```

### Evolution / Churn (`project/evolution.toon.yaml`)

```toon markpact:analysis path=project/evolution.toon.yaml
# code2llm/evolution | 373 func | 52f | 2026-09-12
# generated in 0.00s

NEXT[4] (ranked by impact):
  [1] !! SPLIT-FUNC      handle_chat  CC=29  fan=22
      WHY: CC=29 exceeds 15
      EFFORT: ~1h  IMPACT: 638

  [2] !  SPLIT-FUNC      mdnsProbe  CC=15  fan=18
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 270

  [3] !  SPLIT-FUNC      readArp  CC=20  fan=12
      WHY: CC=20 exceeds 15
      EFFORT: ~1h  IMPACT: 240

  [4] !  SPLIT-FUNC      binPath  CC=21  fan=7
      WHY: CC=21 exceeds 15
      EFFORT: ~1h  IMPACT: 147


RISKS[0]: none

METRICS-TARGET:
  CC̄:          3.1 → ≤2.2
  max-CC:      29 → ≤14
  god-modules: 0 → 0
  high-CC(≥15): 4 → ≤2
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

taskand v2.2 — Planowanie złożonych zadań + generowanie organizmów na żądanie (Standard v2.2)
