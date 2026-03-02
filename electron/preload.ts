// Preload runs in a sandboxed context before the renderer.
// Expose only what the renderer needs via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('texelAPI', {
  platform: process.platform,
  saveFile: (content: string, filePath?: string): Promise<string | null> =>
    ipcRenderer.invoke('texel:save-file', { content, filePath }),
  openFile: (): Promise<{ content: string; filePath: string } | null> =>
    ipcRenderer.invoke('texel:open-file'),
});
