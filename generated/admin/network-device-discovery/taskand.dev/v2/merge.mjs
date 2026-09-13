export function mergeDevices({ arpEntries, mdns, ssdp, tcp, dns, lookupVendor }) {
  const map = new Map();
  const get = (ip) => {
    if (!map.has(ip)) {
      map.set(ip, { ip, mac: null, hostname: null, vendor: null, sources: [] });
    }
    return map.get(ip);
  };
  const addSource = (dev, src) => {
    if (dev.sources.indexOf(src) === -1) dev.sources.push(src);
  };

  for (const e of arpEntries) {
    const dev = get(e.ip);
    dev.mac = dev.mac || e.mac;
    dev.vendor = dev.vendor || lookupVendor(e.mac);
    addSource(dev, 'arp');
  }
  for (const [ip, host] of mdns.hostnames) {
    const dev = get(ip);
    dev.hostname = dev.hostname || host;
    addSource(dev, 'mdns');
  }
  for (const ip of mdns.ips) {
    addSource(get(ip), 'mdns');
  }
  for (const ip of ssdp.ips) {
    addSource(get(ip), 'ssdp');
  }
  for (const t of tcp) {
    const dev = get(t.ip);
    addSource(dev, 'tcp');
  }
  for (const [ip, host] of dns) {
    const dev = get(ip);
    dev.hostname = dev.hostname || host;
    addSource(dev, 'reverse-dns');
  }

  return [...map.values()];
}
