import { spawnSync } from "node:child_process";
const r = spawnSync("node", ["bin.mjs"], {
  input: JSON.stringify({ message: "jak mogę cię używać w przeglądarce?" }),
  encoding: "utf8"
});
if (r.status !== 0) { console.error("✗ fail status:", r.status, r.stderr); process.exit(1); }
const out = JSON.parse(r.stdout);
if (!out.reply || out.intent !== "SPAWN_WEB") { console.error("✗ unexpected out:", out); process.exit(1); }
console.log("✓ PASS");
