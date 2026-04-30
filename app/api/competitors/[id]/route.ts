import { NextRequest, NextResponse } from 'next/server';
import { readCompetitors, writeCompetitorsLocal } from '@/lib/competitors';
import {
  commitCompetitorsFile,
  isGithubConfigured,
  readCompetitorsFromRepo,
} from '@/lib/github';
import { requireAuth } from '@/lib/auth';
import { Competitor } from '@/lib/types';

async function getCurrentCompetitors(): Promise<Competitor[]> {
  if (isGithubConfigured()) {
    return readCompetitorsFromRepo();
  }
  return readCompetitors();
}

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const competitors = await getCurrentCompetitors();
  const target = competitors.find((c) => c.id === id);
  if (!target) {
    // Already deleted: return current list as success (idempotent)
    return NextResponse.json({ competitors });
  }
  const updated = competitors.filter((c) => c.id !== id);

  try {
    if (isGithubConfigured()) {
      await commitCompetitorsFile(updated, `Remove competitor: ${target.name}`);
    } else {
      writeCompetitorsLocal(updated);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ competitors: updated });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const competitors = await getCurrentCompetitors();
  const idx = competitors.findIndex((c) => c.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }

  const updated = [...competitors];
  updated[idx] = { ...updated[idx], ...body, id: updated[idx].id };

  try {
    if (isGithubConfigured()) {
      await commitCompetitorsFile(updated, `Update competitor: ${updated[idx].name}`);
    } else {
      writeCompetitorsLocal(updated);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ competitors: updated, updated: updated[idx] });
}
