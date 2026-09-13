import net from 'node:net';

const PORTS = [80, 443, 22, 445, 139, 5000, 8080];
const CONNECT_TIMEOUT = 400;

function probePort(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok ? port : null);
    };
    socket.setTimeout(CONNECT_TIMEOUT);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, ip);
  });
}

export async function probeTcp(ips) {
  const results = [];
  const jobs = [];
  for (const ip of ips) {
    for (const port of PORTS) {
      jobs.push(probePort(ip, port).then((openPort) => {
        if (openPort) {
          const existing = results.find((r) => r.ip === ip);
          if (existing) existing.open_ports.push(openPort);
          else results.push({ ip, open_ports: [openPort] });
        }
      }));
    }
  }
  await Promise.all(jobs);
  return results;
}
