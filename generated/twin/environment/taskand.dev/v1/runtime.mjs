// This entry is launched only in a fresh user/network/PID namespace.
import { readFileSync, readlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import { call, registry } from './registry-client.mjs';
import { parity, compareSets } from './model.mjs';

function ip(args) {
  const r = spawnSync('ip', args, { encoding: 'utf8', timeout: 5000 });
  if (r.status !== 0 || r.error) throw new Error(`ip ${args.join(' ')}: ${r.error?.message || r.stderr?.trim()}`);
  return r.stdout;
}

function execute({ snapshot, hostNamespace }) {
  const namespace = readlinkSync('/proc/self/ns/net');
  if (!hostNamespace || namespace === hostNamespace || snapshot.topology.namespace !== hostNamespace) throw new Error('Brak izolacji sieci od hosta');
  const before = JSON.parse(ip(['-j', 'address', 'show']));
  if (before.some(i => i.ifname !== 'lo')) throw new Error('Przestrzeń sieciowa nie jest pusta');
  const interfaces = snapshot.topology.interfaces;
  for (const i of interfaces) {
    if (!/^[a-zA-Z0-9_.:-]{1,15}$/.test(i.name)) throw new Error(`Nieobsługiwana nazwa interfejsu: ${i.name}`);
    if (i.name !== 'lo') {
      ip(['link', 'add', 'name', i.name, 'type', 'dummy']);
      ip(['link', 'set', 'dev', i.name, 'addrgenmode', 'none']);
      if (/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(i.mac || '')) ip(['link', 'set', 'dev', i.name, 'address', i.mac]);
    }
    ip(['link', 'set', 'dev', i.name, 'mtu', String(i.mtu)]);
    ip(['link', 'set', 'dev', i.name, 'up']);
    // Loopback gains default addresses on link-up; replace gives exact observed prefixes.
    if (i.name === 'lo') ip(['address', 'flush', 'dev', 'lo']);
    for (const a of i.addresses) {
      if (isIP(a.address) !== a.family) throw new Error('Niepoprawny adres w migawce');
      ip([`-${a.family}`, 'address', 'replace', `${a.address}/${a.prefix}`, 'dev', i.name,
        'scope', a.scope, ...(a.family === 6 ? ['nodad'] : [])]);
    }
  }
  // No external veth, bridge, socket or default gateway connects this namespace to the host.
  // Known device addresses respond locally; this is explicitly endpoint emulation, not service cloning.
  const endpoints = new Set(snapshot.live.devices.map(d => d.ip).filter(ip => isIP(ip)));
  for (const net of snapshot.docker.networks) for (const c of Object.values(net.containers || {})) {
    for (const address of [c.IPv4Address, c.IPv6Address]) if (address) endpoints.add(address.split('/')[0]);
  }
  const local = new Set(interfaces.flatMap(i => i.addresses.map(a => a.address)));
  for (const address of endpoints) if (!local.has(address) && isIP(address) && !address.startsWith('fe80:')) {
    const family = isIP(address);
    ip([`-${family}`, 'route', 'replace', 'local', `${address}/${family === 4 ? 32 : 128}`, 'dev', 'lo', 'table', 'local']);
  }
  for (const n of snapshot.topology.neighbors) {
    if (interfaces.some(i => i.name === n.dev) && isIP(n.dst)) ip(['neigh', 'replace', n.dst, 'lladdr', n.lladdr, 'nud', 'permanent', 'dev', n.dev]);
  }
  const resolved = registry('resolve', { uri: snapshot.scanner.uri });
  if (!resolved.ok || resolved.entry.hash !== snapshot.scanner.hash) throw new Error('Zmienił się bindingHash skanera od wykonania migawki');
  const observed = call(snapshot.scanner.uri, { mode: 'inventory' }, 10000);
  if (!observed.ok || !observed.topology) throw new Error(observed.error || 'Brak topologii runtime');
  const addressParity = parity(snapshot.topology, observed.topology);
  if (!addressParity.ok) return { ok: false, errorType: 'TWIN_PARITY_FAILED', error: 'Adresacja runtime różni się od źródła', parity: addressParity };
  const scan = call(snapshot.scanner.uri, snapshot.scanner.input, 55000);
  const scanParity = compareSets(snapshot.live.scanned_networks.map(n => n.cidr), (scan.scanned_networks || []).map(n => n.cidr));
  const expectedHosts = snapshot.live.devices.filter(d => d.sources.includes('nmap')).map(d => d.ip);
  const actualHosts = (scan.devices || []).filter(d => d.sources.includes('nmap')).map(d => d.ip);
  const missedHosts = expectedHosts.filter(ip => !actualHosts.includes(ip));
  return { ok: scan.ok === true && scanParity.ok && !missedHosts.length, namespace, hostNamespace,
    isolated: true, materialized: true, parity: addressParity, scanParity,
    emulatedEndpoints: endpoints.size, scannedHosts: { expected: expectedHosts.length, actual: actualHosts.length, missed: missedHosts },
    process: snapshot.scanner, result: scan };
}

let out;
try { out = execute(JSON.parse(readFileSync(0, 'utf8'))); }
catch (err) { out = { ok: false, errorType: 'TWIN_RUNTIME_FAILED', error: err.message }; }
process.stdout.write(JSON.stringify(out) + '\n');
