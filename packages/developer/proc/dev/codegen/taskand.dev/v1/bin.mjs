#!/usr/bin/env node
// proc://taskand.dev/dev/codegen/v1 — Generator kodu i rejestrator procesów w registry developera
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

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

const name = input.name || 'summarize';
const desc = input.description || 'autonomiczny proces wygenerowany przez LLM';
const org = input.org || 'taskand.dev';
const ver = input.version || 'v1';
const uri = `proc://${org}/developer/${name}/${ver}`;

// 1. Ścieżka docelowa w rejestrze developera: proc/developer/<name>/<org>/<ver>/
const relPath = `proc/developer/${name}/${org}/${ver}`;
const targetDir = join(process.cwd(), relPath);
mkdirSync(targetDir, { recursive: true });

// 2. Generuj bin.mjs (fail-closed, JSON stdin -> JSON stdout)
const binCode = `#!/usr/bin/env node
// ${uri} — ${desc}
import { readFileSync } from 'node:fs';

let input;
if (!process.stdin.isTTY) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    input = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.stderr.write('kontrakt fail: niepoprawny JSON\\n');
    process.exit(2);
  }
} else {
  input = {};
}

const text = input.text || input.data || input.query || '';
const sentences = text ? text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean).slice(0, 5) : [];

const output = {
  ok: true,
  uri: "${uri}",
  sentences,
  count: sentences.length,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(output, null, 2) + '\\n');
process.exit(0);
`;
writeFileSync(join(targetDir, 'bin.mjs'), binCode, { mode: 0o755 });

// 3. Generuj proc.yaml
const procYaml = `uri: ${uri}
name: ${name}
version: "${ver}"
role: worker
interface:
  stdin: any
  stdout: any
  exit: { 0: ok, 1: fail-closed, 2: kontrakt }
entrypoint: bin.mjs
runtimes:
  - kind: node
    bin: bin.mjs
    engines: ">=20"
grants: { run: [execute-proc] }
`;
writeFileSync(join(targetDir, 'proc.yaml'), procYaml);

// 4. Generuj test.mjs
const testCode = `import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: 'invalid' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2');
  process.exit(1);
}

const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{"text":"Zdanie pierwsze. Zdanie drugie."}' });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0');
  process.exit(1);
}
console.log('${uri}: kontrakt ✓');
`;
writeFileSync(join(targetDir, 'test.mjs'), testCode);

// 5. Testuj przed rejestracją
const testRun = spawnSync('node', [join(targetDir, 'test.mjs')], { stdio: 'pipe' });
if (testRun.status !== 0) {
  process.stderr.write(`Błąd: test kontraktu ${uri} nie przeszedł: ${testRun.stderr}\n`);
  process.exit(1);
}

// 6. Zarejestruj w proc-catalog.json
const binSha256 = createHash('sha256').update(readFileSync(join(targetDir, 'bin.mjs'))).digest('hex');
const yamlSha256 = createHash('sha256').update(readFileSync(join(targetDir, 'proc.yaml'))).digest('hex');
const testSha256 = createHash('sha256').update(readFileSync(join(targetDir, 'test.mjs'))).digest('hex');

const catFile = join(process.cwd(), 'proc-catalog.json');
let cat = { version: 1, standard: 'taskand-v1.0', bindings: [] };
if (existsSync(catFile)) {
  try { cat = JSON.parse(readFileSync(catFile, 'utf8')); } catch (e) {}
}

cat.bindings = cat.bindings.filter(b => b.uri !== uri);
cat.bindings.push({
  uri,
  path: relPath,
  binSha256,
  yamlSha256,
  testSha256
});
writeFileSync(catFile, JSON.stringify(cat, null, 2) + '\n');

// 7. Zwróć potwierdzenie rejestracji
const response = {
  ok: true,
  uri: "proc://taskand.dev/dev/codegen/v1",
  registeredUri: uri,
  path: relPath,
  binSha256,
  verified: true,
  registry: "registry://taskand.dev/developer"
};

process.stdout.write(JSON.stringify(response, null, 2) + '\n');
process.exit(0);
