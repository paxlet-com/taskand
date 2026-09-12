# taskand · task-t1789203598 · proces-Dockerfile usuwający zbędne duplikaty
FROM alpine:3.20
WORKDIR /project
COPY <<'TSK' /entry.sh
#!/bin/sh
set -eu
if [ -d "/project/taskand" ]; then
  echo "[task-t1789203598] wykryto zbędny podkatalog /project/taskand — usuwanie..."
  rm -rf /project/taskand
  echo "[task-t1789203598] ✓ podkatalog taskand usunięty pomyślnie."
else
  echo "[task-t1789203598] brak podkatalogu taskand do usunięcia."
fi
echo "[task-t1789203598] czyszczenie zakończone sukcesem ✓"
TSK
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
