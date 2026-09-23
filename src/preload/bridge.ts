import type { DoneProofApi, RunEvent } from '../shared/api';
import type { ProofContract } from '../shared/models';

interface IpcRendererLike {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, payload: RunEvent) => void): unknown;
  removeListener(channel: string, listener: (event: unknown, payload: RunEvent) => void): unknown;
}

export function createDoneProofBridge(ipc: IpcRendererLike): DoneProofApi {
  return {
    listProjects: () => ipc.invoke('doneproof:list-projects') as ReturnType<DoneProofApi['listProjects']>,
    chooseProject: () => ipc.invoke('doneproof:choose-project') as ReturnType<DoneProofApi['chooseProject']>,
    getProject: (projectId: string) => ipc.invoke('doneproof:get-project', { projectId }) as ReturnType<DoneProofApi['getProject']>,
    saveContract: (projectId: string, contract: ProofContract) => ipc.invoke('doneproof:save-contract', { projectId, contract }) as ReturnType<DoneProofApi['saveContract']>,
    startRun: (projectId: string) => ipc.invoke('doneproof:start-run', { projectId }) as ReturnType<DoneProofApi['startRun']>,
    cancelRun: (runId: string) => ipc.invoke('doneproof:cancel-run', { runId }) as ReturnType<DoneProofApi['cancelRun']>,
    getRun: (runId: string) => ipc.invoke('doneproof:get-run', { runId }) as ReturnType<DoneProofApi['getRun']>,
    exportReceipt: (runId: string) => ipc.invoke('doneproof:export-receipt', { runId }) as ReturnType<DoneProofApi['exportReceipt']>,
    onRunEvent: (listener) => {
      const wrapped = (_event: unknown, payload: RunEvent) => listener(payload);
      ipc.on('doneproof:run-event', wrapped);
      return () => ipc.removeListener('doneproof:run-event', wrapped);
    }
  };
}
