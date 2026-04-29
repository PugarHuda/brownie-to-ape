#!/usr/bin/env bash
# Self-contained demo: clone a fresh Brownie repo, run the codemod, show
# the resulting diff. Designed to be record-able with asciinema:
#
#   asciinema rec demo.cast -c "bash demo/run-demo.sh"
#
# Idempotent — re-running wipes and re-clones the demo target.

set -uo pipefail

REPO_URL="${REPO_URL:-https://github.com/brownie-mix/token-mix}"
REPO_NAME="$(basename "${REPO_URL}" .git)"
TARGET_DIR="/tmp/brownie-to-ape-demo/${REPO_NAME}"

CODEMOD_DIR="$(cd "$(dirname "$0")/.." && pwd)"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; sleep 0.6; }

step "Brownie -> Ape codemod demo"
step "Step 1: clone a public Brownie OSS repo"
rm -rf "${TARGET_DIR}"
mkdir -p "$(dirname "${TARGET_DIR}")"
git clone --depth 1 --quiet "${REPO_URL}" "${TARGET_DIR}"
echo "    Cloned ${REPO_URL} -> ${TARGET_DIR}"

step "Step 2: count Brownie patterns before migration"
py_files=$(find "${TARGET_DIR}" -name '*.py' -not -path '*/.git/*' | wc -l | tr -d ' ')
imports=$(grep -rln 'from brownie\|import brownie' "${TARGET_DIR}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
txdicts=$(grep -rEn '\{["'"'"']from["'"'"']:' "${TARGET_DIR}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
reverts=$(grep -rln 'brownie\.reverts' "${TARGET_DIR}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
echo "    .py files:                ${py_files}"
echo "    files with brownie import:${imports}"
echo "    tx-dict patterns:         ${txdicts}"
echo "    brownie.reverts calls:    ${reverts}"

step "Step 3: run the codemod"
cd "${CODEMOD_DIR}"
time npx codemod@latest workflow run \
  -w workflow.yaml \
  --target "${TARGET_DIR}" \
  --no-interactive \
  --allow-dirty 2>&1 | grep -E 'Workflow|Done|⏺' || true

step "Step 4: see what changed"
cd "${TARGET_DIR}"
git diff --stat | tail -10
echo
echo "    Sample diff (first 25 lines of one modified file):"
echo "    ----------------------------------------------------"
git diff -- '*.py' | head -25 | sed 's/^/    /'

step "Done."
echo "    Inspect full diff:    cd ${TARGET_DIR} && git diff"
echo "    Reset:                cd ${TARGET_DIR} && git checkout -- ."
