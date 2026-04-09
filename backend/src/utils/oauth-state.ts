import crypto from 'node:crypto';

interface OAuthState {
  nonce: string;
  redirectPath: string;
}

export function encodeOAuthState(redirectPath: string) {
  const payload: OAuthState = {
    nonce: crypto.randomBytes(10).toString('hex'),
    redirectPath,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeOAuthState(state: string): OAuthState | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const data = JSON.parse(decoded) as OAuthState;
    if (!data.redirectPath || typeof data.redirectPath !== 'string') {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
