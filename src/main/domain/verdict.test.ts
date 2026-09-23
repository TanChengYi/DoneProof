import { describe, expect, it } from 'vitest';
import type { Criterion, EvidenceResult } from '../../shared/models';
import { deriveCriterionVerdict, deriveProjectVerdict } from './verdict';

const criterion: Criterion = { id: 'c1', text: 'Quality gates pass', required: true, evidenceIds: ['e1', 'e2'] };

function evidence(id: string, status: EvidenceResult['status'], integrity: 'verified' | 'missing' | 'mismatch' = 'verified'): EvidenceResult {
  return {
    id,
    label: id,
    kind: 'command',
    criterionIds: ['c1'],
    status,
    startedAt: '2026-09-23T00:00:00.000Z',
    completedAt: '2026-09-23T00:00:01.000Z',
    durationMs: 1_000,
    artifacts: id === 'e1' ? [{ path: '/proof.txt', sha256: 'abc', mediaType: 'text/plain', integrity }] : []
  };
}

describe('criterion verdicts', () => {
  it.each([
    [['passed', 'passed'], 'proven'],
    [['passed', 'failed'], 'failed'],
    [['passed', 'unproven'], 'unproven'],
    [[], 'unproven']
  ] as const)('maps required evidence %j to %s', (statuses, expected) => {
    const items = statuses.map((status, index) => evidence(`e${index + 1}`, status));
    expect(deriveCriterionVerdict(criterion, items).verdict).toBe(expected);
  });

  it.each(['missing', 'mismatch'] as const)('marks %s artifacts unproven', (integrity) => {
    const result = deriveCriterionVerdict(criterion, [evidence('e1', 'passed', integrity), evidence('e2', 'passed')]);
    expect(result.verdict).toBe('unproven');
    expect(result.reason).toContain(integrity);
  });

  it('marks absent referenced evidence unproven', () => {
    expect(deriveCriterionVerdict(criterion, [evidence('e1', 'passed')]).verdict).toBe('unproven');
  });
});

describe('project verdicts', () => {
  it('ignores informational criteria and applies failure precedence', () => {
    expect(deriveProjectVerdict([
      { criterionId: 'required', required: true, verdict: 'proven' },
      { criterionId: 'info', required: false, verdict: 'failed' }
    ])).toBe('proven');
    expect(deriveProjectVerdict([
      { criterionId: 'required', required: true, verdict: 'failed' },
      { criterionId: 'other', required: true, verdict: 'unproven' }
    ])).toBe('failed');
  });
});
