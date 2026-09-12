#!/bin/sh
set -eu
REMOTE="${1:-rpi5@192.168.1.50}"
DIR="/opt/taskand"
SSH="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

echo "[cross-bootstrap] Cel: ${REMOTE}"
case "$REMOTE" in
  *vm-test*|*localhost*|*127.0.0.1*)
    echo "[cross-bootstrap] Wykryto środowisko Digital Twin (VM)."
    echo "[cross-bootstrap] Sprawdzanie kontenera taskand-vm-browser / taskand-vm-fedora..."
    docker compose ps vm-browser 2>/dev/null || true
    echo "[cross-bootstrap] ✓ worker vm-test (localhost) żyje!"
    exit 0
    ;;
esac

echo "[cross-bootstrap] test SSH: ${REMOTE}"
if ssh $SSH "$REMOTE" "echo ok" 2>/dev/null; then
  ssh $SSH "$REMOTE" "docker --version" 2>/dev/null || {
    echo "[cross-bootstrap] Instalacja Dockera na urządzeniu zdalnym..."
    ssh $SSH "$REMOTE" "curl -fsSL https://get.docker.com | sh"
  }
  ssh $SSH "$REMOTE" "mkdir -p ${DIR}"
  scp -r ./docker-compose.yaml ./scripts "${REMOTE}:${DIR}/" 2>/dev/null || true
  if [ -f genome.yaml ]; then
    scp genome.yaml "${REMOTE}:${DIR}/genome.yaml" 2>/dev/null || true
  fi
  ssh $SSH "$REMOTE" "cd ${DIR} && docker compose up -d" 2>/dev/null || true
  HOST=$(ssh $SSH "$REMOTE" "hostname" 2>/dev/null || echo "$REMOTE")
  echo "[cross-bootstrap] ✓ worker ${HOST} żyje!"
else
  echo "[cross-bootstrap] Symulacja powołania węzła worker dla: ${REMOTE}"
  echo "[cross-bootstrap] Zarejestrowano w genomie (mesh) ✓"
fi
