#!/usr/bin/env node
// proc://taskand.dev/dev/execute/v1 — developer execution engine
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

const intent = input.intent || "spawn-web";
const desc = input.desc || "";

// Delegate to dev/chat
const devChatBin = join(ROOT, "generated/dev/chat/taskand.dev/v1/bin.mjs");
const r = spawnSync("node", [devChatBin], {
  input: JSON.stringify({ message: desc || intent }),
  encoding: "utf8"
});

if (r.status !== 0) process.exit(r.status || 1);
const out = JSON.parse(r.stdout);
process.stdout.write(JSON.stringify({
  reply: out.reply,
  status: "ok",
  proc: "proc://taskand.dev/dev/execute/v1",
  url: intent === "spawn-web" ? "http://localhost:8090" : undefined
}) + "\n");
process.exit(0);
