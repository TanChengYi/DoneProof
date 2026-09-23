import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type {
  BrowserEvidenceResult,
  BrowserScenario,
  CheckDefinition,
  CriterionVerdict,
  EvidenceArtifact,
  EvidenceResult,
  ProjectRecord,
  RepositoryFingerprint,
  RunRecord
} from '../../shared/models';
import { deriveCriterionVerdict, deriveProjectVerdict } from '../domain/verdict';
import { fingerprintRepository } from '../domain/git-fingerprint';
import { runBrowserScenario, type BrowserProofContext } from './browser-proof';
import type { SafeRunner } from './runner';

export type RunEvent =
  | { type: 'run-started'; runId: string }
  | { type: 'evidence-started'; runId: string; evidenceId: string; label: string }
  | { type: 'evidence-completed'; runId: string; evidence: EvidenceResult }
  | { type: 'run-completed'; run: RunRecord };

export interface RunRequest {
  project: ProjectRecord;
  contractPath: string;
  artifactsDir: string;
}

interface RunStore {
  saveRun(run: RunRecord): Promise<void>;
}

export interface RunServiceDependencies {
  store: RunStore;
  runner: SafeRunner;
  fingerprint?: (root: string, contractPath: string) => Promise<RepositoryFingerprint>;
  browserProof?: (scenario: BrowserScenario, context: BrowserProofContext) => Promise<BrowserEvidenceResult>;
  createId?: () => string;
  now?: () => Date;
}

export interface RunService {
  execute(request: RunRequest, emit: (event: RunEvent) => void, signal?: AbortSignal): Promise<RunRecord>;
}

async function verifyArtifacts(artifacts: EvidenceArtifact[]): Promise<EvidenceArtifact[]> {
  return await Promise.all(artifacts.map(async (artifact) => {
    try {
      const content = await readFile(artifact.path);
      const actual = createHash('sha256').update(content).digest('hex');
      return { ...artifact, integrity: actual === artifact.sha256 ? 'verified' as const : 'mismatch' as const };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...artifact, integrity: 'missing' as const };
      throw error;
    }
  }));
}

function commandSpec(check: CheckDefinition, root: string) {
  return {
    id: check.id,
    executable: check.executable,
    args: check.args,
    cwd: root,
    timeoutMs: check.timeoutMs,
    maxOutputBytes: check.maxOutputBytes
  };
}

function computeVerdicts(project: ProjectRecord, evidence: EvidenceResult[]): {
  criteria: CriterionVerdict[];
  verdict: RunRecord['verdict'];
} {
  const criteria = project.contract.criteria.map((criterion) => deriveCriterionVerdict(criterion, evidence));
  const required = criteria.map((result) => ({
    criterionId: result.criterionId,
    verdict: result.verdict,
    required: project.contract.criteria.find((item) => item.id === result.criterionId)?.required ?? false
  }));
  return { criteria, verdict: deriveProjectVerdict(required) };
}

export function createRunService(dependencies: RunServiceDependencies): RunService {
  const fingerprint = dependencies.fingerprint ?? fingerprintRepository;
  const browserProof = dependencies.browserProof ?? runBrowserScenario;
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());

  return {
    async execute(request, emit, signal) {
      const startedAt = now().toISOString();
      const initialVerdicts = computeVerdicts(request.project, []);
      const run: RunRecord = {
        id: createId(),
        projectId: request.project.id,
        status: 'running',
        startedAt,
        fingerprint: await fingerprint(request.project.root, request.contractPath),
        contract: structuredClone(request.project.contract),
        evidence: [],
        criteria: initialVerdicts.criteria,
        verdict: initialVerdicts.verdict
      };
      await dependencies.store.saveRun(run);
      emit({ type: 'run-started', runId: run.id });

      const recordEvidence = async (item: EvidenceResult) => {
        run.evidence.push(item);
        const derived = computeVerdicts(request.project, run.evidence);
        run.criteria = derived.criteria;
        run.verdict = derived.verdict;
        await dependencies.store.saveRun(run);
        emit({ type: 'evidence-completed', runId: run.id, evidence: structuredClone(item) });
      };

      for (const check of request.project.contract.checks) {
        if (signal?.aborted) break;
        emit({ type: 'evidence-started', runId: run.id, evidenceId: check.id, label: check.label });
        const itemStarted = now().toISOString();
        const result = await dependencies.runner.run(commandSpec(check, request.project.root), {}, signal);
        await recordEvidence({
          id: check.id,
          label: check.label,
          kind: 'command',
          criterionIds: request.project.contract.criteria.filter((item) => item.evidenceIds.includes(check.id)).map((item) => item.id),
          status: result.status,
          startedAt: itemStarted,
          completedAt: now().toISOString(),
          durationMs: result.durationMs,
          output: result.output,
          ...(result.reason ? { reason: result.reason } : {}),
          artifacts: []
        });
      }

      for (const scenario of request.project.contract.scenarios) {
        if (signal?.aborted) break;
        emit({ type: 'evidence-started', runId: run.id, evidenceId: scenario.id, label: scenario.name });
        const itemStarted = now().toISOString();
        const startCheck = scenario.startCheckId
          ? request.project.contract.checks.find((check) => check.id === scenario.startCheckId)
          : undefined;
        const result = await browserProof(scenario, {
          projectRoot: request.project.root,
          artifactsDir: request.artifactsDir,
          runner: dependencies.runner,
          ...(startCheck ? { startCommand: commandSpec(startCheck, request.project.root) } : {}),
          ...(signal ? { signal } : {})
        });
        await recordEvidence({
          id: scenario.id,
          label: scenario.name,
          kind: 'browser',
          criterionIds: scenario.criterionIds,
          status: result.status,
          startedAt: itemStarted,
          completedAt: now().toISOString(),
          durationMs: result.durationMs,
          ...(result.reason ? { reason: result.reason } : {}),
          artifacts: await verifyArtifacts(result.screenshots)
        });
      }

      run.status = signal?.aborted ? 'cancelled' : 'completed';
      run.completedAt = now().toISOString();
      const finalVerdicts = computeVerdicts(request.project, run.evidence);
      run.criteria = finalVerdicts.criteria;
      run.verdict = finalVerdicts.verdict;
      await dependencies.store.saveRun(run);
      emit({ type: 'run-completed', run: structuredClone(run) });
      return structuredClone(run);
    }
  };
}
