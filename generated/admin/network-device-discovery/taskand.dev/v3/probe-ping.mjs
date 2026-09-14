// Ping sweep: odpytuje dostępne adresy w podsieci przez UDP odrzucone/ping; ARP po sweep z /proc/net/arp.
import { cidrToIps } from "./network.mjs";
import { run } from "./exec.mjs";
import dgram from "node:dgram";

export async function probePing(cidr, { limit = 64 } = {}) {
  const ips = cidrToIps(cidr, limit);
  if (ips.length === 0) return [];
  // szybki trik: UDP port 137/137 zamknięty -> ICMP unreachable -> odświeża ARP
  await Promise.all(
    ips.map(
      (ip) =>
        new Promise((resolve) => {
          let s;
          try {
            s = dgram.createSocket("udp4");
          } catch {
            resolve();
            return;
          }
          const fin = () => { try { s.close(); } catch {} resolve(); };
          s.on("error", fin);
          s.on("message", fin);
          setTimeout(fin, 900);
          try {
            s.bind(0, () => {
              try { s.send(Buffer.from([0x00]), 137, ip); } catch {}
            });
          } catch { fin(); }
        })
    )
  );
  // po sweep ponownie czytamy tablicę ARP
  const { probeArp } = await import("./probe-arp.mjs");
  const devices = await probeArp();
  return devices.map((d) => ({ ...d, source: "ping-sweep" }));
}
