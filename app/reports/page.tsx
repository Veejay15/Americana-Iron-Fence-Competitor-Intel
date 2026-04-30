import Link from 'next/link';
import { listReports } from '@/lib/reports';
import { ReportsList } from './reports-list';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const reports = await listReports();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-600 mt-1">
          All weekly competitor intelligence reports.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
          <p className="text-slate-600">
            No reports yet. Run the first report from the{' '}
            <Link href="/run-report" className="text-blue-600 underline">
              Run Report
            </Link>{' '}
            page.
          </p>
        </div>
      ) : (
        <ReportsList initial={reports} />
      )}
    </div>
  );
}
