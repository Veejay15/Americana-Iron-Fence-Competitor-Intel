import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { deleteRepoFile, isGithubConfigured } from '@/lib/github';

interface Params {
  params: Promise<{ slug: string }>;
}

const SLUG_RE = /^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/i;

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { slug } = await params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid report slug' }, { status: 400 });
  }

  const repoPath = `reports/${slug}.md`;

  try {
    if (isGithubConfigured()) {
      await deleteRepoFile(repoPath, `Delete report: ${slug}`);
    } else {
      const localPath = path.join(process.cwd(), 'reports', `${slug}.md`);
      if (!fs.existsSync(localPath)) {
        return NextResponse.json({ ok: true });
      }
      fs.unlinkSync(localPath);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete report: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
