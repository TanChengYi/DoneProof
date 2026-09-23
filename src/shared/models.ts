export type Verdict = 'proven' | 'failed' | 'unproven';
export type EvidenceStatus = 'passed' | 'failed' | 'unproven';

export interface Criterion {
  id: string;
  text: string;
  required: boolean;
  evidenceIds: string[];
}

export interface CheckDefinition {
  id: string;
  label: string;
  executable: string;
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
}

export type BrowserStep =
  | { id: string; type: 'visit'; path: string }
  | { id: string; type: 'click'; selector: string }
  | { id: string; type: 'fill'; selector: string; value: string }
  | { id: string; type: 'press'; selector: string; key: string }
  | { id: string; type: 'assertText'; selector: string; text: string }
  | { id: string; type: 'assertVisible'; selector: string }
  | { id: string; type: 'assertUrl'; value: string }
  | { id: string; type: 'screenshot'; name: string; fullPage: boolean };

export interface BrowserScenario {
  id: string;
  name: string;
  baseUrl: string;
  readinessUrl?: string;
  timeoutMs: number;
  startCheckId?: string;
  criterionIds: string[];
  steps: BrowserStep[];
}

export interface ProofContract {
  version: 1;
  goal: string;
  criteria: Criterion[];
  checks: CheckDefinition[];
  scenarios: BrowserScenario[];
}

export interface RepositoryFingerprint {
  versioned: boolean;
  branch: string | null;
  head: string | null;
  diffHash: string;
  contractHash: string | null;
}

export interface EvidenceArtifact {
  path: string;
  sha256: string;
  mediaType: string;
}

export interface EvidenceResult {
  id: string;
  label: string;
  kind: 'command' | 'browser';
  criterionIds: string[];
  status: EvidenceStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: string;
  reason?: string;
  artifacts: EvidenceArtifact[];
}

export interface CriterionVerdict {
  criterionId: string;
  verdict: Verdict;
  reason: string;
  evidenceIds: string[];
}

export interface RunRecord {
  id: string;
  projectId: string;
  status: 'running' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  fingerprint: RepositoryFingerprint;
  contract: ProofContract;
  evidence: EvidenceResult[];
  criteria: CriterionVerdict[];
  verdict: Verdict;
}

export interface ProjectRecord {
  id: string;
  name: string;
  root: string;
  createdAt: string;
  updatedAt: string;
  contract: ProofContract;
}
