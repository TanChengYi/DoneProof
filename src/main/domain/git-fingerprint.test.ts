import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fingerprintRepository } from './git-fingerprint';

let root: string;

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'doneproof-git-'));
  git('init', '-b', 'main');
  git('config', 'user.email', 'fixture@doneproof.local');
  git('config', 'user.name', 'DoneProof Fixture');
  git('config', 'core.autocrlf', 'false');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('fingerprintRepository', () => {
  it('distinguishes clean and dirty versions of the same commit', async () => {
    await writeFile(join(root, 'app.txt'), 'v1\n');
    await writeFile(join(root, 'doneproof.yml'), 'version: 1\n');
    git('add', '.');
    git('commit', '-m', 'fixture');

    const clean = await fingerprintRepository(root, join(root, 'doneproof.yml'));
    await writeFile(join(root, 'app.txt'), 'v2\n');
    const dirty = await fingerprintRepository(root, join(root, 'doneproof.yml'));

    expect(clean).toMatchObject({ versioned: true, branch: 'main', head: git('rev-parse', 'HEAD') });
    expect(clean.diffHash).not.toBe(dirty.diffHash);
    expect(clean.contractHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns explicit unversioned data for a repository without commits', async () => {
    const result = await fingerprintRepository(root, join(root, 'missing.yml'));

    expect(result).toEqual({ versioned: false, branch: 'main', head: null, diffHash: expect.any(String), contractHash: null });
  });

  it('returns explicit unversioned data when Git is unavailable', async () => {
    const result = await fingerprintRepository(root, join(root, 'missing.yml'), { gitExecutable: join(root, 'missing-git.exe') });

    expect(result).toEqual({ versioned: false, branch: null, head: null, diffHash: expect.any(String), contractHash: null });
  });
});
