const OUI_DB = {
  '00:00:0c': 'Cisco',
  '00:1a:11': 'Google',
  '00:23:cd': 'Samsung',
  '00:25:00': 'Apple',
  '00:50:56': 'VMware',
  '00:50:f2': 'Cisco-Linksys',
  '00:1b:44': 'SanDisk',
  '00:26:bb': 'Apple',
  '08:00:27': 'Oracle VirtualBox',
  '0c:80:63': 'Cisco',
  '10:68:3f': 'Wistron',
  '10:bf:48': 'Cisco-Linksys',
  '14:99:e2': 'Ubiquiti',
  '18:28:61': 'Espressif (ESP32)',
  '24:db:ed': 'Xiaomi',
  '28:6a:ba': 'Xiaomi',
  '30:cd:a7': 'Espressif (ESP32)',
  '34:ea:34': 'Xiaomi',
  '38:f8:89': 'Xiaomi',
  '3c:5a:b4': 'Google',
  '3c:84:6a': 'Intel',
  '48:5a:3f': 'Espressif',
  '50:32:37': 'TP-Link',
  '54:60:09': 'Sonos',
  '5c:cf:7f': 'Espressif (ESP8266)',
  '60:57:18': 'Sony',
  '64:70:02': 'Apple',
  '68:5d:43': 'TP-Link',
  '74:da:38': 'TP-Link',
  '84:16:f9': 'Cisco',
  '88:15:44': 'TP-Link',
  '8c:16:45': 'Apple',
  '94:10:fc': 'Samsung',
  '98:da:c4': 'Cisco',
  '9c:8e:cd': 'Cisco',
  'a4:2b:b0': 'Xiaomi',
  'ac:de:48': 'Private (locally administered)',
  'b8:27:eb': 'Raspberry Pi Foundation',
  'c8:69:cd': 'Xiaomi',
  'd4:ca:6d': 'Routerboard/MikroTik',
  'dc:a6:32': 'Raspberry Pi Foundation',
  'e4:5f:01': 'Raspberry Pi Foundation',
  'e8:de:27': 'Xiaomi',
  'f0:9f:c2': 'Ubiquiti',
  'f4:f5:d8': 'Ubiquiti',
  'fc:ec:da': 'Sonos'
};

export function lookupVendor(mac) {
  if (!mac) return null;
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return null;
  const oui = mac.toLowerCase().slice(0, 8);
  const local = parseInt(mac.slice(0, 2), 16);
  if ((local & 0x02) !== 0) return 'Lokalnie administrowany (losowy MAC)';
  return OUI_DB[oui] || null;
}
