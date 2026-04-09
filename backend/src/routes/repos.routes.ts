import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/require-auth.js';
import { fetchAuthorizedRepos } from '../services/github.service.js';
import { RepoModel } from '../models/repo.model.js';
import { RunModel } from '../models/run.model.js';
import { EnvProfileModel } from '../models/env-profile.model.js';
import { ensureRepoLocal, discoverWorkflows } from '../services/act.service.js';
import { cacheDelete, cacheGet, cacheSet } from '../config/cache.js';
import { decryptJson, encryptJson } from '../utils/crypto.js';

const router = Router();
const repoCacheKey = 'repos:list';

const envProfileSchema = z.object({
  workflowFile: z.string().min(1),
  label: z.string().default('default'),
  vars: z.record(z.string(), z.string()),
});

router.use(requireAuth);

router.post('/sync', async (req: AuthenticatedRequest, res) => {
  const session = req.session;
  if (!session) {
    return res.status(401).json({ message: 'Session required' });
  }

  const repos = await fetchAuthorizedRepos(session.githubToken);

  await Promise.all(
    repos.map((repo) =>
      RepoModel.updateOne(
        { githubRepoId: repo.githubRepoId },
        {
          $set: {
            ...repo,
            lastSyncedAt: new Date(),
          },
        },
        { upsert: true }
      )
    )
  );

  await cacheDelete(repoCacheKey);

  return res.json({ count: repos.length });
});

router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (!search) {
    const cached = await cacheGet<unknown[]>(repoCacheKey);
    if (cached) {
      return res.json(cached);
    }
  }

  const query = search
    ? {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const repos = await RepoModel.find(query).sort({ githubUpdatedAt: -1, updatedAt: -1 }).lean();

  const latestRuns = await RunModel.aggregate<{
    _id: number;
    status: string;
    completedAt?: Date;
    startedAt?: Date;
  }>([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$githubRepoId',
        status: { $first: '$status' },
        completedAt: { $first: '$completedAt' },
        startedAt: { $first: '$startedAt' },
      },
    },
  ]);

  const latestRunMap = new Map(latestRuns.map((item) => [item._id, item]));

  const payload = repos.map((repo) => {
    const latest = latestRunMap.get(repo.githubRepoId);
    return {
      ...repo,
      status: latest?.status || 'idle',
      lastRunAt: latest?.completedAt || latest?.startedAt || undefined,
    };
  });

  if (!search) {
    await cacheSet(repoCacheKey, payload, 120);
  }

  return res.json(payload);
});

router.get('/:owner/:name/workflows', async (req: AuthenticatedRequest, res) => {
  const session = req.session;
  if (!session) {
    return res.status(401).json({ message: 'Session required' });
  }

  const fullRepoName = `${req.params.owner}/${req.params.name}`;
  const repo = await RepoModel.findOne({ fullName: fullRepoName }).lean();

  if (!repo) {
    return res.status(404).json({ message: 'Repository not synced yet' });
  }

  const repoPath = await ensureRepoLocal(repo.fullName, session.githubToken, repo.defaultBranch);
  const workflows = await discoverWorkflows(repoPath);

  await RepoModel.updateOne({ githubRepoId: repo.githubRepoId }, { $set: { workflowCount: workflows.length } });

  return res.json({ repo: repo.fullName, workflows });
});

router.get('/:owner/:name/workflows/:file/content', async (req: AuthenticatedRequest, res) => {
  const session = req.session;
  if (!session) {
    return res.status(401).json({ message: 'Session required' });
  }

  const fullRepoName = `${req.params.owner}/${req.params.name}`;
  const repo = await RepoModel.findOne({ fullName: fullRepoName }).lean();

  if (!repo) {
    return res.status(404).json({ message: 'Repository not found' });
  }

  const repoPath = await ensureRepoLocal(repo.fullName, session.githubToken, repo.defaultBranch);
  const fileName = String(req.params.file ?? '');
  if (!fileName) {
    return res.status(400).json({ message: 'Workflow file is required' });
  }
  const filePath = path.join(repoPath, '.github', 'workflows', fileName);

  const safeRoot = path.join(repoPath, '.github', 'workflows');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(safeRoot))) {
    return res.status(400).json({ message: 'Invalid workflow file path' });
  }

  const content = await fs.readFile(filePath, 'utf8');
  return res.json({ fileName, content });
});

router.get('/:owner/:name/env-profile', async (req, res) => {
  const fullRepoName = `${req.params.owner}/${req.params.name}`;
  const workflowFile = String(req.query.workflowFile ?? '');
  const label = String(req.query.label ?? 'default');

  if (!workflowFile) {
    return res.status(400).json({ message: 'workflowFile query is required' });
  }

  const repo = await RepoModel.findOne({ fullName: fullRepoName }).lean();
  if (!repo) {
    return res.status(404).json({ message: 'Repository not found' });
  }

  const profile = await EnvProfileModel.findOne({
    githubRepoId: repo.githubRepoId,
    workflowFile,
    label,
  }).lean();

  if (!profile) {
    return res.json({ vars: {}, label, exists: false });
  }

  const vars = decryptJson<Record<string, string>>({
    cipherText: profile.cipherText,
    iv: profile.iv,
    authTag: profile.authTag,
  });

  return res.json({ vars, label, exists: true, updatedAt: profile.updatedAt, updatedBy: profile.updatedBy });
});

router.post('/:owner/:name/env-profile', async (req: AuthenticatedRequest, res) => {
  const session = req.session;
  if (!session) {
    return res.status(401).json({ message: 'Session required' });
  }

  const parsed = envProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  }

  const fullRepoName = `${req.params.owner}/${req.params.name}`;
  const repo = await RepoModel.findOne({ fullName: fullRepoName }).lean();
  if (!repo) {
    return res.status(404).json({ message: 'Repository not found' });
  }

  const encrypted = encryptJson(parsed.data.vars);

  await EnvProfileModel.updateOne(
    {
      githubRepoId: repo.githubRepoId,
      workflowFile: parsed.data.workflowFile,
      label: parsed.data.label,
    },
    {
      $set: {
        ...encrypted,
        updatedAt: new Date(),
        updatedBy: session.username,
      },
    },
    { upsert: true }
  );

  return res.status(200).json({ saved: true });
});

export default router;
