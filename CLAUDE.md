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
├── scripts/codemod.ts   # ⭐ transform code (4 ordered passes)
├── tests/fixtures/      # 19 input.py / expected.py pairs
├── package.json         # tsconfig + dev deps
├── tsconfig.json
├── README.md            # user-facing docs
├── CASE_STUDY.md        # hackathon submission write-up
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

## Architecture: 4-pass transform

Lihat `scripts/codemod.ts`. Urutan pass penting karena edit overlap dihindari via:

1. Sequencing: specific patterns (Pass 2) duluan dari generic (Pass 3)
2. Whitelisting: `network` sengaja TIDAK ada di `ATTR_RENAMES` supaya `brownie.network` raw tidak di-rewrite (cukup `brownie.network.show_active()` yang kena Pass 2)
3. AST containment check: `isInsideDictionary()` skip Pass 3 di dalam dict — biar Pass 4 ambil alih via regex re-rename

Pass list:
- **Pass 1:** `from brownie import …` → `from ape import …` (rename `network`→`networks`, drop contract names + unsupported builtins)
- **Pass 2a:** `brownie.network.show_active()` → `networks.active_provider.network.name`
- **Pass 2b:** bare `network.show_active()` → same
- **Pass 3:** `brownie.<whitelisted_attr>` → `ape.<attr>` (skips inside dicts)
- **Pass 3b:** `import brownie` → `import ape` (only if Pass 3 fired)
- **Pass 4:** tx-dict `{"from": …}` → `sender=…, …` kwargs (whitelist guard: all keys harus di TX_DICT_KEYS)

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

Tested on:
- `brownie-mix/token-mix` (cd ../test-repos/token-mix) → 4/5 .py modified, 0 FP
- `PatrickAlphaC/brownie_fund_me` (cd ../test-repos/brownie_fund_me) → 5/6 .py modified, 0 FP

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
