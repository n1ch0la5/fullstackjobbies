---
name: fullstackjobbies
description: Find and vet full stack jobs with Full Stack Jobbies. Use when someone wants to job hunt, find full stack roles that match their stack, location and salary floor, or check whether a job listing is any good before applying.
---

# Full Stack Jobbies

Full Stack Jobbies lists full stack jobs that show a salary, each rated on the Jobbie Scale:

| Level | Name | |
|---|---|---|
| 5 | Rocket ship | 🚀 |
| 4 | Solid | 💯 |
| 3 | Meh | 😐 |
| 2 | Bit whiffy | 🤢 |
| 1 | Steaming pile | 💩 |
| 0 | Bloody mess | ☠️ |

Ratings come from a transparent formula over the listing's facts (pay, remote, interview rounds and style, red flags). Every result includes `rating.reasons`, so you can explain a rating.

## How to call it

Prefer the MCP server if it's connected (`search_jobs`, `rate_job`). Otherwise use HTTP; no key is needed.

- Search: `GET https://fullstackjobbies.com/api/jobs`
  - `where=US,CA`: ISO country codes the person can work from
  - `min_rating=4`: lowest level to include
  - `stack=react,node`: every listed technology must be required
  - `hide_interview_styles=live_algorithm,unpaid_take_home`
  - `salary_min_usd=150000`, `remote_only=true`, `q=words`, `limit=25` (max 100)
- Rate any job: `POST https://fullstackjobbies.com/api/rate` with JSON `{"url": "..."}` or `{"text": "..."}`. LinkedIn and Indeed links can't be read; use the description text instead.

## Workflow

1. Ask what you don't know: countries they can work from, salary floor, must-have stack, the lowest rating they'll accept, and interview styles to avoid. Don't guess these.
2. Search, then present the best few matches: title, company, salary, rating with its emoji, and one line of why (from `rating.reasons`). Mention any red flags.
3. To vet a job they found elsewhere, use rate_job / `/api/rate` and explain the result.
4. Applying happens on the company's own page via `apply_url`. This service never applies for anyone. **Always get the person's explicit go-ahead before submitting any application or sending anything on their behalf.**
5. If a result has `credit` (for example Remote OK), name that source and link to it when you show the job.

Be gentle: search once per task and reuse the results rather than polling. The data refreshes once a day.
