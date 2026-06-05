/**
 * fetch-seranking.ts
 *
 * Fetches keyword-landscape data from the SE Ranking API for each active
 * competitor and saves it to data/seranking-summaries/YYYY-MM-DD.json.
 *
 * Replaces the need to manually upload Semrush keyword/position CSVs.
 * Runs automatically in the GitHub Actions weekly workflow before report
 * generation.
 *
 * What this does:
 *   1. Fetches each competitor's homepage to extract their service keywords.
 *   2. Calls SE Ranking /similar and /related for up to 3 seed phrases per
 *      competitor, collecting up to 100 keywords per call.
 *   3. Saves a JSON summary with the top 50 keywords by search volume.
 *
 * What this does NOT do (requires a higher SE Ranking plan tier):
 *   - Competitor-specific organic rankings (domain-analysis/backlinks returns
 *     401 on the current plan). Upload Semrush position/backlink CSVs manually
 *     via the dashboard for that data, or upgrade the SE Ranking plan.
 */

import fs from 'fs';
import path from 'path';
import { Competitor, CompetitorsData } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];
const SE_RANKING_TOKEN = process.env.SE_RANKING_API_KEY;
const SE_RANKING_BASE = 'https://api.seranking.com/v1/keywords';

export interface SerankingKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intents: string[];
  serp_features: string[];
}

export interface SerankingSummary {
  competitorId: string;
  competitorDomain: string;
  type: 'keyword-research';
  fetchedAt: string;
  seedKeywords: string[];
  totalKeywordsFound: number;
  topRows: SerankingKeyword[];
}

export interface SerankingSummariesData {
  date: string;
  summaries: SerankingSummary[];
}

function loadCompetitors(): Competitor[] {
  const p = path.join(ROOT, 'data', 'competitors.json');
  if (!fs.existsSync(p)) return [];
  const data: CompetitorsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return (data.competitors || []).filter((c) => c.active);
}

async function callSerankingEndpoint(
  endpoint: 'similar' | 'related',
  seed: string
): Promise<SerankingKeyword[]> {
  const encoded = encodeURIComponent(seed);
  const url = `${SE_RANKING_BASE}/${endpoint}?keyword=${encoded}&source=us&limit=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${SE_RANKING_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    console.warn(`    SE Ranking /${endpoint} for "${seed}": HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return (data.keywords || []).map(
    (kw: { keyword: string; volume: number; difficulty: number; cpc: number; intents: string[]; serp_features: string[] }) => ({
      keyword: kw.keyword,
      volume: kw.volume || 0,
      difficulty: kw.difficulty || 0,
      cpc: kw.cpc || 0,
      intents: kw.intents || [],
      serp_features: kw.serp_features || [],
    })
  );
}

async function extractSeedsFromHomepage(domain: string): Promise<string[]> {
  const cleanDomain = domain.replace(/\/$/, '');
  try {
    const res = await fetch(cleanDomain, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].split(/[|\-–]/)[0].trim() : '';

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';

    const h2Matches = Array.from(html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi))
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
      .filter((s) => s.length > 5 && s.length < 80)
      .slice(0, 4);

    const candidates = [title, h1, ...h2Matches]
      .filter((s) => s.length > 5 && s.length < 80)
      .map((s) => s.replace(/\s+/g, ' ').trim());

    return [...new Set(candidates)].slice(0, 5);
  } catch {
    return [];
  }
}

async function fetchKeywordsForCompetitor(competitor: Competitor): Promise<SerankingSummary> {
  console.log(`\n  ${competitor.name} (${competitor.domain})`);

  const pageSeeds = await extractSeedsFromHomepage(competitor.domain);
  console.log(`    Page seeds: ${pageSeeds.join(' | ') || '(none extracted)'}`);

  // Fallback: derive from domain slug
  const domainSlug = competitor.domain
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '')
    .split('.')[0]
    .replace(/-/g, ' ');
  const effectiveSeeds =
    pageSeeds.length > 0 ? pageSeeds.slice(0, 3) : [`${domainSlug} chicago`, 'fence company chicago'];

  const allKeywords = new Map<string, SerankingKeyword>();

  for (const seed of effectiveSeeds) {
    console.log(`    Querying: "${seed}"`);
    for (const endpoint of ['similar', 'related'] as const) {
      const kws = await callSerankingEndpoint(endpoint, seed);
      for (const kw of kws) {
        if (!allKeywords.has(kw.keyword)) {
          allKeywords.set(kw.keyword, kw);
        }
      }
    }
    // Respect SE Ranking rate limits: ~2 req/sec on standard plan
    await new Promise((r) => setTimeout(r, 600));
  }

  const topRows = Array.from(allKeywords.values())
    .filter((k) => k.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 50);

  console.log(`    Keywords collected: ${allKeywords.size} total, ${topRows.length} with volume > 0`);

  return {
    competitorId: competitor.id,
    competitorDomain: competitor.domain,
    type: 'keyword-research',
    fetchedAt: new Date().toISOString(),
    seedKeywords: effectiveSeeds,
    totalKeywordsFound: allKeywords.size,
    topRows,
  };
}

async function main() {
  if (!SE_RANKING_TOKEN) {
    console.error('SE_RANKING_API_KEY is not set. Skipping SE Ranking data fetch.');
    process.exit(0);
  }

  const competitors = loadCompetitors();
  if (competitors.length === 0) {
    console.log('No active competitors. Skipping SE Ranking fetch.');
    process.exit(0);
  }

  console.log(`Fetching SE Ranking keyword data for ${competitors.length} competitor(s)...`);

  const outDir = path.join(ROOT, 'data', 'seranking-summaries');
  fs.mkdirSync(outDir, { recursive: true });

  const summaries: SerankingSummary[] = [];
  for (const competitor of competitors) {
    try {
      const summary = await fetchKeywordsForCompetitor(competitor);
      summaries.push(summary);
    } catch (err) {
      console.error(`  Failed for ${competitor.name}: ${(err as Error).message}`);
    }
  }

  const outPath = path.join(outDir, `${TODAY}.json`);
  const output: SerankingSummariesData = { date: TODAY, summaries };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved SE Ranking summaries for ${summaries.length} competitor(s) to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
