import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Clock, Activity, TerminalSquare } from 'lucide-react';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { apiRequest } from '../utils/api';
import { connectLiveSocket } from '../utils/live';

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

export default function RunLogs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<LiveRun | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const isLive = run?.status === 'running' || run?.status === 'queued';

  const logContent = useMemo(() => run?.streamLog.join('\n') || '', [run?.streamLog]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <div className="flex items-center gap-3">
            {getStatusBadge(run.status)}
            <Button variant="secondary" size="sm" onClick={copyLogs}>
              {copied ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
              {copied ? 'Copied' : 'Copy Logs'}
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 md:p-6 space-y-4">
        <Card className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase">Branch</p>
              <p className="text-sm font-medium">{run.branch}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase">Event</p>
              <p className="text-sm font-medium">{run.event}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase">Duration</p>
              <p className="text-sm font-medium">{formatDuration(run.durationSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase">Triggered By</p>
              <p className="text-sm font-medium">{run.triggeredBy}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase">Streaming</p>
              <p className="text-sm font-medium inline-flex items-center gap-2 text-[var(--accent-primary)]">
                <Activity size={14} className={isLive ? 'animate-pulse' : ''} />
                {isLive ? 'Live' : 'Completed'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-muted)] bg-[var(--bg-tertiary)]">
            <div className="inline-flex items-center gap-2 font-medium">
              <TerminalSquare size={15} />
              act runner output
            </div>
            <div className="text-xs text-[var(--text-tertiary)] inline-flex items-center gap-1">
              <Clock size={12} />
              {formatTime(run.startedAt || run.queuedAt)} - {formatTime(run.completedAt)}
            </div>
          </div>

          <pre className="p-4 bg-[var(--bg-primary)] text-sm font-mono text-[var(--text-secondary)] overflow-x-auto max-h-[68vh] overflow-y-auto">
            {run.streamLog.length === 0 ? (
              <span className="text-[var(--text-tertiary)]">No logs yet...</span>
            ) : (
              run.streamLog.map((line, i) => (
                <div key={`${i}-${line.slice(0, 8)}`} className="py-0.5">
                  <span className="text-[var(--text-tertiary)] mr-2">{String(i + 1).padStart(3, '0')}</span>
                  <span>{line}</span>
                </div>
              ))
            )}
            {run.failureReason && <div className="text-[var(--error)] mt-2">Failure: {run.failureReason}</div>}
          </pre>
        </Card>
      </main>
    </div>
  );
}
