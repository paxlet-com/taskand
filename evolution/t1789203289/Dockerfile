FROM alpine:3.20
COPY <<'RUNSH' /entry.sh
#!/bin/sh
while :; do echo "[task-t1789203289] obserwuj · $(date +%H:%M:%S)"; sleep 60; done
RUNSH
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
