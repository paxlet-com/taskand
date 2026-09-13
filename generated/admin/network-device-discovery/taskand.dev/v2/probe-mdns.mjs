import dgram from 'node:dgram';
import { setTimeout as sleep } from 'node:timers/promises';

const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const QUERY = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x09, 0x5f, 0x73, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x73, 0x07, 0x5f,
  0x75, 0x64, 0x70, 0x2d, 0x74, 0x63, 0x70, 0x04, 0x5f, 0x6d, 0x64, 0x6e,
  0x73, 0x04, 0x5f, 0x75, 0x64, 0x70, 0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c,
  0x00, 0x00, 0x0c, 0x00, 0x01
]);

function extractNames(msg) {
  const names = [];
  const labels = [];
  let i = 12;
  try {
    while (i < msg.length && msg[i] !== 0) {
      const len = msg[i];
      if ((len & 0xc0) === 0xc0) break;
      labels.push(msg.slice(i + 1, i + 1 + len).toString('latin1'));
      i += 1 + len;
    }
    if (labels.length) names.push(labels.join('.'));
  } catch {
    /* parsowanie nieudane */
  }
  return names;
}

export async function probeMdns(networks, timeoutMs = 4000) {
  const result = { ips: [], hostnames: new Map() };
  if (networks.length === 0) return result;
  return await new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const finish = () => {
      try { socket.close(); } catch {}
      resolve(result);
    };
    const timer = setTimeout(finish, timeoutMs);
    socket.on('error', () => { clearTimeout(timer); finish(); });
    socket.on('message', (msg, rinfo) => {
      const ip = rinfo.address;
      if (result.ips.indexOf(ip) === -1) result.ips.push(ip);
      for (const name of extractNames(msg)) {
        if (name.endsWith('.local') && !result.hostnames.has(ip)) {
          result.hostnames.set(ip, name.replace(/\.local$/, ''));
        }
      }
    });
    socket.bind(() => {
      try {
        socket.setMulticastTTL(1);
        socket.send(QUERY, MDNS_PORT, MDNS_ADDR);
      } catch {
        clearTimeout(timer); finish();
      }
    });
  });
}
