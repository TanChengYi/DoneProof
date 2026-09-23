import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserEvidenceResult, ProjectRecord, RunRecord } from '../../shared/models';
import type { CommandResult, SafeRunner } from './runner';
import { createRunService } from './run-service';
import type { RunEvent } from '../../shared/api';

let root: string;
let artifactsDir: string;

const commandResult = (status: CommandResult['status']): CommandResult => ({
  status,
  exitCode: status === 'passed' ? 0 : status === 'failed' ? 1 : null,
  durationMs: 10,
  output: `${status}\n`,
  truncated: false
});

function project(): ProjectRecord {
  return {
    id: 'project-1', name: 'Fixture', root, createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z',
    contract: {
      version: 1,
      goal: 'Ship verified software',
      criteria: [{ id: 'quality', text: 'Checks pass', required: true, evidenceIds: ['lint', 'test'] }],
      checks: [
        { id: 'lint', label: 'Lint', executable: 'npm', args: ['run', 'lint'], timeoutMs: 5_000, maxOutputBytes: 10_000 },
        { id: 'test', label: 'Test', executable: 'npm', args: ['test'], timeoutMs: 5_000, maxOutputBytes: 10_000 }
      ],
      scenarios: []
    }
  };
}

function deps(results: CommandResult[], saved: RunRecord[]) {
  const run = vi.fn<SafeRunner['run']>();
  for (const result of results) run.mockResolvedValueOnce(result);
  return {
    runner: { run } satisfies SafeRunner,
    store: { saveRun: vi.fn(async (record: RunRecord) => { saved.push(structuredClone(record)); }) },
    fingerprint: vi.fn(async () => ({ versioned: true, branch: 'main', head: 'abc', diffHash: 'diff', contractHash: 'contract' })),
    browserProof: vi.fn(async (): Promise<BrowserEvidenceResult> => ({ status: 'passed', durationMs: 1, steps: [], screenshots: [] })),
    createId: () => 'run-1',
    now: () => new Date('2026-09-23T00:00:00.000Z')
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'doneproof-run-'));
  artifactsDir = join(root, 'artifacts');
  await mkdir(artifactsDir);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('run service', () => {
  it('persists the manifest and every result while continuing after an independent failure', async () => {
    const saved: RunRecord[] = [];
    const dependencies = deps([commandResult('failed'), commandResult('passed')], saved);
    const events: RunEvent[] = [];
    const service = createRunService(dependencies);

    const result = await service.execute(
      { project: project(), contractPath: join(root, 'doneproof.yml'), artifactsDir },
      (event) => events.push(event)
    );

    expect(dependencies.runner.run).toHaveBeenCalledTimes(2);
    expect(dependencies.runner.run).toHaveBeenCalledWith(
      expect.objectContaining({ redactionLiterals: expect.arrayContaining([root, root.replaceAll('\\', '/')]) }),
      {},
      undefined
    );
    expect(result.evidence.map((item) => item.status)).toEqual(['failed', 'passed']);
    expect(result.verdict).toBe('failed');
    expect(saved.map((item) => item.evidence.length)).toEqual([0, 1, 2, 2]);
    expect(events.map((event) => event.type)).toEqual([
      'run-started', 'evidence-started', 'evidence-completed',
      'evidence-started', 'evidence-completed', 'run-completed'
    ]);
  });

  it('persists a recoverable cancelled run and does not start later checks', async () => {
    const saved: RunRecord[] = [];
    const controller = new AbortController();
    const dependencies = deps([], saved);
    dependencies.runner.run.mockImplementationOnce(async () => {
      controller.abort();
      return commandResult('unproven');
    });

    const result = await createRunService(dependencies).execute(
      { project: project(), contractPath: join(root, 'doneproof.yml'), artifactsDir },
      () => undefined,
      controller.signal
    );

    expect(dependencies.runner.run).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('cancelled');
    expect(result.evidence).toHaveLength(1);
    expect(saved.at(-1)).toMatchObject({ status: 'cancelled', evidence: [{ status: 'unproven' }] });
  });

  it.each([
    ['missing', false],
    ['mismatch', true]
  ] as const)('downgrades a passed browser proof with a %s artifact', async (_case, createFile) => {
    const saved: RunRecord[] = [];
    const dependencies = deps([], saved);
    const artifactPath = join(artifactsDir, 'proof.png');
    if (createFile) await writeFile(artifactPath, 'changed');
    dependencies.browserProof.mockResolvedValueOnce({
      status: 'passed', durationMs: 1, steps: [],
      screenshots: [{ path: artifactPath, sha256: '0'.repeat(64), mediaType: 'image/png', integrity: 'verified' }]
    });
    const value = project();
    value.contract.criteria[0]!.evidenceIds = ['browser'];
    value.contract.checks = [];
    value.contract.scenarios = [{
      id: 'browser', name: 'Browser', baseUrl: 'http://localhost:3000', timeoutMs: 1_000,
      criterionIds: ['quality'], steps: [{ id: 'visit', type: 'visit', path: '/' }]
    }];

    const result = await createRunService(dependencies).execute(
      { project: value, contractPath: join(root, 'doneproof.yml'), artifactsDir },
      () => undefined
    );

    expect(result.verdict).toBe('unproven');
    expect(result.evidence[0]!.artifacts[0]!.integrity).toBe(_case);
  });
});
