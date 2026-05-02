# Uploading the asciinema cast to asciinema.org

The local cast at `demo/demo.cast` (2.8 KB, 44 events, ~14s playback)
is already embedded in the live demo at
https://pugarhuda.github.io/brownie-to-ape/ via asciinema-player CDN.

If you want a **shareable URL** for the DoraHacks BUIDL form (or any
external link), upload it to asciinema.org. This requires interactive
authentication so you (mas Huda) need to run the commands:

## Steps

1. **Install asciinema CLI** (one-time, on Windows via WSL or Git Bash):
   ```bash
   pip install asciinema
   ```

2. **Upload the cast**:
   ```bash
   cd "F:/Hackathons/Hackathon Boring AI/brownie-to-ape"
   asciinema upload demo/demo.cast
   ```

3. **Authenticate** — the upload command prints a URL like
   `https://asciinema.org/connect/abc123`. Open it in your browser,
   sign in with GitHub, and your terminal session is now linked.

4. **Get the shareable URL** — after upload, asciinema prints a URL
   like `https://asciinema.org/a/123456`. Add it to your
   `SUBMISSION.md` and DoraHacks form.

## Optional: re-record the cast first

If you want a fresh recording showing the v0.7.7 version + ape-verify
proof, re-run:

```bash
cd "F:/Hackathons/Hackathon Boring AI/brownie-to-ape"
bash demo/run-demo.sh    # records into demo/demo.cast
asciinema upload demo/demo.cast
```

## Why this needs to be manual

`asciinema upload` opens a browser-based OAuth flow and writes a
local install ID to `~/.config/asciinema/install-id`. CI / agent
runners can't complete the OAuth handshake. Once linked, future
uploads from the same machine work without re-auth.
