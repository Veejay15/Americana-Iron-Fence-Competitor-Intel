import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readReport, readReportMeta } from '@/lib/reports';
import { formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { ReportView } from './report-view';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { slug } = await params;
  const markdown = await readReport(slug);
  if (!markdown) {
    notFound();
  }
  const meta = await readReportMeta(slug);
  return (
    <div className="space-y-4">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={14} />
        All reports
      </Link>
      <p className="text-xs text-slate-500">
        {meta?.competitorName ? `${meta.competitorName} · ` : ''}
        Week of {formatDate(meta?.date || slug)}
      </p>
      <ReportView slug={slug} competitorName={meta?.competitorName || null} markdown={markdown} />
    </div>
  );
}
