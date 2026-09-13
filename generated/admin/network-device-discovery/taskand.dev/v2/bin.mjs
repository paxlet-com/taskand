#!/usr/bin/env node
import { readStdinJson } from './stdin.mjs';
import { listLocalNetworks } from './networks.mjs';
import { readArpTable } from './probe-arp.mjs';
import { probeMdns } from './probe-mdns.mjs';
import { probeSsdp } from './probe-ssdp.mjs';
import { probeTcp } from './probe-tcp.mjs';
import { reverseDns } from './probe-dns.mjs';
import { lookupVendor } from './vendor.mjs';
import { mergeDevices } from './merge.mjs';

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

try {
  const input = await readStdinJson();
  const params = (input && typeof input === 'object' && input.params) || {};
  const includeDocker = params.include_docker === true;

  const networks = await listLocalNetworks(includeDocker);
  const arpEntries = readArpTable(networks);

  const mdns = await probeMdns(networks);
  const ssdp = await probeSsdp(networks);

  const candidateIps = new Set([
    ...arpEntries.map((e) => e.ip),
    ...mdns.ips,
    ...ssdp.ips
  ]);
  const tcp = await probeTcp([...candidateIps]);
  const dns = await reverseDns([...candidateIps]);

  const devices = mergeDevices({ arpEntries, mdns, ssdp, tcp, dns, lookupVendor });

  out({
    ok: true,
    summary: `Wykryto ${devices.length} urządzeń w ${networks.length} przeskanowanych sieciach lokalnych.`,
    scanned_networks: networks.map((n) => ({ iface: n.iface, cidr: n.cidr })),
    devices
  });
  process.exit(0);
} catch (err) {
  out({ ok: false, error: String(err && err.message ? err.message : err) });
  process.exit(0);
}
