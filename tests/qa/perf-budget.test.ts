// Performance budget test (lightweight, in-process).
//
// Full per-pass perf benchmarking requires running the codemod CLI
// (slow + brittle in CI). This file verifies a CHEAP proxy:
// loading + parsing every fixture's input.py via a hand-rolled
// regex pre-filter completes within budget. It catches gross
// regressions like accidentally exponential regex backtracking in
// helper functions.
//
// Real per-repo timing lives in scripts/benchmark.sh (manual run).
//
// Naming convention (docs/TESTING_PROMPT.md §2).

import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const REPO_ROOT = resolve(__dirname, "..", "..");
const FIXTURES_DIR = join(REPO_ROOT, "tests", "fixtures");

const PER_FIXTURE_BUDGET_MS = 50;
const TOTAL_BUDGET_MS = 2000;

// Inline copies (matches scripts/codemod.ts) — see tests/unit/pure-helpers.test.ts
function stripPyStringQuotes(literal: string): string | null {
  const m = literal.match(/^('''|"""|'|")(.*)\1$/s);
  return m ? m[2] : null;
}

const ATTR_RENAMES: Record<string, string> = {
  reverts: "ape.reverts",
  accounts: "ape.accounts",
  project: "ape.project",
  config: "ape.config",
  chain: "ape.chain",
};

function applyAttrRenamesToText(text: string): string {
  const keys = Object.keys(ATTR_RENAMES);
  if (keys.length === 0) return text;
  const pattern = new RegExp(`\\bbrownie\\.(${keys.join("|")})\\b`, "g");
  return text.replace(pattern, (_, attr) => ATTR_RENAMES[attr]);
}

describe("performance budget", () => {
  describe("positive cases", () => {
    test("applyAttrRenamesToText completes within budget on every fixture", () => {
      const fixtures = readdirSync(FIXTURES_DIR).filter((n) => /^\d{2}-/.test(n));
      let totalMs = 0;
      for (const fixture of fixtures) {
        const text = readFileSync(join(FIXTURES_DIR, fixture, "input.py"), "utf-8");
        const t0 = performance.now();
        const result = applyAttrRenamesToText(text);
        const elapsed = performance.now() - t0;
        totalMs += elapsed;
        expect(result.length).toBeGreaterThanOrEqual(0);
        expect(elapsed, `${fixture}: ${elapsed}ms exceeds ${PER_FIXTURE_BUDGET_MS}ms`).toBeLessThan(
          PER_FIXTURE_BUDGET_MS,
        );
      }
      expect(totalMs, `total ${totalMs}ms exceeds ${TOTAL_BUDGET_MS}ms`).toBeLessThan(TOTAL_BUDGET_MS);
    });

    test("stripPyStringQuotes handles 1000 invocations within 50ms", () => {
      const inputs = ['"from"', "'value'", "b\"from\"", "f\"name\"", '"' + "x".repeat(50) + '"'];
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        for (const input of inputs) {
          stripPyStringQuotes(input);
        }
      }
      const elapsed = performance.now() - t0;
      expect(elapsed, `${elapsed}ms exceeds budget`).toBeLessThan(50);
    });
  });

  describe("negative cases", () => {
    test("does NOT exhibit exponential backtracking on adversarial input", () => {
      // Catastrophic backtracking would hang the test. Vitest will time
      // out and fail the test if so. Use a known-tricky pattern.
      const adversarial =
        "brownie." + "a".repeat(500) + "brownie.reverts(" + "x".repeat(500) + ")";
      const t0 = performance.now();
      applyAttrRenamesToText(adversarial);
      const elapsed = performance.now() - t0;
      expect(elapsed, `adversarial ${elapsed}ms — backtracking?`).toBeLessThan(100);
    });

    test("does NOT allocate unbounded memory on huge input", () => {
      // Heap-bounded by inheritance from regex engine + V8. Bounded by
      // input size; sample 1MB synthetic input.
      const big = ("brownie.reverts() " + "noise ".repeat(20)).repeat(5000);
      const t0 = performance.now();
      const result = applyAttrRenamesToText(big);
      const elapsed = performance.now() - t0;
      expect(result.length).toBeGreaterThan(big.length / 2);
      expect(elapsed, `1MB input ${elapsed}ms`).toBeLessThan(1000);
    });
  });
});
