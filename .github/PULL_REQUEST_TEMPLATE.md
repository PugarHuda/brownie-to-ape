## What this PR does

<!-- One-line summary. What pattern / behavior is changing? -->

## Why

<!-- The Brownie idiom this addresses, and why a codemod is the right tool
for it. Link to Ape docs if helpful. -->

## Test coverage

- [ ] Added a positive fixture (`tests/fixtures/NN-name/{input,expected}.py`)
- [ ] Added a negative fixture proving the pass does NOT fire in a related
      FP-risk context
- [ ] All `npx codemod@latest jssg test -l python ./scripts/codemod.ts ./tests/fixtures` pass
- [ ] `bash scripts/benchmark.sh` runs cleanly on the four reference repos
- [ ] Manually audited the diff on each repo for false positives

## FP audit notes

<!-- Walk through the FP scenarios this transform could trigger, and how
the guards prevent each one. The "0 false positives" claim depends on
this thinking being explicit. -->

## CHANGELOG

- [ ] Updated `CHANGELOG.md` under `[Unreleased]`
