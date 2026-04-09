import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/require-auth.js';
import { RepoModel } from '../models/repo.model.js';
import { RunModel } from '../models/run.model.js';
import { queueRun, getQueueSnapshot } from '../services/run-queue.service.js';

const triggerSchema = z.object({
  branch: z.string().min(1),
  workflowFile: z.string().min(1),
  workflowName: z.string().optional(),
  event: z.enum(['push', 'workflow_dispatch']).default('workflow_dispatch'),
  envOverrides: z.record(z.string(), z.string()).optional(),
});

const router = Router();
router.use(requireAuth);

router.post('/trigger/:owner/:name', async (req: AuthenticatedRequest, res) => {
  const session = req.session;
  if (!session) {
    return res.status(401).json({ message: 'Session required' });
  }

  const payload = triggerSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ message: 'Invalid trigger payload', errors: payload.error.flatten() });
  }

  const fullName = `${req.params.owner}/${req.params.name}`;
  const repo = await RepoModel.findOne({ fullName }).lean();

  if (!repo) {
    return res.status(404).json({ message: 'Repository not found. Run sync first.' });
  }

  if (!repo.permissions.push) {
    return res.status(403).json({ message: 'Missing write permission on this repository.' });
  }

  const result = await queueRun({
    actorGithubUserId: session.githubUserId,
    githubRepoId: repo.githubRepoId,
    fullRepoName: repo.fullName,
    workflowFile: payload.data.workflowFile,
    workflowName: payload.data.workflowName,
    branch: payload.data.branch,
    event: payload.data.event,
    envOverrides: payload.data.envOverrides,
    triggeredBy: session.username,
  });

  if (!result.queued) {
    return res.status(409).json({ message: result.reason, run: result.run });
  }

  return res.status(202).json({ queued: true, run: result.run });
});

router.get('/history', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
  const workflowFile = typeof req.query.workflowFile === 'string' ? req.query.workflowFile : '';

  const query: Record<string, unknown> = {};
  if (repo) {
    query.fullRepoName = repo;
  }
  if (workflowFile) {
    query.workflowFile = workflowFile;
  }

  const runs = await RunModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  return res.json(runs);
});

router.get('/status/queue', async (_req, res) => {
  const snapshot = await getQueueSnapshot();
  return res.json(snapshot);
});

router.get('/:runId', async (req, res) => {
  const run = await RunModel.findOne({ runId: req.params.runId }).lean();
  if (!run) {
    return res.status(404).json({ message: 'Run not found' });
  }

  return res.json(run);
});

export default router;
