import fs from 'fs';
import path from 'path';
import { AppSettings } from './types';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

const DEFAULTS: AppSettings = {
  scheduledReports: true,
  scheduleDescription: 'Reports run automatically every Monday at 9:00 AM UTC.',
};

export function readSettings(): AppSettings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return DEFAULTS;
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function writeSettingsLocal(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
