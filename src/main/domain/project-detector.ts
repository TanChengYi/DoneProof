import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CheckDefinition } from '../../shared/models';

export interface ProjectDetection {
  root: string;
  stacks: Array<'node' | 'python'>;
  checks: CheckDefinition[];
}

const checkDefaults = { timeoutMs: 300_000, maxOutputBytes: 2_000_000 } as const;

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function npmCheck(name: string): CheckDefinition {
  return { id: `npm:${name}`, label: `npm run ${name}`, executable: 'npm', args: ['run', name], ...checkDefaults };
}

function pythonCheck(id: string, label: string, args: string[]): CheckDefinition {
  return { id: `python:${id}`, label, executable: 'python', args, ...checkDefaults };
}

export async function detectProject(root: string): Promise<ProjectDetection> {
  const stacks: ProjectDetection['stacks'] = [];
  const checks: CheckDefinition[] = [];
  const packageSource = await readOptional(join(root, 'package.json'));
  if (packageSource) {
    const packageJson = JSON.parse(packageSource) as { scripts?: Record<string, string> };
    stacks.push('node');
    for (const name of ['test', 'lint', 'build', 'typecheck']) {
      if (typeof packageJson.scripts?.[name] === 'string') checks.push(npmCheck(name));
    }
  }

  const pyproject = await readOptional(join(root, 'pyproject.toml'));
  if (pyproject) {
    stacks.push('python');
    if (/^\[tool\.pytest(?:\.ini_options)?\]/m.test(pyproject)) checks.push(pythonCheck('pytest', 'python -m pytest', ['-m', 'pytest']));
    if (/^\[tool\.ruff\]/m.test(pyproject)) checks.push(pythonCheck('ruff', 'python -m ruff check .', ['-m', 'ruff', 'check', '.']));
    if (/^\[tool\.mypy\]/m.test(pyproject)) checks.push(pythonCheck('mypy', 'python -m mypy .', ['-m', 'mypy', '.']));
    if (/^\[build-system\]/m.test(pyproject)) checks.push(pythonCheck('build', 'python -m build', ['-m', 'build']));
  }

  return { root, stacks, checks };
}
