'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Report } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Props {
  initial: Report[];
}

export function ReportsList({ initial }: Props) {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>(initial);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);

  const groupedByWeek = useMemo(() => {
    const groups = new Map<string, Report[]>();
    for (const r of reports) {
      const list = groups.get(r.date) || [];
      list.push(r);
      groups.set(r.date, list);
    }
    // Sort each group's reports by competitor name (combined reports last)
    for (const list of groups.values()) {
      list.sort((a, b) => {
        if (!a.competitorName && b.competitorName) return 1;
        if (a.competitorName && !b.competitorName) return -1;
        return (a.competitorName || '').localeCompare(b.competitorName || '');
      });
    }
    // Return entries sorted by date descending
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [reports]);

  async function handleDelete(slug: string) {
    setDeletingSlug(slug);
    try {
      const res = await fetch(`/api/reports/${slug}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to delete report.');
        setDeletingSlug(null);
        return;
      }
      setReports((prev) => prev.filter((r) => r.slug !== slug));
      setConfirmSlug(null);
      router.refresh();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <div className="space-y-8">
      {groupedByWeek.map(([date, weekReports]) => (
        <section key={date} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 pb-2">
            Week of {formatDate(date)}
          </h2>
          <ul className="space-y-2">
            {weekReports.map((r) => {
              const isConfirming = confirmSlug === r.slug;
              const isDeleting = deletingSlug === r.slug;
              return (
                <li
                  key={r.slug}
                  className="bg-white rounded-lg border border-slate-200 hover:border-slate-400 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4 p-4">
                    <Link href={`/reports/${r.slug}`} className="flex-1 min-w-0 group">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                        {r.competitorName || r.title || 'Combined Report'}
                      </h3>
                      {r.excerpt ? (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {r.excerpt}
                        </p>
                      ) : null}
                    </Link>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link
                        href={`/reports/${r.slug}`}
                        className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md hover:bg-slate-700"
                      >
                        View
                      </Link>
                      <button
                        onClick={() =>
                          setConfirmSlug(isConfirming ? null : r.slug)
                        }
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete report"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {isConfirming ? (
                    <div className="bg-red-50 border-t border-red-200 px-4 py-2.5 flex items-center justify-between gap-3">
                      <p className="text-sm text-red-900">
                        Delete this report permanently?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(r.slug)}
                          disabled={isDeleting}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          {isDeleting ? 'Deleting...' : 'Confirm delete'}
                        </button>
                        <button
                          onClick={() => setConfirmSlug(null)}
                          className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
