# System Architecture Analysis
<!-- generated in 0.00s -->

## Overview

- **Project**: /home/tom/github/semcod/taskand/glm53
- **Primary Language**: javascript
- **Languages**: javascript: 66, yaml: 36, json: 15, python: 13, shell: 1
- **Analysis Mode**: static
- **Total Functions**: 733
- **Total Classes**: 1
- **Modules**: 134
- **Entry Points**: 624

## Architecture by Module

### generated.admin.network-device-discovery.taskand.dev.v1.bin
- **Functions**: 65
- **File**: `bin.mjs`

### generated.registry.core.taskand.dev.v1.store
- **Functions**: 44
- **File**: `store.mjs`

### generated.registry.core.taskand.dev.v1.lifecycle
- **Functions**: 29
- **File**: `lifecycle.mjs`

### generated.doctor.diagnose.taskand.dev.v1.bin
- **Functions**: 25
- **File**: `bin.mjs`

### generated.hw.monitor.taskand.dev.v1.bin
- **Functions**: 24
- **File**: `bin.mjs`

### generated.registry.core.taskand.dev.v1.exec
- **Functions**: 23
- **File**: `exec.mjs`

### generated.admin.network-device-discovery.taskand.dev.v2.networks
- **Functions**: 21
- **File**: `networks.mjs`

### generated.registry.core.taskand.dev.v1.federation
- **Functions**: 21
- **File**: `federation.mjs`

### generated.doctor.heal.taskand.dev.v1.bin
- **Functions**: 21
- **File**: `bin.mjs`

### generated.dev.evolve.taskand.dev.v1.bin
- **Functions**: 21
- **File**: `bin.mjs`

### generated.dev.act.taskand.dev.v1.bin
- **Functions**: 19
- **File**: `bin.mjs`

### generated.dev.evolve.taskand.dev.v1.gate
- **Functions**: 18
- **File**: `gate.mjs`

### generated.dev.chat.taskand.dev.v1.dispatch
- **Functions**: 18
- **File**: `dispatch.mjs`

### generated.validator.resolve.taskand.dev.v1.bin
- **Functions**: 17
- **File**: `bin.mjs`

### generated.orchestrator.execute.taskand.dev.v1.bin
- **Functions**: 17
- **File**: `bin.mjs`

### generated.dev.composite.taskand.dev.v1.bin
- **Functions**: 17
- **File**: `bin.mjs`

### generated.dev.llm.taskand.dev.v1.bin
- **Functions**: 16
- **File**: `bin.mjs`

### generated.admin.network-device-discovery.taskand.dev.v3.network
- **Functions**: 15
- **File**: `network.mjs`

### generated.admin.network-device-discovery.taskand.dev.v4.address
- **Functions**: 13
- **File**: `address.mjs`

### generated.admin.network-device-discovery.taskand.dev.v2.bin
- **Functions**: 12
- **File**: `bin.mjs`

## Key Entry Points

Main execution flows into the system:

### generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.probeMdns
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.Map, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.Promise, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.createSocket, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.close, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.resolve, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.setTimeout, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.on, generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.clearTimeout

### generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.probeMdns
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.Promise, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.createSocket, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.resolve, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.close, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.setTimeout, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.on, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.done

### generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v1.bin.Promise, generated.admin.network-device-discovery.taskand.dev.v1.bin.createSocket, generated.admin.network-device-discovery.taskand.dev.v1.bin.setTimeout, generated.admin.network-device-discovery.taskand.dev.v1.bin.close, generated.admin.network-device-discovery.taskand.dev.v1.bin.resolve, generated.admin.network-device-discovery.taskand.dev.v1.bin.on, generated.admin.network-device-discovery.taskand.dev.v1.bin.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v1.bin.find

### gateway.handlers.chat.handle_chat
> Jedna ścieżka: dev/chat trasuje organizmy i intencje; gateway nie zna organizmów ani LLM.
- **Calls**: None.strip, gateway.auth.require_grant, None.lower, gateway.middleware.logging.log_event, gateway.utils.call_process, request_handler._send, request_handler._send, gateway.utils.status_for

### generated.registry.core.taskand.dev.v1.exec.call
- **Calls**: generated.registry.core.taskand.dev.v1.exec.Number, generated.registry.core.taskand.dev.v1.exec.fail, generated.registry.core.taskand.dev.v1.exec.wywołań, generated.registry.core.taskand.dev.v1.exec.resolve, generated.registry.core.taskand.dev.v1.exec.secretSource, generated.registry.core.taskand.dev.v1.exec.String, generated.registry.core.taskand.dev.v1.exec.fromEntries, generated.registry.core.taskand.dev.v1.exec.filter

### generated.registry.core.taskand.dev.v1.store.updateRegistry
- **Calls**: generated.registry.core.taskand.dev.v1.store.join, generated.registry.core.taskand.dev.v1.store.now, generated.registry.core.taskand.dev.v1.store.openSync, generated.registry.core.taskand.dev.v1.store.statSync, generated.registry.core.taskand.dev.v1.store.unlinkSync, generated.registry.core.taskand.dev.v1.store.Error, generated.registry.core.taskand.dev.v1.store.sleep, generated.registry.core.taskand.dev.v1.store.readRegistry

### generated.admin.network-device-discovery.taskand.dev.v1.bin.ssdpProbe
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v1.bin.Promise, generated.admin.network-device-discovery.taskand.dev.v1.bin.createSocket, generated.admin.network-device-discovery.taskand.dev.v1.bin.setTimeout, generated.admin.network-device-discovery.taskand.dev.v1.bin.close, generated.admin.network-device-discovery.taskand.dev.v1.bin.resolve, generated.admin.network-device-discovery.taskand.dev.v1.bin.on, generated.admin.network-device-discovery.taskand.dev.v1.bin.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v1.bin.find

### generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.probeSsdp
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.Promise, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.createSocket, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.resolve, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.close, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.setTimeout, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.on, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.done

### generated.registry.core.taskand.dev.v1.lifecycle.refresh
- **Calls**: generated.registry.core.taskand.dev.v1.lifecycle.findEntry, generated.registry.core.taskand.dev.v1.lifecycle.filter, generated.registry.core.taskand.dev.v1.lifecycle.allEntries, generated.registry.core.taskand.dev.v1.lifecycle.parseUri, generated.registry.core.taskand.dev.v1.lifecycle.push, generated.registry.core.taskand.dev.v1.lifecycle.checkPackage, generated.registry.core.taskand.dev.v1.lifecycle.join, generated.registry.core.taskand.dev.v1.lifecycle.packageHash

### generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.SSDP_PORT
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.Promise, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.createSocket, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.close, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.resolve, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.setTimeout, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.on, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.finish

### generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.probeSsdp
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.Promise, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.createSocket, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.close, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.resolve, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.setTimeout, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.on, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.finish

### generated.registry.core.taskand.dev.v1.package.checkPackage
- **Calls**: generated.registry.core.taskand.dev.v1.package.existsSync, generated.registry.core.taskand.dev.v1.package.readManifest, generated.registry.core.taskand.dev.v1.package.push, generated.registry.core.taskand.dev.v1.package.packageFiles, generated.registry.core.taskand.dev.v1.package.includes, generated.registry.core.taskand.dev.v1.package.readdirSync, generated.registry.core.taskand.dev.v1.package.filter, generated.registry.core.taskand.dev.v1.package.endsWith

### generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.probePing
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.cidrToIps, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.all, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.map, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.Promise, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.createSocket, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.resolve, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.close, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.on

### generated.doctor.diagnose.taskand.dev.v1.bin.checkFailingProcesses
- **Calls**: generated.doctor.diagnose.taskand.dev.v1.bin.readFileSync, generated.doctor.diagnose.taskand.dev.v1.bin.trim, generated.doctor.diagnose.taskand.dev.v1.bin.split, generated.doctor.diagnose.taskand.dev.v1.bin.slice, generated.doctor.diagnose.taskand.dev.v1.bin.Map, generated.doctor.diagnose.taskand.dev.v1.bin.parse, generated.doctor.diagnose.taskand.dev.v1.bin.has, generated.doctor.diagnose.taskand.dev.v1.bin.set

### generated.admin.network-device-discovery.taskand.dev.v4.inventory.inventory
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v4.inventory.jsonIP, generated.admin.network-device-discovery.taskand.dev.v4.inventory.map, generated.admin.network-device-discovery.taskand.dev.v4.inventory.includes, generated.admin.network-device-discovery.taskand.dev.v4.inventory.filter, generated.admin.network-device-discovery.taskand.dev.v4.inventory.sort, generated.admin.network-device-discovery.taskand.dev.v4.inventory.localeCompare, generated.admin.network-device-discovery.taskand.dev.v4.inventory.flatMap, generated.admin.network-device-discovery.taskand.dev.v4.inventory.test

### generated.admin.network-device-discovery.taskand.dev.v1.bin.readArp
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v1.bin.arp, generated.admin.network-device-discovery.taskand.dev.v1.bin.readFileSync, generated.admin.network-device-discovery.taskand.dev.v1.bin.split, generated.admin.network-device-discovery.taskand.dev.v1.bin.slice, generated.admin.network-device-discovery.taskand.dev.v1.bin.trim, generated.admin.network-device-discovery.taskand.dev.v1.bin.isIPv4, generated.admin.network-device-discovery.taskand.dev.v1.bin.push, generated.admin.network-device-discovery.taskand.dev.v1.bin.toLowerCase

### gateway.handlers.proc.handle_proc_call
- **Calls**: body.get, gateway.auth.require_grant, gateway.utils.call_process, gateway.middleware.logging.log_event, request_handler._send, request_handler._send, body.get, gateway.utils.status_for

### generated.registry.core.taskand.dev.v1.lifecycle.targets
- **Calls**: generated.registry.core.taskand.dev.v1.lifecycle.parseUri, generated.registry.core.taskand.dev.v1.lifecycle.push, generated.registry.core.taskand.dev.v1.lifecycle.checkPackage, generated.registry.core.taskand.dev.v1.lifecycle.join, generated.registry.core.taskand.dev.v1.lifecycle.packageHash, generated.registry.core.taskand.dev.v1.lifecycle.readManifest, generated.registry.core.taskand.dev.v1.lifecycle.updateRegistry, generated.registry.core.taskand.dev.v1.lifecycle.assign

### generated.admin.network-device-discovery.taskand.dev.v2.stdin.readStdinJson
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v2.stdin.Promise, generated.admin.network-device-discovery.taskand.dev.v2.stdin.setTimeout, generated.admin.network-device-discovery.taskand.dev.v2.stdin.reject, generated.admin.network-device-discovery.taskand.dev.v2.stdin.Error, generated.admin.network-device-discovery.taskand.dev.v2.stdin.setEncoding, generated.admin.network-device-discovery.taskand.dev.v2.stdin.on, generated.admin.network-device-discovery.taskand.dev.v2.stdin.clearTimeout, generated.admin.network-device-discovery.taskand.dev.v2.stdin.resolve

### generated.registry.core.taskand.dev.v1.vault.openSecret
- **Calls**: generated.registry.core.taskand.dev.v1.vault.parse, generated.registry.core.taskand.dev.v1.vault.readFileSync, generated.registry.core.taskand.dev.v1.vault.join, generated.registry.core.taskand.dev.v1.vault.scryptSync, generated.registry.core.taskand.dev.v1.vault.createDecipheriv, generated.registry.core.taskand.dev.v1.vault.from, generated.registry.core.taskand.dev.v1.vault.setAuthTag, generated.registry.core.taskand.dev.v1.vault.concat

### generated.registry.core.taskand.dev.v1.lifecycle.scan
- **Calls**: generated.registry.core.taskand.dev.v1.lifecycle.organisms, generated.registry.core.taskand.dev.v1.lifecycle.flatMap, generated.registry.core.taskand.dev.v1.lifecycle.readdirSync, generated.registry.core.taskand.dev.v1.lifecycle.join, generated.registry.core.taskand.dev.v1.lifecycle.filter, generated.registry.core.taskand.dev.v1.lifecycle.isDirectory, generated.registry.core.taskand.dev.v1.lifecycle.existsSync, generated.registry.core.taskand.dev.v1.lifecycle.map

### gateway.handlers.federation.handle_registry
- **Calls**: body.get, ACTION_GRANTS.get, generated.validator.resolve.taskand.dev.v1.registry-client.registry, request_handler._send, request_handler._send, body.get, gateway.auth.require_grant, gateway.utils.status_for

### generated.admin.network-device-discovery.taskand.dev.v1.bin.ouiMap
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v1.bin.Map, generated.admin.network-device-discovery.taskand.dev.v1.bin.existsSync, generated.admin.network-device-discovery.taskand.dev.v1.bin.readFileSync, generated.admin.network-device-discovery.taskand.dev.v1.bin.split, generated.admin.network-device-discovery.taskand.dev.v1.bin.startsWith, generated.admin.network-device-discovery.taskand.dev.v1.bin.trim, generated.admin.network-device-discovery.taskand.dev.v1.bin.replace, generated.admin.network-device-discovery.taskand.dev.v1.bin.toUpperCase

### gateway.GatewayHTTPHandler._send
- **Calls**: None.encode, self.send_response, self.send_header, gateway.middleware.cors.add_cors_headers, self.send_header, self.end_headers, self.wfile.write, str

### generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.ips
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.Promise, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.createSocket, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.resolve, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.close, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.on, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.setTimeout, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.bind, generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.send

### generated.registry.core.taskand.dev.v1.select.select
- **Calls**: generated.registry.core.taskand.dev.v1.select.every, generated.registry.core.taskand.dev.v1.select.test, generated.registry.core.taskand.dev.v1.select.capability, generated.registry.core.taskand.dev.v1.select.allEntries, generated.registry.core.taskand.dev.v1.select.filter, generated.registry.core.taskand.dev.v1.select.startsWith, generated.registry.core.taskand.dev.v1.select.sort, generated.registry.core.taskand.dev.v1.select.Number

### generated.dev.evolve.taskand.dev.v1.gate.compare
- **Calls**: generated.dev.evolve.taskand.dev.v1.gate.call, generated.dev.evolve.taskand.dev.v1.gate.has, generated.dev.evolve.taskand.dev.v1.gate.false, generated.dev.evolve.taskand.dev.v1.gate.działa, generated.dev.evolve.taskand.dev.v1.gate.liczby, generated.dev.evolve.taskand.dev.v1.gate.compareCounts, generated.dev.evolve.taskand.dev.v1.gate.zdolności, generated.dev.evolve.taskand.dev.v1.gate.stringify

### generated.admin.network-device-discovery.taskand.dev.v3.merge.mergeDevices
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v3.merge.isArray, generated.admin.network-device-discovery.taskand.dev.v3.merge.filter, generated.admin.network-device-discovery.taskand.dev.v3.merge.Map, generated.admin.network-device-discovery.taskand.dev.v3.merge.toUpperCase, generated.admin.network-device-discovery.taskand.dev.v3.merge.replace, generated.admin.network-device-discovery.taskand.dev.v3.merge.get, generated.admin.network-device-discovery.taskand.dev.v3.merge.push, generated.admin.network-device-discovery.taskand.dev.v3.merge.set

### generated.admin.network-device-discovery.taskand.dev.v2.networks.listLocalNetworks
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v2.networks.networkInterfaces, generated.admin.network-device-discovery.taskand.dev.v2.networks.entries, generated.admin.network-device-discovery.taskand.dev.v2.networks.isDockerIface, generated.admin.network-device-discovery.taskand.dev.v2.networks.cidrFromAddrMask, generated.admin.network-device-discovery.taskand.dev.v2.networks.push, generated.admin.network-device-discovery.taskand.dev.v2.networks.execFileP, generated.admin.network-device-discovery.taskand.dev.v2.networks.trim, generated.admin.network-device-discovery.taskand.dev.v2.networks.split

### generated.admin.network-device-discovery.taskand.dev.v2.merge.mergeDevices
- **Calls**: generated.admin.network-device-discovery.taskand.dev.v2.merge.Map, generated.admin.network-device-discovery.taskand.dev.v2.merge.has, generated.admin.network-device-discovery.taskand.dev.v2.merge.set, generated.admin.network-device-discovery.taskand.dev.v2.merge.get, generated.admin.network-device-discovery.taskand.dev.v2.merge.indexOf, generated.admin.network-device-discovery.taskand.dev.v2.merge.push, generated.admin.network-device-discovery.taskand.dev.v2.merge.lookupVendor, generated.admin.network-device-discovery.taskand.dev.v2.merge.addSource

## Process Flows

Key execution flows identified:

### Flow 1: probeMdns
```
probeMdns [generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns]
```

### Flow 2: mdnsProbe
```
mdnsProbe [generated.admin.network-device-discovery.taskand.dev.v1.bin]
```

### Flow 3: handle_chat
```
handle_chat [gateway.handlers.chat]
  └─ →> require_grant
      └─> check_auth
          └─> load_grants
      └─> check_grant
  └─ →> log_event
  └─ →> call_process
      └─> registry
```

### Flow 4: call
```
call [generated.registry.core.taskand.dev.v1.exec]
  └─> fail
```

### Flow 5: updateRegistry
```
updateRegistry [generated.registry.core.taskand.dev.v1.store]
```

### Flow 6: ssdpProbe
```
ssdpProbe [generated.admin.network-device-discovery.taskand.dev.v1.bin]
```

### Flow 7: probeSsdp
```
probeSsdp [generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp]
```

### Flow 8: refresh
```
refresh [generated.registry.core.taskand.dev.v1.lifecycle]
```

### Flow 9: SSDP_PORT
```
SSDP_PORT [generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp]
```

### Flow 10: checkPackage
```
checkPackage [generated.registry.core.taskand.dev.v1.package]
  └─> readManifest
```

## Key Classes

### gateway.GatewayHTTPHandler
- **Methods**: 5
- **Key Methods**: gateway.GatewayHTTPHandler._send, gateway.GatewayHTTPHandler.do_OPTIONS, gateway.GatewayHTTPHandler.do_GET, gateway.GatewayHTTPHandler.do_POST, gateway.GatewayHTTPHandler.log_message
- **Inherits**: BaseHTTPRequestHandler

## Data Transformation Functions

Key functions that process and transform data:

### generated.admin.network-device-discovery.taskand.dev.v1.bin.parseArpText
- **Output to**: generated.admin.network-device-discovery.taskand.dev.v1.bin.split, generated.admin.network-device-discovery.taskand.dev.v1.bin.match, generated.admin.network-device-discovery.taskand.dev.v1.bin.push, generated.admin.network-device-discovery.taskand.dev.v1.bin.toLowerCase

### generated.registry.core.taskand.dev.v1.federation.processes
- **Output to**: generated.registry.core.taskand.dev.v1.federation.map

### generated.dev.composite.taskand.dev.v1.bin.validate
- **Output to**: generated.dev.composite.taskand.dev.v1.bin.call, generated.dev.composite.taskand.dev.v1.bin.say, generated.dev.composite.taskand.dev.v1.bin.forEach

### generated.dev.act.taskand.dev.v1.bin.format
- **Output to**: generated.dev.act.taskand.dev.v1.bin.stringify

### gateway.auth._parse_simple_yaml
- **Output to**: text.splitlines, line.strip, clean.startswith, line.startswith, clean.endswith

### gateway.utils.call_process
- **Output to**: gateway.utils.registry

### generated.admin.network-device-discovery.taskand.dev.v3.stdin.parsed

### generated.registry.core.taskand.dev.v1.exec.parseJson
- **Output to**: generated.registry.core.taskand.dev.v1.exec.trim, generated.registry.core.taskand.dev.v1.exec.split, generated.registry.core.taskand.dev.v1.exec.pop, generated.registry.core.taskand.dev.v1.exec.parse

### generated.registry.core.taskand.dev.v1.exec.parsed
- **Output to**: generated.registry.core.taskand.dev.v1.exec.fail, generated.registry.core.taskand.dev.v1.exec.trim, generated.registry.core.taskand.dev.v1.exec.slice

### generated.registry.core.taskand.dev.v1.store.parseUri
- **Output to**: generated.registry.core.taskand.dev.v1.store.exec, generated.registry.core.taskand.dev.v1.store.String, generated.registry.core.taskand.dev.v1.store.join

### generated.dev.chat.taskand.dev.v1.intent.parseIntent
- **Output to**: generated.dev.chat.taskand.dev.v1.intent.toLowerCase, generated.dev.chat.taskand.dev.v1.intent.has, generated.dev.chat.taskand.dev.v1.intent.find, generated.dev.chat.taskand.dev.v1.intent.matches

### generated.doctor.diagnose.taskand.dev.v1.bin.checkFailingProcesses
- **Output to**: generated.doctor.diagnose.taskand.dev.v1.bin.readFileSync, generated.doctor.diagnose.taskand.dev.v1.bin.trim, generated.doctor.diagnose.taskand.dev.v1.bin.split, generated.doctor.diagnose.taskand.dev.v1.bin.slice, generated.doctor.diagnose.taskand.dev.v1.bin.Map

### generated.doctor.prescribe.taskand.dev.v1.bin.parseUri

### generated.admin.network-device-discovery.taskand.dev.v4.address.formatIP
- **Output to**: generated.admin.network-device-discovery.taskand.dev.v4.address.map, generated.admin.network-device-discovery.taskand.dev.v4.address.Number, generated.admin.network-device-discovery.taskand.dev.v4.address.join, generated.admin.network-device-discovery.taskand.dev.v4.address.from, generated.admin.network-device-discovery.taskand.dev.v4.address.BigInt

### generated.registry.core.taskand.dev.v1.lifecycle.processes

## Public API Surface

Functions exposed as public API (no underscore prefix):

- `generated.admin.network-device-discovery.taskand.dev.v4.bin.scan` - 20 calls
- `generated.admin.network-device-discovery.taskand.dev.v2.probe-mdns.probeMdns` - 19 calls
- `generated.admin.network-device-discovery.taskand.dev.v3.probe-mdns.probeMdns` - 19 calls
- `generated.admin.network-device-discovery.taskand.dev.v1.bin.mdnsProbe` - 18 calls
- `gateway.handlers.chat.handle_chat` - 18 calls
- `generated.registry.core.taskand.dev.v1.exec.call` - 18 calls
- `generated.registry.core.taskand.dev.v1.store.updateRegistry` - 17 calls
- `gateway.auth.check_auth` - 16 calls
- `generated.registry.core.taskand.dev.v1.store.sleep` - 16 calls
- `generated.admin.network-device-discovery.taskand.dev.v1.bin.ssdpProbe` - 15 calls
- `generated.admin.network-device-discovery.taskand.dev.v3.probe-ssdp.probeSsdp` - 15 calls
- `generated.registry.core.taskand.dev.v1.lifecycle.refresh` - 15 calls
- `generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.SSDP_PORT` - 14 calls
- `generated.admin.network-device-discovery.taskand.dev.v2.probe-ssdp.probeSsdp` - 14 calls
- `generated.registry.core.taskand.dev.v1.package.unquote` - 14 calls
- `generated.registry.core.taskand.dev.v1.package.checkPackage` - 14 calls
- `generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.probePing` - 14 calls
- `generated.doctor.diagnose.taskand.dev.v1.bin.checkFailingProcesses` - 14 calls
- `generated.registry.core.taskand.dev.v1.lifecycle.register` - 14 calls
- `generated.admin.network-device-discovery.taskand.dev.v4.inventory.inventory` - 14 calls
- `generated.admin.network-device-discovery.taskand.dev.v4.inventory.jsonIP` - 13 calls
- `generated.admin.network-device-discovery.taskand.dev.v1.bin.readArp` - 12 calls
- `gateway.handlers.proc.handle_proc_call` - 12 calls
- `generated.registry.core.taskand.dev.v1.lifecycle.targets` - 12 calls
- `generated.admin.network-device-discovery.taskand.dev.v2.stdin.readStdinJson` - 11 calls
- `generated.registry.core.taskand.dev.v1.package.readManifest` - 11 calls
- `generated.registry.core.taskand.dev.v1.vault.openSecret` - 11 calls
- `generated.registry.core.taskand.dev.v1.federation.install` - 11 calls
- `generated.registry.core.taskand.dev.v1.lifecycle.scan` - 11 calls
- `gateway.handlers.federation.handle_registry` - 11 calls
- `generated.admin.network-device-discovery.taskand.dev.v2.probe-arp.execFileP` - 10 calls
- `generated.admin.network-device-discovery.taskand.dev.v2.probe-arp.readArpTable` - 10 calls
- `generated.admin.network-device-discovery.taskand.dev.v1.bin.ouiMap` - 10 calls
- `generated.admin.network-device-discovery.taskand.dev.v1.bin.loadOui` - 10 calls
- `gateway.auth.load_grants` - 10 calls
- `generated.admin.network-device-discovery.taskand.dev.v3.probe-ping.ips` - 10 calls
- `generated.registry.core.taskand.dev.v1.select.select` - 10 calls
- `generated.dev.evolve.taskand.dev.v1.gate.compare` - 10 calls
- `generated.admin.network-device-discovery.taskand.dev.v3.merge.mergeDevices` - 10 calls
- `generated.registry.core.taskand.dev.v1.lifecycle.setStatus` - 10 calls

## System Interactions

How components interact:

```mermaid
graph TD
    probeMdns --> Map
    probeMdns --> Promise
    probeMdns --> createSocket
    probeMdns --> close
    probeMdns --> resolve
    probeMdns --> setTimeout
    mdnsProbe --> Promise
    mdnsProbe --> createSocket
    mdnsProbe --> setTimeout
    mdnsProbe --> close
    mdnsProbe --> resolve
    handle_chat --> strip
    handle_chat --> require_grant
    handle_chat --> lower
    handle_chat --> log_event
    handle_chat --> call_process
    call --> Number
    call --> fail
    call --> wywołań
    call --> resolve
    call --> secretSource
    updateRegistry --> join
    updateRegistry --> now
    updateRegistry --> openSync
    updateRegistry --> statSync
    updateRegistry --> unlinkSync
    ssdpProbe --> Promise
    ssdpProbe --> createSocket
    ssdpProbe --> setTimeout
    ssdpProbe --> close
```

## Reverse Engineering Guidelines

1. **Entry Points**: Start analysis from the entry points listed above
2. **Core Logic**: Focus on classes with many methods
3. **Data Flow**: Follow data transformation functions
4. **Process Flows**: Use the flow diagrams for execution paths
5. **API Surface**: Public API functions reveal the interface

## Context for LLM

Maintain the identified architectural patterns and public API surface when suggesting changes.