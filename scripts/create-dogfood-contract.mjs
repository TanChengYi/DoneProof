import { writeFile } from 'node:fs/promises';
import { stringify } from 'yaml';

const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  ['lint', 'Lint passes', ['run', 'lint'], 300_000],
  ['typecheck', 'TypeScript compiles', ['run', 'typecheck'], 300_000],
  ['test', 'Unit and integration tests pass', ['test'], 600_000],
  ['e2e', 'Electron user journeys pass', ['run', 'test:e2e'], 600_000],
  ['build', 'Production bundles build', ['run', 'build'], 300_000],
  ['receipt', 'Standalone receipt fixture exports', ['run', 'generate:receipt-fixture'], 300_000]
].map(([id, label, args, timeoutMs]) => ({
  id,
  label,
  executable,
  args,
  timeoutMs,
  maxOutputBytes: 2_000_000
}));

const contract = {
  version: 1,
  goal: 'Prove DoneProof is ready to deliver as a local Windows desktop application',
  criteria: checks.map((check) => ({
    id: `criterion-${check.id}`,
    text: check.label,
    required: true,
    evidenceIds: [check.id]
  })),
  checks,
  scenarios: []
};

await writeFile('doneproof.yml', stringify(contract), 'utf8');
process.stdout.write('Generated doneproof.yml\n');
