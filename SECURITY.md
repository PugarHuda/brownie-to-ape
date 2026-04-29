# Security Policy

## Scope

`brownie-to-ape` is a code transformation tool that runs locally on Python
source files. It does **not** execute the transformed code, make network
requests, or read secrets. The codemod's "False Positive" risk is the main
correctness concern, not security.

That said, if you find one of the following, please report it:

1. **Code injection** — the codemod produces output that could execute
   attacker-controlled code (e.g. via shell escapes in a TODO comment, or
   crafted input that causes arbitrary text in the AST to be evaluated).
2. **Path traversal** in `scripts/migrate_config.py` — the YAML helper
   reads `brownie-config.yaml` and writes `ape-config.yaml`. Any escape
   from those file paths is in scope.
3. **Codemod CLI capability escalation** — if the workflow declares
   `capabilities: []` but somehow gains `fs` / `fetch` / `child_process`
   access at runtime.
4. **Supply chain** — anything affecting the codemod's published
   registry package or the GitHub Actions OIDC publishing flow.

## Out of scope

- The codemod producing semantically wrong output (this is a "false
  positive" — file a regular bug report at
  https://github.com/PugarHuda/brownie-to-ape/issues using the bug
  template). Correctness is critical, but it isn't a security issue.
- Vulnerabilities in Brownie or Ape themselves — report those upstream.
- Vulnerabilities in `npx codemod@latest` itself — report at
  https://github.com/codemod/codemod/issues.

## How to report

Email `pugarhudam@gmail.com` with the subject prefix `[SECURITY]`.
Please include:

- A minimal reproducing input file or command
- The codemod version (`grep version codemod.yaml`)
- Codemod CLI version (`npx codemod@latest --version`)
- Your Node.js version

I'll acknowledge within 7 days. If the report is valid, the fix will land
in a patch release with a CVE-style note in `CHANGELOG.md` (no public
disclosure of the reproducer until the patch is published).

## Supported versions

Pre-1.0: only the latest tag (`v0.7.x`) gets security patches. Once a
1.0 release happens, the previous minor (`0.7.x`) will receive patches
for 90 days.
