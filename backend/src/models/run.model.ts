import { Schema, model } from 'mongoose';

export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface RunStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  output: string[];
}

export interface RunDocument {
  runId: string;
  actorGithubUserId: number;
  githubRepoId: number;
  fullRepoName: string;
  workflowFile: string;
  workflowName?: string;
  branch: string;
  event: 'push' | 'workflow_dispatch';
  triggeredBy: string;
  status: RunStatus;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;
  envOverrides: Record<string, string>;
  steps: RunStep[];
  streamLog: string[];
  failureReason?: string;
}

const runStepSchema = new Schema<RunStep>(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'success', 'failed'], default: 'pending' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    output: { type: [String], default: [] },
  },
  { _id: false }
);

const runSchema = new Schema<RunDocument>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    actorGithubUserId: { type: Number, required: true, index: true },
    githubRepoId: { type: Number, required: true, index: true },
    fullRepoName: { type: String, required: true, index: true },
    workflowFile: { type: String, required: true },
    workflowName: { type: String },
    branch: { type: String, required: true },
    event: { type: String, enum: ['push', 'workflow_dispatch'], required: true },
    triggeredBy: { type: String, required: true },
    status: { type: String, enum: ['queued', 'running', 'success', 'failed', 'cancelled'], required: true, index: true },
    queuedAt: { type: Date, required: true, index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationSeconds: { type: Number },
    envOverrides: { type: Map, of: String, default: {} },
    steps: { type: [runStepSchema], default: [] },
    streamLog: { type: [String], default: [] },
    failureReason: { type: String },
  },
  {
    timestamps: true,
  }
);

runSchema.index({ status: 1, queuedAt: 1 });
runSchema.index({ fullRepoName: 1, workflowFile: 1, branch: 1, status: 1 });

export const RunModel = model<RunDocument>('Run', runSchema);
