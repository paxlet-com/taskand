#!/bin/sh
# taskand-landing · serwowanie strony bez dockera
# użycie: sh serve.sh [port]   (domyślnie 8080)
# uruchom w katalogu z index.html — wykryje python3 / busybox / python2

PORT="${1:-8080}"
cd "$(dirname "$0")" || exit 1

if command -v python3 >/dev/null 2>&1; then
  echo "taskand-landing → http://localhost:$PORT (python3 http.server)"
  exec python3 -m http.server "$PORT"
elif command -v busybox >/dev/null 2>&1; then
  echo "taskand-landing → http://localhost:$PORT (busybox httpd)"
  exec busybox httpd -f -p "$PORT"
elif command -v python >/dev/null 2>&1; then
  echo "taskand-landing → http://localhost:$PORT (python http.server)"
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "brak python3/busybox — po prostu otwórz index.html w przeglądarce"
  exit 1
fi
