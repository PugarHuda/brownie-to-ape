# Publishing the case studies — a 15-minute checklist

Three case studies are drafted in this directory, ready to be published.
Each one targets the hackathon's **Track 2 Public Case Studies** prize
(`$200 per published case study`).

| # | File | Angle | Recommended platform |
|---|------|-------|----------------------|
| 1 | [`MEDIUM_ARTICLE.md`](./MEDIUM_ARTICLE.md) | End-to-end token-mix migration with `ape test` 38/38 PASS | **Medium** (broadest reach) |
| 2 | [`CASE_STUDY_2_YEARN.md`](./CASE_STUDY_2_YEARN.md) | Yearn Finance strategy template, DeFi-specific patterns | **dev.to** (Web3/DeFi audience) or Medium |
| 3 | [`CASE_STUDY_3_TRADEOFFS.md`](./CASE_STUDY_3_TRADEOFFS.md) | Engineering judgment / FN-vs-FP design philosophy | **Medium** or personal blog |

## Step-by-step (per article, ~5 min each)

### 1. Open the source markdown

Open the file from the table above in any text editor or directly on
GitHub (the formatting renders cleanly in browser preview).

### 2. Copy the entire content

Select all (`Ctrl+A`), copy (`Ctrl+C`).

### 3. Create a new story on Medium

- Go to https://medium.com/new-story (must be signed in).
- Paste the content.
- **Important:** Medium's import doesn't render some markdown features:
  - **Tables** — Medium does NOT render markdown tables. Either:
    - Convert tables to bullet lists, OR
    - Take a screenshot of the rendered table from the GitHub view and embed as image.
  - **Code blocks** — paste each code block separately so Medium auto-detects the language. Click the `</>` icon and paste.
  - **Images** — link via URL: use the `https://raw.githubusercontent.com/PugarHuda/brownie-to-ape/main/docs/<filename>` pattern.
- Title: use the H1 from the article (Medium auto-detects).
- Subtitle: paste the H1's first sentence.
- Tags: `Codemod`, `Python`, `Ethereum`, `Smart Contracts`, `Migration`, `ApeWorx`, `Brownie`, `Web3`.

### 4. Add the cover image

Upload `docs/banner.png` (or `docs/logo.png` for a square thumbnail) as
the cover image. Medium will use this for previews on social media and
the homepage.

### 5. Publish

Click **Publish** → choose tags → click **Publish now**. You get a public URL
like `https://medium.com/@yourhandle/...`. Save this URL.

### 6. Add the URL to the GitHub repo

Edit [`SUBMISSION.md`](../SUBMISSION.md) → **Links** section, add:

```markdown
- **Case study (token-mix end-to-end):** https://medium.com/@yourhandle/...
- **Case study (Yearn DeFi):** https://medium.com/@yourhandle/...
- **Case study (engineering tradeoffs):** https://medium.com/@yourhandle/...
```

Commit + push.

### 7. Add the URL to the DoraHacks BUIDL form

In the BUIDL form's **Links** section, paste each case study URL.

## Alternative: dev.to

dev.to (https://dev.to/new) renders markdown more faithfully than
Medium — tables work, code blocks auto-detect language, no manual
conversion needed.

For Case Study 2 (Yearn DeFi), dev.to is probably the better choice
since dev.to has a stronger Web3/DeFi reader base.

## Alternative: personal blog / Hashnode / GitHub Pages

If you have a personal blog, paste there. The hackathon explicitly
rewards "Public Case Studies" — any indexable public URL counts.
Hashnode (https://hashnode.com/) is a developer-focused alternative
to Medium with similar formatting flexibility.

## Verification before submitting

For each published article, verify:

- [ ] URL resolves publicly (no auth required, no login wall)
- [ ] Article shows the codemod's GitHub link (https://github.com/PugarHuda/brownie-to-ape)
- [ ] Cover image / banner is set
- [ ] Tags include `Codemod` (so the hackathon team can search-discover it)

## Why publish all three (not just one)

The hackathon's Track 2 rule says **`$200 per published case study`** —
plural. Each distinct case study is independently scored. Publishing
3 articles *that genuinely cover different angles* (end-to-end, DeFi,
engineering judgment) increases expected payout from $200 → $400-600
without diluting the codemod's core narrative.

Three is also the practical ceiling: a 4th article would cannibalize
the others' search visibility and look like padding to evaluators.
