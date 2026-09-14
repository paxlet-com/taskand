import { launchBrowser } from './cdp.mjs';
import { transport, normalizeURL } from './transport.mjs';
import { evaluate, runSteps } from './scenario.mjs';
import { save } from './store.mjs';

export async function drive({ action, urls, origins, records, mocks, steps, path }) {
  const channel = transport({ mode: action, origins, records, mocks });
  const cdp = launchBrowser();
  const pages = [], exceptions = [];
  try {
    const version = await cdp.send('Browser.getVersion');
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const send = (m, p) => cdp.send(m, p, sessionId);
    cdp.on('Runtime.exceptionThrown', p => exceptions.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Network.setBypassServiceWorker', { bypass: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    channel.attach(cdp, sessionId);
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    let checks = [];
    if (action === 'capture') {
      for (const [index, inputURL] of urls.entries()) {
        const url = normalizeURL(inputURL);
        const nav = await send('Page.navigate', { url });
        if (nav.errorText) throw new Error(nav.errorText);
        await channel.idle();
        // Rendering and fonts can schedule GETs after the initial network lull.
        await evaluate(cdp, sessionId, `new Promise(resolve => { if (document.readyState === 'complete') resolve(true); else { window.addEventListener('load', () => resolve(true), {once:true}); setTimeout(() => resolve(false), 5000); } })`);
        await send('Page.captureScreenshot', { format: 'png' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await channel.idle();
        const page = await evaluate(cdp, sessionId, `({ url: location.href, title: document.title, controls: [...document.querySelectorAll('input:not([type=hidden]),button,select,textarea')].map(e=>({tag:e.tagName,type:e.type,name:e.name,id:e.id,required:e.required})), forms: [...document.forms].map(f => ({action:f.action, method:f.method, fields:[...f.elements].map(e => ({tag:e.tagName,type:e.type,name:e.name,id:e.id,required:e.required})).filter(e=>e.type!=='hidden')})) })`);
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        save(path, `capture-${index}.png`, Buffer.from(screenshot.data, 'base64'));
        await channel.idle();
        pages.push({ ...page, screenshot: `capture-${index}.png` });
      }
    } else {
      checks = await runSteps(cdp, sessionId, channel, steps);
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      save(path, 'replay.png', Buffer.from(screenshot.data, 'base64'));
      await channel.idle();
      pages.push(await evaluate(cdp, sessionId, '({url:location.href,title:document.title})'));
    }
    return { browser: version.product, pages, checks, entries: [...channel.entries.values()],
      misses: channel.misses, blocked: channel.blocked, errors: channel.errors, exceptions,
      syntheticHits: channel.hits.filter(h => h.provenance === 'synthetic').length,
      isolated: { network: true, filesystem: true, backend: 'bubblewrap', browserProfile: 'ephemeral' } };
  } finally { await cdp.close(); }
}
