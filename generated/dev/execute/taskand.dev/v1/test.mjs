import { spawnSync } from "node:child_process";
const r = spawnSync("node", ["bin.mjs"], {
  input: JSON.stringify({ intent: "spawn-web", desc: "jak moge cie uzywac w przegladarce" }),
  encoding: "utf8"
});
if (r.status !== 0) { process.exit(1); }
const out = JSON.parse(r.stdout);
if (out.status !== "ok") { process.exit(1); }
console.log("✓ PASS");
