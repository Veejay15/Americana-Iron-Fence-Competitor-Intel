import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isAuthenticated } from '@/lib/session';
import {
  commitCsvManifest,
  isGithubConfigured,
  readCsvManifestFromRepo,
} from '@/lib/github';
import { CsvManifest, CsvManifestEntry } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;

interface UploadClientPayload {
  competitorId?: string;
  type?: string;
  size?: number;
}

function parseClientPayload(payload: string | null | undefined): UploadClientPayload {
  if (!payload) return {};
  try {
    return JSON.parse(payload) as UploadClientPayload;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Vercel Blob is not configured. Please ask your administrator to enable Blob storage in the Vercel project settings.',
      },
      { status: 500 }
    );
  }

  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid request body: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parts = pathname.split('/');
        if (
          parts.length !== 3 ||
          parts[0] !== 'csv' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(parts[1]) ||
          !parts[2].toLowerCase().endsWith('.csv')
        ) {
          throw new Error(
            `Invalid upload path. Expected format: csv/YYYY-MM-DD/filename.csv (got: ${pathname})`
          );
        }
        return {
          allowedContentTypes: [
            'text/csv',
            'application/csv',
            'application/octet-stream',
            'application/vnd.ms-excel',
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          // Pass the client payload through so it's available in onUploadCompleted
          tokenPayload: clientPayload || '',
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!isGithubConfigured()) {
          console.error('[upload] GitHub not configured, skipping manifest commit');
          return;
        }

        try {
          const parts = blob.pathname.split('/');
          if (parts.length < 3) {
            console.error('[upload] Unexpected blob.pathname format:', blob.pathname);
            return;
          }
          const date = parts[1];
          const filename = parts[2].replace(/-[a-zA-Z0-9]+(\.csv)$/i, '$1');

          const payload = parseClientPayload(tokenPayload);
          const entry: CsvManifestEntry = {
            filename,
            blobUrl: blob.url,
            uploadedAt: new Date().toISOString(),
            size: payload.size || 0,
            competitorId: payload.competitorId,
            type: payload.type,
          };

          console.log(
            `[upload] Adding to manifest for ${date}: ${filename} (competitor=${payload.competitorId}, type=${payload.type})`
          );

          const existing = await readCsvManifestFromRepo(date);
          const manifest: CsvManifest = existing || { date, files: [] };
          manifest.files = manifest.files.filter((f) => f.filename !== filename);
          manifest.files.push(entry);

          await commitCsvManifest(date, manifest, `Upload CSV: ${filename}`);
          console.log(`[upload] Manifest committed for ${filename}`);
        } catch (err) {
          // Critical: log so we can see in Vercel logs why uploads silently fail
          console.error(`[upload] onUploadCompleted error:`, err);
          throw err;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error('[upload] handleUpload failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
