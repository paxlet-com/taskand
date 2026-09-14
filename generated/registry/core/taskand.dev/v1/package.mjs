// Pakiet procesu = samodzielny byt: katalog z proc.yaml + bin.mjs (+ moduły siostrzane), hash całości
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// Jednoliniowo: `… from '<spec>'` na końcu linii, `import '<spec>'`, dynamiczny import() i require()
const IMPORT_RE = /(?:^|[\s}])from[ \t]*['"]([^'"\n]+)['"][ \t]*;?[ \t]*$|^[ \t]*import[ \t]*['"]([^'"\n]+)['"]|\bimport\([ \t]*['"]([^'"\n]+)['"]|\brequire\([ \t]*['"]([^'"\n]+)['"]/gm;
const SIBLING_RE = /^\.\/[\w.-]+\.mjs$/;

export function packageFiles(dir) {
  return readdirSync(dir).sort().filter(name => lstatSync(join(dir, name)).isFile());
}

export function packageHash(dir) {
  const h = createHash('sha256');
  for (const name of packageFiles(dir)) {
    h.update(name + '\0');
    h.update(readFileSync(join(dir, name)));
    h.update('\0');
  }
  return 'sha256:' + h.digest('hex');
}

// Manifest proc.yaml — płaski podzbiór YAML: `klucz: wartość` i listy inline `[a, b]`
export function readManifest(dir) {
  const file = join(dir, 'proc.yaml');
  if (!existsSync(file)) return null;
  const manifest = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([a-z][\w-]*):\s*(.*?)\s*$/i);
    if (!m || m[2] === '') continue;
    const raw = m[2];
    manifest[m[1]] = raw.startsWith('[')
      ? raw.slice(1, -1).split(',').map(s => unquote(s.trim())).filter(Boolean)
      : unquote(raw);
  }
  return manifest;
}

const unquote = s => (/^".*"$/.test(s) ? JSON.parse(s) : s.replace(/^'(.*)'$/, '$1'));

// Konformacja pakietu: manifest zgodny z lokalizacją, bin.mjs, tylko importy node:* i ./moduł.mjs
export function checkPackage(dir, uri) {
  const errors = [];
  if (!existsSync(dir)) return [`Brak katalogu pakietu dla ${uri}`];
  const manifest = readManifest(dir);
  if (!manifest) errors.push('Brak proc.yaml');
  else if (manifest.uri !== uri) errors.push(`proc.yaml: uri "${manifest.uri}" ≠ lokalizacja ${uri}`);
  const files = packageFiles(dir);
  if (!files.includes('bin.mjs')) errors.push('Brak bin.mjs');
  if (readdirSync(dir).length !== files.length) errors.push('Pakiet nie może zawierać podkatalogów ani dowiązań');
  for (const name of files.filter(f => f.endsWith('.mjs'))) {
    for (const [, a, b, c, d] of readFileSync(join(dir, name), 'utf8').matchAll(IMPORT_RE)) {
      const spec = a || b || c || d;
      if (!spec.startsWith('node:') && !SIBLING_RE.test(spec)) {
        errors.push(`${name}: import "${spec}" spoza pakietu (dozwolone: node:* i ./moduł.mjs; inne procesy wywołuj przez URI)`);
      }
    }
  }
  return errors;
}
