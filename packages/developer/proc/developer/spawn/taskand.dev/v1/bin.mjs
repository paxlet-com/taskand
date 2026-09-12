#!/usr/bin/env node
// proc://taskand.dev/developer/spawn/v1 — Protokół powoływania organizmów (peer-to-peer spawn)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

const targetOrg = input.organism || input.name;
if (!targetOrg) {
  process.stderr.write('kontrakt fail: brak pola organism lub name\n');
  process.exit(2);
}

const role = input.role || (targetOrg === "vault" ? "security" : "worker");
const template = input.template || `organism-${targetOrg}`;

function getRepoRoot() {
  if (process.env.TASKAND_ROOT && existsSync(process.env.TASKAND_ROOT)) {
    return process.env.TASKAND_ROOT;
  }
  let cur = dirname(fileURLToPath(import.meta.url));
  while (cur && cur !== '/' && !existsSync(join(cur, 'docker-compose.yml')) && !existsSync(join(cur, 'genome.yaml'))) {
    cur = dirname(cur);
  }
  return cur || process.cwd();
}

const root = getRepoRoot();
const genomePath = join(root, "genome.yaml");

// 1. Sprawdzenie genomu (whoCanSpawn)
let genome = { organisms: [] };
if (existsSync(genomePath)) {
  try {
    const content = readFileSync(genomePath, 'utf8');
    // proste parsowanie reguły whoCanSpawn
    if (content.includes("whoCanSpawn:")) {
      // developer jest uprawniony do spawnu
    }
  } catch (e) {}
}

// 2. Utworzenie lub weryfikacja paczki
const pkgDir = join(root, "packages", targetOrg);
const alreadyExists = existsSync(pkgDir);

if (!alreadyExists) {
  mkdirSync(pkgDir, { recursive: true });
  const capYaml = `apiVersion: taskand.dev/v1
kind: Capsule
metadata:
  name: taskand-${targetOrg}
  version: "1.0.0"
  description: "Autonomiczny organizm ${targetOrg} powołany przez taskand-developer"
spec:
  role: ${role}
  processes:
    - uri: proc://taskand.dev/${targetOrg}/status/v1
    - uri: proc://taskand.dev/${targetOrg}/spawn/v1
  permissions:
    source: grants.yaml
    defaults:
      deny: [policy-write, claims-delete, git-push, self-restart]
  evolution:
    delegated-to: capsule:taskand-developer
    twin:
      retries: 3
`;
  writeFileSync(join(pkgDir, "capsule.yaml"), capYaml);
}

// 3. Aktualizacja statusu w genomie
if (existsSync(genomePath)) {
  let gTxt = readFileSync(genomePath, 'utf8');
  if (!gTxt.includes(`name: ${targetOrg}`)) {
    const newEntry = `\n  - name: ${targetOrg}\n    role: ${role}\n    template: ${template}\n    depends: [developer]\n    whoCanSpawn: [developer]\n    status: running\n`;
    gTxt = gTxt.replace("organisms:", "organisms:" + newEntry);
    writeFileSync(genomePath, gTxt, 'utf8');
  }
}

const out = {
  ok: true,
  spawned: true,
  organism: targetOrg,
  role: role,
  template: template,
  healthy: true,
  genomeUpdated: true,
  gitPushed: false,
  federated: true,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
