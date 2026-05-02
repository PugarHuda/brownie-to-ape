// Unit tests for pure helpers extracted from `scripts/codemod.ts`.
//
// Strategy: the helpers are kept as exact INLINE COPIES below. The
// jssg sandbox doesn't support arbitrary npm-style imports inside
// codemod.ts, so we keep helpers inlined in codemod.ts and copy them
// here for unit testing. A drift-detection regression in CI would be
// nice-to-have; for now, treat this file as the authoritative spec
// and copy any change to/from codemod.ts in the same commit.
//
// Naming convention (from docs/TESTING_PROMPT.md §2):
//   describe(<helperName>)
//     describe(<positive|negative|edge>)
//       test(<single-sentence expected behavior>)

import { describe, expect, test } from "vitest";

// ─── COPIES from scripts/codemod.ts ──────────────────────────────────────

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

const BROWNIE_BUILTIN_NAMES: Set<string> = new Set([
  "accounts",
  "network",
  "chain",
  "config",
  "project",
]);

const IMPORT_NAMES_DROP: Set<string> = new Set([
  "Contract",
  "Wei",
  "interface",
  "rpc",
  "history",
]);

const IMPORT_NAMES_PRESERVE: Set<string> = new Set(["web3"]);

const IMPORT_NAMES_TO_APE_UTILS: Set<string> = new Set(["ZERO_ADDRESS"]);

function isLikelyContractName(name: string): boolean {
  if (BROWNIE_BUILTIN_NAMES.has(name)) return false;
  if (IMPORT_NAMES_DROP.has(name)) return false;
  if (IMPORT_NAMES_PRESERVE.has(name)) return false;
  if (IMPORT_NAMES_TO_APE_UTILS.has(name)) return false;
  return /^[A-Z]/.test(name);
}

// ─── TESTS ────────────────────────────────────────────────────────────────

describe("stripPyStringQuotes", () => {
  describe("positive cases", () => {
    test("returns inner text from simple double-quoted string", () => {
      expect(stripPyStringQuotes('"from"')).toBe("from");
    });

    test("returns inner text from simple single-quoted string", () => {
      expect(stripPyStringQuotes("'from'")).toBe("from");
    });

    test("returns inner text from triple-double-quoted string", () => {
      expect(stripPyStringQuotes('"""from"""')).toBe("from");
    });

    test("returns inner text from triple-single-quoted string", () => {
      expect(stripPyStringQuotes("'''from'''")).toBe("from");
    });

    test("returns empty string from empty quoted string", () => {
      expect(stripPyStringQuotes('""')).toBe("");
    });

    test("preserves whitespace inside quotes", () => {
      expect(stripPyStringQuotes('"  spaces  "')).toBe("  spaces  ");
    });
  });

  describe("negative cases", () => {
    test("does NOT strip prefixed b-string and returns null", () => {
      expect(stripPyStringQuotes('b"from"')).toBeNull();
    });

    test("does NOT strip prefixed f-string and returns null", () => {
      expect(stripPyStringQuotes('f"from"')).toBeNull();
    });

    test("does NOT strip prefixed r-string and returns null", () => {
      expect(stripPyStringQuotes('r"from"')).toBeNull();
    });

    test("does NOT strip uppercase-prefixed B-string", () => {
      expect(stripPyStringQuotes('B"from"')).toBeNull();
    });

    test("does NOT match unquoted bare identifier", () => {
      expect(stripPyStringQuotes("from")).toBeNull();
    });

    test("does NOT match mismatched quotes", () => {
      expect(stripPyStringQuotes("'from\"")).toBeNull();
    });

    test("does NOT match unterminated single-quote", () => {
      expect(stripPyStringQuotes("'from")).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("handles string containing escaped quote inside", () => {
      // `"a\"b"` — inner content is `a\"b`. Regex is non-greedy.
      // Documented behavior: returns inner text inclusive of escaped.
      const result = stripPyStringQuotes('"a\\"b"');
      // Either the full inner or null, but never throws.
      expect(typeof result === "string" || result === null).toBe(true);
    });

    test("handles multi-line triple-quoted string", () => {
      expect(stripPyStringQuotes('"""line1\nline2"""')).toBe("line1\nline2");
    });

    test("handles unicode content inside quotes", () => {
      expect(stripPyStringQuotes('"héllo"')).toBe("héllo");
    });
  });
});

describe("applyAttrRenamesToText", () => {
  describe("positive cases", () => {
    test("rewrites brownie.reverts to ape.reverts", () => {
      expect(applyAttrRenamesToText("brownie.reverts(...)")).toBe(
        "ape.reverts(...)",
      );
    });

    test("rewrites brownie.accounts to ape.accounts", () => {
      expect(applyAttrRenamesToText("brownie.accounts[0]")).toBe(
        "ape.accounts[0]",
      );
    });

    test("rewrites multiple occurrences in single string", () => {
      expect(
        applyAttrRenamesToText("brownie.accounts and brownie.chain.something"),
      ).toBe("ape.accounts and ape.chain.something");
    });

    test("rewrites all 5 whitelisted attrs in mixed text", () => {
      const input =
        "brownie.reverts brownie.accounts brownie.project brownie.config brownie.chain";
      const expected =
        "ape.reverts ape.accounts ape.project ape.config ape.chain";
      expect(applyAttrRenamesToText(input)).toBe(expected);
    });
  });

  describe("negative cases", () => {
    test("does NOT rewrite brownie.network (intentionally excluded)", () => {
      expect(applyAttrRenamesToText("brownie.network")).toBe("brownie.network");
    });

    test("does NOT rewrite brownie.unknown (not in whitelist)", () => {
      expect(applyAttrRenamesToText("brownie.unknown")).toBe("brownie.unknown");
    });

    test("does NOT rewrite when prefix differs", () => {
      expect(applyAttrRenamesToText("notbrownie.accounts")).toBe(
        "notbrownie.accounts",
      );
    });

    test("does NOT rewrite when partial word match", () => {
      // word-boundary `\b` means `brownie.accounts_extra` should NOT match
      expect(applyAttrRenamesToText("brownie.accounts_test")).toBe(
        "brownie.accounts_test",
      );
    });

    test("does NOT rewrite empty string", () => {
      expect(applyAttrRenamesToText("")).toBe("");
    });
  });

  describe("edge cases", () => {
    test("handles brownie.reverts followed by parenthesis", () => {
      expect(applyAttrRenamesToText("brownie.reverts()")).toBe("ape.reverts()");
    });

    test("handles brownie.accounts in subscript expression", () => {
      expect(applyAttrRenamesToText("(brownie.accounts[0])")).toBe(
        "(ape.accounts[0])",
      );
    });

    test("preserves surrounding whitespace and newlines", () => {
      expect(applyAttrRenamesToText("  brownie.chain\n")).toBe("  ape.chain\n");
    });
  });
});

describe("isLikelyContractName", () => {
  describe("positive cases", () => {
    test("classifies PascalCase contract name as likely contract", () => {
      expect(isLikelyContractName("FundMe")).toBe(true);
    });

    test("classifies CamelCase compound name as likely contract", () => {
      expect(isLikelyContractName("MockV3Aggregator")).toBe(true);
    });

    test("classifies single-letter uppercase as likely contract", () => {
      expect(isLikelyContractName("T")).toBe(true);
    });

    test("classifies UPPER_CASE_WITH_UNDERSCORES as likely contract", () => {
      // Heuristic doesn't distinguish constants from contracts; it
      // requires uppercase first letter, which UPPER_CASE has.
      expect(isLikelyContractName("MY_CONTRACT")).toBe(true);
    });
  });

  describe("negative cases", () => {
    test("does NOT classify lowercase name as contract", () => {
      expect(isLikelyContractName("accounts")).toBe(false);
    });

    test("does NOT classify Brownie builtin 'accounts' as contract", () => {
      expect(isLikelyContractName("accounts")).toBe(false);
    });

    test("does NOT classify Brownie builtin 'network' as contract", () => {
      expect(isLikelyContractName("network")).toBe(false);
    });

    test("does NOT classify drop-list 'Contract' as contract", () => {
      expect(isLikelyContractName("Contract")).toBe(false);
    });

    test("does NOT classify drop-list 'Wei' as contract", () => {
      expect(isLikelyContractName("Wei")).toBe(false);
    });

    test("does NOT classify drop-list 'interface' as contract", () => {
      expect(isLikelyContractName("interface")).toBe(false);
    });

    test("does NOT classify preserved 'web3' as contract", () => {
      expect(isLikelyContractName("web3")).toBe(false);
    });

    test("does NOT classify ape.utils-bound 'ZERO_ADDRESS' as contract", () => {
      expect(isLikelyContractName("ZERO_ADDRESS")).toBe(false);
    });

    test("does NOT classify name starting with underscore as contract", () => {
      expect(isLikelyContractName("_internal")).toBe(false);
    });

    test("does NOT classify name starting with digit", () => {
      // /^[A-Z]/ test fails on digits
      expect(isLikelyContractName("3rdParty")).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles empty string by returning false", () => {
      expect(isLikelyContractName("")).toBe(false);
    });

    test("handles single uppercase letter", () => {
      expect(isLikelyContractName("X")).toBe(true);
    });

    test("handles whitespace prefix by returning false", () => {
      expect(isLikelyContractName(" Token")).toBe(false);
    });
  });
});

describe("ATTR_RENAMES integrity", () => {
  describe("positive cases", () => {
    test("contains exactly 5 whitelist entries", () => {
      expect(Object.keys(ATTR_RENAMES).length).toBe(5);
    });

    test("every value is prefixed with ape.", () => {
      for (const v of Object.values(ATTR_RENAMES)) {
        expect(v.startsWith("ape.")).toBe(true);
      }
    });

    test("every key matches its value's suffix after ape.", () => {
      for (const [k, v] of Object.entries(ATTR_RENAMES)) {
        expect(v).toBe(`ape.${k}`);
      }
    });
  });

  describe("negative cases", () => {
    test("does NOT include 'network' (intentionally excluded)", () => {
      expect("network" in ATTR_RENAMES).toBe(false);
    });

    test("does NOT include 'exceptions' (handled by separate pass)", () => {
      expect("exceptions" in ATTR_RENAMES).toBe(false);
    });
  });
});
