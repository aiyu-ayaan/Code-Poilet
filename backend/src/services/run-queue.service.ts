import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { RunModel } from '../models/run.model.js';
import { SessionModel } from '../models/session.model.js';
import { RepoModel } from '../models/repo.model.js';
import { ensureRepoLocal, runAct } from './act.service.js';
import { publishQueueUpdate, publishRunUpdate } from './live-gateway.service.js';

interface QueueRunRequest {
  githubRepoId: number;
  fullRepoName: string;
  workflowFile: string;
  workflowName?: string;
  branch: string;
  event: 'push' | 'workflow_dispatch';
  triggeredBy: string;
  envOverrides?: Record<string, string>;
  actorGithubUserId: number;
}

let workerStarted = false;
let activeRuns = 0;

export async function queueRun(request: QueueRunRequest) {
  const existing = await RunModel.findOne({
    fullRepoName: request.fullRepoName,
    workflowFile: request.workflowFile,
    branch: request.branch,
    status: { $in: ['queued', 'running'] },
  }).lean();

  if (existing) {
    return { queued: false, run: existing, reason: 'An active run already exists for the same workflow and branch.' };
  }

  const run = await RunModel.create({
    runId: crypto.randomUUID(),
    githubRepoId: request.githubRepoId,
    fullRepoName: request.fullRepoName,
    workflowFile: request.workflowFile,
    workflowName: request.workflowName,
    branch: request.branch,
    event: request.event,
    triggeredBy: request.triggeredBy,
    status: 'queued',
    queuedAt: new Date(),
    envOverrides: request.envOverrides ?? {},
    steps: [],
    streamLog: [],
    actorGithubUserId: request.actorGithubUserId,
  });

  await publishQueueUpdate();
  await publishRunUpdate(run.runId, 'queued');
  return { queued: true, run };
}

async function getNextQueuedRun() {
  return RunModel.findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'running', startedAt: new Date() } },
    { sort: { queuedAt: 1 }, new: true }
  );
}

async function executeRun(runId: string) {
  const run = await RunModel.findOne({ runId });
  if (!run) {
    return;
  }

  const startedAt = run.startedAt ?? new Date();

  try {
    const session = await SessionModel.findOne({ githubUserId: run.actorGithubUserId }).sort({ createdAt: -1 }).lean();
    if (!session) {
      throw new Error('No active GitHub session found for actor');
    }

    const repo = await RepoModel.findOne({ githubRepoId: run.githubRepoId }).lean();
    if (!repo || !repo.permissions.push) {
      throw new Error('Missing push permission for this repository');
    }

    const repoPath = await ensureRepoLocal(run.fullRepoName, session.githubToken, run.branch);

    await runAct({
      repoPath,
      workflowFile: run.workflowFile,
      event: run.event,
      envOverrides: run.envOverrides as Record<string, string>,
      onLine: async (line) => {
        await RunModel.updateOne({ runId: run.runId }, { $push: { streamLog: line } });
        await publishRunUpdate(run.runId, 'log');
      },
    }).then(async ({ code }) => {
      const completedAt = new Date();
      await RunModel.updateOne(
        { runId: run.runId },
        {
          $set: {
            status: code === 0 ? 'success' : 'failed',
            completedAt,
            durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
            failureReason: code === 0 ? undefined : `act process exited with ${code}`,
          },
        }
      );
      await publishRunUpdate(run.runId, 'completed');
      await publishQueueUpdate();
    });
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : 'Unknown execution error';

    logger.error({ err: error, runId: run.runId }, 'Run execution failed');

    await RunModel.updateOne(
      { runId: run.runId },
      {
        $set: {
          status: 'failed',
          completedAt,
          durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
          failureReason: message,
        },
        $push: {
          streamLog: `[error] ${message}`,
        },
      }
    );
    await publishRunUpdate(run.runId, 'failed');
    await publishQueueUpdate();
  }
}

async function tickQueue() {
  if (activeRuns >= env.MAX_CONCURRENT_RUNS) {
    return;
  }

  const run = await getNextQueuedRun();
  if (!run) {
    return;
  }

  await publishRunUpdate(run.runId, 'running');
  await publishQueueUpdate();

  activeRuns += 1;

  executeRun(run.runId)
    .catch((err) => logger.error({ err, runId: run.runId }, 'Unexpected run error'))
    .finally(() => {
      activeRuns = Math.max(0, activeRuns - 1);
    });
}

export function startRunWorker() {
  if (workerStarted) {
    return;
  }

  workerStarted = true;
  logger.info(
    {
      maxConcurrentRuns: env.MAX_CONCURRENT_RUNS,
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    },
    'Starting run queue worker'
  );

  setInterval(() => {
    void tickQueue();
  }, env.WORKER_POLL_INTERVAL_MS);
}

export async function getQueueSnapshot() {
  const [queued, running, failed, success] = await Promise.all([
    RunModel.countDocuments({ status: 'queued' }),
    RunModel.countDocuments({ status: 'running' }),
    RunModel.countDocuments({ status: 'failed' }),
    RunModel.countDocuments({ status: 'success' }),
  ]);

  return { queued, running, failed, success, maxConcurrentRuns: env.MAX_CONCURRENT_RUNS };
}
