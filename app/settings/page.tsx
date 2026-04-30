import { readSettings } from '@/lib/settings';
import { isGithubConfigured, readSettingsFromRepo } from '@/lib/github';
import { SettingsForm } from './settings-form';
import { AppSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULTS: AppSettings = {
  scheduledReports: true,
  scheduleDescription: 'Reports run automatically every Monday at 9:00 AM UTC.',
};

async function getLive(): Promise<AppSettings> {
  if (isGithubConfigured()) {
    try {
      const fromRepo = await readSettingsFromRepo();
      if (fromRepo) return { ...DEFAULTS, ...fromRepo };
    } catch {
      return readSettings();
    }
  }
  return readSettings();
}

export default async function SettingsPage() {
  const settings = await getLive();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Control how the competitor intelligence tool runs.
        </p>
      </header>
      <SettingsForm initial={settings} />
    </div>
  );
}
