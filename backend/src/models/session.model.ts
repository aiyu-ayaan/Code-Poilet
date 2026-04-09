import { Schema, model } from 'mongoose';

export interface SessionDocument {
  sessionId: string;
  githubToken: string;
  githubUserId: number;
  username: string;
  avatarUrl?: string;
  name?: string;
  createdAt: Date;
  expiresAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    githubToken: { type: String, required: true },
    githubUserId: { type: Number, required: true, index: true },
    username: { type: String, required: true },
    avatarUrl: { type: String },
    name: { type: String },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionDocument>('Session', sessionSchema);
