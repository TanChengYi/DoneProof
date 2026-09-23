import { Check, ChevronRight, Circle, Play, Square, Terminal } from 'lucide-react';
import React from 'react';
import type { RunEvent } from '../../../../shared/api';
import type { ProjectRecord, RunRecord } from '../../../../shared/models';

interface Props { project: ProjectRecord; run: RunRecord | null; events: RunEvent[]; running: boolean; onStart(): void; onCancel(): void }

const command = (executable: string, args: string[]) => `${executable} ${args.join(' ')}`;

export function RunWorkspace({ project, run, events, running, onStart, onCancel }: Props): React.JSX.Element {
  const latestStarted = [...events].reverse().find((event) => event.type === 'evidence-started');
  const evidenceById = new Map(run?.evidence.map((item) => [item.id, item]));
  const checks = [...project.contract.checks.map((item) => ({ id: item.id, label: item.label, command: command(item.executable, item.args) })), ...project.contract.scenarios.map((item) => ({ id: item.id, label: item.name, command: `Browser · ${item.baseUrl}` }))];
  const logs = run?.evidence.flatMap((item) => item.output ? [`✓ ${item.label}`, item.output] : [item.reason ?? item.label]) ?? ['Ready. Review the manifest, then start verification.'];
  return (
    <section className="verify-page">
      <div className="workspace-grid">
        <aside className="criteria-rail panel"><div className="panel-title"><h2>Acceptance criteria</h2><span>{project.contract.criteria.length} items</span></div>{project.contract.criteria.map((criterion, index) => { const verdict = run?.criteria.find((item) => item.criterionId === criterion.id)?.verdict; return <div className={`criterion-row ${verdict ?? ''}`} key={criterion.id}><span className="status-square">{verdict === 'proven' ? <Check size={14} /> : <Circle size={14} />}</span><span className="ordinal">{index + 1}</span><span><strong>{criterion.text}</strong><small>{criterion.required ? 'Required' : 'Informational'}</small></span></div>; })}</aside>
        <section className="manifest panel"><div className="panel-title"><div><h2>{run ? 'Run manifest' : 'Review run manifest'}</h2><span>{run ? 'Evidence is recorded sequentially.' : 'Nothing runs until you confirm.'}</span></div></div>
          <div className="timeline">{checks.map((check, index) => { const evidence = evidenceById.get(check.id); const active = latestStarted?.type === 'evidence-started' && latestStarted.evidenceId === check.id && running; return <div className={`timeline-row ${evidence?.status ?? (active ? 'running' : 'queued')}`} key={check.id}><span className="timeline-node">{evidence?.status === 'passed' ? <Check size={14} /> : <Circle size={15} />}</span><span className="ordinal">{index + 1}</span><div><strong>{check.label}</strong><small>{check.command}</small><button className="output-link" type="button"><ChevronRight size={13} /> Show output</button></div><span className="timeline-status">{evidence?.status ?? (active ? 'running' : 'queued')}</span></div>; })}</div>
        </section>
        <aside className="summary panel"><div className="panel-title"><h2>Verification summary</h2></div><div className={`verdict-block ${run?.verdict ?? 'unproven'}`}><span className="verdict-ring" /><div><strong>{(run?.verdict ?? 'unproven').toUpperCase()}</strong><small>{running ? 'Verification in progress' : run ? 'Historical run result' : 'Ready to collect evidence'}</small></div></div>
          <dl><div><dt>Repository</dt><dd>{project.root}</dd></div><div><dt>Branch</dt><dd>{run?.fingerprint.branch ?? 'Captured at run time'}</dd></div><div><dt>Commit</dt><dd className="mono">{run?.fingerprint.head?.slice(0, 12) ?? '—'}</dd></div><div><dt>Evidence</dt><dd>{run?.evidence.length ?? 0} / {checks.length}</dd></div></dl>
          {running ? <button className="button danger full" type="button" onClick={onCancel}><Square size={15} /> Cancel run</button> : <button className="button primary full" type="button" onClick={onStart}><Play size={17} /> Run verification</button>}
        </aside>
      </div>
      <section className="console panel"><div className="console-head"><span><Terminal size={15} /> Live console</span><span className={running ? 'streaming' : ''}>{running ? 'Streaming…' : 'Idle'}</span></div><pre>{latestStarted?.type === 'evidence-started' ? `Running ${latestStarted.label}…\n` : ''}{logs.join('\n')}</pre></section>
    </section>
  );
}
