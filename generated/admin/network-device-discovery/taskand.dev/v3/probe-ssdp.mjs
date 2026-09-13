// SSDP: M-SEARCH na 239.255.255.250:1900, zbieranie SERVER/USN/ST (tylko LAN).
import dgram from "node:dgram";

export function probeSsdp(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const out = [];
    let socket;
    try {
      socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch {
      resolve([]);
      return;
    }
    const done = () => {
      try { socket.close(); } catch {}
      resolve(out);
    };
    const timer = setTimeout(done, timeoutMs);
    socket.on("error", () => { clearTimeout(timer); done(); });
    socket.on("message", (msg, rinfo) => {
      try {
        const text = msg.toString("latin1");
        const server = text.match(/^SERVER:\s*(.+)$/im);
        const usn = text.match(/^USN:\s*(.+)$/im);
        let hostname = null;
        if (usn) {
          const u = usn[1].match(/uuid:([^:]+)/i);
          if (u) hostname = u[1];
        }
        out.push({
          ip: rinfo.address,
          mac: null,
          hostname,
          meta: server ? server[1].trim() : null,
          source: "ssdp",
        });
      } catch {}
    });
    socket.bind(() => {
      try {
        socket.setMulticastTTL(1);
        const msg = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nST: ssdp:all\r\nMX: 2\r\n\r\n";
        socket.send(msg, 1900, "239.255.255.250");
      } catch {}
    });
  });
}
