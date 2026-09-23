import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/receipts/mixed-run.json';
import type { RunRecord } from '../../shared/models';
import { exportReceipt, renderHtmlReceipt, renderMarkdownReceipt } from './receipt';

let root: string;
let run: RunRecord;
const currentFingerprint = { versioned: true, branch: 'feature', head: 'new-head', diffHash: 'changed', contractHash: 'contract-v2' };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'doneproof-receipt-'));
  run = structuredClone(fixture) as RunRecord;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('receipt rendering', () => {
  it('renders criterion verdicts, git identity, staleness, and integrity failures', () => {
    const html = renderHtmlReceipt({ run, currentFingerprint });

    expect(html).toContain('Evidence integrity problem');
    expect(html).toContain('UNPROVEN');
    expect(html).toContain(run.fingerprint.head!);
    expect(html).toContain('Repository changed since this run');
    expect(html).toContain('Historical verdict remains');
    expect(html).toContain('UNPROVEN</span> Browser flow');
  });

  it('escapes user-controlled content and includes self-contained print styles', () => {
    const html = renderHtmlReceipt({ run, currentFingerprint: run.fingerprint });

    expect(html).toContain('&lt;script&gt;alert(&#39;unsafe&#39;)&lt;/script&gt;');
    expect(html).not.toContain("<script>alert('unsafe')</script>");
    expect(html).toContain('<style>');
    expect(html).toContain('@media print');
    expect(html).toContain('word-break: break-all');
    expect(html).not.toContain('rel="stylesheet"');
  });

  it('embeds small screenshots directly in standalone HTML', async () => {
    const screenshot = join(root, 'small.png');
    await writeFile(screenshot, Buffer.from('tiny-image'));
    run.evidence[1]!.artifacts = [{ path: screenshot, sha256: 'hash', mediaType: 'image/png', integrity: 'verified' }];

    const html = renderHtmlReceipt({ run, currentFingerprint: run.fingerprint });
    expect(html).toContain('data:image/png;base64,dGlueS1pbWFnZQ==');
  });

  it('renders Markdown with portable relative artifact links', () => {
    const markdown = renderMarkdownReceipt({
      run,
      currentFingerprint: run.fingerprint,
      artifactLinks: { 'missing-proof.png': 'assets/missing-proof.png' }
    });
    expect(markdown).toContain('![Browser flow](assets/missing-proof.png)');
    expect(markdown).toContain('## Acceptance criteria');
  });

  it('exports HTML, Markdown, and large screenshots without a server', async () => {
    const screenshot = join(root, 'large.png');
    await writeFile(screenshot, Buffer.alloc(300_000, 7));
    run.evidence[1]!.artifacts = [{ path: screenshot, sha256: 'hash', mediaType: 'image/png', integrity: 'verified' }];
    const directory = join(root, 'export');

    const exported = await exportReceipt({ run, currentFingerprint: run.fingerprint, directory });

    expect(await readFile(exported.htmlPath, 'utf8')).toContain(`assets/${basename(screenshot)}`);
    expect(await readFile(exported.markdownPath, 'utf8')).toContain(`assets/${basename(screenshot)}`);
    expect(await readdir(join(directory, 'assets'))).toContain(basename(screenshot));
  });
});
