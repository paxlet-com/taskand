// Odczytuje tablicę ARP z /proc/net/arp oraz ip neigh (tylko odczyt).
import { readFile } from "node:fs/promises";
import { run } from "./exec.mjs";

export async function probeArp() {
  const found = [];
  try {
    const raw = await readFile("/proc/net/arp", "utf8");
    const lines = raw.split("\n").slice(1);
    for (const line of lines) {
      const p = line.trim().split(/\s+/);
      if (p.length >= 4) {
        const ip = p[0];
        const mac = /^[0-9a-fA-F:]{17}$/.test(p[3]) ? p[3] : null;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) found.push({ ip, mac, source: "arp" });
      }
    }
  } catch {
    // /proc/net/arp niedostępny — spróbuj ip neigh
  }
  if (found.length === 0) {
    const r = await run("ip", ["neigh", "show"]);
    if (r.ok) {
      for (const line of r.stdout.split("\n")) {
        const ip = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
        const mac = line.match(/lladdr\s+([0-9a-fA-F:]{17})/);
        if (ip) found.push({ ip: ip[1], mac: mac ? mac[1] : null, source: "ip-neigh" });
      }
    }
  }
  return found;
}
