import { promises as dns } from 'node:dns';

export async function reverseDns(ips) {
  const map = new Map();
  await Promise.all(ips.map(async (ip) => {
    try {
      const names = await dns.reverse(ip);
      if (names.length > 0) map.set(ip, names[0]);
    } catch {
      /* brak wpisu PTR */
    }
  }));
  return map;
}
