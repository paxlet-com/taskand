#!/usr/bin/env bash
# A disposable source fixture: no production network, broker secrets or state.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
runs="${1:-3}"
[[ "$runs" =~ ^[1-9][0-9]?$ ]] || { echo 'Expected 1..99 runs' >&2; exit 2; }
case "${2:-integration}" in
  integration) suite=tests/integration_test.mjs ;;
  conformance) suite=tests/conformance.mjs ;;
  contracts) suite=tests/contract_tests.mjs ;;
  *) echo 'Expected integration, conformance or contracts' >&2; exit 2 ;;
esac
command -v bwrap >/dev/null
fixture="$(mktemp -d /tmp/taskand-diagnostic-integration.XXXXXXXX)"
trap 'rm -rf -- "$fixture"' EXIT
git ls-files --cached --others --exclude-standard -z |
  tar --null --files-from=- -cf - | tar -xf - -C "$fixture"
for ((iteration=1; iteration<=runs; iteration++)); do
  echo "Isolated $suite run $iteration/$runs"
  env -i PATH="$PATH" bwrap --unshare-net --unshare-pid --die-with-parent \
    --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib \
    --ro-bind /lib64 /lib64 --dir /etc \
    --ro-bind /etc/resolv.conf /etc/resolv.conf \
    --ro-bind /etc/hostname /etc/hostname \
    --ro-bind /etc/hosts /etc/hosts --dev /dev --proc /proc --tmpfs /tmp \
    --bind "$fixture" /workspace --chdir /workspace \
    --setenv HOME /tmp --setenv TASKAND_LLM_API_KEY '' \
    node "$suite"
done
