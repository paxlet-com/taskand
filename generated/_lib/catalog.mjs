// taskand v2.2 — proc-catalog.json: bindingHash, rejestracja, rozwiązywanie URI
// Użycie CLI: node generated/_lib/catalog.mjs rehash
import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, uriToPath } from './proc.mjs';

export const CATALOG_PATH = join(ROOT, 'proc-catalog.json');
const GENOME_PATH = join(ROOT, 'genome.yaml');

export function loadCatalog() {
  try {
    return JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  } catch {
    return { version: '2.2.0', processes: [] };
  }
}

function saveCatalog(cat) {
  cat.updated = new Date().toISOString();
  writeFileSync(CATALOG_PATH, JSON.stringify(cat, null, 2) + '\n');
}

// Hash obejmuje wszystkie moduły procesu (bin.mjs + moduły siostrzane), bez test.mjs.
// Ten sam algorytm implementuje gateway/utils.py:proc_hash.
export function procHash(binPath) {
  const dir = dirname(binPath);
  const h = createHash('sha256');
  const modules = readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'test.mjs').sort();
  for (const name of modules) {
    h.update(name + '\0');
    h.update(readFileSync(join(dir, name)));
    h.update('\0');
  }
  return 'sha256:' + h.digest('hex');
}

// Zwraca ścieżkę bin.mjs tylko dla aktywnego wpisu z poprawnym hashem
export function resolveUri(uri, cat = loadCatalog()) {
  const entry = (cat.processes || []).find(p => p.uri === uri);
  if (!entry) return { ok: false, error: `URI nieznany w proc-catalog.json: ${uri}` };
  const bin = join(ROOT, entry.path);
  if (!existsSync(bin)) return { ok: false, error: `Brak pliku procesu: ${entry.path}` };
  if (entry.bindingHash && procHash(bin) !== entry.bindingHash) {
    return { ok: false, error: `Naruszenie integralności bindingHash: ${entry.path}` };
  }
  return { ok: true, bin, entry };
}

export function register({ uri, desc, kind = 'task', organism, origin }) {
  const bin = uriToPath(uri);
  const cat = loadCatalog();
  cat.processes = (cat.processes || []).filter(p => p.uri !== uri);
  cat.processes.push({
    uri,
    path: relative(ROOT, bin),
    kind,
    status: 'active',
    desc,
    release: '1.0.0',
    created: new Date().toISOString(),
    bindingHash: procHash(bin),
    ...(origin ? { origin } : {})
  });
  saveCatalog(cat);
  if (organism) addToGenome(organism, uri, desc);
  return cat.processes.at(-1);
}

function addToGenome(organism, uri, desc) {
  if (!existsSync(GENOME_PATH)) return;
  const text = readFileSync(GENOME_PATH, 'utf8');
  if (text.includes(uri)) return;
  const line = `      - { uri: ${uri}, desc: ${JSON.stringify(desc)} }\n`;
  const header = `  - name: ${organism}\n    processes:\n`;
  const idx = text.indexOf(header);
  if (idx < 0) {
    appendFileSync(GENOME_PATH, `\n${header}${line}`);
    return;
  }
  // Dopisz na końcu bloku procesów organizmu (przed pustą linią / kolejnym organizmem)
  const rest = text.slice(idx + header.length);
  const blockEnd = rest.search(/^(?!      - )/m);
  const at = idx + header.length + (blockEnd < 0 ? rest.length : blockEnd);
  writeFileSync(GENOME_PATH, text.slice(0, at) + line + text.slice(at));
}

export function rehashAll() {
  const cat = loadCatalog();
  const changed = [];
  for (const p of cat.processes || []) {
    const bin = join(ROOT, p.path);
    if (!existsSync(bin)) continue;
    const h = procHash(bin);
    if (h !== p.bindingHash) {
      p.bindingHash = h;
      changed.push(p.uri);
    }
  }
  saveCatalog(cat);
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'rehash') {
  const changed = rehashAll();
  console.log(`bindingHash zaktualizowany dla ${changed.length} procesów`);
  changed.forEach(u => console.log(`  ${u}`));
}
