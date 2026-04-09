import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/require-auth.js';
import { fetchAuthorizedRepos } from '../services/github.service.js';
import { RepoModel } from '../models/repo.model.js';
import { ensureRepoLocal, discoverWorkflows } from '../services/act.service.js';

const router = Router();

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

  return res.json({ count: repos.length });
});

router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const query = search
    ? {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const repos = await RepoModel.find(query).sort({ updatedAt: -1 }).lean();
  return res.json(repos);
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

export default router;
