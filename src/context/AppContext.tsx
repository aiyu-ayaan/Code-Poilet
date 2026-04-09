import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, Repository, ToastProps } from '../types';
import { mockRepositories } from '../data/mockData';
import { apiRequest, getApiBaseUrl } from '../utils/api';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  repositories: Repository[];
  selectedRepo: Repository | null;
  toasts: ToastProps[];
  isBootstrapping: boolean;
  login: () => void;
  logout: () => Promise<void>;
  selectRepo: (repo: Repository | null) => void;
  addRepository: (repo: Repository) => void;
  refreshRepositories: () => Promise<void>;
  showToast: (type: ToastProps['type'], message: string) => void;
  removeToast: (id: string) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function mapBackendRepoToUi(repo: BackendRepo): Repository {
  return {
    id: String(repo.githubRepoId),
    name: repo.name,
    owner: repo.owner,
    fullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    status: 'idle',
    workflows: [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>(mockRepositories);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const showToast = useCallback((type: ToastProps['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message, onClose: () => {} }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshRepositories = useCallback(async () => {
    try {
      await apiRequest<{ count: number }>('/repos/sync', { method: 'POST' });
      const repos = await apiRequest<BackendRepo[]>('/repos');
      setRepositories(repos.map(mapBackendRepoToUi));
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
    const bootstrap = async () => {
      try {
        const me = await apiRequest<BackendMe>('/auth/me');
        setUser({
          id: String(me.id),
          name: me.name || me.username,
          email: `${me.username}@users.noreply.github.com`,
          avatarUrl: me.avatarUrl || 'https://avatars.githubusercontent.com/u/1?v=4',
        });

        await refreshRepositories();
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
    isBootstrapping,
    login,
    logout,
    selectRepo,
    addRepository,
    refreshRepositories,
    showToast,
    removeToast,
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
