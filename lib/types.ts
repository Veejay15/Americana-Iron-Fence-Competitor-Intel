export interface Competitor {
  id: string;
  name: string;
  domain: string;
  sitemapUrl: string;
  addedAt: string;
  active: boolean;
}

export interface CompetitorsData {
  competitors: Competitor[];
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
}

export interface SitemapSnapshot {
  competitorId: string;
  fetchedAt: string;
  entries: SitemapEntry[];
}

export interface SitemapDiff {
  competitorId: string;
  newUrls: SitemapEntry[];
  removedUrls: SitemapEntry[];
  updatedUrls: SitemapEntry[];
}

export interface Report {
  date: string;
  filename: string;
  slug: string;
  competitorId: string | null;
  competitorName: string | null;
  title?: string;
  excerpt?: string;
}

export interface AppSettings {
  scheduledReports: boolean;
  scheduleDescription: string;
}

export interface CsvManifestEntry {
  filename: string;
  blobUrl: string;
  uploadedAt: string;
  size: number;
  competitorId?: string; // explicitly set by user at upload time
  type?: string; // backlinks / positions / keywords / pages / unknown
}

export interface CsvManifest {
  date: string;
  files: CsvManifestEntry[];
}
