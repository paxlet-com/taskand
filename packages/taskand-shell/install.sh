#!/usr/bin/env bash
# Explicit local sources; no checkout discovery and no credentials.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo "Usage: $0 /path/to/paxlet /path/to/nl-dsl-sh" >&2
  exit 2
fi
shell_repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
shell_venv="$shell_repo_root/.subactor/cache/shell-venv"
python3 -m venv "$shell_venv"
"$shell_venv/bin/python" -m pip install "$1" "$2"
"$shell_venv/bin/python" - <<'PY'
from importlib.metadata import version
for name, expected in (("paxlet", "0.1.4"), ("nl-dsl-sh", "0.2.0")):
    observed = version(name)
    if observed != expected:
        raise SystemExit(f"Unsupported {name} version: {observed}; expected {expected}")
print("Taskand shell dependencies installed")
PY
printf 'TASKAND_SHELL_PYTHON=%s/bin/python\n' "$shell_venv"
