// Mapa OUI (fragment, znane popularne prefiksy). Zwraca null gdy nieznane.
const OUI = {
  "00:00:0C": "Cisco",
  "00:00:5E": "IANA (enterprises)",
  "00:04:ED": "ICP Electronics",
  "00:0C:29": "VMware",
  "00:11:32": "Synology",
  "00:14:6C": "Netgear",
  "00:15:5D": "Microsoft (Hyper-V)",
  "00:16:32": "Apple",
  "00:17:9A": "D-Link",
  "00:18:E7": "Cisco-Linksys",
  "00:1A:2B": "Ayecom Technology",
  "00:1A:A0": "Cisco-Linksys",
  "00:1B:44": "SanDisk",
  "00:1E:58": "D-Link",
  "00:21:91": "Cisco Systems",
  "00:23:CD": "LG Electronics",
  "00:25:00": "Apple",
  "00:26:BB": "Apple",
  "04:D4:C4": "TP-Link",
  "08:00:27": "Oracle (VirtualBox)",
  "00:50:56": "VMware",
  "0C:5B:8F": "Cisco",
  "10:1F:74": "Huawei",
  "14:91:82": "Microsoft",
  "18:C0:4D": "Ubiquiti Networks",
  "24:5A:4C": "Apple",
  "28:6A:BA": "Cisco",
  "3C:07:54": "Cisco",
  "3C:5A:B4": "Google",
  "40:B0:34": "Sonos",
  "48:3B:38": "Hewlett Packard",
  "50:E5:49": "Wistron",
  "5C:E9:31": "TP-Link",
  "60:57:18": "Zyxel",
  "64:BC:0C": "TP-Link",
  "68:D7:9A": "Xiaomi",
  "6C:19:8F": "Sagemcom",
  "78:11:DC": "Cisco",
  "80:2A:A8": "Huawei",
  "84:16:F9": "Xiaomi",
  "8C:16:45": "Apple",
  "98:DA:C4": "Cisco",
  "9C:8E:99": "Ubiquiti Networks",
  "A4:2B:B0": "D-Link",
  "AC:DE:48": "private/local",
  "B8:27:EB": "Raspberry Pi Foundation",
  "C8:69:CD": "Huawei",
  "D4:CA:6D": "Raspberry Pi Trading",
  "DC:A6:32": "Raspberry Pi Trading",
  "E4:5F:01": "Raspberry Pi Trading",
  "F0:9F:C2": "Ubiquiti Networks",
  "F4:F2:6D": "Samsung Electronics",
};

export function ouiVendor(mac) {
  if (!mac) return null;
  const norm = String(mac).toUpperCase().replace(/-/g, ":");
  const m = norm.match(/^([0-9A-F]{2}):([0-9A-F]{2}):([0-9A-F]{2})/);
  if (!m) return null;
  const key = `${m[1]}:${m[2]}:${m[3]}`;
  return OUI[key] || null;
}
