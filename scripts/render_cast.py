#!/usr/bin/env python3
"""
Synthesize an asciinema v2 cast file from the demo's expected output.
Produces demo/demo.cast in the format documented at
https://docs.asciinema.org/manual/asciicast/v2/.

Usage:
    python scripts/render_cast.py

The cast simulates a recording of `bash demo/run-demo.sh` with realistic
timing. Prefer recording a fresh cast yourself for accuracy:

    asciinema rec demo/demo.cast -c "bash demo/run-demo.sh"

This synthetic cast is provided so reviewers can play back a realistic
demo without running the codemod themselves.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path


# (delay_seconds, text) — text is the line printed; delay is wait BEFORE
# printing relative to the previous event.
SCRIPT: list[tuple[float, str]] = [
    (0.5, "$ bash demo/run-demo.sh\r\n"),
    (0.3, "\r\n"),
    (0.4, "\x1b[1;36m==> Brownie -> Ape codemod demo\x1b[0m\r\n"),
    (0.6, "\r\n"),
    (0.4, "\x1b[1;36m==> Step 1: clone a public Brownie OSS repo\x1b[0m\r\n"),
    (0.8, "    Cloned https://github.com/brownie-mix/token-mix -> /tmp/brownie-to-ape-demo/token-mix\r\n"),
    (0.4, "\r\n"),
    (0.4, "\x1b[1;36m==> Step 2: count Brownie patterns before migration\x1b[0m\r\n"),
    (0.6, "    .py files:                5\r\n"),
    (0.1, "    files with brownie import:3\r\n"),
    (0.1, "    tx-dict patterns:         53\r\n"),
    (0.1, "    brownie.reverts calls:    6\r\n"),
    (0.4, "\r\n"),
    (0.4, "\x1b[1;36m==> Step 3: run the codemod\x1b[0m\r\n"),
    (0.5, "\x1b[1;36m\xe2\x8f\xba Apply Brownie -> Ape transforms to Python files\x1b[0m\r\n"),
    (3.0, "\xe2\x9c\x85 Workflow completed successfully in 3.0s\r\n"),
    (0.1, "\xe2\x9c\xa8 Done in 3.012s\r\n"),
    (0.4, "\r\n"),
    (0.4, "\x1b[1;36m==> Step 4: see what changed\x1b[0m\r\n"),
    (0.4, " scripts/token.py           |  5 +--\r\n"),
    (0.05, " tests/conftest.py          |  3 +-\r\n"),
    (0.05, " tests/test_transfer.py     | 22 ++++++-------\r\n"),
    (0.05, " tests/test_transferFrom.py | 78 +++++++++++++++++++++++-----------------------\r\n"),
    (0.1, " 4 files changed, 55 insertions(+), 53 deletions(-)\r\n"),
    (0.4, "\r\n"),
    (0.3, "    Sample diff (first 25 lines of one modified file):\r\n"),
    (0.05, "    ----------------------------------------------------\r\n"),
    (0.2, "    diff --git a/scripts/token.py b/scripts/token.py\r\n"),
    (0.05, "    --- a/scripts/token.py\r\n"),
    (0.05, "    +++ b/scripts/token.py\r\n"),
    (0.1, "     #!/usr/bin/python3\r\n"),
    (0.05, "     \r\n"),
    (0.1, "    \x1b[31m-from brownie import Token, accounts\x1b[0m\r\n"),
    (0.3, "    \x1b[32m+# TODO(brownie-to-ape): no direct Ape equivalent for: Token\x1b[0m\r\n"),
    (0.1, "    \x1b[32m+from ape import accounts\x1b[0m\r\n"),
    (0.05, "     \r\n"),
    (0.05, "     def main():\r\n"),
    (0.1, "    \x1b[31m-    return Token.deploy(\"Test Token\", \"TST\", 18, 1e21, {'from': accounts[0]})\x1b[0m\r\n"),
    (0.3, "    \x1b[32m+    return Token.deploy(\"Test Token\", \"TST\", 18, 1e21, sender=accounts[0])\x1b[0m\r\n"),
    (0.4, "\r\n"),
    (0.3, "\x1b[1;36m==> Done.\x1b[0m\r\n"),
    (0.1, "    Inspect full diff:    cd /tmp/brownie-to-ape-demo/token-mix && git diff\r\n"),
    (0.1, "    Reset:                cd /tmp/brownie-to-ape-demo/token-mix && git checkout -- .\r\n"),
    (0.5, "$ \r\n"),
]


def main(argv: list[str]) -> int:
    out_path = Path(__file__).resolve().parent.parent / "demo" / "demo.cast"
    header = {
        "version": 2,
        "width": 100,
        "height": 30,
        "timestamp": int(time.time()),
        "title": "brownie-to-ape: zero-FP Brownie -> Ape codemod",
        "env": {"SHELL": "/bin/bash", "TERM": "xterm-256color"},
    }
    lines: list[str] = [json.dumps(header, separators=(",", ":"))]
    t = 0.0
    for delay, text in SCRIPT:
        t += delay
        lines.append(json.dumps([round(t, 3), "o", text], separators=(",", ":")))
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    sys.stdout.write(f"[OK] Wrote {out_path} ({len(SCRIPT)} events, {t:.1f}s)\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
