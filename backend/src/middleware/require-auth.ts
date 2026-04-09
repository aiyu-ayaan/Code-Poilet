import { Request, Response, NextFunction } from 'express';
import { SessionModel, type SessionDocument } from '../models/session.model.js';
import { verifySessionToken } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  session?: SessionDocument | null;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.acthub_session;
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = verifySessionToken(token);
    const session = await SessionModel.findOne({ sessionId: payload.sid }).lean();

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Session expired' });
    }

    req.session = session;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid session' });
  }
}
