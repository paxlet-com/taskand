# taskand · task-t1789203531 · github-projekt · ręce: gh (auth hosta, read-only)
FROM alpine:3.20
RUN apk add --no-cache git github-cli
ENV TASKAND_ORG=semcod
ENV TASKAND_REPO=taskand
WORKDIR /work
COPY README.md /work/README.md
COPY <<'TSK' /entry.sh
#!/bin/sh
set -eu
ORG="$TASKAND_ORG"; REPO="$TASKAND_REPO"
if [ -n "$ORG" ] && [ "$ORG" != "-" ]; then FULL="$ORG/$REPO"; else FULL="$REPO"; fi
git config --global user.name "taskand"
git config --global user.email "taskand@local"
git init -q -b main . && git add README.md
git commit -qm "taskand: README od planisty"
gh repo create "$FULL" --public 2>/dev/null || echo "repo istnieje — push"
git remote add origin "https://github.com/$FULL.git"
git push -q -u origin main
echo "[task-t1789203531] repo gotowe: https://github.com/$FULL"
TSK
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
