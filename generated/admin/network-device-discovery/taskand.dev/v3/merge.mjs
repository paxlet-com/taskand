// Scala rekordy urządzeń po MAC lub IP; zwraca ZAWSZE tablicę.
export function mergeDevices(records) {
  const list = Array.isArray(records) ? records.filter((r) => r && typeof r === "object") : [];
  const byKey = new Map();
  for (const r of list) {
    const mac = (r.mac || "").toUpperCase().replace(/-/g, ":");
    const key = mac.length === 17 ? "M:" + mac : r.ip ? "I:" + r.ip : null;
    if (!key) continue;
    const cur = byKey.get(key) || { mac: mac.length === 17 ? mac : null, ip: null, hostname: null, sources: [] };
    if (!cur.ip && r.ip) cur.ip = r.ip;
    if (!cur.hostname && r.hostname) cur.hostname = r.hostname;
    if (Array.isArray(r.sources)) cur.sources.push(...r.sources);
    else if (r.source) cur.sources.push(r.source);
    if (r.ip && !cur.ip) cur.ip = r.ip;
    byKey.set(key, cur);
  }
  // scal rekordy z tym samym IP ale różnym kluczem MAC
  const out = [];
  const byIp = new Map();
  for (const d of byKey.values()) {
    if (d.ip && byIp.has(d.ip)) {
      const t = byIp.get(d.ip);
      if (!t.mac && d.mac) t.mac = d.mac;
      if (!t.hostname && d.hostname) t.hostname = d.hostname;
      t.sources.push(...d.sources);
    } else {
      if (d.ip) byIp.set(d.ip, d);
      out.push(d);
    }
  }
  return out;
}
