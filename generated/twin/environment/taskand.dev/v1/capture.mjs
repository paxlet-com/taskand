import { spawnSync } from 'node:child_process';
import { registry, call } from './registry-client.mjs';
import { digest } from './model.mjs';

function dockerInventory() {
  const run = args => {
    const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
    if (r.status !== 0 || r.error) throw new Error(r.error?.message || r.stderr?.trim() || 'Docker niedostępny');
    return r.stdout.trim();
  };
  try {
    const ids = run(['network', 'ls', '-q']).split('\n').filter(Boolean);
    const template = '{"id":{{json .Id}},"name":{{json .Name}},"driver":{{json .Driver}},"internal":{{json .Internal}},"ipam":{{json .IPAM.Config}},"containers":{{json .Containers}}}';
    const networks = ids.length ? run(['network', 'inspect', '--format', template, ...ids]).split('\n').map(JSON.parse) : [];
    return { ok: true, networks };
  } catch (err) { return { ok: false, networks: [], error: err.message }; }
}

export function capture(input) {
  const catalog = registry('list');
  if (!catalog.ok) throw new Error(catalog.error);
  if (input.process && !/^proc:\/\/taskand\.dev\/admin\/network-device-discovery\/v\d+$/.test(input.process)) throw new Error('Twin obsługuje wyłącznie URI skanera sieci');
  const resolved = input.process ? registry('resolve', { uri: input.process })
    : registry('select', { organism: 'admin', capability: 'network-device-discovery' });
  if (!resolved.ok) throw new Error(resolved.error);
  const scanner = resolved.entry;
  const scanInput = { ...input.scan, mode: input.action === 'create' ? 'inventory' : 'scan' };
  const live = call(scanner.uri, scanInput, 55000);
  if (!live.ok) throw new Error(live.error || 'Skan infrastruktury nie powiódł się');
  if (!live.topology?.networks?.length || !live.topology.interfaces?.length) {
    throw new Error(`${scanner.uri} nie dostarcza pełnej topologii; wymagana wersja z kontraktem topology (v4+)`);
  }
  const hardwareEntry = catalog.processes.find(p => p.status === 'active' && p.uri === 'proc://taskand.dev/hw/monitor/v1');
  const hardware = hardwareEntry ? call(hardwareEntry.uri) : { ok: false, error: 'Brak dostawcy hw/monitor' };
  const docker = dockerInventory();
  const processes = catalog.processes.map(({ uri, organism, kind, status, hash, desc }) => ({ uri, organism, kind, status, hash, desc }));
  const organisms = [...new Set(processes.map(p => p.organism))].sort().map(name => ({ name,
    processes: processes.filter(p => p.organism === name),
    coverage: name === 'admin' ? 'network-runtime' : name === 'hw' ? 'observed-telemetry' : 'catalog-only' }));
  return { schema: 'taskand.twin/v1', capturedAt: live.topology.capturedAt, source: 'live-local-node',
    scanner: { uri: scanner.uri, hash: scanner.hash, input: scanInput }, catalogHash: digest(processes), organisms,
    topology: live.topology, live, hardware, docker,
    fidelity: { networkAddressing: 'pending-runtime-verification', fullInfrastructure: false,
      limitations: ['Usługi i dane urządzeń nie są klonowane; adresy znanych urządzeń są emulowane.',
        'Rejestr opisuje procesy, nie kompletną konfigurację urządzeń, DHCP, VLAN i firewalli.',
        'IPv6: pełne lokalne prefiksy i adresy; wykrywanie z tablicy sąsiadów, bez przeszukiwania /64.',
        'Interfejsy sprzętowe odtwarzane jako dummy; trasy i IPAM są zinwentaryzowane.'] } };
}
