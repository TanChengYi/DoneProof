import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { EvidenceArtifact, EvidenceResult, RepositoryFingerprint, RunRecord, Verdict } from '../../shared/models';
import bundledReceiptCss from '../templates/receipt.css?raw';

const receiptCss = bundledReceiptCss || readFileSync(new URL('../templates/receipt.css', import.meta.url), 'utf8');

const INLINE_SCREENSHOT_LIMIT = 256 * 1_024;

export interface ReceiptRenderInput {
  run: RunRecord;
  currentFingerprint: RepositoryFingerprint;
  artifactLinks?: Record<string, string>;
}

export interface ReceiptExportInput extends ReceiptRenderInput {
  directory: string;
}

export interface ExportedReceipt {
  htmlPath: string;
  markdownPath: string;
  assetPaths: string[];
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const markdownText = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const token = (verdict: Verdict): string => `<span class="verdict ${verdict}">${verdict.toUpperCase()}</span>`;

function isStale(run: RunRecord, current: RepositoryFingerprint): boolean {
  return run.fingerprint.head !== current.head
    || run.fingerprint.diffHash !== current.diffHash
    || run.fingerprint.contractHash !== current.contractHash;
}

function artifactLink(artifact: EvidenceArtifact, links: Record<string, string> = {}): string {
  return links[artifact.path] ?? links[basename(artifact.path)] ?? basename(artifact.path);
}

function htmlArtifact(artifact: EvidenceArtifact, label: string, links: Record<string, string> = {}): string {
  if (artifact.integrity !== 'verified') {
    return `<p class="integrity">Evidence integrity problem: ${escapeHtml(artifact.integrity)} — ${escapeHtml(artifact.path)}</p>`;
  }
  if (artifact.mediaType.startsWith('image/') && existsSync(artifact.path)) {
    const details = statSync(artifact.path);
    if (details.size <= INLINE_SCREENSHOT_LIMIT) {
      const encoded = readFileSync(artifact.path).toString('base64');
      return `<img src="data:${escapeHtml(artifact.mediaType)};base64,${encoded}" alt="${escapeHtml(label)}">`;
    }
  }
  return `<p><a href="${escapeHtml(artifactLink(artifact, links))}">Open ${escapeHtml(basename(artifact.path))}</a></p>`;
}

function evidenceHtml(evidence: EvidenceResult, links: Record<string, string>): string {
  const displayVerdict: Verdict = evidence.artifacts.some((item) => item.integrity !== 'verified')
    ? 'unproven'
    : evidence.status === 'passed' ? 'proven' : evidence.status;
  const reason = evidence.reason ? `<p>${escapeHtml(evidence.reason)}</p>` : '';
  const output = evidence.output ? `<pre>${escapeHtml(evidence.output)}</pre>` : '';
  const artifacts = evidence.artifacts.map((item) => htmlArtifact(item, evidence.label, links)).join('');
  return `<details class="card"><summary>${token(displayVerdict)} ${escapeHtml(evidence.label)}</summary>
    <p class="muted">${escapeHtml(evidence.kind)} · ${evidence.durationMs} ms</p>${reason}${output}${artifacts}</details>`;
}

export function renderHtmlReceipt(input: ReceiptRenderInput): string {
  const { run, currentFingerprint } = input;
  const stale = isStale(run, currentFingerprint);
  const criteriaRows = run.criteria.map((result) => {
    const criterion = run.contract.criteria.find((item) => item.id === result.criterionId);
    return `<tr><td>${escapeHtml(criterion?.text ?? result.criterionId)}</td><td>${criterion?.required ? 'Required' : 'Informational'}</td><td>${token(result.verdict)}</td><td>${escapeHtml(result.reason)}</td></tr>`;
  }).join('');
  const integrityProblems = run.evidence.flatMap((item) => item.artifacts).filter((item) => item.integrity !== 'verified');
  const staleNotice = stale
    ? '<div class="notice"><strong>Repository changed since this run.</strong> Historical verdict remains recorded below; rerun verification before treating it as current.</div>'
    : '<p class="muted">Repository fingerprint still matches this historical run.</p>';
  const integrityNotice = integrityProblems.length
    ? `<div class="notice integrity">Evidence integrity problem: ${integrityProblems.length} artifact(s) are missing or do not match their recorded hash.</div>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DoneProof receipt — ${escapeHtml(run.id)}</title><style>${receiptCss}</style></head>
<body><main>
<header><p class="eyebrow">DoneProof delivery receipt</p><h1>${escapeHtml(run.contract.goal)}</h1>${token(run.verdict)}</header>
<section><h2>Receipt status</h2>${staleNotice}${integrityNotice}</section>
<section><h2>Repository identity</h2><div class="grid">
  <div class="card"><strong>Run commit</strong><p><code>${escapeHtml(run.fingerprint.head ?? 'Unversioned')}</code></p></div>
  <div class="card"><strong>Run branch</strong><p>${escapeHtml(run.fingerprint.branch ?? 'Detached / unavailable')}</p></div>
  <div class="card"><strong>Current commit</strong><p><code>${escapeHtml(currentFingerprint.head ?? 'Unversioned')}</code></p></div>
  <div class="card"><strong>Completed</strong><p>${escapeHtml(run.completedAt ?? 'Interrupted')}</p></div>
</div></section>
<section><h2>Acceptance criteria</h2><table><thead><tr><th>Criterion</th><th>Role</th><th>Verdict</th><th>Reason</th></tr></thead><tbody>${criteriaRows}</tbody></table></section>
<section><h2>Technical evidence</h2><div class="grid">${run.evidence.map((item) => evidenceHtml(item, input.artifactLinks ?? {})).join('')}</div></section>
</main></body></html>`;
}

export function renderMarkdownReceipt(input: ReceiptRenderInput): string {
  const { run, currentFingerprint } = input;
  const stale = isStale(run, currentFingerprint);
  const lines = [
    `# DoneProof receipt: ${markdownText(run.contract.goal)}`,
    '',
    `**Verdict:** ${run.verdict.toUpperCase()}`,
    '',
    stale
      ? '> Repository changed since this run. Historical verdict remains recorded; rerun verification before treating it as current.'
      : '> Repository fingerprint still matches this historical run.',
    '',
    `- Run commit: \`${run.fingerprint.head ?? 'Unversioned'}\``,
    `- Current commit: \`${currentFingerprint.head ?? 'Unversioned'}\``,
    `- Completed: ${run.completedAt ?? 'Interrupted'}`,
    '',
    '## Acceptance criteria',
    '',
    '| Criterion | Role | Verdict | Reason |',
    '| --- | --- | --- | --- |',
    ...run.criteria.map((result) => {
      const criterion = run.contract.criteria.find((item) => item.id === result.criterionId);
      return `| ${markdownText(criterion?.text ?? result.criterionId)} | ${criterion?.required ? 'Required' : 'Informational'} | ${result.verdict.toUpperCase()} | ${markdownText(result.reason)} |`;
    }),
    '',
    '## Technical evidence',
    ''
  ];
  for (const evidence of run.evidence) {
    const displayStatus = evidence.artifacts.some((item) => item.integrity !== 'verified') ? 'UNPROVEN' : evidence.status.toUpperCase();
    lines.push(`### ${markdownText(evidence.label)} — ${displayStatus}`, '');
    if (evidence.reason) lines.push(evidence.reason, '');
    if (evidence.output) lines.push('```text', evidence.output, '```', '');
    for (const artifact of evidence.artifacts) {
      if (artifact.integrity !== 'verified') lines.push(`**Evidence integrity problem:** ${artifact.integrity} — \`${artifact.path}\``, '');
      if (artifact.mediaType.startsWith('image/')) lines.push(`![${markdownText(evidence.label)}](${artifactLink(artifact, input.artifactLinks)})`, '');
      else lines.push(`[${basename(artifact.path)}](${artifactLink(artifact, input.artifactLinks)})`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

export async function exportReceipt(input: ReceiptExportInput): Promise<ExportedReceipt> {
  await mkdir(input.directory, { recursive: true });
  const assetsDirectory = join(input.directory, 'assets');
  const artifactLinks: Record<string, string> = {};
  const assetPaths: string[] = [];
  for (const artifact of input.run.evidence.flatMap((item) => item.artifacts)) {
    try {
      await stat(artifact.path);
    } catch {
      continue;
    }
    await mkdir(assetsDirectory, { recursive: true });
    const target = join(assetsDirectory, basename(artifact.path));
    await copyFile(artifact.path, target);
    const relative = `assets/${basename(artifact.path)}`;
    artifactLinks[artifact.path] = relative;
    artifactLinks[basename(artifact.path)] = relative;
    assetPaths.push(target);
  }
  const renderInput = { run: input.run, currentFingerprint: input.currentFingerprint, artifactLinks };
  const htmlPath = join(input.directory, 'receipt.html');
  const markdownPath = join(input.directory, 'receipt.md');
  await Promise.all([
    writeFile(htmlPath, renderHtmlReceipt(renderInput), 'utf8'),
    writeFile(markdownPath, renderMarkdownReceipt(renderInput), 'utf8')
  ]);
  return { htmlPath, markdownPath, assetPaths };
}
