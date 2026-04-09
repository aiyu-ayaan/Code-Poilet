/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, Repository, ToastProps, NotificationItem } from '../types';
import { mockRepositories } from '../data/mockData';
import { apiRequest, getApiBaseUrl } from '../utils/api';
import { connectLiveSocket, type LiveMessage } from '../utils/live';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  repositories: Repository[];
  selectedRepo: Repository | null;
  toasts: ToastProps[];
  notifications: NotificationItem[];
  unreadNotifications: number;
  isBootstrapping: boolean;
  login: () => void;
  logout: () => Promise<void>;
  selectRepo: (repo: Repository | null) => void;
  addRepository: (repo: Repository) => void;
  refreshRepositories: (forceSync?: boolean) => Promise<void>;
  showToast: (type: ToastProps['type'], message: string) => void;
  removeToast: (id: string) => void;
  markNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
}

interface BackendMe {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string;
}

interface BackendRepo {
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  status?: 'queued' | 'running' | 'success' | 'failed' | 'idle';
  lastRunAt?: string;
}

interface LiveRunPayload {
  runId: string;
  fullRepoName: string;
  workflowName?: string;
  workflowFile: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  branch: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const repoCacheKey = 'acthub:repos';
const maxNotifications = 20;

function mapStatus(status?: BackendRepo['status']): Repository['status'] {
  if (status === 'queued') return 'running';
  if (status === 'running') return 'running';
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function mapBackendRepoToUi(repo: BackendRepo): Repository {
  return {
    id: String(repo.githubRepoId),
    name: repo.name,
    owner: repo.owner,
    fullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    status: mapStatus(repo.status),
    lastRunAt: repo.lastRunAt,
    workflows: [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>(() => {
    try {
      const cached = localStorage.getItem(repoCacheKey);
      if (!cached) return mockRepositories;
      return JSON.parse(cached) as Repository[];
    } catch {
      return mockRepositories;
    }
  });
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const showToast = useCallback((type: ToastProps['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message, onClose: () => {} }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const refreshRepositories = useCallback(async (forceSync = true) => {
    try {
      if (forceSync) {
        await apiRequest<{ count: number }>('/repos/sync', { method: 'POST' });
      }
      const repos = await apiRequest<BackendRepo[]>('/repos');
      const mapped = repos.map(mapBackendRepoToUi);
      setRepositories(mapped);
      localStorage.setItem(repoCacheKey, JSON.stringify(mapped));
    } catch {
      showToast('warning', 'Using local mock repositories (backend sync unavailable).');
      setRepositories(mockRepositories);
    }
  }, [showToast]);

  const login = useCallback(() => {
    const base = getApiBaseUrl().replace(/\/api$/, '');
    const redirect = encodeURIComponent('/dashboard');
    window.location.href = `${base}/api/auth/github/start?redirect=${redirect}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors.
    }

    setUser(null);
    setSelectedRepo(null);
  }, []);

  const selectRepo = useCallback((repo: Repository | null) => {
    setSelectedRepo(repo);
  }, []);

  const addRepository = useCallback((repo: Repository) => {
    setRepositories((prev) => [...prev, repo]);
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const createNotification = (message: LiveMessage) => {
      if (message.type !== 'run_update' || !message.payload || message.event === 'log' || message.event === 'snapshot') {
        return;
      }

      const payload = message.payload as LiveRunPayload;
      const workflowLabel = payload.workflowName || payload.workflowFile.split('/').pop() || 'workflow';
      const titleMap = {
        queued: 'Run queued',
        running: 'Run started',
        success: 'Run completed',
        failed: 'Run failed',
        cancelled: 'Run cancelled',
      } as const;
      const typeMap = {
        queued: 'info',
        running: 'info',
        success: 'success',
        failed: 'error',
        cancelled: 'warning',
      } as const;

      const notification: NotificationItem = {
        id: `${payload.runId}:${message.event || payload.status}`,
        title: titleMap[payload.status],
        message: `${workflowLabel} on ${payload.fullRepoName} (${payload.branch})`,
        type: typeMap[payload.status],
        createdAt: new Date().toISOString(),
        isRead: false,
        href: `/runs/${payload.runId}`,
      };

      setNotifications((prev) => {
        const next = [notification, ...prev.filter((item) => item.id !== notification.id)];
        return next.slice(0, maxNotifications);
      });

      if (payload.status === 'failed') {
        showToast('error', `${workflowLabel} failed on ${payload.fullRepoName}`);
      } else if (payload.status === 'success') {
        showToast('success', `${workflowLabel} completed on ${payload.fullRepoName}`);
      }
    };

    const socket = connectLiveSocket(createNotification);
    return () => socket.close();
  }, [showToast, user]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await apiRequest<BackendMe>('/auth/me');
        setUser({
          id: String(me.id),
          name: me.name || me.username,
          email: `${me.username}@users.noreply.github.com`,
          avatarUrl: me.avatarUrl || 'https://avatars.githubusercontent.com/u/1?v=4',
        });

        await refreshRepositories(true);
      } catch {
        setUser(null);
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, [refreshRepositories]);

  const value: AppContextType = {
    user,
    isAuthenticated: !!user,
    repositories,
    selectedRepo,
    toasts,
    notifications,
    unreadNotifications: notifications.filter((item) => !item.isRead).length,
    isBootstrapping,
    login,
    logout,
    selectRepo,
    addRepository,
    refreshRepositories,
    showToast,
    removeToast,
    markNotificationsRead,
    dismissNotification,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
