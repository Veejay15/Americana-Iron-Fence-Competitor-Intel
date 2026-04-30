import { UploadClient } from './upload-client';
import { readCompetitors } from '@/lib/competitors';
import { isGithubConfigured, readCompetitorsFromRepo } from '@/lib/github';
import { Competitor } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getLive(): Promise<Competitor[]> {
  if (isGithubConfigured()) {
    try {
      return await readCompetitorsFromRepo();
    } catch {
      return readCompetitors();
    }
  }
  return readCompetitors();
}

export default async function UploadPage() {
  const competitors = await getLive();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Upload SEMrush CSVs</h1>
        <p className="text-slate-600 mt-1">
          Drop your weekly SEMrush exports here. They get stored in this week&apos;s data
          folder and used by the next report run.
        </p>
      </header>
      <UploadClient competitors={competitors} />
    </div>
  );
}
