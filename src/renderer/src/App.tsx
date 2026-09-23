import { FileCheck2, FolderGit2, GitBranch, Play, ReceiptText } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { RunEvent } from '../../shared/api';
import type { ProjectRecord, RunRecord } from '../../shared/models';
import { api } from './api';
import { ContractEditor } from './features/contract/ContractEditor';
import { ProjectLibrary } from './features/projects/ProjectLibrary';
import { ReceiptView } from './features/receipt/ReceiptView';
import { RunWorkspace } from './features/run/RunWorkspace';

type View = 'projects' | 'contract' | 'verify' | 'receipt';
const navigation = [
  { id: 'projects' as const, label: 'Projects', icon: FolderGit2 },
  { id: 'contract' as const, label: 'Contract', icon: FileCheck2 },
  { id: 'verify' as const, label: 'Verify', icon: Play },
  { id: 'receipt' as const, label: 'Receipts', icon: ReceiptText }
];

export function App(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [view, setView] = useState<View>('projects');
  const [run, setRun] = useState<RunRecord | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { void api.listProjects().then((items) => { setProjects(items); if (items[0]) { setProject(items[0]); setView('verify'); } }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Unable to load projects')); }, []);
  useEffect(() => api.onRunEvent((event) => {
    setEvents((current) => [...current, event]);
    if (event.type === 'run-completed') { setRun(event.run); setRunning(false); setView('receipt'); }
    if (event.type === 'run-failed') { setRunning(false); setNotice(event.message); }
  }), []);

  const chooseProject = async () => {
    const selected = await api.chooseProject();
    if (!selected) return;
    setProjects((current) => [...current.filter((item) => item.id !== selected.id), selected]);
    setProject(selected); setRun(null); setView('contract');
  };
  const startRun = async () => {
    if (!project) return;
    setEvents([]); setRunning(true); setView('verify');
    try { const started = await api.startRun(project.id); setRunId(started.runId); }
    catch (error) { setRunning(false); setNotice(error instanceof Error ? error.message : 'Unable to start verification'); }
  };
  const saveContract = async (contract: ProjectRecord['contract']) => {
    if (!project) return;
    const updated = await api.saveContract(project.id, contract);
    setProject(updated); setProjects((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice('Contract saved');
  };
  const exportCurrentReceipt = async () => {
    if (!run) return;
    const result = await api.exportReceipt(run.id);
    if (result) setNotice(`Receipt exported to ${result.htmlPath}`);
  };

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><FileCheck2 size={23} /><span>DoneProof</span></div><nav>{navigation.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} type="button" onClick={() => setView(item.id)} disabled={item.id !== 'projects' && !project}><item.icon size={18} /><span>{item.label}</span></button>)}</nav><div className="local-state"><span className="online-dot" /> Evidence stays local</div></aside>
    <section className="app-main">
      {project && view !== 'projects' ? <header className="project-header"><div><h1>{project.name}</h1><p>{project.root}</p></div><div className="repo-status"><GitBranch size={16} /><strong>{run?.fingerprint.branch ?? 'Local project'}</strong><span className="mono">{run?.fingerprint.head?.slice(0, 7) ?? 'Not run'}</span></div></header> : null}
      {project && view !== 'projects' ? <div className="workflow-tabs">{(['contract', 'verify', 'receipt'] as const).map((tab) => <button className={view === tab ? 'active' : ''} type="button" key={tab} onClick={() => setView(tab)}>{tab === 'contract' ? 'Contract' : tab === 'verify' ? 'Verify' : 'Receipt'}</button>)}</div> : null}
      <div className="content-area">
        {view === 'projects' ? <ProjectLibrary projects={projects} onChoose={() => void chooseProject()} onOpen={(item) => { setProject(item); setView('verify'); }} /> : null}
        {view === 'contract' && project ? <ContractEditor key={`${project.id}:${project.updatedAt}`} project={project} onSave={saveContract} /> : null}
        {view === 'verify' && project ? <RunWorkspace project={project} run={run} events={events} running={running} onStart={() => void startRun()} onCancel={() => { if (runId) void api.cancelRun(runId); }} /> : null}
        {view === 'receipt' ? <ReceiptView run={run} onExport={() => void exportCurrentReceipt()} /> : null}
      </div>
      {notice ? <button className="toast" type="button" onClick={() => setNotice(null)}>{notice}</button> : null}
    </section>
  </main>;
}
