import { describe, expect, it, vi } from 'vitest';
import { ipcPayloadSchemas } from './ipc';
import { createDoneProofBridge } from '../preload/bridge';

describe('preload bridge', () => {
  it('does not expose arbitrary process execution', () => {
    const exposedBridge = createDoneProofBridge({
      invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn()
    });
    expect(Object.keys(exposedBridge).sort()).toEqual([
      'cancelRun', 'chooseProject', 'exportReceipt', 'getProject', 'getRun',
      'listProjects', 'onRunEvent', 'saveContract', 'startRun'
    ]);
  });

  it('rejects malformed IPC payloads before privileged work', () => {
    expect(ipcPayloadSchemas.saveContract.safeParse({ projectId: '', contract: {} }).success).toBe(false);
    expect(ipcPayloadSchemas.startRun.safeParse({ projectId: '../escape' }).success).toBe(false);
    expect(ipcPayloadSchemas.getRun.safeParse({ runId: '' }).success).toBe(false);
  });
});
