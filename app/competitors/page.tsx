import { readCompetitors } from '@/lib/competitors';
import { isGithubConfigured, readCompetitorsFromRepo } from '@/lib/github';
import { CompetitorsManager } from './competitors-manager';
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

export default async function CompetitorsPage() {
  const competitors = await getLive();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Competitors</h1>
        <p className="text-slate-600 mt-1">
          Add, remove, and toggle competitors that get tracked in the weekly report.
        </p>
      </header>
      <CompetitorsManager initial={competitors} />
    </div>
  );
}
