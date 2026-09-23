import { createServer } from 'node:http';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserScenario } from '../../shared/models';
import { browserScenarioSchema } from '../../shared/schemas';
import { runBrowserScenario } from './browser-proof';
import { createRunner } from './runner';

const fixtureServer = resolve('tests/fixtures/web-proof/server.mjs');
let projectRoot: string;
vi.setConfig({ testTimeout: 15_000, hookTimeout: 15_000 });

async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') return reject(new Error('No TCP port assigned'));
      probe.close(() => resolvePort(address.port));
    });
  });
}

async function setupScenario(overrides: Partial<BrowserScenario> = {}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const scenario: BrowserScenario = {
    id: 'sign-in',
    name: 'Sign in works',
    baseUrl,
    readinessUrl: `${baseUrl}/health`,
    timeoutMs: 5_000,
    startCheckId: 'fixture-server',
    criterionIds: ['criterion-auth'],
    steps: [
      { id: 'visit', type: 'visit', path: '/' },
      { id: 'email', type: 'fill', selector: '#email', value: 'dev@example.com' },
      { id: 'password', type: 'fill', selector: '#password', value: 'secret' },
      { id: 'submit', type: 'click', selector: '#sign-in' },
      { id: 'welcome', type: 'assertText', selector: '#dashboard', text: 'Welcome back' },
      { id: 'visible', type: 'assertVisible', selector: '[data-testid="proof-ready"]' },
      { id: 'url', type: 'assertUrl', value: `${baseUrl}/dashboard` },
      { id: 'screen', type: 'screenshot', name: 'signed-in', fullPage: true }
    ],
    ...overrides
  };
  return {
    port,
    scenario,
    context: {
      projectRoot,
      artifactsDir: join(projectRoot, 'artifacts'),
      runner: createRunner(),
      startCommand: {
        id: 'fixture-server',
        executable: process.execPath,
        args: [fixtureServer, String(port)],
        cwd: projectRoot,
        timeoutMs: 30_000,
        maxOutputBytes: 10_000
      }
    }
  };
}

async function expectPortClosed(port: number) {
  await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
}

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'doneproof-browser-'));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('browser proof', () => {
  it('captures a hashed screenshot after deterministic actions and assertions', async () => {
    const { port, scenario, context } = await setupScenario();
    const result = await runBrowserScenario(scenario, context);

    expect(result.status).toBe('passed');
    expect(result.steps.every((step) => step.status === 'passed')).toBe(true);
    expect(result.screenshots[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(stat(result.screenshots[0]!.path)).resolves.toBeDefined();
    await expectPortClosed(port);
  });

  it('captures a failure screenshot when a text assertion fails', async () => {
    const { port, scenario, context } = await setupScenario({
      steps: [
        { id: 'visit', type: 'visit', path: '/' },
        { id: 'missing', type: 'assertText', selector: 'h1', text: 'Not on this page' }
      ]
    });
    const result = await runBrowserScenario(scenario, context);

    expect(result.status).toBe('failed');
    expect(result.steps.at(-1)?.status).toBe('failed');
    expect(result.screenshots[0]?.path).toContain('failure');
    await expect(stat(result.screenshots[0]!.path)).resolves.toBeDefined();
    await expectPortClosed(port);
  });

  it('rejects invalid executable step data at the schema boundary', () => {
    const invalid = {
      id: 'unsafe', name: 'Unsafe', baseUrl: 'http://localhost:3000', timeoutMs: 1_000,
      criterionIds: [], steps: [{ id: 'js', type: 'evaluate', source: 'process.exit()' }]
    };
    expect(browserScenarioSchema.safeParse(invalid).success).toBe(false);
  });

  it('marks readiness timeouts unproven and stops the server', async () => {
    const { port, scenario, context } = await setupScenario({ readinessUrl: 'http://127.0.0.1:1/never', timeoutMs: 1_000 });
    const result = await runBrowserScenario(scenario, context);

    expect(result).toMatchObject({ status: 'unproven' });
    expect(result.reason).toContain('readiness');
    await expectPortClosed(port);
  });

  it('marks cancellation unproven and stops the server and browser', async () => {
    const { port, scenario, context } = await setupScenario();
    scenario.steps.splice(1, 0, { id: 'wait-for-never', type: 'assertVisible', selector: '#never' });
    const controller = new AbortController();
    const pending = runBrowserScenario(scenario, { ...context, signal: controller.signal });
    setTimeout(() => controller.abort(), 150);
    const result = await pending;

    expect(result).toMatchObject({ status: 'unproven', reason: 'Cancelled by user' });
    await expectPortClosed(port);
  });
});
