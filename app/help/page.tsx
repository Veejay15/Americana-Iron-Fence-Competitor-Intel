import Link from 'next/link';
import { ArrowLeft, Info, Zap } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={14} />
        Back to Dashboard
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-slate-900">
          How to Use the Competitor Intelligence Tool
        </h1>
        <p className="text-slate-600 mt-1">
          A guide to tracking competitors and getting weekly intelligence reports for Americana Iron Works.
        </p>
      </header>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">Sign-in:</span> You sign
          in once with your password on the{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign In
          </Link>{' '}
          page and stay signed in for 7 days. After that, you can do everything
          below without entering the password again. Use the sign-out button
          (top right of the navigation bar) when you&apos;re done.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <Zap className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-green-900">
          <p className="font-medium">Data is collected automatically</p>
          <p className="mt-1 text-green-800">
            Each week, the tool automatically pulls keyword rankings, backlink movements, and new
            page activity from your competitors. You don&apos;t need to export or upload anything.
            Just add your competitors once and run reports whenever you&apos;re ready.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Step
          number={1}
          title="Add a Competitor"
          description="Tell the tool which competitor websites to monitor each week."
        >
          <p>
            Head to the{' '}
            <Link href="/competitors" className="text-blue-600 hover:underline">
              Competitors
            </Link>{' '}
            page to see who&apos;s being tracked.
          </p>
          <DefList
            items={[
              {
                term: 'Add a Competitor',
                desc: 'Click "Add competitor", enter the company name and their website domain (e.g. firstfence.com). The tool detects their sitemap automatically.',
              },
              {
                term: 'Pause Tracking',
                desc: 'Toggle the "Tracking" checkbox off. The competitor stays in your list but is skipped in upcoming reports.',
              },
              {
                term: 'Remove a Competitor',
                desc: 'Click the red trash icon. This removes them permanently from all future reports.',
              },
              {
                term: 'How Many to Track',
                desc: 'Three to five competitors is a good starting point. You can add or remove them at any time.',
              },
            ]}
          />
        </Step>

        <Step
          number={2}
          title="Run the Weekly Report"
          description="Generate the AI intelligence report on demand, or let it run automatically on a schedule."
        >
          <p>
            Go to the{' '}
            <Link href="/run-report" className="text-blue-600 hover:underline">
              Run Report
            </Link>{' '}
            page.
          </p>
          <DefList
            items={[
              {
                term: 'Manual Trigger',
                desc: 'Click "Run weekly report now". A live progress tracker shows each phase as the report builds.',
              },
              {
                term: 'Automatic Schedule',
                desc: 'When enabled in Settings (see Step 4), reports run every Monday at 9:00 AM UTC automatically. No action needed from you.',
              },
              {
                term: 'Phases You\'ll See',
                desc: 'Starting analysis → Scanning competitor websites → Comparing against last week → Reading competitor keyword and backlink data → Generating intelligence report → Publishing report.',
              },
              {
                term: 'Total Time',
                desc: 'Typically 1 to 3 minutes from start to finish. The "Report ready" message only appears once the report is fully published and visible in the Reports tab.',
              },
            ]}
          />
        </Step>

        <Step
          number={3}
          title="View, Download, or Delete Reports"
          description="Browse all weekly reports and export them as PDF for sharing with your team."
        >
          <p>
            All reports are listed on the{' '}
            <Link href="/reports" className="text-blue-600 hover:underline">
              Reports
            </Link>{' '}
            page, sorted by most recent first.
          </p>
          <DefList
            items={[
              {
                term: 'View Report',
                desc: 'Click any report title or the "View" button to open the full report.',
              },
              {
                term: 'Download as PDF',
                desc: 'On any report detail page, click "Download PDF" to save a ready-to-share PDF. The download starts immediately.',
              },
              {
                term: 'Delete Report',
                desc: 'Click the trash icon and confirm. This permanently removes the report and cannot be undone.',
              },
            ]}
          />
        </Step>

        <Step
          number={4}
          title="Settings: Choose How Reports Run"
          description="Decide whether reports run automatically each week or only when you trigger them manually."
        >
          <p>
            Visit the{' '}
            <Link href="/settings" className="text-blue-600 hover:underline">
              Settings
            </Link>{' '}
            page to change how the weekly report is scheduled.
          </p>
          <DefList
            items={[
              {
                term: 'Run Automatically',
                desc: 'Reports run on schedule every Monday at 9:00 AM UTC. You can still trigger reports manually at any time.',
              },
              {
                term: 'Manual Only',
                desc: "The Monday auto-run is disabled. Reports only run when you click \"Run weekly report\" on the Run Report page.",
              },
              {
                term: 'How to Switch',
                desc: 'Just click the option you want on the Settings page. The change saves instantly.',
              },
            ]}
          />
        </Step>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-start gap-3">
        <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-blue-900">
          <p className="font-medium">Need help?</p>
          <p className="mt-1 text-blue-800">
            If you run into any issues or want to add features, contact your
            account manager at Makarios Marketing.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
          {number}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600 mt-0.5">{description}</p>
          </div>
          <div className="space-y-3 text-sm text-slate-700">{children}</div>
        </div>
      </div>
    </section>
  );
}

function DefList({ items }: { items: { term: string; desc: string }[] }) {
  return (
    <dl className="border border-slate-200 rounded-md divide-y divide-slate-200">
      {items.map((it, i) => (
        <div
          key={i}
          className="grid grid-cols-1 md:grid-cols-3 gap-2 px-4 py-3"
        >
          <dt className="font-medium text-slate-900">{it.term}</dt>
          <dd className="md:col-span-2 text-slate-600">{it.desc}</dd>
        </div>
      ))}
    </dl>
  );
}
