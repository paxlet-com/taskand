import { setTimeout as sleep } from 'node:timers/promises';

export async function readStdinJson() {
  return await new Promise((resolve, reject) => {
    let data = '';
    let timer = setTimeout(() => {
      reject(new Error('Przekroczono czas oczekiwania na stdin'));
    }, 5000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(data.trim() === '' ? {} : JSON.parse(data));
      } catch {
        process.exit(2);
      }
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      process.exit(2);
    });
    if (process.stdin.isTTY) {
      clearTimeout(timer);
      resolve({});
    }
  });
}
