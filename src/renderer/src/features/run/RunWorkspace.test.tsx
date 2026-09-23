// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRecord } from '../../../../shared/models';
import { RunWorkspace } from './RunWorkspace';

afterEach(cleanup);

const project = {
  id: 'p1', name: 'Fixture', root: '/fixture', createdAt: 'now', updatedAt: 'now',
  contract: { version: 1, goal: 'Ship', criteria: [{ id: 'c1', text: 'Tests pass', required: true, evidenceIds: ['test'] }],
    checks: [{ id: 'test', label: 'Unit tests', executable: 'npm', args: ['test'], timeoutMs: 5000, maxOutputBytes: 10000 }], scenarios: [] }
} satisfies ProjectRecord;

describe('RunWorkspace', () => {
  it('shows the explicit first-run manifest before starting', () => {
    const start = vi.fn();
    render(<RunWorkspace project={project} run={null} events={[]} running={false} onStart={start} onCancel={vi.fn()} />);
    expect(screen.getByText('Review run manifest')).toBeInTheDocument();
    expect(screen.getByText('npm test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run verification' }));
    expect(start).toHaveBeenCalledOnce();
  });

  it('renders live evidence events', () => {
    render(<RunWorkspace project={project} run={null} running events={[{ type: 'evidence-started', runId: 'r1', evidenceId: 'test', label: 'Unit tests' }]} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/Running Unit tests/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeInTheDocument();
  });
});
