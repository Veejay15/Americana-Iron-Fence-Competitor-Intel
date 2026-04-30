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

// Caps to keep the prompt under Claude's 1M-token limit. The first weekly run
// has no previous snapshot, so every URL becomes a "new" URL; large competitor
// sites can produce thousands of entries on their own.
const MAX_NEW_URLS = 150;
const MAX_UPDATED_URLS = 75;
const MAX_REMOVED_URLS = 75;
const MAX_CSV_ROWS = 15;
// Semrush backlinks "Text" column can carry kilobytes of scraped HTML per row.
// Drop fields that bloat the payload without helping the analysis.
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

async function generateForCompetitor(
  client: Anthropic,
  competitor: Competitor,
  diff: CompetitorDiff | null,
  csvs: CsvSummary[],
  americanaPages: string[],
  previousDate: string | null
): Promise<{ markdown: string; inputTokens: number; outputTokens: number }> {
  const { trimmed, meta } = trimDiff(diff);
  const dataPayload = {
    date: TODAY,
    previousDate,
    competitor: {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
    },
    americanaExistingPages: americanaPages,
    sitemapDiff: diff ? trimmed : { newUrls: [], removedUrls: [], updatedUrls: [] },
    sitemapDiffTotals: diff ? meta : null,
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
- raw column names like "New link", "Last seen", "Trust Score", "Page AS", "Position", "Traffic %" (translate them into plain English instead)
- "flagged as", "marked as new", "classified as"
- "according to the data", "per the data provided", "from what we can see in the data"
- numeric IDs, JSON-style references, or anything that sounds like you are quoting a spreadsheet

DO translate everything into plain business English:
- Instead of "1,141 total links in the backlink CSV", write "${competitor.name}'s site has built up roughly 1,100 backlinks over time"
- Instead of "No links in the sampled data are flagged as new this period", write "${competitor.name} did not earn any new backlinks this week"
- Instead of "Position changes show 47 new keywords ranking", write "${competitor.name} started ranking for 47 new keywords this week"
- Instead of "Sitemap diff shows 3 new URLs", write "${competitor.name} published 3 new pages this week"

Numbers and specific URLs are encouraged (they make the report concrete). Structural references to where the numbers came from are forbidden.

If a section has no notable activity, say it the way a colleague would say it out loud:
- "${competitor.name} didn't publish any new pages this week."
- "No new backlinks worth flagging this week."
- "Their keyword rankings stayed flat this week, no big moves."

Never apologize for missing data, never explain that "the sample is limited" or "more data would be needed". The owner just wants to know what happened and what to do about it.

Tone: confident, direct, no fluff. No emojis. No em dashes (use periods, commas, parentheses, or "and/but" instead). Read every sentence back and ask "would a fence business owner understand this without Googling anything?". If not, rewrite it.

Structure:
1. Executive Summary (2 to 4 bullet points, what this competitor did this week and what to do about it)
2. New Pages Built by ${competitor.name} (list the actual URLs and describe what they're targeting, strictly based on what the URL slug says)
3. Backlink Movements (only if CSV data is provided for this competitor)
4. Keyword and Ranking Changes (only if CSV data is provided for this competitor)
5. Recommended Actions for Americana Iron Works (numbered list, specific moves to make this week in response to ${competitor.name}'s activity)

=========================================
STRICT ACCURACY RULES (NON-NEGOTIABLE)
=========================================

RULE 1: ONLY DESCRIBE COMPETITOR PAGES THAT ACTUALLY EXIST IN THE DATA
- Every URL you list under "New Pages Built" MUST appear verbatim in the "sitemapDiff.newUrls" array of the data payload. Do not paraphrase URLs, do not invent URLs, do not assume URLs exist based on competitor patterns.
- When describing what a page targets, stay strictly grounded in the URL slug. If the slug is "/wrought-iron-fence-naperville", you may say it targets "wrought iron fence in Naperville". Do not extrapolate (e.g., do not say "with a focus on residential customers" unless that intent is literally in the slug).
- If the slug is ambiguous (e.g., "/services/", "/page-12345", a numeric ID, or a generic slug like "/blog/"), say "URL slug is too generic to determine intent" rather than guessing. Better to say nothing than to invent a target keyword.
- Do not group competitor pages into themes unless 3+ URLs literally share the theme keyword in their slug. If only one or two URLs touch a topic, list them individually without manufacturing a "trend".

RULE 2: ONLY RECOMMEND PAGES THAT MEET ALL THREE TESTS
Before adding any "build a new page" recommendation, verify ALL THREE of the following. If any one fails, do NOT recommend the build (you may instead recommend updating an existing page, or skip the recommendation entirely).

  TEST A. NOT ALREADY BUILT
  Search "americanaExistingPages" for the topic. Use partial-string matching on the location, service, and project type. If any existing path covers the same intent (e.g., the same suburb + same service, the same project type, the same blog topic), the page is already built. Slight wording differences count as a match (e.g., "/wrought-iron-fence-installation-naperville" matches an intent of "wrought iron fence in Naperville").

  TEST B. ALIGNS WITH AMERICANA'S ACTUAL SERVICE OFFERINGS
  Americana's services are defined by the patterns visible in "americanaExistingPages". Their core offerings are:
    - Wrought iron and ornamental iron fences (residential and commercial)
    - Custom iron gates (driveway, walk, security, automated)
    - Iron railings (interior, exterior, balcony, stair)
    - Fire escapes and structural steel
    - Fence installation, repair, and painting
    - Chain link and aluminum fences
    - Spiral staircases, custom metalwork, ornamental ironwork
    - Service to Chicago and surrounding Illinois suburbs

  Before recommending any page, confirm the underlying service or topic is something Americana actually does. If it isn't (for example, vinyl fence installation, wood fence staining, garage door services, HVAC, landscaping, pool fencing if no existing pool-fence page exists), DO NOT recommend it. Stay inside Americana's lane.

  Service-area pages must be for Chicago or its Illinois suburbs (e.g., Naperville, Evanston, Oak Park, Schaumburg, Aurora, Joliet, Wheaton, Arlington Heights, Skokie, Cicero, Berwyn). Do NOT recommend service-area pages for cities outside Chicagoland (e.g., Milwaukee, Indianapolis, Detroit) even if the competitor targets them.

  TEST C. THE COMPETITOR'S ACTIVITY THIS WEEK ACTUALLY MOTIVATES IT
  The recommendation must be a direct response to something in this week's data (a specific new URL the competitor built, a specific keyword they're now ranking for, a specific backlink they earned). Cite that trigger in the recommendation. Do not pad the list with generic SEO advice that has no link to the data.

RULE 3: PHRASING REQUIREMENTS FOR RECOMMENDATIONS
- For each recommendation, follow this exact pattern: "[Action]. Trigger: [what the competitor did this week]. Why this fits Americana: [the existing service or page this builds on]."
- If you are recommending an UPDATE to an existing page, cite the existing path from americanaExistingPages verbatim.
- If you are recommending a NEW page, state the proposed URL slug and confirm in one short clause that you checked americanaExistingPages and the slug does not already exist.
- Recommendations must be specific. "Build out more service-area pages" is too vague. "Build /wrought-iron-fence-evanston, since competitor X just published their Evanston fence page and Americana has no Evanston-specific page" is specific.

RULE 4: WHEN UNCERTAIN, SKIP
- If you cannot confirm the competitor URL is real, omit it from the report.
- If you cannot confirm Americana offers the service, omit the recommendation.
- If you cannot confirm Americana doesn't already have the page, omit the recommendation.
- A shorter, accurate report is better than a longer, padded one. Sections with no real data should say "No notable activity this week" and stop.

=========================================

Skip sections where there is no data. Do not invent data, URLs, keywords, or page intents. Never recommend a page Americana already has. Never recommend a page outside Americana's actual service offerings. Keep this report focused and specific to ${competitor.name} only, do not discuss other competitors.`;

  const isBaselineRun = diff !== null && previousDate === null;
  const baselineNote = isBaselineRun
    ? `(This is a baseline run with no previous sitemap snapshot, so every indexed URL appears as "new". Treat the sitemapDiff as a snapshot of ${competitor.name}'s current content footprint, not as activity from the last week. The "sitemapDiffTotals" object shows full counts; the URL arrays are sampled to the most relevant entries.)`
    : '';

  const userPrompt = `Here is this week's data for ${competitor.name} for the report dated ${TODAY}.

${diff ? '' : '(No sitemap diff available for this competitor this week.)'}
${baselineNote}
${csvs.length === 0 ? '(No Semrush CSV data uploaded for this competitor this week.)' : ''}
${americanaPages.length === 0 ? '(Warning: could not fetch Americana existing pages this run. Be extra careful recommending new pages.)' : `(Americana's existing ${americanaPages.length} content pages are listed in "americanaExistingPages" for cross-reference.)`}

DATA:
${JSON.stringify(dataPayload, null, 2)}

Write the full report in markdown. Start with a top-level H1 like "# ${competitor.name}: Week of ${TODAY}".`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
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
    console.log('No data to report on. Run fetch-sitemaps and process-csvs first.');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  let totalInput = 0;
  let totalOutput = 0;
  const succeeded: string[] = [];
  const failed: string[] = [];

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
        americanaPages,
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
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`);
      failed.push(competitor.name);
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
