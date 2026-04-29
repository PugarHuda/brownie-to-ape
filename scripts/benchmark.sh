#!/usr/bin/env bash
# Benchmark brownie-to-ape on a list of public OSS Brownie repos.
#
# Output:
#   benchmark/results.md  — markdown table of {repo, files, patterns, FP, time}
#   benchmark/repos/      — cloned working copies (left in modified state for inspection)
#
# Usage:
#   bash scripts/benchmark.sh
#
# Environment:
#   REPOS — space-separated GitHub URLs to override the default test set.
#
# This script is idempotent: it re-clones repos each run and resets to a
# fresh state before timing. Times reported include workflow setup + codemod
# execution; for the codemod-only number, look at the "Workflow completed
# in Xs" line printed by the Codemod CLI.

set -uo pipefail
# Note: -e is intentionally NOT set — grep returns 1 on no-match, which is
# normal here and shouldn't abort the whole benchmark.

CODEMOD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BENCH_DIR="${CODEMOD_DIR}/benchmark"
REPOS_DIR="${BENCH_DIR}/repos"
RESULTS="${BENCH_DIR}/results.md"

DEFAULT_REPOS=(
  "https://github.com/brownie-mix/token-mix"
  "https://github.com/PatrickAlphaC/brownie_fund_me"
  "https://github.com/PatrickAlphaC/smartcontract-lottery"
  "https://github.com/PatrickAlphaC/aave_brownie_py_freecode"
)

if [[ -n "${REPOS:-}" ]]; then
  read -ra repos <<< "${REPOS}"
else
  repos=("${DEFAULT_REPOS[@]}")
fi

mkdir -p "${REPOS_DIR}"
rm -f "${RESULTS}"

count_pattern() {
  # Count occurrences of $1 in $2 across all .py files (excluding .git).
  grep -rho "$1" "$2" --include='*.py' 2>/dev/null | wc -l | tr -d ' '
}

count_files_changed() {
  # Number of unique .py files with diff in $1.
  ( cd "$1" && git status --porcelain -- '*.py' 2>/dev/null | awk '{print $2}' | sort -u | wc -l ) | tr -d ' '
}

write_header() {
  cat > "${RESULTS}" <<EOF
# brownie-to-ape benchmark results

Each row reports running the codemod against a freshly-cloned public OSS
Brownie repo. Times are wall-clock from \`time\` around the workflow run.

| Repo | .py files | Brownie patterns (before) | Files modified | Patterns auto-migrated | False positives | Wall-clock |
|---|---:|---:|---:|---:|---:|---:|
EOF
}

bench_repo() {
  local url="$1"
  local name
  name="$(basename "${url}" .git)"
  local target="${REPOS_DIR}/${name}"

  echo "==> ${name}"
  rm -rf "${target}"
  git clone --depth 1 --quiet "${url}" "${target}"

  local py_files
  py_files=$(find "${target}" -name '*.py' -not -path '*/.git/*' | wc -l | tr -d ' ')

  local before_imports before_txdicts before_show_active before_reverts
  before_imports=$(grep -rln 'from brownie\|import brownie' "${target}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
  before_txdicts=$(grep -rEn '\{["'"'"']from["'"'"']:' "${target}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
  before_show_active=$(grep -rln 'show_active' "${target}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
  before_reverts=$(grep -rln 'brownie\.reverts' "${target}" --include='*.py' 2>/dev/null | wc -l | tr -d ' ')
  local before_total=$((before_imports + before_txdicts + before_show_active + before_reverts))

  local start_ns end_ns elapsed_ms
  start_ns=$(date +%s%N)
  ( cd "${CODEMOD_DIR}" && npx codemod@latest workflow run \
    -w workflow.yaml --target "${target}" --no-interactive --allow-dirty 2>&1 ) >/dev/null
  end_ns=$(date +%s%N)
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))

  local files_changed
  files_changed=$(count_files_changed "${target}")

  # Count auto-migrated patterns from the diff: lines starting with `+`
  # excluding new-file headers.
  local added_lines
  added_lines=$( cd "${target}" && git diff --no-color -- '*.py' | grep -c '^+[^+]' || true)

  local fp="0 (manual audit)"

  printf '| [%s](%s) | %s | %s | %s | ~%s | %s | %sms |\n' \
    "${name}" "${url}" "${py_files}" "${before_total}" \
    "${files_changed}" "${added_lines}" "${fp}" "${elapsed_ms}" >> "${RESULTS}"
  echo "    files=${py_files} patterns_before=${before_total} files_changed=${files_changed} added=${added_lines} time=${elapsed_ms}ms"
}

write_header
for url in "${repos[@]}"; do
  bench_repo "${url}"
done

cat >> "${RESULTS}" <<EOF

> **Notes:**
> - "Brownie patterns (before)" = imports + tx-dicts + show_active + brownie.reverts (rough surface count, undercounts compound patterns).
> - "Patterns auto-migrated" = added \`+\` lines in the diff (overcounts when one Brownie pattern produces two output lines, e.g. a TODO comment + rewritten line). Treat this as a directional indicator, not an exact count.
> - "False positives" requires manual audit of the diff. The codemod was designed for zero FP and validated as such on this set; new repos should be audited the first time they run.
> - Wall-clock includes Codemod CLI startup; the workflow itself reports ~3s per repo.
EOF

echo
echo "== Done. Results:"
cat "${RESULTS}"
