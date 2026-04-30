import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

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
          A step-by-step guide to running weekly competitor intelligence reports.
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

      <div className="space-y-6">
        <Step
          number={1}
          title="Manage Your Competitors"
          description="Decide which competitor websites the tool should track."
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
                desc: 'Click "Add competitor", enter the company name and domain (e.g. firstfence.com). The tool auto-detects their sitemap.',
              },
              {
                term: 'Pause Tracking',
                desc: 'Toggle the "Tracking" checkbox off. The competitor stays in the list but is skipped in reports.',
              },
              {
                term: 'Remove a Competitor',
                desc: 'Click the red trash icon. This removes them permanently from future reports.',
              },
              {
                term: 'How Many to Track',
                desc: 'Around 5 competitors is a good starting point. You can add or remove anytime.',
              },
            ]}
          />
        </Step>

        <Step
          number={2}
          title="Export Weekly Data from SEMrush"
          description="Each week, pull a few CSVs from SEMrush so the AI has data on backlinks and keyword movements."
        >
          <p>For each competitor, pull these 2 reports per week:</p>

          <SubStep
            label="Backlinks (new in last 7 days)"
            steps={[
              'In SEMrush, open Backlink Analytics',
              'Enter the competitor\'s domain',
              'Go to the Backlinks tab',
              'Filter to "New" backlinks, last 7 days',
              'Click Export → CSV',
              'Save as: {competitor-id}-backlinks.csv',
            ]}
          />

          <SubStep
            label="Position Changes (last 7 days)"
            steps={[
              'In SEMrush, open Organic Research',
              'Enter the competitor\'s domain',
              'Go to the Position Changes tab',
              'Filter type: Improved + Declined + New + Lost',
              'Set period to last 7 days',
              'Click Export → CSV',
              'Save as: {competitor-id}-positions.csv',
            ]}
          />

          <p className="text-sm text-slate-600">
            The competitor ID is the lowercase, dash-separated version of the
            domain (e.g. <code>bobswatches</code>). You can see all IDs
            on the{' '}
            <Link href="/upload" className="text-blue-600 hover:underline">
              Upload page
            </Link>
            .
          </p>

          <Callout
            title="Why are we exporting CSVs manually?"
            body="SEMrush sells API access separately from their main subscription, and it's a meaningful additional cost (typically several hundred dollars per month). Manually exporting takes about 15 minutes per week and uses your existing SEMrush plan with no additional fees. If we ever want to automate the upload step, we can revisit the API trade-off later."
          />
        </Step>

        <Step
          number={3}
          title="Upload Your CSVs"
          description="Drop the SEMrush exports into the Upload page so they're available for this week's report."
        >
          <p>
            Go to the{' '}
            <Link href="/upload" className="text-blue-600 hover:underline">
              Upload CSVs
            </Link>{' '}
            page.
          </p>
          <DefList
            items={[
              {
                term: 'Drag and Drop',
                desc: 'Drop all your CSV files into the upload area at once. Multiple files are supported.',
              },
              {
                term: 'Watch Status',
                desc: 'Each file shows a green checkmark when saved. Failed uploads will display an error message.',
              },
              {
                term: 'Filename Convention',
                desc: 'Use {competitor-id}-{type}.csv format (e.g. bobswatches-backlinks.csv) so the AI knows which competitor each file belongs to.',
              },
            ]}
          />
          <p className="text-sm text-slate-600">
            Files are stored in this week&apos;s data folder, automatically
            dated.
          </p>
        </Step>

        <Step
          number={4}
          title="Run the Weekly Report"
          description="Generate the AI intelligence report on demand, or let it run automatically on schedule."
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
                desc: 'Click "Run weekly report now". A live progress tracker shows each phase as the report is generated.',
              },
              {
                term: 'Automatic Schedule',
                desc: 'When enabled in Settings (see Step 6), reports run every Monday at 9:00 AM UTC. No action needed from you.',
              },
              {
                term: 'Phases You\'ll See',
                desc: 'Starting analysis → Scanning competitor websites → Comparing against last week → Reading SEMrush data → Generating intelligence report → Publishing report.',
              },
              {
                term: 'Total Time',
                desc: 'Typically 1 to 3 minutes from start to finish. The "Report ready" message only appears once the report is fully published and visible in the Reports tab.',
              },
            ]}
          />
        </Step>

        <Step
          number={5}
          title="View, Download, or Delete Reports"
          description="Browse all weekly reports and export them as PDF for sharing with stakeholders."
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
                desc: 'Click any report title or the "View" button to see the full report.',
              },
              {
                term: 'Download as PDF',
                desc: 'On any report detail page, click "Download PDF" to save a polished, ready-to-share PDF file. The download starts immediately.',
              },
              {
                term: 'Delete Report',
                desc: 'Click the trash icon and confirm. This permanently removes the report and cannot be undone.',
              },
            ]}
          />
        </Step>

        <Step
          number={6}
          title="Settings: Choose How Reports Run"
          description="Decide whether reports run automatically or only when you trigger them manually."
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
                desc: 'Reports run on schedule every Monday at 9:00 AM UTC. You can also still trigger reports manually any time.',
              },
              {
                term: 'Manual Only',
                desc: "The Monday auto-run is disabled. Reports only run when you click 'Run weekly report' on the Run Report page.",
              },
              {
                term: 'How to Switch',
                desc: 'Just click the option you want. The setting saves instantly.',
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

function SubStep({ label, steps }: { label: string; steps: string[] }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
      <h3 className="font-semibold text-slate-900 text-sm mb-2">{label}</h3>
      <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
        {steps.map((s, i) => (
          <li key={i}>
            {s.includes(':') || s.startsWith('Save as') ? (
              <>
                {s.split(/(\{[^}]+\}-[a-z]+\.csv|\{[^}]+\})/g).map((part, j) =>
                  /^\{[^}]+\}/.test(part) || /\.csv$/.test(part) ? (
                    <code key={j} className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">
                      {part}
                    </code>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </>
            ) : (
              s
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Callout({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
      <p className="font-semibold text-amber-900 text-sm">{title}</p>
      <p className="text-sm text-amber-900 mt-1">{body}</p>
    </div>
  );
}
