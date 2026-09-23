import { FolderGit2, Plus } from 'lucide-react';
import React from 'react';
import type { ProjectRecord } from '../../../../shared/models';

interface Props { projects: ProjectRecord[]; onChoose(): void; onOpen(project: ProjectRecord): void }

export function ProjectLibrary({ projects, onChoose, onOpen }: Props): React.JSX.Element {
  if (projects.length === 0) return (
    <section className="empty-state">
      <div className="empty-icon"><FolderGit2 /></div>
      <h1>No projects yet</h1>
      <p>Choose a local Git repository. DoneProof will detect deterministic checks without running anything.</p>
      <button className="button primary" type="button" onClick={onChoose}><Plus size={17} /> Choose repository</button>
    </section>
  );
  return (
    <section className="page-stack">
      <div className="page-heading"><div><h1>Projects</h1><p>Your local proof workspaces.</p></div><button className="button primary" type="button" onClick={onChoose}><Plus size={17} /> Add repository</button></div>
      <div className="project-list">
        {projects.map((project) => <button type="button" className="project-row" key={project.id} onClick={() => onOpen(project)}>
          <FolderGit2 size={20} /><span><strong>{project.name}</strong><small>{project.root}</small></span><span className="row-meta">{project.contract.criteria.length} criteria</span>
        </button>)}
      </div>
    </section>
  );
}
