// Bezpieczne uruchamianie poleceń systemowych: tylko odczyt, timeout 15000 ms.
import { spawn } from "node:child_process";

export function run(cmd, args = [], timeoutMs = 15000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve({ ok: false, stdout: "", stderr: "spawn failed" });
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;
    const t = setTimeout(() => {
      if (!settled) { settled = true; try { child.kill("SIGKILL"); } catch {} resolve({ ok: false, stdout, stderr: "timeout" }); }
    }, timeoutMs);
    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });
    child.on("error", () => { if (!settled) { settled = true; clearTimeout(t); resolve({ ok: false, stdout, stderr }); } });
    child.on("close", (code) => {
      if (!settled) { settled = true; clearTimeout(t); resolve({ ok: code === 0, stdout, stderr }); }
    });
  });
}
