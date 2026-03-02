import { GridState, TexelFile } from '../types';

const FILE_VERSION = 1;

// TypeScript: augment window with the Electron preload API
declare global {
  interface Window {
    texelAPI?: {
      platform: string;
      saveFile?: (content: string, filePath?: string) => Promise<string | null>;
      openFile?: () => Promise<{ content: string; filePath: string } | null>;
    };
  }
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.texelAPI?.saveFile === 'function';
}

export function gridToJson(grid: GridState, title = 'Untitled'): string {
  const file: TexelFile = {
    version: FILE_VERSION,
    grid,
    metadata: {
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(file, null, 2);
}

export function jsonToGrid(json: string): TexelFile {
  const parsed = JSON.parse(json) as TexelFile;
  if (!parsed.version || !parsed.grid) {
    throw new Error('Invalid Texel file format');
  }
  return parsed;
}

export function saveFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save using native dialog in Electron or browser download fallback.
 * Returns the file path used (Electron) or the derived filename (browser), or null if cancelled.
 */
export async function saveFileAuto(
  content: string,
  title: string,
  lastPath: string | null,
): Promise<string | null> {
  if (isElectron()) {
    return window.texelAPI!.saveFile!(content, lastPath ?? undefined);
  }
  const filename = lastPath ?? `${title || 'texel'}.texel`;
  saveFile(content, filename, 'application/json');
  return filename;
}

export function openFileDialog(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.texel,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * Open using native dialog in Electron or browser file input fallback.
 * Returns { content, filePath } or null if cancelled.
 */
export async function openFileAuto(): Promise<{ content: string; filePath: string } | null> {
  if (isElectron()) {
    return window.texelAPI!.openFile!();
  }
  try {
    const content = await openFileDialog();
    return { content, filePath: '' };
  } catch {
    return null;
  }
}
