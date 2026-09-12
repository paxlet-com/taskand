#!/usr/bin/env node
import { readFileSync } from "node:fs";
let i = {};
try { const raw = readFileSync(0, "utf8").trim(); if (raw) i = JSON.parse(raw); } catch { process.exit(2); }
const action = i.action || "health";
if (action === "health") {
  process.stdout.write(JSON.stringify({ status: "ok", port: 8090, uri: "proc://taskand.dev/web/serve/v1" }) + "\n");
  process.exit(0);
}
process.exit(2);
