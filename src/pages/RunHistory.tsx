import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, User, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { WorkflowRun } from '../types';

function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
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

export default function RunHistory() {
  const navigate = useNavigate();
  const { repositories } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 750);
    return () => clearTimeout(timer);
  }, []);

  const allRuns = useMemo(
    () =>
      repositories
        .flatMap((repo) =>
          repo.workflows.flatMap((workflow) =>
            workflow.runs.map((run) => ({
              ...run,
              workflowName: workflow.name,
              repoName: repo.fullName,
            }))
          )
        )
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [repositories]
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Run History" subtitle={`${allRuns.length} workflow runs`} />

      <main className="flex-1 p-4 md:p-6">
        {isLoading ? (
          <Card className="p-4 space-y-2">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton h-12" />
            ))}
          </Card>
        ) : allRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
              <Clock size={32} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No runs yet</h3>
            <p className="text-[var(--text-secondary)] max-w-sm">Run a workflow to populate your history.</p>
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-[var(--border-muted)]">
                    <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Workflow</th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Duration</th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Triggered By</th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Timestamp</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody>
                  {allRuns.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-[var(--border-muted)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                      onClick={() => navigate(`/runs/${run.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/runs/${run.id}`);
                      }}
                      tabIndex={0}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{run.workflowName}</p>
                          <p className="text-sm text-[var(--text-tertiary)]">{run.repoName}</p>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(run.status)}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{formatDuration(run.duration)}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                          <User size={14} />
                          {run.triggeredBy}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-secondary)]">{formatTimeAgo(run.startedAt)}</td>
                      <td className="p-4">
                        <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
