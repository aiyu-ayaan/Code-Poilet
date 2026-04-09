import { Schema, model } from 'mongoose';

export interface RepoDocument {
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  workflowCount: number;
  lastSyncedAt: Date;
}

const repoSchema = new Schema<RepoDocument>(
  {
    githubRepoId: { type: Number, required: true, unique: true, index: true },
    owner: { type: String, required: true, index: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true, index: true },
    private: { type: Boolean, required: true },
    defaultBranch: { type: String, required: true },
    permissions: {
      admin: { type: Boolean, default: false },
      maintain: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      triage: { type: Boolean, default: false },
      pull: { type: Boolean, default: false },
    },
    workflowCount: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

export const RepoModel = model<RepoDocument>('Repository', repoSchema);
