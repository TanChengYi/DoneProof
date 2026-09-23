import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import type {
  BrowserEvidenceResult,
  BrowserScenario,
  BrowserStep,
  BrowserStepResult,
  EvidenceArtifact,
  EvidenceStatus
} from '../../shared/models';
import { assertInsideProject } from '../domain/path-policy';
import type { CommandSpec, SafeRunner } from './runner';

export interface BrowserProofContext {
  projectRoot: string;
  artifactsDir: string;
  runner: SafeRunner;
  startCommand?: CommandSpec;
  signal?: AbortSignal;
}

class ScenarioTimeoutError extends Error {}
class ReadinessTimeoutError extends Error {}
class CancelledError extends Error {}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new CancelledError('Cancelled by user');
}

async function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw abortError(signal);
  return await new Promise<T>((resolve, reject) => {
    const cancel = () => reject(abortError(signal));
    signal.addEventListener('abort', cancel, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}

async function waitForReadiness(url: string, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const response = await fetch(url, { signal });
      if (response.ok) return;
    } catch {
      if (signal.aborted) throw abortError(signal);
    }
    await withAbort(new Promise((resolve) => setTimeout(resolve, 50)), signal);
  }
  throw abortError(signal);
}

function safeName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return normalized || 'screenshot';
}

async function captureScreenshot(page: Page, directory: string, name: string, fullPage: boolean): Promise<EvidenceArtifact> {
  const path = join(directory, `${safeName(name)}.png`);
  await page.screenshot({ path, fullPage });
  const content = await readFile(path);
  return {
    path,
    sha256: createHash('sha256').update(content).digest('hex'),
    mediaType: 'image/png',
    integrity: 'verified'
  };
}

async function executeStep(page: Page, step: BrowserStep, baseUrl: string, artifactsDir: string): Promise<EvidenceArtifact | undefined> {
  switch (step.type) {
    case 'visit':
      await page.goto(new URL(step.path, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
      return undefined;
    case 'click':
      await page.locator(step.selector).click();
      return undefined;
    case 'fill':
      await page.locator(step.selector).fill(step.value);
      return undefined;
    case 'press':
      await page.locator(step.selector).press(step.key);
      return undefined;
    case 'assertText': {
      const locator = page.locator(step.selector);
      await locator.waitFor({ state: 'visible' });
      const actual = (await locator.textContent()) ?? '';
      if (!actual.includes(step.text)) throw new Error(`Expected ${step.selector} to contain "${step.text}", received "${actual.trim()}"`);
      return undefined;
    }
    case 'assertVisible':
      await page.locator(step.selector).waitFor({ state: 'visible' });
      return undefined;
    case 'assertUrl':
      await page.waitForURL(step.value);
      return undefined;
    case 'screenshot':
      return await captureScreenshot(page, artifactsDir, step.name, step.fullPage);
    default: {
      const exhaustive: never = step;
      throw new Error(`Unsupported browser step: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function classify(error: unknown): { status: EvidenceStatus; reason: string } {
  if (error instanceof CancelledError) return { status: 'unproven', reason: 'Cancelled by user' };
  if (error instanceof ReadinessTimeoutError) return { status: 'unproven', reason: error.message };
  if (error instanceof ScenarioTimeoutError || (error instanceof Error && error.name === 'TimeoutError')) {
    return { status: 'unproven', reason: error instanceof Error ? error.message : 'Browser scenario timed out' };
  }
  return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
}

export async function runBrowserScenario(
  scenario: BrowserScenario,
  context: BrowserProofContext
): Promise<BrowserEvidenceResult> {
  const startedAt = performance.now();
  const steps: BrowserStepResult[] = [];
  const screenshots: EvidenceArtifact[] = [];
  const scenarioController = new AbortController();
  const serverController = new AbortController();
  let browser: Browser | undefined;
  let page: Page | undefined;
  let serverRun: Promise<unknown> | undefined;
  let activeStep: BrowserStep | undefined;
  const onCancel = () => scenarioController.abort(new CancelledError('Cancelled by user'));
  context.signal?.addEventListener('abort', onCancel, { once: true });
  if (context.signal?.aborted) onCancel();
  const timeout = setTimeout(
    () => scenarioController.abort(new ScenarioTimeoutError(`Browser scenario timed out after ${scenario.timeoutMs} ms`)),
    scenario.timeoutMs
  );

  try {
    await mkdir(context.artifactsDir, { recursive: true });
    const artifactsDir = await assertInsideProject(context.projectRoot, context.artifactsDir);
    if (context.startCommand) {
      serverRun = context.runner.run(context.startCommand, {}, serverController.signal);
    }
    if (scenario.readinessUrl) {
      try {
        await waitForReadiness(scenario.readinessUrl, scenarioController.signal);
      } catch (error) {
        if (error instanceof ScenarioTimeoutError) throw new ReadinessTimeoutError(`Browser readiness timed out after ${scenario.timeoutMs} ms`);
        throw error;
      }
    }

    browser = await withAbort(chromium.launch({ headless: true }), scenarioController.signal);
    const browserContext = await browser.newContext();
    page = await browserContext.newPage();
    page.setDefaultTimeout(scenario.timeoutMs);

    for (const step of scenario.steps) {
      activeStep = step;
      const stepStartedAt = performance.now();
      try {
        const artifact = await withAbort(executeStep(page, step, scenario.baseUrl, artifactsDir), scenarioController.signal);
        if (artifact) screenshots.push(artifact);
        steps.push({ id: step.id, type: step.type, status: 'passed', durationMs: Math.round(performance.now() - stepStartedAt) });
      } catch (error) {
        const outcome = classify(error);
        steps.push({
          id: step.id,
          type: step.type,
          status: outcome.status,
          durationMs: Math.round(performance.now() - stepStartedAt),
          reason: outcome.reason
        });
        throw error;
      }
    }

    return { status: 'passed', durationMs: Math.round(performance.now() - startedAt), steps, screenshots };
  } catch (error) {
    const outcome = classify(error);
    if (outcome.status === 'failed' && page) {
      try {
        screenshots.push(await captureScreenshot(page, await assertInsideProject(context.projectRoot, context.artifactsDir), `failure-${activeStep?.id ?? 'scenario'}`, true));
      } catch {
        // The original browser failure remains the primary evidence.
      }
    }
    return {
      status: outcome.status,
      durationMs: Math.round(performance.now() - startedAt),
      steps,
      screenshots,
      reason: outcome.reason
    };
  } finally {
    clearTimeout(timeout);
    context.signal?.removeEventListener('abort', onCancel);
    await browser?.close().catch(() => undefined);
    serverController.abort();
    await serverRun?.catch(() => undefined);
  }
}
