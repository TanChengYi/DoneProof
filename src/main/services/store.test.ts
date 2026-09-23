import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRecord, RunRecord } from '../../shared/models';
import { createStore } from './store';

let root: string;
let projectRoot: string;

const contract = {
  version: 1 as const,
  goal: 'Ship a reliable product',
  criteria: [{ id: 'c1', text: 'Tests pass', required: true, evidenceIds: ['e1'] }],
  checks: [],
  scenarios: []
};

function project(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'project-1',
    name: 'Fixture',
    root: projectRoot,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    contract,
    ...overrides
  };
}

function run(): RunRecord {
  return {
    id: 'run-1',
    projectId: 'project-1',
    status: 'completed',
    startedAt: '2026-09-23T00:00:00.000Z',
    completedAt: '2026-09-23T00:00:01.000Z',
    fingerprint: { versioned: true, branch: 'main', head: 'abc123', diffHash: 'diff', contractHash: 'contract' },
    contract,
    evidence: [],
    criteria: [{ criterionId: 'c1', verdict: 'unproven', reason: 'No evidence', evidenceIds: [] }],
    verdict: 'unproven'
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'doneproof-store-'));
  projectRoot = join(root, 'project');
  await mkdir(projectRoot);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('local store', () => {
  it('preserves a corrupt state file and starts with an empty schema', async () => {
    await writeFile(join(root, 'state.json'), '{broken');

    const store = await createStore(root);

    expect(await store.listProjects()).toEqual([]);
    expect((await readdir(root)).some((name) => name.startsWith('state.corrupt-'))).toBe(true);
  });

  it('upserts projects by canonical root path', async () => {
    const store = await createStore(root);
    await store.saveProject(project());
    await store.saveProject(project({ id: 'project-2', name: 'Updated', root: join(projectRoot, '.') }));

    const projects = await store.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id: 'project-2', name: 'Updated' });
  });

  it('writes schema version one and removes the temporary file', async () => {
    const store = await createStore(root);
    await store.saveProject(project());

    const persisted = JSON.parse(await readFile(join(root, 'state.json'), 'utf8')) as { version: number };
    expect(persisted.version).toBe(1);
    expect(await readdir(root)).not.toContain('state.json.tmp');
  });

  it('persists and retrieves a run by id', async () => {
    const store = await createStore(root);
    await store.saveRun(run());

    expect(await store.getRun('run-1')).toEqual(run());
    expect(await store.getRun('missing')).toBeNull();
  });
});
