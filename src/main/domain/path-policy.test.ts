import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertInsideProject } from './path-policy';

let parent: string;
let root: string;

beforeEach(async () => {
  parent = await mkdtemp(join(tmpdir(), 'doneproof-path-'));
  root = join(parent, 'project');
  await mkdir(root);
});

afterEach(async () => {
  await rm(parent, { recursive: true, force: true });
});

describe('assertInsideProject', () => {
  it('returns a canonical path for a file inside the project', async () => {
    const file = join(root, 'inside.txt');
    await writeFile(file, 'safe');

    await expect(assertInsideProject(root, file)).resolves.toBe(file);
  });

  it('rejects a direct parent traversal', async () => {
    const outside = join(parent, 'outside.txt');
    await writeFile(outside, 'private');

    await expect(assertInsideProject(root, join(root, '..', 'outside.txt'))).rejects.toThrow('outside the selected project');
  });

  it('rejects a junction escaping the project', async () => {
    const outside = join(parent, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'secret.txt'), 'private');
    await symlink(outside, join(root, 'escape'), 'junction');

    await expect(assertInsideProject(root, join(root, 'escape', 'secret.txt'))).rejects.toThrow('outside the selected project');
  });
});
