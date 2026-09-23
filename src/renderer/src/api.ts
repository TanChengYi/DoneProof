import type { DoneProofApi } from '../../shared/api';
import type { ProjectRecord, RunRecord } from '../../shared/models';

declare global {
  interface Window { doneproof?: DoneProofApi }
}

const demoProject: ProjectRecord = {
  id: 'demo', name: 'DoneProof', root: 'D:\\CodexPro\\DoneProof', createdAt: '2026-09-23T10:41:00.000Z', updatedAt: '2026-09-23T10:42:00.000Z',
  contract: {
    version: 1, goal: 'Ship DoneProof with inspectable evidence',
    criteria: [
      { id: 'typecheck', text: 'TypeScript compiles with no errors', required: true, evidenceIds: ['npm:typecheck'] },
      { id: 'tests', text: 'All unit tests pass', required: true, evidenceIds: ['npm:test'] },
      { id: 'build', text: 'Production build completes', required: true, evidenceIds: ['npm:build'] },
      { id: 'browser', text: 'Core user flow works in browser', required: true, evidenceIds: ['browser-proof'] }
    ],
    checks: [
      { id: 'npm:typecheck', label: 'Typecheck', executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 300000, maxOutputBytes: 2000000 },
      { id: 'npm:test', label: 'Unit tests', executable: 'npm', args: ['test'], timeoutMs: 300000, maxOutputBytes: 2000000 },
      { id: 'npm:build', label: 'Build application', executable: 'npm', args: ['run', 'build'], timeoutMs: 300000, maxOutputBytes: 2000000 }
    ],
    scenarios: [{ id: 'browser-proof', name: 'Browser proof', baseUrl: 'http://127.0.0.1:5173', timeoutMs: 30000, criterionIds: ['browser'], steps: [{ id: 'visit', type: 'visit', path: '/' }] }]
  }
};

const demoRun: RunRecord = {
  id: 'demo-run', projectId: 'demo', status: 'completed', startedAt: '2026-09-23T10:41:02.000Z', completedAt: '2026-09-23T10:42:46.000Z',
  fingerprint: { versioned: true, branch: 'codex/doneproof-v1', head: 'a839892', diffHash: 'f9c6e2d7', contractHash: '84ab3c1d' },
  contract: demoProject.contract,
  evidence: demoProject.contract.checks.map((check, index) => ({ id: check.id, label: check.label, kind: 'command' as const, criterionIds: [demoProject.contract.criteria[index]!.id], status: 'passed' as const, startedAt: '2026-09-23T10:41:02.000Z', completedAt: '2026-09-23T10:41:15.000Z', durationMs: 12000 + index * 8000, output: `> doneproof@0.1.0 ${check.args.join(' ')}\n✓ ${check.label} passed`, artifacts: [] })),
  criteria: demoProject.contract.criteria.map((item, index) => ({ criterionId: item.id, verdict: index < 3 ? 'proven' as const : 'unproven' as const, reason: index < 3 ? 'All referenced evidence passed' : 'Evidence has not run yet', evidenceIds: item.evidenceIds })),
  verdict: 'unproven'
};

const listeners = new Set<Parameters<DoneProofApi['onRunEvent']>[0]>();
const demoApi: DoneProofApi = {
  listProjects: async () => [structuredClone(demoProject)],
  chooseProject: async () => structuredClone(demoProject),
  getProject: async () => structuredClone(demoProject),
  saveContract: async (_id, contract) => ({ ...structuredClone(demoProject), contract }),
  startRun: async () => {
    queueMicrotask(() => listeners.forEach((listener) => listener({ type: 'run-completed', run: structuredClone(demoRun) })));
    return { runId: demoRun.id };
  },
  cancelRun: async () => undefined,
  getRun: async () => structuredClone(demoRun),
  exportReceipt: async () => ({ htmlPath: 'demo/receipt.html', markdownPath: 'demo/receipt.md' }),
  onRunEvent: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }
};

export const api: DoneProofApi = window.doneproof ?? demoApi;
