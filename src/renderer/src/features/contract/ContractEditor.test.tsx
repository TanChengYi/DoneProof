// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRecord } from '../../../../shared/models';
import { ContractEditor } from './ContractEditor';

afterEach(cleanup);

const project: ProjectRecord = {
  id: 'p1', name: 'Fixture', root: '/fixture', createdAt: 'now', updatedAt: 'now',
  contract: {
    version: 1, goal: 'Ship safely',
    criteria: [{ id: 'c1', text: 'Tests pass', required: true, evidenceIds: ['test'] }],
    checks: [
      { id: 'test', label: 'Unit tests', executable: 'npm', args: ['test'], timeoutMs: 5000, maxOutputBytes: 10000 },
      { id: 'lint', label: 'Lint', executable: 'npm', args: ['run', 'lint'], timeoutMs: 5000, maxOutputBytes: 10000 }
    ], scenarios: []
  }
};

describe('ContractEditor', () => {
  it('blocks saving an empty criterion', () => {
    render(<ContractEditor project={project} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Criterion 1'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Criterion text is required');
    expect(screen.getByRole('button', { name: 'Save contract' })).toBeDisabled();
  });

  it('allows candidate checks to be selected for the criterion', () => {
    const save = vi.fn();
    render(<ContractEditor project={project} onSave={save} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save contract' }));
    expect(save.mock.calls[0]?.[0].criteria[0].evidenceIds).toContain('lint');
  });
});
