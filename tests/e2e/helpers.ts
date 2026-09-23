import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import type { ProjectRecord } from '../../src/shared/models';

const exec = promisify(execFile);

export interface E2eWorkspace {
  root: string;
  projectRoot: string;
  userData: string;
  exportDirectory: string;
}

export async function createWorkspace(fixture: 'node-fail' | 'node-unproven'): Promise<E2eWorkspace> {
  const root = await mkdtemp(join(tmpdir(), 'doneproof-e2e-'));
  const projectRoot = join(root, 'project');
  const userData = join(root, 'user-data');
  const exportDirectory = join(root, 'export');
  await cp(resolve(`tests/fixtures/${fixture}`), projectRoot, { recursive: true });
  await Promise.all([mkdir(join(userData, 'store'), { recursive: true }), mkdir(exportDirectory, { recursive: true })]);
  await exec('git', ['init'], { cwd: projectRoot });
  await exec('git', ['config', 'user.email', 'doneproof@example.invalid'], { cwd: projectRoot });
  await exec('git', ['config', 'user.name', 'DoneProof E2E'], { cwd: projectRoot });
  await exec('git', ['add', '.'], { cwd: projectRoot });
  await exec('git', ['commit', '-m', 'fixture'], { cwd: projectRoot });
  return { root, projectRoot, userData, exportDirectory };
}

export async function seedProject(workspace: E2eWorkspace, project: ProjectRecord): Promise<void> {
  await writeFile(join(workspace.userData, 'store', 'state.json'), `${JSON.stringify({ version: 1, projects: [project], runs: [] }, null, 2)}\n`);
}

export async function launchApp(workspace: E2eWorkspace): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, DONEPROOF_USER_DATA: workspace.userData, DONEPROOF_E2E_EXPORT_DIR: workspace.exportDirectory }
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}
