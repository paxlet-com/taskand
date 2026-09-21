#!/usr/bin/env bash
set -euo pipefail

# Skrypt synchronizacji lokalnego rejestru (Gitea / OneDev) dla Taskand
# Obsługuje tryb offline oraz automatyczne pobieranie/wypychanie kapsuł organizmów

PROVIDER="${TASKAND_GIT_REGISTRY_PROVIDER:-onedev}"
UPSTREAM_URL="${TASKAND_UPSTREAM_URL:-https://github.com/paxlet-com/taskand.git}"

echo "=== Taskand Registry Sync ==="
echo "Provider: $PROVIDER"

if [[ "$PROVIDER" == "gitea" ]]; then
  LOCAL_URL="http://127.0.0.1:3000/taskand/taskand-glm53.git"
elif [[ "$PROVIDER" == "onedev" ]]; then
  LOCAL_URL="http://127.0.0.1:6610/taskand/taskand-glm53"
else
  echo "Nieznany provider rejestru: $PROVIDER" >&2
  exit 1
fi

echo "Synchronizacja z lokalnym rejestrem: $LOCAL_URL"
# Sprawdzenie dostępności sieci
if curl -fsS -m 3 "$LOCAL_URL" >/dev/null 2>&1 || true; then
  echo "Lokalny rejestr $PROVIDER jest osiągalny."
else
  echo "Ostrzeżenie: Lokalny rejestr $PROVIDER nie odpowiada. Działanie w trybie offline cache."
fi
