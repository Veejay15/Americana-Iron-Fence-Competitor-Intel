import fs from 'fs';
import path from 'path';
import { CompetitorsData, SitemapDiff, SitemapEntry } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

function listSnapshotDates(): string[] {
  const dir = path.join(ROOT, 'data', 'sitemaps');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
}

function loadSnapshot(date: string, competitorId: string): SitemapEntry[] | null {
  const p = path.join(ROOT, 'data', 'sitemaps', date, `${competitorId}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return raw.entries || [];
}

const NOISE_PATTERNS = [
  /\/products\//i,
  /\/product\//i,
  /\/collections\/[a-z0-9-]+\/products\//i,
  /\/listing\//i,
  /\/watch\/[a-z0-9-]+\/[a-z0-9-]+/i,
  /\/watches\/[a-z0-9-]+\/[a-z0-9-]+/i,
  /\/sku\//i,
  /\/ref-[a-z0-9-]+/i,
  /\?/,
];

function isNoise(url: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(url));
}

function diff(
  competitorId: string,
  prev: SitemapEntry[] | null,
  curr: SitemapEntry[]
): SitemapDiff {
  if (!prev) {
    return {
      competitorId,
      newUrls: curr.filter((e) => !isNoise(e.url)),
      removedUrls: [],
      updatedUrls: [],
    };
  }
  const prevMap = new Map(prev.map((e) => [e.url, e]));
  const currMap = new Map(curr.map((e) => [e.url, e]));

  const newUrls: SitemapEntry[] = [];
  const removedUrls: SitemapEntry[] = [];
  const updatedUrls: SitemapEntry[] = [];

  for (const [url, entry] of currMap) {
    if (isNoise(url)) continue;
    const prevEntry = prevMap.get(url);
    if (!prevEntry) {
      newUrls.push(entry);
    } else if (
      entry.lastmod &&
      prevEntry.lastmod &&
      entry.lastmod !== prevEntry.lastmod
    ) {
      updatedUrls.push(entry);
    }
  }

  for (const [url, entry] of prevMap) {
    if (isNoise(url)) continue;
    if (!currMap.has(url)) {
      removedUrls.push(entry);
    }
  }

  return { competitorId, newUrls, removedUrls, updatedUrls };
}

async function main() {
  const competitorsPath = path.join(ROOT, 'data', 'competitors.json');
  const data: CompetitorsData = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));
  const active = data.competitors.filter((c) => c.active);

  const snapshotDates = listSnapshotDates();
  const today = TODAY;
  const previous = snapshotDates.filter((d) => d < today).slice(-1)[0] || null;

  console.log(`Diffing sitemaps. Today: ${today}. Previous: ${previous || 'none'}\n`);

  const diffs: SitemapDiff[] = [];

  for (const c of active) {
    const curr = loadSnapshot(today, c.id);
    if (!curr) {
      console.log(`Skip ${c.name}: no snapshot for today`);
      continue;
    }
    const prev = previous ? loadSnapshot(previous, c.id) : null;
    const d = diff(c.id, prev, curr);
    diffs.push(d);
    console.log(
      `${c.name}: +${d.newUrls.length} new, -${d.removedUrls.length} removed, ~${d.updatedUrls.length} updated`
    );
  }

  const outDir = path.join(ROOT, 'data', 'diffs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ date: today, previousDate: previous, diffs }, null, 2));
  console.log(`\nSaved diff to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
