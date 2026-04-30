# Americana Iron Works Competitor Intelligence

A weekly competitor intelligence tool for Americana Iron Works (americanafence.com), built on Next.js + GitHub Actions + Claude API.

## What It Does

- Tracks competing fence and custom iron work company websites in the Chicago market
- Each week, fetches their sitemaps and detects new pages built
- Ingests Semrush CSV exports for backlinks and keyword changes
- Uses Claude to generate a written weekly intelligence report
- Reports are committed to the repo and viewable in a Next.js dashboard
- Hosted free on Vercel Hobby + GitHub Actions

## Architecture

```
GitHub Repo (this) ──► GitHub Actions (weekly cron, generates report)
       │                            │
       │                            ▼
       │                   reports/2026-04-30-{competitor}.md (committed back)
       │
       └──► Vercel (auto-deploys, serves dashboard at americana-intel.vercel.app)
```

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY and GITHUB_TOKEN at minimum
npm run dev
```

Open http://localhost:3000

## Weekly Workflow

1. **Export Semrush CSVs** for each competitor (backlinks, position changes). Drop them in `data/csv/YYYY-MM-DD/`
2. **Wait for the Monday cron** (or trigger manually from `/run-report`)
3. **GitHub Actions runs:**
   - Fetches each competitor's sitemap
   - Diffs against last week's sitemap
   - Reads the uploaded CSVs
   - Calls Claude to write the report
   - Commits the report to `reports/YYYY-MM-DD-{competitor-id}.md`
4. **View the report** at `/reports/latest` on the deployed dashboard

## Deployment

1. Push this repo to GitHub
2. Connect the repo at vercel.com (free Hobby tier)
3. Add environment variables in Vercel: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `ADMIN_PASSWORD`
4. Add the same secrets to GitHub: Settings → Secrets and variables → Actions

## Project Structure

```
americana-competitor-intel/
├── app/                          Next.js App Router pages
│   ├── page.tsx                  Dashboard
│   ├── competitors/              Manage competitors
│   ├── reports/                  View reports
│   ├── upload/                   Upload Semrush CSVs
│   └── api/                      API routes
├── data/
│   ├── competitors.json          List of tracked competitors
│   ├── sitemaps/                 Weekly sitemap snapshots (auto)
│   └── csv/                      Weekly Semrush exports (manual)
├── reports/                      Generated weekly reports (auto)
├── scripts/                      Node scripts run by GitHub Actions
│   ├── fetch-sitemaps.ts
│   ├── process-csvs.ts
│   └── generate-report.ts
├── lib/                          Shared utilities
└── .github/workflows/            GitHub Actions cron
```

## Costs

- Vercel Hobby: Free
- GitHub: Free
- GitHub Actions: Free (2,000 min/month, we use ~40)
- Anthropic API: Roughly $5–15/month based on report frequency
- Total: ~$5–15/month
