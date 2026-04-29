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
  // "exceptions" is intentionally kept — Ape also has `ape.exceptions`.
  // Known class names are renamed by the exceptions-rewrite pass below.
  "interface",  // → Ape's Contract(addr) with explicit ABI; Pass 10 inline TODOs use sites
  "rpc",        // Different test backend in Ape
  "history",    // Different transaction history API
]);

// Names kept in `from brownie import X` (NOT migrated to ape) with an
// inline TODO comment. Pass 16 rewrites known web3.eth.X helpers; other
// web3 callsites stay runnable via the kept brownie import during the
// migration period.
const IMPORT_NAMES_PRESERVE: Set<string> = new Set([
  "web3",
]);

// Brownie exception class names → Ape equivalents. Used to rewrite both
// bare `exceptions.X` references (after `from brownie import exceptions`)
// and qualified `brownie.exceptions.X` references.
const EXCEPTION_MAP: Record<string, string> = {
  VirtualMachineError: "ContractLogicError",
  RPCRequestError: "RPCError",
  ContractNotFound: "ContractNotFoundError",
};

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

// Names that move from `from brownie import …` to `from ape.utils import …`
// These are constants / utilities that Ape exposes under a different
// module path. Imports that contain only these names produce a single
// `from ape.utils import …` line; mixed imports produce both
// `from ape.utils import …` (for these) and `from ape import …` (for
// the rest).
const IMPORT_NAMES_TO_APE_UTILS: Set<string> = new Set([
  "ZERO_ADDRESS",
]);

// Heuristic: a name starting with uppercase that isn't a known Brownie
// built-in is almost always a user-defined contract artifact (Brownie
// auto-injects these). Ape requires `project.<Name>` access, so we drop
// the import with a TODO.
function isLikelyContractName(name: string): boolean {
  if (BROWNIE_BUILTIN_NAMES.has(name)) return false;
  if (IMPORT_NAMES_DROP.has(name)) return false;
  if (IMPORT_NAMES_PRESERVE.has(name)) return false;
  if (IMPORT_NAMES_TO_APE_UTILS.has(name)) return false;
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

// Append an inline trailing comment to call expressions that match `pattern`,
// but only when the call sits at end-of-line position — expression_statement
// or RHS of an assignment. Replaces ONLY the closing `)` token (not the full
// call text) so that other passes can independently rewrite nodes nested in
// the argument list (e.g. network.show_active() inside the call's args).
function appendInlineTodoToCalls(
  rootNode: any,
  edits: any[],
  pattern: string,
  todoSuffix: string,
): void {
  const calls = rootNode.findAll({ rule: { pattern } });
  for (const callNode of calls) {
    const parent = callNode.parent();
    if (!parent) continue;
    const callText = callNode.text();
    if (callText.includes("# TODO(brownie-to-ape)")) continue;

    let safeContext = false;
    if (parent.kind() === "expression_statement") {
      safeContext = true;
    } else if (parent.kind() === "assignment") {
      const rhs = parent.field("right");
      if (rhs && rhs.text() === callText) safeContext = true;
    }
    if (!safeContext) continue;

    const argList = callNode.field("arguments");
    if (!argList) continue;
    const argChildren = argList.children();
    const closingParen = argChildren[argChildren.length - 1];
    if (!closingParen || closingParen.text() !== ")") continue;
    edits.push(closingParen.replace(`)${todoSuffix}`));
  }
}

const codemod: Codemod<Python> = async (root) => {
  const rootNode = root.root();
  // Skip files that have NO Brownie OR Ape signal. We process Brownie
  // projects (most common) AND already-partially-migrated projects that
  // import from ape (Pass 15 rewrites contract containers in those).
  // Pass-level guards (hasProjectImport, tx-dict whitelist, etc.)
  // prevent FPs in non-Brownie/non-Ape files that slip through.
  const earlyExitText = rootNode.text();
  if (
    !earlyExitText.includes("brownie") &&
    !earlyExitText.includes("from ape")
  ) {
    return null;
  }

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

  let addedProjectImport = false;
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
    const movedToUtils: string[] = [];
    const preserved: string[] = []; // kept in `from brownie import …` with TODO
    const dropped: string[] = [];
    let droppedAnyContract = false;
    for (const item of imported) {
      if (IMPORT_NAMES_PRESERVE.has(item.name)) {
        preserved.push(item.alias ? `${item.name} as ${item.alias}` : item.name);
        continue;
      }
      if (IMPORT_NAMES_TO_APE_UTILS.has(item.name)) {
        movedToUtils.push(
          item.alias ? `${item.name} as ${item.alias}` : item.name,
        );
        continue;
      }
      if (IMPORT_NAMES_DROP.has(item.name)) {
        dropped.push(item.alias ? `${item.name} as ${item.alias}` : item.name);
        continue;
      }
      if (isLikelyContractName(item.name)) {
        // Contract artifact dropped — but we'll auto-add `project` to the
        // from-ape imports so subsequent `project.<Name>.deployments[-1]`
        // works (handled by Pass 15 below).
        dropped.push(item.alias ? `${item.name} as ${item.alias}` : item.name);
        droppedAnyContract = true;
        continue;
      }
      const newName = IMPORT_NAME_RENAMES[item.name] ?? item.name;
      renamed.push(item.alias ? `${newName} as ${item.alias}` : newName);
    }

    // Auto-add `project` to the from-ape imports when at least one contract
    // artifact was dropped — gives downstream Pass 15 something to bind to.
    if (droppedAnyContract && !renamed.includes("project") && !renamed.some((n) => n.startsWith("project "))) {
      renamed.push("project");
      addedProjectImport = true;
    }

    const lines: string[] = [];
    if (dropped.length > 0) {
      lines.push(
        `# TODO(brownie-to-ape): no direct Ape equivalent for: ${dropped.join(", ")}`,
      );
    }
    if (preserved.length > 0) {
      lines.push(
        `from brownie import ${preserved.join(", ")}  # TODO(brownie-to-ape): migrate this unsupported Brownie import manually.`,
      );
    }
    if (movedToUtils.length > 0) {
      lines.push(`from ape.utils import ${movedToUtils.join(", ")}`);
    }
    if (renamed.length > 0) {
      lines.push(`from ape import ${renamed.join(", ")}`);
    }
    let replacement: string;
    if (lines.length === 0) {
      // Nothing to migrate — leave original import alone (shouldn't happen).
      continue;
    } else if (
      renamed.length === 0 &&
      preserved.length === 0 &&
      movedToUtils.length === 0
    ) {
      // All names dropped — comment out the original import too.
      replacement = `${lines.join("\n")}\n# ${node.text()}`;
    } else {
      replacement = lines.join("\n");
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
  // Transform 2c: brownie.exceptions.X → ape.exceptions.<MappedX>
  //               exceptions.X → exceptions.<MappedX>  (after Pass 1 keeps
  //                 `exceptions` in the import list)
  // Only rewrites known exception names (EXCEPTION_MAP). Unknown names are
  // left alone — keeps zero-FP discipline.
  // ────────────────────────────────────────────────────────────────────
  let didRewriteBrownieAttr = false;

  const qualifiedExceptions = rootNode.findAll({
    rule: { pattern: "brownie.exceptions.$NAME" },
  });
  for (const node of qualifiedExceptions) {
    const nameField = node.field("attribute");
    if (!nameField) continue;
    const name = nameField.text();
    const mapped = EXCEPTION_MAP[name];
    if (!mapped) continue;
    edits.push(node.replace(`ape.exceptions.${mapped}`));
    didRewriteBrownieAttr = true;
  }

  const bareExceptions = rootNode.findAll({
    rule: { pattern: "exceptions.$NAME" },
  });
  // Track unique unknown exception names per file so we can emit ONE
  // top-of-file TODO instead of spamming every reference.
  const unknownExceptionNames = new Set<string>();
  for (const node of bareExceptions) {
    const nameField = node.field("attribute");
    if (!nameField) continue;
    const name = nameField.text();
    const mapped = EXCEPTION_MAP[name];
    if (mapped) {
      if (mapped !== name) {
        edits.push(node.replace(`exceptions.${mapped}`));
      }
    } else {
      unknownExceptionNames.add(name);
    }
  }
  // Surface unknown exception names: the import is now `from ape import
  // exceptions`, but `exceptions.<UnknownName>` will fail at attribute
  // access time. Add a top-of-file TODO so the user knows where to look.
  // Collected lines prepended at the first non-import anchor (combined edit
  // to avoid overlap with Pass 1's import rewrites and to keep multiple
  // top-of-file additions in a single deterministic place).
  const preludeAdditions: string[] = [];
  if (unknownExceptionNames.size > 0) {
    const names = [...unknownExceptionNames].sort().join(", ");
    preludeAdditions.push(
      `# TODO(brownie-to-ape): exceptions.{${names}} have no known Ape mapping — Ape's exception class names differ. See https://docs.apeworx.io/ape/stable/methoddocs/exceptions.html`,
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 3: generic `brownie.<attr>` → `ape.<attr>` for whitelisted attrs.
  // Skips occurrences inside dictionary literals — those are handled when the
  // surrounding tx-dict is rewritten in Transform 4 (avoids edit conflicts).
  // ────────────────────────────────────────────────────────────────────
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
    // Require method-call shape: callee must be an attribute access
    // (`obj.method(...)` or `Class.deploy(...)`). This excludes plain
    // function calls like `OrderedDict({...})`, `dict({...})`,
    // `defaultdict({...})`, `partial(f, {...})`, or user helper functions
    // that happen to take a dict — those expect a real dict, not kwargs.
    // Every Brownie tx-dict in real-world code is a method call on a
    // contract reference; this guard preserves zero-FP without
    // sacrificing coverage on validated repos.
    const funcNode = callNode.field("function");
    if (!funcNode || funcNode.kind() !== "attribute") continue;

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

  // ────────────────────────────────────────────────────────────────────
  // Transform 7: append inline TODO comment to `accounts.add(...)` calls.
  // Brownie's accounts.add(pk) → Ape's accounts.import_account_from_private_key(
  //   alias, passphrase, key) — different signature, can't auto-translate.
  // Only safe to add a trailing comment when the call sits at end-of-line:
  // expression_statement context, or RHS of an assignment.
  // ────────────────────────────────────────────────────────────────────
  const ACCOUNTS_ADD_TODO =
    "  # TODO(brownie-to-ape): Ape uses accounts.import_account_from_private_key(alias, passphrase, key)";
  appendInlineTodoToCalls(
    rootNode,
    edits,
    "accounts.add($$$ARGS)",
    ACCOUNTS_ADD_TODO,
  );

  // ────────────────────────────────────────────────────────────────────
  // Transform 8: detect Brownie's `def isolate(fn_isolation): pass` fixture
  // and prepend a TODO comment. Ape provides chain.isolate() and per-test
  // isolation by default, so this fixture is dead code in Ape.
  // Only fires when the function body is exactly `pass` (or pass + docstring)
  // — preserves user-customized isolate fixtures untouched.
  // ────────────────────────────────────────────────────────────────────
  const ISOLATE_TODO =
    "# TODO(brownie-to-ape): Ape has built-in per-test chain isolation via chain.isolate(). This fixture can be removed.";
  const isolateFixtures = rootNode.findAll({
    rule: {
      kind: "function_definition",
      has: { field: "name", regex: "^isolate$" },
    },
  });
  for (const node of isolateFixtures) {
    const params = node.field("parameters");
    if (!params || !params.text().includes("fn_isolation")) continue;
    const body = node.field("body");
    if (!body) continue;
    // Body must be just `pass` (with optional docstring) — anything else may
    // be user-customized logic we shouldn't flag.
    const stmts = body
      .children()
      .filter((c) => !["block", ":", "comment"].includes(c.kind()));
    const allTrivial = stmts.every((s) => {
      if (s.kind() === "pass_statement") return true;
      if (s.kind() === "expression_statement") {
        const inner = s.children().find((c) => c.kind() === "string");
        return !!inner; // bare docstring
      }
      return false;
    });
    if (!allTrivial || stmts.length === 0) continue;
    // Find the enclosing decorated_definition to also include decorators in
    // the comment placement.
    const wrapped = node.parent();
    const target =
      wrapped && wrapped.kind() === "decorated_definition" ? wrapped : node;
    if (target.text().includes("# TODO(brownie-to-ape)")) continue;
    edits.push(target.replace(`${ISOLATE_TODO}\n${target.text()}`));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 9: rewrite Wei("X") → convert("X", int) and inject the
  // required `from ape.utils import convert` import.
  // Only fires when the Wei call has a single string-literal argument —
  // the common Brownie idiom. `Wei(some_var)` and `Wei(1, "ether")` are
  // left alone (we can't safely synthesize the convert form).
  // ────────────────────────────────────────────────────────────────────
  let didRewriteWei = false;
  const weiCalls = rootNode.findAll({
    rule: { pattern: "Wei($$$ARGS)" },
  });
  for (const callNode of weiCalls) {
    const argList = callNode.field("arguments");
    if (!argList) continue;
    const args = argList
      .children()
      .filter((c) => !["(", ")", ","].includes(c.kind()));
    if (args.length !== 1) continue;
    const arg = args[0];
    if (arg.kind() !== "string") continue;
    edits.push(callNode.replace(`convert(${arg.text()}, int)`));
    didRewriteWei = true;
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 10: append inline TODO comment to interface.X(addr) calls.
  // Brownie auto-loads ABIs via `interface.IERC20(addr).balanceOf(...)`.
  // Ape uses `Contract(addr)` with explicit ABI/type hints. Different
  // shape — flag with a TODO instead of attempting an automatic rewrite.
  // Same safe-context guard.
  // ────────────────────────────────────────────────────────────────────
  const INTERFACE_TODO =
    "  # TODO(brownie-to-ape): interface.X(addr) -> Ape's Contract(addr) with explicit ABI/type loaded via project";
  appendInlineTodoToCalls(
    rootNode,
    edits,
    "interface.$NAME($$$ARGS)",
    INTERFACE_TODO,
  );

  // ────────────────────────────────────────────────────────────────────
  // Transform 12: web3.py utility patterns common in Brownie projects.
  // We don't auto-rewrite (Web3.toWei takes (number, unit) — different
  // from Ape's convert("X unit", int)) but we surface the migration
  // path with an inline TODO so the user knows where to look.
  // ────────────────────────────────────────────────────────────────────
  const WEB3_TOWEI_TODO =
    '  # TODO(brownie-to-ape): Web3.toWei(N, "unit") -> from ape.utils import convert; convert(f"{N} unit", int)';
  appendInlineTodoToCalls(rootNode, edits, "Web3.toWei($$$ARGS)", WEB3_TOWEI_TODO);
  const WEB3_FROMWEI_TODO =
    '  # TODO(brownie-to-ape): Web3.fromWei(amt, "unit") -> Decimal(amt) / 10**decimals; or use ape.utils.convert from a string';
  appendInlineTodoToCalls(rootNode, edits, "Web3.fromWei($$$ARGS)", WEB3_FROMWEI_TODO);

  // ────────────────────────────────────────────────────────────────────
  // Transform 13: event-index-field. Brownie's `tx.events[N][key]` →
  // Ape's `tx.events[N].event_arguments[key]`. Insert
  // `.event_arguments` between the two subscripts.
  // AST shape: subscript(subscript(<events_attr>, <int>), <key>)
  //   where <events_attr> is `<obj>.events` (attribute kind)
  // ────────────────────────────────────────────────────────────────────
  const eventIndexAccess = rootNode.findAll({
    rule: {
      kind: "subscript",
      has: {
        field: "value",
        kind: "subscript",
      },
    },
  });
  for (const outerSub of eventIndexAccess) {
    const innerSub = outerSub.field("value");
    if (!innerSub || innerSub.kind() !== "subscript") continue;
    const eventsAttr = innerSub.field("value");
    if (!eventsAttr || eventsAttr.kind() !== "attribute") continue;
    const attrName = eventsAttr.field("attribute");
    if (!attrName || attrName.text() !== "events") continue;
    // Inner key MUST be an integer (`tx.events[0]` style). String keys
    // (`tx.events["Name"]`) are handled by Pass 14 — guarding here
    // prevents Pass 13 from clobbering Pass 14's rewrites.
    const innerKey = innerSub.field("subscript");
    if (!innerKey || innerKey.kind() !== "integer") continue;
    const innerText = innerSub.text();
    const keyField = outerSub.field("subscript");
    if (!keyField) continue;
    const keyText = keyField.text();
    edits.push(outerSub.replace(`${innerText}.event_arguments[${keyText}]`));
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 14: event-direct-field. Brownie's syntactic sugar
  // `<obj>.events["Name"]["field"]` → Ape's filter-by-name pattern:
  // `[log for log in <obj>.events if log.event_name == "Name"][0].event_arguments["field"]`
  // Verbose but a faithful rewrite. Only fires when both subscripts
  // are string literals — minimizes FP risk on unrelated subscripts.
  // ────────────────────────────────────────────────────────────────────
  const eventNameAccess = rootNode.findAll({
    rule: {
      kind: "subscript",
      has: {
        field: "value",
        kind: "subscript",
      },
    },
  });
  for (const outerSub of eventNameAccess) {
    const innerSub = outerSub.field("value");
    if (!innerSub || innerSub.kind() !== "subscript") continue;
    const eventsAttr = innerSub.field("value");
    if (!eventsAttr || eventsAttr.kind() !== "attribute") continue;
    const attrName = eventsAttr.field("attribute");
    if (!attrName || attrName.text() !== "events") continue;
    // Inner key MUST be a string literal — distinguishes by-name access
    // from by-index access (Pass 13 handles the integer case).
    const innerKey = innerSub.field("subscript");
    if (!innerKey || innerKey.kind() !== "string") continue;
    const outerKey = outerSub.field("subscript");
    if (!outerKey) continue;
    // Skip if Pass 13 already scheduled this exact node (numeric index).
    if (innerKey.kind() !== "string") continue;
    const eventsText = eventsAttr.text(); // e.g. "tx.events"
    const nameText = innerKey.text(); // e.g. '"Transfer"'
    const fieldText = outerKey.text(); // e.g. '"to"'
    edits.push(
      outerSub.replace(
        `[log for log in ${eventsText} if log.event_name == ${nameText}][0].event_arguments[${fieldText}]`,
      ),
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 15: project containers. When the file imports `project`
  // from ape (which Pass 1 ensures whenever a contract artifact was
  // dropped), rewrite uppercase-name container access:
  //   <Uppercase>[-1]            → project.<Uppercase>.deployments[-1]
  //   len(<Uppercase>)           → len(project.<Uppercase>.deployments)
  //   <Uppercase>.at($X)         → project.<Uppercase>.at($X)
  // Only fires on names that look like contract artifacts (PascalCase,
  // not in BROWNIE_BUILTIN_NAMES) — avoids FP on unrelated identifiers.
  // ────────────────────────────────────────────────────────────────────
  // Detect `from ape import …, project, …` by walking import_from_statement
  // nodes. Cross-engine reliable, no regex quirks.
  const apeImports = rootNode.findAll({
    rule: {
      kind: "import_from_statement",
      has: { field: "module_name", regex: "^ape$" },
    },
  });
  // hasProjectImport = either already imports project from ape, OR Pass 1
  // queued an edit that will add it.
  let hasProjectImport = addedProjectImport;
  for (const node of apeImports) {
    for (const child of node.children()) {
      const k = child.kind();
      if ((k === "dotted_name" || k === "identifier") && child.text() === "project") {
        hasProjectImport = true;
        break;
      }
      if (k === "aliased_import" && child.field("name")?.text() === "project") {
        hasProjectImport = true;
        break;
      }
    }
    if (hasProjectImport) break;
  }

  if (hasProjectImport) {
    const isContractName = (name: string): boolean =>
      /^[A-Z][a-zA-Z0-9_]*$/.test(name) &&
      !BROWNIE_BUILTIN_NAMES.has(name) &&
      !IMPORT_NAMES_DROP.has(name) &&
      !IMPORT_NAMES_PRESERVE.has(name) &&
      !IMPORT_NAMES_TO_APE_UTILS.has(name) &&
      name !== "Contract" &&
      name !== "Wei";

    // 15a: <Uppercase>[-1] / <Uppercase>[N]  →  project.<Uppercase>.deployments[-1]
    const uppercaseSubscripts = rootNode.findAll({
      rule: { kind: "subscript" },
    });
    for (const sub of uppercaseSubscripts) {
      const valueNode = sub.field("value");
      if (!valueNode || valueNode.kind() !== "identifier") continue;
      const name = valueNode.text();
      if (!isContractName(name)) continue;
      const idxField = sub.field("subscript");
      if (!idxField) continue;
      const idxText = idxField.text();
      // Skip if already part of a `project.X` chain (re-entry safety).
      const parent = sub.parent();
      if (parent && parent.text().startsWith("project.")) continue;
      edits.push(sub.replace(`project.${name}.deployments[${idxText}]`));
    }

    // 15b: len(<Uppercase>)  →  len(project.<Uppercase>.deployments)
    const lenCalls = rootNode.findAll({
      rule: { pattern: "len($X)" },
    });
    for (const call of lenCalls) {
      const argList = call.field("arguments");
      if (!argList) continue;
      const args = argList
        .children()
        .filter((c) => !["(", ")", ","].includes(c.kind()));
      if (args.length !== 1) continue;
      const arg = args[0];
      if (arg.kind() !== "identifier") continue;
      const name = arg.text();
      if (!isContractName(name)) continue;
      edits.push(arg.replace(`project.${name}.deployments`));
    }

    // 15c: <Uppercase>.at($X)  →  project.<Uppercase>.at($X)
    const atCalls = rootNode.findAll({
      rule: { pattern: "$NAME.at($X)" },
    });
    for (const call of atCalls) {
      const funcNode = call.field("function");
      if (!funcNode || funcNode.kind() !== "attribute") continue;
      const obj = funcNode.field("object");
      if (!obj || obj.kind() !== "identifier") continue;
      const name = obj.text();
      if (!isContractName(name)) continue;
      // Replace just the object identifier with `project.<name>`.
      edits.push(obj.replace(`project.${name}`));
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Transform 16: web3.eth.get_balance($X) → chain.get_balance($X).
  // Auto-injects `from ape import chain` if the file kept `web3` (i.e.
  // has `from brownie import web3` from the IMPORT_NAMES_PRESERVE
  // path). Without that marker, `web3.eth.get_balance` may not be
  // Brownie-flavored.
  // ────────────────────────────────────────────────────────────────────
  const hasPreservedWeb3 = rootNode.text().includes("from brownie import web3");
  let didRewriteWeb3GetBalance = false;
  if (hasPreservedWeb3) {
    const web3Calls = rootNode.findAll({
      rule: { pattern: "web3.eth.get_balance($X)" },
    });
    for (const call of web3Calls) {
      const argList = call.field("arguments");
      if (!argList) continue;
      const args = argList
        .children()
        .filter((c) => !["(", ")", ","].includes(c.kind()));
      if (args.length !== 1) continue;
      edits.push(call.replace(`chain.get_balance(${args[0].text()})`));
      didRewriteWeb3GetBalance = true;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Final prelude pass: if Wei was rewritten, we owe the file a
  // `from ape.utils import convert` import. Combine that with any
  // accumulated prelude additions (e.g. unknown-exception TODOs) into
  // a single edit at the first non-import anchor, so we don't emit
  // multiple overlapping edits at the same position.
  // ────────────────────────────────────────────────────────────────────
  if (didRewriteWei) {
    // Skip the import injection if the file already has it (partial
    // prior migration, hand-edited file, etc.) — avoid duplicate
    // imports.
    const existingConvertImport = rootNode.findAll({
      rule: {
        kind: "import_from_statement",
        all: [
          { has: { field: "module_name", regex: "^ape\\.utils$" } },
          { regex: "convert" },
        ],
      },
    });
    if (existingConvertImport.length === 0) {
      preludeAdditions.unshift("from ape.utils import convert");
    }
  }
  if (didRewriteWeb3GetBalance) {
    // Same dedup logic for `from ape import chain`.
    const existingChainImport = rootNode.findAll({
      rule: {
        kind: "import_from_statement",
        all: [
          { has: { field: "module_name", regex: "^ape$" } },
          { regex: "\\bchain\\b" },
        ],
      },
    });
    if (existingChainImport.length === 0) {
      preludeAdditions.unshift("from ape import chain");
    }
  }
  if (preludeAdditions.length > 0) {
    const moduleChildren = rootNode.children();
    const anchor = moduleChildren.find((c) => {
      const k = c.kind();
      return (
        k !== "comment" &&
        k !== "future_import_statement" &&
        k !== "import_from_statement" &&
        k !== "import_statement"
      );
    });
    if (anchor) {
      // Target the anchor's FIRST TOKEN (e.g. the `def` keyword of a
      // function definition) instead of the whole anchor node. This
      // keeps the edit range tiny and non-overlapping with any other
      // edits that may target nodes inside the same anchor (e.g. Wei
      // rewrites in the function body).
      const firstToken = anchor.children()[0] ?? anchor;
      const block = preludeAdditions.join("\n");
      edits.push(firstToken.replace(`${block}\n${firstToken.text()}`));
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Stats: emit a single-line JSON summary to stderr if any edits were
  // applied. Useful for CI / wrappers; gracefully no-op when stderr is
  // unavailable (sandboxed jssg runtime may not surface it).
  // ────────────────────────────────────────────────────────────────────
  if (edits.length > 0) {
    try {
      const summary = {
        codemod: "brownie-to-ape",
        edits: edits.length,
        wei_rewritten: didRewriteWei,
        unknown_exceptions: [...unknownExceptionNames].sort(),
        rewrote_brownie_attr: didRewriteBrownieAttr,
      };
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(summary));
    } catch {
      // sandbox without console.error — silently skip
    }
  }

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default codemod;
