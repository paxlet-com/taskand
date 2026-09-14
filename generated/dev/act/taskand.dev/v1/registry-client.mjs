// Klient rejestru — jedyny sposób wywołania innego procesu: URI + JSON przez proc://taskand.dev/registry/core/v1.
// Kopia w każdym pakiecie, który wywołuje inne procesy (pakiet nie importuje nic spoza siebie).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REGISTRY = fileURLToPath(new URL('../../../../registry/core/taskand.dev/v1/bin.mjs', import.meta.url));

export function registry(action, payload = {}, timeout_ms = 60000) {
  const r = spawnSync('node', [REGISTRY], {
    input: JSON.stringify({ action, ...payload }),
    encoding: 'utf8',
    timeout: timeout_ms + 5000,
    maxBuffer: 16 * 1024 * 1024,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TASKAND_CALL_DEPTH: process.env.TASKAND_CALL_DEPTH || '0' }
  });
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { ok: false, errorType: 'REGISTRY_ERROR', error: (r.stderr || r.error?.message || 'brak odpowiedzi rejestru').trim().slice(-500) };
  }
}

export const call = (uri, input = {}, timeout_ms = 60000) => registry('call', { uri, input, timeout_ms }, timeout_ms);
