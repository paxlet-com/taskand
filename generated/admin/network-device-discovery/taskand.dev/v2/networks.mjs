import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFileP = promisify(execFile);

function isDockerIface(name) {
  return /^(docker|br-|veth)/.test(name);
}

function cidrFromAddrMask(ip, netmask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  if (ipParts.length !== 4 || maskParts.length !== 4) return null;
  let maskBits = 0;
  let network = [];
  for (let i = 0; i < 4; i++) {
    const m = maskParts[i] >>> 0;
    const bits = m.toString(2).replace(/0+$/, '').length;
    if (m !== 0 && bits !== ((m ^ (m - 1)) + 1).toString(2).length - 1 + 0 && m !== 255 && ((m & (m - 1)) !== 0 || ((m | (m - 1)) & 255) !== 255)) return null;
    maskBits += m === 0 ? 0 : m.toString(2).split('').filter((b) => b === '1').length;
    network.push(ipParts[i] & m);
  }
  return `${network.join('.')}/${maskBits}`;
}

export async function listLocalNetworks(includeDocker) {
  const ifaces = os.networkInterfaces();
  const networks = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!includeDocker && isDockerIface(name)) continue;
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const cidr = cidrFromAddrMask(addr.address, addr.netmask);
      if (cidr) {
        networks.push({ iface: name, cidr, local_ip: addr.address });
      }
    }
  }
  if (networks.length === 0) {
    try {
      const { stdout } = await execFileP('ip', ['-o', '-4', 'addr', 'show'], { timeout: 5000 });
      for (const line of stdout.trim().split('\n')) {
        const m = line.match(/^(\d+):\s+(\S+).*inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/);
        if (!m) continue;
        if (!includeDocker && isDockerIface(m[2])) continue;
        networks.push({ iface: m[2], cidr: `${m[3]}/${m[4]}`, local_ip: m[3] });
      }
    } catch {
      /* brak ip — użyj tylko os.networkInterfaces */
    }
  }
  return networks;
}

export function ipInNetworks(ip, networks) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const a = ip.split('.').map(Number);
  for (const n of networks) {
    const m = n.cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
    if (!m) continue;
    const b = m[1].split('.').map(Number);
    const bits = Number(m[2]);
    let mask = 0;
    for (let i = 0; i < 4; i++) {
      const byteBits = Math.min(8, Math.max(0, bits - i * 8));
      mask = (mask << 8) | (byteBits === 0 ? 0 : (0xff << (8 - byteBits)) & 0xff);
    }
    const ai = ((a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]) >>> 0;
    const bi = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if ((ai & mask) === (bi & mask)) return true;
  }
  return false;
}
