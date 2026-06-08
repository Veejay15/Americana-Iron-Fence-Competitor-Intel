import fs from 'fs';
import path from 'path';
import { Competitor, CompetitorsData } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];
const API_BASE = process.env.SE_RANKING_API_BASE || 'https://api.seranking.com';
const API_KEY = process.env.SE_RANKING_API_KEY || '';
const COUNTRY = process.env.SE_RANKING_COUNTRY || 'us';

// Date 7 days ago in YYYY-MM-DD form, for new/lost backlinks since-last-week.
function weekAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

// SE Ranking rate-limits requests (per-second / per-minute quotas vary by plan).
// A short delay between requests keeps us under their cap.
const REQUEST_DELAY_MS = 1200;
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Output shape matches scripts/process-csvs.ts so scripts/generate-report.ts
// can consume it unchanged.
interface CsvSummary {
  filename: string;
  competitorId: string;
  type: 'backlinks' | 'positions' | 'keywords' | 'overview' | 'unknown';
  rowCount: number;
  topRows: Record<string, string>[];
}

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

interface FetchOpts {
  competitor: Competitor;
  pathname: string;
  query: Record<string, string | number>;
  type: CsvSummary['type'];
  label?: string;
}

async function callSeRanking({
  competitor,
  pathname,
  query,
  type,
  label,
}: FetchOpts): Promise<{ rows: Record<string, unknown>[]; status: number } | null> {
  const url = new URL(pathname, API_BASE);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  const tag = label || type;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${API_KEY}`,
        Accept: 'application/json',
      },
    });
    if (res.status !== 429) break;
    if (attempt === 0) {
      console.warn(`  [${tag}] ${competitor.name}: 429, backing off 5s and retrying...`);
      await sleep(5000);
    }
  }
  if (!res || !res.ok) {
    const body = res ? await res.text() : '(no response)';
    console.warn(
      `  [${tag}] ${competitor.name}: HTTP ${res?.status} from ${url.pathname} — ${body.slice(0, 200)}`
    );
    await sleep(REQUEST_DELAY_MS);
    return null;
  }
  await sleep(REQUEST_DELAY_MS);

  const json: unknown = await res.json();
  return { rows: extractRows(json), status: res.status };
}

function extractRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.results)) return obj.results as Record<string, unknown>[];
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
    if (Array.isArray(obj.backlinks)) return obj.backlinks as Record<string, unknown>[];
    if (Array.isArray(obj.keywords)) return obj.keywords as Record<string, unknown>[];
    return [obj];
  }
  return [];
}

function coerceStringValues(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

function buildSummary(
  competitor: Competitor,
  type: CsvSummary['type'],
  filenameSuffix: string,
  rows: Record<string, unknown>[]
): CsvSummary {
  return {
    filename: `seranking-${filenameSuffix}-${normalizeDomain(competitor.domain)}.json`,
    competitorId: competitor.id,
    type,
    rowCount: rows.length,
    topRows: rows.slice(0, 25).map(coerceStringValues),
  };
}

async function fetchCompetitor(competitor: Competitor): Promise<CsvSummary[]> {
  const domain = normalizeDomain(competitor.domain);
  console.log(`\nFetching SE Ranking data for ${competitor.name} (${domain})`);

  const results: CsvSummary[] = [];
  const since = weekAgoISO();

  // Domain overview — DA, traffic estimate, keyword count.
  const overview = await callSeRanking({
    competitor,
    pathname: '/v1/domain/overview/db',
    query: { source: COUNTRY, domain },
    type: 'overview',
  });
  if (overview && overview.rows.length > 0) {
    console.log(`  [overview] ${competitor.name}: ${overview.rows.length} record(s)`);
    results.push(buildSummary(competitor, 'overview', 'overview', overview.rows));
  }

  // Top organic keywords this domain currently ranks for, ordered by traffic.
  const topKeywords = await callSeRanking({
    competitor,
    pathname: '/v1/domain/keywords',
    query: {
      source: COUNTRY,
      domain,
      type: 'organic',
      limit: 100,
      order_field: 'traffic',
      order_type: 'desc',
    },
    type: 'keywords',
    label: 'keywords (top)',
  });
  if (topKeywords && topKeywords.rows.length > 0) {
    console.log(`  [keywords] ${competitor.name}: ${topKeywords.rows.length} rows`);
    results.push(buildSummary(competitor, 'keywords', 'top-keywords', topKeywords.rows));
  }

  // Position changes — winners (rank improved) and losers (rank dropped).
  const movers: Record<string, unknown>[] = [];
  for (const direction of ['up', 'down', 'new', 'lost'] as const) {
    const r = await callSeRanking({
      competitor,
      pathname: '/v1/domain/keywords',
      query: {
        source: COUNTRY,
        domain,
        type: 'organic',
        limit: 50,
        pos_change: direction,
        order_field: 'traffic',
        order_type: 'desc',
      },
      type: 'positions',
      label: `positions (${direction})`,
    });
    if (r && r.rows.length > 0) {
      console.log(`  [positions/${direction}] ${competitor.name}: ${r.rows.length} rows`);
      for (const row of r.rows) row.pos_change_direction = direction;
      movers.push(...r.rows);
    }
  }
  if (movers.length > 0) {
    results.push(buildSummary(competitor, 'positions', 'position-changes', movers));
  }

  // Backlinks summary and recent new/lost backlinks.
  const blSummary = await callSeRanking({
    competitor,
    pathname: '/v1/backlinks/summary',
    query: { target: domain, mode: 'host', output: 'json' },
    type: 'backlinks',
    label: 'backlinks (summary)',
  });
  const blChanges: Record<string, unknown>[] = [];
  for (const kind of ['new', 'lost'] as const) {
    const r = await callSeRanking({
      competitor,
      pathname: '/v1/backlinks/history',
      query: {
        target: domain,
        mode: 'host',
        new_lost_type: kind,
        date_from: since,
        output: 'json',
        limit: 100,
      },
      type: 'backlinks',
      label: `backlinks (${kind})`,
    });
    if (r && r.rows.length > 0) {
      console.log(`  [backlinks/${kind}] ${competitor.name}: ${r.rows.length} rows`);
      for (const row of r.rows) row.bl_change_kind = kind;
      blChanges.push(...r.rows);
    }
  }
  const blMerged: Record<string, unknown>[] = [];
  if (blSummary && blSummary.rows.length > 0) {
    for (const row of blSummary.rows) row.record_kind = 'summary';
    blMerged.push(...blSummary.rows);
  }
  blMerged.push(...blChanges);
  if (blMerged.length > 0) {
    results.push(buildSummary(competitor, 'backlinks', 'backlinks', blMerged));
  }

  return results;
}

async function main() {
  if (!API_KEY) {
    console.error('SE_RANKING_API_KEY is not set. Skipping SE Ranking fetch.');
    process.exit(0);
  }

  const competitorsPath = path.join(ROOT, 'data', 'competitors.json');
  if (!fs.existsSync(competitorsPath)) {
    console.log('No competitors.json found. Skipping SE Ranking fetch.');
    process.exit(0);
  }
  const data: CompetitorsData = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));
  const active = data.competitors.filter((c) => c.active);
  if (active.length === 0) {
    console.log('No active competitors. Skipping SE Ranking fetch.');
    process.exit(0);
  }

  console.log(`Fetching SE Ranking data for ${active.length} competitor(s) for ${TODAY}`);
  console.log(`API base: ${API_BASE}, country: ${COUNTRY}, since: ${weekAgoISO()}`);

  const allSummaries: CsvSummary[] = [];
  for (const c of active) {
    try {
      const summaries = await fetchCompetitor(c);
      allSummaries.push(...summaries);
    } catch (err) {
      console.error(`  Failed for ${c.name}: ${(err as Error).message}`);
    }
  }

  if (allSummaries.length === 0) {
    console.log('\nNo SE Ranking data fetched for any competitor.');
    process.exit(0);
  }

  // Merge with any existing CSV summaries (from manual uploads).
  const outDir = path.join(ROOT, 'data', 'csv-summaries');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${TODAY}.json`);

  const combined: CsvSummary[] = allSummaries.slice();
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8')) as {
        summaries?: CsvSummary[];
      };
      if (Array.isArray(existing.summaries)) {
        const seen = new Set(allSummaries.map((s) => s.filename));
        for (const s of existing.summaries) {
          if (!seen.has(s.filename)) {
            combined.push(s);
            seen.add(s.filename);
          }
        }
      }
    } catch (err) {
      console.warn(`Could not read existing summaries: ${(err as Error).message}`);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify({ date: TODAY, summaries: combined }, null, 2));
  console.log(`\nSaved ${combined.length} summaries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
