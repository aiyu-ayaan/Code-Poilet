import { Schema, model } from 'mongoose';

export interface EnvProfileDocument {
  githubRepoId: number;
  workflowFile: string;
  label: string;
  cipherText: string;
  iv: string;
  authTag: string;
  updatedBy: string;
  updatedAt: Date;
}

const envProfileSchema = new Schema<EnvProfileDocument>(
  {
    githubRepoId: { type: Number, required: true, index: true },
    workflowFile: { type: String, required: true, index: true },
    label: { type: String, required: true, default: 'default' },
    cipherText: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    timestamps: false,
  }
);

envProfileSchema.index({ githubRepoId: 1, workflowFile: 1, label: 1 }, { unique: true });

export const EnvProfileModel = model<EnvProfileDocument>('EnvProfile', envProfileSchema);
