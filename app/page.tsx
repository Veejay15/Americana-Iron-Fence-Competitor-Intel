import Link from 'next/link';
import { readCompetitors } from '@/lib/competitors';
import { isGithubConfigured, readCompetitorsFromRepo } from '@/lib/github';
import { listReports } from '@/lib/reports';
import { formatDate } from '@/lib/utils';
import { Competitor } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getLiveCompetitors(): Promise<Competitor[]> {
  if (isGithubConfigured()) {
    try {
      return await readCompetitorsFromRepo();
    } catch {
      return readCompetitors();
    }
  }
  return readCompetitors();
}

export default async function Home() {
  const competitors = await getLiveCompetitors();
  const reports = await listReports();
  const latest = reports[0];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">
          Weekly competitor intelligence for Americana Iron Works.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Tracked Competitors"
          value={competitors.filter((c) => c.active).length}
          href="/competitors"
        />
        <StatCard
          label="Reports Generated"
          value={reports.length}
          href="/reports"
        />
        <StatCard
          label="Latest Report"
          value={latest ? formatDate(latest.date) : 'None yet'}
          href={latest ? `/reports/${latest.slug}` : '/run-report'}
        />
      </section>

      {latest ? (
        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {latest.competitorName || latest.title || 'Latest Report'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Week of {formatDate(latest.date)}
              </p>
            </div>
            <Link
              href={`/reports/${latest.slug}`}
              className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700"
            >
              View full report
            </Link>
          </div>
          {latest.excerpt ? (
            <p className="text-slate-600 leading-relaxed">{latest.excerpt}</p>
          ) : null}
        </section>
      ) : (
        <section className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            No reports yet
          </h2>
          <p className="text-slate-600 mb-4">
            Add competitors, upload Semrush CSVs, then run your first report.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/competitors"
              className="text-sm bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-700"
            >
              Manage competitors
            </Link>
            <Link
              href="/run-report"
              className="text-sm bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50"
            >
              Run first report
            </Link>
          </div>
        </section>
      )}

    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-400 transition-colors"
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </Link>
  );
}
