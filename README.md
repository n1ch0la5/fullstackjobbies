# fullstackjobbies

**We sift through the 💩 so you don't have to.** Full stack jobs, rated by devs.

This repo holds the **sifter**: a daily routine that finds full stack jobs, rates them on the Jobbie Scale, and saves the results as JSON for the site to read.

## The Jobbie Scale

| Level | Name | |
|---|---|---|
| 5 | Rocket ship | 🚀 |
| 4 | Solid | 💯 |
| 3 | Meh | 😐 |
| 2 | Bit whiffy | 🤢 |
| 1 | Steaming pile | 💩 |
| 0 | Bloody awful | ☠️ |

## How the sift works (and why it's cheap)

1. **Discover** from free public feeds:
   - Company job boards on **Greenhouse**, **Lever** and **Ashby**, listed in `data/companies.json`.
   - The monthly **Hacker News "Who is hiring?"** thread. Each post is a job, and any board links in it are added to `data/companies.json` automatically, so the company list grows itself.
2. **Filter with plain code** (free): keep only full stack titles.
3. **Extract facts**: salary, stack, remote, interview rounds, interview style, red flags.
   - Rule-based extraction always runs and costs nothing.
   - If `ANTHROPIC_API_KEY` is set, a small model also reads each listing to catch what regexes miss. It only runs on **new or changed** full stack listings (cached by a hash of the text), capped by `MAX_AI_PER_RUN`.
4. **Score with a formula**, not AI opinion, so every rating is explainable. See `src/score.js`; each job carries its `reasons`.
5. **House rule: salary or it doesn't get posted.** Listings without a salary are not published. The worst ones (Level 0 and 1) go to `data/jobbie-of-the-week-candidates.json`.

We publish facts, a rating and a link. **"Apply" always goes to the company's own page**; we don't republish full job descriptions.

## Output

| File | What it is |
|---|---|
| `data/jobs.json` | Published listings, best first. This is what the site reads. |
| `data/jobbie-of-the-week-candidates.json` | The 10 worst, for Friday's post. |
| `data/companies.json` | Boards we check. Failing boards are disabled after 3 misses in a row. |
| `data/cache.json` | Extracted facts per listing, so nothing is re-processed. |
| `data/stats.json` | Counts from the latest run. |

## Running it

Needs Node 20+. No dependencies.

```bash
npm test          # unit tests + an end-to-end run with the network stubbed
npm run sift      # real run; writes to data/
DRY_RUN=1 npm run sift   # real run, writes nothing
```

It runs every morning via GitHub Actions (`.github/workflows/sift.yml`) and commits fresh data. To turn on the AI step, add an `ANTHROPIC_API_KEY` secret in **Settings → Secrets and variables → Actions**. Use the **Actions → Daily sift → Run workflow** button to run it on demand.

## Adding companies

Add an entry to `data/companies.json`. The slug is the board name in the company's jobs URL:

- `boards.greenhouse.io/<slug>` → `{ "ats": "greenhouse", "slug": "<slug>" }`
- `jobs.lever.co/<slug>` → `{ "ats": "lever", "slug": "<slug>" }`
- `jobs.ashbyhq.com/<slug>` → `{ "ats": "ashby", "slug": "<slug>" }`

## Tuning

- Scoring weights, pay bands and currency rates: `src/score.js`
- Red-flag phrases and interview-style detection: `src/extract.js`
- What counts as full stack: `src/filter.js`
