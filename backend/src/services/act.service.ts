import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

function runCommand(command: string, args: string[], cwd?: string, extraEnv?: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function ensureRepoLocal(repoFullName: string, token: string, branch: string) {
  const repoPath = path.resolve(env.REPOS_ROOT, repoFullName);
  await fs.mkdir(path.dirname(repoPath), { recursive: true });

  try {
    await fs.access(path.join(repoPath, '.git'));
  } catch {
    const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;
    await runCommand('git', ['clone', cloneUrl, repoPath]);
  }

  await runCommand('git', ['fetch', '--all', '--prune'], repoPath);
  await runCommand('git', ['checkout', branch], repoPath).catch(async () => {
    await runCommand('git', ['checkout', '-b', branch, `origin/${branch}`], repoPath);
  });
  await runCommand('git', ['reset', '--hard', `origin/${branch}`], repoPath);

  return repoPath;
}

export interface WorkflowDescriptor {
  name: string;
  fileName: string;
  path: string;
  hasWorkflowDispatch: boolean;
  inputs: string[];
}

export async function discoverWorkflows(repoPath: string): Promise<WorkflowDescriptor[]> {
  const workflowRoot = path.join(repoPath, '.github', 'workflows');

  try {
    const files = await fs.readdir(workflowRoot);
    const targetFiles = files.filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));

    const workflows: WorkflowDescriptor[] = [];

    for (const fileName of targetFiles) {
      const fullPath = path.join(workflowRoot, fileName);
      const content = await fs.readFile(fullPath, 'utf8');
      const parsed = yaml.load(content) as Record<string, unknown> | undefined;
      const workflowName = typeof parsed?.name === 'string' ? parsed.name : fileName;
      const onValue = parsed?.on as Record<string, unknown> | string[] | string | undefined;

      let hasDispatch = false;
      let inputs: string[] = [];

      if (typeof onValue === 'object' && onValue !== null && !Array.isArray(onValue)) {
        if ('workflow_dispatch' in onValue) {
          hasDispatch = true;
          const dispatch = onValue.workflow_dispatch;
          if (typeof dispatch === 'object' && dispatch !== null && 'inputs' in dispatch) {
            const dispatchInputs = (dispatch as { inputs?: Record<string, unknown> }).inputs;
            if (dispatchInputs && typeof dispatchInputs === 'object') {
              inputs = Object.keys(dispatchInputs);
            }
          }
        }
      } else if (Array.isArray(onValue)) {
        hasDispatch = onValue.includes('workflow_dispatch');
      } else if (typeof onValue === 'string') {
        hasDispatch = onValue === 'workflow_dispatch';
      }

      workflows.push({
        name: workflowName,
        fileName,
        path: `.github/workflows/${fileName}`,
        hasWorkflowDispatch: hasDispatch,
        inputs,
      });
    }

    return workflows;
  } catch {
    return [];
  }
}

export interface ActRunOptions {
  repoPath: string;
  workflowFile: string;
  event: 'push' | 'workflow_dispatch';
  envOverrides: Record<string, string>;
  onLine: (line: string) => void;
}

export async function runAct(options: ActRunOptions) {
  const args = [
    options.event,
    '-W',
    options.workflowFile,
    '--container-architecture',
    'linux/amd64',
    '--pull=false',
  ];

  logger.info({ args, repoPath: options.repoPath }, 'Starting act run');

  return new Promise<{ code: number }>((resolve, reject) => {
    const child = spawn(env.ACT_BINARY, args, {
      cwd: options.repoPath,
      env: {
        ...process.env,
        ...options.envOverrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line: string) => options.onLine(line));
    });

    child.stderr.on('data', (chunk) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line: string) => options.onLine(`[stderr] ${line}`));
    });

    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1 }));
  });
}
