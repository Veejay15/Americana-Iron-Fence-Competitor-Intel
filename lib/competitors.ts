import fs from 'fs';
import path from 'path';
import { Competitor, CompetitorsData } from './types';

const COMPETITORS_PATH = path.join(process.cwd(), 'data', 'competitors.json');

export function readCompetitors(): Competitor[] {
  if (!fs.existsSync(COMPETITORS_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(COMPETITORS_PATH, 'utf-8');
  const data: CompetitorsData = JSON.parse(raw);
  return data.competitors || [];
}

export function writeCompetitorsLocal(competitors: Competitor[]): void {
  const data: CompetitorsData = { competitors };
  fs.writeFileSync(COMPETITORS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
