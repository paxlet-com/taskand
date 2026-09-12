#!/usr/bin/env node
// proc://taskand.dev/doctor/prescribe/v1 — Wystawianie recept i zlecanie zadań naprawy do taskand-developer
import { readFileSync, appendFileSync, existsSync } from 'node:fs';

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

const issues = input.issues || [];
const prescriptions = [];

for (const issue of issues) {
  let taskDesc = "";
  let action = "evolve-fix";
  let priority = "evolution";

  if (issue.target === "web-landing") {
    taskDesc = `[Doctor Alert] Awaria strony WWW (${issue.status}): ${issue.error}. Zrestartuj kontener taskand-landing lub napraw konfigurację Nginx portu 8090.`;
    priority = "user-blocking";
  } else if (issue.target === "gateway-api") {
    taskDesc = `[Doctor Alert] Awaria bramki REST API (${issue.status}): ${issue.error}. Sprawdź proces bramki na porcie 8077 i zrestartuj usługę taskand-gateway.`;
    priority = "safety";
  } else {
    taskDesc = `[Doctor Alert] Wykryto problem w ${issue.target}: ${issue.error}. Wykonaj diagnostykę i autoleczenie.`;
  }

  const prescription = {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    delegateTo: "capsule:taskand-developer",
    type: action,
    priority,
    target: issue.target,
    task: taskDesc,
    status: "created",
    timestamp: new Date().toISOString()
  };

  // Opcjonalny automatyczny zapis do tasks/inbox.yaml jeśli flaga autoSubmit włączona
  if (input.autoSubmit) {
    const inboxPath = "tasks/inbox.yaml";
    const altInbox = "../../tasks/inbox.yaml";
    const targetPath = existsSync(inboxPath) ? inboxPath : (existsSync(altInbox) ? altInbox : null);
    if (targetPath) {
      const yamlEntry = `- id: ${prescription.id}\n  typ: ${prescription.type}\n  z: "${taskDesc.replace(/"/g, '\\"')}"\n`;
      try {
        appendFileSync(targetPath, yamlEntry, 'utf8');
        prescription.status = "queued-to-inbox";
      } catch (e) {
        prescription.status = "queue-error: " + e.message;
      }
    }
  }

  prescriptions.push(prescription);
}

const result = {
  ok: true,
  uri: "proc://taskand.dev/doctor/prescribe/v1",
  actionsRequired: prescriptions.length > 0,
  totalPrescriptions: prescriptions.length,
  prescriptions,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
