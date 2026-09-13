#!/usr/bin/env node
// proc://taskand.dev/cluster/monitor/v1 — stan siatki węzłów: dla każdego peera z genome sonda /healthz i katalog,
// findings PEER_DOWN / PEER_DEGRADED / PEER_NEW_PACKAGES; z {"pull": true} pobiera brakujące pakiety jako candidate.
// in: { pull?: bool, token? }  out: { ok, peers[], findings[], summary }
import { readFileSync } from 'node:fs';
import { registry } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

// AbortSignal.timeout nie podtrzymuje pętli zdarzeń
setInterval(() => {}, 60000);

const peers = registry('peers').peers || [];
const local = new Set((registry('list', { status: 'active' }).processes || []).map(p => p.uri));
const findings = [];
const report = [];

async function fetchJson(url, ms = 3000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function checkPeer(peer) {
  const base = peer.replace(/\/$/, '');
  let health;
  try {
    health = await fetchJson(`${base}/healthz`);
  } catch (err) {
    findings.push({ code: 'PEER_DOWN', severity: 'error', subject: peer, detail: `Węzeł nie odpowiada: ${err.message}` });
    report.push({ peer, up: false, error: err.message });
    return;
  }
  if (!health.ok) findings.push({ code: 'PEER_DEGRADED', severity: 'warning', subject: peer, detail: `Węzeł zgłasza ok:false (procesy: ${health.processes})` });

  let missing = [];
  try {
    const cat = await fetchJson(`${base}/.well-known/catalog.json`);
    missing = (cat.processes || []).filter(p => !local.has(p.uri)).map(p => p.uri);
  } catch {}
  if (missing.length) findings.push({ code: 'PEER_NEW_PACKAGES', severity: 'info', subject: peer, detail: `${missing.length} pakietów spoza tego węzła`, uris: missing });

  const entry = { peer, up: true, node: health.node || null, version: health.version, processes: health.processes, missing };
  if (input.pull && missing.length) {
    const pulled = registry('pull', { peer: base, token: input.token, uris: missing });
    entry.pulled = pulled.imported || 0;
  }
  report.push(entry);
}

if (peers.length === 0) {
  process.stdout.write(JSON.stringify({ ok: true, peers: [], findings: [], summary: 'Brak zdefiniowanych peerów (genome.yaml: peers)' }) + '\n');
  process.exit(0);
}

await Promise.all(peers.map(checkPeer));
const down = findings.filter(f => f.code === 'PEER_DOWN').length;
const up = report.filter(r => r.up).length;
process.stdout.write(JSON.stringify({
  ok: true,
  peers: report,
  findings,
  summary: `Węzły: ${up}/${peers.length} aktywnych${down ? `, ${down} nie odpowiada` : ''}`,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
