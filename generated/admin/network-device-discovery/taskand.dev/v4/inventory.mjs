import { spawnSync } from 'node:child_process';
import { readlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import { subnet } from './address.mjs';

export function command(program, args, timeout = 5000) {
  const r = spawnSync(program, args, { encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`${program}: ${r.error?.message || r.stderr?.trim() || `exit ${r.status}`}`);
  return r.stdout;
}
const jsonIP = args => JSON.parse(command('ip', ['-j', ...args]));

export function inventory() {
  const interfaces = jsonIP(['address', 'show']).map(i => ({
    name: i.ifname, mac: i.address || null, mtu: i.mtu, master: i.master || null,
    up: i.flags.includes('UP'), loopback: i.flags.includes('LOOPBACK'),
    addresses: i.addr_info.filter(a => ['inet', 'inet6'].includes(a.family)).map(a => ({
      family: a.family === 'inet' ? 4 : 6, address: a.local, prefix: a.prefixlen, scope: a.scope
    }))
  })).sort((a, b) => a.name.localeCompare(b.name));
  const networks = interfaces.flatMap(i => i.addresses.map(a => ({ interface: i.name, scope: a.scope,
    lan: !i.loopback && !/^(docker|br-|veth|virbr|cni|flannel|tun|tap|wg)/.test(i.name),
    ...subnet(a.address, a.prefix) })));
  const routes = [4, 6].flatMap(family => jsonIP([`-${family}`, 'route', 'show']).map(r => ({ family, ...r })));
  const neighbors = jsonIP(['neigh', 'show']).filter(n => n.lladdr && !n.state?.some(s => ['FAILED', 'INCOMPLETE'].includes(s)));
  return { capturedAt: new Date().toISOString(), host: hostname(), namespace: readlinkSync('/proc/self/ns/net'),
    interfaces, networks, routes, neighbors };
}
