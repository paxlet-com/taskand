#!/bin/sh
# taskand — instalator v0.4 (to robi: curl -fsSL taskand.com | sh)
# bootstrap startuje jako KONTENER interaktywny: pytania w shellu,
# każdy krok instalacji jako proces-Dockerfile, potem compose przejmuje.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"

# Jeśli jesteśmy w katalogu projektu z gotowymi plikami:
if [ -f "docker-compose.yaml" ] && { [ -f "Dockerfile" ] || [ -f "bootstrap/Dockerfile" ]; }; then
  [ -f Dockerfile ] || cp bootstrap/Dockerfile Dockerfile
  mkdir -p answers tasks evolution log gateway
  [ -f gateway/Dockerfile ] || { [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/gateway/Dockerfile" ] && cp "$SCRIPT_DIR/gateway/Dockerfile" gateway/Dockerfile; }
  [ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }
else
  mkdir -p taskand/answers taskand/tasks taskand/evolution taskand/log taskand/gateway
  cd taskand

  # 1. Preferuj lokalne pliki z repozytorium (obok taskand.sh)
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/docker-compose.yaml" ]; then
    [ -f Dockerfile ]          || cp "$SCRIPT_DIR/Dockerfile" Dockerfile 2>/dev/null || cp "$SCRIPT_DIR/bootstrap/Dockerfile" Dockerfile
    [ -f docker-compose.yaml ] || cp "$SCRIPT_DIR/docker-compose.yaml" docker-compose.yaml
    [ -f gateway/Dockerfile ]  || cp "$SCRIPT_DIR/gateway/Dockerfile" gateway/Dockerfile
    [ -f .env.example ]        || cp "$SCRIPT_DIR/.env.example" .env.example
  else
    # 2. Tryb instalatora zdalnego (curl ... | sh)
    safe_curl(){
      url="$1"; out="$2"
      if [ ! -s "$out" ] || grep -q "maintenance" "$out" 2>/dev/null; then
        if curl -fsSL "$url" -o "$out.tmp" 2>/dev/null && [ -s "$out.tmp" ] && ! grep -q "maintenance" "$out.tmp"; then
          mv "$out.tmp" "$out"
        else
          rm -f "$out.tmp"
        fi
      fi
    }
    safe_curl taskand.com/Dockerfile           Dockerfile
    safe_curl taskand.com/docker-compose.yaml  docker-compose.yaml
    safe_curl taskand.com/gateway.Dockerfile   gateway/Dockerfile
    safe_curl taskand.com/.env.example         .env.example
  fi

  [ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }
fi

printf 'taskand: chcesz planistę GLM-5.3? wklej klucz do .env (TASKAND_LLM_API_KEY), potem Enter…\n'
read -r _
docker build -q -t taskand-bootstrap .
docker run -it --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$(pwd)":/taskand \
  -e TASKAND_HOST_DIR="$(pwd)" \
  -e TASKAND_HOST_HOME="$HOME" \
  taskand-bootstrap
