import { Octokit } from '@octokit/rest';
import { AppSettings, Competitor, CompetitorsData, CsvManifest } from './types';

const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || 'americana-competitor-intel';
const branch = process.env.GITHUB_BRANCH || 'main';
const token = process.env.GITHUB_TOKEN || '';

function client(): Octokit {
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  return new Octokit({ auth: token });
}

export function isGithubConfigured(): boolean {
  return Boolean(token && owner && repo);
}

export async function commitCompetitorsFile(
  competitors: Competitor[],
  message: string
): Promise<void> {
  const data: CompetitorsData = { competitors };
  await commitJsonFile('data/competitors.json', data, message);
}

export async function commitSettingsFile(
  settings: AppSettings,
  message: string
): Promise<void> {
  await commitJsonFile('data/settings.json', settings, message);
}

export async function commitCsvManifest(
  date: string,
  manifest: CsvManifest,
  message: string
): Promise<void> {
  await commitJsonFile(`data/csv/${date}/manifest.json`, manifest, message);
}

export async function readCsvManifestFromRepo(date: string): Promise<CsvManifest | null> {
  return readJsonFromRepo<CsvManifest>(`data/csv/${date}/manifest.json`);
}

export async function readJsonFromRepo<T>(filePath: string): Promise<T | null> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if (!('content' in res.data)) return null;
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function readCompetitorsFromRepo(): Promise<Competitor[]> {
  const data = await readJsonFromRepo<CompetitorsData>('data/competitors.json');
  return data?.competitors || [];
}

export async function readSettingsFromRepo(): Promise<AppSettings | null> {
  return readJsonFromRepo<AppSettings>('data/settings.json');
}

export async function listReportsFromRepo(): Promise<string[]> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: 'reports',
      ref: branch,
    });
    if (!Array.isArray(res.data)) return [];
    return res.data
      .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
      .map((f) => f.name);
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

export async function readReportFromRepo(date: string): Promise<string | null> {
  const octokit = client();
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: `reports/${date}.md`,
      ref: branch,
    });
    if (!('content' in res.data)) return null;
    return Buffer.from(res.data.content, 'base64').toString('utf-8');
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

async function commitJsonFile(
  filePath: string,
  data: unknown,
  message: string
): Promise<void> {
  const octokit = client();
  const newContent = JSON.stringify(data, null, 2) + '\n';
  const newContentBase64 = Buffer.from(newContent).toString('base64');

  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if ('sha' in existing.data) {
      sha = existing.data.sha;
    }
  } catch (err: unknown) {
    if ((err as { status?: number }).status !== 404) {
      throw err;
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: newContentBase64,
    branch,
    sha,
  });
}

export interface WorkflowRunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
}

export async function dispatchWorkflow(
  workflowFileName: string = 'weekly-report.yml'
): Promise<void> {
  const octokit = client();
  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: workflowFileName,
    ref: branch,
  });
}

export async function findLatestWorkflowRun(
  workflowFileName: string,
  sinceISO: string,
  attempts: number = 10
): Promise<WorkflowRunInfo | null> {
  const octokit = client();
  for (let i = 0; i < attempts; i++) {
    const res = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowFileName,
      branch,
      per_page: 5,
    });
    const sinceTime = new Date(sinceISO).getTime();
    const recent = res.data.workflow_runs.find(
      (r) => new Date(r.created_at).getTime() >= sinceTime - 5000
    );
    if (recent) {
      return {
        id: recent.id,
        status: recent.status || 'queued',
        conclusion: recent.conclusion,
        htmlUrl: recent.html_url,
        createdAt: recent.created_at,
      };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function getWorkflowRun(runId: number): Promise<WorkflowRunInfo> {
  const octokit = client();
  const res = await octokit.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });
  return {
    id: res.data.id,
    status: res.data.status || 'queued',
    conclusion: res.data.conclusion,
    htmlUrl: res.data.html_url,
    createdAt: res.data.created_at,
  };
}

export async function deleteRepoFile(filePath: string, message: string): Promise<void> {
  const octokit = client();
  let sha: string;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if (!('sha' in existing.data)) {
      // Path exists but is a directory or otherwise unexpected. Treat as already gone.
      return;
    }
    sha = existing.data.sha;
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) {
      // Already deleted by a previous request. Treat as success (idempotent).
      return;
    }
    throw err;
  }
  try {
    await octokit.repos.deleteFile({
      owner,
      repo,
      path: filePath,
      message,
      sha,
      branch,
    });
  } catch (err: unknown) {
    // Race condition: file was deleted between getContent and deleteFile. Still success.
    if ((err as { status?: number }).status === 404 || (err as { status?: number }).status === 409) {
      return;
    }
    throw err;
  }
}

export async function uploadDataFile(
  filePath: string,
  contentBase64: string,
  message: string
): Promise<void> {
  const octokit = client();

  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if ('sha' in existing.data) {
      sha = existing.data.sha;
    }
  } catch (err: unknown) {
    if ((err as { status?: number }).status !== 404) {
      throw err;
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: contentBase64,
    branch,
    sha,
  });
}
