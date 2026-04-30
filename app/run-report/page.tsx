import { RunReportClient } from './run-report-client';

export default function RunReportPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Run Weekly Report</h1>
        <p className="text-slate-600 mt-1">
          Trigger this week's competitor intelligence report on demand.
        </p>
      </header>
      <RunReportClient />
    </div>
  );
}
