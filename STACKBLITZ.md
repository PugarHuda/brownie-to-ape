# Try brownie-to-ape on StackBlitz / online sandbox

Three options for running the codemod **without cloning anything locally**:

## 1. StackBlitz (one-click)

Open this URL — it forks the brownie-to-ape repo into a StackBlitz
container with Node 22 + npm pre-installed:

> https://stackblitz.com/github/PugarHuda/brownie-to-ape

Once loaded, in the StackBlitz terminal:

```bash
npm test                     # 77 fixture tests
npm run test:unit            # Vitest unit + property + qa
bash demo/run-demo.sh        # clone token-mix + run codemod + show diff
```

## 2. GitHub Codespaces

Click the green **`<> Code`** button on the
[GitHub repo](https://github.com/PugarHuda/brownie-to-ape) → **Codespaces** → **Create codespace on main**.

Codespaces gives you a full Ubuntu container with Docker available, so
you can also run `ape compile` end-to-end:

```bash
docker build -f Dockerfile.ape -t b2a-verify .
docker run --rm -v "$(pwd)/test-repos/token-mix:/work" b2a-verify "ape compile"
```

## 3. ast-grep playground (no install)

Test individual ast-grep rules against Brownie source without running
the full codemod. Pre-filled with one of the codemod's actual patterns:

> https://ast-grep.github.io/playground.html

Paste a Brownie snippet into the editor on the left, then in the right
panel select Python and try patterns like:

```yaml
# Find tx-dict patterns
rule:
  pattern: '$FUNC($$$ARGS, {"from": $ACCT})'
```

This is the same pattern engine the codemod uses internally (Tree-sitter
+ ast-grep), just running interactively instead of as a packaged
workflow.

## 4. Minimal "try-now" snippet (paste into any terminal with Node)

```bash
mkdir /tmp/try-b2a && cd /tmp/try-b2a
cat > test.py <<'EOF'
from brownie import accounts, network, Wei

def main():
    print(network.show_active())
    return Token.deploy("X", Wei("1 ether"), {"from": accounts[0]})
EOF
npx codemod@latest @pugarhuda/brownie-to-ape -t .
cat test.py
```

Expected output (after the codemod runs):

```python
# TODO(brownie-to-ape): no direct Ape equivalent for: Token, Wei
from ape import accounts, networks, project

from ape.utils import convert
def main():
    print(networks.active_provider.network.name)
    return Token.deploy("X", convert("1 ether", int), sender=accounts[0])
```

That's the codemod migrating 4 patterns simultaneously, in roughly 3
seconds.
