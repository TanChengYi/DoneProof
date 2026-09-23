import { Download, FileCheck2 } from 'lucide-react';
import React from 'react';
import type { RunRecord } from '../../../../shared/models';

interface Props { run: RunRecord | null; onExport(): void }

export function ReceiptView({ run, onExport }: Props): React.JSX.Element {
  if (!run) return <section className="empty-state"><div className="empty-icon"><FileCheck2 /></div><h1>No receipt yet</h1><p>Run verification to create a version-bound delivery receipt.</p></section>;
  const heading = run.verdict === 'proven' ? 'Delivery is proven' : run.verdict === 'failed' ? 'Verification found failures' : 'Not enough evidence yet';
  return <section className="page-stack receipt-page"><div className="page-heading"><div><h1>{heading}</h1><p>Historical verdict for commit <span className="mono">{run.fingerprint.head?.slice(0, 12) ?? 'unversioned'}</span>.</p></div><button className="button primary" type="button" onClick={onExport}><Download size={16} /> Export receipt</button></div><div className={`receipt-verdict ${run.verdict}`}><strong>{run.verdict.toUpperCase()}</strong><span>{run.criteria.filter((item) => item.verdict === 'proven').length} of {run.criteria.length} criteria proven</span></div><div className="receipt-table">{run.criteria.map((result) => { const criterion = run.contract.criteria.find((item) => item.id === result.criterionId); return <div className="receipt-row" key={result.criterionId}><span className={`status-dot ${result.verdict}`} /><div><strong>{criterion?.text ?? result.criterionId}</strong><p>{result.reason}</p></div><span>{result.verdict.toUpperCase()}</span></div>; })}</div><section><h2>Evidence</h2>{run.evidence.map((item) => <details className="evidence-detail" key={item.id}><summary><span>{item.label}</span><strong>{item.status.toUpperCase()}</strong></summary>{item.reason ? <p>{item.reason}</p> : null}{item.output ? <pre>{item.output}</pre> : null}</details>)}</section></section>;
}
