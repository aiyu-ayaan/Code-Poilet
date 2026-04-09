import type { User, Repository, Workflow, WorkflowRun, RunLog } from '../types';

export const mockUser: User = {
  id: '1',
  name: 'Developer',
  email: 'dev@example.com',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
};

const sampleWorkflowContent = `name: CI Pipeline

on:
  push:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  NODE_VERSION: '18.x'
  BUILD_DIR: 'dist'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-files
          path: \${{ env.BUILD_DIR }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to \${{ github.event.inputs.environment || 'staging' }}
        run: echo "Deploying to \${{ github.event.inputs.environment || 'staging' }}"`;

export const mockLogs: RunLog[] = [
  {
    stepName: 'Set up job',
    status: 'success',
    startedAt: '2024-01-15T10:00:00Z',
    completedAt: '2024-01-15T10:00:02Z',
    output: ['Current runner version: 2.311.0', 'Operating System', 'Runner Image', 'GITHUB_TOKEN Permissions'],
  },
  {
    stepName: 'Checkout code',
    status: 'success',
    startedAt: '2024-01-15T10:00:03Z',
    completedAt: '2024-01-15T10:00:05Z',
    output: ['Syncing repository: myorg/myrepo', 'Getting Git version info', 'Cleaning up orphan processes'],
  },
  {
    stepName: 'Setup Node.js',
    status: 'success',
    startedAt: '2024-01-15T10:00:06Z',
    completedAt: '2024-01-15T10:00:12Z',
    output: ['Found in cache @ /opt/hostedtoolcache/node/18.19.0/x64', 'Added Node.js to PATH', 'Node.js version: v18.19.0'],
  },
  {
    stepName: 'Install dependencies',
    status: 'success',
    startedAt: '2024-01-15T10:00:13Z',
    completedAt: '2024-01-15T10:00:28Z',
    output: ['npm ci', 'added 1534 packages in 14s', 'npm audit: found 0 vulnerabilities'],
  },
  {
    stepName: 'Run tests',
    status: 'failed',
    startedAt: '2024-01-15T10:00:29Z',
    completedAt: '2024-01-15T10:00:45Z',
    output: [
      '> myapp@1.0.0 test',
      '> jest',
      '',
      'FAIL src/components/Button.test.tsx',
      '  Button',
      '    \u2715 renders correctly (23ms)',
      '      Error: expect(received).toBe(expected)',
      '      Expected: "Submit"',
      '      Received: "Submitting"',
      '',
      'Test Suites: 1 failed, 3 passed, 4 total',
      'Tests:       1 failed, 12 passed, 13 total',
      'npm ERR! code ELIFECYCLE',
    ],
  },
  {
    stepName: 'Build',
    status: 'pending',
    startedAt: undefined,
    completedAt: undefined,
    output: [],
  },
];

const createMockRuns = (workflowId: string): WorkflowRun[] => [
  {
    id: `${workflowId}-run-1`,
    workflowId,
    runNumber: 1,
    status: 'failed',
    branch: 'main',
    event: 'push',
    triggeredBy: 'Developer',
    startedAt: '2024-01-15T10:00:00Z',
    completedAt: '2024-01-15T10:00:45Z',
    duration: 45,
    logs: mockLogs,
    envVars: { NODE_VERSION: '18.x', ENV: 'production' },
  },
  {
    id: `${workflowId}-run-2`,
    workflowId,
    runNumber: 2,
    status: 'success',
    branch: 'main',
    event: 'push',
    triggeredBy: 'Developer',
    startedAt: '2024-01-15T09:30:00Z',
    completedAt: '2024-01-15T09:31:12Z',
    duration: 72,
    logs: mockLogs.map(l => ({ ...l, status: 'success' as const })),
    envVars: { NODE_VERSION: '18.x', ENV: 'production' },
  },
  {
    id: `${workflowId}-run-3`,
    workflowId,
    runNumber: 3,
    status: 'success',
    branch: 'develop',
    event: 'push',
    triggeredBy: 'Developer',
    startedAt: '2024-01-15T08:15:00Z',
    completedAt: '2024-01-15T08:16:30Z',
    duration: 90,
    logs: mockLogs.map(l => ({ ...l, status: 'success' as const })),
    envVars: { NODE_VERSION: '18.x', ENV: 'staging' },
  },
];

const createMockWorkflows = (repoId: string): Workflow[] => [
  {
    id: `${repoId}-workflow-1`,
    name: 'CI Pipeline',
    fileName: 'ci.yml',
    content: sampleWorkflowContent,
    status: 'failed',
    runs: createMockRuns(`${repoId}-workflow-1`),
  },
  {
    id: `${repoId}-workflow-2`,
    name: 'Deploy to Production',
    fileName: 'deploy.yml',
    content: `name: Deploy to Production

on:
  workflow_dispatch:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "Deploying..."`,
    status: 'success',
    runs: createMockRuns(`${repoId}-workflow-2`),
  },
  {
    id: `${repoId}-workflow-3`,
    name: 'Nightly Tests',
    fileName: 'nightly.yml',
    content: `name: Nightly Tests

on:
  schedule:
    - cron: '0 2 * * *'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test`,
    status: 'idle',
    runs: [],
  },
];

export const mockRepositories: Repository[] = [
  {
    id: 'repo-1',
    name: 'web-app',
    owner: 'myorg',
    fullName: 'myorg/web-app',
    description: 'Main web application',
    status: 'failed',
    lastRunAt: '2024-01-15T10:00:45Z',
    defaultBranch: 'main',
    workflows: createMockWorkflows('repo-1'),
  },
  {
    id: 'repo-2',
    name: 'api-service',
    owner: 'myorg',
    fullName: 'myorg/api-service',
    description: 'REST API service',
    status: 'success',
    lastRunAt: '2024-01-15T09:31:12Z',
    defaultBranch: 'main',
    workflows: createMockWorkflows('repo-2'),
  },
  {
    id: 'repo-3',
    name: 'mobile-app',
    owner: 'myorg',
    fullName: 'myorg/mobile-app',
    description: 'React Native mobile app',
    status: 'running',
    lastRunAt: '2024-01-15T10:05:00Z',
    defaultBranch: 'develop',
    workflows: createMockWorkflows('repo-3'),
  },
  {
    id: 'repo-4',
    name: 'docs-site',
    owner: 'myorg',
    fullName: 'myorg/docs-site',
    description: 'Documentation website',
    status: 'idle',
    defaultBranch: 'main',
    workflows: createMockWorkflows('repo-4'),
  },
];
