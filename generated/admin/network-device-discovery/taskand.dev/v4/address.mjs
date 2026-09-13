import { isIP } from 'node:net';

export function ipNumber(ip) {
  const family = isIP(ip);
  if (family === 4) return ip.split('.').reduce((n, b) => (n << 8n) + BigInt(b), 0n);
  if (family !== 6 || ip.includes('%') || ip.includes('.')) throw new Error(`Nieobsługiwany adres: ${ip}`);
  const halves = ip.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return words.reduce((n, w) => (n << 16n) + BigInt(`0x${w}`), 0n);
}

export function formatIP(n, family) {
  if (family === 4) return [24n, 16n, 8n, 0n].map(b => Number((n >> b) & 255n)).join('.');
  return Array.from({ length: 8 }, (_, i) => ((n >> BigInt((7 - i) * 16)) & 65535n).toString(16)).join(':');
}

export function subnet(address, prefix) {
  const family = isIP(address), width = family === 4 ? 32 : 128;
  if (!family || !Number.isInteger(prefix) || prefix < 0 || prefix > width) throw new Error('Niepoprawny prefiks IP');
  const size = 1n << BigInt(width - prefix);
  const first = (ipNumber(address) / size) * size, last = first + size - 1n;
  const reserve = family === 4 && prefix < 31 ? 1n : 0n;
  return { family, cidr: `${formatIP(first, family)}/${prefix}`, prefix,
    range: { start: formatIP(first, family), end: formatIP(last, family), addresses: String(size) },
    hosts: { start: formatIP(first + reserve, family), end: formatIP(last - reserve, family), count: String(size - reserve * 2n) } };
}

export function contains(network, ip) {
  return isIP(ip) === network.family && ipNumber(ip) >= ipNumber(network.range.start) && ipNumber(ip) <= ipNumber(network.range.end);
}
