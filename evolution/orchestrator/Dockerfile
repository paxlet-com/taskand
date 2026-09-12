# taskand · orkiestrator — następca nucleus v0.4
FROM docker:27-cli
COPY <<'OSH' /entry.sh
#!/bin/sh
set -eu
echo "[orchestrator] kontrola compose i pętli zadań przejęta"
while :; do docker compose -f /taskand/docker-compose.yaml ps || true; sleep 60; done
OSH
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
