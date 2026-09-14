// Reverse DNS przez dns.reverse z limitem czasu.
import dns from "node:dns/promises";

export async function reverseDns(ip) {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise((_, rej) => setTimeout(() => rej(new Error("dns timeout")), 3000)),
    ]);
    return Array.isArray(names) ? names : [];
  } catch {
    return [];
  }
}
