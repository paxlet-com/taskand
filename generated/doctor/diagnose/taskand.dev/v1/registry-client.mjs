// Klient rejestru — jedyny sposób wywołania innego procesu: URI + JSON przez proc://taskand.dev/registry/core/v1.
// Kopia w każdym pakiecie, który wywołuje inne procesy (pakiet nie importuje nic spoza siebie).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REGISTRY = fileURLToPath(new URL('../../../../registry/core/taskand.dev/v1/bin.mjs', import.meta.url));

export function registry(action, payload = {}, timeout_ms = 60000) {
  const failure = (errorType, error) => ({ ok: false, errorType, error });
  if (timeout_ms <= 0) return Promise.resolve(failure('REGISTRY_TIMEOUT', 'Wyczerpany budżet diagnozy'));
  return new Promise(resolve => {
    const grouped = process.platform !== 'win32';
    const child = spawn(process.execPath, [REGISTRY], {
      detached: grouped, stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TASKAND_CALL_DEPTH: process.env.TASKAND_CALL_DEPTH || '0' }
    });
    const chunks = [];
    let size = 0, result;
    function stop(value) {
      if (result) return;
      result = value;
      try { if (grouped) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    }
    const timer = setTimeout(() => stop(failure('REGISTRY_TIMEOUT', 'Przekroczony wspólny deadline diagnozy')), timeout_ms);
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) stop(failure('REGISTRY_ERROR', 'Wynik rejestru przekracza limit'));
      else chunks.push(chunk);
    });
    // Raw stderr is untrusted and may contain credentials.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => { result = failure('REGISTRY_ERROR', 'Nie można uruchomić rejestru'); });
    child.on('close', code => {
      clearTimeout(timer);
      if (result) return resolve(result);
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (code !== 0 || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolve(parsed);
      } catch { resolve(failure('REGISTRY_ERROR', 'Niepoprawna odpowiedź rejestru')); }
    });
    child.stdin.end(JSON.stringify({ action, ...payload }));
  });
}

export const call = (uri, input = {}, timeout_ms = 60000) => registry('call', { uri, input, timeout_ms }, timeout_ms);
