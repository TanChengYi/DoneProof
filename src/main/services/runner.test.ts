import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRunner } from './runner';

const fixture = resolve('tests/fixtures/process/emit.mjs');
const runner = createRunner();
const spec = (args: string[], overrides: Record<string, unknown> = {}) => ({
  id: 'fixture',
  executable: process.execPath,
  args: [fixture, ...args],
  cwd: process.cwd(),
  timeoutMs: 5_000,
  maxOutputBytes: 10_000,
  ...overrides
});

describe('safe runner', () => {
  it('streams stdout and stderr and reports a successful exit', async () => {
    const chunks: string[] = [];
    const result = await runner.run(spec(['--literal', 'hello', '--stderr', 'warning']), {
      onOutput: (chunk, stream) => chunks.push(`${stream}:${chunk.trim()}`)
    });

    expect(result).toMatchObject({ status: 'passed', exitCode: 0, truncated: false });
    expect(result.output).toContain('hello');
    expect(result.output).toContain('warning');
    expect(chunks).toEqual(expect.arrayContaining(['stdout:hello', 'stderr:warning']));
  });

  it('reports a nonzero exit as failed', async () => {
    const result = await runner.run(spec(['--exit', '7']));
    expect(result).toMatchObject({ status: 'failed', exitCode: 7 });
  });

  it('reports a timeout as unproven', async () => {
    const result = await runner.run(spec(['--sleep', '500'], { timeoutMs: 25 }));
    expect(result).toMatchObject({ status: 'unproven', exitCode: null, reason: 'Timed out after 25 ms' });
  });

  it('reports user cancellation as unproven', async () => {
    const controller = new AbortController();
    const pending = runner.run(spec(['--sleep', '500']), {}, controller.signal);
    controller.abort();
    const result = await pending;
    expect(result).toMatchObject({ status: 'unproven', exitCode: null, reason: 'Cancelled by user' });
  });

  it('reports a missing executable without throwing', async () => {
    const result = await runner.run(spec([], { executable: resolve('missing-executable.exe') }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Unable to start');
  });

  it('redacts secrets and truncates bounded output without hanging', async () => {
    const secret = 'sk-test-1234567890';
    const result = await runner.run(
      spec(['--secret', secret, '--bytes', '20000'], { maxOutputBytes: 1_024, redactionLiterals: [secret] })
    );

    expect(result.output).not.toContain(secret);
    expect(result.output).toContain('[REDACTED]');
    expect(result.truncated).toBe(true);
  });

  it('passes command metacharacters as literal arguments', async () => {
    const literal = '& echo SHELL_WAS_USED';
    const result = await runner.run(spec(['--literal', literal]));
    expect(result.output.trim()).toBe(literal);
  });
});
