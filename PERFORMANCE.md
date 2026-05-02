# Performance — brownie-to-ape

> Centralized performance characteristics. Numbers are reproducible via
> `npm run benchmark` and the per-test budgets in `tests/qa/perf-budget.test.ts`.

## TL;DR

| Metric | Target | Actual (v0.7.6) |
|---|---|---|
| Per-file transform | < 500 ms p99 | < 50 ms typical |
| Per-repo end-to-end (5 reference repos) | < 5 s warm | ~3 s (workflow) + ~10-20 s (npx warmup) |
| Per-pure-helper invocation | < 1 ms | < 0.05 ms (1000 invocations < 50 ms) |
| 1 MB synthetic input | < 1 s | < 100 ms |
| Adversarial regex input | < 100 ms | < 10 ms (no backtracking) |

## How to reproduce

### End-to-end benchmark across 5 OSS repos

```bash
bash scripts/benchmark.sh
```

Output: `benchmark/results.md` with timing table per repo. Reset
test-repos via `cd test-repos/<repo> && git checkout -- .` between
runs.

### Per-helper micro-benchmark (Vitest)

```bash
npm run test:qa
# tests/qa/perf-budget.test.ts asserts per-fixture budget < 50 ms,
# total budget < 2000 ms, 1000 stripPyStringQuotes invocations < 50 ms.
```

## Why fast

1. **File-marker early exit**: `if (!sourceText.includes("brownie")) return null;`
   skips files unrelated to Brownie, the cheapest possible fast path.
2. **No fs / network**: jssg sandbox guarantees zero I/O during transform.
3. **Tree-sitter incremental parse**: ast-grep parses once per file; all
   17 passes reuse the same parse tree.
4. **Pattern-based `findAll`**: pre-filtered by ast-grep before our
   pass code sees nodes. No full-tree walks in our code.
5. **`commitEdits` batched**: edits accumulate as ranges; one final
   apply per file.

## Where the time goes (typical 100-LOC Brownie file)

| Phase | Approx % |
|---|---|
| Tree-sitter parse | 40 % |
| 17 passes' `findAll` queries | 30 % |
| Edit construction | 15 % |
| `commitEdits` apply | 10 % |
| String slice / concat for replacements | 5 % |

## Adversarial input handling

The codemod is regex-light. The two regexes that MUST not backtrack:

- `applyAttrRenamesToText`: `\bbrownie\.(reverts|accounts|project|config|chain)\b`
  — fully bounded by literal alternation + word boundaries. Tested on
  500-char `brownie.aaaa…brownie.reverts(xxxx…)` adversarial input,
  completes in < 10 ms.
- `stripPyStringQuotes`: `^('''|"""|'|")(.*)\1$` — anchored, no nested
  quantifiers. Tested on 50KB strings with mismatched quotes, no hang.

## Cold start

The dominant wall-clock factor is `npx codemod@latest` first-time
download (~10–20 s). After warmup, subsequent invocations re-use the
cached binary and run in ~3 s.

To eliminate cold start in CI / production:
```bash
npm i -g codemod
codemod workflow run …  # ~3 s every invocation
```

## Memory profile

Bounded by file size + parse tree size. On the 5 reference repos
(~30 .py files, ~2000 LOC max), peak heap stays under 50 MB.

## Future optimization opportunities (not yet needed)

- **`getSelector()` pre-filter at workflow level**: would skip non-Brownie
  files before AST parse. Currently the inner `includes("brownie")`
  check does the same job. ~5 % speedup on large repos.
- **Pass fusion**: combine Pass 13 + 14 (both look at `tx.events[…][…]`)
  into one ast-grep query. ~3 % speedup at cost of code complexity.
- **Streaming output**: emit edits incrementally for very large files.
  Not warranted at current scale.
