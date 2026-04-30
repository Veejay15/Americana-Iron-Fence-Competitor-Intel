'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { Competitor } from '@/lib/types';
import { Upload, FileText, Check, AlertCircle } from 'lucide-react';
import { todayISO } from '@/lib/utils';

interface Props {
  competitors: Competitor[];
}

interface FileResult {
  filename: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

const MAX_BYTES = 50 * 1024 * 1024;

const TYPE_OPTIONS = [
  { value: 'backlinks', label: 'Backlinks (new links acquired)' },
  { value: 'positions', label: 'Position Changes (keyword movements)' },
  { value: 'keywords', label: 'New Keywords' },
  { value: 'pages', label: 'Top Pages (traffic by page)' },
  { value: 'auto', label: 'Auto-detect from filename' },
];

function inferTypeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('backlink')) return 'backlinks';
  if (lower.includes('position') || lower.includes('rankings')) return 'positions';
  if (lower.includes('keyword')) return 'keywords';
  if (lower.includes('pages')) return 'pages';
  return 'unknown';
}

export function UploadClient({ competitors }: Props) {
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('auto');
  const [files, setFiles] = useState<FileResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  const activeCompetitors = competitors.filter((c) => c.active);
  const isReady = !!selectedCompetitorId;

  async function handleFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    if (!isReady) {
      alert('Please select a competitor first.');
      return;
    }

    setUploading(true);
    const arr = Array.from(filesList);
    const initial: FileResult[] = arr.map((f) => ({
      filename: f.name,
      status: 'pending',
    }));
    setFiles(initial);

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];

      if (f.size > MAX_BYTES) {
        const sizeMb = (f.size / 1024 / 1024).toFixed(2);
        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  filename: f.name,
                  status: 'error',
                  message: `File is ${sizeMb}MB. Maximum is 50MB.`,
                }
              : p
          )
        );
        continue;
      }

      try {
        const safeFilename = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const pathname = `csv/${today}/${safeFilename}`;
        const fileType =
          selectedType === 'auto' ? inferTypeFromFilename(f.name) : selectedType;

        await upload(pathname, f, {
          access: 'public',
          handleUploadUrl: '/api/upload/blob',
          contentType: 'text/csv',
          clientPayload: JSON.stringify({
            competitorId: selectedCompetitorId,
            type: fileType,
            size: f.size,
          }),
        });

        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  filename: f.name,
                  status: 'success',
                  message: `Tagged as ${selectedCompetitorName(selectedCompetitorId)} / ${fileType}`,
                }
              : p
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  filename: f.name,
                  status: 'error',
                  message: (err as Error).message,
                }
              : p
          )
        );
      }
    }
    setUploading(false);
  }

  function selectedCompetitorName(id: string): string {
    return competitors.find((c) => c.id === id)?.name || id;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Step 1: Tag the upload</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Competitor <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCompetitorId}
              onChange={(e) => setSelectedCompetitorId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="">Select a competitor...</option>
              {activeCompetitors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Data Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!isReady ? (
          <p className="text-xs text-amber-700 flex items-center gap-1.5">
            <AlertCircle size={14} />
            Select a competitor before uploading.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            All files dropped below will be tagged for{' '}
            <span className="font-medium text-slate-900">
              {selectedCompetitorName(selectedCompetitorId)}
            </span>
            .
          </p>
        )}
      </div>

      <div
        onClick={() => isReady && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (isReady) handleFiles(e.dataTransfer.files);
        }}
        className={`bg-white border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isReady
            ? 'border-slate-300 cursor-pointer hover:border-slate-400'
            : 'border-slate-200 cursor-not-allowed opacity-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload className="mx-auto text-slate-400" size={36} />
        <p className="mt-3 font-medium text-slate-900">
          Step 2: Drop CSV files here or click to browse
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Multiple files OK. Each will be tagged for the competitor selected above.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Files up to 50MB are supported.
        </p>
      </div>

      {files.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <h3 className="bg-slate-50 px-4 py-2.5 text-xs uppercase font-medium text-slate-500 border-b border-slate-200">
            Upload status
          </h3>
          <ul className="divide-y divide-slate-100">
            {files.map((f, i) => (
              <li
                key={i}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText
                    size={16}
                    className="text-slate-400 flex-shrink-0"
                  />
                  <span className="text-sm text-slate-900 truncate">
                    {f.filename}
                  </span>
                </div>
                <div className="text-xs flex-shrink-0 text-right max-w-md">
                  {f.status === 'pending' ? (
                    <span className="text-slate-500">Uploading...</span>
                  ) : f.status === 'success' ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Check size={14} />
                      {f.message || 'Saved'}
                    </span>
                  ) : (
                    <span className="text-red-600">{f.message || 'Failed'}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        {uploading ? 'Uploading...' : "Files are saved to this week's data folder."}
      </p>
    </div>
  );
}
