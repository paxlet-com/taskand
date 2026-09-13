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
  step-1: depend target=conformance;
  step-2: depend target=test-contracts;
  step-3: depend target=test-negative;
}

workflow[name="conformance"] {
  trigger: manual;
  step-1: run cmd=node tests/conformance.mjs;
}

workflow[name="test-contracts"] {
  trigger: manual;
  step-1: run cmd=node tests/contract_tests.mjs;
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
  step-1: run cmd=node generated/registry/core/taskand.dev/v1/bin.mjs <<< '{"action":"refresh"}';
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

- `SHELL`
- `all`
- `up`
- `down`
- `status`
- `test`
- `conformance`
- `test-contracts`
- `test-negative`
- `integration`
- `catalog` — Po ręcznej zmianie pakietu wbudowanego (origin: builtin) — przelicza bindingHash w rejestrach organizmów
- `bootstrap`
- `gateway`
- `clean`

## Code Analysis

### `project/map.toon.yaml`

```toon markpact:analysis path=project/map.toon.yaml
# glm53 | 134f 6313L | python:13,yaml:36,shell:1,json:15,javascript:66 | 2026-09-13
# generated in 0.03s
# producer: code2llm | artifact: map.toon.yaml | schema: 1
# stats: 733 func | 0 cls | 134 mod | CC̄=3.3 | critical:9 | cycles:0
# alerts[5]: CC scan=30; CC mergeDevices=25; fan-out scan=20; CC readArp=20; fan-out probeMdns=19
# hotspots[5]: scan fan=20; probeMdns fan=19; probeMdns fan=19; mdnsProbe fan=18; call fan=18
# evolution: CC̄ 3.1→3.3 (regressed +0.2)
# Keys: M=modules, D=details, i=imports, e=exports, c=classes, f=functions, m=methods
M[134]:
  Dockerfile,68
  Makefile,42
  docker-compose.yaml,63
  gateway/__init__.py,51
  gateway/auth.py,142
  gateway/handlers/chat.py,25
  gateway/handlers/doctor.py,11
  gateway/handlers/federation.py,36
  gateway/handlers/health.py,18
  gateway/handlers/orchestrator.py,14
  gateway/handlers/planner.py,11
  gateway/handlers/proc.py,16
  gateway/middleware/cors.py,4
  gateway/middleware/logging.py,28
  gateway/router.py,29
  gateway/utils.py,47
  generated/admin/chat/taskand.dev/v1/bin.mjs,18
  generated/admin/chat/taskand.dev/v1/proc.yaml,5
  generated/admin/network-device-discovery/taskand.dev/v1/bin.mjs,292
  generated/admin/network-device-discovery/taskand.dev/v1/proc.yaml,5
  generated/admin/network-device-discovery/taskand.dev/v1/test.mjs,5
  generated/admin/network-device-discovery/taskand.dev/v2/bin.mjs,47
  generated/admin/network-device-discovery/taskand.dev/v2/merge.mjs,41
  generated/admin/network-device-discovery/taskand.dev/v2/networks.mjs,74
  generated/admin/network-device-discovery/taskand.dev/v2/probe-arp.mjs,33
  generated/admin/network-device-discovery/taskand.dev/v2/probe-dns.mjs,14
  generated/admin/network-device-discovery/taskand.dev/v2/probe-mdns.mjs,61
  generated/admin/network-device-discovery/taskand.dev/v2/probe-ssdp.mjs,37
  generated/admin/network-device-discovery/taskand.dev/v2/probe-tcp.mjs,40
  generated/admin/network-device-discovery/taskand.dev/v2/proc.yaml,6
  generated/admin/network-device-discovery/taskand.dev/v2/stdin.mjs,28
  generated/admin/network-device-discovery/taskand.dev/v2/test.mjs,6
  generated/admin/network-device-discovery/taskand.dev/v2/vendor.mjs,57
  generated/admin/network-device-discovery/taskand.dev/v3/bin.mjs,50
  generated/admin/network-device-discovery/taskand.dev/v3/exec.mjs,26
  generated/admin/network-device-discovery/taskand.dev/v3/merge.mjs,32
  generated/admin/network-device-discovery/taskand.dev/v3/network.mjs,45
  generated/admin/network-device-discovery/taskand.dev/v3/oui.mjs,64
  generated/admin/network-device-discovery/taskand.dev/v3/probe-arp.mjs,32
  generated/admin/network-device-discovery/taskand.dev/v3/probe-dns.mjs,14
  generated/admin/network-device-discovery/taskand.dev/v3/probe-mdns.mjs,43
  generated/admin/network-device-discovery/taskand.dev/v3/probe-ping.mjs,37
  generated/admin/network-device-discovery/taskand.dev/v3/probe-ssdp.mjs,47
  generated/admin/network-device-discovery/taskand.dev/v3/proc.yaml,7
  generated/admin/network-device-discovery/taskand.dev/v3/stdin.mjs,23
  generated/admin/network-device-discovery/taskand.dev/v3/test.mjs,6
  generated/admin/network-device-discovery/taskand.dev/v4/address.mjs,32
  generated/admin/network-device-discovery/taskand.dev/v4/bin.mjs,50
  generated/admin/network-device-discovery/taskand.dev/v4/inventory.mjs,28
  generated/admin/network-device-discovery/taskand.dev/v4/proc.yaml,6
  generated/admin/registry.json,101
  generated/alert/registry.json,27
  generated/alert/telegram/taskand.dev/v1/bin.mjs,58
  generated/alert/telegram/taskand.dev/v1/proc.yaml,6
  generated/browser/registry.json,28
  generated/browser/session/taskand.dev/v1/bin.mjs,60
  generated/browser/session/taskand.dev/v1/proc.yaml,6
  generated/chat/message/taskand.dev/v1/bin.mjs,22
  generated/chat/message/taskand.dev/v1/proc.yaml,5
  generated/chat/registry.json,24
  generated/cluster/monitor/taskand.dev/v1/bin.mjs,72
  generated/cluster/monitor/taskand.dev/v1/proc.yaml,5
  generated/cluster/monitor/taskand.dev/v1/registry-client.mjs,23
  generated/cluster/registry.json,26
  generated/dev/act/taskand.dev/v1/bin.mjs,91
  generated/dev/act/taskand.dev/v1/proc.yaml,5
  generated/dev/chat/taskand.dev/v1/bin.mjs,23
  generated/dev/chat/taskand.dev/v1/dispatch.mjs,71
  generated/dev/chat/taskand.dev/v1/intent.mjs,53
  generated/dev/chat/taskand.dev/v1/proc.yaml,5
  generated/dev/codegen/taskand.dev/v1/bin.mjs,37
  generated/dev/codegen/taskand.dev/v1/proc.yaml,5
  generated/dev/composite/taskand.dev/v1/bin.mjs,101
  generated/dev/composite/taskand.dev/v1/proc.yaml,5
  generated/dev/evolve/taskand.dev/v1/bin.mjs,94
  generated/dev/evolve/taskand.dev/v1/contract.mjs,89
  generated/dev/evolve/taskand.dev/v1/gate.mjs,70
  generated/dev/evolve/taskand.dev/v1/proc.yaml,5
  generated/dev/file-router/taskand.dev/v1/bin.mjs,26
  generated/dev/file-router/taskand.dev/v1/proc.yaml,5
  generated/dev/llm/taskand.dev/v1/bin.mjs,71
  generated/dev/llm/taskand.dev/v1/proc.yaml,6
  generated/dev/registry.json,163
  generated/dev/spawn/taskand.dev/v1/bin.mjs,66
  generated/dev/spawn/taskand.dev/v1/proc.yaml,5
  generated/doctor/diagnose/taskand.dev/v1/bin.mjs,126
  generated/doctor/diagnose/taskand.dev/v1/proc.yaml,5
  generated/doctor/heal/taskand.dev/v1/bin.mjs,101
  generated/doctor/heal/taskand.dev/v1/proc.yaml,5
  generated/doctor/heal/taskand.dev/v1/registry-client.mjs,23
  generated/doctor/prescribe/taskand.dev/v1/bin.mjs,75
  generated/doctor/prescribe/taskand.dev/v1/proc.yaml,5
  generated/doctor/registry.json,66
  generated/file/ops/taskand.dev/v1/bin.mjs,50
  generated/file/ops/taskand.dev/v1/proc.yaml,5
  generated/file/registry.json,24
  generated/hw/monitor/taskand.dev/v1/bin.mjs,112
  generated/hw/monitor/taskand.dev/v1/proc.yaml,5
  generated/hw/registry.json,24
  generated/monitor/cpu/taskand.dev/v1/bin.mjs,40
  generated/monitor/cpu/taskand.dev/v1/proc.yaml,5
  generated/monitor/registry.json,24
  generated/orchestrator/execute/taskand.dev/v1/bin.mjs,168
  generated/orchestrator/execute/taskand.dev/v1/proc.yaml,5
  generated/orchestrator/registry.json,25
  generated/planner/plan/taskand.dev/v1/bin.mjs,148
  generated/planner/plan/taskand.dev/v1/proc.yaml,5
  generated/planner/registry.json,26
  generated/registry/core/taskand.dev/v1/bin.mjs,55
  generated/registry/core/taskand.dev/v1/exec.mjs,94
  generated/registry/core/taskand.dev/v1/federation.mjs,74
  generated/registry/core/taskand.dev/v1/lifecycle.mjs,121
  generated/registry/core/taskand.dev/v1/package.mjs,61
  generated/registry/core/taskand.dev/v1/proc.yaml,5
  generated/registry/core/taskand.dev/v1/select.mjs,16
  generated/registry/core/taskand.dev/v1/store.mjs,166
  generated/registry/core/taskand.dev/v1/vault.mjs,25
  generated/registry/registry.json,32
  generated/validator/registry.json,26
  generated/validator/resolve/taskand.dev/v1/bin.mjs,178
  generated/validator/resolve/taskand.dev/v1/proc.yaml,5
  generated/validator/resolve/taskand.dev/v1/registry-client.mjs,23
  generated/web/capsule.yaml,9
  generated/web/registry.json,25
  generated/web/serve/taskand.dev/v1/bin.mjs,37
  generated/web/serve/taskand.dev/v1/proc.yaml,5
  genome.yaml,86
  grants.yaml,31
  planfile.yaml,591
  prefact.yaml,94
  project.sh,59
  tasks/inbox.yaml,0
  testql-scenarios/generated-api-smoke.testql.toon.yaml,39
  vms/fedora-minimal/Dockerfile,9
D:
  generated/admin/network-device-discovery/taskand.dev/v4/bin.mjs:
    i: ./address.mjs,./inventory.mjs,node:fs
    e: scan,topology,mode,targets,devices,add,count,xml,ip,input,params
    scan()
    topology()
    mode()
    targets()
    devices()
    add()
    count()
    xml()
    ip()
    input()
    params()
  generated/admin/network-device-discovery/taskand.dev/v3/merge.mjs:
    e: mergeDevices,list,byKey,mac,key,cur,byIp,t
    mergeDevices()
    list()
    byKey()
    mac()
    key()
    cur()
    byIp()
    t()
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
  generated/dev/evolve/taskand.dev/v1/contract.mjs:
    i: node:child_process,node:url
    e: MAX_MODULE_LINES,guard,lines,spec,sibling,contractTest,r,r,out
    MAX_MODULE_LINES()
    guard()
    lines()
    spec()
    sibling()
    contractTest()
    r()
    r()
    out()
  generated/registry/core/taskand.dev/v1/lifecycle.mjs:
    i: ./package.mjs,./store.mjs,node:fs,node:path
    e: initialStatus,register,loc,errors,existing,hash,m,src,setStatus,loc,entry,updated,refresh,targets,loc,problems,hash,m,approve,deprecate,list,processes,verify,broken,scan,found,base,unregistered,results
    initialStatus()
    register()
    loc()
    errors()
    existing()
    hash()
    m()
    src()
    setStatus()
    loc()
    entry()
    updated()
    refresh()
    targets()
    loc()
    problems()
    hash()
    m()
    approve()
    deprecate()
    list()
    processes()
    verify()
    broken()
    scan()
    found()
    base()
    unregistered()
    results()
  generated/admin/network-device-discovery/taskand.dev/v2/networks.mjs:
    i: node:child_process,node:os,node:util
    e: execFileP,isDockerIface,cidrFromAddrMask,ipParts,maskParts,maskBits,m,bits,listLocalNetworks,ifaces,cidr,m,ipInNetworks,a,m,b,bits,mask,byteBits,ai,bi
    execFileP()
    isDockerIface()
    cidrFromAddrMask()
    ipParts()
    maskParts()
    maskBits()
    m()
    bits()
    listLocalNetworks()
    ifaces()
    cidr()
    m()
    ipInNetworks()
    a()
    m()
    b()
    bits()
    mask()
    byteBits()
    ai()
    bi()
  gateway/auth.py:
    e: bind_address,is_loopback_bind,_parse_simple_yaml,load_grants,check_auth,check_grant,require_grant
    bind_address()
    is_loopback_bind()
    _parse_simple_yaml(text)
    load_grants()
    check_auth(headers)
    check_grant(user;target_uri;action)
    require_grant(request_handler;target_uri;action)
  generated/admin/network-device-discovery/taskand.dev/v2/merge.mjs:
    e: mergeDevices,map,get,addSource,dev,dev,dev,dev
    mergeDevices()
    map()
    get()
    addSource()
    dev()
    dev()
    dev()
    dev()
  generated/registry/core/taskand.dev/v1/package.mjs:
    i: node:crypto,node:fs,node:path
    e: packageFiles,packageHash,h,readManifest,file,m,raw,unquote,checkPackage,manifest,files,spec
    packageFiles()
    packageHash()
    h()
    readManifest()
    file()
    m()
    raw()
    unquote()
    checkPackage()
    manifest()
    files()
    spec()
  generated/registry/core/taskand.dev/v1/exec.mjs:
    i: ./package.mjs,./store.mjs,./vault.mjs,node:child_process,node:fs,node:path
    e: MAX_DEPTH,secretSource,m,resolve,entry,actual,fail,matches,credentialEnv,ref,purpose,v,call,res,secrets,started,r,out,parseJson,v,outcome,parsed,errorType
    MAX_DEPTH()
    secretSource()
    m()
    resolve()
    entry()
    actual()
    fail()
    matches()
    credentialEnv()
    ref()
    purpose()
    v()
    call()
    res()
    secrets()
    started()
    r()
    out()
    parseJson()
    v()
    outcome()
    parsed()
    errorType()
  generated/doctor/diagnose/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs,node:url
    e: raw,EVENTS,FAILING_STREAK,EVENTS_WINDOW,CRASH_TYPES,find,probe,checkServices,up,checkRegistry,v,e,checkFailingProcesses,bySubject,e,entry,recent,lastError,checkDependencies,vault,browser,checkPeers,c,entries,problems
    raw()
    EVENTS()
    FAILING_STREAK()
    EVENTS_WINDOW()
    CRASH_TYPES()
    find()
    probe()
    checkServices()
    up()
    checkRegistry()
    v()
    e()
    checkFailingProcesses()
    bySubject()
    e()
    entry()
    recent()
    lastError()
    checkDependencies()
    vault()
    browser()
    checkPeers()
    c()
    entries()
    problems()
  generated/dev/evolve/taskand.dev/v1/gate.mjs:
    i: ./registry-client.mjs
    e: CRASH,clip,digest,visit,key,compareCounts,before,after,keys,diff,fewer,more,fmt,compare,old,oldBroken,byCounts,judge
    CRASH()
    clip()
    digest()
    visit()
    key()
    compareCounts()
    before()
    after()
    keys()
    diff()
    fewer()
    more()
    fmt()
    compare()
    old()
    oldBroken()
    byCounts()
    judge()
  generated/admin/network-device-discovery/taskand.dev/v3/bin.mjs:
    i: ./merge.mjs,./network.mjs,./oui.mjs,./probe-arp.mjs,./probe-dns.mjs,./probe-mdns.mjs,./probe-ping.mjs,./probe-ssdp.mjs,./stdin.mjs
    e: input,t0,net,arpDevices,ping,mdns,ssdp,devices,hostname,names,elapsed
    input()
    t0()
    net()
    arpDevices()
    ping()
    mdns()
    ssdp()
    devices()
    hostname()
    names()
    elapsed()
  generated/doctor/heal/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs,node:url
    e: raw,EVENTS,MAX_PER_RUN,COOLDOWN_MS,EVOLVE_TIMEOUT_MS,policy,mode,before,rx,forOrganisms,forHumans,after,heal,out,ok,ok,recentlyHealed,e,report,last,done
    raw()
    EVENTS()
    MAX_PER_RUN()
    COOLDOWN_MS()
    EVOLVE_TIMEOUT_MS()
    policy()
    mode()
    before()
    rx()
    forOrganisms()
    forHumans()
    after()
    heal()
    out()
    ok()
    ok()
    recentlyHealed()
    e()
    report()
    last()
    done()
  generated/admin/network-device-discovery/taskand.dev/v3/probe-arp.mjs:
    i: ./exec.mjs,node:fs/promises
    e: probeArp,raw,lines,p,ip,r,ip,mac
    probeArp()
    raw()
    lines()
    p()
    ip()
    r()
    ip()
    mac()
  generated/registry/core/taskand.dev/v1/federation.mjs:
    i: ./lifecycle.mjs,./package.mjs,./store.mjs,node:fs,node:path
    e: exportCatalog,processes,packagePayload,entry,files,fetchJson,r,pull,remote,wanted,imported,pullOne,loc,local,pkg,payload,install,names,hash,errors,reg
    exportCatalog()
    processes()
    packagePayload()
    entry()
    files()
    fetchJson()
    r()
    pull()
    remote()
    wanted()
    imported()
    pullOne()
    loc()
    local()
    pkg()
    payload()
    install()
    names()
    hash()
    errors()
    reg()
  generated/dev/composite/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,task,organism,say,done,plan,deps,val,orch,validate,r,evolveStep,step,ev,stepLine,o,detail
    raw()
    task()
    organism()
    say()
    done()
    plan()
    deps()
    val()
    orch()
    validate()
    r()
    evolveStep()
    step()
    ev()
    stepLine()
    o()
    detail()
  generated/cluster/monitor/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,peers,local,fetchJson,r,checkPeer,base,cat,pulled,down,up
    raw()
    peers()
    local()
    fetchJson()
    r()
    checkPeer()
    base()
    cat()
    pulled()
    down()
    up()
  generated/admin/network-device-discovery/taskand.dev/v3/network.mjs:
    i: ./exec.mjs
    e: detectNetwork,r,text,alt,m,cidr,src,altCidr,cidrToIps,bits,b,size,ipNum,network,numToIp
    detectNetwork()
    r()
    text()
    alt()
    m()
    cidr()
    src()
    altCidr()
    cidrToIps()
    bits()
    b()
    size()
    ipNum()
    network()
    numToIp()
  generated/planner/plan/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,task,catalogProcs,capabilityLines,plan,llm,kLower,val,t
    raw()
    task()
    catalogProcs()
    capabilityLines()
    plan()
    llm()
    kLower()
    val()
    t()
  generated/admin/network-device-discovery/taskand.dev/v2/probe-mdns.mjs:
    i: node:dgram,node:timers/promises
    e: MDNS_PORT,QUERY,extractNames,i,len,probeMdns,socket,finish,timer,ip
    MDNS_PORT()
    QUERY()
    extractNames()
    i()
    len()
    probeMdns()
    socket()
    finish()
    timer()
    ip()
  generated/admin/network-device-discovery/taskand.dev/v3/stdin.mjs:
    i: node:process
    e: readStdinJson,timer,trimmed,parsed
    readStdinJson()
    timer()
    trimmed()
    parsed()
  generated/admin/network-device-discovery/taskand.dev/v3/exec.mjs:
    i: node:child_process
    e: run,settled,t
    run()
    settled()
    t()
  generated/dev/chat/taskand.dev/v1/intent.mjs:
    e: DOCTOR,DOCTOR_INTENTS,DEVELOPER,hasAny,matches,parseIntent,org,low,match
    DOCTOR()
    DOCTOR_INTENTS()
    DEVELOPER()
    hasAny()
    matches()
    parseIntent()
    org()
    low()
    match()
  generated/admin/network-device-discovery/taskand.dev/v3/probe-ssdp.mjs:
    i: node:dgram
    e: probeSsdp,done,timer,text,server,usn,hostname,u
    probeSsdp()
    done()
    timer()
    text()
    server()
    usn()
    hostname()
    u()
  generated/dev/chat/taskand.dev/v1/dispatch.mjs:
    i: ./registry-client.mjs
    e: P,LONG,replyOf,organismChat,r,dispatch,telemetry,hw,sensors,diagnose,d,prescribe,r,webStatus,d,fileList,path,r
    P()
    LONG()
    replyOf()
    organismChat()
    r()
    dispatch()
    telemetry()
    hw()
    sensors()
    diagnose()
    d()
    prescribe()
    r()
    webStatus()
    d()
    fileList()
    path()
    r()
  generated/admin/network-device-discovery/taskand.dev/v4/address.mjs:
    i: node:net
    e: ipNumber,family,halves,left,right,words,formatIP,subnet,family,size,first,reserve,contains
    ipNumber()
    family()
    halves()
    left()
    right()
    words()
    formatIP()
    subnet()
    family()
    size()
    first()
    reserve()
    contains()
  generated/validator/resolve/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,blueprint,steps,ids,names,color,stepMap,hasCycle,dfs,currentStep,p,val,res,visited,visit,stepObj,isValid
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
    res()
    visited()
    visit()
    stepObj()
    isValid()
  generated/orchestrator/execute/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs,node:path,node:url
    e: ROOT,STEP_TIMEOUT_MS,raw,plan,runId,orchDir,stateFile,isResume,prev,saveState,prevStep,canExecute,blockingDep,depState,result,hasFailed,hasBlocked
    ROOT()
    STEP_TIMEOUT_MS()
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
    result()
    hasFailed()
    hasBlocked()
  generated/dev/act/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,message,organism,done,decision,capabilityContext,procs,decide,r,answer,run,result,evolve,ev,invalid,why,format,head,summary
    raw()
    message()
    organism()
    done()
    decision()
    capabilityContext()
    procs()
    decide()
    r()
    answer()
    run()
    result()
    evolve()
    ev()
    invalid()
    why()
    format()
    head()
    summary()
  generated/dev/spawn/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,./registry-client.mjs,node:fs,node:fs,node:path,node:url
    e: raw,done,organism,dir,reg,r,template,raw,message,r
    raw()
    done()
    organism()
    dir()
    reg()
    r()
    template()
    raw()
    message()
    r()
  generated/registry/core/taskand.dev/v1/select.mjs:
    i: ./exec.mjs,./store.mjs
    e: select,candidates,result
    select()
    candidates()
    result()
  generated/registry/core/taskand.dev/v1/store.mjs:
    i: node:fs,node:os,node:path,node:url
    e: ROOT,GEN,NODE_ID,GENOME,LOCK_WAIT_MS,LOCK_STALE_MS,parseUri,m,registryFile,readRegistry,organisms,allEntries,findEntry,loc,adoptOwnership,walk,sleep,updateRegistry,lock,deadline,reg,result,policy,m,readPeers,text,block,writePeers,text,body,replaced,addPeer,clean,peers,removePeer,clean,peers,addToGenome,text,idx,rest,end,at,audit
    ROOT()
    GEN()
    NODE_ID()
    GENOME()
    LOCK_WAIT_MS()
    LOCK_STALE_MS()
    parseUri()
    m()
    registryFile()
    readRegistry()
    organisms()
    allEntries()
    findEntry()
    loc()
    adoptOwnership()
    walk()
    sleep()
    updateRegistry()
    lock()
    deadline()
    reg()
    result()
    policy()
    m()
    readPeers()
    text()
    block()
    writePeers()
    text()
    body()
    replaced()
    addPeer()
    clean()
    peers()
    removePeer()
    clean()
    peers()
    addToGenome()
    text()
    idx()
    rest()
    end()
    at()
    audit()
  generated/admin/network-device-discovery/taskand.dev/v3/probe-mdns.mjs:
    i: node:dgram
    e: probeMdns,done,timer,ascii,names,name,q
    probeMdns()
    done()
    timer()
    ascii()
    names()
    name()
    q()
  generated/admin/network-device-discovery/taskand.dev/v4/inventory.mjs:
    i: ./address.mjs,node:child_process,node:fs,node:os
    e: command,r,jsonIP,inventory,interfaces,networks,neighbors
    command()
    r()
    jsonIP()
    inventory()
    interfaces()
    networks()
    neighbors()
  generated/validator/resolve/taskand.dev/v1/registry-client.mjs:
    i: node:child_process,node:url
    e: REGISTRY,registry,r,call
    REGISTRY()
    registry()
    r()
    call()
  generated/admin/network-device-discovery/taskand.dev/v2/probe-arp.mjs:
    i: ./networks.mjs,node:child_process,node:fs/promises,node:util
    e: execFileP,readArpTable,data,parts,refreshArpWithIpNeigh
    execFileP()
    readArpTable()
    data()
    parts()
    refreshArpWithIpNeigh()
  generated/admin/network-device-discovery/taskand.dev/v2/probe-ssdp.mjs:
    i: node:dgram
    e: SSDP_PORT,probeSsdp,socket,finish,timer,ip
    SSDP_PORT()
    probeSsdp()
    socket()
    finish()
    timer()
    ip()
  generated/registry/core/taskand.dev/v1/vault.mjs:
    i: ./store.mjs,node:crypto,node:fs,node:path
    e: openSecret,item,key,d
    openSecret()
    item()
    key()
    d()
  generated/dev/llm/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,emit,KEY,MODEL,URL,messages,extractJson,fenced,candidate,start,end,resp,data,choice,content,json
    raw()
    emit()
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
  generated/admin/network-device-discovery/taskand.dev/v3/probe-ping.mjs:
    i: ./exec.mjs,./network.mjs,node:dgram
    e: probePing,ips,fin,devices
    probePing()
    ips()
    fin()
    devices()
  generated/cluster/monitor/taskand.dev/v1/registry-client.mjs:
    i: node:child_process,node:url
    e: REGISTRY,registry,r,call
    REGISTRY()
    registry()
    r()
    call()
  generated/doctor/heal/taskand.dev/v1/registry-client.mjs:
    i: node:child_process,node:url
    e: REGISTRY,registry,r,call
    REGISTRY()
    registry()
    r()
    call()
  generated/dev/evolve/taskand.dev/v1/bin.mjs:
    i: ./contract.mjs,./gate.mjs,./registry-client.mjs,node:fs,node:path,node:url
    e: raw,done,slug,organism,name,GEN,MAX_ATTEMPTS,previous,capability,feedback,gen,violations,test,desc,reg,retired,findPrevious,entries,nextVersion,candidate,writeAndTest
    raw()
    done()
    slug()
    organism()
    name()
    GEN()
    MAX_ATTEMPTS()
    previous()
    capability()
    feedback()
    gen()
    violations()
    test()
    desc()
    reg()
    retired()
    findPrevious()
    entries()
    nextVersion()
    candidate()
    writeAndTest()
  gateway/handlers/federation.py:
    e: handle_well_known_catalog,handle_federation,handle_registry
    handle_well_known_catalog(request_handler;body)
    handle_federation(request_handler;body)
    handle_registry(request_handler;body)
  generated/admin/network-device-discovery/taskand.dev/v2/vendor.mjs:
    e: lookupVendor,oui,local
    lookupVendor()
    oui()
    local()
  generated/admin/network-device-discovery/taskand.dev/v2/probe-tcp.mjs:
    i: node:net
    e: CONNECT_TIMEOUT,probePort,socket,done,finish,probeTcp,existing
    CONNECT_TIMEOUT()
    probePort()
    socket()
    done()
    finish()
    probeTcp()
    existing()
  gateway/__init__.py:
    e: GatewayHTTPHandler,main
    GatewayHTTPHandler(BaseHTTPRequestHandler): _send(2),do_OPTIONS(0),do_GET(0),do_POST(0),log_message(1)
    main()
  generated/web/serve/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,params,port,started,status,error,up
    raw()
    params()
    port()
    started()
    status()
    error()
    up()
  generated/admin/network-device-discovery/taskand.dev/v2/bin.mjs:
    i: ./merge.mjs,./networks.mjs,./probe-arp.mjs,./probe-dns.mjs,./probe-mdns.mjs,./probe-ssdp.mjs,./probe-tcp.mjs,./stdin.mjs,./vendor.mjs
    e: out,input,params,includeDocker,networks,arpEntries,mdns,ssdp,candidateIps,tcp,dns,devices
    out()
    input()
    params()
    includeDocker()
    networks()
    arpEntries()
    mdns()
    ssdp()
    candidateIps()
    tcp()
    dns()
    devices()
  generated/admin/network-device-discovery/taskand.dev/v2/stdin.mjs:
    i: node:timers/promises
    e: readStdinJson,timer
    readStdinJson()
    timer()
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
  generated/alert/telegram/taskand.dev/v1/bin.mjs:
    i: node:fs,node:os,node:path
    e: raw,params,emit,cpu,threshold,token,chatId,RATE_MS,stamp,last,r,body
    raw()
    params()
    emit()
    cpu()
    threshold()
    token()
    chatId()
    RATE_MS()
    stamp()
    last()
    r()
    body()
  generated/dev/codegen/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,done,r,normalized
    raw()
    done()
    r()
    normalized()
  gateway/handlers/chat.py:
    e: handle_chat
    handle_chat(request_handler;body)
  generated/admin/network-device-discovery/taskand.dev/v3/oui.mjs:
    e: ouiVendor,norm,m
    ouiVendor()
    norm()
    m()
  generated/admin/network-device-discovery/taskand.dev/v2/probe-dns.mjs:
    i: node:dns
    e: reverseDns,map,names
    reverseDns()
    map()
    names()
  generated/file/ops/taskand.dev/v1/bin.mjs:
    i: node:fs,node:os,node:path
    e: raw,MAX_READ,op,path,scope,emit,st,entries,limit,st,buf
    raw()
    MAX_READ()
    op()
    path()
    scope()
    emit()
    st()
    entries()
    limit()
    st()
    buf()
  generated/browser/session/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,CDP,NOVNC,action,emit,cdp,r,text,tabs,v,tab
    raw()
    CDP()
    NOVNC()
    action()
    emit()
    cdp()
    r()
    text()
    tabs()
    v()
    tab()
  gateway/router.py:
    e: dispatch
    dispatch(method;path;request_handler;body)
  gateway/utils.py:
    e: registry,call_process,status_for
    registry(action;payload;timeout)
    call_process(uri;data;timeout)
    status_for(result)
  gateway/handlers/doctor.py:
    e: handle_doctor
    handle_doctor(request_handler;body)
  gateway/handlers/planner.py:
    e: handle_planner
    handle_planner(request_handler;body)
  gateway/handlers/orchestrator.py:
    e: handle_orchestrator
    handle_orchestrator(request_handler;body)
  gateway/handlers/proc.py:
    e: handle_proc_call
    handle_proc_call(request_handler;body)
  generated/admin/network-device-discovery/taskand.dev/v3/probe-dns.mjs:
    i: node:dns/promises
    e: reverseDns,names
    reverseDns()
    names()
  generated/registry/core/taskand.dev/v1/bin.mjs:
    i: ./exec.mjs,./federation.mjs,./lifecycle.mjs,./select.mjs,./store.mjs,node:fs
    e: raw,action
    raw()
    action()
  generated/doctor/prescribe/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,MUTABLE_BY_ORGANISMS,human,parseUri,reEvolve,diag,prescriptions,byOrganism
    raw()
    MUTABLE_BY_ORGANISMS()
    human()
    parseUri()
    reEvolve()
    diag()
    prescriptions()
    byOrganism()
  generated/admin/chat/taskand.dev/v1/bin.mjs:
    i: ./registry-client.mjs,node:fs
    e: raw,message,r
    raw()
    message()
    r()
  generated/monitor/cpu/taskand.dev/v1/bin.mjs:
    i: node:fs,node:os
    e: raw,SAMPLE_MS,times,t,a,b,total,cpuPct
    raw()
    SAMPLE_MS()
    times()
    t()
    a()
    b()
    total()
    cpuPct()
  generated/chat/message/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,message
    raw()
    message()
  generated/dev/file-router/taskand.dev/v1/bin.mjs:
    i: node:fs
    e: raw,emit,path,st,kind
    raw()
    emit()
    path()
    st()
    kind()
  generated/dev/chat/taskand.dev/v1/bin.mjs:
    i: ./dispatch.mjs,./intent.mjs,node:fs
    e: raw,intent
    raw()
    intent()
  gateway/middleware/logging.py:
    e: log_event
    log_event(event_type;payload)
  gateway/handlers/health.py:
    e: handle_healthz
    handle_healthz(request_handler;body)
  generated/admin/network-device-discovery/taskand.dev/v2/test.mjs:
    i: node:child_process,node:url
    e: r,out
    r()
    out()
  generated/admin/network-device-discovery/taskand.dev/v1/test.mjs:
    i: node:child_process
    e: r,out
    r()
    out()
  gateway/middleware/cors.py:
    e: add_cors_headers
    add_cors_headers(handler)
  generated/admin/network-device-discovery/taskand.dev/v3/test.mjs:
    i: node:child_process,node:url
    e: r,out
    r()
    out()
  docker-compose.yaml:
  Makefile:
  grants.yaml:
  prefact.yaml:
  Dockerfile:
  project.sh:
  generated/validator/registry.json:
  generated/validator/resolve/taskand.dev/v1/proc.yaml:
  generated/planner/registry.json:
  generated/planner/plan/taskand.dev/v1/proc.yaml:
  generated/web/registry.json:
  generated/web/capsule.yaml:
  generated/web/serve/taskand.dev/v1/proc.yaml:
  generated/admin/network-device-discovery/taskand.dev/v2/proc.yaml:
  generated/admin/network-device-discovery/taskand.dev/v1/proc.yaml:
  generated/admin/chat/taskand.dev/v1/proc.yaml:
  generated/monitor/registry.json:
  generated/monitor/cpu/taskand.dev/v1/proc.yaml:
  generated/file/registry.json:
  generated/file/ops/taskand.dev/v1/proc.yaml:
  generated/hw/registry.json:
  generated/hw/monitor/taskand.dev/v1/proc.yaml:
  generated/registry/core/taskand.dev/v1/proc.yaml:
  generated/chat/registry.json:
  generated/chat/message/taskand.dev/v1/proc.yaml:
  generated/alert/registry.json:
  generated/alert/telegram/taskand.dev/v1/proc.yaml:
  generated/doctor/prescribe/taskand.dev/v1/proc.yaml:
  generated/doctor/diagnose/taskand.dev/v1/proc.yaml:
  generated/orchestrator/registry.json:
  generated/orchestrator/execute/taskand.dev/v1/proc.yaml:
  generated/dev/composite/taskand.dev/v1/proc.yaml:
  generated/dev/llm/taskand.dev/v1/proc.yaml:
  generated/dev/act/taskand.dev/v1/proc.yaml:
  generated/dev/file-router/taskand.dev/v1/proc.yaml:
  generated/dev/codegen/taskand.dev/v1/proc.yaml:
  generated/dev/chat/taskand.dev/v1/proc.yaml:
  generated/dev/evolve/taskand.dev/v1/proc.yaml:
  generated/dev/spawn/taskand.dev/v1/proc.yaml:
  generated/browser/registry.json:
  generated/browser/session/taskand.dev/v1/proc.yaml:
  tasks/inbox.yaml:
  vms/fedora-minimal/Dockerfile:
  testql-scenarios/generated-api-smoke.testql.toon.yaml:
  genome.yaml:
  planfile.yaml:
  generated/admin/registry.json:
  generated/admin/network-device-discovery/taskand.dev/v4/proc.yaml:
  generated/admin/network-device-discovery/taskand.dev/v3/proc.yaml:
  generated/registry/registry.json:
  generated/cluster/registry.json:
  generated/cluster/monitor/taskand.dev/v1/proc.yaml:
  generated/doctor/heal/taskand.dev/v1/proc.yaml:
  generated/doctor/registry.json:
  generated/dev/registry.json:
```

### `project/logic.pl`

```prolog markpact:analysis path=project/logic.pl
% ── Project Metadata ─────────────────────────────────────
project_metadata('glm53', '0.0.0', 'python').

% ── Project Files ────────────────────────────────────────
project_file('app.doql.less', 95, 'less').
project_file('gateway/__init__.py', 52, 'python').
project_file('gateway/auth.py', 143, 'python').
project_file('gateway/handlers/__init__.py', 1, 'python').
project_file('gateway/handlers/chat.py', 26, 'python').
project_file('gateway/handlers/doctor.py', 12, 'python').
project_file('gateway/handlers/federation.py', 37, 'python').
project_file('gateway/handlers/health.py', 19, 'python').
project_file('gateway/handlers/orchestrator.py', 15, 'python').
project_file('gateway/handlers/planner.py', 12, 'python').
project_file('gateway/handlers/proc.py', 17, 'python').
project_file('gateway/middleware/__init__.py', 1, 'python').
project_file('gateway/middleware/cors.py', 5, 'python').
project_file('gateway/middleware/logging.py', 29, 'python').
project_file('gateway/router.py', 30, 'python').
project_file('gateway/utils.py', 48, 'python').
project_file('gateway.py', 18, 'python').
project_file('generated/admin/chat/taskand.dev/v1/bin.mjs', 19, 'javascript').
project_file('generated/admin/chat/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v1/bin.mjs', 292, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v1/test.mjs', 6, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/bin.mjs', 48, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/merge.mjs', 42, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/networks.mjs', 75, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/probe-arp.mjs', 34, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/probe-dns.mjs', 15, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/probe-mdns.mjs', 62, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/probe-ssdp.mjs', 38, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/probe-tcp.mjs', 41, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/stdin.mjs', 29, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/test.mjs', 7, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v2/vendor.mjs', 58, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/bin.mjs', 51, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/exec.mjs', 27, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/merge.mjs', 33, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/network.mjs', 46, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/oui.mjs', 65, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/probe-arp.mjs', 33, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/probe-dns.mjs', 15, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/probe-mdns.mjs', 44, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/probe-ping.mjs', 38, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/probe-ssdp.mjs', 48, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/stdin.mjs', 24, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v3/test.mjs', 7, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v4/address.mjs', 33, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v4/bin.mjs', 51, 'javascript').
project_file('generated/admin/network-device-discovery/taskand.dev/v4/inventory.mjs', 29, 'javascript').
project_file('generated/alert/telegram/taskand.dev/v1/bin.mjs', 59, 'javascript').
project_file('generated/browser/session/taskand.dev/v1/bin.mjs', 61, 'javascript').
project_file('generated/chat/message/taskand.dev/v1/bin.mjs', 23, 'javascript').
project_file('generated/cluster/monitor/taskand.dev/v1/bin.mjs', 73, 'javascript').
project_file('generated/cluster/monitor/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/dev/act/taskand.dev/v1/bin.mjs', 92, 'javascript').
project_file('generated/dev/act/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/bin.mjs', 24, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/dispatch.mjs', 72, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/intent.mjs', 54, 'javascript').
project_file('generated/dev/chat/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/dev/codegen/taskand.dev/v1/bin.mjs', 38, 'javascript').
project_file('generated/dev/codegen/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/dev/composite/taskand.dev/v1/bin.mjs', 102, 'javascript').
project_file('generated/dev/composite/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/bin.mjs', 95, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/contract.mjs', 90, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/gate.mjs', 71, 'javascript').
project_file('generated/dev/evolve/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/dev/file-router/taskand.dev/v1/bin.mjs', 27, 'javascript').
project_file('generated/dev/llm/taskand.dev/v1/bin.mjs', 72, 'javascript').
project_file('generated/dev/spawn/taskand.dev/v1/bin.mjs', 67, 'javascript').
project_file('generated/dev/spawn/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/doctor/diagnose/taskand.dev/v1/bin.mjs', 127, 'javascript').
project_file('generated/doctor/diagnose/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/doctor/heal/taskand.dev/v1/bin.mjs', 102, 'javascript').
project_file('generated/doctor/heal/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/doctor/prescribe/taskand.dev/v1/bin.mjs', 76, 'javascript').
project_file('generated/doctor/prescribe/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/file/ops/taskand.dev/v1/bin.mjs', 51, 'javascript').
project_file('generated/hw/monitor/taskand.dev/v1/bin.mjs', 113, 'javascript').
project_file('generated/monitor/cpu/taskand.dev/v1/bin.mjs', 41, 'javascript').
project_file('generated/orchestrator/execute/taskand.dev/v1/bin.mjs', 169, 'javascript').
project_file('generated/orchestrator/execute/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/planner/plan/taskand.dev/v1/bin.mjs', 149, 'javascript').
project_file('generated/planner/plan/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/bin.mjs', 56, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/exec.mjs', 95, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/federation.mjs', 75, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/lifecycle.mjs', 122, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/package.mjs', 62, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/select.mjs', 17, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/store.mjs', 167, 'javascript').
project_file('generated/registry/core/taskand.dev/v1/vault.mjs', 26, 'javascript').
project_file('generated/validator/resolve/taskand.dev/v1/bin.mjs', 179, 'javascript').
project_file('generated/validator/resolve/taskand.dev/v1/registry-client.mjs', 24, 'javascript').
project_file('generated/web/serve/taskand.dev/v1/bin.mjs', 38, 'javascript').
project_file('project.sh', 59, 'shell').
project_file('tests/conformance.mjs', 27, 'javascript').
project_file('tests/contract_tests.mjs', 20, 'javascript').
project_file('tests/integration_test.mjs', 151, 'javascript').
project_file('tests/negative_tests.mjs', 129, 'javascript').

% ── Python Functions ─────────────────────────────────────
python_function('gateway/__init__.py', 'main', 0, 3, 7).
python_function('gateway/auth.py', 'bind_address', 0, 1, 1).
python_function('gateway/auth.py', 'is_loopback_bind', 0, 1, 1).
python_function('gateway/auth.py', '_parse_simple_yaml', 1, 14, 6).
python_function('gateway/auth.py', 'load_grants', 0, 7, 9).
python_function('gateway/auth.py', 'check_auth', 1, 9, 8).
python_function('gateway/auth.py', 'check_grant', 3, 7, 2).
python_function('gateway/auth.py', 'require_grant', 3, 3, 4).
python_function('gateway/handlers/chat.py', 'handle_chat', 2, 4, 9).
python_function('gateway/handlers/doctor.py', 'handle_doctor', 2, 3, 5).
python_function('gateway/handlers/federation.py', 'handle_well_known_catalog', 2, 1, 3).
python_function('gateway/handlers/federation.py', 'handle_federation', 2, 2, 4).
python_function('gateway/handlers/federation.py', 'handle_registry', 2, 6, 7).
python_function('gateway/handlers/health.py', 'handle_healthz', 2, 2, 4).
python_function('gateway/handlers/orchestrator.py', 'handle_orchestrator', 2, 3, 6).
python_function('gateway/handlers/planner.py', 'handle_planner', 2, 3, 5).
python_function('gateway/handlers/proc.py', 'handle_proc_call', 2, 3, 7).
python_function('gateway/middleware/cors.py', 'add_cors_headers', 1, 1, 1).
python_function('gateway/middleware/logging.py', 'log_event', 2, 2, 7).
python_function('gateway/router.py', 'dispatch', 4, 3, 4).
python_function('gateway/utils.py', 'registry', 3, 3, 5).
python_function('gateway/utils.py', 'call_process', 3, 1, 1).
python_function('gateway/utils.py', 'status_for', 1, 1, 1).

% ── Python Classes ───────────────────────────────────────
python_class('gateway/__init__.py', 'GatewayHTTPHandler').
python_method('GatewayHTTPHandler', '_send', 2, 1, 9).
python_method('GatewayHTTPHandler', 'do_OPTIONS', 0, 1, 3).
python_method('GatewayHTTPHandler', 'do_GET', 0, 1, 1).
python_method('GatewayHTTPHandler', 'do_POST', 0, 4, 6).
python_method('GatewayHTTPHandler', 'log_message', 1, 2, 3).

% ── Dependencies ─────────────────────────────────────────

% ── Makefile Targets ─────────────────────────────────────
makefile_target('SHELL', '').
makefile_target('all', '').
makefile_target('up', '').
makefile_target('down', '').
makefile_target('status', '').
makefile_target('test', '').
makefile_target('conformance', '').
makefile_target('test-contracts', '').
makefile_target('test-negative', '').
makefile_target('integration', '').
makefile_target('catalog', 'Po ręcznej zmianie pakietu wbudowanego (origin: builtin) — przelicza bindingHash w rejestrach organizmów').
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
sumd_declared_file('app.doql.less', 'doql').
sumd_declared_file('testql-scenarios/generated-api-smoke.testql.toon.yaml', 'testql').
sumd_declared_file('project/map.toon.yaml', 'analysis').
sumd_declared_file('project/logic.pl', 'analysis').
sumd_declared_file('project/calls.toon.yaml', 'analysis').
sumd_interface('web', '').
sumd_workflow('up', 'manual').
sumd_workflow_step('up', 1, 'docker compose up -d').
sumd_workflow('down', 'manual').
sumd_workflow_step('down', 1, 'docker compose down').
sumd_workflow('status', 'manual').
sumd_workflow_step('status', 1, 'docker compose ps').
sumd_workflow_step('status', 2, './bin/taskand status').
sumd_workflow('test', 'manual').
sumd_workflow('conformance', 'manual').
sumd_workflow_step('conformance', 1, 'node tests/conformance.mjs').
sumd_workflow('test-contracts', 'manual').
sumd_workflow_step('test-contracts', 1, 'node tests/contract_tests.mjs').
sumd_workflow('test-negative', 'manual').
sumd_workflow_step('test-negative', 1, 'node tests/negative_tests.mjs').
sumd_workflow('integration', 'manual').
sumd_workflow_step('integration', 1, 'node tests/integration_test.mjs').
sumd_workflow('catalog', 'manual').
sumd_workflow('bootstrap', 'manual').
sumd_workflow_step('bootstrap', 1, 'docker compose run --rm bootstrap').
sumd_workflow('gateway', 'manual').
sumd_workflow_step('gateway', 1, 'python3 gateway.py').
sumd_workflow('clean', 'manual').
sumd_workflow_step('clean', 1, 'rm -rf log/events.jsonl').
```

## Call Graph

*260 nodes · 242 edges · 53 modules · CC̄=3.3*

### Hubs (by degree)

| Function | CC | in | out | total |
|----------|----|----|-----|-------|
| `scan` *(in generated.admin.network-device-discovery.taskand.dev.v4.bin)* | 30 ⚠ | 1 | 20 | **21** |
| `_parse_simple_yaml` *(in gateway.auth)* | 14 ⚠ | 1 | 19 | **20** |
| `probeMdns` *(in generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns)* | 7 | 0 | 19 | **19** |
| `sleep` *(in generated.registry.core.taskand.dev.v1.store)* | 7 | 3 | 16 | **19** |
| `probeMdns` *(in generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns)* | 8 | 0 | 19 | **19** |
| `call` *(in generated.registry.core.taskand.dev.v1.exec)* | 7 | 0 | 18 | **18** |
| `handle_chat` *(in gateway.handlers.chat)* | 4 | 0 | 18 | **18** |
| `mdnsProbe` *(in generated.admin.network-device-discovery.taskand.dev.v1.bin)* | 15 ⚠ | 0 | 18 | **18** |

```toon markpact:analysis path=project/calls.toon.yaml
# code2llm call graph | /home/tom/github/semcod/taskand/glm53
# generated in 0.19s
# nodes: 260 | edges: 242 | modules: 53
# CC̄=3.3

HUBS[20]:
  generated.admin.network-device-discovery.taskand.dev.v4.bin.scan
    CC=30  in:1  out:20  total:21
  gateway.auth._parse_simple_yaml
    CC=14  in:1  out:19  total:20
  generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.probeMdns
    CC=7  in:0  out:19  total:19
  generated.registry.core.taskand.dev.v1.store.sleep
    CC=7  in:3  out:16  total:19
  generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.probeMdns
    CC=8  in:0  out:19  total:19
  generated.registry.core.taskand.dev.v1.exec.call
    CC=7  in:0  out:18  total:18
  gateway.handlers.chat.handle_chat
    CC=4  in:0  out:18  total:18
  generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe
    CC=15  in:0  out:18  total:18
  generated.registry.core.taskand.dev.v1.store.updateRegistry
    CC=7  in:0  out:17  total:17
  gateway.auth.check_auth
    CC=9  in:1  out:16  total:17
  generated.registry.core.taskand.dev.v1.lifecycle.register
    CC=16  in:3  out:14  total:17
  generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.probeSsdp
    CC=8  in:0  out:15  total:15
  generated.admin.network-device-discovery.taskand.dev.v4.inventory.jsonIP
    CC=7  in:2  out:13  total:15
  generated.registry.core.taskand.dev.v1.package.unquote
    CC=13  in:1  out:14  total:15
  generated.registry.core.taskand.dev.v1.package.checkPackage
    CC=13  in:0  out:14  total:14
  generated.admin.network-device-discovery.taskand.dev.v4.inventory.inventory
    CC=7  in:0  out:14  total:14
  generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.probeSsdp
    CC=6  in:0  out:14  total:14
  generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.SSDP_PORT
    CC=6  in:0  out:14  total:14
  generated.registry.core.taskand.dev.v1.package.readManifest
    CC=4  in:2  out:11  total:13
  generated.registry.core.taskand.dev.v1.store.audit
    CC=2  in:4  out:9  total:13

MODULES:
  gateway  [5 funcs]
    _send  CC=1  out:10
    do_GET  CC=1  out:1
    do_OPTIONS  CC=1  out:3
    do_POST  CC=4  out:6
    main  CC=3  out:9
  gateway.auth  [7 funcs]
    _parse_simple_yaml  CC=14  out:19
    bind_address  CC=1  out:1
    check_auth  CC=9  out:16
    check_grant  CC=7  out:3
    is_loopback_bind  CC=1  out:1
    load_grants  CC=7  out:10
    require_grant  CC=3  out:6
  gateway.handlers.chat  [1 funcs]
    handle_chat  CC=4  out:18
  gateway.handlers.doctor  [1 funcs]
    handle_doctor  CC=3  out:5
  gateway.handlers.federation  [3 funcs]
    handle_federation  CC=2  out:5
    handle_registry  CC=6  out:11
    handle_well_known_catalog  CC=1  out:3
  gateway.handlers.health  [1 funcs]
    handle_healthz  CC=2  out:5
  gateway.handlers.orchestrator  [1 funcs]
    handle_orchestrator  CC=3  out:7
  gateway.handlers.planner  [1 funcs]
    handle_planner  CC=3  out:5
  gateway.handlers.proc  [1 funcs]
    handle_proc_call  CC=3  out:12
  gateway.middleware.cors  [1 funcs]
    add_cors_headers  CC=1  out:3
  gateway.middleware.logging  [1 funcs]
    log_event  CC=2  out:8
  gateway.router  [1 funcs]
    dispatch  CC=3  out:4
  gateway.utils  [3 funcs]
    call_process  CC=1  out:1
    registry  CC=3  out:5
    status_for  CC=1  out:2
  generated.admin.network-device-discovery.taskand.dev.v1.bin  [19 funcs]
    an  CC=5  out:2
    errOut  CC=1  out:1
    fin  CC=2  out:2
    hostname  CC=11  out:6
    loadOui  CC=11  out:10
    mdnsProbe  CC=15  out:18
    off  CC=5  out:4
    out  CC=1  out:3
    probeBudget  CC=3  out:8
    qd  CC=2  out:1
  generated.admin.network-device-discovery.taskand.dev.v2.merge  [4 funcs]
    addSource  CC=2  out:2
    get  CC=2  out:2
    map  CC=2  out:3
    mergeDevices  CC=13  out:9
  generated.admin.network-device-discovery.taskand.dev.v2.networks  [5 funcs]
    cidrFromAddrMask  CC=10  out:7
    execFileP  CC=1  out:1
    ifaces  CC=9  out:4
    isDockerIface  CC=1  out:1
    listLocalNetworks  CC=15  out:9
  generated.admin.network-device-discovery.taskand.dev.v2.probe-arp  [3 funcs]
    execFileP  CC=6  out:10
    readArpTable  CC=6  out:10
    refreshArpWithIpNeigh  CC=2  out:2
  generated.admin.network-device-discovery.taskand.dev.v2.probe-dns  [2 funcs]
    map  CC=3  out:3
    reverseDns  CC=3  out:5
  generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns  [6 funcs]
    extractNames  CC=6  out:4
    finish  CC=2  out:2
    ip  CC=4  out:5
    len  CC=2  out:0
    probeMdns  CC=8  out:19
    timer  CC=1  out:3
  generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp  [4 funcs]
    SSDP_PORT  CC=6  out:14
    finish  CC=2  out:2
    probeSsdp  CC=6  out:14
    timer  CC=1  out:3
  generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp  [4 funcs]
    CONNECT_TIMEOUT  CC=3  out:8
    finish  CC=3  out:2
    probePort  CC=3  out:8
    probeTcp  CC=5  out:5
  generated.admin.network-device-discovery.taskand.dev.v3.network  [2 funcs]
    cidrToIps  CC=10  out:6
    numToIp  CC=1  out:1
  generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns  [3 funcs]
    done  CC=2  out:2
    probeMdns  CC=7  out:19
    timer  CC=1  out:3
  generated.admin.network-device-discovery.taskand.dev.v3.probe-ping  [2 funcs]
    fin  CC=2  out:2
    ips  CC=5  out:10
  generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp  [3 funcs]
    done  CC=2  out:2
    probeSsdp  CC=8  out:15
    timer  CC=1  out:3
  generated.admin.network-device-discovery.taskand.dev.v4.address  [8 funcs]
    contains  CC=3  out:2
    family  CC=1  out:2
    first  CC=1  out:2
    formatIP  CC=2  out:6
    ipNumber  CC=8  out:8
    reserve  CC=1  out:2
    size  CC=1  out:2
    subnet  CC=8  out:7
  generated.admin.network-device-discovery.taskand.dev.v4.bin  [6 funcs]
    add  CC=4  out:3
    count  CC=3  out:6
    ip  CC=3  out:3
    params  CC=2  out:2
    scan  CC=30  out:20
    xml  CC=3  out:6
  generated.admin.network-device-discovery.taskand.dev.v4.inventory  [3 funcs]
    interfaces  CC=4  out:6
    inventory  CC=7  out:14
    jsonIP  CC=7  out:13
  generated.alert.telegram.taskand.dev.v1.bin  [5 funcs]
    body  CC=2  out:1
    chatId  CC=3  out:1
    emit  CC=1  out:5
    threshold  CC=2  out:1
    token  CC=3  out:1
  generated.browser.session.taskand.dev.v1.bin  [5 funcs]
    cdp  CC=3  out:5
    tab  CC=1  out:2
    tabs  CC=1  out:3
    text  CC=2  out:1
    v  CC=1  out:1
  generated.cluster.monitor.taskand.dev.v1.bin  [4 funcs]
    base  CC=2  out:2
    cat  CC=1  out:1
    checkPeer  CC=10  out:8
    fetchJson  CC=2  out:4
  generated.cluster.monitor.taskand.dev.v1.registry-client  [2 funcs]
    call  CC=1  out:1
    registry  CC=6  out:5
  generated.dev.act.taskand.dev.v1.bin  [8 funcs]
    capabilityContext  CC=3  out:8
    decide  CC=5  out:3
    decision  CC=1  out:1
    evolve  CC=6  out:3
    format  CC=7  out:1
    r  CC=4  out:3
    result  CC=2  out:1
    run  CC=2  out:2
  generated.dev.chat.taskand.dev.v1.dispatch  [11 funcs]
    P  CC=1  out:0
    d  CC=1  out:2
    diagnose  CC=3  out:4
    fileList  CC=4  out:6
    organismChat  CC=2  out:3
    path  CC=1  out:2
    prescribe  CC=3  out:4
    r  CC=1  out:2
    replyOf  CC=4  out:1
    telemetry  CC=8  out:7
  generated.dev.chat.taskand.dev.v1.intent  [7 funcs]
    DEVELOPER  CC=5  out:3
    hasAny  CC=5  out:2
    low  CC=3  out:1
    match  CC=2  out:0
    matches  CC=5  out:3
    org  CC=4  out:4
    parseIntent  CC=8  out:4
  generated.dev.composite.taskand.dev.v1.bin  [5 funcs]
    done  CC=1  out:4
    evolveStep  CC=4  out:6
    say  CC=1  out:4
    val  CC=3  out:2
    validate  CC=4  out:3
  generated.dev.evolve.taskand.dev.v1.bin  [10 funcs]
    GEN  CC=4  out:2
    MAX_ATTEMPTS  CC=4  out:2
    capability  CC=4  out:1
    done  CC=1  out:3
    entries  CC=2  out:1
    name  CC=4  out:2
    organism  CC=4  out:2
    previous  CC=4  out:2
    slug  CC=4  out:2
    writeAndTest  CC=3  out:5
  generated.dev.evolve.taskand.dev.v1.gate  [9 funcs]
    CRASH  CC=10  out:6
    clip  CC=10  out:5
    compare  CC=12  out:10
    compareCounts  CC=5  out:6
    digest  CC=10  out:6
    fmt  CC=1  out:2
    judge  CC=1  out:4
    keys  CC=2  out:1
    visit  CC=10  out:5
  generated.dev.file-router.taskand.dev.v1.bin  [4 funcs]
    emit  CC=1  out:3
    kind  CC=1  out:1
    path  CC=2  out:2
    st  CC=1  out:1
  generated.dev.llm.taskand.dev.v1.bin  [5 funcs]
    choice  CC=6  out:3
    content  CC=6  out:3
    data  CC=6  out:3
    emit  CC=1  out:3
    json  CC=2  out:1
  generated.dev.spawn.taskand.dev.v1.bin  [2 funcs]
    done  CC=1  out:3
    organism  CC=2  out:2
  generated.doctor.diagnose.taskand.dev.v1.bin  [10 funcs]
    checkDependencies  CC=4  out:3
    checkPeers  CC=6  out:3
    checkRegistry  CC=8  out:7
    checkServices  CC=6  out:3
    entry  CC=1  out:1
    find  CC=1  out:1
    lastError  CC=1  out:1
    probe  CC=2  out:2
    recent  CC=1  out:1
    v  CC=2  out:2
  generated.doctor.heal.taskand.dev.v1.bin  [4 funcs]
    forHumans  CC=6  out:3
    forOrganisms  CC=6  out:3
    heal  CC=5  out:4
    recentlyHealed  CC=4  out:7
  generated.doctor.heal.taskand.dev.v1.registry-client  [2 funcs]
    call  CC=1  out:1
    registry  CC=6  out:5
  generated.doctor.prescribe.taskand.dev.v1.bin  [4 funcs]
    human  CC=1  out:0
    parseUri  CC=2  out:0
    prescriptions  CC=3  out:2
    reEvolve  CC=2  out:1
  generated.hw.monitor.taskand.dev.v1.bin  [2 funcs]
    cpuTimes  CC=1  out:2
    cpuUsagePct  CC=2  out:4
  generated.registry.core.taskand.dev.v1.exec  [13 funcs]
    actual  CC=2  out:1
    call  CC=7  out:18
    credentialEnv  CC=11  out:7
    entry  CC=2  out:1
    errorType  CC=3  out:3
    fail  CC=1  out:0
    matches  CC=11  out:6
    outcome  CC=13  out:4
    parseJson  CC=5  out:4
    parsed  CC=6  out:3
  generated.registry.core.taskand.dev.v1.federation  [6 funcs]
    fetchJson  CC=2  out:4
    install  CC=9  out:11
    pkg  CC=2  out:3
    pull  CC=6  out:8
    pullOne  CC=10  out:7
    remote  CC=1  out:2
  generated.registry.core.taskand.dev.v1.lifecycle  [9 funcs]
    approve  CC=1  out:1
    deprecate  CC=1  out:1
    initialStatus  CC=5  out:2
    register  CC=16  out:14
    results  CC=2  out:2
    scan  CC=3  out:11
    setStatus  CC=6  out:10
    src  CC=8  out:5
    unregistered  CC=2  out:2
  generated.registry.core.taskand.dev.v1.package  [6 funcs]
    checkPackage  CC=13  out:14
    h  CC=2  out:4
    packageFiles  CC=1  out:6
    packageHash  CC=2  out:6
    readManifest  CC=4  out:11
    unquote  CC=13  out:14
  generated.registry.core.taskand.dev.v1.store  [21 funcs]
    addPeer  CC=5  out:8
    adoptOwnership  CC=4  out:7
    allEntries  CC=1  out:4
    audit  CC=2  out:9
    clean  CC=1  out:1
    deadline  CC=7  out:6
    findEntry  CC=2  out:2
    lock  CC=7  out:6
    organisms  CC=2  out:6
    parseUri  CC=3  out:3
  generated.validator.resolve.taskand.dev.v1.bin  [3 funcs]
    currentStep  CC=7  out:3
    dfs  CC=7  out:3
    hasCycle  CC=7  out:4
  generated.validator.resolve.taskand.dev.v1.registry-client  [2 funcs]
    call  CC=1  out:1
    registry  CC=6  out:5

EDGES:
  generated.validator.resolve.taskand.dev.v1.registry-client.call → generated.validator.resolve.taskand.dev.v1.registry-client.registry
  generated.validator.resolve.taskand.dev.v1.bin.hasCycle → generated.validator.resolve.taskand.dev.v1.bin.dfs
  generated.validator.resolve.taskand.dev.v1.bin.currentStep → generated.validator.resolve.taskand.dev.v1.bin.dfs
  generated.admin.network-device-discovery.taskand.dev.v2.probe-arp.refreshArpWithIpNeigh → generated.admin.network-device-discovery.taskand.dev.v2.probe-arp.execFileP
  generated.admin.network-device-discovery.taskand.dev.v2.probe-arp.refreshArpWithIpNeigh → generated.admin.network-device-discovery.taskand.dev.v2.probe-arp.readArpTable
  generated.admin.network-device-discovery.taskand.dev.v2.probe-dns.reverseDns → generated.admin.network-device-discovery.taskand.dev.v2.probe-dns.map
  generated.admin.network-device-discovery.taskand.dev.v2.networks.listLocalNetworks → generated.admin.network-device-discovery.taskand.dev.v2.networks.isDockerIface
  generated.admin.network-device-discovery.taskand.dev.v2.networks.listLocalNetworks → generated.admin.network-device-discovery.taskand.dev.v2.networks.cidrFromAddrMask
  generated.admin.network-device-discovery.taskand.dev.v2.networks.listLocalNetworks → generated.admin.network-device-discovery.taskand.dev.v2.networks.execFileP
  generated.admin.network-device-discovery.taskand.dev.v2.networks.ifaces → generated.admin.network-device-discovery.taskand.dev.v2.networks.isDockerIface
  generated.admin.network-device-discovery.taskand.dev.v2.networks.ifaces → generated.admin.network-device-discovery.taskand.dev.v2.networks.cidrFromAddrMask
  generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.SSDP_PORT → generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.probeSsdp → generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.timer → generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.probeMdns → generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.timer → generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.ip → generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.extractNames
  generated.admin.network-device-discovery.taskand.dev.v2.merge.mergeDevices → generated.admin.network-device-discovery.taskand.dev.v2.merge.get
  generated.admin.network-device-discovery.taskand.dev.v2.merge.mergeDevices → generated.admin.network-device-discovery.taskand.dev.v2.merge.addSource
  generated.admin.network-device-discovery.taskand.dev.v2.merge.map → generated.admin.network-device-discovery.taskand.dev.v2.merge.get
  generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp.CONNECT_TIMEOUT → generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp.probePort → generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp.finish
  generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp.probeTcp → generated.admin.network-device-discovery.taskand.dev.v2.probe-tcp.probePort
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
  generated.registry.core.taskand.dev.v1.package.packageHash → generated.registry.core.taskand.dev.v1.package.packageFiles
  generated.registry.core.taskand.dev.v1.package.h → generated.registry.core.taskand.dev.v1.package.packageFiles
  generated.registry.core.taskand.dev.v1.package.readManifest → generated.registry.core.taskand.dev.v1.package.unquote
  generated.registry.core.taskand.dev.v1.package.unquote → generated.registry.core.taskand.dev.v1.package.readManifest
  generated.registry.core.taskand.dev.v1.package.unquote → generated.registry.core.taskand.dev.v1.package.packageFiles
  generated.registry.core.taskand.dev.v1.package.checkPackage → generated.registry.core.taskand.dev.v1.package.readManifest
  generated.registry.core.taskand.dev.v1.package.checkPackage → generated.registry.core.taskand.dev.v1.package.packageFiles
  generated.registry.core.taskand.dev.v1.federation.pull → generated.registry.core.taskand.dev.v1.federation.fetchJson
  generated.registry.core.taskand.dev.v1.federation.pull → generated.registry.core.taskand.dev.v1.federation.pullOne
  generated.registry.core.taskand.dev.v1.federation.remote → generated.registry.core.taskand.dev.v1.federation.fetchJson
  generated.registry.core.taskand.dev.v1.federation.pullOne → generated.registry.core.taskand.dev.v1.federation.fetchJson
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
