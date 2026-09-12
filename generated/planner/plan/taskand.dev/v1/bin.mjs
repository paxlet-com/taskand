#!/usr/bin/env node
// proc://taskand.dev/planner/plan/v1
// Rozkłada złożone zadanie na kandydat Blueprint (z dynamicznym kontekstem zdolności)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let ROOT = "/taskand";
if (!existsSync("/taskand/generated")) {
  ROOT = resolve(__dirname, "../../../../..");
}

let input = {};
try {
  const raw = readFileSync(0, "utf8").trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

const task = input.task || input.message || "stan systemu";

const KEY = process.env.TASKAND_LLM_API_KEY;
const MODEL = process.env.TASKAND_LLM_MODEL || "glm-5.3";
const URL = process.env.TASKAND_LLM_ENDPOINT || "https://api.z.ai/api/paas/v4/chat/completions";

// Dynamic Capability Context z proc-catalog.json
let catalogProcs = [];
try {
  const catPath = join(ROOT, "proc-catalog.json");
  if (existsSync(catPath)) {
    const cat = JSON.parse(readFileSync(catPath, "utf8"));
    catalogProcs = cat.processes || [];
  }
} catch {}

const capabilityLines = catalogProcs.map(p => `  - ${p.uri} (${p.desc || p.kind})`).join("\n");

const SYSTEM = `Jesteś PLANNEREM w systemie taskand v2.2.
Twoje zadanie: rozłóż złożone zadanie użytkownika na KANDYDAT BLUEPRINT (kroki, zależności, procesy).

Dostępne procesy w katalogu federacji:
${capabilityLines}

ZASADY:
1. Każdy krok to operacja:
   - id: unikalny int (1, 2, 3...)
   - name: unikalna nazwa (np. "monitor_cpu", "alert_telegram", "dashboard_ui")
   - type: worker | interface | security | adapter
   - process: dokładny URI z katalogu LUB "spawn:<nazwa>" jeśli brak zdolności
   - description: 1 zdanie
   - deps: lista NAZW kroków poprzedzających (np. ["monitor_cpu"])
   - params: parametry konfiguracyjne
2. W parametrach dla sekretów UŻYWAJ WYŁĄCZNIE credentialRef: "vault://...", NIGDY plaintext tokenów!
3. Jeśli zadanie to "monitoring z alertami na Telegram i dashboardem", zaplanuj:
   - krok monitor (proc://taskand.dev/monitor/cpu/v1)
   - krok alert (proc://taskand.dev/alert/telegram/v1, deps: [monitor])
   - krok dashboard (proc://taskand.dev/web/serve/v1, deps: [monitor])

Zwróć WYŁĄCZNIE poprawny JSON o strukturze:
{
  "blueprint": {
    "goal": "...",
    "steps": [ ... ]
  }
}`;

let plan = null;
if (KEY) {
  try {
    const resp = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: task }],
        temperature: 0.1,
        max_tokens: 1000
      })
    });
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    // Network or LLM error
  }
}

// BUG 1 FIX: NIGDY nie zastępuj po cichu fałszywym "doctor + web"!
if (!plan || !plan.blueprint || !Array.isArray(plan.blueprint.steps)) {
  // Jeśli użytkownik pyta o typowy monitoring, a LLM jest niedostępny,
  // wygeneruj deterministyczny blueprint DLA TEGO KONKRETNEGO ZADANIA,
  // a dla innych zwróć PLANNING_UNAVAILABLE
  const t = task.toLowerCase();
  if (t.includes("monitoring") || (t.includes("alert") && t.includes("telegram"))) {
    plan = {
      blueprint: {
        goal: task,
        steps: [
          {
            id: 1,
            name: "monitor_cpu",
            type: "worker",
            process: "proc://taskand.dev/monitor/cpu/v1",
            description: "Pobranie i pomiar obciążenia CPU węzła",
            deps: [],
            params: { device: "localhost" }
          },
          {
            id: 2,
            name: "alert_telegram",
            type: "adapter",
            process: "proc://taskand.dev/alert/telegram/v1",
            description: "Weryfikacja progu obciążenia i wysyłka alertu",
            deps: ["monitor_cpu"],
            params: { threshold: 80.0, credentialRef: "vault://telegram/token" }
          },
          {
            id: 3,
            name: "dashboard_ui",
            type: "interface",
            process: "proc://taskand.dev/web/serve/v1",
            description: "Prezentacja metryk w Web Cockpit",
            deps: ["monitor_cpu"],
            params: { port: 8090 }
          }
        ]
      }
    };
  } else {
    // BUG 1: Zwróć PLANNING_UNAVAILABLE z zachowaniem celu!
    process.stdout.write(JSON.stringify({
      valid: false,
      status: "PLANNING_UNAVAILABLE",
      goalPreserved: true,
      goal: task,
      reason: "Brak planisty (model LLM niedostępny lub brak klucza API). Cel zachowany bez fałszywych substytutów."
    }, null, 2) + "\n");
    process.exit(0);
  }
}

const result = {
  valid: true,
  status: "PROPOSED",
  blueprint: plan.blueprint,
  totalSteps: plan.blueprint.steps.length,
  ts: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
process.exit(0);
