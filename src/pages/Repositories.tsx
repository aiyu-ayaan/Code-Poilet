import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  GitBranch,
  Clock,
  ExternalLink,
  Play,
  Search,
  Boxes,
  DatabaseZap,
  Filter,
  RefreshCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { Repository } from '../types';
import { connectLiveSocket } from '../utils/live';
import { apiRequest } from '../utils/api';

type RepoFilter = 'all' | Repository['status'];

interface QueueSnapshot {
  queued: number;
  running: number;
  failed: number;
  success: number;
  maxConcurrentRuns?: number;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getStatusBadge(status: Repository['status']) {
  const variants = {
    idle: 'default',
    running: 'running',
    success: 'success',
    failed: 'error',
  } as const;

  const labels = {
    idle: 'Idle',
    running: 'Running',
    success: 'Success',
    failed: 'Failed',
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export default function Repositories() {
  const navigate = useNavigate();
  const { repositories, selectRepo, showToast, refreshRepositories } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RepoFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    apiRequest<QueueSnapshot>('/runs/status/queue').then(setQueue).catch(() => setQueue(null));

    const socket = connectLiveSocket((message) => {
      if (message.type === 'queue_snapshot' && message.payload) {
        setQueue(message.payload as QueueSnapshot);
      }
    });

    return () => socket.close();
  }, []);

  const filteredRepositories = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return repositories.filter((repo) => {
      const statusOk = filter === 'all' || repo.status === filter;
      const searchOk =
        normalized.length === 0 ||
        repo.fullName.toLowerCase().includes(normalized) ||
        (repo.description || '').toLowerCase().includes(normalized);
      return statusOk && searchOk;
    });
  }, [filter, repositories, search]);

  const handleViewRepo = (repo: Repository) => {
    selectRepo(repo);
    navigate(`/repositories/${repo.id}`);
  };

  const handleRunPipeline = (repo: Repository) => {
    showToast('success', `Started pipeline for ${repo.name}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRepositories(true);
      showToast('success', 'Repositories refreshed');
    } catch {
      showToast('error', 'Failed to refresh repositories');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title="Repositories"
        subtitle={`${repositories.length} repositories connected`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleRefresh} isLoading={isRefreshing}>
              <RefreshCcw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button>
              <Plus size={16} className="mr-2" />
              Add Repository
            </Button>
          </div>
        }
      />

      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Docker Engine</p>
            <div className="flex items-center justify-between">
              <p className="font-medium">Containers Ready</p>
              <span className="inline-flex items-center gap-2 text-[var(--success)] text-sm">
                <span className="status-dot bg-[var(--success)]" /> healthy
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Queue Status</p>
            <div className="flex items-center justify-between">
              <p className="font-medium">{queue?.queued ?? 0} Pending Jobs</p>
              <Boxes size={16} className="text-[var(--warning)]" />
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Local Runner</p>
            <div className="flex items-center justify-between">
              <p className="font-medium">act v0.2.52</p>
              <DatabaseZap size={16} className="text-[var(--accent-primary)]" />
            </div>
          </Card>
        </div>

        <Card className="p-3 md:p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-lg">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-sm"
                placeholder="Search repositories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 overflow-auto">
              <Filter size={14} className="text-[var(--text-tertiary)]" />
              {(['all', 'running', 'failed', 'success', 'idle'] as RepoFilter[]).map((item) => (
                <button
                  key={item}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    filter === item
                      ? 'bg-[var(--accent-muted)] border-[color:rgb(56_139_253_/_45%)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card className="p-4 space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="skeleton h-14" />
            ))}
          </Card>
        ) : filteredRepositories.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
              <GitBranch size={26} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No repositories found</h3>
            <p className="text-[var(--text-secondary)] max-w-sm mx-auto">
              Try a different filter, or connect your first repository to start local CI runs.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="border-b border-[var(--border-muted)]">
                    <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Repository</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Status</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Last Run</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepositories.map((repo) => (
                    <tr key={repo.id} className="border-b border-[var(--border-muted)] hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{repo.fullName}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{repo.description || 'No description available'}</p>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(repo.status)}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <Clock size={14} />
                          {formatTimeAgo(repo.lastRunAt)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleViewRepo(repo)}>
                            View
                            <ExternalLink size={14} className="ml-1.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRunPipeline(repo)}>
                            <Play size={14} className="mr-1" />
                            Run
                          </Button>
                        </div>
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
