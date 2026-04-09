import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowUp,
  Check,
  CircleAlert,
  Clock,
  Copy,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  Play,
  RotateCcw,
  TerminalSquare,
  User,
} from 'lucide-react';
import yaml from 'js-yaml';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { apiRequest } from '../utils/api';
import { connectLiveSocket } from '../utils/live';
import { useApp } from '../context/AppContext';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

interface LiveRun {
  runId: string;
  workflowName?: string;
  workflowFile: string;
  fullRepoName: string;
  branch: string;
  event: 'push' | 'workflow_dispatch';
  triggeredBy: string;
  status: RunStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  streamLog: string[];
  failureReason?: string;
  envOverrides?: Record<string, string>;
}

interface WorkflowJobNode {
  id: string;
  needs: string[];
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTime(dateString?: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString();
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getStatusBadge(status: RunStatus) {
  const variants = {
    queued: 'warning',
    running: 'running',
    success: 'success',
    failed: 'error',
    cancelled: 'default',
  } as const;

  const labels = {
    queued: 'Queued',
    running: 'Running',
    success: 'Success',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function parseWorkflowJobs(content: string): WorkflowJobNode[] {
  try {
    const parsed = yaml.load(content) as { jobs?: Record<string, { needs?: string | string[] }> } | null;
    if (!parsed?.jobs) {
      return [];
    }

    return Object.entries(parsed.jobs).map(([id, config]) => ({
      id,
      needs: Array.isArray(config.needs) ? config.needs : config.needs ? [config.needs] : [],
    }));
  } catch {
    return [];
  }
}

function deriveJobStatuses(jobs: WorkflowJobNode[], streamLog: string[], runStatus: RunStatus) {
  const seenJobs = streamLog
    .map((line) => line.match(/\[[^/\]]+\/([^\]]+)\]/)?.[1])
    .filter((jobId): jobId is string => Boolean(jobId));

  const lastSeen = seenJobs.at(-1);
  const seenSet = new Set(seenJobs);

  return jobs.reduce<Record<string, RunStatus | 'pending'>>((acc, job) => {
    if (!seenSet.has(job.id)) {
      acc[job.id] = 'pending';
      return acc;
    }

    if (job.id === lastSeen) {
      if (runStatus === 'running' || runStatus === 'queued') {
        acc[job.id] = 'running';
      } else if (runStatus === 'failed') {
        acc[job.id] = 'failed';
      } else if (runStatus === 'cancelled') {
        acc[job.id] = 'cancelled';
      } else {
        acc[job.id] = 'success';
      }
      return acc;
    }

    acc[job.id] = 'success';
    return acc;
  }, {});
}

export default function RunLogs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [run, setRun] = useState<LiveRun | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [workflowJobs, setWorkflowJobs] = useState<WorkflowJobNode[]>([]);
  const [workflowContent, setWorkflowContent] = useState('');
  const [isRerunning, setIsRerunning] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const logViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const loadRun = async () => {
      try {
        const data = await apiRequest<LiveRun>(`/runs/${id}`);
        if (active) {
          setRun(data);
        }
      } catch {
        if (active) {
          setRun(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadRun();

    const socket = connectLiveSocket((message) => {
      if (message.type === 'connected') {
        socket.send(JSON.stringify({ type: 'subscribe_run', runId: id }));
      }

      if (message.type === 'run_update' && message.payload) {
        const payload = message.payload as LiveRun;
        if (payload.runId === id) {
          setRun(payload);
        }
      }
    });

    return () => {
      active = false;
      try {
        socket.send(JSON.stringify({ type: 'unsubscribe_run' }));
      } catch {
        // ignore
      }
      socket.close();
    };
  }, [id]);

  useEffect(() => {
    if (!run) return;
    let active = true;

    const [owner, repo] = run.fullRepoName.split('/');
    const fileName = run.workflowFile.split('/').pop();
    if (!owner || !repo || !fileName) return;

    const loadWorkflow = async () => {
      try {
        const payload = await apiRequest<{ content: string }>(
          `/repos/${owner}/${repo}/workflows/${encodeURIComponent(fileName)}/content`
        );
        if (!active) return;
        setWorkflowContent(payload.content);
        setWorkflowJobs(parseWorkflowJobs(payload.content));
      } catch {
        if (!active) return;
        setWorkflowContent('');
        setWorkflowJobs([]);
      }
    };

    void loadWorkflow();

    return () => {
      active = false;
    };
  }, [run]);

  useEffect(() => {
    const viewport = logViewportRef.current;
    if (!viewport || !stickToBottom) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [run?.streamLog, stickToBottom]);

  const isLive = run?.status === 'running' || run?.status === 'queued';
  const logContent = useMemo(() => run?.streamLog.join('\n') || '', [run?.streamLog]);
  const annotations = useMemo(
    () =>
      (run?.streamLog || [])
        .filter((line) => /(warning|deprecated|error|failed)/i.test(line))
        .slice(-6),
    [run?.streamLog]
  );
  const jobStatuses = useMemo(
    () => deriveJobStatuses(workflowJobs, run?.streamLog || [], run?.status || 'queued'),
    [workflowJobs, run?.streamLog, run?.status]
  );

  const copyLogs = () => {
    navigator.clipboard.writeText(logContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rerunWorkflow = async () => {
    if (!run) return;
    const [owner, repo] = run.fullRepoName.split('/');
    if (!owner || !repo) return;

    setIsRerunning(true);
    try {
      await apiRequest(`/runs/trigger/${owner}/${repo}`, {
        method: 'POST',
        body: JSON.stringify({
          branch: run.branch,
          workflowFile: run.workflowFile,
          workflowName: run.workflowName,
          event: run.event,
          envOverrides: run.envOverrides || {},
        }),
      });
      showToast('success', 'Workflow queued again');
    } catch {
      showToast('error', 'Failed to re-run workflow');
    } finally {
      setIsRerunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-screen p-6">
        <div className="skeleton h-16" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Run Not Found" />
        <main className="flex-1 p-6">
          <div className="text-center">
            <p className="text-[var(--text-secondary)]">Run not found</p>
            <Button onClick={() => navigate('/runs')} className="mt-4">
              <ArrowLeft size={16} className="mr-2" />
              Back to Run History
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title={`${run.workflowName || run.workflowFile} · ${run.runId.slice(0, 8)}`}
        subtitle={run.fullRepoName}
        actions={
          <div className="flex items-center gap-2">
            {getStatusBadge(run.status)}
            <Button variant="secondary" size="sm" onClick={rerunWorkflow} isLoading={isRerunning}>
              <RotateCcw size={15} className="mr-1.5" />
              Re-run
            </Button>
            <Button variant="secondary" size="sm" onClick={copyLogs}>
              {copied ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
              {copied ? 'Copied' : 'Copy Logs'}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold">Run Summary</div>
              <span className="text-xs text-[var(--text-tertiary)]">{formatTimeAgo(run.startedAt || run.queuedAt)}</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-2"><GitBranch size={14} /> Branch</span>
                <span className="font-medium">{run.branch}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-2"><GitCommitHorizontal size={14} /> Event</span>
                <span className="font-medium">{run.event}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-2"><Clock size={14} /> Duration</span>
                <span className="font-medium">{formatDuration(run.durationSeconds)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-2"><User size={14} /> Triggered By</span>
                <span className="font-medium">{run.triggeredBy}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-secondary)] inline-flex items-center gap-2"><Activity size={14} /> Streaming</span>
                <span className="font-medium text-[var(--accent-primary)]">{isLive ? 'Live' : 'Completed'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Manage Run</div>
              <FileCode2 size={15} className="text-[var(--text-tertiary)]" />
            </div>
            <div className="space-y-2">
              <Button className="w-full" onClick={rerunWorkflow} isLoading={isRerunning}>
                <Play size={15} className="mr-1.5" />
                Re-run Workflow
              </Button>
              <Button variant="secondary" className="w-full" disabled>
                {run.workflowFile}
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Annotations</div>
            {annotations.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No warnings or errors detected yet.</p>
            ) : (
              <div className="space-y-2">
                {annotations.map((line, index) => (
                  <div key={`${index}-${line.slice(0, 16)}`} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
                    <div className="inline-flex items-center gap-2 text-[var(--warning)] text-xs mb-1">
                      <CircleAlert size={13} />
                      Annotation
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] break-words">{line}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-muted)] bg-[var(--bg-tertiary)] flex items-center justify-between">
              <div>
                <div className="font-semibold">Workflow Graph</div>
                <div className="text-xs text-[var(--text-secondary)]">GitHub-style job flow for this run</div>
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">{workflowContent ? `${workflowJobs.length} jobs` : 'Loading graph'}</div>
            </div>
            <div className="p-4 overflow-x-auto">
              {workflowJobs.length === 0 ? (
                <div className="text-sm text-[var(--text-secondary)]">Graph will appear once the workflow file is available.</div>
              ) : (
                <div className="flex flex-wrap gap-3 min-w-fit">
                  {workflowJobs.map((job) => {
                    const status = jobStatuses[job.id] || 'pending';
                    const nodeTone =
                      status === 'success'
                        ? 'border-[color:rgb(63_185_80_/_35%)] bg-[color:rgb(63_185_80_/_10%)]'
                        : status === 'failed'
                          ? 'border-[color:rgb(248_81_73_/_35%)] bg-[color:rgb(248_81_73_/_10%)]'
                          : status === 'running'
                            ? 'border-[color:rgb(47_129_247_/_35%)] bg-[color:rgb(47_129_247_/_10%)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-primary)]';

                    return (
                      <div key={job.id} className={`min-w-[220px] rounded-xl border p-4 ${nodeTone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{job.id}</div>
                            <div className="text-xs text-[var(--text-secondary)] mt-1">
                              {job.needs.length > 0 ? `needs: ${job.needs.join(', ')}` : 'entry job'}
                            </div>
                          </div>
                          {getStatusBadge(status as RunStatus)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden min-w-0">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-muted)] bg-[var(--bg-tertiary)]">
              <div className="inline-flex items-center gap-2 font-medium">
                <TerminalSquare size={15} />
                act runner output
              </div>
              <div className="text-xs text-[var(--text-tertiary)] inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(run.startedAt || run.queuedAt)} - {formatTime(run.completedAt)}
                </span>
                {!stickToBottom && (
                  <Button variant="ghost" size="sm" onClick={() => setStickToBottom(true)}>
                    <ArrowUp size={13} className="mr-1" />
                    Jump to latest
                  </Button>
                )}
              </div>
            </div>

            <div
              ref={logViewportRef}
              className="max-h-[72vh] overflow-auto bg-[var(--bg-primary)]"
              onScroll={(event) => {
                const element = event.currentTarget;
                const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
                setStickToBottom(distanceFromBottom < 48);
              }}
            >
              <div className="min-w-max p-4 text-sm font-mono text-[var(--text-secondary)]">
                {run.streamLog.length === 0 ? (
                  <span className="text-[var(--text-tertiary)]">No logs yet...</span>
                ) : (
                  run.streamLog.map((line, index) => (
                    <div key={`${index}-${line.slice(0, 8)}`} className="py-0.5 whitespace-pre">
                      <span className="text-[var(--text-tertiary)] mr-3 inline-block w-8">{String(index + 1).padStart(3, '0')}</span>
                      <span>{line}</span>
                    </div>
                  ))
                )}
                {run.failureReason && <div className="text-[var(--error)] mt-3">Failure: {run.failureReason}</div>}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
