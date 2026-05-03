# brownie-to-ape — Project Context

Codemod migrasi otomatis Brownie → ApeWorx Ape untuk Codemod hackathon (Boring AI track).

## Stack

- **Engine:** Codemod `jssg` (https://docs.codemod.com/jssg/intro)
- **Parser:** Tree-sitter Python via `codemod:ast-grep/langs/python`
- **Runtime:** Sandboxed QuickJS/LLRT (no fs/network unless granted via `capabilities`)
- **Bahasa target:** Python (Brownie source code)
- **Test runner:** built-in `codemod jssg test`

## Struktur project

```
brownie-to-ape/
├── codemod.yaml         # package metadata (name, version, targets, registry)
├── workflow.yaml        # 1-step jssg workflow
├── scripts/codemod.ts   # ⭐ transform code (~870 LOC, 17 ordered passes)
├── scripts/migrate_config.py    # Brownie YAML → Ape YAML translator
├── scripts/cli.ts       # --list-passes / --pass N introspection
├── tests/fixtures/      # 90 input.py / expected.py pairs
├── tests/unit/          # 50 Vitest pure-helper tests
├── tests/property/      # 11 idempotency/determinism tests
├── tests/qa/            # 53 version/docs/perf/golden-master tests
├── tests/test_migrate_config*.py  # 35 pytest tests (incl. 6 Hypothesis fuzz)
├── docs/                # case studies, AI-step demo, deferred-features, logo, banner
├── package.json         # vitest + dev deps
├── tsconfig.json
├── README.md (+ README.id.md)   # user-facing docs (EN + Bahasa)
├── CASE_STUDY.md        # combined 5-repo benchmark
├── SUBMISSION.md        # DoraHacks BUIDL form helper
├── EVALUATOR.md         # 3-step hackathon judge walkthrough
├── CHANGELOG.md         # SemVer release notes
└── CLAUDE.md            # this file
```

## Cara run / test / publish

```bash
# Test (19 cases, harus pass semua)
npx codemod@latest jssg test -l python ./scripts/codemod.ts ./tests/fixtures

# Validate workflow YAML
npx codemod@latest workflow validate -w workflow.yaml

# Dry-run on a target repo
npx codemod@latest workflow run -w workflow.yaml --target /path/to/brownie/repo --dry-run

# Real run
npx codemod@latest workflow run -w workflow.yaml --target /path/to/brownie/repo --no-interactive --allow-dirty

# Publish ke registry (perlu login dulu — user action)
npx codemod@latest login
npx codemod@latest publish
```

## Architecture: 17-pass transform

Lihat `scripts/codemod.ts` (~870 LOC). Urutan pass penting karena edit overlap dihindari via:

1. Sequencing: specific patterns (Pass 2) duluan dari generic (Pass 3)
2. Whitelisting: `network` sengaja TIDAK ada di `ATTR_RENAMES` supaya `brownie.network` raw tidak di-rewrite (cukup `brownie.network.show_active()` yang kena Pass 2)
3. AST containment check: `isInsideDictionary()` skip Pass 3 di dalam dict — biar Pass 4 ambil alih

Cek pass list lengkap dengan: `npx tsx scripts/cli.ts --list-passes`

Highlights:
- **Pass 1:** `from brownie import …` → `from ape import …` (rename `network`→`networks`, drop contract names + unsupported builtins, relocate constants `ZERO_ADDRESS` → `ape.utils`)
- **Pass 2:** `brownie.network.show_active()` + bare `network.show_active()` → `networks.active_provider.network.name`
- **Pass 2c:** Exception class renames (`VirtualMachineError` → `ContractLogicError`, dll)
- **Pass 3:** `brownie.<whitelisted_attr>` → `ape.<attr>` (skips inside dicts)
- **Pass 4:** tx-dict `{"from": …}` → `sender=…, …` kwargs (whitelist guard: all keys harus di TX_DICT_KEYS)
- **Pass 5:** `chain.mine(N)` → `chain.mine(num_blocks=N)`
- **Pass 6:** `chain.sleep(N)` (statement) → `chain.pending_timestamp += N`
- **Pass 7:** `accounts.add(pk)` inline TODO
- **Pass 7b:** `accounts.at(addr, force=True)` → `accounts.impersonate_account(addr)` (whale impersonation)
- **Pass 8:** `def isolate(fn_isolation): pass` fixture detection
- **Pass 9:** `Wei("X")` → `convert("X", int)` + auto-import
- **Pass 10:** `interface.IERC20(addr)` inline TODO
- **Pass 11-12:** `Web3.toWei` / `fromWei` inline TODOs, web3 preserve
- **Pass 13-14:** Event field renames (`tx.events[…].args.X` → `tx.events[…].X`)
- **Pass 15:** Contract artifact rewrite untuk pola yang aman
- **Pass 16:** `web3.eth.X` → `networks.provider.web3.eth.X`
- **Pass 17:** Fixup pass — residual brownie references → top-of-file TODO

## Zero-FP guards (jangan dilonggarkan tanpa pertimbangan)

- File-level `sourceText.includes("brownie")` early exit
- `TX_DICT_KEYS` whitelist + `"from"` required
- `IMPORT_NAMES_DROP` + `isLikelyContractName()` heuristic untuk drop contract artifacts
- Wildcard import `from brownie import *` di-skip
- Replace dict node only (bukan whole arg list) supaya tidak bentrok dengan edit Pass 3

## Convention untuk maintenance

- **Tambah transform baru:** tambah test fixture dulu (TDD), lalu update `scripts/codemod.ts`
- **Rename mapping:** edit `IMPORT_NAME_RENAMES`, `IMPORT_NAMES_DROP`, `ATTR_RENAMES`, `TX_DICT_KEYS` constants di top of file
- **API jssg yang dipakai:** `findAll`, `field`, `children`, `kind`, `text`, `parent`, `replace`, `commitEdits`. Tidak pakai `range()` karena tidak konsisten support.
- **Naming fixture:** `NN-deskripsi-singkat/{input.py,expected.py}` (NN = 2-digit number, urut)

## Validasi nyata

Tested on 5 OSS repos, semua 0 FP:
- `brownie-mix/token-mix` → 4/5 .py modified, ~62 patterns
- `PatrickAlphaC/brownie_fund_me` → 5/6 .py modified, ~21 patterns
- `PatrickAlphaC/smartcontract-lottery` → 5/7 .py modified, ~30 patterns
- `PatrickAlphaC/aave_brownie_py_freecode` → 4/5 .py modified, ~24 patterns
- `yearn/brownie-strategy-mix` ⭐ → 4/7 .py modified, ~33 patterns

End-to-end on token-mix: `ape compile` SUCCESS + `ape test --network ::test` → **38 passed, 0 failed in 5.40s** (lihat `docs/ape-verify-token-mix.log`).

Reset workflow:
```bash
cd ../test-repos/token-mix && git checkout -- .
cd ../test-repos/brownie_fund_me && git checkout -- .
```

## Limitations / TODO list (intentional FN)

Patterns yang sengaja TIDAK di-auto-migrate (akan jadi `# TODO(brownie-to-ape):` comment atau dropped from import):

- Contract artifacts (`Token`, `FundMe`) — Ape pakai `project.<Name>`, tidak bisa di-infer tanpa schema introspection
- `MockV3Aggregator[-1]` "last deployed" subscript style
- `accounts.add(private_key)` — Ape: `accounts.import_account_from_private_key(...)`
- `chain.mine(N)`, `chain.sleep(N)` argument styles
- `brownie.exceptions.X` — class names beda di `ape.exceptions`
- `brownie-config.yaml` → `ape-config.yaml` (YAML config migration — di luar scope codemod ini)

Ini semua di-handle di README + CASE_STUDY sebagai TODO yang user/AI cleanup.
