# taskand v2.2 — Planowanie złożonych zadań + generowanie organizmów na żądanie (Standard v2.2)

taskand v2.2 — Planowanie złożonych zadań + generowanie organizmów na żądanie (Standard v2.2)

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
#   docker: 3 endpoints
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
- **entrypoint**: `["/usr/local/bin/bootstrap"]`
- **label** `org.taskand.version`: 2.0.0
- **label** `org.taskand.role`: bootstrap

## Environment Variables (`.env.example`)

| Variable | Default | Description |
|----------|---------|-------------|
| `TASKAND_LLM_API_KEY` | `*(not set)*` | .env trzymaj poza git (.gitignore) — wchodzi tylko do runtime nucleusa |
| `TASKAND_LLM_ENDPOINT` | `https://api.z.ai/api/paas/v4/chat/completions` |  |
| `TASKAND_LLM_MODEL` | `glm-5.3` |  |

## Makefile Targets

- `all`
- `up`
- `down`
- `status`
- `test`
- `test-contracts`
- `test-negative`
- `integration`
- `catalog` — Przelicza bindingHash w proc-catalog.json po ręcznej zmianie procesu
- `bootstrap`
- `gateway`
- `clean`

## Code Analysis

### `project/map.toon.yaml`

```toon markpact:analysis path=project/map.toon.yaml
# glm53 | 72f 3490L | python:13,yaml:15,shell:1,javascript:39,json:1 | 2026-09-12
# generated in 0.01s
# producer: code2llm | artifact: map.toon.yaml | schema: 1
# stats: 373 func | 0 cls | 72 mod | CC̄=3.1 | critical:4 | cycles:0
# alerts[5]: CC handle_chat=29; fan-out handle_chat=22; CC binPath=21; CC readArp=20; fan-out mdnsProbe=18
# hotspots[5]: handle_chat fan=22; mdnsProbe fan=18; ssdpProbe fan=15; handle_proc_call fan=14; MAX_ATTEMPTS fan=14
# evolution: baseline
# Keys: M=modules, D=details, i=imports, e=exports, c=classes, f=functions, m=methods
M[72]:
  Dockerfile,68
  Makefile,50
  docker-compose.yaml,52
  gateway/__init__.py,48
  gateway/auth.py,124
  gateway/handlers/chat.py,138
  gateway/handlers/doctor.py,16
  gateway/handlers/federation.py,25
  gateway/handlers/health.py,11
  gateway/handlers/orchestrator.py,49
  gateway/handlers/planner.py,29
  gateway/handlers/proc.py,65
  gateway/middleware/cors.py,4
  gateway/middleware/logging.py,22
  gateway/router.py,27
  gateway/utils.py,56
  generated/_lib/catalog.mjs,109
  generated/_lib/proc.mjs,58
  generated/admin/chat/taskand.dev/v1/bin.mjs,9
  generated/admin/chat/taskand.dev/v1/proc.yaml,5
  generated/admin/network-device-discovery/taskand.dev/v1/bin.mjs,292
  generated/admin/network-device-discovery/taskand.dev/v1/proc.yaml,6
  generated/admin/network-device-discovery/taskand.dev/v1/test.mjs,5
  generated/alert/telegram/taskand.dev/v1/bin.mjs,59
  generated/alert/telegram/taskand.dev/v1/proc.yaml,6
  generated/alert/telegram/taskand.dev/v1/test.mjs,18
  generated/browser/session/taskand.dev/v1/bin.mjs,23
  generated/chat/message/taskand.dev/v1/bin.mjs,24
  generated/dev/act/taskand.dev/v1/bin.mjs,79
  generated/dev/chat/taskand.dev/v1/bin.mjs,16
  generated/dev/chat/taskand.dev/v1/dispatch.mjs,82
  generated/dev/chat/taskand.dev/v1/intent.mjs,36
  generated/dev/chat/taskand.dev/v1/proc.yaml,7
  generated/dev/chat/taskand.dev/v1/test.mjs,9
  generated/dev/codegen/taskand.dev/v1/bin.mjs,17
  generated/dev/composite/taskand.dev/v1/bin.mjs,82
  generated/dev/evolve/taskand.dev/v1/bin.mjs,76
  generated/dev/evolve/taskand.dev/v1/contract.mjs,61
  generated/dev/execute/taskand.dev/v1/bin.mjs,41
  generated/dev/execute/taskand.dev/v1/proc.yaml,10
  generated/dev/execute/taskand.dev/v1/test.mjs,9
  generated/dev/file-router/taskand.dev/v1/bin.mjs,17
  generated/dev/llm/taskand.dev/v1/bin.mjs,59
  generated/dev/llm/taskand.dev/v1/context.mjs,16
  generated/developer/spawn/taskand.dev/v1/bin.mjs,19
  generated/doctor/diagnose/taskand.dev/v1/bin.mjs,50
  generated/doctor/prescribe/taskand.dev/v1/bin.mjs,19
  generated/file/ops/taskand.dev/v1/bin.mjs,20
  generated/hw/monitor/taskand.dev/v1/bin.mjs,112
  generated/monitor/cpu/taskand.dev/v1/bin.mjs,48
  generated/monitor/cpu/taskand.dev/v1/proc.yaml,6
  generated/monitor/cpu/taskand.dev/v1/test.mjs,14
  generated/orchestrator/execute/taskand.dev/v1/bin.mjs,242
  generated/orchestrator/execute/taskand.dev/v1/proc.yaml,6
  generated/orchestrator/execute/taskand.dev/v1/test.mjs,41
  generated/planner/plan/taskand.dev/v1/bin.mjs,157
  generated/planner/plan/taskand.dev/v1/proc.yaml,6
  generated/planner/plan/taskand.dev/v1/test.mjs,14
  generated/validator/resolve/taskand.dev/v1/bin.mjs,212
  generated/validator/resolve/taskand.dev/v1/proc.yaml,6
  generated/validator/resolve/taskand.dev/v1/test.mjs,37
  generated/vault/secrets/taskand.dev/v1/bin.mjs,20
  generated/web/capsule.yaml,9
  generated/web/serve/taskand.dev/v1/bin.mjs,10
  generated/web/serve/taskand.dev/v1/proc.yaml,7
  generated/web/serve/taskand.dev/v1/test.mjs,9
  genome.yaml,65
  grants.yaml,31
  proc-catalog.json,247
  project.sh,59
  tasks/inbox.yaml,0
  vms/fedora-minimal/Dockerfile,9
D:
  gateway/handlers/chat.py:
    e: llm_env,handle_chat
    llm_env()
    handle_chat(request_handler;body)
  generated/orchestrator/execute/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:fs,node:path,node:url
    e: __filename,__dirname,raw,plan,runId,orchDir,stateFile,isResume,prev,saveState,prevStep,canExecute,blockingDep,depState,port,isUp,binPath,r,errText,parsed,hasFailed,hasBlocked
    __filename()
    __dirname()
    raw()
    plan()
    runId()
    orchDir()
    stateFile()
    isResume()
    prev()
    saveState()
    prevStep()
    canExecute()
    blockingDep()
    depState()
    port()
    isUp()
    binPath()
    r()
    errText()
    parsed()
    hasFailed()
    hasBlocked()
  generated/admin/network-device-discovery/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:dgram,node:dns/promises,node:fs,node:net,node:os,node:util
    e: run,TIMEOUT_MS,deadline,out,errOut,raw,timeLeft,ouiMap,loadOui,lines,parts,hex,vendorFromMac,hex,parseArpText,m,readArp,t,p,mip,mmac,localSubnets,ifaces,ipParts,maskParts,maskBits,netParts,tcpProbe,s,done,fin,mdnsProbe,sock,timer,ip,hostname,off,readName,len,ptr,sub,qd,an,r,rdlen,type,rd,q,ssdpProbe,sock,timer,ip,existing,st,nets,netsInfo,mdnsMs,ssdpMs,byIp,add,cur,probeBudget,alive,names,selfIps
    run()
    TIMEOUT_MS()
    deadline()
    out()
    errOut()
    raw()
    timeLeft()
    ouiMap()
    loadOui()
    lines()
    parts()
    hex()
    vendorFromMac()
    hex()
    parseArpText()
    m()
    readArp()
    t()
    p()
    mip()
    mmac()
    localSubnets()
    ifaces()
    ipParts()
    maskParts()
    maskBits()
    netParts()
    tcpProbe()
    s()
    done()
    fin()
    mdnsProbe()
    sock()
    timer()
    ip()
    hostname()
    off()
    readName()
    len()
    ptr()
    sub()
    qd()
    an()
    r()
    rdlen()
    type()
    rd()
    q()
    ssdpProbe()
    sock()
    timer()
    ip()
    existing()
    st()
    nets()
    netsInfo()
    mdnsMs()
    ssdpMs()
    byIp()
    add()
    cur()
    probeBudget()
    alive()
    names()
    selfIps()
  gateway/auth.py:
    e: _parse_simple_yaml,load_grants,check_auth,check_grant
    _parse_simple_yaml(text)
    load_grants()
    check_auth(headers)
    check_grant(user;target_uri;action)
  generated/chat/message/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,msg
    raw()
    msg()
  gateway/handlers/proc.py:
    e: handle_proc_call
    handle_proc_call(request_handler;body)
  generated/dev/composite/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/proc.mjs
    e: input,task,organism,say,done,plan,deps,val,step,ev,orch,validate,r,stepLine,o,detail
    input()
    task()
    organism()
    say()
    done()
    plan()
    deps()
    val()
    step()
    ev()
    orch()
    validate()
    r()
    stepLine()
    o()
    detail()
  generated/dev/evolve/taskand.dev/v1/contract.mjs:
    i: node:child_process
    e: guard,hit,contractTest,r
    guard()
    hit()
    contractTest()
    r()
  generated/dev/evolve/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/catalog.mjs,../../../../_lib/proc.mjs,./contract.mjs,node:fs,node:path
    e: input,slug,organism,name,bin,dir,MAX_ATTEMPTS,gen,violation,test,desc,contractTestSource,r,out
    input()
    slug()
    organism()
    name()
    bin()
    dir()
    MAX_ATTEMPTS()
    gen()
    violation()
    test()
    desc()
    contractTestSource()
    r()
    out()
  gateway/utils.py:
    e: proc_hash,find_proc_bin
    proc_hash(binpath)
    find_proc_bin(uri)
  gateway/handlers/federation.py:
    e: handle_federation
    handle_federation(request_handler;body)
  generated/validator/resolve/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/catalog.mjs,node:fs,node:path,node:url
    e: __filename,__dirname,raw,blueprint,steps,ids,names,color,stepMap,hasCycle,dfs,currentStep,p,val,catPath,catalogMap,entry,fullPath,visited,visit,stepObj,isValid
    __filename()
    __dirname()
    raw()
    blueprint()
    steps()
    ids()
    names()
    color()
    stepMap()
    hasCycle()
    dfs()
    currentStep()
    p()
    val()
    catPath()
    catalogMap()
    entry()
    fullPath()
    visited()
    visit()
    stepObj()
    isValid()
  generated/planner/plan/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/proc.mjs,node:fs,node:path,node:url
    e: __filename,__dirname,raw,task,catPath,cat,capabilityLines,plan,llm,kLower,val,t
    __filename()
    __dirname()
    raw()
    task()
    catPath()
    cat()
    capabilityLines()
    plan()
    llm()
    kLower()
    val()
    t()
  generated/_lib/proc.mjs:
    i: node:child_process,node:fs,node:path,node:url
    e: here,ROOT,GEN,readInput,raw,emit,adoptOwnership,walk,uriToPath,parts,ver,callProc,bin,r,out
    here()
    ROOT()
    GEN()
    readInput()
    raw()
    emit()
    adoptOwnership()
    walk()
    uriToPath()
    parts()
    ver()
    callProc()
    bin()
    r()
    out()
  generated/dev/act/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/catalog.mjs,../../../../_lib/proc.mjs,../../../llm/taskand.dev/v1/context.mjs
    e: input,message,organism,decision,decide,r,answer,run,resolved,result,evolve,ev,invalid,why,format,head,summary,data
    input()
    message()
    organism()
    decision()
    decide()
    r()
    answer()
    run()
    resolved()
    result()
    evolve()
    ev()
    invalid()
    why()
    format()
    head()
    summary()
    data()
  generated/dev/chat/taskand.dev/v1/dispatch.mjs:
    i: ../../../../_lib/catalog.mjs,../../../../_lib/proc.mjs,../../../../_lib/proc.mjs,node:fs,node:path
    e: P,replyOf,dispatch,telemetry,hw,sensors,diagnose,d,webStatus,d,web,spawnOrganism,uri,bin,r,organismTemplate,input,message,r
    P()
    replyOf()
    dispatch()
    telemetry()
    hw()
    sensors()
    diagnose()
    d()
    webStatus()
    d()
    web()
    spawnOrganism()
    uri()
    bin()
    r()
    organismTemplate()
    input()
    message()
    r()
  gateway/handlers/orchestrator.py:
    e: handle_orchestrator
    handle_orchestrator(request_handler;body)
  generated/_lib/catalog.mjs:
    i: ./proc.mjs,node:crypto,node:fs,node:path,node:url
    e: CATALOG_PATH,GENOME_PATH,loadCatalog,saveCatalog,procHash,dir,h,modules,resolveUri,entry,bin,register,bin,cat,addToGenome,text,idx,rest,blockEnd,at,rehashAll,cat,bin,h,changed
    CATALOG_PATH()
    GENOME_PATH()
    loadCatalog()
    saveCatalog()
    procHash()
    dir()
    h()
    modules()
    resolveUri()
    entry()
    bin()
    register()
    bin()
    cat()
    addToGenome()
    text()
    idx()
    rest()
    blockEnd()
    at()
    rehashAll()
    cat()
    bin()
    h()
    changed()
  generated/dev/llm/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/proc.mjs
    e: input,KEY,MODEL,URL,messages,extractJson,fenced,candidate,start,end,resp,data,choice,content,json
    input()
    KEY()
    MODEL()
    URL()
    messages()
    extractJson()
    fenced()
    candidate()
    start()
    end()
    resp()
    data()
    choice()
    content()
    json()
  generated/monitor/cpu/taskand.dev/v1/bin.mjs:
    i: node:fs,node:os
    e: raw,cpuPct,cpus,totalIdle,idlePct
    raw()
    cpuPct()
    cpus()
    totalIdle()
    idlePct()
  generated/alert/telegram/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,cpuVal,depData,threshold,chatId,credRef,isOver,alertMsg
    raw()
    cpuVal()
    depData()
    threshold()
    chatId()
    credRef()
    isOver()
    alertMsg()
  gateway/handlers/planner.py:
    e: handle_planner
    handle_planner(request_handler;body)
  generated/dev/chat/taskand.dev/v1/intent.mjs:
    e: hasAny,matches,parseIntent,low,match
    hasAny()
    matches()
    parseIntent()
    low()
    match()
  gateway/__init__.py:
    e: GatewayHTTPHandler,main
    GatewayHTTPHandler(BaseHTTPRequestHandler): _send(2),do_OPTIONS(0),do_GET(0),do_POST(0),log_message(1)
    main()
  gateway/handlers/doctor.py:
    e: handle_doctor
    handle_doctor(request_handler;body)
  generated/hw/monitor/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:fs,node:os
    e: raw,TEMP_WARN_C,readSensorsCmd,out,readThermalZones,temp_c,sensor,pickCpuTemp,hits,cpuTimes,t,cpuUsagePct,a,b,total,diskFreeGb,parts,gpioChips,fromCmd,sensors,cpu,hot,usage,summary
    raw()
    TEMP_WARN_C()
    readSensorsCmd()
    out()
    readThermalZones()
    temp_c()
    sensor()
    pickCpuTemp()
    hits()
    cpuTimes()
    t()
    cpuUsagePct()
    a()
    b()
    total()
    diskFreeGb()
    parts()
    gpioChips()
    fromCmd()
    sensors()
    cpu()
    hot()
    usage()
    summary()
  generated/doctor/diagnose/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/catalog.mjs,../../../../_lib/proc.mjs
    e: probe,r,checkService,checkCatalog,cat,broken,total,passed
    probe()
    r()
    checkService()
    checkCatalog()
    cat()
    broken()
    total()
    passed()
  generated/dev/llm/taskand.dev/v1/context.mjs:
    i: ../../../../_lib/catalog.mjs
    e: capabilities,procs,capabilityContext
    capabilities()
    procs()
    capabilityContext()
  generated/developer/spawn/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,KEY,org
    raw()
    KEY()
    org()
  generated/orchestrator/execute/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: __dirname,r,out
    __dirname()
    r()
    out()
  generated/dev/chat/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r,out
    r()
    out()
  generated/browser/session/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,act,url,dev
    raw()
    act()
    url()
    dev()
  gateway/router.py:
    e: dispatch
    dispatch(method;path;request_handler;body)
  generated/vault/secrets/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,act
    raw()
    act()
  generated/web/serve/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: action
    action()
  generated/web/serve/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: __dirname,r,out
    __dirname()
    r()
    out()
  generated/file/ops/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,op,target
    raw()
    op()
    target()
  generated/doctor/prescribe/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw
    raw()
  generated/dev/codegen/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,desc
    raw()
    desc()
  generated/dev/execute/taskand.dev/v1/bin.mjs:
    i: node:child_process,node:fs,node:path,node:url
    e: __filename,__dirname,raw,intent,desc,devChatBin,r,out
    __filename()
    __dirname()
    raw()
    intent()
    desc()
    devChatBin()
    r()
    out()
  generated/dev/execute/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r,out
    r()
    out()
  gateway/middleware/logging.py:
    e: log_event
    log_event(event_type;payload)
  gateway/handlers/health.py:
    e: handle_healthz
    handle_healthz(request_handler;body)
  generated/admin/chat/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/proc.mjs
    e: input,message,r
    input()
    message()
    r()
  generated/dev/file-router/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/proc.mjs,node:fs
    e: input,path,st,kind
    input()
    path()
    st()
    kind()
  generated/dev/chat/taskand.dev/v1/bin.mjs:
    i: ../../../../_lib/proc.mjs,./dispatch.mjs,./intent.mjs
    e: input,prompt,intent
    input()
    prompt()
    intent()
  generated/validator/resolve/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: __dirname,r1,r2
    __dirname()
    r1()
    r2()
  generated/planner/plan/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: __dirname,r,out
    __dirname()
    r()
    out()
  generated/monitor/cpu/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: __dirname,r,out
    __dirname()
    r()
    out()
  generated/alert/telegram/taskand.dev/v1/test.mjs:
    i: node:child_process,node:path,node:url
    e: __dirname,r,out
    __dirname()
    r()
    out()
  gateway/middleware/cors.py:
    e: add_cors_headers
    add_cors_headers(handler)
  generated/admin/network-device-discovery/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r,out
    r()
    out()
  grants.yaml:
  Dockerfile:
  project.sh:
  generated/validator/resolve/taskand.dev/v1/proc.yaml:
  generated/planner/plan/taskand.dev/v1/proc.yaml:
  generated/web/capsule.yaml:
  generated/web/serve/taskand.dev/v1/proc.yaml:
  generated/monitor/cpu/taskand.dev/v1/proc.yaml:
  generated/alert/telegram/taskand.dev/v1/proc.yaml:
  generated/orchestrator/execute/taskand.dev/v1/proc.yaml:
  generated/dev/chat/taskand.dev/v1/proc.yaml:
  generated/dev/execute/taskand.dev/v1/proc.yaml:
  tasks/inbox.yaml:
  vms/fedora-minimal/Dockerfile:
  proc-catalog.json:
  genome.yaml:
  docker-compose.yaml:
  Makefile:
  generated/admin/network-device-discovery/taskand.dev/v1/proc.yaml:
  generated/admin/chat/taskand.dev/v1/proc.yaml:
```

### `project/logic.pl`

```prolog markpact:analysis path=project/logic.pl
% ── Project Metadata ─────────────────────────────────────
project_metadata('glm53', '0.0.0', 'python').

% ── Project Files ────────────────────────────────────────
project_file('app.doql.less', 97, 'less').
project_file('gateway/__init__.py', 49, 'python').
project_file('gateway/auth.py', 125, 'python').
project_file('gateway/handlers/__init__.py', 1, 'python').
project_file('gateway/handlers/chat.py', 139, 'python').
project_file('gateway/handlers/doctor.py', 17, 'python').
project_file('gateway/handlers/federation.py', 26, 'python').
project_file('gateway/handlers/health.py', 12, 'python').
project_file('gateway/handlers/orchestrator.py', 50, 'python').
project_file('gateway/handlers/planner.py', 30, 'python').
project_file('gateway/handlers/proc.py', 66, 'python').
project_file('gateway/middleware/__init__.py', 1, 'python').
project_file('gateway/middleware/cors.py', 5, 'python').
project_file('gateway/middleware/logging.py', 23, 'python').
project_file('gateway/router.py', 28, 'python').
project_file('gateway/utils.py', 57, 'python').
project_file('gateway.py', 18, 'python').
project_file('generated/_lib/catalog.mjs', 110, 'javascript').
project_file('generated/_lib/proc.mjs', 59, 'javascript').
project_file('generated/admin/chat/taskand.dev/v1/bin.mjs', 10, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v1/bin.mjs', 292, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v1/test.mjs', 6, 'javascript').
project_file('generated/alert/telegram/taskand.dev/v1/bin.mjs', 60, 'javascript').
project_file('generated/alert/telegram/taskand.dev/v1/test.mjs', 19, 'javascript').
project_file('generated/browser/session/taskand.dev/v1/bin.mjs', 24, 'javascript').
project_file('generated/chat/message/taskand.dev/v1/bin.mjs', 25, 'javascript').
project_file('generated/dev/act/taskand.dev/v1/bin.mjs', 80, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/bin.mjs', 17, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/dispatch.mjs', 83, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/intent.mjs', 37, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('generated/dev/codegen/taskand.dev/v1/bin.mjs', 18, 'javascript').
project_file('generated/dev/composite/taskand.dev/v1/bin.mjs', 83, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/bin.mjs', 77, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/contract.mjs', 62, 'javascript').
project_file('generated/dev/execute/taskand.dev/v1/bin.mjs', 42, 'javascript').
project_file('generated/dev/execute/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('generated/dev/file-router/taskand.dev/v1/bin.mjs', 18, 'javascript').
project_file('generated/dev/llm/taskand.dev/v1/bin.mjs', 60, 'javascript').
project_file('generated/dev/llm/taskand.dev/v1/context.mjs', 17, 'javascript').
project_file('generated/developer/spawn/taskand.dev/v1/bin.mjs', 20, 'javascript').
project_file('generated/doctor/diagnose/taskand.dev/v1/bin.mjs', 51, 'javascript').
project_file('generated/doctor/prescribe/taskand.dev/v1/bin.mjs', 20, 'javascript').
project_file('generated/file/ops/taskand.dev/v1/bin.mjs', 21, 'javascript').
project_file('generated/hw/monitor/taskand.dev/v1/bin.mjs', 113, 'javascript').
project_file('generated/monitor/cpu/taskand.dev/v1/bin.mjs', 49, 'javascript').
project_file('generated/monitor/cpu/taskand.dev/v1/test.mjs', 15, 'javascript').
project_file('generated/orchestrator/execute/taskand.dev/v1/bin.mjs', 243, 'javascript').
project_file('generated/orchestrator/execute/taskand.dev/v1/test.mjs', 42, 'javascript').
project_file('generated/planner/plan/taskand.dev/v1/bin.mjs', 158, 'javascript').
project_file('generated/planner/plan/taskand.dev/v1/test.mjs', 15, 'javascript').
project_file('generated/validator/resolve/taskand.dev/v1/bin.mjs', 213, 'javascript').
project_file('generated/validator/resolve/taskand.dev/v1/test.mjs', 38, 'javascript').
project_file('generated/vault/secrets/taskand.dev/v1/bin.mjs', 21, 'javascript').
project_file('generated/web/serve/taskand.dev/v1/bin.mjs', 11, 'javascript').
project_file('generated/web/serve/taskand.dev/v1/test.mjs', 10, 'javascript').
project_file('project.sh', 59, 'shell').
project_file('tests/integration_test.mjs', 76, 'javascript').
project_file('tests/negative_tests.mjs', 148, 'javascript').

% ── Python Functions ─────────────────────────────────────
python_function('gateway/__init__.py', 'main', 0, 2, 8).
python_function('gateway/auth.py', '_parse_simple_yaml', 1, 14, 6).
python_function('gateway/auth.py', 'load_grants', 0, 7, 9).
python_function('gateway/auth.py', 'check_auth', 1, 8, 7).
python_function('gateway/auth.py', 'check_grant', 3, 7, 2).
python_function('gateway/handlers/chat.py', 'llm_env', 0, 2, 2).
python_function('gateway/handlers/chat.py', 'handle_chat', 2, 29, 14).
python_function('gateway/handlers/doctor.py', 'handle_doctor', 2, 4, 7).
python_function('gateway/handlers/federation.py', 'handle_federation', 2, 8, 12).
python_function('gateway/handlers/health.py', 'handle_healthz', 2, 2, 5).
python_function('gateway/handlers/orchestrator.py', 'handle_orchestrator', 2, 6, 11).
python_function('gateway/handlers/planner.py', 'handle_planner', 2, 5, 8).
python_function('gateway/handlers/proc.py', 'handle_proc_call', 2, 9, 12).
python_function('gateway/middleware/cors.py', 'add_cors_headers', 1, 1, 1).
python_function('gateway/middleware/logging.py', 'log_event', 2, 2, 6).
python_function('gateway/router.py', 'dispatch', 4, 3, 4).
python_function('gateway/utils.py', 'proc_hash', 1, 5, 7).
python_function('gateway/utils.py', 'find_proc_bin', 1, 9, 6).

% ── Python Classes ───────────────────────────────────────
python_class('gateway/__init__.py', 'GatewayHTTPHandler').
python_method('GatewayHTTPHandler', '_send', 2, 1, 9).
python_method('GatewayHTTPHandler', 'do_OPTIONS', 0, 1, 3).
python_method('GatewayHTTPHandler', 'do_GET', 0, 1, 1).
python_method('GatewayHTTPHandler', 'do_POST', 0, 4, 6).
python_method('GatewayHTTPHandler', 'log_message', 1, 2, 3).

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('all', '').
makefile_target('up', '').
makefile_target('down', '').
makefile_target('status', '').
makefile_target('test', '').
makefile_target('test-contracts', '').
makefile_target('test-negative', '').
makefile_target('integration', '').
makefile_target('catalog', 'Przelicza bindingHash w proc-catalog.json po ręcznej zmianie procesu').
makefile_target('bootstrap', '').
makefile_target('gateway', '').
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

## Intent

taskand v2.2 — Planowanie złożonych zadań + generowanie organizmów na żądanie (Standard v2.2)
