#!/usr/bin/env node
// proc://taskand.dev/registry/serve/v1 — serwuje katalog i pliki procesów rejestru
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = {
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.yaml': 'text/yaml',
  '.md': 'text/markdown'
};

function loadCatalog() {
  const p = existsSync('proc-catalog.json') ? 'proc-catalog.json' : 'package/proc-catalog.json';
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch (e) {
      return { version: 1, bindings: [] };
    }
  }
  return { version: 1, bindings: [] };
}

// Jeśli uruchomiony z flagą --serve [port] -> działa jako serwer HTTP
if (process.argv.includes('--serve')) {
  const portIdx = process.argv.indexOf('--serve') + 1;
  const port = parseInt(process.argv[portIdx] || '8095', 10);
  const catalog = loadCatalog();

  const server = createServer((req, res) => {
    // CORS headers dla federacji
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // 1. DISCOVERY: /.well-known/catalog.json
    if (req.url === '/.well-known/catalog.json') {
      const processes = (catalog.bindings || []).map(b => ({
        uri: b.uri,
        hash: b.binSha256 || 'unknown',
        runtimes: ['node>=20']
      }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        registry: 'taskand.dev',
        standard: 'taskand-v1.0-federation',
        count: processes.length,
        processes
      }, null, 2));
    }

    // 2. PEŁNY KATALOG: /proc-catalog.json
    if (req.url === '/proc-catalog.json') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(catalog, null, 2));
    }

    // 3. PULL: pliki procesów
    const m = req.url.match(/^\/packages\/([^/]+)\/proc\/(.+)$/) || req.url.match(/^\/proc\/(.+)$/);
    if (m && req.method === 'GET') {
      const filePath = m[2] ? join('packages', m[1], 'proc', m[2]) : join('proc', m[1]);
      if (existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'text/plain' });
        return res.end(readFileSync(filePath));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'file not found', path: filePath }));
    }

    // 4. HEALTH CHECK
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', processes: catalog.bindings?.length || 0 }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'routes: /.well-known/catalog.json, /proc-catalog.json, /proc/..., /healthz' }));
  });

  server.listen(port, () => {
    console.log(`registry-serve: nasłuch na porcie ${port} · procesów: ${catalog.bindings?.length || 0}`);
  });
} else {
  // Tryb fail-closed IPC przez stdin/stdout
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

  const action = input.action || 'catalog';
  const catalog = loadCatalog();

  if (action === 'catalog' || action === 'discover') {
    const processes = (catalog.bindings || []).map(b => ({
      uri: b.uri,
      hash: b.binSha256 || 'unknown',
      runtimes: ['node>=20']
    }));
    process.stdout.write(JSON.stringify({
      ok: true,
      uri: "proc://taskand.dev/registry/serve/v1",
      registry: "taskand.dev",
      count: processes.length,
      processes
    }, null, 2) + '\n');
    process.exit(0);
  } else if (action === 'health') {
    process.stdout.write(JSON.stringify({
      ok: true,
      status: "healthy",
      processes: catalog.bindings?.length || 0
    }, null, 2) + '\n');
    process.exit(0);
  } else {
    process.stderr.write(`kontrakt fail: nieznana akcja '${action}'\n`);
    process.exit(2);
  }
}
