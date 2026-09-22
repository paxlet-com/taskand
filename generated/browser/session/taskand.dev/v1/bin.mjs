#!/usr/bin/env node
// proc://taskand.dev/browser/session/v1 — sterowanie przeglądarką digital twin przez Chrome DevTools Protocol (HTTP + WebSocket API)
// in: { action: status|open|list|close|click|fill|eval|screenshot|navigate, url?, id?, text?, role?, selector?, value?, expr?, output? }
import { readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';

let input;
try {
  const raw = readFileSync(0, 'utf8').trim();
  input = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(2);
}

setInterval(() => {}, 60000);
const CDP = (process.env.TASKAND_BROWSER_CDP || 'http://localhost:9222').replace(/\/$/, '');
const NOVNC = process.env.TASKAND_BROWSER_NOVNC || 'http://localhost:3010';
const HOST_GATEWAY = process.env.TASKAND_HOST_GATEWAY || '10.64.13.1';

const action = input.action || (input.click || input.text || input.selector ? 'click' : input.url ? 'open' : 'status');

const emit = out => {
  process.stdout.write(JSON.stringify({ action, cdp: CDP, novnc_url: NOVNC, ...out, ts: new Date().toISOString() }) + '\n');
  process.exit(0);
};

function resolveGatewayUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  try {
    const u = new URL(urlStr);
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && HOST_GATEWAY) {
      u.hostname = HOST_GATEWAY;
      return u.toString();
    }
  } catch {}
  return urlStr;
}

async function cdpHttp(path, method = 'GET') {
  const r = await fetch(`${CDP}${path}`, { method, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`CDP ${path}: HTTP ${r.status}`);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getPages() {
  const list = await cdpHttp('/json/list');
  return list.filter(t => t.type === 'page');
}

function cdpWs(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(wsUrl);
    } catch (e) {
      return reject(e);
    }
    const timeoutTimer = setTimeout(() => {
      s.destroy();
      reject(new Error(`CDP WebSocket timeout (${method})`));
    }, 15000);

    const s = connect(Number(u.port) || 9222, u.hostname, () => {
      s.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });

    let buf = Buffer.alloc(0);
    let handshaked = false;

    s.on('error', err => {
      clearTimeout(timeoutTimer);
      reject(err);
    });

    s.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshaked) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx !== -1) {
          handshaked = true;
          buf = buf.subarray(idx + 4);
          const payload = Buffer.from(JSON.stringify({ id: 1, method, params }));
          const mask = Buffer.from([1, 2, 3, 4]);
          const len = payload.length;
          let header;
          if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
          else if (len < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(len, 2);
          } else {
            header = Buffer.alloc(10);
            header[0] = 0x81;
            header[1] = 0x80 | 127;
            header.writeBigUInt64BE(BigInt(len), 2);
          }
          const masked = Buffer.alloc(len);
          for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
          s.write(Buffer.concat([header, mask, masked]));
        }
      }
      if (handshaked && buf.length >= 2) {
        const lenByte = buf[1] & 0x7f;
        let dataStart = 2;
        let payloadLen = lenByte;
        if (lenByte === 126) {
          if (buf.length < 4) return;
          payloadLen = buf.readUInt16BE(2);
          dataStart = 4;
        } else if (lenByte === 127) {
          if (buf.length < 10) return;
          payloadLen = Number(buf.readBigUInt64BE(2));
          dataStart = 10;
        }
        if (buf.length >= dataStart + payloadLen) {
          const rawMsg = buf.subarray(dataStart, dataStart + payloadLen).toString('utf8');
          clearTimeout(timeoutTimer);
          s.end();
          try {
            const parsed = JSON.parse(rawMsg);
            if (parsed.error) reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            else resolve(parsed.result);
          } catch (e) {
            reject(e);
          }
        }
      }
    });
  });
}

async function resolveTargetPage() {
  const pages = await getPages();
  if (!pages.length) {
    const tab = await cdpHttp('/json/new', 'PUT');
    return tab;
  }
  if (input.id) {
    const found = pages.find(p => p.id === input.id);
    if (found) return found;
  }
  if (input.url) {
    const rawTarget = input.url;
    const gatewayTarget = resolveGatewayUrl(rawTarget);
    const found = pages.find(p => p.url === rawTarget || p.url === gatewayTarget || p.url.includes(rawTarget) || p.url.includes(gatewayTarget));
    if (found) return found;
  }
  return pages[0];
}

const _CDP_FIND_JS = `
function(text, role, selector) {
  const strip = s => (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\u0142/g, 'l').replace(/\\u0141/g, 'L');
  const norm = s => strip(s).replace(/\\s+/g, ' ').trim().toLowerCase();
  const visible = n => {
    if (!n) return false;
    const style = window.getComputedStyle(n);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const r = n.getBoundingClientRect();
    if (r.width === 0 && r.height === 0 && n.getClientRects().length === 0) return false;
    return true;
  };
  const roleOf = n => norm(n.getAttribute && n.getAttribute('role')) ||
    (n.tagName === 'BUTTON' || (n.tagName === 'INPUT' && /^(submit|button)$/i.test(n.type)) ? 'button'
     : n.tagName === 'A' ? 'link' : n.tagName.toLowerCase());

  if (selector) {
    const m = selector.match(/:(?:has-)?text\\(\\s*['"]?([^'")]*)['"]?\\s*\\)/i);
    if (m) {
      text = text || m[1];
      const tag = (selector.match(/^[a-z0-9]+/i) || [])[0];
      if (tag && !role) role = tag.toLowerCase() === 'a' ? 'link' : tag.toLowerCase();
      selector = '';
    }
    if (selector) {
      try {
        const el = document.querySelector(selector);
        if (el && visible(el)) return el;
      } catch (e) {}
    }
  }

  const want = norm(text);
  const wantRole = norm(role);
  const pool = Array.from(document.querySelectorAll(
    'button, a, input, textarea, select, [role], [contenteditable], [aria-label], [tabindex]'
  ));
  const roleOk = n => !wantRole || roleOf(n) === wantRole;

  const namesOf = n => [
    norm(n.innerText),
    norm(n.value),
    norm(n.getAttribute && n.getAttribute('aria-label')),
    norm(n.getAttribute && n.getAttribute('title')),
    norm(n.getAttribute && n.getAttribute('placeholder'))
  ].filter(Boolean);

  const exact = pool.filter(n => roleOk(n) && visible(n) && (!want || namesOf(n).some(name => name === want)));
  if (exact.length) return exact[0];

  const loose = pool.filter(n => roleOk(n) && visible(n) && want && namesOf(n).some(name => name.includes(want)));
  return loose[0] || null;
}
`;

const ACTIONS = {
  status: async () => {
    const v = await cdpHttp('/json/version');
    const tabs = await getPages();
    return { ok: true, browser: v.Browser, tabs: tabs.length, summary: `${v.Browser} gotowa, podgląd: ${NOVNC}` };
  },
  list: async () => {
    const pages = await getPages();
    return { ok: true, tabs: pages.map(({ id, title, url }) => ({ id, title, url })) };
  },
  open: async () => {
    if (!/^https?:\/\//.test(input.url || '')) return { ok: false, error: 'Wymagane: url (http/https)' };
    const targetUrl = resolveGatewayUrl(input.url);
    const tab = await cdpHttp(`/json/new?${encodeURIComponent(targetUrl)}`, 'PUT');
    return { ok: true, session: `session://browser/${tab.id}`, id: tab.id, url: input.url, resolvedUrl: targetUrl, summary: `Otwarto ${input.url} — podgląd: ${NOVNC}` };
  },
  navigate: async () => {
    if (!/^https?:\/\//.test(input.url || '')) return { ok: false, error: 'Wymagane: url (http/https)' };
    const page = await resolveTargetPage();
    const targetUrl = resolveGatewayUrl(input.url);
    const res = await cdpWs(page.webSocketDebuggerUrl, 'Page.navigate', { url: targetUrl });
    return { ok: true, id: page.id, url: input.url, resolvedUrl: targetUrl, frameId: res.frameId, summary: `Zanawigowano do ${input.url}` };
  },
  eval: async () => {
    const expr = input.expr || input.expression;
    if (!expr) return { ok: false, error: 'Wymagane: expr' };
    const page = await resolveTargetPage();
    const res = await cdpWs(page.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res?.exceptionDetails) return { ok: false, error: res.exceptionDetails.text };
    return { ok: true, id: page.id, value: res?.result?.value, type: res?.result?.type };
  },
  click: async () => {
    const targetText = input.text || input.click || '';
    const role = input.role || '';
    const selector = input.selector || '';
    if (!targetText && !role && !selector) return { ok: false, error: 'Wymagane: text, role lub selector' };

    let page;
    if (input.url) {
      const targetUrl = resolveGatewayUrl(input.url);
      const pages = await getPages();
      page = pages.find(p => p.url === input.url || p.url === targetUrl || p.url.includes(targetUrl));
      if (!page) {
        page = await cdpHttp(`/json/new?${encodeURIComponent(targetUrl)}`, 'PUT');
        await new Promise(r => setTimeout(r, 1500));
      }
    } else {
      page = await resolveTargetPage();
    }

    const expr = `(function() {
      const find = ${_CDP_FIND_JS};
      const el = find(${JSON.stringify(targetText)}, ${JSON.stringify(role)}, ${JSON.stringify(selector)});
      if (!el) return { ok: false, error: 'Element nie został znaleziony: ' + JSON.stringify({ text: ${JSON.stringify(targetText)}, role: ${JSON.stringify(role)}, selector: ${JSON.stringify(selector)} }) };
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { ok: true, action: 'click', tag: el.tagName, name: (el.innerText || el.value || '').slice(0, 80) };
    })()`;

    const res = await cdpWs(page.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res?.exceptionDetails) return { ok: false, error: res.exceptionDetails.text };
    const val = res?.result?.value;
    if (val && !val.ok) return { ok: false, error: val.error, target: { text: targetText, role, selector } };
    return { ok: true, id: page.id, result: val, summary: `Kliknięto element "${val?.name || targetText}" (${val?.tag})` };
  },
  fill: async () => {
    const targetText = input.text || '';
    const role = input.role || '';
    const selector = input.selector || '';
    const valToFill = String(input.value ?? '');
    const page = await resolveTargetPage();

    const expr = `(function() {
      const find = ${_CDP_FIND_JS};
      const el = find(${JSON.stringify(targetText)}, ${JSON.stringify(role)}, ${JSON.stringify(selector)});
      if (!el) return { ok: false, error: 'Element nie został znaleziony' };
      el.focus();
      const VALUE = ${JSON.stringify(valToFill)};
      if (el.isContentEditable) {
        const sel = window.getSelection(), r = document.createRange();
        r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r);
        document.execCommand('insertText', false, VALUE);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      } else {
        const set = Object.getOwnPropertyDescriptor(el.__proto__, 'value');
        set && set.set ? set.set.call(el, VALUE) : (el.value = VALUE);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { ok: true, action: 'fill', tag: el.tagName, value: VALUE };
    })()`;

    const res = await cdpWs(page.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res?.exceptionDetails) return { ok: false, error: res.exceptionDetails.text };
    const val = res?.result?.value;
    if (val && !val.ok) return { ok: false, error: val.error };
    return { ok: true, id: page.id, result: val, summary: `Wpisano wartość do ${val?.tag}` };
  },
  screenshot: async () => {
    const page = await resolveTargetPage();
    const res = await cdpWs(page.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
    if (!res?.data) return { ok: false, error: 'Brak danych zrzutu ekranu' };
    const raw = Buffer.from(res.data, 'base64');
    const out = { ok: true, id: page.id, mime: 'image/png', bytes: raw.length, base64_head: res.data.slice(0, 60) };
    if (input.output) {
      writeFileSync(input.output, raw);
      out.output = input.output;
      out.saved = true;
    }
    return out;
  },
  close: async () => {
    if (!input.id) return { ok: false, error: 'Wymagane: id karty' };
    await cdpHttp(`/json/close/${encodeURIComponent(input.id)}`);
    return { ok: true, id: input.id, closed: true };
  }
};

if (!ACTIONS[action]) emit({ ok: false, error: `Nieznana akcja "${action}"` });
try {
  emit(await ACTIONS[action]());
} catch (err) {
  emit({ ok: false, error: `Przeglądarka niedostępna przez CDP (${CDP}): ${err.cause?.code || err.message}. Wymaga vm-browser z CHROME_CLI=--remote-debugging-port=9222.` });
}
