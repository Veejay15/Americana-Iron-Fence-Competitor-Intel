import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { isGithubConfigured, uploadDataFile } from '@/lib/github';

// Cap at ~4MB raw to stay under Vercel's 4.5MB body limit with multipart overhead.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const KNOWN_TYPES = new Set(['backlinks', 'positions', 'keywords', 'pages', 'unknown']);

function sanitizeIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  let file: File | null = null;
  let date: string | null = null;
  let competitorId: string | null = null;
  let type: string | null = null;

  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');
    file = fileEntry instanceof File ? fileEntry : null;
    date = (formData.get('date') as string) || null;
    competitorId = (formData.get('competitorId') as string) || null;
    type = (formData.get('type') as string) || null;
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read upload: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (!file || !date) {
    return NextResponse.json(
      { error: 'file and date are required' },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json(
      { error: 'Only .csv files are allowed' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(2);
    return NextResponse.json(
      {
        error: `File is ${sizeMb}MB, which exceeds the 4MB upload limit. Try filtering the Semrush export (e.g., last 7 days only) or splitting it into smaller files.`,
      },
      { status: 413 }
    );
  }

  // Prepend competitor and type into the filename so the CSV processor's
  // filename inference picks them up explicitly. Format:
  //   {competitorId}__{type}__{originalFilename}.csv
  const baseSafeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const competitorPrefix = competitorId ? sanitizeIdSegment(competitorId) : '';
  const typePrefix = type && KNOWN_TYPES.has(type) ? type : '';
  const tagPrefix = [competitorPrefix, typePrefix].filter(Boolean).join('__');
  const safeFilename = tagPrefix ? `${tagPrefix}__${baseSafeName}` : baseSafeName;
  const repoPath = `data/csv/${date}/${safeFilename}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    if (isGithubConfigured()) {
      const contentBase64 = Buffer.from(arrayBuffer).toString('base64');
      await uploadDataFile(repoPath, contentBase64, `Upload CSV: ${safeFilename}`);
    } else {
      const dir = path.join(process.cwd(), 'data', 'csv', date);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, safeFilename), Buffer.from(arrayBuffer));
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, path: repoPath });
}

export const runtime = 'nodejs';
export const maxDuration = 60;
