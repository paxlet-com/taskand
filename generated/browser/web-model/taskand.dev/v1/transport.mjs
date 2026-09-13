import { hash } from './store.mjs';

const KEEP = new Set(['content-type', 'location', 'content-security-policy', 'x-frame-options', 'access-control-allow-origin',
  'access-control-allow-credentials', 'access-control-allow-headers', 'access-control-allow-methods', 'cross-origin-resource-policy']);
export function normalizeURL(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Wymagany URL HTTP(S) bez poświadczeń');
  url.hash = '';
  return url.href;
}
export function requestKey(request) {
  if (request.hasPostData && typeof request.postData !== 'string') throw new Error('Niepełna treść żądania; model nie może dopasować jej jako pustej');
  return `${request.method || 'GET'} ${normalizeURL(request.url)} ${hash(request.postData || '')}`;
}
export function fixture(input) {
  if (!input || (input.body !== undefined && typeof input.body !== 'string')) throw new Error('body modelu musi być dokładnym ciągiem żądania');
  const request = { method: input.method || 'GET', url: normalizeURL(input.url), postData: input.body || '' };
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)) throw new Error('Nieobsługiwana metoda modelu');
  const response = input.response;
  if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status > 599) throw new Error('Wymagany status odpowiedzi modelu 200–599');
  return { key: requestKey(request), request, response: { status: response.status,
    headers: Object.entries(response.headers || { 'content-type': 'application/json' }).filter(([k]) => KEEP.has(k.toLowerCase())).map(([name, value]) => ({ name: name.toLowerCase(), value: String(value) })),
    body: Buffer.from(typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? null)).toString('base64') }, provenance: 'synthetic' };
}

export function transport({ mode, origins, records = [], mocks = [], maxBytes = 40 * 1024 * 1024, maxRequests = 500 }) {
  if (!['capture', 'replay'].includes(mode)) throw new Error('Nieznany tryb transportu');
  if (!Array.isArray(mocks) || mocks.length > 100) throw new Error('Maksymalnie 100 modeli odpowiedzi');
  const entries = new Map(records.map(r => [r.key, r]));
  for (const mock of mocks) { const r = fixture(mock); if (entries.has(r.key)) throw new Error('Mock nadpisuje istniejący kontrakt'); entries.set(r.key, r); }
  if ([...entries.values()].reduce((n, r) => n + Buffer.byteLength(r.response.body, 'base64'), 0) > maxBytes) throw new Error('Limit rozmiaru modelu');
  const inFlight = new Map(), misses = [], blocked = [], errors = [], hits = [], pending = new Set();
  let bytes = 0, lastActivity = Date.now();
  async function acquire(request) {
    const url = normalizeURL(request.url), key = requestKey(request);
    if (entries.has(key)) { hits.push({ key, provenance: entries.get(key).provenance }); return entries.get(key); }
    if (mode === 'replay') { misses.push({ method: request.method, url }); return null; }
    if (request.method !== 'GET' || !origins.includes(new URL(url).origin)) {
      blocked.push({ method: request.method, url, reason: 'capture-only-GET-and-declared-origins' }); return null;
    }
    if (inFlight.has(key)) return inFlight.get(key);
    if (entries.size + inFlight.size >= maxRequests) throw new Error('Limit liczby zasobów migawki');
    const promise = (async () => {
      // No browser cookies, Authorization or supplied headers are forwarded to production.
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'taskand-web-twin/1.0', accept: request.headers?.Accept || '*/*' } });
      const chunks = [];
      if (res.body) for await (const chunk of res.body) { bytes += chunk.length; if (bytes > maxBytes) throw new Error('Limit rozmiaru migawki'); chunks.push(Buffer.from(chunk)); }
      const entry = { key, request: { method: 'GET', url, postData: '' }, provenance: 'observed-public-GET', capturedAt: new Date().toISOString(),
        response: { status: res.status, headers: [...res.headers].filter(([k]) => KEEP.has(k)).map(([name, value]) => ({ name, value })), body: Buffer.concat(chunks).toString('base64') } };
      entries.set(key, entry); return entry;
    })();
    inFlight.set(key, promise);
    try { return await promise; } finally { inFlight.delete(key); }
  }
  function attach(cdp, sessionId) {
    cdp.on('Fetch.requestPaused', (event, sid) => {
      if (sid !== sessionId) return;
      lastActivity = Date.now();
      const job = (async () => {
        try {
          const entry = await acquire(event.request);
          if (!entry) return await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }, sid);
          const { status, headers, body } = entry.response;
          await cdp.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: status, responseHeaders: headers, body }, sid);
        } catch (err) {
          errors.push({ url: event.request.url, error: err.message });
          try { await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Failed' }, sid); } catch {}
        }
      })();
      pending.add(job); job.finally(() => { pending.delete(job); lastActivity = Date.now(); });
    });
  }
  async function idle() {
    const deadline = Date.now() + 25000;
    do {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!pending.size && Date.now() - lastActivity >= 1000) return;
    } while (Date.now() < deadline);
    throw new Error('Nie zakończono pobierania zasobów');
  }
  return { acquire, attach, idle, entries, misses, blocked, errors, hits };
}
