import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { encodeOAuthState, decodeOAuthState } from '../utils/oauth-state.js';
import { exchangeGithubCode, fetchGithubIdentity } from '../services/github.service.js';
import { SessionModel } from '../models/session.model.js';
import { signSessionToken, verifySessionToken } from '../utils/jwt.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/require-auth.js';

const router = Router();

router.get('/github/start', (req, res) => {
  const redirectPath = typeof req.query.redirect === 'string' ? req.query.redirect : '/dashboard';
  const state = encodeOAuthState(redirectPath);

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL);
  authorizeUrl.searchParams.set('scope', 'read:user user:email repo workflow');
  authorizeUrl.searchParams.set('state', state);

  return res.redirect(authorizeUrl.toString());
});

router.get('/github/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const parsedState = decodeOAuthState(state);

  if (!code || !parsedState) {
    return res.status(400).json({ message: 'Invalid OAuth callback request' });
  }

  const token = await exchangeGithubCode(code);
  const identity = await fetchGithubIdentity(token);

  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  const session = await SessionModel.create({
    sessionId: crypto.randomUUID(),
    githubToken: token,
    githubUserId: identity.id,
    username: identity.login,
    name: identity.name,
    avatarUrl: identity.avatar_url,
    expiresAt,
  });

  const signed = signSessionToken(session.sessionId);

  res.cookie('acthub_session', signed, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  });

  const appRedirect = new URL(parsedState.redirectPath, env.APP_ORIGIN);
  return res.redirect(appRedirect.toString());
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const session = req.session;
  if (!session) {
    return res.status(401).json({ message: 'Session not found' });
  }

  return res.json({
    id: session.githubUserId,
    username: session.username,
    name: session.name ?? session.username,
    avatarUrl: session.avatarUrl,
    expiresAt: session.expiresAt,
  });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.acthub_session;

  if (token) {
    try {
      const payload = verifySessionToken(token);
      await SessionModel.deleteOne({ sessionId: payload.sid });
    } catch {
      // noop
    }
  }

  res.clearCookie('acthub_session');
  return res.status(204).send();
});

export default router;
