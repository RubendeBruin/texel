import { app, BrowserWindow, shell, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// __dirname is available natively in CommonJS (compiled output)
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let win: BrowserWindow | null = null;

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'Texel',
    backgroundColor: '#1a1a2e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

// Native save dialog — if filePath provided write directly, else prompt
ipcMain.handle('texel:save-file', async (_, { content, filePath }: { content: string; filePath?: string }) => {
  let targetPath = filePath;
  if (!targetPath) {
    const result = await dialog.showSaveDialog(win!, {
      title: 'Save Texel file',
      defaultPath: 'Untitled.texel',
      filters: [{ name: 'Texel files', extensions: ['texel', 'json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    targetPath = result.filePath;
  }
  fs.writeFileSync(targetPath, content, 'utf-8');
  return targetPath;
});

// Native open dialog
ipcMain.handle('texel:open-file', async () => {
  const result = await dialog.showOpenDialog(win!, {
    title: 'Open Texel file',
    filters: [{ name: 'Texel files', extensions: ['texel', 'json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { content, filePath };
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
