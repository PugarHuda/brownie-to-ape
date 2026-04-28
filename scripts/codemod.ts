import type { Codemod } from "codemod:ast-grep";
import type Python from "codemod:ast-grep/langs/python";

// `from brownie import X` per-name rename map.
// Names not in this map and not in IMPORT_NAMES_DROP keep their original name.
const IMPORT_NAME_RENAMES: Record<string, string> = {
  network: "networks",
};

// Names that exist in Brownie but have no direct equivalent in Ape.
// Dropped from rewritten import; a TODO comment is emitted.
const IMPORT_NAMES_DROP: Set<string> = new Set([
  "Contract",   // → project.<ContractName>
  "Wei",        // → ape.utils.convert
  "exceptions", // ape.exceptions has different class names
  "interface",  // Brownie interface object — Ape pattern differs
  "rpc",        // Different test backend in Ape
  "history",    // Different transaction history API
  "web3",       // Ape exposes via networks.active_provider.web3
]);

// Brownie built-in module identifiers that DO have an Ape equivalent (after
// IMPORT_NAME_RENAMES). Used to distinguish "framework imports" from
// user-defined contract names which are PascalCase and project-specific.
const BROWNIE_BUILTIN_NAMES: Set<string> = new Set([
  "accounts",
  "network",
  "chain",
  "config",
  "project",
]);

// Heuristic: a name starting with uppercase that isn't a known Brownie
// built-in is almost always a user-defined contract artifact (Brownie
// auto-injects these). Ape requires `project.<Name>` access, so we drop
// the import with a TODO.
function isLikelyContractName(name: string): boolean {
  if (BROWNIE_BUILTIN_NAMES.has(name)) return false;
  if (IMPORT_NAMES_DROP.has(name)) return false;
  return /^[A-Z]/.test(name);
}

// `brownie.<attr>` paths that have a clean 1:1 Ape equivalent.
// Excludes "network" (handled by specific patterns) to avoid conflicts.
const ATTR_RENAMES: Record<string, string> = {
  reverts: "ape.reverts",
  accounts: "ape.accounts",
  project: "ape.project",
  config: "ape.config",
  chain: "ape.chain",
};

// Brownie tx-dict keys → Ape kwarg name.
const TX_KEY_RENAMES: Record<string, string> = {
  from: "sender",
};

// Allowed Brownie tx-dict keys. A dict literal is treated as a tx-dict only if
// every key is in this set AND "from" is present. Zero-false-positive guard.
const TX_DICT_KEYS = new Set([
  "from",
  "value",
  "gas",
  "gas_limit",
  "gas_price",
  "max_fee",
  "priority_fee",
  "nonce",
  "required_confs",
  "allow_revert",
]);

// Strip enclosing quotes from a Python string literal token.
// Returns the inner content, or null if the literal is anything other than
// a PLAIN quoted string. Prefixed strings (b"...", f"...", r"..." etc.) are
// rejected — Brownie tx-dict keys are always plain strings, and accepting
// prefixed forms risks transforming dicts that aren't real tx-dicts.
function stripPyStringQuotes(literal: string): string | null {
  const m = literal.match(/^('''|"""|'|")(.*)\1$/s);
  return m ? m[2] : null;
}

// Apply ATTR_RENAMES to a free-form text snippet (used when we can't safely
// emit AST edits inside a region we are rewriting wholesale).
function applyAttrRenamesToText(text: string): string {
  const keys = Object.keys(ATTR_RENAMES);
  if (keys.length === 0) return text;
  const pattern = new RegExp(`\\bbrownie\\.(${keys.join("|")})\\b`, "g");
  return text.replace(pattern, (_, attr) => ATTR_RENAMES[attr]);
}

// Walk ancestors and report whether `node` is inside a `dictionary` node.
function isInsideDictionary(node: any): boolean {
  let cur = node.parent();
  while (cur) {
    if (cur.kind() === "dictionary") return true;
    cur = cur.parent();
  }
  return false;
}

const codemod: Codemod<Python> = async (root) => {
  const rootNode = root.root();
  const sourceText = rootNode.text();
  // Skip files that don't reference brownie at all — fast path + safety.
  if (!sourceText.includes("brownie")) return null;

  const edits: ReturnType<typeof rootNode.replace>[] = [];

  // ────────────────────────────────────────────────────────────────────
  // Transform 1: `from brownie import X, Y, Z` → `from ape import X', Y', Z'`
  // ────────────────────────────────────────────────────────────────────
  const fromImports = rootNode.findAll({
    rule: {
      kind: "import_from_statement",
      has: {
        field: "module_name",
        regex: "^brownie$",
      },
    },
  });

  for (const node of fromImports) {
    const moduleField = node.field("module_name");
    const moduleText = moduleField?.text() ?? "brownie";
    if (moduleText !== "brownie") continue;

    // Skip wildcard imports — too risky to rewrite without symbol tracking.
    if (node.findAll({ rule: { kind: "wildcard_import" } }).length > 0) continue;

    const imported: Array<{ name: string; alias?: string }> = [];
    for (const child of node.children()) {
      const k = child.kind();
      const t = child.text();
      if ((k === "dotted_name" || k === "identifier") && t !== moduleText) {
        imported.push({ name: t });
      } else if (k === "aliased_import") {
        const nm = child.field("name")?.text();
        const al = child.field("alias")?.text();
        if (nm) imported.push({ name: nm, alias: al });
      }
    }
    if (imported.length === 0) continue;

    const renamed: string[] = [];
    const dropped: string[] = [];
    for (const item of imported) {
      if (IMPORT_NAMES_DROP.has(item.name) || isLikelyContractName(item.name)) {
        // Preserve full "Name as Alias" form so the user can grep for either.
        dropped.push(item.alias ? `${item.name} as ${item.alias}` : item.name);
        continue;
      }
      const newName = IMPORT_NAME_RENAMES[item.name] ?? item.name;
      renamed.push(item.alias ? `${newName} as ${item.alias}` : newName);
    }

    let replacement: string;
    if (renamed.length === 0) {
      replacement = `# TODO(brownie-to-ape): no direct Ape equivalent for: ${dropped.join(", ")}\n# ${node.text()}`;
    } else {
      replacement = `from ape import ${renamed.join(", ")}`;
      if (dropped.length > 0) {
        replacement = `# TODO(brownie-to-ape): no direct Ape equivalent for: ${dropped.join(", ")}\n${replacement}`;
      }
    }
    edits.push(node.replace(replacement));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 2a: `brownie.network.show_active()` → networks.active_provider.network.name
  // Specific pattern processed BEFORE generic brownie.<attr> rename.
  // ────────────────────────────────────────────────────────────────────
  const showActiveCalls = rootNode.findAll({
    rule: { pattern: "brownie.network.show_active()" },
  });
  for (const node of showActiveCalls) {
    edits.push(node.replace("networks.active_provider.network.name"));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 2b: bare `network.show_active()` → networks.active_provider.network.name
  // Fires only when file has the brownie marker (the early-exit guard above
  // ensures this) — preventing FP on unrelated `network` variables.
  // ────────────────────────────────────────────────────────────────────
  const bareShowActiveCalls = rootNode.findAll({
    rule: { pattern: "network.show_active()" },
  });
  for (const node of bareShowActiveCalls) {
    // Skip if it's actually `brownie.network.show_active()` already covered above
    const parent = node.parent();
    if (parent && parent.kind() === "attribute") {
      const obj = parent.field("object");
      if (obj && obj.text() === "brownie") continue;
    }
    edits.push(node.replace("networks.active_provider.network.name"));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 3: generic `brownie.<attr>` → `ape.<attr>` for whitelisted attrs.
  // Skips occurrences inside dictionary literals — those are handled when the
  // surrounding tx-dict is rewritten in Transform 4 (avoids edit conflicts).
  // ────────────────────────────────────────────────────────────────────
  let didRewriteBrownieAttr = false;
  const brownieAttrs = rootNode.findAll({
    rule: { pattern: "brownie.$ATTR" },
  });
  for (const node of brownieAttrs) {
    if (isInsideDictionary(node)) continue;
    const attrField = node.field("attribute");
    if (!attrField) continue;
    const attrName = attrField.text();
    const replacement = ATTR_RENAMES[attrName];
    if (!replacement) continue;
    edits.push(node.replace(replacement));
    didRewriteBrownieAttr = true;
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 3b: when Transform 3 has rewritten any `brownie.<attr>` to
  // `ape.<attr>`, also rewrite the standalone `import brownie` so the
  // resulting file still has a valid module reference. Only fires when
  // the import statement is exactly `import brownie` (no aliasing or
  // multi-module forms) — minimizes FP risk.
  // ────────────────────────────────────────────────────────────────────
  if (didRewriteBrownieAttr) {
    const bareBrownieImports = rootNode.findAll({
      rule: {
        kind: "import_statement",
        pattern: "import brownie",
      },
    });
    for (const node of bareBrownieImports) {
      edits.push(node.replace("import ape"));
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 4: tx-dict → kwargs.
  //   func(arg1, ..., {"from": acct, "value": v}) → func(arg1, ..., sender=acct, value=v)
  // Hard guards: dict must contain "from" AND every key must be a known tx key.
  // Replaces only the dict node (not the full arg list) to avoid clobbering
  // edits scheduled for sibling args.
  // ────────────────────────────────────────────────────────────────────
  const calls = rootNode.findAll({ rule: { kind: "call" } });
  for (const callNode of calls) {
    const argList = callNode.field("arguments");
    if (!argList) continue;

    const argChildren = argList
      .children()
      .filter((c) => !["(", ")", ","].includes(c.kind()));
    if (argChildren.length === 0) continue;

    // Find the last POSITIONAL arg — kwargs (e.g. publish_source=...) may
    // legitimately follow a Brownie tx-dict and shouldn't disqualify it.
    let lastPositionalIndex = -1;
    for (let i = argChildren.length - 1; i >= 0; i--) {
      if (argChildren[i].kind() !== "keyword_argument") {
        lastPositionalIndex = i;
        break;
      }
    }
    if (lastPositionalIndex === -1) continue;
    const lastArg = argChildren[lastPositionalIndex];
    if (lastArg.kind() !== "dictionary") continue;

    const pairs = lastArg.children().filter((c) => c.kind() === "pair");
    if (pairs.length === 0) continue;

    let hasFrom = false;
    let aborted = false;
    const kwargParts: string[] = [];

    for (const pair of pairs) {
      const keyNode = pair.field("key");
      const valueNode = pair.field("value");
      if (!keyNode || !valueNode || keyNode.kind() !== "string") {
        aborted = true;
        break;
      }
      const keyText = stripPyStringQuotes(keyNode.text());
      if (keyText === null || !TX_DICT_KEYS.has(keyText)) {
        aborted = true;
        break;
      }
      if (keyText === "from") hasFrom = true;
      const newKey = TX_KEY_RENAMES[keyText] ?? keyText;
      const newValue = applyAttrRenamesToText(valueNode.text());
      kwargParts.push(`${newKey}=${newValue}`);
    }

    if (aborted || !hasFrom) continue;

    // Reject dicts containing dict_splat (`**other`) — we can't safely fold
    // splats into kwargs without losing semantics. Brownie tx-dicts never use
    // splats so this also catches odd patterns we shouldn't touch.
    const hasSplat = lastArg
      .children()
      .some((c) => c.kind() === "dictionary_splat_pattern" || c.kind() === "dictionary_splat");
    if (hasSplat) continue;

    edits.push(lastArg.replace(kwargParts.join(", ")));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 5: chain.mine(N) → chain.mine(num_blocks=N)
  // Only fires when the call has exactly one POSITIONAL arg (kwargs are left
  // alone). Brownie's chain.mine accepts a positional block count; Ape
  // requires the keyword. The positional-int form is safe to convert.
  // ────────────────────────────────────────────────────────────────────
  const chainMineCalls = rootNode.findAll({
    rule: { pattern: "chain.mine($N)" },
  });
  for (const callNode of chainMineCalls) {
    const argList = callNode.field("arguments");
    if (!argList) continue;
    const argChildren = argList
      .children()
      .filter((c) => !["(", ")", ","].includes(c.kind()));
    if (argChildren.length !== 1) continue;
    const arg = argChildren[0];
    if (arg.kind() === "keyword_argument") continue;
    edits.push(argList.replace(`(num_blocks=${arg.text()})`));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 6: chain.sleep(N) → chain.pending_timestamp += N
  // Only fires when the call is the entire body of an expression_statement
  // (i.e. its return value isn't being used). When chain.sleep is in an
  // assignment or expression, we leave it alone — the rewrite would change
  // semantics and risk a false positive.
  // ────────────────────────────────────────────────────────────────────
  const chainSleepCalls = rootNode.findAll({
    rule: { pattern: "chain.sleep($N)" },
  });
  for (const callNode of chainSleepCalls) {
    const parent = callNode.parent();
    if (!parent || parent.kind() !== "expression_statement") continue;
    // Make sure this call IS the only child of the expression_statement,
    // not nested in something larger.
    const stmtChildren = parent
      .children()
      .filter((c) => c.kind() !== ";");
    if (stmtChildren.length !== 1 || stmtChildren[0].text() !== callNode.text()) {
      continue;
    }
    const argList = callNode.field("arguments");
    if (!argList) continue;
    const argChildren = argList
      .children()
      .filter((c) => !["(", ")", ","].includes(c.kind()));
    if (argChildren.length !== 1) continue;
    const arg = argChildren[0];
    if (arg.kind() === "keyword_argument") continue;
    edits.push(parent.replace(`chain.pending_timestamp += ${arg.text()}`));
  }

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default codemod;
