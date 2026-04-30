import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { Competitor, CompetitorsData, CsvManifest } from '../lib/types';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

interface CsvSummary {
  filename: string;
  competitorId: string;
  type: string;
  rowCount: number;
  topRows: Record<string, string>[];
}

function inferTypeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('backlink')) return 'backlinks';
  if (lower.includes('position') || lower.includes('rankings')) return 'positions';
  if (lower.includes('keyword')) return 'keywords';
  if (lower.includes('pages')) return 'pages';
  return 'unknown';
}

function inferCompetitorFromFilename(filename: string, competitors: Competitor[]): string {
  const base = path.basename(filename, '.csv').toLowerCase();
  let bestMatch = '';
  let bestMatchLength = 0;

  for (const c of competitors) {
    const candidates: string[] = [c.id.toLowerCase()];

    const cleanDomain = c.domain
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '')
      .toLowerCase();
    candidates.push(cleanDomain);
    candidates.push(cleanDomain.replace(/[^a-z0-9]+/g, '-'));

    const noWww = cleanDomain.replace(/^www\./i, '');
    if (noWww !== cleanDomain) {
      candidates.push(noWww);
      candidates.push(noWww.replace(/[^a-z0-9]+/g, '-'));
    }

    const domainNoTld = noWww.replace(/\.[a-z]{2,}$/i, '');
    if (domainNoTld.length >= 5) candidates.push(domainNoTld);

    for (const candidate of candidates) {
      if (candidate.length === 0) continue;
      if (base.includes(candidate) && candidate.length > bestMatchLength) {
        bestMatch = c.id;
        bestMatchLength = candidate.length;
      }
    }
  }

  return bestMatch || 'unknown';
}

function summarizeCsvContent(
  content: string,
  filename: string,
  competitors: Competitor[]
): CsvSummary {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });
  return {
    filename,
    competitorId: inferCompetitorFromFilename(filename, competitors),
    type: inferTypeFromFilename(filename),
    rowCount: parsed.data.length,
    topRows: parsed.data.slice(0, 25),
  };
}

function loadCompetitors(): Competitor[] {
  const p = path.join(ROOT, 'data', 'competitors.json');
  if (!fs.existsSync(p)) return [];
  const data: CompetitorsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return data.competitors || [];
}

async function fetchBlob(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

async function processFromManifest(
  manifest: CsvManifest,
  competitors: Competitor[]
): Promise<CsvSummary[]> {
  const summaries: CsvSummary[] = [];
  console.log(`Reading ${manifest.files.length} CSV(s) from manifest for ${manifest.date}`);

  for (const entry of manifest.files) {
    try {
      console.log(`  Downloading ${entry.filename} from Blob...`);
      const content = await fetchBlob(entry.blobUrl);
      const s = summarizeCsvContent(content, entry.filename, competitors);
      // Prefer the explicit competitor and type from the manifest (set by the
      // user at upload time) over any inference based on filename
      if (entry.competitorId) s.competitorId = entry.competitorId;
      if (entry.type) s.type = entry.type;
      console.log(
        `  ${entry.filename}: ${s.rowCount} rows (type=${s.type}, competitor=${s.competitorId})`
      );
      summaries.push(s);
    } catch (err) {
      console.error(`  Failed to process ${entry.filename}: ${(err as Error).message}`);
    }
  }
  return summaries;
}

function processLocalFiles(competitors: Competitor[]): CsvSummary[] {
  // Backwards compatibility with CSVs committed directly to the repo under
  // data/csv/{date}/ (pre-manifest format)
  const csvDir = path.join(ROOT, 'data', 'csv', TODAY);
  if (!fs.existsSync(csvDir)) return [];
  const files = fs.readdirSync(csvDir).filter((f) => f.endsWith('.csv'));
  if (files.length === 0) return [];
  console.log(`Processing ${files.length} local CSV file(s) in ${csvDir}`);
  return files.map((f) => {
    const fp = path.join(csvDir, f);
    const content = fs.readFileSync(fp, 'utf-8');
    const s = summarizeCsvContent(content, f, competitors);
    console.log(`  ${f}: ${s.rowCount} rows (type=${s.type}, competitor=${s.competitorId})`);
    return s;
  });
}

async function main() {
  const competitors = loadCompetitors();

  // Load manifest if present (new Blob-based uploads)
  const manifestPath = path.join(ROOT, 'data', 'csv', TODAY, 'manifest.json');
  let manifestSummaries: CsvSummary[] = [];
  if (fs.existsSync(manifestPath)) {
    const manifest: CsvManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifestSummaries = await processFromManifest(manifest, competitors);
  } else {
    console.log(`No manifest at ${manifestPath}`);
  }

  // Also read any locally-committed CSVs (legacy uploads)
  const localSummaries = processLocalFiles(competitors);

  // Combine, de-duplicating by filename (manifest takes priority over local)
  const seen = new Set<string>();
  const allSummaries: CsvSummary[] = [];
  for (const s of manifestSummaries) {
    allSummaries.push(s);
    seen.add(s.filename);
  }
  for (const s of localSummaries) {
    if (!seen.has(s.filename)) {
      allSummaries.push(s);
      seen.add(s.filename);
    }
  }

  if (allSummaries.length === 0) {
    console.log(`No CSVs found for ${TODAY}. Skipping summary file.`);
    process.exit(0);
  }

  const unmatched = allSummaries.filter((s) => s.competitorId === 'unknown');
  if (unmatched.length > 0) {
    console.warn(`\nWarning: ${unmatched.length} CSV(s) could not be matched to any competitor:`);
    for (const u of unmatched) console.warn(`  - ${u.filename}`);
    console.warn(`Tracked competitor IDs:`);
    for (const c of competitors) console.warn(`  - ${c.id} (${c.domain})`);
  }

  const outDir = path.join(ROOT, 'data', 'csv-summaries');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${TODAY}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ date: TODAY, summaries: allSummaries }, null, 2));
  console.log(`\nSaved ${allSummaries.length} CSV summaries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
