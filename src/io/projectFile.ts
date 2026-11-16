import type { Project } from '../model/types';
import { migrateProject } from '../model/migrate';
import { safeFilename } from './download';

export const PROJECT_EXT = '.bubbles.json';

export function serializeProject(p: Project): string {
  return JSON.stringify({ ...p, meta: { ...p.meta, modifiedAt: new Date().toISOString() } }, null, 2);
}

export function parseProject(text: string): Project {
  return migrateProject(JSON.parse(text));
}

export function projectBlob(p: Project): Blob {
  return new Blob([serializeProject(p)], { type: 'application/json' });
}

/** Suggested file name for a drawing: "reading-room.bubbles.json". */
export const projectFilename = (p: Project) => safeFilename(p.meta.name) + PROJECT_EXT;

/** A file name without the project extension: "Reading Room.bubbles.json" → "Reading Room". */
export const projectNameFromFile = (filename: string) => filename.replace(/(\.bubbles)?\.json$/i, '');
