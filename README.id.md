# @pugarhuda/brownie-to-ape

> Codemod migrasi otomatis dari **Brownie → ApeWorx Ape** untuk smart-contract project Python. Sudah divalidasi di **5 OSS repo** (termasuk Yearn Finance) dengan **0 false positive**.

[English version → README.md](./README.md)

[![CI](https://github.com/PugarHuda/brownie-to-ape/actions/workflows/test.yml/badge.svg)](https://github.com/PugarHuda/brownie-to-ape/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## TL;DR

```bash
npx codemod@latest @pugarhuda/brownie-to-ape -t /path/to/your/brownie/repo
```

- **17-pass jssg transform** dengan FP-guard ketat (lebih milih FN daripada FP — keep manual review trivial)
- **250 tests:** 90 fixture (jssg) + 125 Vitest (unit/property/QA) + 35 pytest (config translator + Hypothesis fuzzer)
- **5 real OSS repos** divalidasi: token-mix, brownie_fund_me, smartcontract-lottery, aave_brownie_py_freecode, **yearn/brownie-strategy-mix**
- **Perf:** ~3 detik per repo (post npx warmup)
- **Live demo:** https://pugarhuda.github.io/brownie-to-ape/
- **Codemod registry:** https://app.codemod.com/registry/@pugarhuda/brownie-to-ape

## Apa yang di-otomatisasi (deterministik, 0 FP)

| # | Pattern | Sebelum | Sesudah |
|---|---|---|---|
| 1 | Import dasar | `from brownie import accounts, network, chain` | `from ape import accounts, networks, chain` |
| 2 | Konstanta | `from brownie import ZERO_ADDRESS` | `from ape.utils import ZERO_ADDRESS` |
| 3 | `brownie.accounts/project/chain/...` | `brownie.accounts[0]` | `ape.accounts[0]` |
| 4 | `network.show_active()` | `brownie.network.show_active()` | `networks.active_provider.network.name` |
| 5 | tx-dict → kwargs | `Token.deploy({"from": acct, "value": 1e18})` | `Token.deploy(sender=acct, value=1e18)` |
| 6 | `chain.mine(N)` | `chain.mine(5)` | `chain.mine(num_blocks=5)` |
| 7 | `chain.sleep(N)` (statement) | `chain.sleep(60)` | `chain.pending_timestamp += 60` |
| 8 | `Wei("X")` | `Wei("1 ether")` | `convert("1 ether", int)` |
| 9 | Exception classes | `exceptions.VirtualMachineError` | `exceptions.ContractLogicError` |
| 10 | `accounts.add(pk)` | inline TODO + `accounts.import_account_from_private_key(...)` |
| 11 | `interface.IERC20(addr)` | inline TODO + Ape pattern `Contract(addr)` |
| 12 | `Web3.toWei`/`fromWei` | inline TODO untuk migrasi `convert(...)` |
| 13 | `def isolate(fn_isolation): pass` fixture | TODO: hapus, Ape sudah punya `chain.isolate()` |

Pola yang **tidak bisa di-infer secara otomatis** (contract artifact references) di-flag dengan `# TODO(brownie-to-ape):` comment, supaya AI agent atau reviewer manusia tinggal cleanup ringan.

## Cara pakai

### Opsi 1 — Langsung dari registry (paling cepat)

```bash
npx codemod@latest @pugarhuda/brownie-to-ape -t /path/to/repo
```

### Opsi 2 — Clone & jalankan lokal

```bash
git clone https://github.com/PugarHuda/brownie-to-ape && cd brownie-to-ape
npm test                              # 90 fixture tests
npx codemod@latest workflow run \
  -w workflow.yaml \
  --target /path/to/your/brownie/repo \
  --no-interactive --allow-dirty
```

### Opsi 3 — Migrasi `brownie-config.yaml` ke `ape-config.yaml`

```bash
python scripts/migrate_config.py /path/to/your/repo
# Hasilnya: ape-config.yaml dibuat, brownie-config.yaml di-rename ke .legacy
```

### Setelah codemod jalan

1. **Inspect TODOs:** `grep -rn "TODO(brownie-to-ape)" /path/to/repo`
2. **Manual fix:** TODOs biasanya cuma 1-3 per repo (contract artifact deploy `project.Token.deploy(...)`)
3. **Verify build:** `pip install eth-ape && ape compile`
4. **Run tests:** `ape test`

Lihat [`demo/ai-step-demo.md`](demo/ai-step-demo.md) untuk walk-through end-to-end pakai `brownie-mix/token-mix`.

## Validasi di repo nyata

| Repo | Files modified | Patterns auto-migrated | FP | FN (TODOs) |
|---|---|---|---|---|
| brownie-mix/token-mix | 4/5 .py | ~62 | 0 | 1 |
| PatrickAlphaC/brownie_fund_me | 5/6 .py | ~21 | 0 | 4 |
| PatrickAlphaC/smartcontract-lottery | 5/7 .py | ~30 | 0 | 5 |
| PatrickAlphaC/aave_brownie_py_freecode | 4/5 .py | ~24 | 0 | 5 |
| **yearn/brownie-strategy-mix** ⭐ | 4/7 .py | ~33 | 0 | 6 |

## Test suite (250 tests total)

```bash
# 90 fixture tests (snapshot-based)
npm test

# 125 Vitest tests (helper unit + property + QA)
npm run test:unit

# 23 pytest tests (config translator + Hypothesis fuzzer)
npm run test:python
```

| Layer | Tests | Tujuan |
|---|---|---|
| Fixture (jssg) | 90 | Specification & regression |
| Vitest unit | 50 | Pure helper functions |
| Vitest property | 11 | Idempotency & determinism invariants |
| Vitest QA | 56 | Version consistency, docs integrity, perf budget, golden-master |
| pytest unit | 16 | Config translator |
| pytest fuzzer | 6 | Hypothesis property tests (random YAML inputs) |
| pytest legacy | 13 | unittest TestCase compatibility |

## Architecture: 17-pass transform

Lihat [`scripts/codemod.ts`](scripts/codemod.ts) — setiap pass urutannya penting:

1. `from brownie import …` → `from ape import …` dengan rename + drop
2. `import brownie` → `import ape`
3. `brownie.<attr>` → `ape.<attr>` (skip kalau di dalam dict literal)
4. tx-dict → kwargs (`{"from": x}` → `sender=x`)
5. `chain.mine(N)` → `chain.mine(num_blocks=N)`
6. `chain.sleep(N)` statement → `chain.pending_timestamp += N`
7. `Wei("X")` → `convert("X", int)` + auto-import
8. `exceptions.VirtualMachineError` → `exceptions.ContractLogicError`
9. `accounts.add(pk)` inline TODO
10. `interface.IERC20(addr)` inline TODO
11. `Web3.toWei`/`fromWei` inline TODO
12. `network.show_active()` → `networks.active_provider.network.name`
13. Event field renames (`tx.events[…].args.X` → `tx.events[…].X`)
14. Contract artifact rewrite (`Token` → `project.Token`) untuk pola yang aman
15. `chain.id` ↔ `networks.provider.chain_id`
16. `Web3.eth.X` → `networks.provider.web3.eth.X`
17. Fixup pass (residual brownie references → TODO)

## Limitations / FN yang sengaja

Pattern yang TIDAK di-auto-migrate (akan jadi `# TODO(brownie-to-ape):`):

- Contract artifact deploy (butuh project schema introspection)
- Custom test fixture dengan body non-trivial
- Dependency string yang format-nya tidak standar di `brownie-config.yaml`

## Kontribusi

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md). PR welcome — terutama:
- Fixture baru untuk pattern Brownie yang belum tertangani
- Validasi di Brownie repo lain (silakan tambah di tabel validasi di atas)
- Translation review (Bahasa Indonesia / English)

## Lisensi

MIT — lihat [LICENSE](LICENSE).

## Author

**Pugar Huda Mantoro** ([@PugarHuda](https://github.com/PugarHuda))
- Email: pugarhudam@gmail.com
- Submission untuk: Codemod "Boring AI" Hackathon (DoraHacks 2026)
