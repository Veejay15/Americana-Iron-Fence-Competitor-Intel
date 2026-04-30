import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  dispatchWorkflow,
  findLatestWorkflowRun,
  isGithubConfigured,
} from '@/lib/github';

export async function POST() {
  const authError = await requireAuth();
  if (authError) return authError;

  if (!isGithubConfigured()) {
    return NextResponse.json(
      {
        error:
          'The reporting service is not yet configured. Please contact your administrator.',
      },
      { status: 500 }
    );
  }

  const dispatchTime = new Date().toISOString();

  try {
    await dispatchWorkflow('weekly-report.yml');
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to start the report. ${(err as Error).message}` },
      { status: 500 }
    );
  }

  let run = null;
  try {
    run = await findLatestWorkflowRun('weekly-report.yml', dispatchTime);
  } catch {
    // Non-fatal: the workflow was dispatched, we just couldn't find the run yet
  }

  return NextResponse.json({
    ok: true,
    message:
      'Report started. It typically takes 1 to 3 minutes. The new report will appear in the Reports tab when ready.',
    run,
  });
}
