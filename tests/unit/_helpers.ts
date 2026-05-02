// Pure helpers extracted from `scripts/codemod.ts` for unit testing
// AND mutation testing.
//
// Why this file exists:
// - jssg sandbox doesn't reliably resolve external imports inside
//   codemod.ts, so the helpers MUST stay inlined in codemod.ts for
//   the production runtime.
// - But Stryker can't meaningfully mutate code that's inlined inside
//   a test file (mutating string literals in test names is noise).
// - This file holds standalone copies of the same helpers, exported
//   for both Vitest unit tests AND Stryker mutation testing.
//
// MAINTENANCE: when changing a helper in scripts/codemod.ts, update
// the copy here in the SAME COMMIT. The pure-helpers.test.ts unit
// tests will catch behavioral drift.

export function stripPyStringQuotes(literal: string): string | null {
  const m = literal.match(/^('''|"""|'|")(.*)\1$/s);
  return m ? m[2] : null;
}

export const ATTR_RENAMES: Record<string, string> = {
  reverts: "ape.reverts",
  accounts: "ape.accounts",
  project: "ape.project",
  config: "ape.config",
  chain: "ape.chain",
};

export function applyAttrRenamesToText(text: string): string {
  const keys = Object.keys(ATTR_RENAMES);
  if (keys.length === 0) return text;
  const pattern = new RegExp(`\\bbrownie\\.(${keys.join("|")})\\b`, "g");
  return text.replace(pattern, (_, attr) => ATTR_RENAMES[attr]);
}

export const BROWNIE_BUILTIN_NAMES: Set<string> = new Set([
  "accounts",
  "network",
  "chain",
  "config",
  "project",
]);

export const IMPORT_NAMES_DROP: Set<string> = new Set([
  "Contract",
  "Wei",
  "interface",
  "rpc",
  "history",
]);

export const IMPORT_NAMES_PRESERVE: Set<string> = new Set(["web3"]);

export const IMPORT_NAMES_TO_APE_UTILS: Set<string> = new Set(["ZERO_ADDRESS"]);

export function isLikelyContractName(name: string): boolean {
  if (BROWNIE_BUILTIN_NAMES.has(name)) return false;
  if (IMPORT_NAMES_DROP.has(name)) return false;
  if (IMPORT_NAMES_PRESERVE.has(name)) return false;
  if (IMPORT_NAMES_TO_APE_UTILS.has(name)) return false;
  return /^[A-Z]/.test(name);
}
