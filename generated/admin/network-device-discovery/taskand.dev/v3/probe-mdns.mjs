// mDNS: zapytanie .local na 224.0.0.251:5353, zbieranie odpowiedzi (tylko odczyt, sieci lokalne).
import dgram from "node:dgram";

export function probeMdns(timeoutMs = 3000) {
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
        // parsowanie DNS: nazwy zakończone .local w sekcji odpowiedzi (uproszczone, skan całego bufora)
        const ascii = msg.toString("latin1");
        const names = ascii.match(/[A-Za-z0-9_-]{1,63}\.local/g) || [];
        const name = names.find((n) => !/^[0-9A-Fa-f-]{12}\.local$/.test(n));
        out.push({
          ip: rinfo.address,
          mac: null,
          hostname: name ? name.replace(/\.$/, "") : null,
          source: "mdns",
        });
      } catch {}
    });
    socket.bind(() => {
      try {
        socket.setMulticastTTL(1);
        // zapytanie ANY dla _services._dns-sd._udp.local — bez wysyłania danych poza LAN
        const q = Buffer.from("0e9f01200000010000000000095f7365727669636573045f646e732d73045f756470056c6f63616c0000ff0001", "hex");
        socket.send(q, 5353, "224.0.0.251");
      } catch {}
    });
  });
}
