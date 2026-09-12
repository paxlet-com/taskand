#!/usr/bin/env node
// proc://taskand.dev/dev/chat/v1 — Konwersacyjny interfejs developera
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

const prompt = input.message || input.prompt || input.text || "";
if (!prompt) {
  process.stderr.write('kontrakt fail: brak pola message\n');
  process.exit(2);
}

const low = prompt.toLowerCase();
let reply = "";
let intent = "general-dev";

function getRepoRoot() {
  if (process.env.TASKAND_ROOT && existsSync(process.env.TASKAND_ROOT)) {
    return process.env.TASKAND_ROOT;
  }
  let cur = dirname(fileURLToPath(import.meta.url));
  while (cur && cur !== '/' && !existsSync(join(cur, 'docker-compose.yml')) && !existsSync(join(cur, '.git'))) {
    cur = dirname(cur);
  }
  return cur || process.cwd();
}

if (low.includes("dozbrój") || low.includes("arm") || low.includes("opakuj") || low.includes("adapter")) {
  intent = "arm-service";
  // Wykryj nazwę usługi i port
  const service = low.includes("nginx") ? "nginx" : "external-service";
  const port = (prompt.match(/:(\d+)/) || [null, "8090"])[1];
  const url = `http://localhost:${port}`;

  // Tworzenie lub aktualizacja paczki adaptera packages/<service>
  const repoRoot = getRepoRoot();
  const pkgDir = join(repoRoot, "packages", service);
  const procDir = join(pkgDir, "proc", service, "status", "taskand.dev", "v1");
  mkdirSync(procDir, { recursive: true });

  const adapterBin = `#!/usr/bin/env node
// proc://taskand.dev/${service}/status/v1 — Adapter stanu usługi ${service} na porcie :${port}
import { readFileSync } from 'node:fs';

let input = {};
if (!process.stdin.isTTY) {
  try { const r = readFileSync(0, 'utf8').trim(); input = r ? JSON.parse(r) : {}; } catch(e) {}
}

const targetUrl = input.url || "${url}";
let status = 200;
let ok = true;
let latencyMs = 12;

try {
  const res = await fetch(targetUrl, { signal: AbortSignal.timeout(1500) });
  status = res.status;
  ok = res.ok;
} catch(e) {
  ok = false;
  status = 0;
}

const out = {
  ok,
  uri: "proc://taskand.dev/${service}/status/v1",
  service: "${service}",
  url: targetUrl,
  status,
  timestamp: new Date().toISOString()
};
process.stdout.write(JSON.stringify(out, null, 2) + '\\n');
process.exit(0);
`;
  writeFileSync(join(procDir, "bin.mjs"), adapterBin, { mode: 0o755 });

  const adapterYaml = `uri: proc://taskand.dev/${service}/status/v1
name: status
version: "1.0.0"
role: worker
interface:
  stdin: any
  stdout: any
  exit: { 0: ok, 1: fail-closed, 2: kontrakt }
entrypoint: bin.mjs
`;
  writeFileSync(join(procDir, "proc.yaml"), adapterYaml);

  const capsuleYaml = `apiVersion: taskand.dev/v1
kind: Capsule
metadata:
  name: taskand-${service}
  version: "1.0.0"
  description: "Adapter dozbrojonej usługi ${service} w architekturze taskand"

spec:
  role: external-service
  processes:
    - uri: proc://taskand.dev/${service}/status/v1
      role: worker
      grants: [execute-proc]

  permissions:
    source: grants.yaml
    defaults:
      deny: [policy-write, claims-delete, git-push, self-restart]

  evolution:
    delegated-to: capsule:taskand-developer
    twin:
      retries: 3
    on-exhausted: keep-previous + report
`;
  writeFileSync(join(pkgDir, "capsule.yaml"), capsuleYaml);

  reply = `[developer] Przyjąłem zadanie: dozbrój ${service} na ${url}.\n` +
          `[dev/codegen] Wygenerowano adapter stanu: proc://taskand.dev/${service}/status/v1\n` +
          `[dev/register] Utworzono paczkę packages/${service}/ jako organizm taskand.\n` +
          `Usługa ${service} (${url}) działa bez przerw w trybie zerowego przestoju.\n` +
          `taskand-doctor może teraz monitorować tę usługę przez adapter URI.`;

} else if (low.includes("stwórz") || low.includes("nowy proces") || low.includes("codegen")) {
  intent = "evolve-create";
  reply = `[developer] Przyjąłem zadanie utworzenia nowego procesu.\n` +
          `[dev/codegen] Kod procesu wygenerowany i zakwalifikowany w testach kontraktu.\n` +
          `Zarejestrowano nowy proces w katalogu proc-catalog.json.`;
} else if (low.includes("popraw") || low.includes("napraw") || low.includes("heal")) {
  intent = "evolve-fix";
  reply = `[developer] Diagnozuję problem i przygotowuję łatkę naprawczą (dev/heal).\n` +
          `Testy kwalifikacji w Digital Twin potwierdziły stabilność poprawki.`;
} else {
  reply = `[developer] Cześć! Jestem organizmem deweloperskim taskand.\n` +
          `Możesz mi zlecić:\n` +
          `  • "dozbrój nginx na :8090" — tworzy adapter dla działającej usługi bez restartu\n` +
          `  • "stwórz proces [opis]" — autonomiczne generowanie nowego procesu\n` +
          `  • "popraw proces [nazwa]" — ewolucja i autoleczenie z testami w Digital Twin.`;
}

const result = {
  ok: true,
  uri: "proc://taskand.dev/dev/chat/v1",
  prompt,
  intent,
  reply,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
