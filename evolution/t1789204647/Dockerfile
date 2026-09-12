# taskand · task-t1789204647 · proces-Dockerfile synchronizacji repozytorium z GitHub
FROM alpine:3.20
RUN apk add --no-cache git github-cli
WORKDIR /project
COPY <<'TSK' /entry.sh
#!/bin/sh
set -eu
ORG="semcod"; REPO="taskand"
[ -n "$REPO" ] || REPO="taskand"
if [ -n "$ORG" ] && [ "$ORG" != "-" ]; then FULL="$ORG/$REPO"; else FULL="$REPO"; fi

echo "[task-t1789204647] konfiguracja poświadczeń git i katalogu..."
git config --global user.name "taskand"
git config --global user.email "taskand@local"
git config --global --add safe.directory /project
gh auth setup-git 2>/dev/null || true

cd /project
if [ ! -d ".git" ]; then
  echo "[task-t1789204647] inicjalizacja repozytorium git w projekcie..."
  git init -b main
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[task-t1789204647] dodawanie remote origin: https://github.com/$FULL.git"
  git remote add origin "https://github.com/$FULL.git"
fi

echo "[task-t1789204647] sprawdzanie zmian i commit..."
git add -A
if git diff --cached --quiet; then
  echo "[task-t1789204647] brak nowych zmian do zatwierdzenia."
else
  git commit -m "taskand: synchronizacja projektu [task-t1789204647]"
  echo "[task-t1789204647] utworzono commit."
fi

echo "[task-t1789204647] wypychanie zmian do GitHub ($FULL)..."
git push -u origin main || git push origin main --force
echo "[task-t1789204647] synchronizacja git zakończona sukcesem ✓: https://github.com/$FULL"
TSK
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]
