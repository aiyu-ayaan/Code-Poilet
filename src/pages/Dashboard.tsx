import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  GitBranch,
  PlayCircle,
  ShieldAlert,
  Timer,
  XCircle,
} from 'lucide-react';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { connectLiveSocket } from '../utils/live';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

interface QueueSnapshot {
  queued: number;
  running: number;
  failed: number;
  success: number;
  maxConcurrentRuns: number;
}

interface RunRecord {
  runId: string;
  workflowName?: string;
  workflowFile: string;
  fullRepoName: string;
  status: RunStatus;
  durationSeconds?: number;
  triggeredBy: string;
  startedAt?: string;
  queuedAt: string;
}

function formatDuration(seconds?: number) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTimeAgo(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function statusVariant(status: RunStatus) {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'running';
  if (status === 'queued') return 'warning';
  return 'default';
}

function statusLabel(status: RunStatus) {
  if (status === 'running') return 'Running';
  if (status === 'queued') return 'Queued';
  if (status === 'success') return 'Success';
  if (status === 'failed') return 'Failed';
  return 'Cancelled';
}

export default function Dashboard() {
  const { repositories } = useApp();
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunRecord[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);

  useEffect(() => {
    let isMounted = true;

    apiRequest<QueueSnapshot>('/runs/status/queue')
      .then((payload) => {
        if (isMounted) setQueue(payload);
      })
      .catch(() => {
        if (isMounted) setQueue(null);
      });

    apiRequest<RunRecord[]>('/runs/history?limit=8')
      .then((payload) => {
        if (isMounted) setRecentRuns(payload);
      })
      .catch(() => {
        if (isMounted) setRecentRuns([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRuns(false);
      });

    const socket = connectLiveSocket((message) => {
      if (message.type === 'queue_snapshot' && message.payload) {
        setQueue(message.payload as QueueSnapshot);
      }

      if (message.type === 'run_update' && message.payload) {
        const updated = message.payload as RunRecord;
        setRecentRuns((prev) => {
          const existingIndex = prev.findIndex((item) => item.runId === updated.runId);
          if (existingIndex >= 0) {
            const clone = [...prev];
            clone[existingIndex] = updated;
            return clone
              .sort((left, right) => new Date(right.queuedAt).getTime() - new Date(left.queuedAt).getTime())
              .slice(0, 8);
          }
          return [updated, ...prev]
            .sort((left, right) => new Date(right.queuedAt).getTime() - new Date(left.queuedAt).getTime())
            .slice(0, 8);
        });
      }
    });

    return () => {
      isMounted = false;
      socket.close();
    };
  }, []);

  const repoBreakdown = useMemo(() => {
    const summary = {
      total: repositories.length,
      running: repositories.filter((repo) => repo.status === 'running').length,
      failed: repositories.filter((repo) => repo.status === 'failed').length,
      success: repositories.filter((repo) => repo.status === 'success').length,
      idle: repositories.filter((repo) => repo.status === 'idle').length,
    };
    return summary;
  }, [repositories]);

  const queueTotal = useMemo(() => {
    if (!queue) return 0;
    return queue.queued + queue.running + queue.failed + queue.success;
  }, [queue]);

  const throughput = useMemo(() => {
    if (!queue || queueTotal === 0) return 0;
    return Math.round(((queue.success + queue.failed) / queueTotal) * 100);
  }, [queue, queueTotal]);

  const topRepos = useMemo(() => {
    return [...repositories]
      .sort((left, right) => {
        const leftTs = left.lastRunAt ? new Date(left.lastRunAt).getTime() : 0;
        const rightTs = right.lastRunAt ? new Date(right.lastRunAt).getTime() : 0;
        return rightTs - leftTs;
      })
      .slice(0, 6);
  }, [repositories]);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title="Dashboard"
        subtitle="Real-time local CI control room powered by act"
        actions={
          <Link to="/repositories">
            <Button>
              Open Repositories
              <ArrowUpRight size={14} className="ml-1.5" />
            </Button>
          </Link>
        }
      />

      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(47,129,247,0.25),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(63,185,80,0.14),transparent_40%)]" />
          <div className="relative p-5 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Execution Overview</p>
                <h2 className="text-2xl md:text-3xl font-semibold mt-2">Ship fast, debug local, stay in flow</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  Queue health, run velocity, and repository activity are updating live from your runner.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <div className="rounded-lg border border-[color:rgb(56_139_253_/_30%)] bg-[color:rgb(56_139_253_/_10%)] px-3 py-2">
                  <p className="text-xs text-[var(--text-tertiary)]">Repositories</p>
                  <p className="text-xl font-semibold">{repoBreakdown.total}</p>
                </div>
                <div className="rounded-lg border border-[color:rgb(63_185_80_/_30%)] bg-[color:rgb(63_185_80_/_10%)] px-3 py-2">
                  <p className="text-xs text-[var(--text-tertiary)]">Completed</p>
                  <p className="text-xl font-semibold">{queue ? queue.success + queue.failed : '-'}</p>
                </div>
                <div className="rounded-lg border border-[color:rgb(210_153_34_/_30%)] bg-[color:rgb(210_153_34_/_10%)] px-3 py-2">
                  <p className="text-xs text-[var(--text-tertiary)]">Queue</p>
                  <p className="text-xl font-semibold">{queue?.queued ?? '-'}</p>
                </div>
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2">
                  <p className="text-xs text-[var(--text-tertiary)]">Workers</p>
                  <p className="text-xl font-semibold">{queue?.maxConcurrentRuns ?? 2}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          <div className="lg:col-span-8 space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Running Now</p>
                <p className="text-3xl font-semibold mt-2">{queue?.running ?? '-'}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
                  <Activity size={14} className="text-[var(--accent-primary)]" />
                  live stream with step logs
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Delivery Health</p>
                <p className="text-3xl font-semibold mt-2">{throughput}%</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[var(--success)]" />
                  success + fail completion ratio
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Failures</p>
                <p className="text-3xl font-semibold mt-2">{queue?.failed ?? '-'}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
                  <ShieldAlert size={14} className="text-[var(--warning)]" />
                  investigate flaky or broken jobs
                </p>
              </Card>
            </div>

            <Card>
              <div className="p-4 border-b border-[var(--border-muted)] flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Live Run Activity</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Most recent workflow runs across repositories</p>
                </div>
                <Link to="/runs">
                  <Button variant="secondary" size="sm">
                    Open History
                    <ArrowUpRight size={13} className="ml-1.5" />
                  </Button>
                </Link>
              </div>

              {isLoadingRuns ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="skeleton h-14" />
                  ))}
                </div>
              ) : recentRuns.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
                    <PlayCircle size={18} className="text-[var(--text-tertiary)]" />
                  </div>
                  <p className="font-medium">No runs yet</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Trigger a workflow from repositories to see live activity here.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-muted)]">
                  {recentRuns.map((run) => (
                    <Link key={run.runId} to={`/runs/${run.runId}`} className="block p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{run.workflowName || run.workflowFile}</p>
                          <p className="text-sm text-[var(--text-secondary)] truncate">{run.fullRepoName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
                          <span className="text-xs text-[var(--text-secondary)] inline-flex items-center gap-1">
                            <Timer size={12} />
                            {formatDuration(run.durationSeconds)}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)] inline-flex items-center gap-1">
                            <Clock3 size={12} />
                            {formatTimeAgo(run.startedAt || run.queuedAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-4 md:space-y-6">
            <Card>
              <div className="p-4 border-b border-[var(--border-muted)]">
                <h3 className="font-semibold">Repository Pulse</h3>
                <p className="text-sm text-[var(--text-secondary)]">Recently active repositories sorted by latest runs</p>
              </div>
              <div className="p-3 space-y-2">
                {topRepos.length === 0 ? (
                  <div className="p-4 text-sm text-[var(--text-secondary)]">No repositories connected yet.</div>
                ) : (
                  topRepos.map((repo) => (
                    <Link
                      key={repo.id}
                      to={`/repositories/${repo.id}`}
                      className="block rounded-lg border border-[var(--border-muted)] bg-[var(--bg-primary)] p-3 hover:border-[color:rgb(56_139_253_/_45%)] hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{repo.fullName}</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Last run {formatTimeAgo(repo.lastRunAt)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            repo.status === 'success'
                              ? 'success'
                              : repo.status === 'failed'
                                ? 'error'
                                : repo.status === 'running'
                                  ? 'running'
                                  : 'default'
                          }
                        >
                          {repo.status}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Status Mix</p>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-[var(--success)]" />
                      Healthy
                    </span>
                    <span className="text-[var(--text-secondary)]">{repoBreakdown.success}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div className="h-2 bg-[var(--success)]" style={{ width: `${repoBreakdown.total ? (repoBreakdown.success / repoBreakdown.total) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="inline-flex items-center gap-2">
                      <XCircle size={14} className="text-[var(--error)]" />
                      Failed
                    </span>
                    <span className="text-[var(--text-secondary)]">{repoBreakdown.failed}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div className="h-2 bg-[var(--error)]" style={{ width: `${repoBreakdown.total ? (repoBreakdown.failed / repoBreakdown.total) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="inline-flex items-center gap-2">
                      <Activity size={14} className="text-[var(--accent-primary)]" />
                      Running
                    </span>
                    <span className="text-[var(--text-secondary)]">{repoBreakdown.running}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div className="h-2 bg-[var(--accent-primary)]" style={{ width: `${repoBreakdown.total ? (repoBreakdown.running / repoBreakdown.total) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="inline-flex items-center gap-2">
                      <GitBranch size={14} className="text-[var(--text-tertiary)]" />
                      Idle
                    </span>
                    <span className="text-[var(--text-secondary)]">{repoBreakdown.idle}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div className="h-2 bg-[var(--text-tertiary)]" style={{ width: `${repoBreakdown.total ? (repoBreakdown.idle / repoBreakdown.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
