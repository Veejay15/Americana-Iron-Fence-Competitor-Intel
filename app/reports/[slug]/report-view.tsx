'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, Trash2 } from 'lucide-react';
import { slugify } from '@/lib/utils';

interface Props {
  slug: string;
  competitorName: string | null;
  markdown: string;
}

export function ReportView({ slug, competitorName, markdown }: Props) {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDownloadPDF() {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      const competitorPart = competitorName ? `-${slugify(competitorName)}` : '';
      const filename = `americana-competitor-report-${slug}${competitorPart}.pdf`;
      const element = reportRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        unit: 'pt',
        format: 'letter',
        orientation: 'portrait',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const usableWidth = pageWidth - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(filename);
    } catch (err) {
      alert(`Failed to generate PDF: ${(err as Error).message}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${slug}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to delete report.');
        setDeleting(false);
        return;
      }
      router.push('/reports');
      router.refresh();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-50"
        >
          <Download size={14} />
          {downloading ? 'Generating PDF...' : 'Download PDF'}
        </button>
        <button
          onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
          className="inline-flex items-center gap-1.5 text-sm bg-white border border-slate-300 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {showDeleteConfirm ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-red-900">Delete this report?</p>
            <p className="text-xs text-red-700 mt-0.5">
              This permanently removes the report. This cannot be undone.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Confirm delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <article
        ref={reportRef}
        className="prose-report bg-white rounded-lg border border-slate-200 p-8"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
