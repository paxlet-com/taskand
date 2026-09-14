#!/usr/bin/env node
import { readStdinJson } from "./stdin.mjs";
import { detectNetwork } from "./network.mjs";
import { probeArp } from "./probe-arp.mjs";
import { probePing } from "./probe-ping.mjs";
import { probeMdns } from "./probe-mdns.mjs";
import { probeSsdp } from "./probe-ssdp.mjs";
import { reverseDns } from "./probe-dns.mjs";
import { ouiVendor } from "./oui.mjs";
import { mergeDevices } from "./merge.mjs";

const input = await readStdinJson();
const t0 = Date.now();

const net = await detectNetwork();
const found = [];

const arpDevices = await probeArp();
found.push(...(Array.isArray(arpDevices) ? arpDevices : []));

if (net.ok) {
  const ping = await probePing(net.cidr, { limit: 64 });
  found.push(...(Array.isArray(ping) ? ping : []));
  const mdns = await probeMdns();
  found.push(...(Array.isArray(mdns) ? mdns : []));
  const ssdp = await probeSsdp();
  found.push(...(Array.isArray(ssdp) ? ssdp : []));
}

const devices = mergeDevices(found);
const resolved = [];
for (const d of devices) {
  let hostname = d.hostname || null;
  if (!hostname && d.ip) {
    const names = await reverseDns(d.ip);
    if (names && names.length > 0) hostname = names[0];
  }
  resolved.push({
    ip: d.ip || null,
    mac: d.mac || null,
    hostname,
    vendor: d.mac ? ouiVendor(d.mac) : null,
    sources: Array.from(new Set(d.sources || [])),
  });
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const summary = `Wykryto ${resolved.length} urządzeń w sieci lokalnej (skan ARP/ping/mDNS/SSDP, ${elapsed}s).`;
process.stdout.write(JSON.stringify({ ok: true, network: net.ok ? net.info : null, devices: resolved, summary }) + "\n");
process.exit(0);
