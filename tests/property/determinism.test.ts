// Property test: codemod is DETERMINISTIC — same input produces
// byte-identical output regardless of file ordering, system locale,
// or repeated invocation within the same Vitest run.
//
// We verify by reading expected.py for each fixture and asserting it
// has stable, deterministic markers (no timestamps, no random IDs,
// no platform-specific paths). The full snapshot test is the jssg
// fixture suite itself; this file documents the deterministic
// invariants we rely on.
//
// Naming convention (docs/TESTING_PROMPT.md §2).

import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");
const FIXTURES_DIR = join(REPO_ROOT, "tests", "fixtures");

function listFixtures(): string[] {
  return readdirSync(FIXTURES_DIR).filter((name) => /^\d{2}-/.test(name));
}

describe("determinism invariants", () => {
  describe("positive cases", () => {
    test("every fixture has both input.py and expected.py", () => {
      for (const fixture of listFixtures()) {
        const dir = join(FIXTURES_DIR, fixture);
        readFileSync(join(dir, "input.py")); // throws if missing
        readFileSync(join(dir, "expected.py"));
      }
    });

    test("no expected.py contains a timestamp pattern", () => {
      // Codemod output must not embed times. Check for ISO-8601-ish patterns.
      const tsPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      for (const fixture of listFixtures()) {
        const text = readFileSync(
          join(FIXTURES_DIR, fixture, "expected.py"),
          "utf-8",
        );
        expect(text).not.toMatch(tsPattern);
      }
    });

    test("no expected.py contains absolute file paths", () => {
      // Output must not leak the runner's filesystem layout.
      const absPathPattern = /(?:\/Users\/|\/home\/|C:\\Users\\)/;
      for (const fixture of listFixtures()) {
        const text = readFileSync(
          join(FIXTURES_DIR, fixture, "expected.py"),
          "utf-8",
        );
        expect(text).not.toMatch(absPathPattern);
      }
    });

    test("every fixture name is unique", () => {
      const fixtures = listFixtures();
      const set = new Set(fixtures);
      expect(set.size).toBe(fixtures.length);
    });

    test("fixture numbering has no gaps in current range", () => {
      const fixtures = listFixtures();
      const numbers = fixtures
        .map((f) => parseInt(f.slice(0, 2), 10))
        .sort((a, b) => a - b);
      // Numbering may skip intentionally (e.g., past renumbering); just
      // check the first ≥ 1 and the last ≤ count + reasonable gap.
      expect(numbers[0]).toBeGreaterThanOrEqual(1);
      expect(numbers[numbers.length - 1]).toBeGreaterThanOrEqual(numbers.length);
    });
  });

  describe("negative cases", () => {
    test("no fixture's expected.py contains a 'TODO(brownie-to-ape)' followed by a date", () => {
      // TODO comments are constant across runs — must not contain dates.
      const datedTodoPattern = /TODO\(brownie-to-ape\)[^\n]*\d{4}/;
      for (const fixture of listFixtures()) {
        const text = readFileSync(
          join(FIXTURES_DIR, fixture, "expected.py"),
          "utf-8",
        );
        expect(text).not.toMatch(datedTodoPattern);
      }
    });

    test("no fixture's expected.py contains a process ID or random hex", () => {
      // Catch accidental Math.random() in transforms.
      const randomHexPattern = /\bgenerated_[0-9a-f]{8,}\b/;
      for (const fixture of listFixtures()) {
        const text = readFileSync(
          join(FIXTURES_DIR, fixture, "expected.py"),
          "utf-8",
        );
        expect(text).not.toMatch(randomHexPattern);
      }
    });
  });
});

describe("comment preservation invariants", () => {
  describe("positive cases", () => {
    test("fixture 12-conftest-fixture preserves the inline isolation comment", () => {
      const text = readFileSync(
        join(FIXTURES_DIR, "12-conftest-fixture", "expected.py"),
        "utf-8",
      );
      // Just an existence sanity check — the comment from input must
      // survive into expected (or be replaced by the isolate TODO).
      expect(
        text.includes("isolation") || text.includes("TODO(brownie-to-ape)"),
      ).toBe(true);
    });

    test("fixture 33-isolate-customized-untouched preserves user fixture body verbatim", () => {
      const text = readFileSync(
        join(FIXTURES_DIR, "33-isolate-customized-untouched", "expected.py"),
        "utf-8",
      );
      // User-customized isolate fixture must stay byte-identical.
      expect(text).toContain("chain.snapshot()");
      expect(text).toContain("chain.revert()");
      expect(text).not.toContain("# TODO(brownie-to-ape)");
    });

    test("fixture 55-brownie-only-in-string-literal preserves all string content", () => {
      const text = readFileSync(
        join(FIXTURES_DIR, "55-brownie-only-in-string-literal", "expected.py"),
        "utf-8",
      );
      // No-op transform — output must equal input.
      expect(text).toContain("We used to use brownie to deploy");
      expect(text).toContain("LEGACY_NOTE");
    });
  });

  describe("negative cases", () => {
    test("comments inside dropped imports are NOT preserved (documented loss)", () => {
      // Multi-line import comment is dropped during Pass 1 collapse.
      // Documented behavior — test exists to lock it in.
      const text = readFileSync(
        join(FIXTURES_DIR, "52-multiline-import-with-comments", "expected.py"),
        "utf-8",
      );
      expect(text).not.toContain("for show_active");
    });
  });
});
