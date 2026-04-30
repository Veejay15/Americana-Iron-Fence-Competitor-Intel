import fs from 'fs';
import path from 'path';
import { Report } from './types';
import {
  isGithubConfigured,
  listReportsFromRepo,
  readCompetitorsFromRepo,
  readReportFromRepo,
} from './github';
import { readCompetitors } from './competitors';
import type { Competitor } from './types';

const REPORTS_DIR = path.join(process.cwd(), 'reports');

export interface ParsedFilename {
  date: string;
  competitorId: string | null;
  slug: string;
}

export function parseReportFilename(filename: string): ParsedFilename | null {
  const base = filename.replace(/\.md$/, '');
  // Patterns:
  //   YYYY-MM-DD                    (legacy combined report)
  //   YYYY-MM-DD-{competitor-id}    (per-competitor report)
  const match = base.match(/^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/);
  if (!match) return null;
  return {
    date: match[1],
    competitorId: match[2] || null,
    slug: base,
  };
}

function summarize(parsed: ParsedFilename, raw: string, competitorName: string | null): Report {
  const titleLine = raw.split('\n').find((l) => l.startsWith('# '));
  let title = titleLine ? titleLine.replace(/^# /, '').trim() : parsed.slug;
  if (competitorName) {
    title = competitorName;
  } else if (!parsed.competitorId) {
    title = title.replace(/^Americana Iron Works Competitor Intelligence:\s*/i, '');
  }
  const excerpt = raw
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#'))
    ?.slice(0, 240);
  return {
    date: parsed.date,
    filename: `${parsed.slug}.md`,
    slug: parsed.slug,
    competitorId: parsed.competitorId,
    competitorName,
    title,
    excerpt,
  };
}

function listReportsLocal(): string[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.md'));
}

function readReportLocal(slug: string): string | null {
  const filePath = path.join(REPORTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

async function getCompetitorNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    let competitors: Competitor[];
    if (isGithubConfigured()) {
      try {
        competitors = await readCompetitorsFromRepo();
      } catch {
        competitors = readCompetitors();
      }
    } else {
      competitors = readCompetitors();
    }
    for (const c of competitors) {
      map.set(c.id, c.name);
    }
  } catch {
    // ignore
  }
  return map;
}

export async function listReports(): Promise<Report[]> {
  const nameMap = await getCompetitorNameMap();

  let filenames: string[];
  if (isGithubConfigured()) {
    try {
      filenames = await listReportsFromRepo();
    } catch {
      filenames = listReportsLocal();
    }
  } else {
    filenames = listReportsLocal();
  }

  const parsed = filenames
    .map((f) => ({ filename: f, parsed: parseReportFilename(f) }))
    .filter((x): x is { filename: string; parsed: ParsedFilename } => x.parsed !== null)
    .sort((a, b) => {
      // Newest date first; within same date, sort by competitor name
      if (a.parsed.date !== b.parsed.date) {
        return a.parsed.date < b.parsed.date ? 1 : -1;
      }
      const aName = a.parsed.competitorId ? nameMap.get(a.parsed.competitorId) || a.parsed.competitorId : '';
      const bName = b.parsed.competitorId ? nameMap.get(b.parsed.competitorId) || b.parsed.competitorId : '';
      return aName.localeCompare(bName);
    });

  const reports = await Promise.all(
    parsed.map(async ({ parsed }) => {
      const raw = isGithubConfigured()
        ? await readReportFromRepo(parsed.slug)
        : readReportLocal(parsed.slug);
      if (!raw) return null;
      const competitorName = parsed.competitorId
        ? nameMap.get(parsed.competitorId) || titleizeId(parsed.competitorId)
        : null;
      return summarize(parsed, raw, competitorName);
    })
  );

  return reports.filter((r): r is Report => r !== null);
}

export async function readReport(slug: string): Promise<string | null> {
  if (isGithubConfigured()) {
    try {
      const fromRepo = await readReportFromRepo(slug);
      if (fromRepo !== null) return fromRepo;
    } catch {
      // fall through to local
    }
  }
  return readReportLocal(slug);
}

export async function readReportMeta(slug: string): Promise<Report | null> {
  const parsed = parseReportFilename(`${slug}.md`);
  if (!parsed) return null;
  const raw = await readReport(slug);
  if (!raw) return null;
  const nameMap = await getCompetitorNameMap();
  const competitorName = parsed.competitorId
    ? nameMap.get(parsed.competitorId) || titleizeId(parsed.competitorId)
    : null;
  return summarize(parsed, raw, competitorName);
}

function titleizeId(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
