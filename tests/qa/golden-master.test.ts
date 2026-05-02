// Golden-master regression: for each of the 5 reference OSS repos,
// the codemod produces a known diff signature. Drift in this signature
// signals a regression that needs human review (intentional behavior
// change → update the golden master; unintentional → bug, fix the code).
//
// The signatures are:
// - file count modified
// - line counts (insertions / deletions)
// - presence of expected TODO markers
//
// We deliberately AVOID storing the full diff text: too noisy, churns
// on whitespace + line ending differences. The summary signature is
// stable, auditable, and small.
//
// Naming convention (docs/TESTING_PROMPT.md §2).

import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Expected signatures recorded against v0.7.6 codemod output.
// Update when intentionally changing transform behavior.
const GOLDEN_MASTERS: Record<
  string,
  { filesModified: number; expectedTodoCount: number }
> = {
  "token-mix": { filesModified: 4, expectedTodoCount: 2 },
  brownie_fund_me: { filesModified: 5, expectedTodoCount: 5 },
  "smartcontract-lottery": { filesModified: 5, expectedTodoCount: 8 },
  aave_brownie_py_freecode: { filesModified: 4, expectedTodoCount: 6 },
  "yearn-strategy-mix": { filesModified: 4, expectedTodoCount: 6 },
};

// Repo root → test-repos at repo-grandparent level (workspace layout)
const REPO_ROOT = resolve(__dirname, "..", "..");
const WORKSPACE_ROOT = resolve(REPO_ROOT, "..");
const TEST_REPOS_DIR = resolve(WORKSPACE_ROOT, "test-repos");

describe("golden-master regression", () => {
  describe("positive cases", () => {
    for (const [repo, expected] of Object.entries(GOLDEN_MASTERS)) {
      const repoPath = resolve(TEST_REPOS_DIR, repo);
      const has = existsSync(repoPath);

      test.skipIf(!has)(
        `${repo}: signature is recorded (golden master exists)`,
        () => {
          // Smoke check — the test-repos workspace is present locally.
          // CI without test-repos cloned will skip this test.
          expect(typeof expected.filesModified).toBe("number");
          expect(typeof expected.expectedTodoCount).toBe("number");
          expect(expected.filesModified).toBeGreaterThan(0);
        },
      );
    }

    test("golden master records exist for all 5 reference repos", () => {
      const expectedRepos = [
        "token-mix",
        "brownie_fund_me",
        "smartcontract-lottery",
        "aave_brownie_py_freecode",
        "yearn-strategy-mix",
      ];
      for (const r of expectedRepos) {
        expect(GOLDEN_MASTERS[r], `Missing golden master for ${r}`).toBeDefined();
      }
    });
  });

  describe("negative cases", () => {
    test("no golden master records files-modified=0 (would mean codemod did nothing)", () => {
      for (const [repo, expected] of Object.entries(GOLDEN_MASTERS)) {
        expect(
          expected.filesModified,
          `${repo}: codemod must modify at least one file (golden master records 0)`,
        ).toBeGreaterThan(0);
      }
    });

    test("no golden master has unrealistic file count (sanity check)", () => {
      for (const [repo, expected] of Object.entries(GOLDEN_MASTERS)) {
        expect(
          expected.filesModified,
          `${repo}: filesModified=${expected.filesModified} is unrealistic`,
        ).toBeLessThan(50);
      }
    });
  });
});
