import { realpath } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';

export async function assertInsideProject(projectRoot: string, candidate: string): Promise<string> {
  const [canonicalRoot, canonicalCandidate] = await Promise.all([realpath(projectRoot), realpath(candidate)]);
  const relation = relative(canonicalRoot, canonicalCandidate);
  if (relation === '..' || relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relation)) {
    throw new Error('Path is outside the selected project');
  }
  return canonicalCandidate;
}
