import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { RepositoryFingerprint } from '../../shared/models';

const executeFile = promisify(execFile);

interface FingerprintOptions {
  gitExecutable?: string;
}

const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

async function optionalFileHash(path: string): Promise<string | null> {
  try {
    return sha256(await readFile(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function fingerprintRepository(
  root: string,
  contractPath: string,
  options: FingerprintOptions = {}
): Promise<RepositoryFingerprint> {
  const gitExecutable = options.gitExecutable ?? 'git';
  const contractHash = await optionalFileHash(contractPath);
  const git = async (args: string[]): Promise<string> => {
    const { stdout } = await executeFile(gitExecutable, args, { cwd: root, encoding: 'utf8', windowsHide: true });
    return stdout;
  };

  try {
    await git(['rev-parse', '--is-inside-work-tree']);
  } catch {
    return { versioned: false, branch: null, head: null, diffHash: sha256('git-unavailable'), contractHash };
  }

  const branch = (await git(['branch', '--show-current'])).trim() || null;
  let head: string | null;
  try {
    head = (await git(['rev-parse', 'HEAD'])).trim();
  } catch {
    head = null;
  }

  const [status, diff, untracked] = await Promise.all([
    git(['status', '--porcelain=v1', '-z']),
    git(['diff', '--binary', '--no-ext-diff']),
    git(['ls-files', '--others', '--exclude-standard', '-z'])
  ]);
  const untrackedHashes: string[] = [];
  for (const file of untracked.split('\0').filter(Boolean).sort()) {
    untrackedHashes.push(`${file}:${sha256(await readFile(new URL(`file:///${root.replaceAll('\\', '/')}/${file}`)))}`);
  }

  return {
    versioned: head !== null,
    branch,
    head,
    diffHash: sha256(`${status}\n${diff}\n${untrackedHashes.join('\n')}`),
    contractHash
  };
}
