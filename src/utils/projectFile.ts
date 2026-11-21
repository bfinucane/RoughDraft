import type { ProjectData } from '../types/wireframe';

export interface RoughDraftFileHandle {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}

interface PickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<RoughDraftFileHandle>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<RoughDraftFileHandle[]>;
}

export function getSuggestedProjectFilename(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'roughdraft-project'}.roughdraft.json`;
}

export function supportsInPlaceFileSaving(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as PickerWindow;
  return typeof w.showSaveFilePicker === 'function';
}

export async function writeProjectToHandle(
  handle: RoughDraftFileHandle,
  project: ProjectData
): Promise<void> {
  if (handle.queryPermission && handle.requestPermission) {
    const current = await handle.queryPermission({ mode: 'readwrite' });
    if (current !== 'granted') {
      const requested = await handle.requestPermission({ mode: 'readwrite' });
      if (requested !== 'granted') {
        throw new Error('Write permission was denied for this file.');
      }
    }
  }

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(project, null, 2));
  await writable.close();
}

export type SaveFileResult =
  | { status: 'saved'; handle: RoughDraftFileHandle; fileName: string }
  | { status: 'cancelled' }
  | { status: 'fallback-required' };

export async function pickAndSaveProjectFile(
  project: ProjectData
): Promise<SaveFileResult> {
  const w = window as unknown as PickerWindow;
  if (typeof w.showSaveFilePicker !== 'function') {
    return { status: 'fallback-required' };
  }

  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: getSuggestedProjectFilename(project.name),
      types: [
        {
          description: 'RoughDraft Project (.roughdraft.json)',
          accept: { 'application/json': ['.roughdraft.json', '.json'] },
        },
      ],
    });
    await writeProjectToHandle(handle, project);
    return { status: 'saved', handle, fileName: handle.name };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    if (
      err instanceof DOMException &&
      (err.name === 'SecurityError' || err.name === 'NotAllowedError')
    ) {
      return { status: 'fallback-required' };
    }
    throw err;
  }
}

export type OpenFileResult =
  | {
      status: 'opened';
      handle: RoughDraftFileHandle;
      fileName: string;
      data: ProjectData;
    }
  | { status: 'cancelled' }
  | { status: 'invalid'; message: string }
  | { status: 'fallback-required' };

export async function pickAndOpenProjectFile(): Promise<OpenFileResult> {
  const w = window as unknown as PickerWindow;
  if (typeof w.showOpenFilePicker !== 'function') {
    return { status: 'fallback-required' };
  }

  try {
    const [handle] = await w.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'RoughDraft Project (.roughdraft.json)',
          accept: { 'application/json': ['.roughdraft.json', '.json'] },
        },
      ],
    });
    if (!handle) return { status: 'cancelled' };
    const file = await handle.getFile();
    const rawText = await file.text();
    const parsed = JSON.parse(rawText) as ProjectData;
    if (!parsed || !Array.isArray(parsed.screens) || parsed.screens.length === 0) {
      return {
        status: 'invalid',
        message: 'Selected file is not a valid RoughDraft project.',
      };
    }
    return { status: 'opened', handle, fileName: handle.name, data: parsed };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    if (
      err instanceof DOMException &&
      (err.name === 'SecurityError' || err.name === 'NotAllowedError')
    ) {
      return { status: 'fallback-required' };
    }
    if (err instanceof SyntaxError) {
      return {
        status: 'invalid',
        message: 'Could not parse JSON in the selected file.',
      };
    }
    throw err;
  }
}

export function downloadProjectJsonCopy(project: ProjectData): string {
  const fileName = getSuggestedProjectFilename(project.name);
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
