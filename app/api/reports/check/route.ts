import { NextRequest, NextResponse } from 'next/server';
import { isGithubConfigured, listReportsFromRepo } from '@/lib/github';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  let count = 0;
  try {
    if (isGithubConfigured()) {
      const filenames = await listReportsFromRepo();
      count = filenames.filter(
        (f) => f === `${date}.md` || f.startsWith(`${date}-`)
      ).length;
    } else {
      const reportsDir = path.join(process.cwd(), 'reports');
      if (fs.existsSync(reportsDir)) {
        count = fs
          .readdirSync(reportsDir)
          .filter((f) => f === `${date}.md` || f.startsWith(`${date}-`))
          .length;
      }
    }
  } catch {
    count = 0;
  }

  return NextResponse.json({ date, exists: count > 0, count });
}
