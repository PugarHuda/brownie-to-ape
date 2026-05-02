// QA test: version metadata is consistent across codemod.yaml,
// package.json, CHANGELOG.md, and the latest git tag.
//
// Uses execFileSync for git invocation (no shell interpretation).
//
// Naming convention (docs/TESTING_PROMPT.md §2).

import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");

function readCodemodYamlVersion(): string {
  const text = readFileSync(resolve(REPO_ROOT, "codemod.yaml"), "utf-8");
  const m = text.match(/^version:\s*"([^"]+)"/m);
  if (!m) throw new Error("codemod.yaml has no version field");
  return m[1];
}

function readPackageJsonVersion(): string {
  const pkg = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "package.json"), "utf-8"),
  );
  return pkg.version;
}

function readLatestChangelogVersion(): string {
  const text = readFileSync(resolve(REPO_ROOT, "CHANGELOG.md"), "utf-8");
  const m = text.match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
  if (!m) throw new Error("CHANGELOG.md has no version heading");
  return m[1];
}

function readLatestGitTag(): string | null {
  try {
    const out = execFileSync(
      "git",
      ["tag", "--list", "v*", "--sort=-v:refname"],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    const first = out.split("\n").find((l) => l.startsWith("v"));
    return first ? first.slice(1) : null;
  } catch {
    return null;
  }
}

describe("version-consistency", () => {
  describe("positive cases", () => {
    test("codemod.yaml version equals package.json version", () => {
      expect(readCodemodYamlVersion()).toBe(readPackageJsonVersion());
    });

    test("CHANGELOG.md latest entry matches codemod.yaml version", () => {
      expect(readLatestChangelogVersion()).toBe(readCodemodYamlVersion());
    });

    test("latest git tag matches codemod.yaml version", () => {
      const tag = readLatestGitTag();
      if (tag === null) {
        // CI shallow checkout may not have tags. Skip with warning.
        console.warn("No git tags available — skipping git tag check");
        return;
      }
      expect(tag).toBe(readCodemodYamlVersion());
    });
  });

  describe("negative cases", () => {
    test("codemod.yaml version is valid SemVer (X.Y.Z)", () => {
      expect(readCodemodYamlVersion()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("package.json version is valid SemVer (X.Y.Z)", () => {
      expect(readPackageJsonVersion()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});

describe("metadata files exist", () => {
  describe("positive cases", () => {
    const REQUIRED_FILES = [
      "LICENSE",
      "README.md",
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CASE_STUDY.md",
      "DEMO.md",
      "EVALUATOR.md",
      "SUBMISSION.md",
      ".gitignore",
      ".gitattributes",
      ".editorconfig",
      "codemod.yaml",
      "workflow.yaml",
      "package.json",
      "tsconfig.json",
      "scripts/codemod.ts",
      "scripts/migrate_config.py",
      "scripts/benchmark.sh",
      "scripts/preview.sh",
      "scripts/render_cast.py",
      "demo/run-demo.sh",
      "demo/demo.cast",
      "docs/index.html",
      "docs/TESTING_PROMPT.md",
      ".github/workflows/test.yml",
      ".github/workflows/publish.yml",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE/bug.md",
      ".github/ISSUE_TEMPLATE/feature.md",
    ];

    for (const file of REQUIRED_FILES) {
      test(`${file} exists`, () => {
        readFileSync(resolve(REPO_ROOT, file));
      });
    }
  });
});
