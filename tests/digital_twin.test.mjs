import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readlinkSync } from 'node:fs';
import { subnet, contains } from '../generated/admin/network-device-discovery/taskand.dev/v4/address.mjs';
import { parity, sourceTopologyKey } from '../generated/twin/environment/taskand.dev/v1/model.mjs';
import { parseIntent } from '../generated/dev/chat/taskand.dev/v1/intent.mjs';

const registryPath = 'generated/registry/core/taskand.dev/v1/bin.mjs';
function reg(action, input) {
  return JSON.parse(spawnSync('node', [registryPath], { input: JSON.stringify({ action, ...input }), encoding: 'utf8', timeout: 20000 }).stdout);
}
const scanner = 'proc://taskand.dev/admin/network-device-discovery/v4';
const twin = 'proc://taskand.dev/twin/environment/v1';

test('IPv4 masks preserve complete ranges, including /0, /20, /31, /32', () => {
  assert.equal(subnet('192.168.188.212', 24).cidr, '192.168.188.0/24');
  assert.deepEqual(subnet('192.168.150.1', 20).range, { start: '192.168.144.0', end: '192.168.159.255', addresses: '4096' });
  assert.deepEqual(subnet('10.2.3.4', 0).range, { start: '0.0.0.0', end: '255.255.255.255', addresses: '4294967296' });
  assert.equal(subnet('10.2.3.4', 31).hosts.count, '2');
  assert.deepEqual(subnet('10.2.3.4', 32).hosts, { start: '10.2.3.4', end: '10.2.3.4', count: '1' });
  assert.throws(() => subnet('999.1.2.3', 24));
  assert.throws(() => subnet('10.1.2.3', 33));
});
test('IPv6 /64 range is lossless and containment respects address families', () => {
  const n = subnet('fde1:8161:1906::cb9', 64);
  assert.equal(n.range.addresses, '18446744073709551616');
  assert.equal(n.range.end, 'fde1:8161:1906:0:ffff:ffff:ffff:ffff');
  assert.equal(contains(n, 'fde1:8161:1906::1234'), true);
  assert.equal(contains(n, 'fde1:8161:1907::1'), false);
  assert.equal(contains(n, '192.168.188.1'), false);
});
test('parity rejects missing IPv6, altered prefix/range and unexpected subnet', () => {
  const interfaces = [{ name: 'eth0', addresses: [{ family: 4, address: '192.168.188.212', prefix: 24 }, { family: 6, address: 'fd00::1', prefix: 64 }] }];
  const expected = { interfaces, networks: [subnet('192.168.188.212', 24), subnet('fd00::1', 64)].map(n => ({ ...n, interface: 'eth0' })) };
  assert.equal(parity(expected, structuredClone(expected)).ok, true);
  const missing = structuredClone(expected); missing.interfaces[0].addresses.pop();
  assert.equal(parity(expected, missing).ok, false);
  const range = structuredClone(expected); range.networks[0].range.end = '192.168.188.64';
  assert.equal(parity(expected, range).ok, false);
  const extra = structuredClone(expected); extra.networks.push({ ...subnet('10.9.0.1', 16), interface: 'br0' });
  assert.equal(parity(expected, extra).ok, false);
});
test('source-change key ignores container interface churn but not LAN or scanned bridge changes', () => {
  const lan = { name: 'enp91s0', addresses: [{ family: 4, address: '192.168.188.212', prefix: 24 }] };
  const bridge = { name: 'br-1a2b', addresses: [{ family: 4, address: '172.18.0.1', prefix: 16 }] };
  const net = (iface, ip, prefix) => ({ ...subnet(ip, prefix), interface: iface });
  const base = { interfaces: [lan, bridge], networks: [net('enp91s0', '192.168.188.212', 24), net('br-1a2b', '172.18.0.1', 16)] };
  const churn = structuredClone(base);
  churn.interfaces.push({ name: 'veth9f3c', addresses: [{ family: 6, address: 'fe80::1', prefix: 64 }] });
  churn.interfaces = churn.interfaces.filter(i => i.name !== 'br-1a2b');
  churn.networks = churn.networks.filter(n => n.interface !== 'br-1a2b');
  assert.equal(sourceTopologyKey(churn), sourceTopologyKey(base));
  const moved = structuredClone(base); moved.interfaces[0].addresses[0].address = '192.168.188.213';
  assert.notEqual(sourceTopologyKey(moved), sourceTopologyKey(base));
  const scanned = ['192.168.188.0/24', '172.18.0.0/16'];
  assert.notEqual(sourceTopologyKey(churn, scanned), sourceTopologyKey(base, scanned));
});
test('registry selects active version and repeated reuse does not change binding', () => {
  const a = reg('select', { organism: 'admin', capability: 'network-device-discovery' });
  const b = reg('select', { organism: 'admin', capability: 'network-device-discovery' });
  assert.equal(a.ok, true); assert.equal(a.uri, scanner); assert.equal(a.entry.hash, b.entry.hash);
  assert.equal(reg('select', { organism: '../admin', capability: 'network-device-discovery' }).ok, false);
});
test('new processes are safe on empty input and reject path traversal', () => {
  for (const uri of [scanner, twin]) assert.equal(reg('call', { uri, input: {} }).status, 'READY');
  assert.equal(reg('call', { uri: twin, input: { action: 'status', id: '../../etc' } }).ok, false);
  assert.equal(reg('call', { uri: twin, input: { action: 'run', taskId: '../escape' } }).ok, false);
});
test('runtime refuses to configure anything in the source network namespace', () => {
  const namespace = readlinkSync('/proc/self/ns/net');
  const r = spawnSync('node', ['generated/twin/environment/taskand.dev/v1/runtime.mjs'], {
    input: JSON.stringify({ hostNamespace: namespace, snapshot: { topology: { namespace } } }), encoding: 'utf8'
  });
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, false); assert.match(result.error, /Brak izolacji/);
});
test('network task creation reuses a capability rather than forcing evolution', () => {
  assert.equal(parseIntent('stwórz zadanie skanowania sieci').name, 'query');
  assert.equal(parseIntent('stwórz cyfrowy bliźniak infrastruktury').name, 'twin');
});
test('validator resolves existing spawn capability through registry without evolution', () => {
  const result = reg('call', { uri: 'proc://taskand.dev/validator/resolve/v1', input: { blueprint: { steps: [
    { id: 1, name: 'scan', process: 'spawn:admin/network-device-discovery', deps: [] }
  ] } } });
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.approvedPlan.steps[0].process, scanner);
  assert.equal(result.approvedPlan.steps[0].reused, true);
  assert.equal(result.unresolvedCapabilities, undefined);
});
