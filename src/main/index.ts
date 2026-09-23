import { join } from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { registerIpc } from './ipc';
import { createStore } from './services/store';

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0f14',
    title: 'DoneProof',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) void window.loadURL(rendererUrl);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));

  return window;
}

void app.whenReady().then(async () => {
  if (app.isPackaged) {
    process.env['PLAYWRIGHT_BROWSERS_PATH'] = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'playwright-core', '.local-browsers');
  }
  const userDataRoot = process.env['DONEPROOF_USER_DATA'] ?? app.getPath('userData');
  const store = await createStore(join(userDataRoot, 'store'));
  registerIpc({ store });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
