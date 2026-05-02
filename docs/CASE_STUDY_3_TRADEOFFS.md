# Engineering Tradeoffs: Why We Said No to Features in a Hackathon Codemod

> Codemod "Boring AI" Hackathon · DoraHacks 2026
> Source: [github.com/PugarHuda/brownie-to-ape](https://github.com/PugarHuda/brownie-to-ape)
> Companion case studies: [token-mix end-to-end](./MEDIUM_ARTICLE.md) · [Yearn DeFi migration](./CASE_STUDY_2_YEARN.md)

---

## TL;DR

Engineering judgment in a competitive hackathon often means saying *no* to features that look impressive but compromise the project's primary guarantee. For a codemod evaluated on `100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))`, the primary guarantee is **zero false positives**. This post walks through five features I considered for `@pugarhuda/brownie-to-ape`, why I implemented or rejected each, and what the rejections cost in superficial polish vs. what they preserved in correctness.

---

## The scoring formula determines the design

The hackathon's evaluation formula penalizes false positives at `wFP > wFN`. Concretely:

- **False positive (FP)** = an incorrect rewrite. The migrated code looks plausible but is wrong. It compiles, it might even pass shallow tests, and then breaks in subtle ways at runtime — typically when the user has already moved on and won't connect the failure to the migration.
- **False negative (FN)** = a missed pattern. The codemod left something un-migrated. The user sees this immediately because the code doesn't compile or has a `# TODO(...):` comment they can act on.

A missed pattern is *self-announcing*. An incorrect rewrite is *silent*. The math just confirms what production engineering intuition already knows: silent failures cost more than visible ones.

This single principle — *prefer FN over FP, every time* — drove every "no" below.

---

## Feature 1: Browser WASM playground — REJECTED

**The pitch.** Embed the codemod in a StackBlitz / WebContainer / Pyodide playground so users can paste Brownie code and see it transform live in-browser, without ever leaving the docs site. Many hackathon submissions ship something like this — it's a fantastic demo asset.

**The cost-benefit estimate.**

The Codemod `jssg` engine compiles its `ast-grep` + `tree-sitter` stack into a sandboxed Node runtime. Bundling those native components for the browser would require either:

- A custom WASM build of `tree-sitter-python` plus an `ast-grep-wasm` glue layer — neither officially shipped by the upstream projects.
- StackBlitz WebContainer running the codemod via `npx`, which installs many MB of native dependencies on every cold boot — too slow for an interactive demo.
- Pyodide running an entirely separate Python implementation of the same transforms — a parallel codebase to maintain in addition to the canonical TypeScript one.

Realistic effort: **8+ hours of WASM toolchain work** to get a passable demo, plus ongoing maintenance burden as `tree-sitter-python` updates upstream.

**Why we said no.** The asciinema cast at [the live demo page](https://pugarhuda.github.io/brownie-to-ape/) plays back a real `npx codemod` run inline in the browser via the `asciinema-player` CDN. Visually equivalent to a playground for evaluators — they see the codemod actually running on real code — without the WASM debt.

**What the rejection cost.** A "wow factor" we don't have. Some judges may weight live interactivity heavily. We trade that surface for engineering integrity: every claim in our codemod is reproducible from the same toolchain a real user would run.

---

## Feature 2: Stryker mutation score above 50% — REJECTED

**The pitch.** Boost the mutation score on the codemod's critical helpers from the current 38.57% baseline to >50% by extracting more pure-function helpers into testable modules.

**The architectural blocker.**

`jssg` loads `scripts/codemod.ts` as a single sandboxed module. It cannot resolve relative imports (e.g. `import { foo } from './lib'`) inside the QuickJS/LLRT runtime — the codemod CLI has no module resolver in the sandbox. Workaround: **inline all helpers** into `codemod.ts`. That makes the file ~870 LOC.

Stryker's `vitest-runner` cannot resolve those relative imports either when only mutating non-test `.ts` files — it builds a separate sandbox that recompiles each mutant in isolation. So when we extract helpers to `_helpers.ts` for unit testing, Stryker cannot reach back through that boundary to mutate the production `codemod.ts` file.

The compromise we shipped: maintain *two* parallel implementations of the helpers — the inline ones in `codemod.ts` (production) and the standalone ones in `tests/unit/_helpers.ts` (test surface for Stryker). The standalone ones are tested with 50 unit tests + Stryker mutates them at 38.57%. The inline ones are tested via the 90 fixture tests.

**Why we capped at 38.57%.** Going higher would require:

- A custom `jssg` bundler that allows imports — out of scope for a hackathon.
- A monorepo split where the helper module is built and pre-inlined at codemod-publish time — adds infrastructure complexity disproportionate to the test signal gained.
- Or aggressive duplication that drifts over time between the two helper implementations — exactly the kind of hidden bug-source that property-based testing was supposed to eliminate.

**What this teaches.** Mutation testing is gold-standard for deterministic code, but only when the test runner can mutate the same code path that runs in production. When the production runtime sandbox prevents that, mutation testing tests the *parallel* implementation, not the real one. The 38.57% is honest; pretending it's higher would be misleading.

The full architectural rationale is documented at [`docs/DEFERRED_FEATURES.md`](https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/DEFERRED_FEATURES.md) so future maintainers don't relitigate the decision.

---

## Feature 3: Per-pass full coverage ≥7 fixtures × 17 passes = 119+ fixtures — REJECTED

**The pitch.** Saturate fixture coverage so every transform pass has at least 7 input/expected pairs. Total: 119+ fixtures.

**Current state.** 90 fixtures total, distributed roughly:

- Heavy passes (Pass 1 import rewrites, Pass 4 tx-dict, Pass 8 isolate fixture): 8–12 fixtures each.
- Medium passes (Pass 2/3 attribute access, Pass 5 chain.mine, Pass 6 chain.sleep): 4–7 fixtures each.
- Lighter passes (Pass 9–13 single-purpose TODOs): 2–4 fixtures each.

**Why we capped at 90.** Diminishing returns vs. real-world signal.

Single-purpose passes like Pass 9 (`accounts.add(pk)` → inline TODO) have a *handful* of meaningful input shapes. Adding 4 more near-identical fixtures wouldn't improve confidence — it would inflate the test count cosmetically while obscuring the real signal in the test suite.

Real-world coverage signal: 5 OSS repos × ~30 patterns each = ~170 patterns exercised end-to-end via integration tests on real code. That's far more diverse than 30 more synthetic fixtures could provide.

We did add 6 targeted fixtures in v0.7.7: deeply nested attribute access, multi-line imports, comment-preserving tx-dicts, empty-string `from` value, ZERO_ADDRESS-only imports, and FP guards for string-key shadowing. These specifically caught real edge cases discovered during the OSS repo validation runs.

**The principle.** A test suite is a *specification* of behavior, not an asset to inflate. Each fixture should encode a distinct behavior — preferably a behavior that broke at least once during development.

---

## Feature 4: `accounts.add(pk)` and `interface.X(addr)` full auto-rewrite — REJECTED on FP grounds

**The pitch.** Instead of inserting `# TODO(brownie-to-ape):` comments, auto-rewrite these patterns to their Ape equivalents:

- `accounts.add(private_key)` → `accounts.import_account_from_private_key("name", "passphrase", private_key)`
- `interface.IERC20(addr)` → `Contract(addr)`

**Why this would break our 0-FP guarantee.**

`accounts.add(...)` requires *two* extra arguments in Ape — alias name + passphrase — that don't exist in the Brownie call. We can't invent them. A blind rewrite would produce code that doesn't run.

`interface.IERC20(addr)` *might* be replaceable with `Contract(addr)` — but only if the user has an ABI registered for that interface name. Without project schema introspection (which the jssg sandbox cannot do — no fs/network access), we can't confirm safety.

The hackathon's scoring formula penalizes FP at `wFP = 5×wFN` (per typical interpretations). Even one accidentally-broken `accounts.add` call in a real codebase would outweigh all the FN we'd save by attempting an unsafe auto-rewrite.

**The TODO approach is correct here.** Flag the pattern + tell the AI agent / user exactly what to do. The codemod's job is the deterministic 85%; these last-mile patterns are inherently project-specific and need human/AI judgment.

**What it cost.** Two passes that look incomplete on paper. A competing codemod could ship blanket auto-rewrites and claim "100% coverage" in their README — and silently break repos. Our README documents the FN as an intentional, principled choice.

---

## Feature 5: Pre-commit hook — REJECTED on use-case grounds

**The pitch.** Ship a `.pre-commit-hooks.yaml` config that lets users install the codemod as a pre-commit hook to prevent new Brownie code from being committed.

**Why this is the wrong abstraction.**

Brownie is deprecated. New projects don't start in Brownie. Existing Brownie projects need a one-time migration, not continuous prevention. A pre-commit hook running the codemod on every commit would be:

- **Slow.** 3+ seconds × every staged Python file = unacceptable friction on every commit.
- **Surprising.** Auto-edits files at commit time without explicit consent.
- **Wrong tool for the job.** The right prevention pattern for "don't commit new Brownie imports" is a lint rule (e.g., a flake8 plugin or a ruff rule) that *flags* Brownie imports at PR time. That's a separate tool — not this codemod's scope.

**The general principle.** A codemod migrates. A linter prevents. Don't conflate them just because both can be run on a file.

---

## What this rejected list signals to evaluators

Each of these "no's" is documented at [`docs/DEFERRED_FEATURES.md`](https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/DEFERRED_FEATURES.md) in the repo. The doc exists for two reasons:

1. **Future contributors** can read the rationale and avoid relitigating decisions. If someone files a PR adding `accounts.add` auto-rewrite, the response is to point them at the FP discussion in the doc.
2. **Hackathon evaluators** can see the engineering judgment, not just the artifact. A codemod that ships *what's solid* and documents *what was deliberately omitted* is more trustworthy than one that pads its README with weakly-supported claims.

The hackathon's stated goal is "Automate 80%+ of the migration; minimize manual work." We hit ~85% deterministic automation with **zero false positives across 5 OSS repos** including [Yearn Finance](./CASE_STUDY_2_YEARN.md). Pushing automation higher by accepting any FP would defeat the purpose — the user's "manual cleanup" workload would shift from "follow the TODO comments" to "audit every line of the migration to find the silent breakage."

---

## How to verify the rejected features stayed rejected

Each rejected feature has an associated property test or fixture that catches accidental implementation:

- **`accounts.add` auto-rewrite:** fixture `tests/fixtures/30-accounts-add-statement/` asserts the output keeps the original `accounts.add(...)` call and adds an inline TODO. If a future PR aggressively rewrites it, this fixture fails.
- **`interface.IERC20` auto-rewrite:** fixture `tests/fixtures/24-interface-ierc20/` does the same.
- **WASM/playground:** no test, but the absence of `wasm`, `wasm32`, or `cdn.jsdelivr` build artifacts in CI is verified by `tests/qa/version-consistency.test.ts`.

The `qa/version-consistency.test.ts` suite also verifies that no `MUTATION_SCORE` claim in the docs exceeds the actual Stryker output — preventing accidental drift if someone bumps the README badge without rerunning Stryker.

---

## Pull-quote for the impatient

> Engineering judgment in a hackathon often means saying *no* to features that look impressive but compromise the primary guarantee. For a codemod evaluated on FP-vs-FN math, the primary guarantee is **zero false positives**. Every "no" in this post preserved that guarantee at the cost of surface polish.

---

## Acknowledgements

- [Codemod](https://codemod.com/) for designing a hackathon framing that rewards engineering rigor over surface area.
- The [ApeWorx team](https://apeworx.io/) for being responsive to GitHub issues and merging community migration docs.
- [Anthropic Claude](https://claude.com/) for collaborative authoring of the deferred-features rationale.

---

**Source:** [github.com/PugarHuda/brownie-to-ape](https://github.com/PugarHuda/brownie-to-ape) · v0.7.8 · MIT
**Codemod registry:** [`@pugarhuda/brownie-to-ape`](https://app.codemod.com/registry/@pugarhuda/brownie-to-ape)
**Related:** [token-mix end-to-end case study](./MEDIUM_ARTICLE.md) · [Yearn DeFi migration](./CASE_STUDY_2_YEARN.md)
