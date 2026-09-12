#!/usr/bin/env node
import { readFileSync } from "node:fs";

let input = {};
try {
  const raw = readFileSync(0, "utf8").trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

// BUG 9 CHECK: Plaintext secret token in params is forbidden!
if (input.params && input.params.token && !input.credentialRef) {
  process.stderr.write("BŁĄD BEZPIECZEŃSTWA: Plaintext token w params jest zabroniony. Użyj credentialRef: vault://...\n");
  process.exit(1);
}

// Resolve data from dependencies if chained (BUG 3: Data Flow)
let cpuVal = 0;
if (input.dependencies) {
  for (const depKey of Object.keys(input.dependencies)) {
    const depData = input.dependencies[depKey];
    if (depData && typeof depData.cpu_pct === "number") {
      cpuVal = depData.cpu_pct;
      break;
    }
  }
}
if (cpuVal === 0) {
  if (typeof input.cpu_pct === "number") cpuVal = input.cpu_pct;
  else if (typeof input.value === "number") cpuVal = input.value;
}

const threshold = (input.params && input.params.threshold) || input.threshold || 80.0;
const chatId = (input.params && input.params.chat_id) || input.chat_id || "@taskand_alerts";
const credRef = input.credentialRef || (input.params && input.params.credentialRef) || "vault://telegram/token";

const isOver = cpuVal >= threshold;
const alertMsg = isOver
  ? `🚨 [ALERT] Przekroczono próg obciążenia CPU: ${cpuVal}% >= ${threshold}% na węźle ${input.device || "localhost"}`
  : `ℹ️ [INFO] Obciążenie CPU w normie: ${cpuVal}% < ${threshold}%`;

const result = {
  ok: true,
  channel: "telegram",
  recipient: chatId,
  credentialRef: credRef,
  metric: "cpu_pct",
  value: cpuVal,
  threshold: threshold,
  triggered: isOver,
  status: isOver ? "ALERT_DISPATCHED" : "THRESHOLD_NOT_EXCEEDED",
  message: alertMsg,
  rate_limit: "max 1 alert / 5 min",
  ts: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result) + "\n");
process.exit(0);
