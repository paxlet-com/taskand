// Odszyfrowanie sekretu dla brokera (tylko registry/core). Format zapisu: vault/secrets/v1 (AES-256-GCM, klucz scrypt)
import { readFileSync } from 'node:fs';
import { createDecipheriv, scryptSync } from 'node:crypto';
import { join } from 'node:path';
import { ROOT } from './store.mjs';

export function openSecret(name, passphrase) {
  if (!passphrase) return { ok: false, error: 'Sejf niezainicjalizowany: brak TASKAND_VAULT_KEY' };
  let store;
  try {
    store = JSON.parse(readFileSync(join(ROOT, 'vault', 'secrets.json'), 'utf8'));
  } catch {
    return { ok: false, error: 'Brak pliku sejfu vault/secrets.json' };
  }
  const item = store.secrets?.[name];
  if (!item) return { ok: false, error: `Sekret vault://${name} nie istnieje` };
  try {
    const key = scryptSync(passphrase, store.salt, 32);
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(item.iv, 'base64'));
    d.setAuthTag(Buffer.from(item.tag, 'base64'));
    return { ok: true, value: Buffer.concat([d.update(Buffer.from(item.data, 'base64')), d.final()]).toString('utf8') };
  } catch {
    return { ok: false, error: `Nie można odszyfrować vault://${name} (zły klucz lub uszkodzony wpis)` };
  }
}
