# brownie-to-ape benchmark results

Each row reports running the codemod against a freshly-cloned public OSS
Brownie repo. Times are wall-clock from `time` around the workflow run.

| Repo | .py files | Brownie patterns (before) | Files modified | Patterns auto-migrated | False positives | Wall-clock |
|---|---:|---:|---:|---:|---:|---:|
| [token-mix](https://github.com/brownie-mix/token-mix) | 5 | 58 | 4 | ~55 | 0 (manual audit) | 45760ms |
| [brownie_fund_me](https://github.com/PatrickAlphaC/brownie_fund_me) | 6 | 17 | 5 | ~27 | 0 (manual audit) | 15427ms |
| [smartcontract-lottery](https://github.com/PatrickAlphaC/smartcontract-lottery) | 7 | 34 | 5 | ~45 | 0 (manual audit) | 15998ms |
| [aave_brownie_py_freecode](https://github.com/PatrickAlphaC/aave_brownie_py_freecode) | 5 | 13 | 4 | ~27 | 0 (manual audit) | 15456ms |

> **Notes:**
> - "Brownie patterns (before)" = imports + tx-dicts + show_active + brownie.reverts (rough surface count, undercounts compound patterns).
> - "Patterns auto-migrated" = added `+` lines in the diff (overcounts when one Brownie pattern produces two output lines, e.g. a TODO comment + rewritten line). Treat this as a directional indicator, not an exact count.
> - "False positives" requires manual audit of the diff. The codemod was designed for zero FP and validated as such on this set; new repos should be audited the first time they run.
> - Wall-clock includes Codemod CLI startup; the workflow itself reports ~3s per repo.
