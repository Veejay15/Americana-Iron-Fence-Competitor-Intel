'use client';

import { useEffect, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Run {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
}

const PHASES = [
  {
    title: 'Starting analysis',
    desc: 'Queuing the weekly intelligence run',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: 'Scanning competitor websites',
    desc: 'Fetching every competitor sitemap',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    title: 'Comparing against last week',
    desc: 'Detecting new pages and content changes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: 'Reading SEMrush data',
    desc: 'Processing this week’s uploaded CSVs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    title: 'Generating intelligence report',
    desc: 'AI analyst writing the report',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z" />
      </svg>
    ),
  },
];

const PHASE_THRESHOLDS = [0, 15, 45, 65, 90];

function getActivePhase(elapsed: number, status: string, conclusion: string | null): number {
  if (status === 'completed') return conclusion === 'success' ? PHASES.length : -1;
  for (let i = PHASE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (elapsed >= PHASE_THRESHOLDS[i]) return i;
  }
  return 0;
}

function getFailedPhase(elapsed: number): number {
  for (let i = PHASE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (elapsed >= PHASE_THRESHOLDS[i]) return i;
  }
  return 0;
}

function PhaseTracker({
  elapsed,
  status,
  conclusion,
}: {
  elapsed: number;
  status: string;
  conclusion: string | null;
}) {
  const active = getActivePhase(elapsed, status, conclusion);
  const allDone = status === 'completed' && conclusion === 'success';
  const failed = status === 'completed' && conclusion !== 'success' && conclusion !== null;
  const failedAt = failed ? getFailedPhase(elapsed) : -1;

  return (
    <div className="py-1">
      {PHASES.map((phase, i) => {
        const isDone = allDone || (active > i && !failed);
        const isCurrent = !allDone && !failed && active === i;
        const isFailed = failed && i === failedAt;

        let iconBg = '#e2e8f0';
        let iconColor = '#94a3b8';
        let iconContent: React.ReactNode = phase.icon;
        let glowing = false;

        if (isDone) {
          iconBg = '#0f172a';
          iconColor = 'white';
          iconContent = (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          );
        } else if (isCurrent) {
          iconBg = '#0f172a';
          iconColor = 'white';
          iconContent = phase.icon;
          glowing = true;
        } else if (isFailed) {
          iconBg = '#dc2626';
          iconColor = 'white';
          iconContent = (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          );
        }

        const lineColor = isDone ? '#0f172a' : '#e2e8f0';
        const isLast = i === PHASES.length - 1;

        return (
          <div key={i} className="flex gap-3.5">
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: iconBg,
                  color: iconColor,
                  ...(glowing
                    ? {
                        boxShadow: '0 0 0 0 rgba(15, 23, 42, 0.4)',
                        animation: 'glow-pulse 2s infinite',
                      }
                    : {}),
                }}
              >
                {iconContent}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 flex-1 min-h-5 rounded-sm"
                  style={{ background: lineColor }}
                />
              )}
            </div>

            <div className={isLast ? '' : 'pb-4'} style={{ paddingTop: 4 }}>
              <div
                className="text-sm font-semibold flex items-center gap-2"
                style={{ color: isDone || isCurrent ? '#0f172a' : isFailed ? '#dc2626' : '#94a3b8' }}
              >
                {phase.title}
                {isCurrent && (
                  <span className="text-[11px] font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5">
                    <BouncingDots />
                    In progress
                  </span>
                )}
                {isFailed && (
                  <span className="text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                    Failed
                  </span>
                )}
              </div>
              <div className="text-[13px] text-slate-500 mt-0.5">{phase.desc}</div>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes glow-pulse {
          0% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(15, 23, 42, 0); }
          100% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0); }
        }
      `}</style>
    </div>
  );
}

function BouncingDots() {
  return (
    <span className="inline-flex gap-[2px] items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-slate-700"
          style={{
            animation: 'bounce 1.4s infinite ease-in-out both',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </span>
  );
}

export function RunReportClient() {
  const [run, setRun] = useState<Run | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reportPublished, setReportPublished] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const isRunning = !!run && run.status !== 'completed';
  const isComplete = !!run && run.status === 'completed';
  const workflowSucceeded = isComplete && run?.conclusion === 'success';
  const succeeded = workflowSucceeded && reportPublished;
  const failed = isComplete && !!run?.conclusion && run.conclusion !== 'success';

  // Tick elapsed counter
  useEffect(() => {
    if (!isRunning || !run) return;
    const start = new Date(run.createdAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRunning, run]);

  // Poll for status
  useEffect(() => {
    if (!isRunning || !run) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?runId=${run.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.run) setRun(data.run);
      } catch {
        // Silent fail on poll, will retry
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [isRunning, run]);

  // After workflow succeeds, verify the report is actually published before showing success
  useEffect(() => {
    if (!workflowSucceeded || !run || reportPublished) return;
    setVerifying(true);
    const today = new Date().toISOString().split('T')[0];
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // ~2.5 minutes at 5s intervals

    async function checkOnce() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/reports/check?date=${today}`);
        if (res.ok) {
          const data = await res.json();
          if (data.exists) {
            setReportPublished(true);
            setVerifying(false);
            return;
          }
        }
      } catch {
        // Silent fail, will retry
      }
      attempts++;
      if (attempts >= maxAttempts) {
        // After max attempts, assume report is ready (graceful fallback)
        setReportPublished(true);
        setVerifying(false);
        return;
      }
      setTimeout(checkOnce, 5000);
    }
    checkOnce();

    return () => {
      cancelled = true;
    };
  }, [workflowSucceeded, run, reportPublished]);

  async function handleRun() {
    setTriggering(true);
    setError(null);
    setRun(null);
    setElapsed(0);

    try {
      const res = await fetch('/api/trigger-report', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to start the report.');
        setTriggering(false);
        return;
      }
      if (json.run) {
        setRun(json.run);
      } else {
        setError('Report dispatched but could not retrieve status. Check back in a few minutes.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTriggering(false);
    }
  }

  function handleReset() {
    setRun(null);
    setElapsed(0);
    setError(null);
    setReportPublished(false);
    setVerifying(false);
  }

  const elapsedLabel = (() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  })();

  return (
    <div className="space-y-4">
      {/* Trigger card */}
      {!run ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <button
            onClick={handleRun}
            disabled={triggering}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-700 disabled:opacity-50"
          >
            <Play size={16} />
            {triggering ? 'Starting...' : 'Run weekly report now'}
          </button>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Phase tracker (active or completed) */}
      {run ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {succeeded
                  ? 'Report ready'
                  : failed
                  ? 'Report failed'
                  : verifying
                  ? 'Publishing report'
                  : 'Generating report'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Elapsed: {elapsedLabel}
              </p>
            </div>
            {(succeeded || failed) ? (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <RefreshCw size={14} />
                Run again
              </button>
            ) : null}
          </div>

          <PhaseTracker
            elapsed={elapsed}
            status={run.status}
            conclusion={run.conclusion}
          />

          {verifying && !succeeded ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900 flex items-center gap-3">
              <BouncingDots />
              <span>
                Finalizing and publishing the report. This usually takes 30 to 60 seconds...
              </span>
            </div>
          ) : null}

          {succeeded ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-sm text-emerald-900 flex items-center justify-between gap-3">
              <span>Your new report is ready.</span>
              <Link
                href="/reports"
                className="bg-emerald-700 text-white px-3 py-1.5 rounded-md hover:bg-emerald-800 text-xs font-medium"
              >
                View reports
              </Link>
            </div>
          ) : null}

          {failed ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              Something went wrong while generating the report. Please try again or contact your administrator.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* What happens next (only when no active run) */}
      {!run ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-700 space-y-3">
          <h2 className="font-semibold text-slate-900">What happens next</h2>
          <ol className="list-decimal list-inside space-y-1 text-slate-600">
            <li>The system scans each competitor&apos;s website for new pages and content.</li>
            <li>It compares this week&apos;s data against last week&apos;s.</li>
            <li>It reads any SEMrush data you uploaded for the week.</li>
            <li>The AI analyst writes the intelligence report.</li>
            <li>The new report appears in the Reports tab when ready.</li>
          </ol>
          <p className="text-xs text-slate-500">Typical turnaround: 1 to 3 minutes.</p>
        </div>
      ) : null}
    </div>
  );
}
