import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import type { ProjectRecord, ProofContract } from '../src/shared/models';
import { proofContractSchema } from '../src/shared/schemas';
import { createRunService } from '../src/main/services/run-service';
import { createRunner } from '../src/main/services/runner';
import { exportReceipt } from '../src/main/services/receipt';
import { createStore } from '../src/main/services/store';
import { fingerprintRepository } from '../src/main/domain/git-fingerprint';

const root = resolve('.');
const contractPath = join(root, 'doneproof.yml');
const contract = proofContractSchema.parse(parse(await readFile(contractPath, 'utf8'))) as ProofContract;
const stateRoot = join(root, '.doneproof', 'store');
const runId = randomUUID();
const runDirectory = join(root, '.doneproof', 'runs', runId);
await mkdir(runDirectory, { recursive: true });

const now = new Date().toISOString();
const project: ProjectRecord = {
  id: 'doneproof-self',
  name: 'DoneProof',
  root,
  createdAt: now,
  updatedAt: now,
  contract
};
const store = await createStore(stateRoot);
await store.saveProject(project);
const service = createRunService({ store, runner: createRunner(), createId: () => runId });

const run = await service.execute(
  { project, contractPath, artifactsDir: runDirectory },
  (event) => {
    if (event.type === 'evidence-started') process.stdout.write(`Running ${event.label}...\n`);
    if (event.type === 'evidence-completed') process.stdout.write(`${event.evidence.status.toUpperCase()} ${event.evidence.label}\n`);
  }
);
const currentFingerprint = await fingerprintRepository(root, contractPath);
const receipt = await exportReceipt({ run, currentFingerprint, directory: runDirectory });

process.stdout.write(`Verdict: ${run.verdict.toUpperCase()}\nReceipt: ${receipt.htmlPath}\n`);
if (run.verdict !== 'proven') process.exitCode = 1;
