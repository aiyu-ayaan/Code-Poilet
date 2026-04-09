import { useEffect, useState } from 'react';
import { Activity, GitBranch, Timer, ListChecks } from 'lucide-react';
import Header from '../components/layout/Header';
import Card from '../components/ui/Card';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../utils/api';
import { connectLiveSocket } from '../utils/live';

interface QueueSnapshot {
  queued: number;
  running: number;
  failed: number;
  success: number;
  maxConcurrentRuns: number;
}

export default function Dashboard() {
  const { repositories } = useApp();
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);

  useEffect(() => {
    apiRequest<QueueSnapshot>('/runs/status/queue')
      .then(setQueue)
      .catch(() => setQueue(null));

    const socket = connectLiveSocket((message) => {
      if (message.type === 'queue_snapshot' && message.payload) {
        setQueue(message.payload as QueueSnapshot);
      }
    });

    return () => socket.close();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Dashboard" subtitle="Local GitHub Actions orchestration powered by act" />

      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-[var(--text-tertiary)]">Connected Repositories</p>
          <p className="text-3xl font-semibold mt-1">{repositories.length}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
            <GitBranch size={14} /> repo-layer access enabled
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase text-[var(--text-tertiary)]">Queued Runs</p>
          <p className="text-3xl font-semibold mt-1">{queue?.queued ?? '-'}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
            <Timer size={14} /> throttled to {queue?.maxConcurrentRuns ?? 2} concurrent workers
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase text-[var(--text-tertiary)]">Running</p>
          <p className="text-3xl font-semibold mt-1">{queue?.running ?? '-'}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
            <Activity size={14} /> real-time stream with step logs
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase text-[var(--text-tertiary)]">Completed</p>
          <p className="text-3xl font-semibold mt-1">{queue ? queue.success + queue.failed : '-'}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2 inline-flex items-center gap-2">
            <ListChecks size={14} /> {queue?.failed ?? 0} failed / {queue?.success ?? 0} success
          </p>
        </Card>
      </main>
    </div>
  );
}
