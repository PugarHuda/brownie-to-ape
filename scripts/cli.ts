// Standalone CLI wrapper for brownie-to-ape, providing introspection
// flags that the underlying jssg runtime doesn't expose directly.
//
// Usage:
//   npx tsx scripts/cli.ts --list-passes
//   npx tsx scripts/cli.ts --help
//
// The actual codemod runs via `npx codemod@latest @pugarhuda/brownie-to-ape`.
// This wrapper is for inspection / debugging only.

const PASSES = [
  {
    n: 1,
    name: "from-brownie-import",
    summary:
      "from brownie import X → from ape import X' with name renames, drops, preserves, and ape.utils moves",
  },
  {
    n: "2a",
    name: "qualified-network-show-active",
    summary:
      "brownie.network.show_active() → networks.active_provider.network.name",
  },
  {
    n: "2b",
    name: "bare-network-show-active",
    summary: "network.show_active() → networks.active_provider.network.name",
  },
  {
    n: "2c",
    name: "exceptions-rename",
    summary:
      "exceptions.VirtualMachineError → exceptions.ContractLogicError (and other known names; unknown ones get a top-of-file TODO)",
  },
  {
    n: 3,
    name: "brownie-attr-rename",
    summary:
      "brownie.{reverts,accounts,project,config,chain} → ape.<attr> (whitelist; skips inside dictionary literals)",
  },
  {
    n: "3b",
    name: "import-brownie-rename",
    summary: "import brownie → import ape (only when Pass 3 fired)",
  },
  {
    n: 4,
    name: "tx-dict-to-kwargs",
    summary:
      "Contract.method(arg, {\"from\": x, \"value\": v}) → Contract.method(arg, sender=x, value=v) — method-call only, whitelist + spread guards",
  },
  {
    n: 5,
    name: "chain-mine",
    summary: "chain.mine(N) → chain.mine(num_blocks=N) (positional → kwarg)",
  },
  {
    n: 6,
    name: "chain-sleep",
    summary:
      "chain.sleep(N) statement → chain.pending_timestamp += N (statement context only)",
  },
  {
    n: 7,
    name: "accounts-add-todo",
    summary:
      "accounts.add(...) → inline TODO appended to closing ) (safe-context only)",
  },
  {
    n: "7b",
    name: "accounts-impersonate",
    summary:
      "accounts.at(addr, force=True) → accounts.impersonate_account(addr) (force=True required)",
  },
  {
    n: 8,
    name: "isolate-fixture-todo",
    summary:
      "def isolate(fn_isolation): pass → top TODO that Ape provides chain.isolate() natively",
  },
  {
    n: 9,
    name: "wei-to-convert",
    summary:
      "Wei(\"X\") → convert(\"X\", int) + auto-inject from ape.utils import convert (deduplicated)",
  },
  {
    n: 10,
    name: "interface-todo",
    summary:
      "interface.X(addr) → inline TODO at safe context (Ape uses Contract(addr) with explicit ABI)",
  },
  {
    n: 12,
    name: "web3-tomei-todo",
    summary:
      "Web3.toWei(...) / Web3.fromWei(...) → inline TODO (web3.py-adjacent)",
  },
  {
    n: 13,
    name: "event-index-field",
    summary:
      "tx.events[N][key] → tx.events[N].event_arguments[key] (integer inner key)",
  },
  {
    n: 14,
    name: "event-name-field",
    summary:
      'tx.events["Name"][key] → [log for log in tx.events if log.event_name == "Name"][0].event_arguments[key]',
  },
  {
    n: 15,
    name: "project-containers",
    summary:
      "Uppercase[-1], len(Uppercase), Uppercase.at(addr) → project.<Name>.deployments[...] / .at(...)",
  },
  {
    n: 16,
    name: "web3-eth-get-balance",
    summary:
      "web3.eth.get_balance(X) → chain.get_balance(X) + auto-inject from ape import chain (deduplicated)",
  },
];

function help(): void {
  console.log(
    [
      "brownie-to-ape CLI wrapper",
      "",
      "Usage:",
      "  npx tsx scripts/cli.ts --list-passes",
      "      Show all 17 transform passes with one-line descriptions",
      "  npx tsx scripts/cli.ts --pass <N>",
      "      Show details for a specific pass",
      "  npx tsx scripts/cli.ts --help",
      "      This help",
      "",
      "To actually RUN the codemod on a target repo, use:",
      "  npx codemod@latest @pugarhuda/brownie-to-ape --target /path/to/repo",
    ].join("\n"),
  );
}

function listPasses(): void {
  const w = Math.max(...PASSES.map((p) => String(p.n).length)) + 2;
  console.log("brownie-to-ape — 17 transform passes:\n");
  for (const p of PASSES) {
    const num = `Pass ${String(p.n).padStart(w - 5)}`;
    console.log(`  ${num}  ${p.name.padEnd(28)}  ${p.summary}`);
  }
  console.log(
    `\nTotal: ${PASSES.length} passes. See scripts/codemod.ts for implementation.`,
  );
}

function showPass(n: string): void {
  const found = PASSES.find((p) => String(p.n) === n);
  if (!found) {
    console.error(`Unknown pass: ${n}. Use --list-passes to see all.`);
    process.exit(1);
  }
  console.log(`Pass ${found.n}: ${found.name}`);
  console.log(found.summary);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  help();
} else if (args.includes("--list-passes")) {
  listPasses();
} else if (args[0] === "--pass" && args[1]) {
  showPass(args[1]);
} else {
  console.error(`Unknown args: ${args.join(" ")}`);
  help();
  process.exit(1);
}
