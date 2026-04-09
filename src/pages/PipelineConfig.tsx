import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Trash2, Plus, FileText, ArrowLeft, Pencil, Save } from 'lucide-react';
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

interface RemoteWorkflow {
  name: string;
  fileName: string;
  path: string;
  hasWorkflowDispatch: boolean;
  inputs: string[];
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

export default function PipelineConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { repositories, showToast } = useApp();

  const repository = repositories.find((r) => r.id === id);
  const [workflows, setWorkflows] = useState<Workflow[]>(repository?.workflows ?? []);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(repository?.workflows[0] || null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [envVars, setEnvVars] = useState<EnvVariable[]>([
    { key: 'NODE_VERSION', value: '20.x' },
    { key: 'ACT_CACHE_DIR', value: '.act-cache' },
  ]);
  const [newVar, setNewVar] = useState({ key: '', value: '' });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [runBranch, setRunBranch] = useState(repository?.defaultBranch ?? 'main');
  const [runEvent, setRunEvent] = useState<'push' | 'workflow_dispatch'>('workflow_dispatch');
  const [runOverride, setRunOverride] = useState('');

  useEffect(() => {
    if (!repository) return;
    if (repository.workflows.length > 0) return;

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
        setSelectedWorkflow(mapped[0] ?? null);

        if (mapped[0]) {
          const content = await apiRequest<{ content: string }>(`/repos/${repository.owner}/${repository.name}/workflows/${mapped[0].fileName}/content`);
          setSelectedWorkflow({ ...mapped[0], content: content.content });
        }
      } catch {
        showToast('warning', 'Could not fetch workflows from backend; showing local data.');
      }
    };

    void loadWorkflows();
  }, [repository, showToast]);

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

  const selectedInputs = useMemo(() => {
    if (!selectedWorkflow) return [];
    return detectWorkflowInputs(selectedWorkflow.content);
  }, [selectedWorkflow]);

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
                      onClick={async () => {
                        setSelectedWorkflow(workflow);
                        try {
                          const content = await apiRequest<{ content: string }>(`/repos/${repository.owner}/${repository.name}/workflows/${workflow.fileName}/content`);
                          setSelectedWorkflow({ ...workflow, content: content.content });
                        } catch {
                          // ignore
                        }
                      }}
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
                    <Button variant="secondary" size="sm">
                      <Save size={14} className="mr-1.5" />
                      Save Draft
                    </Button>
                  </div>
                  <pre className="p-4 overflow-auto max-h-[340px] text-sm bg-[var(--bg-primary)] border-t border-[var(--border-muted)]">
                    <code className="language-yaml" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
                  </pre>
                </Card>

                <Card>
                  <div className="p-4 border-b border-[var(--border-muted)]">
                    <h3 className="font-semibold">Environment Variables</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Configure key/value pairs for local run context.</p>
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
                      envOverrides: Object.fromEntries(
                        runOverride
                          .split(/\r?\n/)
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const [key, ...rest] = line.split('=');
                            return [key, rest.join('=')];
                          })
                      ),
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
