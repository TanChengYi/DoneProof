// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunRecord } from '../../../../shared/models';
import { ReceiptView } from './ReceiptView';

afterEach(cleanup);

const run = {
  id: 'r1', projectId: 'p1', status: 'completed', startedAt: 'now', completedAt: 'later', verdict: 'unproven',
  fingerprint: { versioned: true, branch: 'main', head: 'abc', diffHash: 'diff', contractHash: 'contract' },
  contract: { version: 1, goal: 'Ship', criteria: [{ id: 'c1', text: 'Browser flow works', required: true, evidenceIds: ['browser'] }], checks: [], scenarios: [] },
  evidence: [{ id: 'browser', label: 'Browser proof', kind: 'browser', criterionIds: ['c1'], status: 'unproven', startedAt: 'now', completedAt: 'later', durationMs: 1, reason: 'Timed out', artifacts: [] }],
  criteria: [{ criterionId: 'c1', verdict: 'unproven', reason: 'Evidence is unproven', evidenceIds: ['browser'] }]
} satisfies RunRecord;

describe('ReceiptView', () => {
  it('explains an unproven result without presenting it as success', () => {
    render(<ReceiptView run={run} onExport={vi.fn()} />);
    expect(screen.getByText('Not enough evidence yet')).toBeInTheDocument();
    expect(screen.getByText('Timed out')).toBeInTheDocument();
  });
});
