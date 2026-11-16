/**
 * Saving and opening through the system file dialogs (File System Access API:
 * Chrome, Edge, Brave, Opera on desktop). Browsers without it (Safari, Firefox)
 * fall back to a download and a plain file input.
 *
 * The save dialog may only open in response to a click or key press, so call
 * `chooseSaveTarget` first, before any slow work (building a PDF), then
 * `writeTarget` with the finished file.
 */
import { downloadBlob, pickFile } from './download';

export type FileKind = 'project' | 'pdf' | 'png' | 'svg';

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

const TYPES: Record<FileKind, PickerType> = {
  project: { description: 'Bubble diagram', accept: { 'application/json': ['.json'] } },
  pdf: { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } },
  png: { description: 'PNG image', accept: { 'image/png': ['.png'] } },
  svg: { description: 'SVG image', accept: { 'image/svg+xml': ['.svg'] } },
};

/** The parts of the API that TypeScript's DOM types don't include yet. */
interface PickerWindow {
  showSaveFilePicker?: (o: { suggestedName?: string; types?: PickerType[]; id?: string }) => Promise<FileHandle>;
  showOpenFilePicker?: (o: { types?: PickerType[]; multiple?: false; id?: string }) => Promise<FileHandle[]>;
}
export type FileHandle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
};

// always call the pickers as methods of window: detached, Chrome throws "Illegal invocation"
const picker = () => window as unknown as PickerWindow;
/** each id remembers its own last folder: drawings in one place, exports in another */
const pickerId = (kind: FileKind) => (kind === 'project' ? 'bubble-diagram-projects' : 'bubble-diagram-exports');

/** Where a save goes: a file the user chose, or (no dialog available) a download. */
export type SaveTarget = { handle: FileHandle; name: string } | { download: string; name: string };

const cancelled = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Ask where to save. Null when the user cancels. */
export async function chooseSaveTarget(kind: FileKind, suggestedName: string): Promise<SaveTarget | null> {
  const w = picker();
  if (!w.showSaveFilePicker) return { download: suggestedName, name: suggestedName };
  try {
    const handle = await w.showSaveFilePicker({ suggestedName, types: [TYPES[kind]], id: pickerId(kind) });
    return { handle, name: handle.name };
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

export async function writeTarget(target: SaveTarget, blob: Blob): Promise<void> {
  if ('download' in target) return downloadBlob(blob, target.download);
  const out = await target.handle.createWritable();
  await out.write(blob);
  await out.close();
}

/** Make sure we may write to a file chosen earlier (the browser may ask again). */
export async function canWrite(handle: FileHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** Ask for a file to open. Null when cancelled; `handle` only where the dialog API exists. */
export async function chooseOpenFile(kind: FileKind): Promise<{ file: File; handle?: FileHandle } | null> {
  const w = picker();
  if (!w.showOpenFilePicker) {
    const file = await pickFile(
      Object.entries(TYPES[kind].accept)
        .flatMap(([mime, ext]) => [mime, ...ext])
        .join(','),
    );
    return file && { file };
  }
  try {
    const [handle] = await w.showOpenFilePicker({ types: [TYPES[kind]], id: pickerId(kind) });
    return { file: await handle.getFile(), handle };
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}
