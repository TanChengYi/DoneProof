import { Plus, Save, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import type { ProjectRecord, ProofContract } from '../../../../shared/models';

interface Props { project: ProjectRecord; onSave(contract: ProofContract): void | Promise<void> }

export function ContractEditor({ project, onSave }: Props): React.JSX.Element {
  const [contract, setContract] = useState(() => structuredClone(project.contract));
  const invalid = contract.criteria.some((item) => !item.text.trim()) || !contract.goal.trim();
  const updateCriterion = (index: number, patch: Partial<ProofContract['criteria'][number]>) => setContract((current) => ({ ...current, criteria: current.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  return (
    <section className="page-stack contract-page">
      <div className="page-heading"><div><h1>Proof contract</h1><p>Define exactly what “done” means and which evidence proves it.</p></div><button className="button primary" disabled={invalid} type="button" onClick={() => void onSave(contract)}><Save size={16} /> Save contract</button></div>
      <label className="field"><span>Delivery goal</span><textarea value={contract.goal} onChange={(event) => setContract({ ...contract, goal: event.target.value })} /></label>
      <div className="section-heading"><div><h2>Acceptance criteria</h2><p>Required criteria block the final verdict.</p></div><button className="button secondary" type="button" onClick={() => setContract((current) => ({ ...current, criteria: [...current.criteria, { id: crypto.randomUUID(), text: '', required: true, evidenceIds: [] }] }))}><Plus size={15} /> Add criterion</button></div>
      <div className="criteria-editor">
        {contract.criteria.map((criterion, index) => <article className="criterion-editor" key={criterion.id}>
          <div className="criterion-number">{index + 1}</div>
          <div className="criterion-fields">
            <label className="field"><span>Criterion {index + 1}</span><input aria-label={`Criterion ${index + 1}`} value={criterion.text} onChange={(event) => updateCriterion(index, { text: event.target.value })} /></label>
            {!criterion.text.trim() ? <p className="form-error" role="alert">Criterion text is required</p> : null}
            <label className="check-line"><input type="checkbox" checked={criterion.required} onChange={(event) => updateCriterion(index, { required: event.target.checked })} /> Required for project verdict</label>
            <fieldset><legend>Evidence checks</legend><div className="check-grid">{contract.checks.map((check) => <label className="check-option" key={check.id}><input aria-label={check.label} type="checkbox" checked={criterion.evidenceIds.includes(check.id)} onChange={(event) => updateCriterion(index, { evidenceIds: event.target.checked ? [...criterion.evidenceIds, check.id] : criterion.evidenceIds.filter((id) => id !== check.id) })} /><span><strong>{check.label}</strong><small>{check.executable} {check.args.join(' ')}</small></span></label>)}</div></fieldset>
          </div>
          <button className="icon-button" type="button" aria-label={`Delete criterion ${index + 1}`} onClick={() => setContract((current) => ({ ...current, criteria: current.criteria.filter((item) => item.id !== criterion.id) }))}><Trash2 size={16} /></button>
        </article>)}
      </div>
    </section>
  );
}
