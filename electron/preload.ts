// Preload runs in a sandboxed context before the renderer.
// Expose only what the renderer needs via contextBridge.
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('texelAPI', {
  platform: process.platform,
});
