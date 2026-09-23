import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { dialog, ipcMain, type WebContents } from 'electron';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import type { RunEvent } from '../shared/api';
import type { ProjectRecord, ProofContract } from '../shared/models';
import { proofContractSchema } from '../shared/schemas';
import { fingerprintRepository } from './domain/git-fingerprint';
import { detectProject } from './domain/project-detector';
import { exportReceipt } from './services/receipt';
import { createRunService } from './services/run-service';
import { createRunner } from './services/runner';
import type { LocalStore } from './services/store';

const safeId = z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9:_-]+$/);
export const ipcPayloadSchemas = {
  getProject: z.object({ projectId: safeId }),
  saveContract: z.object({ projectId: safeId, contract: proofContractSchema }),
  startRun: z.object({ projectId: safeId }),
  cancelRun: z.object({ runId: safeId }),
  getRun: z.object({ runId: safeId }),
  exportReceipt: z.object({ runId: safeId })
};

interface IpcServices { store: LocalStore }
const activeRuns = new Map<string, AbortController>();

async function findProject(store: LocalStore, id: string): Promise<ProjectRecord> {
  const project = (await store.listProjects()).find((item) => item.id === id);
  if (!project) throw new Error('Project not found');
  return project;
}

async function readContract(root: string, fallback: ProofContract): Promise<ProofContract> {
  try {
    return proofContractSchema.parse(parse(await readFile(join(root, 'doneproof.yml'), 'utf8'))) as ProofContract;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    if (error instanceof z.ZodError) throw new Error(`Invalid doneproof.yml: ${error.issues[0]?.message ?? 'unknown schema error'}`, { cause: error });
    throw error;
  }
}

function emitRunEvent(sender: WebContents, event: RunEvent): void {
  if (!sender.isDestroyed()) sender.send('doneproof:run-event', event);
}

export function registerIpc({ store }: IpcServices): void {
  ipcMain.handle('doneproof:list-projects', () => store.listProjects());
  ipcMain.handle('doneproof:choose-project', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    const root = selection.filePaths[0];
    if (selection.canceled || !root) return null;
    const existing = (await store.listProjects()).find((item) => item.root.toLocaleLowerCase('en-US') === root.toLocaleLowerCase('en-US'));
    if (existing) return existing;
    const detected = await detectProject(root);
    const fallback: ProofContract = {
      version: 1,
      goal: `Verify ${basename(root)} is ready to deliver`,
      criteria: [{ id: randomUUID(), text: 'Selected quality checks pass', required: true, evidenceIds: detected.checks.map((item) => item.id) }],
      checks: detected.checks,
      scenarios: []
    };
    const now = new Date().toISOString();
    const project: ProjectRecord = { id: randomUUID(), name: basename(root), root, createdAt: now, updatedAt: now, contract: await readContract(root, fallback) };
    await store.saveProject(project);
    return project;
  });
  ipcMain.handle('doneproof:get-project', async (_event, payload) => {
    const { projectId } = ipcPayloadSchemas.getProject.parse(payload);
    return (await store.listProjects()).find((item) => item.id === projectId) ?? null;
  });
  ipcMain.handle('doneproof:save-contract', async (_event, payload) => {
    const { projectId, contract: parsedContract } = ipcPayloadSchemas.saveContract.parse(payload);
    const contract = parsedContract as ProofContract;
    const project = await findProject(store, projectId);
    const updated: ProjectRecord = { ...project, contract, updatedAt: new Date().toISOString() };
    await writeFile(join(project.root, 'doneproof.yml'), stringify(contract), 'utf8');
    await store.saveProject(updated);
    return updated;
  });
  ipcMain.handle('doneproof:start-run', async (event, payload) => {
    const { projectId } = ipcPayloadSchemas.startRun.parse(payload);
    const project = await findProject(store, projectId);
    const runId = randomUUID();
    const controller = new AbortController();
    activeRuns.set(runId, controller);
    const service = createRunService({ store, runner: createRunner(), createId: () => runId });
    void service.execute({ project, contractPath: join(project.root, 'doneproof.yml'), artifactsDir: join(project.root, '.doneproof', 'runs', runId) }, (runEvent) => emitRunEvent(event.sender, runEvent), controller.signal)
      .catch((error: unknown) => emitRunEvent(event.sender, { type: 'run-failed', runId, message: error instanceof Error ? error.message : 'Verification failed unexpectedly' }))
      .finally(() => activeRuns.delete(runId));
    return { runId };
  });
  ipcMain.handle('doneproof:cancel-run', (_event, payload) => {
    const { runId } = ipcPayloadSchemas.cancelRun.parse(payload);
    activeRuns.get(runId)?.abort();
  });
  ipcMain.handle('doneproof:get-run', async (_event, payload) => {
    const { runId } = ipcPayloadSchemas.getRun.parse(payload);
    return await store.getRun(runId);
  });
  ipcMain.handle('doneproof:export-receipt', async (_event, payload) => {
    const { runId } = ipcPayloadSchemas.exportReceipt.parse(payload);
    const run = await store.getRun(runId);
    if (!run) throw new Error('Run not found');
    const project = await findProject(store, run.projectId);
    const e2eDirectory = process.env['DONEPROOF_E2E_EXPORT_DIR'];
    const selection = e2eDirectory ? null : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    const directory = e2eDirectory ?? selection?.filePaths[0];
    if ((!e2eDirectory && selection?.canceled) || !directory) return null;
    const currentFingerprint = await fingerprintRepository(project.root, join(project.root, 'doneproof.yml'));
    const result = await exportReceipt({ run, currentFingerprint, directory });
    return { htmlPath: result.htmlPath, markdownPath: result.markdownPath };
  });
}
