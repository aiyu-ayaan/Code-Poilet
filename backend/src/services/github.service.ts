import { Octokit } from 'octokit';
import { env } from '../config/env.js';

const githubTokenEndpoint = 'https://github.com/login/oauth/access_token';

export interface GithubIdentity {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

export async function exchangeGithubCode(code: string) {
  const response = await fetch(githubTokenEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth token exchange failed with ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; error?: string };

  if (!data.access_token) {
    throw new Error(data.error || 'GitHub OAuth token missing in response');
  }

  return data.access_token;
}

export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function fetchGithubIdentity(token: string): Promise<GithubIdentity> {
  const octokit = getOctokit(token);
  const { data } = await octokit.request('GET /user');

  return {
    id: data.id,
    login: data.login,
    name: data.name ?? undefined,
    avatar_url: data.avatar_url,
  };
}

export async function fetchAuthorizedRepos(token: string) {
  const octokit = getOctokit(token);

  const repos = await octokit.paginate('GET /user/repos', {
    per_page: 100,
    sort: 'updated',
    affiliation: 'owner,collaborator,organization_member',
  });

  return repos.map((repo) => ({
    githubRepoId: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    permissions: {
      admin: !!repo.permissions?.admin,
      maintain: !!repo.permissions?.maintain,
      push: !!repo.permissions?.push,
      triage: !!repo.permissions?.triage,
      pull: !!repo.permissions?.pull,
    },
  }));
}
