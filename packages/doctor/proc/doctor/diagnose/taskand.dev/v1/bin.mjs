#!/usr/bin/env node
// proc://taskand.dev/doctor/diagnose/v1 — Diagnostyka zdrowia usług i stron WWW
import { readFileSync, existsSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON na wejściu\n');
    process.exit(2);
  }
} else {
  input = {};
}

const webUrl = input.webUrl || "http://localhost:8090";
const gatewayUrl = input.gatewayUrl || "http://localhost:8077/health";
const mockResults = input.mockResults;

const issues = [];
const checks = [];

if (mockResults) {
  // Tryb testowy / symulacja
  for (const r of mockResults) {
    checks.push(r);
    if (!r.ok) {
      issues.push({
        target: r.target,
        status: "DOWN",
        error: r.error || "Brak odpowiedzi usługi",
        severity: r.severity || "HIGH"
      });
    }
  }
} else {
  // Sprawdzenie 1: Strona WWW (Landing / Web Cockpit)
  const candidateWebUrls = input.webUrl ? [input.webUrl] : ["http://landing", "http://localhost:8090"];
  let webOk = false;
  let webErr = null;
  let webStatus = 0;
  let usedWebUrl = candidateWebUrls[0];

  for (const u of candidateWebUrls) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(input.timeoutMs || 2500) });
      if (res.ok) {
        webOk = true;
        webStatus = res.status;
        usedWebUrl = u;
        break;
      } else {
        webStatus = res.status;
        webErr = `HTTP ${res.status}`;
      }
    } catch (e) {
      webErr = e.message;
    }
  }

  checks.push({ target: "web-landing", url: usedWebUrl, ok: webOk, status: webStatus });
  if (!webOk) {
    issues.push({
      target: "web-landing",
      status: "DOWN",
      error: `Nie można połączyć się ze stroną WWW (${usedWebUrl}): ${webErr}`,
      severity: "CRITICAL"
    });
  }

  // Sprawdzenie 2: Bramka REST API
  try {
    const res = await fetch(gatewayUrl, { signal: AbortSignal.timeout(input.timeoutMs || 2500) });
    checks.push({ target: "gateway-api", url: gatewayUrl, ok: res.ok, status: res.status });
    if (!res.ok) {
      issues.push({
        target: "gateway-api",
        status: "DEGRADED",
        error: `Bramka API zwróciła kod ${res.status}`,
        severity: "HIGH"
      });
    }
  } catch (e) {
    checks.push({ target: "gateway-api", url: gatewayUrl, ok: false, error: e.message });
    issues.push({
      target: "gateway-api",
      status: "DOWN",
      error: `Bramka API niedostępna (${gatewayUrl}): ${e.message}`,
      severity: "CRITICAL"
    });
  }

  // Sprawdzenie 3: Katalog procesów URI
  const catExists = existsSync("proc-catalog.json") ||
                    existsSync("/taskand/proc-catalog.json") ||
                    existsSync("../../proc-catalog.json") ||
                    existsSync("../../../proc-catalog.json");
  checks.push({ target: "proc-catalog", ok: catExists });
  if (!catExists) {
    issues.push({
      target: "proc-catalog",
      status: "MISSING",
      error: "Brak pliku proc-catalog.json",
      severity: "MEDIUM"
    });
  }
}

const healthy = issues.length === 0;

const result = {
  ok: true,
  uri: "proc://taskand.dev/doctor/diagnose/v1",
  healthy,
  checksTotal: checks.length,
  checksPassed: checks.filter(c => c.ok).length,
  checks,
  issues,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
