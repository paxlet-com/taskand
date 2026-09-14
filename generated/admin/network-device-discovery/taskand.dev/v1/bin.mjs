#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import dns from 'node:dns/promises';
import dgram from 'node:dgram';
import net from 'node:net';

const run = promisify(execFile);
const TIMEOUT_MS = 15000;
const deadline = Date.now() + 18000;

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exit(0);
}

function errOut(msg) {
  out({ ok: false, error: msg });
}

let input = {};
try {
  const raw = fs.readFileSync(0, 'utf8');
  if (raw.trim()) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

function timeLeft() { return Math.min(TIMEOUT_MS, deadline - Date.now()); }

// --- OUI lookup from local file (no network) ---
let ouiMap = null;
function loadOui() {
  if (ouiMap !== null) return;
  ouiMap = new Map();
  const paths = ['/usr/share/nmap/nmap-mac-prefixes', '/var/lib/ieee-data/oui.txt', '/usr/share/ieee-data/oui.txt', '/etc/manuf'];
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;
        const parts = line.split(/\s+/, 2);
        const hex = parts[0].replace(/[:-]/g, '').toUpperCase();
        if (/^[0-9A-F]{6}$/.test(hex) && parts[1]) ouiMap.set(hex, parts[1]);
      }
      if (ouiMap.size) break;
    } catch {}
  }
}
function vendorFromMac(mac) {
  if (!mac) return null;
  loadOui();
  const hex = mac.replace(/[:-]/g, '').toUpperCase().slice(0, 6);
  return ouiMap.get(hex) || null;
}

// --- Parse ARP table ---
function parseArpText(text) {
  const devs = [];
  for (const line of text.split('\n')) {
    const m = line.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s+.*?(([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})/);
    if (m) devs.push({ ip: m[1], mac: m[2].toLowerCase() });
  }
  return devs;
}

async function readArp() {
  // 1) /proc/net/arp (Linux)
  try {
    const t = fs.readFileSync('/proc/net/arp', 'utf8');
    const devs = [];
    for (const line of t.split('\n').slice(1)) {
      const p = line.trim().split(/\s+/);
      if (p.length >= 4 && net.isIPv4(p[0])) {
        if (p[3] !== '00:00:00:00:00:00') devs.push({ ip: p[0], mac: p[3].toLowerCase() });
      }
    }
    if (devs.length) return devs;
  } catch {}
  // 2) arp -a
  try {
    const { stdout } = await run('arp', ['-a'], { timeout: 5000, windowsHide: true });
    const devs = [];
    const re = /\(?([0-9]{1,3}(?:\.[0-9]{1,3}){3})\)?\s+(?:at\s+)?(([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})/g;
    let m;
    while ((m = re.exec(stdout))) devs.push({ ip: m[1], mac: m[2].toLowerCase() });
    if (devs.length) return devs;
  } catch {}
  // 3) ip neigh
  try {
    const { stdout } = await run('ip', ['neigh'], { timeout: 5000, windowsHide: true });
    const devs = [];
    for (const line of stdout.split('\n')) {
      const mip = line.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3})/);
      const mmac = line.match(/(([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})/);
      if (mip && mmac && !line.includes('FAILED')) devs.push({ ip: mip[1], mac: mmac[1].toLowerCase() });
    }
    if (devs.length) return devs;
  } catch {}
  return [];
}

// --- Local subnets from interfaces ---
function localSubnets() {
  const nets = [];
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const it of list) {
      if (it.family !== 'IPv4' || it.internal) continue;
      const ipParts = it.address.split('.').map(Number);
      const maskParts = (it.netmask || '255.255.255.0').split('.').map(Number);
      let maskBits = 0;
      for (const b of maskParts) maskBits += (b.toString(2).match(/1/g) || []).length;
      const netParts = ipParts.map((p, i) => p & maskParts[i]);
      nets.push({ cidr: netParts.join('.') + '/' + maskBits, mask: maskParts.join('.'), self: it.address, iface: it });
    }
  }
  return nets;
}

// --- TCP probe to verify host is alive (port 80/443/445) ---
function tcpProbe(ip, port, ms) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const fin = (r) => { if (!done) { done = true; s.destroy(); resolve(r); } };
    s.setTimeout(ms, () => fin(false));
    s.once('connect', () => fin(true));
    s.once('error', () => fin(false));
    s.connect(port, ip);
  });
}

// --- mDNS query via UDP multicast ---
function mdnsProbe(ms) {
  return new Promise((resolve) => {
    const found = [];
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const timer = setTimeout(() => { try { sock.close(); } catch {} resolve(found); }, ms);
    sock.on('error', () => { clearTimeout(timer); try { sock.close(); } catch {} resolve(found); });
    sock.on('message', (msg, rinfo) => {
      const ip = rinfo.address;
      if (found.find((f) => f.ip === ip)) return;
      // parse PTR answers for hostname
      let hostname = null;
      try {
        let off = 12;
        const readName = (start) => {
          let labels = [], o = start, jumps = 0;
          while (jumps < 5) {
            const len = msg[o];
            if (len === undefined) break;
            if (len === 0) { o++; break; }
            if ((len & 0xc0) === 0xc0) {
              const ptr = ((len & 0x3f) << 8) | msg[o + 1];
              const sub = readName(ptr);
              labels.push(...sub.labels);
              o += 2;
              jumps++;
              return { labels, o };
            }
            labels.push(msg.slice(o + 1, o + 1 + len).toString());
            o += 1 + len;
          }
          return { labels, o };
        };
        // skip question, then walk answers (best-effort, tolerate errors)
        const qd = (msg[4] << 8) | msg[5];
        for (let i = 0; i < qd; i++) { const r = readName(off); off = r.o + 4; }
        const an = (msg[6] << 8) | msg[7];
        for (let i = 0; i < an && off < msg.length; i++) {
          const r = readName(off); off = r.o;
          off += 2; // type
          off += 2; // class
          off += 4; // ttl
          const rdlen = (msg[off] << 8) | msg[off + 1]; off += 2;
          const type = msg[off - 8];
          if (type === 12 && r.labels.length) { // PTR
            const rd = readName(off);
            hostname = rd.labels.join('.');
          }
          off += rdlen;
        }
      } catch {}
      found.push({ ip, hostname, source: 'mdns' });
    });
    sock.bind(() => {
      const q = Buffer.from('000001000000000000000b5f737663746f72707f5f746370076c6f63616c00000c0001', 'hex');
      sock.setMulticastTTL(4);
      sock.send(q, 5353, '224.0.0.251', () => {});
    });
  });
}

// --- SSDP M-SEARCH ---
function ssdpProbe(ms) {
  return new Promise((resolve) => {
    const found = [];
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const timer = setTimeout(() => { try { sock.close(); } catch {} resolve(found); }, ms);
    sock.on('error', () => { clearTimeout(timer); try { sock.close(); } catch {} resolve(found); });
    sock.on('message', (msg, rinfo) => {
      const ip = rinfo.address;
      const existing = found.find((f) => f.ip === ip);
      const st = (msg.toString().match(/SERVER:\s*(.+)/i) || [])[1]?.trim() || null;
      if (existing) { if (st && !existing.hostname) existing.hostname = st; return; }
      found.push({ ip, hostname: st, source: 'ssdp' });
    });
    sock.bind(() => {
      const msg = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n';
      sock.setMulticastTTL(4);
      sock.send(msg, 1900, '239.255.255.250', () => {});
    });
  });
}

(async () => {
  try {
    const nets = localSubnets();
    if (!nets.length) errOut('Nie znaleziono aktywnych interfejsów IPv4 w sieci lokalnej.');

    const netsInfo = nets.map((n) => ({ cidr: n.cidr, local_ip: n.self }));

    // parallel discovery
    const mdnsMs = Math.min(3000, timeLeft() - 1000);
    const ssdpMs = Math.min(3000, timeLeft() - 1000);
    const [arpDevs, mdnsDevs, ssdpDevs] = await Promise.all([
      readArp(),
      mdnsProbe(Math.max(1000, mdnsMs)).catch(() => []),
      ssdpProbe(Math.max(1000, ssdpMs)).catch(() => []),
    ]);

    // merge
    const byIp = new Map();
    const add = (ip, data) => {
      if (!net.isIPv4(ip) || ip === '0.0.0.0') return;
      const cur = byIp.get(ip) || { ip, mac: null, hostname: null, vendor: null, sources: [] };
      for (const k of ['mac', 'hostname']) if (data[k] && !cur[k]) cur[k] = data[k];
      if (data.source && !cur.sources.includes(data.source)) cur.sources.push(data.source);
      byIp.set(ip, cur);
    };

    for (const d of arpDevs) add(d.ip, { ip: d.ip, mac: d.mac, source: 'arp' });
    for (const d of mdnsDevs) add(d.ip, { ip: d.ip, hostname: d.hostname, source: 'mdns' });
    for (const d of ssdpDevs) add(d.ip, { ip: d.ip, hostname: d.hostname, source: 'ssdp' });

    // TCP probe liveness for hosts without MAC (confirm reachability)
    const noMac = [...byIp.values()].filter((d) => !d.mac).slice(0, 30);
    const probeBudget = Math.max(500, timeLeft() - 2500);
    await Promise.all(noMac.map(async (d) => {
      const alive = await Promise.race([
        Promise.any([tcpProbe(d.ip, 80, probeBudget), tcpProbe(d.ip, 443, probeBudget), tcpProbe(d.ip, 445, probeBudget)]).catch(() => false),
        new Promise((r) => setTimeout(() => r(false), probeBudget)),
      ]);
      if (!alive) byIp.delete(d.ip);
    }));

    // reverse DNS for remaining without hostname (limit)
    const needDns = [...byIp.values()].filter((d) => !d.hostname).slice(0, 25);
    await Promise.all(needDns.map(async (d) => {
      try {
        const names = await dns.reverse(d.ip);
        if (names && names.length) d.hostname = names[0];
      } catch {}
    }));

    // vendor from MAC
    for (const d of byIp.values()) {
      d.vendor = vendorFromMac(d.mac);
      if (!d.sources.includes('arp')) d.sources.push('tcp-probe');
    }

    const devices = [...byIp.values()];
    const selfIps = nets.map((n) => n.self);
    for (const d of devices) d.is_local_node = selfIps.includes(d.ip);

    out({
      ok: true,
      scanned_networks: netsInfo,
      methods: ['arp', 'mdns', 'ssdp', 'tcp-probe', 'reverse-dns'],
      device_count: devices.length,
      devices,
      note: ouiMap && ouiMap.size ? null : 'Baza OUI niedostępna lokalnie – vendor=null tam, gdzie brak danych.',
      summary: `Wykryto ${devices.length} aktywnych urządzeń w sieci ${netsInfo.map((n) => n.cidr).join(', ')} metodami ARP/mDNS/SSDP/TCP.`,
    });
  } catch (e) {
    errOut('Skanowanie sieci nie powiodło się: ' + (e && e.message ? e.message : String(e)));
  }
})();