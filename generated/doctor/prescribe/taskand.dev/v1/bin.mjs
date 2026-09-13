#!/usr/bin/env node
// proc://taskand.dev/doctor/prescribe/v1 — recepty z ustaleń diagnozy (deterministyczne reguły).
// Każda recepta: executor "organism" (remedies: kroki proc:// dla doctor/heal) albo "human" (polecenie + powód).
import { readFileSync } from 'node:fs';
import { call } from './registry-client.mjs';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const REGISTRY = 'proc://taskand.dev/registry/core/v1';
const EVOLVE = 'proc://taskand.dev/dev/evolve/v1';
const MUTABLE_BY_ORGANISMS = origin => origin === 'evolved' || String(origin).startsWith('peer:');
const human = (action, why) => ({ executor: 'human', action, why });
const parseUri = uri => uri.match(/^proc:\/\/taskand\.dev\/([a-z0-9-]+)\/([a-z0-9-]+)\/v\d+$/)?.slice(1);

// Ponowna ewolucja: nowa wersja z opisem awarii; bramka regresji w dev/evolve porównuje ją z wersją zawodzącą
function reEvolve(f, reason) {
  const [organism, name] = parseUri(f.subject) || [];
  return {
    uri: EVOLVE,
    input: { organism, name, supersedes: f.subject, failure: reason, capability: f.capability }
  };
}

const RULES = {
  SERVICE_DOWN: f => human(`docker compose up -d ${f.subject} && docker compose logs --tail 50 ${f.subject}`,
    'Organizmy nie mają dostępu do Dockera (brak gniazda w gateway) — restart usług wykonuje człowiek lub supervisor hosta'),
  REGISTRY_UNAVAILABLE: () => human('ls -la generated/*/registry.json && node generated/registry/core/taskand.dev/v1/bin.mjs <<< \'{"action":"verify"}\'',
    'Bez rejestru żaden organizm nie może wywołać procesu naprawczego'),
  PACKAGE_TAMPERED: f => (MUTABLE_BY_ORGANISMS(f.origin)
    ? { executor: 'organism', why: 'Zmieniony pakiet evolved/peer: kwarantanna (deprecate), potem nowa wersja przez ewolucję', remedies: [
        { uri: REGISTRY, input: { action: 'deprecate', uri: f.subject } },
        reEvolve(f, 'Pakiet został zmieniony po rejestracji i trafił do kwarantanny')
      ] }
    : human(`git diff -- ${f.subject.replace('proc://taskand.dev/', 'generated/').replace(/\/(v\d+)$/, '/taskand.dev/$1')}  # zamierzone: make catalog; niezamierzone: git checkout`,
      'Pakiety builtin są kodem źródłowym w git — samomodyfikacja zabroniona (zasada 8)')),
  PROCESS_FAILING: f => (MUTABLE_BY_ORGANISMS(f.origin)
    ? { executor: 'organism', why: 'Wyewoluowany proces zawodzi — nowa wersja z opisem błędu; stara wycofana dopiero, gdy nowa przejdzie bramkę regresji', remedies: [reEvolve(f, f.lastError || f.detail)] }
    : human(`taskand proc ${f.subject} --json  # odtwórz błąd; poprawka w git, potem make catalog`, 'Proces builtin — naprawa w kodzie źródłowym przez dewelopera')),
  CANDIDATE_PENDING: f => human(`taskand approve ${f.subject}`, `Pakiet ${f.origin} czeka na przegląd kodu (policy w genome.yaml)`),
  VAULT_UNINITIALIZED: () => human('echo "TASKAND_VAULT_KEY=$(openssl rand -hex 32)" >> .env && docker compose restart gateway',
    'Klucz sejfu to sekret — organizmy nie generują ani nie zapisują sekretów'),
  BROWSER_CDP_UNAVAILABLE: () => human('otwórz http://localhost:3010, potem: taskand proc proc://taskand.dev/browser/session/v1',
    'Konfiguracja kontenera vm-browser (infrastruktura) — poza zasięgiem organizmów'),
  // Nowe pakiety na peerze: organizm może je pobrać jako candidate (uruchomienie dopiero po approve)
  PEER_NEW_PACKAGES: f => ({ executor: 'organism', why: `Pobranie ${f.uris?.length || ''} pakietów z ${f.subject} jako candidate`,
    remedies: [{ uri: 'proc://taskand.dev/cluster/monitor/v1', input: { pull: true } }] }),
  PEER_DOWN: f => human(`taskand occupy <user@host>  # albo restart węzła; sprawdzenie: taskand peers`,
    `Węzeł ${f.subject} nie odpowiada — restart/ponowne powołanie wymaga dostępu do hosta (SSH), poza zasięgiem organizmów`),
  PEER_DEGRADED: f => human(`curl ${f.subject}/healthz  # zdiagnozuj zdalny węzeł`, 'Zdalny węzeł zgłasza problem — diagnoza po stronie tamtego hosta'),
  CLUSTER_MONITOR_FAILED: () => human('taskand proc proc://taskand.dev/cluster/monitor/v1', 'Monitor siatki zawiódł — sprawdź genome.yaml: peers')
};

const diag = input.diagnosis || call('proc://taskand.dev/doctor/diagnose/v1', {}, 90000);
if (!Array.isArray(diag.findings)) {
  process.stdout.write(JSON.stringify({ ok: false, error: `Brak diagnozy: ${diag.error}` }) + '\n');
  process.exit(0);
}

const prescriptions = diag.findings.map(f => ({ finding: f, ...(RULES[f.code]?.(f) || human('brak reguły', `Nieznany kod ${f.code}`)) }));
const byOrganism = prescriptions.filter(p => p.executor === 'organism').length;
process.stdout.write(JSON.stringify({
  ok: true,
  healthy: diag.healthy,
  prescriptions,
  summary: prescriptions.length ? `${prescriptions.length} recept: ${byOrganism} dla organizmów, ${prescriptions.length - byOrganism} dla człowieka` : 'Brak recept — system zdrowy',
  recommendations: prescriptions.map(p => `[${p.executor}] ${p.finding.code} ${p.finding.subject}: ${p.action || p.why}`),
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
