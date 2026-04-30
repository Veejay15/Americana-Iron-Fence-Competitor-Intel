import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowRun, isGithubConfigured } from '@/lib/github';

export async function GET(req: NextRequest) {
  if (!isGithubConfigured()) {
    return NextResponse.json(
      { error: 'Reporting service not configured.' },
      { status: 500 }
    );
  }
  const { searchParams } = new URL(req.url);
  const runIdParam = searchParams.get('runId');
  if (!runIdParam) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }
  const runId = parseInt(runIdParam, 10);
  if (isNaN(runId)) {
    return NextResponse.json({ error: 'Invalid runId' }, { status: 400 });
  }
  try {
    const run = await getWorkflowRun(runId);
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch run status: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
