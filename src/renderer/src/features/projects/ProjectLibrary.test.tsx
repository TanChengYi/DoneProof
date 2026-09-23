// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectLibrary } from './ProjectLibrary';

afterEach(cleanup);

describe('ProjectLibrary', () => {
  it('shows an actionable empty state', () => {
    const choose = vi.fn();
    render(<ProjectLibrary projects={[]} onChoose={choose} onOpen={vi.fn()} />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose repository' }));
    expect(choose).toHaveBeenCalledOnce();
  });
});
