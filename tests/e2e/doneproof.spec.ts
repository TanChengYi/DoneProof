import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ProjectRecord } from '../../src/shared/models';
import { createWorkspace, launchApp, seedProject, type E2eWorkspace } from './helpers';

const baseProject = (root: string): ProjectRecord => ({
  id: 'fixture-project', name: 'Proof fixture', root, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z',
  contract: {
    version: 1, goal: 'Prove a mixed delivery',
    criteria: [
      { id: 'pass', text: 'Passing check succeeds', required: true, evidenceIds: ['pass-check'] },
      { id: 'fail', text: 'Failing check is reported', required: true, evidenceIds: ['fail-check'] },
      { id: 'unknown', text: 'Missing evidence stays unproven', required: true, evidenceIds: ['not-run'] }
    ],
    checks: [
      { id: 'pass-check', label: 'Passing check', executable: process.execPath, args: ['-e', "console.log('pass')"], timeoutMs: 5_000, maxOutputBytes: 10_000 },
      { id: 'fail-check', label: 'Failing check', executable: process.execPath, args: ['-e', "console.error('intentional failure'); process.exit(2)"], timeoutMs: 5_000, maxOutputBytes: 10_000 }
    ], scenarios: []
  }
});

let workspace: E2eWorkspace;
test.afterEach(async () => { if (workspace) await rm(workspace.root, { recursive: true, force: true }); });

test('creates a mixed-verdict receipt, exports it, and detects staleness', async () => {
  workspace = await createWorkspace('node-fail');
  await seedProject(workspace, baseProject(workspace.projectRoot));
  const { app, page } = await launchApp(workspace);
  try {
    await page.getByRole('button', { name: 'Run verification' }).click();
    await expect(page.getByRole('heading', { name: 'Verification found failures' })).toBeVisible();
    await expect(page.getByText('Passing check succeeds')).toBeVisible();
    await expect(page.getByText('Failing check is reported')).toBeVisible();
    await expect(page.getByText('Missing evidence stays unproven')).toBeVisible();

    await writeFile(join(workspace.projectRoot, 'source.js'), "export const value = 'changed';\n");
    await page.getByRole('button', { name: 'Export receipt' }).click();
    await expect(page.getByText(/Receipt exported to/)).toBeVisible();
    const html = await readFile(join(workspace.exportDirectory, 'receipt.html'), 'utf8');
    expect(html).toContain('Repository changed since this run');
    expect(html).toContain('Historical verdict remains');
  } finally { await app.close(); }
});

test('cancels a running verification and preserves an unproven receipt', async () => {
  workspace = await createWorkspace('node-unproven');
  const project = baseProject(workspace.projectRoot);
  project.contract.goal = 'Cancel safely';
  project.contract.criteria = [{ id: 'slow', text: 'Slow task completes', required: true, evidenceIds: ['slow-check'] }];
  project.contract.checks = [{ id: 'slow-check', label: 'Slow check', executable: process.execPath, args: ['-e', "setTimeout(() => console.log('late'), 30000)"], timeoutMs: 60_000, maxOutputBytes: 10_000 }];
  await seedProject(workspace, project);
  const { app, page } = await launchApp(workspace);
  try {
    await page.getByRole('button', { name: 'Run verification' }).click();
    await expect(page.getByText('Running Slow check…')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel run' }).click();
    await expect(page.getByRole('heading', { name: 'Not enough evidence yet' })).toBeVisible();
    await page.locator('details').filter({ hasText: 'Slow check' }).locator('summary').click();
    await expect(page.getByText('Cancelled by user')).toBeVisible();
  } finally { await app.close(); }
});
