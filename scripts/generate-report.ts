import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Competitor, CompetitorsData } from '../lib/types';
import { fetchSitemap, isListingNoise } from '../lib/sitemap';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().split('T')[0];

const AMERICANA_SITEMAP_URL = 'https://www.americanafence.com/sitemap.xml';

interface DiffEntry {
  url: string;
  lastmod?: string;
}
interface CompetitorDiff {
  competitorId: string;
  newUrls: DiffEntry[];
  removedUrls: DiffEntry[];
  updatedUrls: DiffEntry[];
  fetchError?: string;
  isBaseline?: boolean;
  totalCurrentUrls?: number;
}
interface DiffData {
  date: string;
  previousDate: string | null;
  diffs: CompetitorDiff[];
}

interface CsvSummary {
  filename: string;
  competitorId: string;
  type: string;
  rowCount: number;
  topRows: Record<string, string>[];
}
interface CsvSummariesData {
  date: string;
  summaries: CsvSummary[];
}

function loadDiffs(): DiffData | null {
  const p = path.join(ROOT, 'data', 'diffs', `${TODAY}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadCsvSummaries(): CsvSummariesData | null {
  const p = path.join(ROOT, 'data', 'csv-summaries', `${TODAY}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadCompetitors(): Competitor[] {
  const p = path.join(ROOT, 'data', 'competitors.json');
  const data: CompetitorsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return data.competitors.filter((c) => c.active);
}

async function fetchAmericanaPages(): Promise<string[]> {
  try {
    console.log(`Fetching Americana Iron Works's own sitemap for cross-reference...`);
    const entries = await fetchSitemap(AMERICANA_SITEMAP_URL);
    const paths = entries
      .map((e) => e.url)
      .filter((url) => !isListingNoise(url))
      .map((url) => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .sort();
    console.log(`  Found ${paths.length} content pages on americanafence.com`);
    return paths;
  } catch (err) {
    console.warn(`  Could not fetch Americana sitemap: ${(err as Error).message}`);
    return [];
  }
}

// Caps to keep the prompt under Claude's 1M-token limit.
const MAX_NEW_URLS = 150;
const MAX_UPDATED_URLS = 75;
const MAX_REMOVED_URLS = 75;
const MAX_CSV_ROWS = 15;
const CSV_FIELDS_TO_DROP = new Set(['Text', 'Frame', 'Form', 'Image', 'Sitewide']);

function trimDiff(diff: CompetitorDiff | null): { trimmed: CompetitorDiff; meta: Record<string, number> } {
  const empty = { newUrls: [], removedUrls: [], updatedUrls: [] };
  if (!diff) return { trimmed: { competitorId: '', ...empty }, meta: {} };
  return {
    trimmed: {
      competitorId: diff.competitorId,
      newUrls: diff.newUrls.slice(0, MAX_NEW_URLS),
      updatedUrls: diff.updatedUrls.slice(0, MAX_UPDATED_URLS),
      removedUrls: diff.removedUrls.slice(0, MAX_REMOVED_URLS),
    },
    meta: {
      totalNewUrls: diff.newUrls.length,
      totalUpdatedUrls: diff.updatedUrls.length,
      totalRemovedUrls: diff.removedUrls.length,
    },
  };
}

function trimCsvs(csvs: CsvSummary[]): CsvSummary[] {
  return csvs.map((c) => ({
    ...c,
    topRows: c.topRows.slice(0, MAX_CSV_ROWS).map((row) => {
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!CSV_FIELDS_TO_DROP.has(k)) trimmed[k] = v;
      }
      return trimmed;
    }),
  }));
}

// Generates sections 1–4 for a single competitor. Recommendations are handled
// separately in generateCombinedRecommendations() after all competitors run.
async function generateForCompetitor(
  client: Anthropic,
  competitor: Competitor,
  diff: CompetitorDiff | null,
  csvs: CsvSummary[],
  previousDate: string | null
): Promise<{ markdown: string; inputTokens: number; outputTokens: number }> {
  const sitemapFetchError = diff?.fetchError;
  const isBaseline = !!diff?.isBaseline;
  const { trimmed, meta } = trimDiff(diff);
  const dataPayload = {
    date: TODAY,
    previousDate,
    competitor: {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
    },
    sitemapDiff: diff ? trimmed : { newUrls: [], removedUrls: [], updatedUrls: [] },
    sitemapDiffTotals: diff ? meta : null,
    sitemapFetchStatus: sitemapFetchError
      ? { ok: false, error: sitemapFetchError }
      : diff
      ? { ok: true, isBaseline, totalCurrentUrls: diff.totalCurrentUrls }
      : { ok: false, error: 'No sitemap snapshot was produced this week.' },
    csvData: trimCsvs(csvs),
  };

  const systemPrompt = `You are a senior SEO analyst writing a weekly competitor intelligence report that will be read directly by the owner of Americana Iron Works (americanafence.com), a Chicago-based custom iron works and fence company serving residential and commercial clients across Chicago and the surrounding suburbs. The reader is a fence and ironwork business owner, not a data analyst, not a developer, not an SEO consultant.

This report covers ONE competitor: ${competitor.name} (${competitor.domain}).

=========================================
VOICE AND AUDIENCE RULES
=========================================
You are writing FOR the business owner. Every sentence should make sense to someone who has never heard of Semrush, sitemaps, CSVs, or SEO jargon.

DO NOT reference the underlying data structure or how you received the information. Banned phrases include (but are not limited to):
- "the sampled data", "in the sample", "the sample shows", "based on the sampled rows"
- "the CSV", "the data payload", "the input", "the data shows"
- "rows", "columns", "fields", "the dataset"
- raw column names like "New link", "Last seen", "Trust Score", "Page AS", "Position", "Traffic %", "pos_change_direction", "bl_change_kind", "record_kind"
- "flagged as", "marked as new", "classified as"
- "according to the data", "per the data provided", "from what we can see in the data"
- numeric IDs, JSON-style references, or anything that sounds like you are quoting a spreadsheet

DO translate everything into plain business English:
- Instead of "Position changes show 47 new keywords ranking", write "${competitor.name} started ranking for 47 new keywords this week"
- Instead of "Sitemap diff shows 3 new URLs", write "${competitor.name} published 3 new pages this week"

Numbers and specific URLs are encouraged (they make the report concrete). Structural references to where the numbers came from are forbidden.

If a section has no notable activity, say it the way a colleague would say it out loud:
- "${competitor.name} didn't publish any new pages this week."
- "No new backlinks worth flagging this week."
- "Their keyword rankings stayed flat this week, no big moves."

Tone: confident, direct, no fluff. No emojis. No em dashes (use periods, commas, parentheses, or "and/but" instead).

Structure:
1. Executive Summary (2 to 4 bullet points, what this competitor did this week)
2. New Pages Built by ${competitor.name}
3. Backlink Movements
4. Keyword and Ranking Changes

Do NOT include a Section 5 or any recommendations. Recommended actions are generated separately after all competitors are analyzed.

=========================================
SECTION 3: BACKLINK MOVEMENTS
=========================================
- If csvData has a backlinks-type entry for this competitor, summarize from the topRows. Output MUST be a markdown table (not bullets). The table MUST have these columns in this exact order: | Source Domain | Source URL | Anchor Text | Domain Authority | Followed | New/Lost |. One row per backlink, up to 15 rows max. Below the table you may add 2-3 sentences of interpretation, no more. Group "New" rows first (where bl_change_kind="new"), then "Lost" (where bl_change_kind="lost"). If a field is missing in the data, write "—" in the cell. DO NOT use bullet points for the per-link data.
- If csvData has no backlinks-type entry: "No new backlink data this week." Do not write anything else for this section. DO NOT invent backlink domains.

=========================================
SECTION 4: KEYWORD AND RANKING CHANGES
=========================================
- If csvData has a positions or keywords entry for this competitor, you MAY include markdown tables (not bullets). Produce two separate tables under bold subheadings **Notable ranking gains** and **Notable ranking declines**. Each table MUST have these columns in this exact order: | Keyword | Previous Position | Current Position | Change | Search Volume | Landing Page |. One row per keyword. Use up to 12 rows per table (biggest gains, biggest declines). Compute "Change" as (current minus previous) with a + or - sign; for rows where pos_change_direction="new" write "new" in Change and leave Previous Position as "—"; for rows where pos_change_direction="lost" write "lost" in Change and leave Current Position as "—". If the landing page is a full URL, keep the pathname only. If a field is missing, write "—". Below each table you may add 2-3 sentences of interpretation, no more. DO NOT mix bullets and tables. DO NOT use bullets for per-keyword data.
- CRITICAL: If there are no gains to show, do NOT create an empty table. Write a plain sentence instead, e.g. "No notable ranking gains this week." Same rule for declines — skip the table and write a plain sentence if there is nothing to show.
- You may include a short Overview paragraph above the tables (1-2 lines) citing totals: total tracked keywords, new keywords, lost keywords — IF these numbers appear in the data. Do not invent them.
- If csvData has neither positions nor keywords entries: "No keyword ranking data this week." Do not write anything else. DO NOT invent keywords or positions.

=========================================
SECTION 2: NEW PAGES BUILT
=========================================
ABSOLUTE GROUNDING RULE:
You may ONLY use facts that appear in the DATA payload. You must NOT invent URLs, ranking positions, backlink domains, traffic numbers, or page slugs.

If sitemapFetchStatus.ok is false, you MUST NOT write "no new pages were detected" or any phrasing that implies we looked and found nothing. Instead, state that the sitemap could not be retrieved this week (include the error from sitemapFetchStatus.error) and that new-page detection is unavailable until the fetch issue is resolved.

If sitemapFetchStatus.ok is true AND sitemapFetchStatus.isBaseline is true, this is the FIRST successful sitemap snapshot. State that this is the first capture (mention totalCurrentUrls as their current site footprint), and that real week-over-week new-page detection starts next cycle. DO NOT enumerate URLs.

If sitemapDiff.newUrls is empty and neither error condition applies, write that no new pages were detected this week.

If sitemapDiff.newUrls has entries, list them with inferred targeting based strictly on URL slug. If the slug is ambiguous (e.g., "/page-12345", a numeric ID, "/services/"), write "URL slug is too generic to determine intent" rather than guessing.

=========================================
STRICT ACCURACY RULES
=========================================
Do not invent data, URLs, keywords, or page intents. Sections with no real data should say "No notable activity this week" and stop. Keep this report focused and specific to ${competitor.name} only.

CRITICAL RULE FOR SITEMAP FETCH FAILURES:
If sitemapFetchStatus.ok is false, you MUST NOT write "no new pages were detected." State that the sitemap could not be retrieved (include the error) and that new-page detection is unavailable until resolved. Mention this in the Executive Summary.`;

  const isBaselineRun = diff !== null && previousDate === null;
  const baselineNote = isBaselineRun
    ? `(This is a baseline run with no previous sitemap snapshot, so every indexed URL appears as "new". Treat the sitemapDiff as a snapshot of ${competitor.name}'s current content footprint, not as activity from the last week.)`
    : '';

  const userPrompt = `Here is this week's data for ${competitor.name} for the report dated ${TODAY}.

${sitemapFetchError ? `(Sitemap fetch FAILED for this competitor this week: ${sitemapFetchError}. Do not claim "no changes" — say the fetch failed.)` : isBaseline ? `(BASELINE WEEK for this competitor: first successful sitemap capture. Their site has ${diff?.totalCurrentUrls} URLs total. Do NOT list these as "new pages built this week". Real diffs start next cycle.)` : diff ? '' : '(No sitemap diff available for this competitor this week.)'}
${baselineNote}
${csvs.length === 0 ? '(No keyword or backlink data available for this competitor this week.)' : ''}

DATA:
${JSON.stringify(dataPayload, null, 2)}

Write sections 1–4 only in markdown. Start with a top-level H1 like "# ${competitor.name}: Week of ${TODAY}". Do not include a Section 5 or any recommended actions.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response');
  }
  return {
    markdown: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// After all per-competitor reports are generated, this produces a single
// combined recommendations section (top 3–4 actions) that gets appended to
// every competitor report. One set of actions across all competitors beats
// N×5 per-competitor lists that overwhelm the client.
async function generateCombinedRecommendations(
  client: Anthropic,
  competitorReports: { competitor: Competitor; markdown: string }[],
  americanaPages: string[]
): Promise<{ markdown: string; inputTokens: number; outputTokens: number }> {
  const competitorCount = competitorReports.length;

  const systemPrompt = `You are a senior SEO analyst advising the owner of Americana Iron Works (americanafence.com), a Chicago-based custom iron works and fence company serving residential and commercial clients. You have just reviewed ${competitorCount} competitor(s) this week. Your job is to select the top 3 to 4 highest-impact content actions Americana should take, drawn from the combined activity across ALL competitors reviewed.

VOICE AND AUDIENCE RULES
Plain English. No jargon. No data references. Tone: confident, direct, no fluff. No emojis. No em dashes.

OUTPUT FORMAT
- Start with this exact note on its own line in italics:
  "*These are combined recommended actions based on a review of all ${competitorCount} competitor(s) monitored this week.*"
- Then output exactly 3 to 4 numbered recommendations.
- Each recommendation must follow this format:
  "[Action]. Trigger: [which competitor did what]. Why this fits Americana: [the service or page this builds on]."
- For a NEW page recommendation: state the proposed URL slug and confirm the topic does not already exist on Americana's site.
- For an UPDATE recommendation: cite the existing Americana page path.

SELECTION CRITERIA — rank and keep only the actions that are:
1. Highest signal (multiple competitors pointing to the same gap, or one unusually significant move)
2. Most immediately actionable (Americana can build or update this now)
3. Most aligned with Americana's actual service offerings:
   - Wrought iron and ornamental iron fences (residential and commercial)
   - Custom iron gates (driveway, walk, security, automated)
   - Iron railings (interior, exterior, balcony, stair)
   - Fire escapes and structural steel
   - Fence installation, repair, and painting
   - Chain link and aluminum fences
   - Spiral staircases, custom metalwork, ornamental ironwork
   - Service to Chicago and surrounding Illinois suburbs

DO NOT recommend pages Americana already has. Americana's existing pages are provided below.
DO NOT pad with generic SEO advice. Every recommendation must link to something a competitor did this week.
A focused list of 3 actions beats a padded list of 6. If only 2 actions are genuinely justified, output 2.

Do not include an H1, H2, or section title in your output. Start directly with the italics note.`;

  const competitorSummaries = competitorReports
    .map((r, i) => `--- COMPETITOR ${i + 1}: ${r.competitor.name} (${r.competitor.domain}) ---\n${r.markdown}`)
    .join('\n\n');

  const userPrompt = `Date: ${TODAY}

Americana's existing ${americanaPages.length} content pages (cross-reference — do not recommend pages already covered):
${JSON.stringify(americanaPages)}

COMPETITOR ANALYSES THIS WEEK:
${competitorSummaries}

Output the combined recommended actions now.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response for combined recommendations');
  }
  return {
    markdown: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  const competitors = loadCompetitors();
  if (competitors.length === 0) {
    console.log('No active competitors. Skipping report generation.');
    process.exit(0);
  }

  const diffs = loadDiffs();
  const csvSummaries = loadCsvSummaries();
  const americanaPages = await fetchAmericanaPages();

  if (!diffs && !csvSummaries) {
    console.log('No data to report on. Run fetch-sitemaps and diff-sitemaps first.');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  let totalInput = 0;
  let totalOutput = 0;
  const succeeded: string[] = [];
  const failed: string[] = [];
  const succeededReports: { filePath: string; competitor: Competitor; markdown: string }[] = [];

  for (const competitor of competitors) {
    console.log(`\nGenerating report for ${competitor.name}...`);
    const diff = diffs?.diffs.find((d) => d.competitorId === competitor.id) || null;
    const csvs = csvSummaries?.summaries.filter((s) => s.competitorId === competitor.id) || [];

    try {
      const result = await generateForCompetitor(
        client,
        competitor,
        diff,
        csvs,
        diffs?.previousDate || null
      );
      const filename = `${TODAY}-${competitor.id}.md`;
      const outPath = path.join(reportsDir, filename);
      fs.writeFileSync(outPath, result.markdown);
      console.log(`  ✓ Saved ${outPath}`);
      console.log(`    Tokens: input ${result.inputTokens}, output ${result.outputTokens}`);
      totalInput += result.inputTokens;
      totalOutput += result.outputTokens;
      succeeded.push(competitor.name);
      succeededReports.push({ filePath: outPath, competitor, markdown: result.markdown });
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`);
      failed.push(competitor.name);
    }
  }

  // Generate one combined recommendations section across all competitors and
  // append it to every report so the client sees a single prioritised list
  // instead of N×5 per-competitor action items.
  if (succeededReports.length > 0) {
    console.log(`\nGenerating combined recommended actions (${succeededReports.length} competitor(s))...`);
    try {
      const combined = await generateCombinedRecommendations(
        client,
        succeededReports.map((r) => ({ competitor: r.competitor, markdown: r.markdown })),
        americanaPages
      );
      const combinedSection = `\n\n---\n\n## 5. Recommended Actions for Americana Iron Works\n\n${combined.markdown}`;
      for (const report of succeededReports) {
        fs.appendFileSync(report.filePath, combinedSection);
      }
      totalInput += combined.inputTokens;
      totalOutput += combined.outputTokens;
      console.log(`  ✓ Combined recommendations appended to ${succeededReports.length} report(s)`);
      console.log(`    Tokens: input ${combined.inputTokens}, output ${combined.outputTokens}`);
    } catch (err) {
      console.error(`  ✗ Combined recommendations failed: ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Succeeded: ${succeeded.length} (${succeeded.join(', ') || 'none'})`);
  console.log(`Failed: ${failed.length} (${failed.join(', ') || 'none'})`);
  console.log(`Total tokens: input ${totalInput}, output ${totalOutput}`);

  if (succeeded.length === 0) {
    console.error('All competitor reports failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
