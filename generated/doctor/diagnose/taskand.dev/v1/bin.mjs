#!/usr/bin/env node
// proc://taskand.dev/doctor/diagnose/v1 — realna diagnoza: sondy HTTP usług + integralność katalogu procesów
import { readInput, emit } from '../../../../_lib/proc.mjs';
import { loadCatalog, resolveUri } from '../../../../_lib/catalog.mjs';

readInput();

// Każda usługa: adresy w sieci compose (gdy w kontenerze) i na hoście
const SERVICES = [
  { name: 'gateway:8077', urls: ['http://localhost:8077/healthz', 'http://gateway:8077/healthz'] },
  { name: 'landing:8090', urls: ['http://localhost:8090/', 'http://landing:80/'] },
  { name: 'vm-browser:3010 (noVNC)', urls: ['http://localhost:3010/', 'http://vm-browser:3000/'] }
];

async function probe(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function checkService({ name, urls }) {
  for (const url of urls) {
    if (await probe(url)) return { name, ok: true, detail: `${name} ✓` };
  }
  return { name, ok: false, detail: `${name} ✗ (brak odpowiedzi)` };
}

function checkCatalog() {
  const cat = loadCatalog();
  const broken = (cat.processes || []).map(p => resolveUri(p.uri, cat)).filter(r => !r.ok);
  const total = (cat.processes || []).length;
  return broken.length
    ? { ok: false, detail: `processes: ${broken.length}/${total} niespójnych ✗ (${broken.map(b => b.error).join('; ')})` }
    : { ok: true, detail: `processes: ${total} w katalogu, bindingHash ✓` };
}

const checks = [...(await Promise.all(SERVICES.map(checkService))), checkCatalog()];
const passed = checks.filter(c => c.ok).length;

emit({
  ok: true,
  healthy: passed === checks.length,
  checks: checks.length,
  passed,
  details: checks.map(c => c.detail),
  ts: new Date().toISOString()
});
