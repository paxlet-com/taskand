import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const testPlan = {
  approvedPlan: {
    goal: "Test orchestratora",
    steps: [
      {
        id: 1,
        name: "monitor_step",
        process: "proc://taskand.dev/monitor/cpu/v1",
        resolvedPath: "generated/monitor/cpu/taskand.dev/v1/bin.mjs",
        kind: "task",
        deps: [],
        params: { mock_cpu: 88.5 }
      },
      {
        id: 2,
        name: "alert_step",
        process: "proc://taskand.dev/alert/telegram/v1",
        resolvedPath: "generated/alert/telegram/taskand.dev/v1/bin.mjs",
        kind: "task",
        deps: ["monitor_step"],
        params: { threshold: 80.0 }
      }
    ]
  }
};

const r = spawnSync("node", [join(__dirname, "bin.mjs")], {
  input: JSON.stringify(testPlan),
  encoding: "utf8"
});

if (r.status !== 0) { console.error("Test orchestratora fail:", r.stderr); process.exit(1); }
const out = JSON.parse(r.stdout);
if (out.status !== "SUCCEEDED" || out.succeeded !== 2) { console.error("Błąd wyniku:", out); process.exit(1); }
console.log("✓ PASS");
