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
      try {
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
      } catch (error) {
        logger.warn({ err: error, fileName, repoPath }, 'Could not fully parse workflow file, using fallback metadata');
        workflows.push({
          name: fileName,
          fileName,
          path: `.github/workflows/${fileName}`,
          hasWorkflowDispatch: false,
          inputs: [],
        });
      }
    }

    return workflows.sort((left, right) => left.fileName.localeCompare(right.fileName));
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

interface SpawnSpec {
  command: string;
  args: string[];
  cwd: string;
  envVars: Record<string, string>;
}

function toPosixPath(value: string) {
  return value.replace(/\\/g, '/');
}

function toWslPath(value: string) {
  const normalized = toPosixPath(value);
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!driveMatch) {
    return normalized;
  }

  const driveLetter = driveMatch[1];
  const rest = driveMatch[2];
  if (!driveLetter || rest === undefined) {
    return normalized;
  }

  const drive = driveLetter.toLowerCase();
  return `/mnt/${drive}/${rest}`;
}

function buildComposeActCommand(options: ActRunOptions, args: string[]): SpawnSpec {
  const reposRoot = path.resolve(env.REPOS_ROOT);
  const relativeRepoPath = path.relative(reposRoot, path.resolve(options.repoPath));

  if (relativeRepoPath.startsWith('..')) {
    throw new Error(`Repository path ${options.repoPath} is outside REPOS_ROOT ${reposRoot}`);
  }

  const containerRepoPath = path.posix.join(
    toPosixPath(env.ACT_CONTAINER_REPOS_ROOT),
    toPosixPath(relativeRepoPath)
  );

  const composeArgs = [
    'compose',
    '-f',
    env.ACT_COMPOSE_FILE,
    'run',
    '--rm',
    '-T',
    '-w',
    containerRepoPath,
    ...Object.entries(options.envOverrides).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    env.ACT_COMPOSE_SERVICE,
    ...args,
  ];

  if (process.platform === 'win32' && env.ACT_DOCKER_HOST === 'wsl') {
    return {
      command: 'wsl',
      args: ['--cd', toWslPath(process.cwd()), '--exec', env.ACT_DOCKER_BINARY, ...composeArgs],
      cwd: process.cwd(),
      envVars: {
        ...process.env,
        COMPOSE_DISABLE_ENV_FILE: '1',
        COMPOSE_IGNORE_ORPHANS: '1',
        COMPOSE_PROJECT_NAME: 'acthub-runner',
      } as Record<string, string>,
    };
  }

  return {
    command: env.ACT_DOCKER_BINARY,
    args: composeArgs,
    cwd: process.cwd(),
    envVars: {
      ...process.env,
      COMPOSE_DISABLE_ENV_FILE: '1',
      COMPOSE_IGNORE_ORPHANS: '1',
      COMPOSE_PROJECT_NAME: 'acthub-runner',
    } as Record<string, string>,
  };
}

function buildBinaryActCommand(options: ActRunOptions, args: string[]): SpawnSpec {
  return {
    command: env.ACT_BINARY,
    args,
    cwd: options.repoPath,
    envVars: {
      ...process.env,
      ...options.envOverrides,
    } as Record<string, string>,
  };
}

function buildActSpawnSpec(options: ActRunOptions, args: string[]): SpawnSpec {
  if (env.ACT_RUNNER_MODE === 'compose') {
    return buildComposeActCommand(options, args);
  }

  return buildBinaryActCommand(options, args);
}

function formatActNotFoundError(originalError: unknown) {
  const baseMessage = originalError instanceof Error ? originalError.message : 'act runner not found';
  if (env.ACT_RUNNER_MODE === 'compose') {
    const hostHint =
      process.platform === 'win32'
        ? ` If Docker is only available in WSL, set ACT_DOCKER_HOST=wsl in .env. Otherwise ensure ${env.ACT_DOCKER_BINARY} is installed and available in PATH.`
        : ` Ensure ${env.ACT_DOCKER_BINARY} is installed and available in PATH.`;

    return new Error(
      `${baseMessage}. Docker Compose runner mode is enabled, so make sure Docker is running and start the act service with "docker compose -f ${env.ACT_COMPOSE_FILE} up -d ${env.ACT_COMPOSE_SERVICE}".${hostHint}`
    );
  }

  return new Error(
    `${baseMessage}. Either install "act" on this machine and keep ACT_RUNNER_MODE=binary, or switch to Docker Compose mode with ACT_RUNNER_MODE=compose.`
  );
}

export async function runAct(options: ActRunOptions) {
  const args = [
    options.event,
    '-W',
    options.workflowFile,
    '-P',
    'ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest',
    '-P',
    'ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04',
    '-P',
    'ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04',
    '-P',
    'ubuntu-18.04=ghcr.io/catthehacker/ubuntu:act-18.04',
    '--container-architecture',
    'linux/amd64',
    '--pull=false',
    ...(env.ACT_OFFLINE_MODE ? ['--action-offline-mode'] : []),
    ...(env.ACT_REUSE_CONTAINERS ? ['--reuse'] : []),
  ];

  const spawnSpec = buildActSpawnSpec(options, args);

  logger.info(
    {
      args: spawnSpec.args,
      command: spawnSpec.command,
      repoPath: options.repoPath,
      runnerMode: env.ACT_RUNNER_MODE,
    },
    'Starting act run'
  );

  return new Promise<{ code: number }>((resolve, reject) => {
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: spawnSpec.cwd,
      env: spawnSpec.envVars,
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

    child.on('error', (error) => reject(formatActNotFoundError(error)));
    child.on('close', (code) => resolve({ code: code ?? 1 }));
  });
}
