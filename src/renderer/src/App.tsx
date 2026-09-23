import { CheckCircle2, FileCheck2, FolderGit2, ShieldCheck } from 'lucide-react';

const proofPoints = [
  ['Acceptance criteria', 'Every requirement gets a verdict.'],
  ['Deterministic checks', 'Build, test, lint, and typecheck stay inspectable.'],
  ['Browser proof', 'Assertions and screenshots show real behavior.']
] as const;

export function App(): React.JSX.Element {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><FileCheck2 size={22} /> DoneProof</div>
        <div className="local-badge"><ShieldCheck size={14} /> Local evidence only</div>
      </header>
      <section className="hero">
        <div className="eyebrow">EVIDENCE-BACKED DELIVERY</div>
        <h1>“Done” is a claim.<br /><span>Proof is inspectable.</span></h1>
        <p>Turn acceptance criteria into a version-bound delivery receipt with command logs, browser assertions, screenshots, and Git identity.</p>
        <button className="primary" type="button"><FolderGit2 size={18} /> Choose a project</button>
      </section>
      <section className="proof-grid" aria-label="DoneProof capabilities">
        {proofPoints.map(([title, body]) => (
          <article className="proof-card" key={title}>
            <CheckCircle2 size={18} />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
