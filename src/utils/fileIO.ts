import { GridState, TexelFile } from '../types';

const FILE_VERSION = 1;

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
