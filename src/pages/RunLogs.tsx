import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  Activity,
  TerminalSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { WorkflowRun, RunLog } from '../types';

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

function getStepStatusIcon(status: RunLog['status']) {
  const icons = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-[var(--text-tertiary)]" />,
    running: <div className="w-4 h-4 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />,
    success: (
      <div className="w-4 h-4 rounded-full bg-[var(--success)] flex items-center justify-center">
        <Check size={10} className="text-white" />
      </div>
    ),
    failed: (
      <div className="w-4 h-4 rounded-full bg-[var(--error)] flex items-center justify-center">
        <span className="text-white text-xs">!</span>
      </div>
    ),
  };
  return icons[status];
}

function getStatusBadge(status: WorkflowRun['status']) {
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
  const { repositories, showToast } = useApp();
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(['step-0']));
  const [copied, setCopied] = useState(false);

  let run: WorkflowRun | undefined;
  let repoName = '';
  let workflowName = '';

  for (const repo of repositories) {
    for (const workflow of repo.workflows) {
      const found = workflow.runs.find((r) => r.id === id);
      if (found) {
        run = found;
        repoName = repo.fullName;
        workflowName = workflow.name;
        break;
      }
    }
    if (run) break;
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

  const isLive = run.status === 'running' || run.logs.some((item) => item.status === 'running');

  const logContent = useMemo(
    () =>
      run.logs
        .map((log) => `[${log.stepName}]\n${log.output.join('\n')}`)
        .join('\n\n'),
    [run.logs]
  );

  const toggleStep = (stepIndex: number) => {
    const newExpanded = new Set(expandedSteps);
    const key = `step-${stepIndex}`;
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSteps(newExpanded);
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logContent);
    setCopied(true);
    showToast('success', 'Logs copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title={`${workflowName} #${run.runNumber}`}
        subtitle={repoName}
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
              <p className="text-sm font-medium">{formatDuration(run.duration)}</p>
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

        {run.logs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-[var(--text-secondary)]">No logs available for this run.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {run.logs.map((log, index) => (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => toggleStep(index)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {expandedSteps.has(`step-${index}`) ? (
                      <ChevronDown size={18} className="text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight size={18} className="text-[var(--text-secondary)]" />
                    )}
                    {getStepStatusIcon(log.status)}
                    <span className="font-medium truncate">{log.stepName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] shrink-0">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      {formatTime(log.startedAt)} - {formatTime(log.completedAt)}
                    </span>
                  </div>
                </button>

                {expandedSteps.has(`step-${index}`) && (
                  <div className="border-t border-[var(--border-muted)]">
                    <div className="px-4 py-2 text-xs text-[var(--text-tertiary)] border-b border-[var(--border-muted)] bg-[var(--bg-primary)] inline-flex items-center gap-1.5 w-full">
                      <TerminalSquare size={13} />
                      Live log stream
                    </div>
                    <pre className="p-4 bg-[var(--bg-primary)] text-sm font-mono text-[var(--text-secondary)] overflow-x-auto max-h-96 overflow-y-auto">
                      {log.output.length === 0 ? (
                        <span className="text-[var(--text-tertiary)]">No output yet...</span>
                      ) : (
                        log.output.map((line, i) => (
                          <div key={i} className="py-0.5">
                            <span className="text-[var(--text-tertiary)] mr-2">{String(i + 1).padStart(3, '0')}</span>
                            <span>{line}</span>
                          </div>
                        ))
                      )}
                    </pre>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
