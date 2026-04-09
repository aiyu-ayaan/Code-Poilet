import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, Repository, ToastProps } from '../types';
import { mockUser, mockRepositories } from '../data/mockData';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  repositories: Repository[];
  selectedRepo: Repository | null;
  toasts: ToastProps[];
  login: () => void;
  logout: () => void;
  selectRepo: (repo: Repository | null) => void;
  addRepository: (repo: Repository) => void;
  showToast: (type: ToastProps['type'], message: string) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>(mockRepositories);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const login = useCallback(() => {
    setUser(mockUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setSelectedRepo(null);
  }, []);

  const selectRepo = useCallback((repo: Repository | null) => {
    setSelectedRepo(repo);
  }, []);

  const addRepository = useCallback((repo: Repository) => {
    setRepositories(prev => [...prev, repo]);
  }, []);

  const showToast = useCallback((type: ToastProps['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message, onClose: () => {} }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: AppContextType = {
    user,
    isAuthenticated: !!user,
    repositories,
    selectedRepo,
    toasts,
    login,
    logout,
    selectRepo,
    addRepository,
    showToast,
    removeToast,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
