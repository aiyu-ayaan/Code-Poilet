import { useNavigate } from 'react-router-dom';
import { Workflow, ArrowRight, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import type { Workflow as WorkflowType } from '../types';

function getStatusBadge(status: WorkflowType['status']) {
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

export default function Pipelines() {
  const navigate = useNavigate();
  const { repositories } = useApp();

  // Flatten all workflows
  const allWorkflows = repositories.flatMap(repo =>
    repo.workflows.map(workflow => ({
      ...workflow,
      repoId: repo.id,
      repoName: repo.fullName,
    }))
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title="Pipelines"
        subtitle={`${allWorkflows.length} workflows across ${repositories.length} repositories`}
      />

      <main className="flex-1 p-6">
        {allWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
              <Workflow size={32} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              No workflows detected
            </h3>
            <p className="text-[var(--text-secondary)] max-w-sm">
              Add a repository with workflow files in .github/workflows/
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {allWorkflows.map((workflow) => (
              <Card key={workflow.id} isHoverable className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                      <Workflow size={20} className="text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {workflow.name}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {workflow.repoName} • {workflow.fileName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Clock size={14} />
                      <span>{workflow.runs.length} runs</span>
                    </div>

                    {getStatusBadge(workflow.status)}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/repositories/${workflow.repoId}`)}
                      >
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
