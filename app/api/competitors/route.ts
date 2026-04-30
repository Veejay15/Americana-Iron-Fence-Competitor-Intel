import { NextRequest, NextResponse } from 'next/server';
import { readCompetitors, writeCompetitorsLocal } from '@/lib/competitors';
import {
  commitCompetitorsFile,
  isGithubConfigured,
  readCompetitorsFromRepo,
} from '@/lib/github';
import { requireAuth } from '@/lib/auth';
import { Competitor } from '@/lib/types';
import { slugify, todayISO } from '@/lib/utils';

async function getCurrentCompetitors(): Promise<Competitor[]> {
  if (isGithubConfigured()) {
    return readCompetitorsFromRepo();
  }
  return readCompetitors();
}

export async function GET() {
  const competitors = await getCurrentCompetitors();
  return NextResponse.json({ competitors });
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const { name, domain, sitemapUrl } = body;

  if (!name || !domain || !sitemapUrl) {
    return NextResponse.json(
      { error: 'name, domain, and sitemapUrl are required' },
      { status: 400 }
    );
  }

  const competitors = await getCurrentCompetitors();
  const id = slugify(domain.replace(/^https?:\/\//, '').split('/')[0]);

  if (competitors.some((c) => c.id === id)) {
    return NextResponse.json(
      { error: `Competitor with id "${id}" already exists.` },
      { status: 409 }
    );
  }

  const newCompetitor: Competitor = {
    id,
    name,
    domain,
    sitemapUrl,
    addedAt: todayISO(),
    active: true,
  };

  const updated = [...competitors, newCompetitor];

  try {
    if (isGithubConfigured()) {
      await commitCompetitorsFile(updated, `Add competitor: ${name}`);
    } else {
      writeCompetitorsLocal(updated);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ competitors: updated, added: newCompetitor });
}
