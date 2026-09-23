import { mkdir, open, readFile, realpath, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectRecord, RunRecord } from '../../shared/models';

interface PersistedState {
  version: 1;
  projects: ProjectRecord[];
  runs: RunRecord[];
}

export interface LocalStore {
  listProjects(): Promise<ProjectRecord[]>;
  saveProject(project: ProjectRecord): Promise<void>;
  saveRun(run: RunRecord): Promise<void>;
  getRun(id: string): Promise<RunRecord | null>;
}

const emptyState = (): PersistedState => ({ version: 1, projects: [], runs: [] });

async function canonicalPath(path: string): Promise<string> {
  const resolved = await realpath(path);
  return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
}

async function loadState(root: string, statePath: string): Promise<PersistedState> {
  try {
    const parsed = JSON.parse(await readFile(statePath, 'utf8')) as Partial<PersistedState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.projects) || !Array.isArray(parsed.runs)) {
      throw new Error('Unsupported local store schema');
    }
    return parsed as PersistedState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
    await rename(statePath, join(root, `state.corrupt-${Date.now()}.json`));
    return emptyState();
  }
}

async function writeAtomic(statePath: string, state: PersistedState): Promise<void> {
  const temporaryPath = `${statePath}.tmp`;
  const handle = await open(temporaryPath, 'w');
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, statePath);
}

export async function createStore(root: string): Promise<LocalStore> {
  await mkdir(root, { recursive: true });
  const statePath = join(root, 'state.json');
  const state = await loadState(root, statePath);
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const pending = queue.then(operation, operation);
    queue = pending.catch(() => undefined);
    return pending;
  };

  if (!(await readFile(statePath, 'utf8').then(() => true).catch(() => false))) {
    await writeAtomic(statePath, state);
  }

  return {
    async listProjects() {
      await queue;
      return structuredClone(state.projects);
    },

    async saveProject(project) {
      const canonicalRoot = await realpath(project.root);
      const key = await canonicalPath(project.root);
      await enqueue(async () => {
        const existingIndex = await Promise.all(state.projects.map((item) => canonicalPath(item.root)))
          .then((roots) => roots.findIndex((candidate) => candidate === key));
        const normalized = { ...structuredClone(project), root: canonicalRoot };
        if (existingIndex === -1) state.projects.push(normalized);
        else state.projects[existingIndex] = normalized;
        await writeAtomic(statePath, state);
      });
    },

    async saveRun(run) {
      await enqueue(async () => {
        const index = state.runs.findIndex((item) => item.id === run.id);
        const value = structuredClone(run);
        if (index === -1) state.runs.push(value);
        else state.runs[index] = value;
        await writeAtomic(statePath, state);
      });
    },

    async getRun(id) {
      await queue;
      const found = state.runs.find((item) => item.id === id);
      return found ? structuredClone(found) : null;
    }
  };
}
