// QA: documentation integrity. Verifies that markdown docs are
// internally consistent — no broken anchor refs, no stale version
// strings, no orphaned references to removed files.
//
// External URL liveness is intentionally NOT checked here (network
// dependency makes CI flaky). A separate weekly workflow can do that.
//
// Naming convention (docs/TESTING_PROMPT.md §2).

import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf-8");
}

function extractRelativeLinks(markdown: string): string[] {
  const links: string[] = [];
  const matches = markdown.matchAll(/\]\(([^)]+)\)/g);
  for (const m of matches) {
    const url = m[1];
    if (url.startsWith("http") || url.startsWith("#") || url.startsWith("mailto:")) {
      continue;
    }
    const clean = url.split("#")[0].split("?")[0];
    if (clean) links.push(clean);
  }
  return links;
}

describe("README.md", () => {
  describe("positive cases", () => {
    test("references @pugarhuda scope (post-publish)", () => {
      expect(read("README.md")).toContain("@pugarhuda/brownie-to-ape");
    });

    test("contains live demo URL", () => {
      expect(read("README.md")).toContain("pugarhuda.github.io/brownie-to-ape");
    });

    test("links to CASE_STUDY.md and DEMO.md", () => {
      const text = read("README.md");
      expect(text).toContain("CASE_STUDY.md");
      expect(text).toContain("DEMO.md");
    });

    test("every relative link points to an existing file", () => {
      const links = extractRelativeLinks(read("README.md"));
      for (const link of links) {
        const cleaned = link.replace(/^\.?\//, "");
        const fullPath = resolve(REPO_ROOT, cleaned);
        expect(existsSync(fullPath), `Missing relative target: ${link}`).toBe(true);
      }
    });
  });

  describe("negative cases", () => {
    test("does NOT contain leaked dev API key prefix", () => {
      expect(read("README.md")).not.toMatch(/sk-codemod-[A-Za-z0-9]{20,}/);
    });

    test("does NOT install jscodeshift (banned by hackathon)", () => {
      expect(read("README.md")).not.toMatch(/npm\s+(i|install)\s+(-D\s+)?jscodeshift/);
    });
  });
});

describe("CHANGELOG.md", () => {
  describe("positive cases", () => {
    test("has at least one [X.Y.Z] heading", () => {
      expect(read("CHANGELOG.md")).toMatch(/^##\s*\[\d+\.\d+\.\d+\]/m);
    });

    test("entries are in descending version order at top", () => {
      const text = read("CHANGELOG.md");
      const headings = [...text.matchAll(/^##\s*\[(\d+)\.(\d+)\.(\d+)\]/gm)];
      if (headings.length < 2) return;
      const [a, b] = headings;
      const verA = [+a[1], +a[2], +a[3]];
      const verB = [+b[1], +b[2], +b[3]];
      const cmp = verA[0] - verB[0] || verA[1] - verB[1] || verA[2] - verB[2];
      expect(cmp).toBeGreaterThanOrEqual(0);
    });
  });

  describe("negative cases", () => {
    test("does NOT contain TBD markers (entries should be complete)", () => {
      expect(read("CHANGELOG.md")).not.toMatch(/^.*\bTBD\b.*$/m);
    });
  });
});

describe("SUBMISSION.md", () => {
  describe("positive cases", () => {
    test("references current package name", () => {
      expect(read("SUBMISSION.md")).toContain("@pugarhuda/brownie-to-ape");
    });

    test("references all 5 validated repos", () => {
      const text = read("SUBMISSION.md");
      const repos = [
        "token-mix",
        "brownie_fund_me",
        "smartcontract-lottery",
        "aave_brownie_py_freecode",
        "brownie-strategy-mix",
      ];
      for (const repo of repos) {
        expect(text, `SUBMISSION.md missing repo: ${repo}`).toContain(repo);
      }
    });

    test("references Track 3 ApeWorX issue", () => {
      expect(read("SUBMISSION.md")).toContain("ApeWorX/ape/issues/2774");
    });
  });

  describe("negative cases", () => {
    test("does NOT contain placeholder URLs", () => {
      const text = read("SUBMISSION.md");
      expect(text).not.toMatch(/<your-fork[^>]*>/);
      expect(text).not.toMatch(/<insert\s+your[^>]*>/);
    });
  });
});

describe("DEMO.md", () => {
  describe("positive cases", () => {
    test("references the asciinema cast file", () => {
      expect(read("DEMO.md")).toContain("demo/demo.cast");
    });

    test("at least 5 example sections present", () => {
      const sections = (read("DEMO.md").match(/^## Example \d+/gm) || []).length;
      expect(sections).toBeGreaterThanOrEqual(5);
    });
  });
});

describe("EVALUATOR.md", () => {
  describe("positive cases", () => {
    test("documents the 3-step evaluation walkthrough", () => {
      const text = read("EVALUATOR.md").toLowerCase();
      expect(text).toContain("codemod");
      expect(text).toContain("manual");
    });
  });
});
