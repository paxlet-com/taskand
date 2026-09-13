// Cykl życia wpisu: register (candidate|active wg polityki) → approve → deprecate; verify i scan
import { readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, GEN, parseUri, organisms, allEntries, findEntry, updateRegistry, policy, addToGenome, audit } from './store.mjs';
import { packageFiles, packageHash, readManifest, checkPackage } from './package.mjs';

// builtin → active; evolved → wg policy.evolution (auto|manual); peer:* → wg policy.peers (domyślnie manual)
function initialStatus(origin) {
  if (origin.startsWith('peer:')) return policy('peers', 'manual') === 'auto' ? 'active' : 'candidate';
  if (origin === 'evolved') return policy('evolution', 'manual') === 'auto' ? 'active' : 'candidate';
  return 'active';
}

export function register({ uri, origin, hold = false }) {
  const loc = parseUri(uri);
  if (!loc) return { ok: false, error: `Niepoprawny URI: ${uri}` };
  const errors = checkPackage(loc.dir, uri);
  if (errors.length) return { ok: false, error: `Pakiet niezgodny ze standardem: ${errors.join('; ')}` };
  const existing = findEntry(uri);
  const hash = packageHash(loc.dir);
  if (existing && existing.hash !== hash) {
    return { ok: false, error: `${uri} jest już zarejestrowany z innym hashem — wersje są niezmienne, utwórz nową wersję` };
  }
  if (existing) return { ok: true, entry: existing, unchanged: true };
  const m = readManifest(loc.dir);
  const src = origin || m.origin || 'builtin';
  const entry = {
    uri,
    organism: loc.organism,
    path: relative(ROOT, loc.dir),
    desc: m.desc || '',
    capability: m.capability || m.desc || '',
    kind: m.kind || 'task',
    origin: src,
    env: m.env || [],
    credentials: m.credentials || [],
    files: packageFiles(loc.dir),
    hash,
    status: hold ? 'candidate' : initialStatus(src),
    registered: new Date().toISOString()
  };
  updateRegistry(loc.organism, reg => {
    reg.processes[uri] = entry;
  });
  if (entry.status === 'active') addToGenome(loc.organism, uri, entry.desc);
  audit('registry.register', uri, { origin: src, status: entry.status, hash });
  return { ok: true, entry };
}

function setStatus(uri, from, to) {
  const loc = parseUri(uri);
  const entry = findEntry(uri);
  if (!entry) return { ok: false, error: `URI nieznany: ${uri}` };
  if (!from.includes(entry.status)) return { ok: false, error: `Status ${entry.status} → ${to} niedozwolony` };
  if (to === 'active' && packageHash(loc.dir) !== entry.hash) return { ok: false, error: `Pakiet zmieniony od rejestracji: ${uri}` };
  const updated = updateRegistry(loc.organism, reg => {
    Object.assign(reg.processes[uri], { status: to, [`${to}At`]: new Date().toISOString() });
    return reg.processes[uri];
  });
  if (to === 'active') addToGenome(loc.organism, uri, updated.desc);
  audit(`registry.${to}`, uri, {});
  return { ok: true, entry: updated };
}

// Pakiety wbudowane (origin: builtin) zmienia deweloper w git — przelicz hash; evolved/peer pozostają niezmienne
export function refresh({ uri } = {}) {
  const targets = uri ? [findEntry(uri)].filter(Boolean) : allEntries().filter(e => e.origin === 'builtin');
  const refreshed = [];
  const errors = [];
  for (const entry of targets) {
    const loc = parseUri(entry.uri);
    if (entry.origin !== 'builtin') {
      errors.push(`${entry.uri}: origin ${entry.origin} — wersje niezmienne, utwórz nową wersję`);
      continue;
    }
    const problems = checkPackage(loc.dir, entry.uri);
    if (problems.length) {
      errors.push(`${entry.uri}: ${problems.join('; ')}`);
      continue;
    }
    const hash = packageHash(loc.dir);
    if (hash === entry.hash) continue;
    const m = readManifest(loc.dir);
    updateRegistry(loc.organism, reg => {
      Object.assign(reg.processes[entry.uri], { hash, files: packageFiles(loc.dir), desc: m.desc || '', capability: m.capability || m.desc || '', kind: m.kind || 'task', env: m.env || [], credentials: m.credentials || [], refreshedAt: new Date().toISOString() });
    });
    audit('registry.refresh', entry.uri, { hash });
    refreshed.push(entry.uri);
  }
  return { ok: errors.length === 0, refreshed, errors };
}

// approve z deprecated = rollback do wcześniejszej wersji
export const approve = ({ uri }) => setStatus(uri, ['candidate', 'deprecated'], 'active');
export const deprecate = ({ uri }) => setStatus(uri, ['active', 'candidate'], 'deprecated');

export function list({ organism, status } = {}) {
  const processes = allEntries().filter(e => (!organism || e.organism === organism) && (!status || e.status === status));
  return { ok: true, total: processes.length, processes };
}

export function verify() {
  const broken = allEntries()
    .filter(e => e.status === 'active')
    .filter(e => !existsSync(join(ROOT, e.path)) || packageHash(join(ROOT, e.path)) !== e.hash)
    .map(e => e.uri);
  return { ok: broken.length === 0, checked: allEntries().length, broken };
}

// Pakiety na dysku bez wpisu w rejestrze; {adopt:true} rejestruje je (origin z proc.yaml)
export function scan({ adopt = false } = {}) {
  const found = organisms().flatMap(org =>
    readdirSync(join(GEN, org), { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(cap => {
      const base = join(GEN, org, cap.name, 'taskand.dev');
      return existsSync(base) ? readdirSync(base).map(v => `proc://taskand.dev/${org}/${cap.name}/${v}`) : [];
    })
  );
  const unregistered = found.filter(uri => !findEntry(uri));
  const results = adopt ? unregistered.map(uri => ({ uri, ...register({ uri }) })) : [];
  return { ok: results.every(r => r.ok), packages: found.length, unregistered, results };
}
