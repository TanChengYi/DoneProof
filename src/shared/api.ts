import type { ProjectRecord, ProofContract, RunRecord } from './models';

export type RunEvent =
  | { type: 'run-started'; runId: string }
  | { type: 'evidence-started'; runId: string; evidenceId: string; label: string }
  | { type: 'evidence-completed'; runId: string; evidence: RunRecord['evidence'][number] }
  | { type: 'run-completed'; run: RunRecord }
  | { type: 'run-failed'; runId: string; message: string };

export interface DoneProofApi {
  listProjects(): Promise<ProjectRecord[]>;
  chooseProject(): Promise<ProjectRecord | null>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  saveContract(projectId: string, contract: ProofContract): Promise<ProjectRecord>;
  startRun(projectId: string): Promise<{ runId: string }>;
  cancelRun(runId: string): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  exportReceipt(runId: string): Promise<{ htmlPath: string; markdownPath: string } | null>;
  onRunEvent(listener: (event: RunEvent) => void): () => void;
}
