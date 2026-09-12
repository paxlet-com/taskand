import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Test 1: Poprawny plan
const validBp = {
  blueprint: {
    goal: "Test plan",
    steps: [
      { id: 1, name: "step_a", process: "proc://taskand.dev/doctor/diagnose/v1", deps: [] },
      { id: 2, name: "step_b", process: "proc://taskand.dev/doctor/prescribe/v1", deps: ["step_a"] }
    ]
  }
};
const r1 = spawnSync("node", [join(__dirname, "bin.mjs")], {
  input: JSON.stringify(validBp), encoding: "utf8"
});
if (r1.status !== 0) { console.error("Test 1 fail", r1.stderr); process.exit(1); }

// Test 2: Cykliczny plan -> musi odrzucić! (BUG 10)
const cycleBp = {
  blueprint: {
    goal: "Cycle plan",
    steps: [
      { id: 1, name: "step_a", process: "proc://taskand.dev/doctor/diagnose/v1", deps: ["step_b"] },
      { id: 2, name: "step_b", process: "proc://taskand.dev/doctor/prescribe/v1", deps: ["step_a"] }
    ]
  }
};
const r2 = spawnSync("node", [join(__dirname, "bin.mjs")], {
  input: JSON.stringify(cycleBp), encoding: "utf8"
});
if (r2.status === 0) { console.error("Test 2: Cykl nie został wykryty!"); process.exit(1); }

console.log("✓ PASS");
