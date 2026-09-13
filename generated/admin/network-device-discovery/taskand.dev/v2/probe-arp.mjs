import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipInNetworks } from './networks.mjs';

const execFileP = promisify(execFile);

export function readArpTable(networks) {
  const entries = [];
  try {
    const data = require('node:fs').readFileSync('/proc/net/arp', 'utf8');
    for (const line of data.trim().split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) continue;
      const [ip, , flags, , mac, iface] = parts;
      if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) continue;
      if ((parseInt(flags, 16) & 0x2) === 0) continue;
      entries.push({ ip, mac: mac.toLowerCase(), iface });
    }
  } catch {
    /* brak /proc/net/arp */
  }
  return entries.filter((e) => ipInNetworks(e.ip, networks));
}

export async function refreshArpWithIpNeigh(networks) {
  try {
    await execFileP('ip', ['neigh', 'show'], { timeout: 5000 });
  } catch {
    /* ip niedostępne lub brak uprawnień */
  }
  return readArpTable(networks);
}
