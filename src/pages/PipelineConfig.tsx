import { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Trash2, Plus, FileText, ArrowLeft, Pencil, Upload, Download, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import type { Workflow, EnvVariable } from '../types';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import { apiRequest } from '../utils/api';
import { connectLiveSocket } from '../utils/live';

interface RemoteWorkflow {
  name: string;
  fileName: string;
  path: string;
  hasWorkflowDispatch: boolean;
  inputs: string[];
}

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

interface WorkflowRunRecord {
  runId: string;
  workflowName?: string;
  workflowFile: string;
  fullRepoName: string;
  status: RunStatus;
  durationSeconds?: number;
  triggeredBy: string;
  startedAt?: string;
  queuedAt: string;
}

function getStatusBadge(status: Workflow['status']) {
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

function detectWorkflowInputs(content: string): string[] {
  const inputsBlock = content.match(/workflow_dispatch:\s*([\s\S]*?)\n\s*[a-zA-Z_]+:/);
  const source = inputsBlock ? inputsBlock[1] : content;
  const inputNames = [...source.matchAll(/^\s{4,}([a-zA-Z0-9_-]+):\s*$/gm)].map((match) => match[1]);
  return [...new Set(inputNames)];
}

function parseEnvText(text: string): EnvVariable[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const [key, ...rest] = line.split('=');
      return { key: key.trim(), value: rest.join('=').trim() };
    })
    .filter((item) => item.key.length > 0);
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTimeAgo(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getRunBadge(status: RunStatus) {
  const variants = {
    queued: 'warning',
    running: 'running',
    success: 'success',
    failed: 'error',
    cancelled: 'default',
  } as const;

  return <Badge variant={variants[status]}>{status}</Badge>;
}

export default function PipelineConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { repositories, showToast } = useApp();

  const repository = repositories.find((r) => r.id === id);
  const [workflows, setWorkflows] = useState<Workflow[]>(repository?.workflows ?? []);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(repository?.workflows[0] || null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  const [yamlProgress, setYamlProgress] = useState(0);
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [newVar, setNewVar] = useState({ key: '', value: '' });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [runBranch, setRunBranch] = useState(repository?.defaultBranch ?? 'main');
  const [runEvent, setRunEvent] = useState<'push' | 'workflow_dispatch'>('workflow_dispatch');
  const [runOverride, setRunOverride] = useState('');
  const [runHistory, setRunHistory] = useState<WorkflowRunRecord[]>([]);
  const [isRunHistoryLoading, setIsRunHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadWorkflowContent = useCallback(async (workflow: Workflow) => {
    if (!repository) return;

    setSelectedWorkflow(workflow);
    setIsYamlLoading(true);
    setYamlProgress(8);

    const timer = setInterval(() => {
      setYamlProgress((prev) => (prev >= 90 ? prev : prev + 8));
    }, 90);

    try {
      const content = await apiRequest<{ content: string }>(`/repos/${repository.owner}/${repository.name}/workflows/${workflow.fileName}/content`);
      setSelectedWorkflow({ ...workflow, content: content.content });
      setYamlProgress(100);

      const profile = await apiRequest<{ vars: Record<string, string>; exists: boolean }>(
        `/repos/${repository.owner}/${repository.name}/env-profile?workflowFile=${encodeURIComponent(`.github/workflows/${workflow.fileName}`)}`
      );
      const loadedVars = Object.entries(profile.vars).map(([key, value]) => ({ key, value }));
      setEnvVars(loadedVars);
    } catch {
      showToast('warning', 'Could not load workflow YAML from backend.');
    } finally {
      clearInterval(timer);
      setTimeout(() => {
        setIsYamlLoading(false);
        setYamlProgress(0);
      }, 250);
    }
  }, [repository, showToast]);

  useEffect(() => {
    if (!repository) return;

    const loadWorkflows = async () => {
      try {
        const payload = await apiRequest<{ workflows: RemoteWorkflow[] }>(`/repos/${repository.owner}/${repository.name}/workflows`);
        const mapped: Workflow[] = payload.workflows.map((wf, idx) => ({
          id: `${repository.id}-${idx}`,
          name: wf.name,
          fileName: wf.fileName,
          content: '',
          status: 'idle',
          runs: [],
        }));
        setWorkflows(mapped);

        if (mapped[0]) {
          await loadWorkflowContent(mapped[0]);
        }
      } catch {
        if (repository.workflows.length > 0) {
          setWorkflows(repository.workflows);
          setSelectedWorkflow(repository.workflows[0] ?? null);
        } else {
          showToast('warning', 'Could not fetch workflows from backend.');
        }
      }
    };

    void loadWorkflows();
  }, [repository, showToast, loadWorkflowContent]);

  useEffect(() => {
    if (!repository || !selectedWorkflow) return;

    let isActive = true;
    const workflowPath = `.github/workflows/${selectedWorkflow.fileName}`;

    const loadRunHistory = async () => {
      setIsRunHistoryLoading(true);
      try {
        const runs = await apiRequest<WorkflowRunRecord[]>(
          `/runs/history?repo=${encodeURIComponent(repository.fullName)}&workflowFile=${encodeURIComponent(workflowPath)}&limit=20`
        );
        if (isActive) {
          setRunHistory(runs);
        }
      } catch {
        if (isActive) {
          setRunHistory([]);
        }
      } finally {
        if (isActive) {
          setIsRunHistoryLoading(false);
        }
      }
    };

    void loadRunHistory();

    const socket = connectLiveSocket((message) => {
      if (message.type !== 'run_update' || !message.payload) return;

      const payload = message.payload as WorkflowRunRecord;
      if (payload.fullRepoName !== repository.fullName) return;
      if (payload.workflowFile !== workflowPath) return;

      setRunHistory((prev) => {
        const next = [...prev];
        const existingIndex = next.findIndex((item) => item.runId === payload.runId);

        if (existingIndex >= 0) {
          next[existingIndex] = payload;
        } else {
          next.unshift(payload);
        }

        return next
          .sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())
          .slice(0, 20);
      });
    });

    return () => {
      isActive = false;
      socket.close();
    };
  }, [repository, selectedWorkflow]);

  if (!repository) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Repository Not Found" />
        <main className="flex-1 p-6">
          <div className="text-center">
            <p className="text-[var(--text-secondary)]">Repository not found</p>
            <Button onClick={() => navigate('/repositories')} className="mt-4">
              <ArrowLeft size={16} className="mr-2" />
              Back to Repositories
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const selectedInputs = selectedWorkflow ? detectWorkflowInputs(selectedWorkflow.content) : [];

  const handleAddEnvVar = () => {
    if (!newVar.key || !newVar.value) return;
    if (editIndex !== null) {
      setEnvVars((prev) => prev.map((item, idx) => (idx === editIndex ? { key: newVar.key, value: newVar.value } : item)));
      setEditIndex(null);
      showToast('success', 'Environment variable updated');
    } else {
      setEnvVars((prev) => [...prev, newVar]);
      showToast('success', 'Environment variable added');
    }
    setNewVar({ key: '', value: '' });
  };

  const handleEditEnvVar = (index: number) => {
    setEditIndex(index);
    setNewVar({ key: envVars[index].key, value: envVars[index].value });
  };

  const handleDeleteEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
    showToast('success', 'Environment variable removed');
  };

  const saveEncryptedEnv = async () => {
    if (!selectedWorkflow) return;
    try {
      await apiRequest(`/repos/${repository.owner}/${repository.name}/env-profile`, {
        method: 'POST',
        body: JSON.stringify({
          workflowFile: `.github/workflows/${selectedWorkflow.fileName}`,
          vars: Object.fromEntries(envVars.map((item) => [item.key, item.value])),
        }),
      });
      showToast('success', 'Encrypted env profile saved');
    } catch {
      showToast('error', 'Could not save env profile');
    }
  };

  const handleDownloadEnv = () => {
    const content = envVars.map((item) => `${item.key}=${item.value}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${repository.name}-${selectedWorkflow?.fileName || 'workflow'}.env`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUploadEnv = async (file: File) => {
    const text = await file.text();
    const parsed = parseEnvText(text);
    setEnvVars(parsed);
    showToast('success', 'Env file imported');
  };

  const highlightedCode = selectedWorkflow?.content
    ? Prism.highlight(selectedWorkflow.content, Prism.languages.yaml, 'yaml')
    : '';

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title={repository.fullName}
        subtitle="Pipeline configuration"
        actions={
          <Button onClick={() => setIsRunModalOpen(true)}>
            <Play size={16} className="mr-2" />
            Run Pipeline
          </Button>
        }
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
          <div className="xl:col-span-4">
            <Card className="h-full">
              <div className="p-4 border-b border-[var(--border-muted)]">
                <h3 className="font-semibold">Workflow Files</h3>
                <p className="text-sm text-[var(--text-secondary)]">.github/workflows/*.yml detected</p>
              </div>

              {workflows.length === 0 ? (
                <div className="p-6 text-sm text-[var(--text-secondary)]">No workflows found in this repository.</div>
              ) : (
                <div className="p-2 space-y-2">
                  {workflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => void loadWorkflowContent(workflow)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedWorkflow?.id === workflow.id
                          ? 'bg-[var(--accent-muted)] border-[color:rgb(56_139_253_/_45%)]'
                          : 'bg-[var(--bg-secondary)] border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={17} className="text-[var(--text-secondary)]" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{workflow.name}</p>
                            <p className="text-xs text-[var(--text-tertiary)] truncate">{workflow.fileName}</p>
                          </div>
                        </div>
                        {getStatusBadge(workflow.status)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="xl:col-span-8 space-y-4 md:space-y-6">
            {selectedWorkflow ? (
              <>
                <Card>
                  <div className="p-4 border-b border-[var(--border-muted)] flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedWorkflow.fileName}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Read-only YAML preview</p>
                    </div>
                  </div>
                  {isYamlLoading && (
                    <div className="h-1 bg-[var(--bg-tertiary)]">
                      <div className="h-1 bg-[var(--accent-primary)] transition-all duration-150" style={{ width: `${yamlProgress}%` }} />
                    </div>
                  )}
                  <pre className="p-4 overflow-auto max-h-[340px] text-sm bg-[var(--bg-primary)] border-t border-[var(--border-muted)]">
                    <code className="language-yaml" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
                  </pre>
                </Card>

                <Card>
                  <div className="p-4 border-b border-[var(--border-muted)] flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold">Environment Variables</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Configure key/value pairs for local run context.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".env,.txt"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleUploadEnv(file);
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                      <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={14} className="mr-1.5" />
                        Upload .env
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleDownloadEnv}>
                        <Download size={14} className="mr-1.5" />
                        Download .env
                      </Button>
                      <Button size="sm" onClick={() => void saveEncryptedEnv()}>
                        <Save size={14} className="mr-1.5" />
                        Save Encrypted
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {envVars.map((env, index) => (
                      <div key={`${env.key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center p-2.5 rounded-lg border border-[var(--border-muted)] bg-[var(--bg-primary)]">
                        <span className="font-mono text-sm">{env.key}</span>
                        <span className="font-mono text-sm text-[var(--text-secondary)]">{env.value}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditEnvVar(index)} aria-label="Edit variable">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteEnvVar(index)} aria-label="Delete variable">
                            <Trash2 size={14} className="text-[var(--error)]" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 pt-2">
                      <Input placeholder="KEY" value={newVar.key} onChange={(e) => setNewVar({ ...newVar, key: e.target.value })} />
                      <Input placeholder="VALUE" value={newVar.value} onChange={(e) => setNewVar({ ...newVar, value: e.target.value })} />
                      <Button onClick={handleAddEnvVar}>
                        <Plus size={16} className="mr-1" />
                        {editIndex !== null ? 'Update' : 'Add'}
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="p-4 border-b border-[var(--border-muted)]">
                    <h3 className="font-semibold">workflow_dispatch Inputs</h3>
                  </div>
                  <div className="p-4">
                    {selectedInputs.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No dispatch inputs detected for this workflow.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedInputs.map((inputName) => (
                          <Input key={inputName} label={inputName} placeholder={`Enter ${inputName}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="p-4 border-b border-[var(--border-muted)] flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Recent Runs</h3>
                      <p className="text-sm text-[var(--text-secondary)]">Live history for this workflow</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {isRunHistoryLoading ? (
                      <div className="p-4 space-y-2">
                        {[1, 2, 3].map((row) => (
                          <div key={row} className="skeleton h-12" />
                        ))}
                      </div>
                    ) : runHistory.length === 0 ? (
                      <div className="p-6 text-sm text-[var(--text-secondary)]">No runs yet for this workflow.</div>
                    ) : (
                      <table className="w-full min-w-[680px]">
                        <thead>
                          <tr className="border-b border-[var(--border-muted)]">
                            <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Status</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Triggered By</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Duration</th>
                            <th className="text-left p-4 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runHistory.map((run) => (
                            <tr
                              key={run.runId}
                              className="border-b border-[var(--border-muted)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                              onClick={() => navigate(`/runs/${run.runId}`)}
                            >
                              <td className="p-4">{getRunBadge(run.status)}</td>
                              <td className="p-4 text-sm text-[var(--text-primary)]">{run.triggeredBy}</td>
                              <td className="p-4 text-sm text-[var(--text-secondary)]">{formatDuration(run.durationSeconds)}</td>
                              <td className="p-4 text-sm text-[var(--text-secondary)]">{formatTimeAgo(run.startedAt || run.queuedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center text-[var(--text-secondary)]">Select a workflow to inspect configuration details.</Card>
            )}
          </div>
        </div>
      </main>

      <Modal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        title="Run Pipeline"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRunModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedWorkflow) return;
                try {
                  await apiRequest(`/runs/trigger/${repository.owner}/${repository.name}`, {
                    method: 'POST',
                    body: JSON.stringify({
                      branch: runBranch,
                      workflowFile: `.github/workflows/${selectedWorkflow.fileName}`,
                      workflowName: selectedWorkflow.name,
                      event: runEvent,
                      envOverrides: Object.fromEntries(envVars.map((item) => [item.key, item.value])),
                    }),
                  });
                  showToast('success', `Pipeline queued on ${runBranch}`);
                } catch {
                  showToast('error', 'Failed to queue pipeline');
                }
                setIsRunModalOpen(false);
              }}
            >
              <Play size={16} className="mr-2" />
              Run
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Branch selector</label>
            <Input value={runBranch} onChange={(e) => setRunBranch(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Event type</label>
            <select
              value={runEvent}
              onChange={(e) => setRunEvent(e.target.value as 'push' | 'workflow_dispatch')}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] text-sm"
            >
              <option value="push">push</option>
              <option value="workflow_dispatch">workflow_dispatch</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Environment variables override</label>
            <textarea
              value={runOverride}
              onChange={(e) => setRunOverride(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] text-sm font-mono"
              rows={5}
              placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
