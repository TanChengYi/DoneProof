import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectProject } from './project-detector';

describe('detectProject', () => {
  it('detects only declared npm verification checks', async () => {
    const result = await detectProject(resolve('tests/fixtures/node-pass'));
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    expect(result.stacks).toEqual(['node']);
    expect(result.checks.map((check) => check.id)).toEqual(['npm:test', 'npm:lint', 'npm:build', 'npm:typecheck']);
    expect(result.checks.map((check) => [check.executable, check.args])).toEqual([
      [npm, ['run', 'test']],
      [npm, ['run', 'lint']],
      [npm, ['run', 'build']],
      [npm, ['run', 'typecheck']]
    ]);
  });

  it('detects configured Python verification tools', async () => {
    const result = await detectProject(resolve('tests/fixtures/python-pass'));

    expect(result.stacks).toEqual(['python']);
    expect(result.checks.map((check) => check.id)).toEqual(['python:pytest', 'python:ruff', 'python:mypy', 'python:build']);
  });
});
