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

## Workflows

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

## Refactoring Analysis

*Pre-refactoring snapshot — use this section to identify targets. Generated from `project/` toon files.*

### Call Graph & Complexity (`project/calls.toon.yaml`)

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

### Code Analysis (`project/analysis.toon.yaml`)

```toon markpact:analysis path=project/analysis.toon.yaml
# code2llm | 134f 6313L | javascript:66,yaml:36,json:15,python:13,shell:1 | 2026-09-13
# generated in 0.05s
# CC̅=3.3 | critical:9/733 | dups:0 | cycles:0

HEALTH[9]:
  🟡 CC    listLocalNetworks CC=15 (limit:15)
  🟡 CC    readArp CC=20 (limit:15)
  🟡 CC    mdnsProbe CC=15 (limit:15)
  🟡 CC    guard CC=16 (limit:15)
  🟡 CC    scan CC=30 (limit:15)
  🟡 CC    mergeDevices CC=25 (limit:15)
  🟡 CC    list CC=16 (limit:15)
  🟡 CC    byKey CC=16 (limit:15)
  🟡 CC    register CC=16 (limit:15)

REFACTOR[1]:
  1. split 9 high-CC methods  (CC>15)

PIPELINES[518]:
  [1] Src [REGISTRY]: REGISTRY
      PURITY: 100% pure
  [2] Src [r]: r
      PURITY: 100% pure
  [3] Src [call]: call → registry
      PURITY: 100% pure
  [4] Src [blueprint]: blueprint
      PURITY: 100% pure
  [5] Src [steps]: steps
      PURITY: 100% pure
  [6] Src [ids]: ids
      PURITY: 100% pure
  [7] Src [names]: names
      PURITY: 100% pure
  [8] Src [color]: color
      PURITY: 100% pure
  [9] Src [stepMap]: stepMap
      PURITY: 100% pure
  [10] Src [hasCycle]: hasCycle → dfs
      PURITY: 100% pure
  [11] Src [currentStep]: currentStep → dfs
      PURITY: 100% pure
  [12] Src [val]: val
      PURITY: 100% pure
  [13] Src [res]: res
      PURITY: 100% pure
  [14] Src [visited]: visited
      PURITY: 100% pure
  [15] Src [visit]: visit
      PURITY: 100% pure
  [16] Src [stepObj]: stepObj
      PURITY: 100% pure
  [17] Src [isValid]: isValid
      PURITY: 100% pure
  [18] Src [task]: task
      PURITY: 100% pure
  [19] Src [catalogProcs]: catalogProcs
      PURITY: 100% pure
  [20] Src [capabilityLines]: capabilityLines
      PURITY: 100% pure
  [21] Src [plan]: plan
      PURITY: 100% pure
  [22] Src [llm]: llm
      PURITY: 100% pure
  [23] Src [kLower]: kLower
      PURITY: 100% pure
  [24] Src [val]: val
      PURITY: 100% pure
  [25] Src [t]: t
      PURITY: 100% pure
  [26] Src [raw]: raw
      PURITY: 100% pure
  [27] Src [started]: started
      PURITY: 100% pure
  [28] Src [status]: status
      PURITY: 100% pure
  [29] Src [error]: error
      PURITY: 100% pure
  [30] Src [up]: up
      PURITY: 100% pure
  [31] Src [data]: data
      PURITY: 100% pure
  [32] Src [parts]: parts
      PURITY: 100% pure
  [33] Src [refreshArpWithIpNeigh]: refreshArpWithIpNeigh → execFileP
      PURITY: 100% pure
  [34] Src [reverseDns]: reverseDns → map
      PURITY: 100% pure
  [35] Src [ipParts]: ipParts
      PURITY: 100% pure
  [36] Src [maskParts]: maskParts
      PURITY: 100% pure
  [37] Src [maskBits]: maskBits
      PURITY: 100% pure
  [38] Src [m]: m
      PURITY: 100% pure
  [39] Src [bits]: bits
      PURITY: 100% pure
  [40] Src [listLocalNetworks]: listLocalNetworks → isDockerIface
      PURITY: 100% pure
  [41] Src [ifaces]: ifaces → isDockerIface
      PURITY: 100% pure
  [42] Src [cidr]: cidr
      PURITY: 100% pure
  [43] Src [ipInNetworks]: ipInNetworks
      PURITY: 100% pure
  [44] Src [a]: a
      PURITY: 100% pure
  [45] Src [b]: b
      PURITY: 100% pure
  [46] Src [mask]: mask
      PURITY: 100% pure
  [47] Src [SSDP_PORT]: SSDP_PORT → finish
      PURITY: 100% pure
  [48] Src [probeSsdp]: probeSsdp → finish
      PURITY: 100% pure
  [49] Src [socket]: socket
      PURITY: 100% pure
  [50] Src [timer]: timer → finish
      PURITY: 100% pure

LAYERS:
  generated/                      CC̄=3.3    ←in:0  →out:0
  │ !! bin.mjs                    292L  0C   61m  CC=20     ←0
  │ bin.mjs                    178L  0C   17m  CC=7      ←0
  │ bin.mjs                    168L  0C   17m  CC=7      ←0
  │ store.mjs                  166L  0C   39m  CC=7      ←0
  │ registry.json              163L  0C    0m  CC=0.0    ←0
  │ bin.mjs                    148L  0C    9m  CC=8      ←0
  │ bin.mjs                    126L  0C   24m  CC=13     ←0
  │ !! lifecycle.mjs              121L  0C   25m  CC=16     ←0
  │ bin.mjs                    112L  0C   24m  CC=4      ←0
  │ bin.mjs                    101L  0C   17m  CC=10     ←0
  │ bin.mjs                    101L  0C   20m  CC=11     ←0
  │ registry.json              101L  0C    0m  CC=0.0    ←0
  │ exec.mjs                    94L  0C   22m  CC=13     ←0
  │ bin.mjs                     94L  0C   21m  CC=6      ←0
  │ bin.mjs                     91L  0C   19m  CC=7      ←0
  │ !! contract.mjs                89L  0C    8m  CC=16     ←0
  │ bin.mjs                     75L  0C    8m  CC=3      ←0
  │ !! networks.mjs                74L  0C   18m  CC=15     ←0
  │ federation.mjs              74L  0C   21m  CC=10     ←0
  │ bin.mjs                     72L  0C   11m  CC=10     ←0
  │ bin.mjs                     71L  0C   16m  CC=6      ←0
  │ dispatch.mjs                71L  0C   15m  CC=8      ←0
  │ gate.mjs                    70L  0C   18m  CC=12     ←0
  │ bin.mjs                     66L  0C    8m  CC=7      ←0
  │ registry.json               66L  0C    0m  CC=0.0    ←0
  │ oui.mjs                     64L  0C    3m  CC=4      ←0
  │ probe-mdns.mjs              61L  0C   10m  CC=8      ←2
  │ package.mjs                 61L  0C   12m  CC=13     ←0
  │ bin.mjs                     60L  0C   11m  CC=3      ←0
  │ bin.mjs                     58L  0C   12m  CC=4      ←0
  │ vendor.mjs                  57L  0C    3m  CC=5      ←0
  │ bin.mjs                     55L  0C    2m  CC=3      ←0
  │ intent.mjs                  53L  0C    9m  CC=8      ←0
  │ bin.mjs                     50L  0C   10m  CC=3      ←0
  │ bin.mjs                     50L  0C   11m  CC=11     ←0
  │ !! bin.mjs                     50L  0C   11m  CC=30     ←0
  │ bin.mjs                     47L  0C   12m  CC=4      ←0
  │ probe-ssdp.mjs              47L  0C    8m  CC=8      ←0
  │ network.mjs                 45L  0C   15m  CC=10     ←0
  │ probe-mdns.mjs              43L  0C    7m  CC=7      ←0
  │ merge.mjs                   41L  0C    5m  CC=13     ←0
  │ probe-tcp.mjs               40L  0C    7m  CC=5      ←0
  │ bin.mjs                     40L  0C    8m  CC=2      ←0
  │ bin.mjs                     37L  0C    7m  CC=4      ←0
  │ probe-ssdp.mjs              37L  0C    6m  CC=6      ←0
  │ bin.mjs                     37L  0C    4m  CC=4      ←0
  │ probe-ping.mjs              37L  0C    4m  CC=6      ←0
  │ probe-arp.mjs               33L  0C    5m  CC=6      ←0
  │ probe-arp.mjs               32L  0C    7m  CC=11     ←0
  │ address.mjs                 32L  0C   12m  CC=8      ←0
  │ !! merge.mjs                   32L  0C    8m  CC=25     ←0
  │ registry.json               32L  0C    0m  CC=0.0    ←0
  │ stdin.mjs                   28L  0C    2m  CC=4      ←0
  │ inventory.mjs               28L  0C    7m  CC=7      ←0
  │ registry.json               28L  0C    0m  CC=0.0    ←0
  │ registry.json               27L  0C    0m  CC=0.0    ←0
  │ bin.mjs                     26L  0C    5m  CC=2      ←0
  │ exec.mjs                    26L  0C    3m  CC=8      ←0
  │ registry.json               26L  0C    0m  CC=0.0    ←0
  │ registry.json               26L  0C    0m  CC=0.0    ←0
  │ registry.json               26L  0C    0m  CC=0.0    ←0
  │ vault.mjs                   25L  0C    4m  CC=6      ←0
  │ registry.json               25L  0C    0m  CC=0.0    ←0
  │ registry.json               25L  0C    0m  CC=0.0    ←0
  │ registry.json               24L  0C    0m  CC=0.0    ←0
  │ registry.json               24L  0C    0m  CC=0.0    ←0
  │ registry.json               24L  0C    0m  CC=0.0    ←0
  │ registry.json               24L  0C    0m  CC=0.0    ←0
  │ registry-client.mjs         23L  0C    4m  CC=6      ←2
  │ bin.mjs                     23L  0C    2m  CC=2      ←0
  │ stdin.mjs                   23L  0C    4m  CC=8      ←0
  │ registry-client.mjs         23L  0C    4m  CC=6      ←0
  │ registry-client.mjs         23L  0C    4m  CC=6      ←0
  │ bin.mjs                     22L  0C    2m  CC=2      ←0
  │ bin.mjs                     18L  0C    3m  CC=2      ←0
  │ select.mjs                  16L  0C    3m  CC=7      ←0
  │ probe-dns.mjs               14L  0C    3m  CC=3      ←0
  │ probe-dns.mjs               14L  0C    2m  CC=3      ←0
  │ capsule.yaml                 9L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    7L  0C    0m  CC=0.0    ←0
  │ test.mjs                     6L  0C    2m  CC=1      ←0
  │ test.mjs                     6L  0C    2m  CC=1      ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    6L  0C    0m  CC=0.0    ←0
  │ test.mjs                     5L  0C    2m  CC=1      ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │ proc.yaml                    5L  0C    0m  CC=0.0    ←0
  │
  gateway/                        CC̄=3.3    ←in:18  →out:3
  │ auth                       142L  0C    7m  CC=14     ←7
  │ __init__                    51L  1C    6m  CC=4      ←0
  │ utils                       47L  0C    3m  CC=3      ←6
  │ federation                  36L  0C    3m  CC=6      ←0
  │ router                      29L  0C    1m  CC=3      ←1
  │ logging                     28L  0C    1m  CC=2      ←3
  │ chat                        25L  0C    1m  CC=4      ←0
  │ health                      18L  0C    1m  CC=2      ←0
  │ proc                        16L  0C    1m  CC=3      ←0
  │ orchestrator                14L  0C    1m  CC=3      ←0
  │ doctor                      11L  0C    1m  CC=3      ←0
  │ planner                     11L  0C    1m  CC=3      ←0
  │ cors                         4L  0C    1m  CC=1      ←1
  │
  ./                              CC̄=0.0    ←in:0  →out:0
  │ !! planfile.yaml              591L  0C    0m  CC=0.0    ←0
  │ prefact.yaml                94L  0C    0m  CC=0.0    ←0
  │ genome.yaml                 86L  0C    0m  CC=0.0    ←0
  │ Dockerfile                  68L  0C    0m  CC=0.0    ←0
  │ docker-compose.yaml         63L  0C    0m  CC=0.0    ←0
  │ project.sh                  59L  0C    0m  CC=0.0    ←0
  │ Makefile                    42L  0C    0m  CC=0.0    ←0
  │ grants.yaml                 31L  0C    0m  CC=0.0    ←0
  │
  tasks/                          CC̄=0.0    ←in:0  →out:0
  │ inbox.yaml                   0L  0C    0m  CC=0.0    ←0
  │
  vms/                            CC̄=0.0    ←in:0  →out:0
  │ Dockerfile                   9L  0C    0m  CC=0.0    ←0
  │
  testql-scenarios/               CC̄=0.0    ←in:0  →out:0
  │ generated-api-smoke.testql.toon.yaml    39L  0C    0m  CC=0.0    ←0
  │
  ── zero ──
     tasks/inbox.yaml                          0L

COUPLING:
                          gateway.handlers              gateway   gateway.middleware  generated.validator      generated.admin
     gateway.handlers                   ──                   18                    3                    4                    1  !! fan-out
              gateway                  ←18                   ──                    2                                         1  hub
   gateway.middleware                   ←3                   ←2                   ──                                            hub
  generated.validator                   ←4                                                             ──                     
      generated.admin                   ←1                   ←1                                                             ──
  CYCLES: none
  HUB: gateway.middleware/ (fan-in=5)
  HUB: gateway/ (fan-in=18)
  SMELL: gateway.handlers/ fan-out=26 → split needed

EXTERNAL:
  validation: run `vallm batch .` → validation.toon
  duplication: run `redup scan .` → duplication.toon
```

### Duplication (`project/duplication.toon.yaml`)

```toon markpact:analysis path=project/duplication.toon.yaml
# redup/duplication | 5 groups | 96f 5598L | 2026-09-13

SUMMARY:
  files_scanned: 96
  total_lines:   5598
  dup_groups:    5
  actionable:    5
  review:        0
  generated:     0
  actionable_L:  206
  review_L:      0
  generated_L:   0
  dup_fragments: 24
  saved_lines:   206
  scan_ms:       787

HOTSPOTS[7] (files with most duplication):
  generated/admin/chat/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)
  generated/cluster/monitor/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)
  generated/dev/act/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)
  generated/dev/chat/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)
  generated/dev/codegen/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)
  generated/dev/composite/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)
  generated/dev/evolve/taskand.dev/v1/registry-client.mjs  dup=14L  groups=1  frags=1  (0.3%)

DUPLICATES[5] (ranked by impact):
  [0e718323cab5c7af] !! EXAC  registry  L=14 N=14 saved=182 sim=1.00
      generated/admin/chat/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/cluster/monitor/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/dev/act/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/dev/chat/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/dev/codegen/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/dev/composite/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/dev/evolve/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/dev/spawn/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/doctor/diagnose/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/doctor/heal/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/doctor/prescribe/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/orchestrator/execute/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/planner/plan/taskand.dev/v1/registry-client.mjs:8-21  (registry)
      generated/validator/resolve/taskand.dev/v1/registry-client.mjs:8-21  (registry)
  [cfe7db247084402d]   EXAC  arrow_function  L=4 N=4 saved=12 sim=1.00
      generated/dev/act/taskand.dev/v1/bin.mjs:19-22  (arrow_function)
      generated/dev/codegen/taskand.dev/v1/bin.mjs:16-19  (arrow_function)
      generated/dev/evolve/taskand.dev/v1/bin.mjs:22-25  (arrow_function)
      generated/dev/spawn/taskand.dev/v1/bin.mjs:18-21  (arrow_function)
  [7f7e2d64ce928e6c]   EXAC  arrow_function  L=4 N=2 saved=4 sim=1.00
      generated/admin/network-device-discovery/taskand.dev/v2/probe-mdns.mjs:37-40  (arrow_function)
      generated/admin/network-device-discovery/taskand.dev/v2/probe-ssdp.mjs:17-20  (arrow_function)
  [7c0aeed798d564b9]   EXAC  arrow_function  L=4 N=2 saved=4 sim=1.00
      generated/admin/network-device-discovery/taskand.dev/v3/probe-mdns.mjs:14-17  (arrow_function)
      generated/admin/network-device-discovery/taskand.dev/v3/probe-ssdp.mjs:14-17  (arrow_function)
  [831e87a319dbea5b]   EXAC  arrow_function  L=4 N=2 saved=4 sim=1.00
      generated/dev/file-router/taskand.dev/v1/bin.mjs:13-16  (arrow_function)
      generated/dev/llm/taskand.dev/v1/bin.mjs:14-17  (arrow_function)

REFACTOR[5] (ranked by priority):
  [1] ○ extract_function   → generated/utils/registry.py
      WHY: 14 occurrences of 14-line block across 14 files — saves 182 lines
      FILES: generated/admin/chat/taskand.dev/v1/registry-client.mjs, generated/cluster/monitor/taskand.dev/v1/registry-client.mjs, generated/dev/act/taskand.dev/v1/registry-client.mjs, generated/dev/chat/taskand.dev/v1/registry-client.mjs, generated/dev/codegen/taskand.dev/v1/registry-client.mjs +9 more
  [2] ○ extract_function   → generated/dev/utils/arrow_function.py
      WHY: 4 occurrences of 4-line block across 4 files — saves 12 lines
      FILES: generated/dev/act/taskand.dev/v1/bin.mjs, generated/dev/codegen/taskand.dev/v1/bin.mjs, generated/dev/evolve/taskand.dev/v1/bin.mjs, generated/dev/spawn/taskand.dev/v1/bin.mjs
  [3] ○ extract_function   → generated/admin/network-device-discovery/taskand.dev/v2/utils/arrow_function.py
      WHY: 2 occurrences of 4-line block across 2 files — saves 4 lines
      FILES: generated/admin/network-device-discovery/taskand.dev/v2/probe-mdns.mjs, generated/admin/network-device-discovery/taskand.dev/v2/probe-ssdp.mjs
  [4] ○ extract_function   → generated/admin/network-device-discovery/taskand.dev/v3/utils/arrow_function.py
      WHY: 2 occurrences of 4-line block across 2 files — saves 4 lines
      FILES: generated/admin/network-device-discovery/taskand.dev/v3/probe-mdns.mjs, generated/admin/network-device-discovery/taskand.dev/v3/probe-ssdp.mjs
  [5] ○ extract_function   → generated/dev/utils/arrow_function.py
      WHY: 2 occurrences of 4-line block across 2 files — saves 4 lines
      FILES: generated/dev/file-router/taskand.dev/v1/bin.mjs, generated/dev/llm/taskand.dev/v1/bin.mjs

QUICK_WINS[2] (low risk, high savings — do first):
  [1] extract_function   saved=182L  → generated/utils/registry.py
      FILES: registry-client.mjs, registry-client.mjs, registry-client.mjs +11
  [2] extract_function   saved=12L  → generated/dev/utils/arrow_function.py
      FILES: bin.mjs, bin.mjs, bin.mjs +1

EFFORT_ESTIMATE (total ≈ 6.9h):
  hard   registry                            saved=182L  ~364min
  easy   arrow_function                      saved=12L  ~24min
  easy   arrow_function                      saved=4L  ~8min
  easy   arrow_function                      saved=4L  ~8min
  easy   arrow_function                      saved=4L  ~8min

METRICS-TARGET:
  dup_groups:  5 → 0
  saved_lines: 206 lines recoverable
```

### Evolution / Churn (`project/evolution.toon.yaml`)

```toon markpact:analysis path=project/evolution.toon.yaml
# code2llm/evolution | 733 func | 79f | 2026-09-13
# generated in 0.00s

NEXT[7] (ranked by impact):
  [1] !! SPLIT-FUNC      scan  CC=30  fan=20
      WHY: CC=30 exceeds 15
      EFFORT: ~1h  IMPACT: 600

  [2] !  SPLIT-FUNC      mdnsProbe  CC=15  fan=18
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 270

  [3] !! SPLIT-FUNC      mergeDevices  CC=25  fan=10
      WHY: CC=25 exceeds 15
      EFFORT: ~1h  IMPACT: 250

  [4] !  SPLIT-FUNC      readArp  CC=20  fan=12
      WHY: CC=20 exceeds 15
      EFFORT: ~1h  IMPACT: 240

  [5] !  SPLIT-FUNC      register  CC=16  fan=14
      WHY: CC=16 exceeds 15
      EFFORT: ~1h  IMPACT: 224

  [6] !  SPLIT-FUNC      listLocalNetworks  CC=15  fan=9
      WHY: CC=15 exceeds 15
      EFFORT: ~1h  IMPACT: 135

  [7] !! SPLIT           planfile.yaml
      WHY: 591L, 0 classes, max CC=0
      EFFORT: ~4h  IMPACT: 0


RISKS[1]:
  ⚠ Splitting planfile.yaml may break 0 import paths

METRICS-TARGET:
  CC̄:          3.3 → ≤2.3
  max-CC:      30 → ≤15
  god-modules: 1 → 0
  high-CC(≥15): 9 → ≤4
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
  prev CC̄=3.1 → now CC̄=3.3
```

## Intent

taskand v2.2 — Planowanie złożonych zadań + generowanie organizmów na żądanie (Standard v2.2)
