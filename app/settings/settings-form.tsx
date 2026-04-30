'use client';

import { useState } from 'react';
import { AppSettings } from '@/lib/types';
import { Calendar, Hand, Check } from 'lucide-react';

interface Props {
  initial: AppSettings;
}

export function SettingsForm({ initial }: Props) {
  const [scheduledReports, setScheduledReports] = useState(initial.scheduledReports);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(newValue: boolean) {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledReports: newValue }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save');
        setScheduledReports(!newValue); // revert
        return;
      }
      setScheduledReports(newValue);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError((err as Error).message);
      setScheduledReports(!newValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Report Schedule
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Choose how the weekly competitor intelligence report runs.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <ScheduleOption
            icon={<Calendar size={20} />}
            title="Run automatically every week"
            description="Reports run on a schedule every Monday at 9:00 AM UTC. You can also still trigger reports manually."
            selected={scheduledReports}
            disabled={saving}
            onSelect={() => handleSave(true)}
          />
          <ScheduleOption
            icon={<Hand size={20} />}
            title="Manual only"
            description="Reports only run when you click 'Run weekly report' on the Run Report page. The Monday auto-run is disabled."
            selected={!scheduledReports}
            disabled={saving}
            onSelect={() => handleSave(false)}
          />
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {saving
              ? 'Saving...'
              : savedAt
              ? `Saved at ${savedAt}`
              : 'Click an option to save instantly.'}
          </span>
          {savedAt && !saving ? (
            <span className="inline-flex items-center gap-1 text-green-700">
              <Check size={12} />
              Saved
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function ScheduleOption({
  icon,
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled || selected}
      className={`w-full text-left px-6 py-4 flex items-start gap-4 transition-colors ${
        selected ? 'bg-slate-50' : 'hover:bg-slate-50'
      } disabled:cursor-default`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3
            className={`font-semibold ${
              selected ? 'text-slate-900' : 'text-slate-700'
            }`}
          >
            {title}
          </h3>
          {selected ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <Check size={11} />
              Active
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-600 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
