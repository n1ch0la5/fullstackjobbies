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
| 0 | Bloody mess | ☠️ |

## How the sift works (and why it's cheap)

1. **Discover** from free public feeds:
   - Company job boards on **Greenhouse**, **Lever** and **Ashby**, listed in `data/companies.json`.
   - The monthly **Hacker News "Who is hiring?"** thread. Each post is a job, and any board links in it are added to `data/companies.json` automatically, so the company list grows itself.
2. **Filter with plain code** (free): keep only full stack titles.
3. **Extract facts**: salary, stack, remote, interview rounds, interview style, red flags.
   - Rule-based extraction always runs and costs nothing.
   - If `ANTHROPIC_API_KEY` is set, a small model also reads each listing to catch what regexes miss. It only runs on **new or changed** full stack listings (cached by a hash of the text), capped by `MAX_AI_PER_RUN`.
4. **Score with a formula**, not AI opinion, so every rating is explainable. See `src/score.js`; each job carries its `reasons`.
5. **House rule: salary or it doesn't get posted.** Listings without a salary are not published.
6. **Picks Friday candidates.** The best Rocket ships go to `data/best-jobbie-candidates.json`; the worst (Level 0 and 1) go to `data/worst-jobbie-candidates.json`. Both are picked by rating alone. Paid "Featured" slots, if we add them, never feed into Best Jobbie of the Week.

We publish facts, a rating and a link. **"Apply" always goes to the company's own page**; we don't republish full job descriptions.

## Output

| File | What it is |
|---|---|
| `data/jobs.json` | Published listings, best first. This is what the site reads. |
| `data/best-jobbie-candidates.json` | Top 10 Rocket ships, for Best Jobbie of the Week. |
| `data/worst-jobbie-candidates.json` | The 10 worst, for Worst Jobbie of the Week (anonymise before posting). |
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

## The website

The site is plain HTML, CSS and JS in `site/`, deployed on Netlify (`netlify.toml`). There's no framework and nothing to install.

- `site/index.html`: landing page. The hero paste box and Red Flag Detector rate a job **in the browser**, using the same `src/extract.js` and `src/score.js` as the sifter.
- `site/jobs.html`: the rated jobs, read from `data/jobs.json`, with rating, interview-style and remote filters.
- Signup forms (newsletter, agent waitlist, employers) use Netlify Forms. Submissions show up in Netlify under **Forms**.

On deploy, `scripts/build-site.js` copies the public data and the shared rating code into `site/`. Worst-jobbie candidates are **not** published, since they name real companies. Each daily sift commits new data, which triggers a fresh deploy.

Preview locally: `node scripts/build-site.js && npx serve site`

## Votes, agents and the extension

- **Voting:** visitors rate any job on the Jobbie Scale; the community rating takes over once 3 devs have voted. Run `supabase/votes.sql` once in the Supabase SQL Editor. Emoji counters need `supabase/emoji_counts.sql`.
- **Job pages:** every job gets `/job/<slug>`, listed in `/sitemap.xml`. Built by `scripts/build-site.js`.
- **Agent API (read-only, no key):** `GET /api/jobs`, `POST /api/rate`, MCP server at `/mcp`, skill at `/skill/SKILL.md`. Docs at `/agents`.
- **Browser extension:** `extension/`. `node scripts/build-extension.js` refreshes its copy of the rating code and writes `dist/fullstackjobbies-extension.zip` for the Chrome Web Store. To try it: Chrome → `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`.
