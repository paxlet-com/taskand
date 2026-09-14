#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { command, inventory } from './inventory.mjs';
import { contains } from './address.mjs';

export function scan(params) {
  const topology = inventory();
  const mode = params.mode || 'scan', scope = params.scope || 'lan';
  if (!['inventory', 'scan'].includes(mode) || !['lan', 'all'].includes(scope)) throw new Error('mode: inventory|scan; scope: lan|all');
  let targets = topology.networks.filter(n => n.family === 4 && n.scope !== 'host' && (scope === 'all' || n.lan));
  targets = [...new Map(targets.map(n => [n.cidr, n])).values()];
  if (params.networks !== undefined) {
    if (!Array.isArray(params.networks) || !params.networks.length || params.networks.some(c => !targets.some(n => n.cidr === c))) {
      throw new Error('networks musi zawierać wyłącznie dokładne CIDR lokalnych sieci w wybranym scope');
    }
    targets = targets.filter(n => params.networks.includes(n.cidr));
  }
  const devices = new Map();
  const add = (ip, fields) => devices.set(ip, { ...(devices.get(ip) || { ip, sources: [] }), ...fields,
    sources: [...new Set([...(devices.get(ip)?.sources || []), ...fields.sources])] });
  for (const i of topology.interfaces) for (const a of i.addresses) {
    if (!i.loopback) add(a.address, { mac: i.mac, hostname: topology.host, interface: i.name, sources: ['local-interface'] });
  }
  for (const n of topology.neighbors) add(n.dst, { mac: n.lladdr, interface: n.dev, sources: ['neighbor-table'] });
  if (mode === 'scan') {
    if (!targets.length) throw new Error('Brak lokalnych podsieci IPv4 do skanowania');
    const count = targets.reduce((n, t) => n + BigInt(t.range.addresses), 0n);
    if (count > 4096n) throw new Error('Zakres przekracza 4096 adresów; wybierz konkretne lokalne networks. Nie obcinam zakresu.');
    const xml = command('nmap', ['-sn', '-n', '--unprivileged', '--max-retries', '1', '--host-timeout', '3s', '-oX', '-', ...targets.map(t => t.cidr)], 45000);
    if (!xml.includes('<finished ') || !xml.includes('exit="success"')) throw new Error('Niekompletny wynik nmap');
    for (const host of xml.matchAll(/<host\b[\s\S]*?<\/host>/g)) {
      if (!/<status\b[^>]*state="up"/.test(host[0])) continue;
      const ip = host[0].match(/addr="([\d.]+)" addrtype="ipv4"/)?.[1];
      if (ip && targets.some(n => contains(n, ip))) add(ip, { sources: ['nmap'] });
    }
  }
  return { ok: true, mode, topology, devices: [...devices.values()],
    scanned_networks: mode === 'scan' ? targets.map(n => ({ cidr: n.cidr, range: n.range })) : [],
    coverage: { inventory: 'all-local-interfaces-ipv4-ipv6', activeScan: mode === 'scan' ? 'ipv4-selected-subnets' : 'none',
      ipv6: 'addresses-and-neighbors-only', dhcpPools: 'unknown-without-router-provider' },
    summary: `Odczytano ${topology.networks.length} sieci interfejsów; skan ${mode === 'scan' ? targets.length : 0} podsieci; ${devices.size} znanych adresów urządzeń.` };
}

let out;
try {
  const input = JSON.parse(readFileSync(0, 'utf8').trim() || '{}');
  const params = input.params || input;
  out = Object.keys(params).length ? scan(params) : { ok: true, status: 'READY', usage: '{"mode":"scan","scope":"lan"} lub {"mode":"inventory"}' };
} catch (err) { out = { ok: false, errorType: 'NETWORK_DISCOVERY_FAILED', error: err.message }; }
process.stdout.write(JSON.stringify(out) + '\n');
