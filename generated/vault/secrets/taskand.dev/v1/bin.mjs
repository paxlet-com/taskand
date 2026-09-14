#!/usr/bin/env node
// proc://taskand.dev/vault/secrets/v1 — sejf sekretów AES-256-GCM (klucz: scrypt(TASKAND_VAULT_KEY)).
// Nigdy nie zwraca wartości. Odszyfrowanie dla procesów z credentialRef wykonuje wyłącznie broker registry/core.
// in: { action: status|list|exists|set|delete, name?, value? }
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

const DIR = fileURLToPath(new URL('../../../../../vault/', import.meta.url));
const FILE = join(DIR, 'secrets.json');
const KEY = process.env.TASKAND_VAULT_KEY;
const action = input.action || 'status';
const name = String(input.name || '').replace(/^vault:\/\//, '');
const emit = out => {
  process.stdout.write(JSON.stringify({ action, cipher: 'AES-256-GCM', ...out }) + '\n');
  process.exit(0);
};

function load() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return { version: 1, salt: randomBytes(16).toString('base64'), secrets: {} };
  }
}

function save(store) {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(`${FILE}.tmp`, JSON.stringify(store, null, 2), { mode: 0o600 });
  renameSync(`${FILE}.tmp`, FILE);
}

const needName = () => /^[a-z0-9][\w.-]*\/[\w.-]+$/i.test(name) || emit({ ok: false, error: 'Wymagane: name w formacie <zakres>/<nazwa>, np. telegram/token' });
const needKey = () => KEY || emit({ ok: false, error: 'Sejf niezainicjalizowany: dodaj TASKAND_VAULT_KEY do .env (np. openssl rand -hex 32)' });

const ACTIONS = {
  status: () => {
    const store = load();
    const count = Object.keys(store.secrets).length;
    return { ok: true, initialized: Boolean(KEY), secrets_count: count, summary: KEY ? `Sejf aktywny, ${count} sekretów` : 'Sejf niezainicjalizowany (brak TASKAND_VAULT_KEY w .env)' };
  },
  list: () => ({ ok: true, names: Object.entries(load().secrets).map(([n, s]) => ({ name: `vault://${n}`, updated: s.updated })) }),
  exists: () => needName() && { ok: true, name: `vault://${name}`, exists: Boolean(load().secrets[name]) },
  set: () => {
    needName();
    needKey();
    if (typeof input.value !== 'string' || !input.value) return { ok: false, error: 'Wymagane: value (string)' };
    const store = load();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', scryptSync(KEY, store.salt, 32), iv);
    const data = Buffer.concat([cipher.update(input.value, 'utf8'), cipher.final()]);
    store.secrets[name] = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64'), updated: new Date().toISOString() };
    save(store);
    return { ok: true, name: `vault://${name}`, stored: true };
  },
  delete: () => {
    needName();
    const store = load();
    const existed = Boolean(store.secrets[name]);
    delete store.secrets[name];
    save(store);
    return { ok: true, name: `vault://${name}`, deleted: existed };
  }
};

emit(ACTIONS[action] ? ACTIONS[action]() : { ok: false, error: `Nieznana akcja "${action}"` });
