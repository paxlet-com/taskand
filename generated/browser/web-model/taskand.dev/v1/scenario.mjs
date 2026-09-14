import { isDeepStrictEqual } from 'node:util';
import { normalizeURL } from './transport.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function evaluate(cdp, sessionId, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function element(cdp, sid, selector) {
  const deadline = Date.now() + 7000;
  do {
    const found = await evaluate(cdp, sid, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (found) return;
    await delay(150);
  } while (Date.now() < deadline);
  throw new Error(`Nie znaleziono elementu: ${selector}`);
}
export function validateSteps(steps) {
  if (!Array.isArray(steps) || !steps.length || steps.length > 30) throw new Error('Wymagane 1–30 kroków scenariusza');
  const allowed = ['goto', 'assert', 'fill', 'click', 'request'];
  for (const s of steps) {
    if (!s || !allowed.includes(s.action)) throw new Error(`Nieobsługiwana akcja: ${s?.action}`);
    if (['goto', 'request'].includes(s.action)) normalizeURL(s.url);
    if (['assert', 'fill', 'click'].includes(s.action) && (typeof s.selector !== 'string' || !s.selector || s.selector.length > 500)) throw new Error('Wymagany selektor CSS');
    if (s.action === 'fill' && typeof s.value !== 'string') throw new Error('fill wymaga value');
    if (s.action === 'request' && (!s.expect || !Number.isInteger(s.expect.status))) throw new Error('request wymaga expect.status');
    if (s.action === 'request' && s.body !== undefined && typeof s.body !== 'string') throw new Error('request.body musi być ciągiem');
  }
  if (!steps.some(s => ['assert', 'request'].includes(s.action))) throw new Error('Scenariusz musi zawierać sprawdzenie wyniku');
}

export async function runSteps(cdp, sid, channel, steps) {
  validateSteps(steps);
  const results = [];
  for (const [index, s] of steps.entries()) {
    try {
      if (s.action === 'goto') {
        const entry = await channel.acquire({ method: 'GET', url: s.url });
        if (!entry) throw new Error('Nawigacja nie jest opisana w modelu');
        const r = await cdp.send('Page.navigate', { url: s.url }, sid);
        if (r.errorText) throw new Error(r.errorText);
      } else if (s.action === 'request') {
        const r = await evaluate(cdp, sid, `(async () => { const r = await fetch(${JSON.stringify(s.url)}, ${JSON.stringify({ method: s.method || 'GET', ...(s.body !== undefined ? { body: s.body } : {}), headers: s.headers || {} })}); return { status: r.status, text: await r.text() }; })()`);
        if (r.status !== s.expect.status) throw new Error(`HTTP ${r.status}, oczekiwano ${s.expect.status}`);
        if (s.expect.textIncludes !== undefined && !r.text.includes(s.expect.textIncludes)) throw new Error('Odpowiedź nie zawiera oczekiwanego tekstu');
        if (s.expect.json !== undefined && !isDeepStrictEqual(JSON.parse(r.text), s.expect.json)) throw new Error('Niezgodny JSON odpowiedzi');
      } else {
        await element(cdp, sid, s.selector);
        const select = `document.querySelector(${JSON.stringify(s.selector)})`;
        if (s.action === 'fill') {
          await evaluate(cdp, sid, `(() => { const e = ${select}; const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value')?.set; if (setter) setter.call(e, ${JSON.stringify(s.value)}); else e.value = ${JSON.stringify(s.value)}; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
        } else if (s.action === 'click') await evaluate(cdp, sid, `${select}.click()`);
        else {
          const actual = await evaluate(cdp, sid, `(() => { const e = ${select}; return { text: e.textContent, visible: Boolean(e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden', valid: typeof e.checkValidity === 'function' ? e.checkValidity() : null, value: e.value }; })()`);
          if (s.textIncludes !== undefined && !actual.text.includes(s.textIncludes)) throw new Error('Element nie zawiera oczekiwanego tekstu');
          if (s.visible !== undefined && actual.visible !== s.visible) throw new Error('Niezgodna widoczność elementu');
          if (s.valid !== undefined && actual.valid !== s.valid) throw new Error('Niezgodny wynik walidacji formularza');
          if (s.value !== undefined && actual.value !== s.value) throw new Error('Niezgodna wartość pola');
        }
      }
      await channel.idle();
      results.push({ index, action: s.action, ok: true });
    } catch (err) { results.push({ index, action: s.action, ok: false, error: err.message }); break; }
  }
  return results;
}
