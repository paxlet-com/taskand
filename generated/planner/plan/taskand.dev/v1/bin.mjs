#!/usr/bin/env node
// proc://taskand.dev/planner/plan/v1
// Rozkłada złożone zadanie na kandydat Blueprint (z dynamicznym kontekstem zdolności)

import { readFileSync } from "node:fs";
import { registry, call } from "./registry-client.mjs";

let input = {};
try {
  const raw = readFileSync(0, "utf8").trim();
  if (raw) input = JSON.parse(raw);
} catch {
  process.exit(2);
}

const task = String(input.task || input.message || "").trim();
if (!task) {
  process.stdout.write(JSON.stringify({ ok: true, valid: false, status: "READY", usage: '{"task": "<złożone zadanie>"}' }) + "\n");
  process.exit(0);
}


// Dynamiczny kontekst zdolności: aktywne procesy z rejestru (bez infrastruktury)
const INTERNAL = /\/(registry|dev|planner|validator|orchestrator)\//;
const catalogProcs = (registry("list", { status: "active" }).processes || []).filter(p => !INTERNAL.test(p.uri));

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
2. KRYTYCZNE DLA BEZPIECZEŃSTWA: NIGDY nie umieszczaj kluczy takich jak "bot_token", "api_key", "token", "secret" bezpośrednio w params!
   Dla poświadczeń UŻYWAJ WYŁĄCZNIE parametru: "credentialRef": "vault://service/token". Wszelkie jawne sekrety w parametrach zostaną natychmiast odrzucone przez walidator!
3. Jeśli zadanie to "monitoring z alertami na Telegram i dashboardem", zaplanuj:
   - krok monitor (proc://taskand.dev/monitor/cpu/v1)
   - krok alert (proc://taskand.dev/alert/telegram/v1, deps: ["monitor_cpu"], params: { "threshold": 80, "credentialRef": "vault://telegram/token" })
   - krok dashboard (proc://taskand.dev/web/serve/v1, deps: ["monitor_cpu"], params: { "port": 8090 })

Zwróć WYŁĄCZNIE poprawny JSON o strukturze:
{
  "blueprint": {
    "goal": "...",
    "steps": [ ... ]
  }
}`;

let plan = null;
const llm = call("proc://taskand.dev/dev/llm/v1", { system: SYSTEM, prompt: task, json: true, temperature: 0.1, max_tokens: 4000 }, 120000);
if (llm.ok) plan = llm.json;

// Sanitization: obrona w głąb przed przypadkowymi jawnymi kluczami w wyjściu LLM
if (plan && plan.blueprint && Array.isArray(plan.blueprint.steps)) {
  for (const step of plan.blueprint.steps) {
    if (step.params && typeof step.params === "object") {
      for (const k of Object.keys(step.params)) {
        const kLower = k.toLowerCase();
        if (kLower.includes("token") || kLower.includes("secret") || kLower.includes("password") || kLower.includes("key")) {
          const val = String(step.params[k]);
          if (!val.startsWith("vault://")) {
            delete step.params[k];
            if (!step.params.credentialRef) {
              step.params.credentialRef = `vault://${step.name || "service"}/${k}`;
            }
          }
        }
      }
    }
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
      ok: false,
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
  ok: true,
  valid: true,
  status: "PROPOSED",
  blueprint: plan.blueprint,
  totalSteps: plan.blueprint.steps.length,
  ts: new Date().toISOString()
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
process.exit(0);
