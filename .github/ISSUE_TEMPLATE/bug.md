---
name: Bug report (incorrect transform)
about: The codemod produced a wrong / broken output on a Brownie file
title: "[bug] "
labels: bug
---

## What went wrong

<!-- Describe what the codemod did vs. what you expected. -->

## Minimal reproduction

A snippet of the Brownie source file that triggers the bug:

```python
# input
```

What the codemod produced:

```python
# actual output
```

What you expected:

```python
# expected output
```

## Environment

- Codemod CLI version: `npx codemod@latest --version` →
- Node version: `node --version` →
- OS:
- Brownie repo URL (if public): https://github.com/

## Severity (your judgement)

- [ ] **False positive** (wrong rewrite) — the codemod's "0 FP" claim is broken
- [ ] **False negative** (missed pattern) — pattern not handled, no incorrect output
- [ ] **Workflow / tooling** — codemod ran but something around it broke
