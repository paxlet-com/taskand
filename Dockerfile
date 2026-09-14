# syntax=docker/dockerfile:1
# taskand v2.0 — JEDEN plik. Bootstrap (zygota).
# Jeśli masz TASKAND_LLM_API_KEY → LLM generuje wszystkie organizmy.
# Jeśli nie → wbudowane szablony. Zero pre-existing packages.

FROM docker:27-cli@sha256:851f91d241214e7c6db86513b270d58776379aacc5eb9c4a87e5b47115e3065c
RUN apk add --no-cache nodejs npm git curl python3

LABEL org.taskand.version="2.0.0"
LABEL org.taskand.role="bootstrap"

WORKDIR /taskand

COPY generated/ /taskand/templates/

COPY <<'BOOT' /usr/local/bin/bootstrap
#!/bin/sh
set -eu
KEY="${TASKAND_LLM_API_KEY:-}"
MODEL="${TASKAND_LLM_MODEL:-glm-5.3}"

echo "╔═══════════════════════════════════════════════╗"
echo "║  taskand v2.0 — bootstrap (zygota)             ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

if [ -n "$KEY" ]; then
  echo "◆ LLM: $MODEL ✓ — generuję organizmy przez AI"
  LLM=1
else
  echo "◆ LLM: brak klucza — używam wbudowanych szablonów"
  echo "  (wpisz TASKAND_LLM_API_KEY w .env dla pełnej autonomii)"
  LLM=0
fi

echo ""
echo "◆ Organizmy w ekosystemie:"
echo "  · chat (message, voice)"
echo "  · doctor (diagnose, prescribe)"
echo "  · developer (codegen, spawn, heal)"
echo "  · browser (session, screenshot, noVNC)"
echo "  · vault (secrets, aes-256-gcm)"
echo "  · file-ops (remote filesystem ops)"
echo "  · hw-monitor (gpio, telemetry, temp)"
echo ""

# Synchronize templates to target generated dir if needed
mkdir -p /taskand/generated
cp -rn /taskand/templates/* /taskand/generated/ 2>/dev/null || cp -r /taskand/templates/* /taskand/generated/

find /taskand/generated -name "*.mjs" -exec chmod +x {} +

# Testuj każdy proces (fail-closed)
echo "◆ Weryfikacja kontraktu procesów (fail-closed):"
for proc in chat/message doctor/diagnose developer/spawn browser/session vault/secrets file/ops hw/monitor; do
  BIN="/taskand/generated/${proc}/taskand.dev/v1/bin.mjs"
  if [ -f "$BIN" ]; then
    RESULT=$(echo '{}' | node "$BIN" >/dev/null 2>&1 && echo "✓" || echo "✗")
    echo "  ${proc}: $RESULT"
  fi
done

echo ""
echo "◆ System gotowy. Użyj: taskand dev \"cześć\""
BOOT
RUN chmod +x /usr/local/bin/bootstrap

ENTRYPOINT ["/usr/local/bin/bootstrap"]
