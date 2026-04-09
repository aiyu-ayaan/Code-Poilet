export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  description?: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  lastRunAt?: string;
  defaultBranch: string;
  workflows: Workflow[];
}

export interface Workflow {
  id: string;
  name: string;
  fileName: string;
  content: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  runs: WorkflowRun[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  runNumber: number;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  branch: string;
  event: string;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  logs: RunLog[];
  envVars: Record<string, string>;
}

export interface RunLog {
  stepName: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt?: string;
  completedAt?: string;
  output: string[];
}

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface EnvVariable {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  createdAt: string;
  isRead: boolean;
  href?: string;
}
