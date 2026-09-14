import dgram from 'node:dgram';

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const QUERY =
  'M-SEARCH * HTTP/1.1\r\n' +
  'HOST: 239.255.255.250:1900\r\n' +
  'MAN: "ssdp:discover"\r\n' +
  'MX: 2\r\n' +
  'ST: ssdp:all\r\n\r\n';

export async function probeSsdp(networks, timeoutMs = 4000) {
  const result = { ips: [] };
  if (networks.length === 0) return result;
  return await new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const finish = () => {
      try { socket.close(); } catch {}
      resolve(result);
    };
    const timer = setTimeout(finish, timeoutMs);
    socket.on('error', () => { clearTimeout(timer); finish(); });
    socket.on('message', (msg, rinfo) => {
      const ip = rinfo.address;
      if (result.ips.indexOf(ip) === -1) result.ips.push(ip);
    });
    socket.bind(() => {
      try {
        socket.setMulticastTTL(1);
        socket.send(Buffer.from(QUERY), SSDP_PORT, SSDP_ADDR);
        setTimeout(() => { try { socket.send(Buffer.from(QUERY), SSDP_PORT, SSDP_ADDR); } catch {} }, 1000);
      } catch {
        clearTimeout(timer); finish();
      }
    });
  });
}
