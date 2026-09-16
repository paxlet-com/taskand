import { createHash } from 'node:crypto';

export const digest = value => 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function compareSets(expected, actual) {
  const a = new Set(expected), b = new Set(actual);
  const missing = [...a].filter(x => !b.has(x)), extra = [...b].filter(x => !a.has(x));
  return { ok: !missing.length && !extra.length, expected: a.size, actual: b.size, missing, extra };
}
export function parity(expected, actual) {
  const addresses = t => t.interfaces.flatMap(i => i.addresses.map(a => `${i.name}|${a.family}|${a.address}/${a.prefix}`));
  const networks = t => t.networks.map(n => `${n.interface}|${n.family}|${n.cidr}|${n.range.start}|${n.range.end}|${n.range.addresses}`);
  const checks = { interfaces: compareSets(expected.interfaces.map(i => i.name), actual.interfaces.map(i => i.name)),
    addresses: compareSets(addresses(expected), addresses(actual)), subnetsAndRanges: compareSets(networks(expected), networks(actual)) };
  return { ok: Object.values(checks).every(c => c.ok), checks };
}
// Klucz zmiany źródła: interfejsy efemeryczne (kontenery, mosty) nie unieważniają bliźniaka,
// chyba że ich podsieć była skanowana — wtedy zmiana nadal oznacza SOURCE_CHANGED
const EPHEMERAL = /^(veth|br-|docker|cni|flannel|virbr)/;
export function sourceTopologyKey(topology, scannedCidrs = []) {
  const scanned = new Set(scannedCidrs);
  const networks = (topology?.networks || []).filter(n => !EPHEMERAL.test(n.interface || '') || scanned.has(n.cidr));
  const kept = new Set(networks.map(n => n.interface));
  const interfaces = (topology?.interfaces || []).filter(i => !EPHEMERAL.test(i.name || '') || kept.has(i.name));
  return JSON.stringify({ interfaces, networks });
}
