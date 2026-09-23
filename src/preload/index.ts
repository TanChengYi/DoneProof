import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('doneproof', {
  productName: 'DoneProof',
  version: '0.1.0'
});
