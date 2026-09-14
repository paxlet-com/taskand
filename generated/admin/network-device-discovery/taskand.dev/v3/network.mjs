// Wykrywa lokalną podsieć na podstawie ip route (tylko odczyt).
import { run } from "./exec.mjs";

export async function detectNetwork() {
  const r = await run("ip", ["route", "show"]); // fallback: route -n
  let text = r.stdout;
  if (!r.ok) {
    const alt = await run("route", ["-n"]);
    if (!alt.ok) return { ok: false, error: "brak ip/route" };
    text = alt.stdout;
  }
  // linia postaci: 192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.5
  const m = text.split("\n").find((l) => /\/\d+\s+dev\s+\S+\s+.*src\s+\d+\.\d+\.\d+\.\d+/.test(l));
  if (m) {
    const cidr = m.match(/(\d+\.\d+\.\d+\.\d+\/\d+)/);
    const src = m.match(/src\s+(\d+\.\d+\.\d+\.\d+)/);
    if (cidr && src) return { ok: true, info: { cidr: cidr[1], localIp: src[1] } };
  }
  const altCidr = text.match(/(\d+\.\d+\.\d+\.\d+\/\d+)/);
  if (altCidr) return { ok: true, info: { cidr: altCidr[1], localIp: null } };
  return { ok: false, error: "nie udało się ustalić podsieci" };
}

export function cidrToIps(cidr, limit = 64) {
  try {
    const [base, bitsStr] = cidr.split("/");
    const bits = parseInt(bitsStr, 10);
    if (!(bits >= 8 && bits <= 32)) return [];
    const b = base.split(".").map(Number);
    if (b.length !== 4 || b.some((x) => !(x >= 0 && x <= 255))) return [];
    const size = 2 ** (32 - bits);
    if (size > 1024) return []; // tylko małe sieci, bezpiecznie
    const ipNum = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    const network = (ipNum >>> (32 - bits)) << (32 - bits);
    const out = [];
    for (let i = 1; i < size - 1 && out.length < limit; i++) out.push(numToIp(network + i));
    return out;
  } catch {
    return [];
  }
}

function numToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}
