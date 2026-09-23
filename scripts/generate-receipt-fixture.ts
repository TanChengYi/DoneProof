import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RunRecord } from '../src/shared/models';
import { exportReceipt } from '../src/main/services/receipt';

const fixturePath = resolve('tests/fixtures/receipts/mixed-run.json');
const directory = resolve('test-results/receipt-fixture');
const run = JSON.parse(await readFile(fixturePath, 'utf8')) as RunRecord;
const exported = await exportReceipt({ run, currentFingerprint: run.fingerprint, directory });

process.stdout.write(`Generated ${exported.htmlPath}\nGenerated ${exported.markdownPath}\n`);
