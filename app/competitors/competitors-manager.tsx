'use client';

import { useState } from 'react';
import { Competitor } from '@/lib/types';
import { Trash2, Plus, ExternalLink } from 'lucide-react';

interface Props {
  initial: Competitor[];
}

export function CompetitorsManager({ initial }: Props) {
  const [competitors, setCompetitors] = useState<Competitor[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function suggestSitemapUrl(domainInput: string): string {
    const cleaned = domainInput.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${cleaned}/sitemap.xml`;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const finalSitemap = sitemapUrl || suggestSitemapUrl(domain);
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain, sitemapUrl: finalSitemap }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error || 'Failed to add competitor');
      return;
    }

    setCompetitors(json.competitors);
    setName('');
    setDomain('');
    setSitemapUrl('');
    setShowAdd(false);
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this competitor? This will exclude them from future reports.')) return;
    const res = await fetch(`/api/competitors/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'Failed to remove competitor');
      return;
    }
    setCompetitors(json.competitors);
  }

  async function handleToggle(id: string, active: boolean) {
    const res = await fetch(`/api/competitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'Failed to update competitor');
      return;
    }
    setCompetitors(json.competitors);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700"
        >
          <Plus size={16} />
          Add competitor
        </button>
      </div>

      {showAdd ? (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
        >
          <h2 className="font-semibold text-slate-900">Add a new competitor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bob's Watches"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Domain
              </label>
              <input
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="bobswatches.com"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sitemap URL (optional, will default to /sitemap.xml)
              </label>
              <input
                type="text"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder={domain ? suggestSitemapUrl(domain) : 'https://example.com/sitemap.xml'}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Domain</th>
              <th className="text-left px-4 py-3 font-medium">Active</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {competitors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No competitors yet. Add one above.
                </td>
              </tr>
            ) : (
              competitors.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://${c.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      {c.domain}
                      <ExternalLink size={12} />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        checked={c.active}
                        onChange={(e) => handleToggle(c.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-slate-600 text-xs">
                        {c.active ? 'Tracking' : 'Paused'}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(c.id)}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Changes are saved instantly and will be included in the next weekly report.
      </p>
    </div>
  );
}
