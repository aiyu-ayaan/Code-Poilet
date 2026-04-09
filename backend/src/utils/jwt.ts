import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface SessionJwtPayload {
  sid: string;
}

export function signSessionToken(sessionId: string) {
  return jwt.sign({ sid: sessionId }, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_TTL_HOURS}h`,
    issuer: 'acthub',
    audience: 'acthub-web',
  });
}

export function verifySessionToken(token: string): SessionJwtPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'acthub',
    audience: 'acthub-web',
  }) as SessionJwtPayload;
}
