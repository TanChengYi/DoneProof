import { contextBridge, ipcRenderer } from 'electron';
import { createDoneProofBridge } from './bridge';

contextBridge.exposeInMainWorld('doneproof', createDoneProofBridge(ipcRenderer));
