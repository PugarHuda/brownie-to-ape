#!/usr/bin/env bash
# Structured preview of what brownie-to-ape would do to a target repo,
# without modifying anything.
#
# Usage:
#   bash scripts/preview.sh /path/to/your/brownie/project
#
# Output:
#   - Per-file diff summary (counts) emitted by the codemod's stderr stats
#   - Aggregate totals: edits, files touched, Wei rewrites, unknown
#     exceptions, brownie-attr renames
#
# Internally runs `codemod workflow run --dry-run --format jsonl` so no
# files are modified. Uses jq if available; falls back to grep + python
# for JSON parsing.

set -uo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/preview.sh <target-dir>"
  exit 2
fi

TARGET="$1"
CODEMOD_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "${TARGET}" ]]; then
  echo "ERROR: target dir not found: ${TARGET}"
  exit 3
fi

echo "==> Preview run on ${TARGET}"
echo "    (no files will be modified)"
echo

STATS_FILE="$(mktemp)"
trap 'rm -f "${STATS_FILE}"' EXIT

# Run with --dry-run; capture stderr (where our stats JSON goes) and
# discard stdout (the colored diff is verbose; user can see it via
# --dry-run alone if they want).
( cd "${CODEMOD_DIR}" && \
  npx codemod@latest workflow run \
    -w workflow.yaml \
    --target "${TARGET}" \
    --dry-run \
    --no-interactive --allow-dirty \
    2> >(grep -E '^\{"codemod"' > "${STATS_FILE}") \
    >/dev/null )

if [[ ! -s "${STATS_FILE}" ]]; then
  echo "    No files would be modified — codemod has nothing to migrate here."
  echo "    (Either this isn't a Brownie project, or it's already been migrated.)"
  exit 0
fi

echo "==> Per-file edits:"
nl_count=0
total_edits=0
total_wei=0
unknown_exc_set=""
total_attr=0

while IFS= read -r line; do
  nl_count=$((nl_count + 1))
  edits=$(echo "${line}" | python -c "import sys,json; print(json.loads(sys.stdin.read())['edits'])")
  wei=$(echo "${line}" | python -c "import sys,json; print(int(json.loads(sys.stdin.read())['wei_rewritten']))")
  attr=$(echo "${line}" | python -c "import sys,json; print(int(json.loads(sys.stdin.read())['rewrote_brownie_attr']))")
  unknown=$(echo "${line}" | python -c "import sys,json; print(','.join(json.loads(sys.stdin.read())['unknown_exceptions']))")
  total_edits=$((total_edits + edits))
  total_wei=$((total_wei + wei))
  total_attr=$((total_attr + attr))
  [[ -n "${unknown}" ]] && unknown_exc_set="${unknown_exc_set}${unknown},"
  printf '    file %-3d  edits=%-3d  wei=%-1d  attr=%-1d  unknown_exc=%s\n' \
    "${nl_count}" "${edits}" "${wei}" "${attr}" "${unknown:-none}"
done < "${STATS_FILE}"

echo
echo "==> Summary:"
echo "    Files that would be modified:    ${nl_count}"
echo "    Total edits queued:              ${total_edits}"
echo "    Files with Wei rewrites:         ${total_wei}"
echo "    Files with brownie.<attr> renames: ${total_attr}"
if [[ -n "${unknown_exc_set}" ]]; then
  uniq_unknown=$(echo "${unknown_exc_set%,}" | tr ',' '\n' | sort -u | tr '\n' ',' | sed 's/,$//')
  echo "    Unknown exception names:         ${uniq_unknown}"
else
  echo "    Unknown exception names:         (none)"
fi
echo
echo "==> Apply with:"
echo "    cd ${CODEMOD_DIR}"
echo "    npx codemod@latest workflow run -w workflow.yaml --target \"${TARGET}\" --no-interactive --allow-dirty"
