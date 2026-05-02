#!/usr/bin/env bash
# Pre-flight check before running brownie-to-ape on a target repo.
#
# Reports what the codemod will likely do without actually running it.
# Useful for users hesitant to run a transform tool against their code.
#
# Usage:
#   bash scripts/preflight.sh /path/to/your/brownie/project

set -uo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/preflight.sh <target-dir>"
  exit 2
fi

TARGET="$1"
if [[ ! -d "${TARGET}" ]]; then
  echo "ERROR: target not found: ${TARGET}"
  exit 3
fi

echo "==> Pre-flight check on ${TARGET}"
echo

# 1. Is it a git repo? Codemod likes to commit clean.
if [[ -d "${TARGET}/.git" ]]; then
  cd "${TARGET}"
  if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "  WARN: working tree is dirty. Pass --allow-dirty to codemod, or commit first."
  else
    echo "  [OK] git working tree is clean"
  fi
  cd - > /dev/null
else
  echo "  WARN: not a git repository — diff/rollback won't work."
fi

# 2. Python files
py_files=$(find "${TARGET}" -name '*.py' -not -path '*/.git/*' 2>/dev/null | wc -l | tr -d ' ')
echo "  [INFO] Python files in scope: ${py_files}"

# 3. Brownie config
if [[ -f "${TARGET}/brownie-config.yaml" ]]; then
  echo "  [OK] brownie-config.yaml found — run scripts/migrate_config.py separately to convert"
else
  echo "  [INFO] no brownie-config.yaml — skip migrate_config.py"
fi

# 4. Pattern surface count
imports=$(grep -rln 'from brownie\|import brownie' "${TARGET}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
txdicts=$(grep -rEn '\{["'"'"']from["'"'"']:' "${TARGET}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
reverts=$(grep -rln 'brownie\.reverts' "${TARGET}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
show_active=$(grep -rln 'show_active()' "${TARGET}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
wei_calls=$(grep -rln 'Wei(' "${TARGET}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')

echo "  [INFO] Brownie import statements:           ${imports}"
echo "  [INFO] tx-dict patterns ({\"from\": ...}):    ${txdicts}"
echo "  [INFO] brownie.reverts(...) calls:          ${reverts}"
echo "  [INFO] network.show_active() calls:         ${show_active}"
echo "  [INFO] Wei(...) constructor calls:          ${wei_calls}"

# 5. Likely ape-already-migrated indicator
existing_ape=$(grep -rln 'from ape import' "${TARGET}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
if [[ "${existing_ape}" -gt 0 ]]; then
  echo "  [WARN] Already-migrated files detected (${existing_ape}). Codemod is idempotent — re-running is safe but consider why."
fi

# 6. Estimate
total=$((imports + txdicts + reverts + show_active + wei_calls))
echo
echo "==> Estimate:"
echo "  Brownie patterns surface count: ${total}"
echo "  Estimated transform time:       ~3 seconds"
echo "  Estimated manual cleanup:       ~5–30 minutes (contract artifact references)"
echo
echo "==> Apply (when ready):"
echo "  npx codemod@latest @pugarhuda/brownie-to-ape -t \"${TARGET}\""
echo "  python scripts/migrate_config.py \"${TARGET}\""
