/** High-level file commands used by the toolbar and shortcuts. */
import { getDoc, useDocument } from '../store/documentStore';
import { useUi } from '../store/uiStore';
import { adoptIntoStandards, newTab, setStandardsEverywhere, useWorkspace } from '../store/workspaceStore';
import { centerOn, renameProject, selectElements, viewCenterWorld, zoomToFit } from '../store/actions';
import { emptyPlan, insertPlan, planIds } from '../model/clip';
import { elementsBounds, hasElements } from '../model/elements';
import { boundsCenter } from '../model/geometry';
import { standardsOf } from '../model/standards';
import exampleRaw from '../assets/example.bubbles.json?raw';
import { pickFile } from './download';
import { buildImport, parseCsv } from './csvImport';
import { parseProject, projectBlob, projectFilename, projectNameFromFile } from './projectFile';
import { canWrite, chooseOpenFile, chooseSaveTarget, writeTarget, type FileHandle } from './fileSystem';

const toast = (m: string) => useUi.getState().showToast(m);

/**
 * The file each tab was opened from or saved to, so Save writes back to it.
 * Handles can't be serialized, so they last until the page reloads.
 */
const tabFiles = new Map<string, FileHandle>();
const activeTab = () => useWorkspace.getState().activeId;

/** New diagram in a new tab. */
export function newProject() {
  newTab();
}

export async function openProject() {
  try {
    const picked = await chooseOpenFile('project');
    if (!picked) return;
    const p = parseProject(await picked.file.text());
    // categories follow your standards (matched by name, standards' styles win); so does the graphic style
    const { project, restyled } = adoptIntoStandards(p);
    const regraphed = JSON.stringify(p.settings.graphic) !== JSON.stringify(project.settings.graphic);
    // like a browser: reuse the current tab only when it is still empty
    if (!hasElements(getDoc())) {
      useDocument.getState().replace(project, true);
      useUi.getState().clearSelection();
    } else newTab(project);
    if (picked.handle) tabFiles.set(activeTab(), picked.handle);
    else tabFiles.delete(activeTab());
    requestAnimationFrame(zoomToFit);
    const notes = [
      restyled && `${restyled} categor${restyled > 1 ? 'ies follow' : 'y follows'} your standard styles.`,
      regraphed && 'Drawn in your graphic standards.',
    ].filter(Boolean);
    toast([`Opened “${p.meta.name}”${notes.length ? '.' : ''}`, ...notes].join(' '));
  } catch (e) {
    toast(`Could not open file: ${(e as Error).message}`);
  }
}

/**
 * The B.A.D. example drawing (assets/example.bubbles.json), exactly as built: its standards
 * (categories, graphic style, overlaps) become the shared standards. Opens at 100% centered
 * on its content, reusing the current tab when it is still empty (like Open).
 */
export function openExample() {
  const project = parseProject(exampleRaw);
  setStandardsEverywhere(standardsOf(project));
  if (!hasElements(getDoc())) {
    useDocument.getState().replace(project, true);
    useUi.getState().clearSelection();
    tabFiles.delete(activeTab());
  } else newTab(project);
  const b = elementsBounds(project);
  centerOn(b ? boundsCenter(b) : { x: 0, y: 0 }, 1);
}

/** Save: back to this tab's file when it has one, otherwise ask where (Save As). */
export async function saveProject() {
  const handle = tabFiles.get(activeTab());
  if (!handle) return saveProjectAs();
  try {
    if (!(await canWrite(handle))) return saveProjectAs();
    await writeTarget({ handle, name: handle.name }, projectBlob(getDoc()));
    toast(`Saved “${handle.name}”`);
  } catch (e) {
    toast(`Could not save: ${(e as Error).message}`);
  }
}

/** Save As: choose the folder and name; the tab then saves there and takes the file's name. */
export async function saveProjectAs() {
  const tab = activeTab();
  try {
    const target = await chooseSaveTarget('project', projectFilename(getDoc()));
    if (!target) return;
    await writeTarget(target, projectBlob(getDoc()));
    if (!('handle' in target)) return toast('Saved to your downloads');
    tabFiles.set(tab, target.handle);
    // a name the user typed becomes the drawing's name (keeping the suggested one changes nothing)
    const name = projectNameFromFile(target.name);
    if (target.name !== projectFilename(getDoc()) && name) renameProject(name);
    toast(`Saved “${target.name}”`);
  } catch (e) {
    toast(`Could not save: ${(e as Error).message}`);
  }
}

export async function importCsv() {
  const file = await pickFile('.csv,text/csv');
  if (!file) return;
  const { rows, errors } = parseCsv(await file.text());
  if (rows.length === 0) {
    toast(`CSV import failed: ${errors[0] ?? 'no rows found.'}`);
    return;
  }
  const { nodes, categories } = buildImport(getDoc(), rows, viewCenterWorld());
  const plan = { ...emptyPlan(), nodes, categories };
  useDocument.getState().commit((d) => insertPlan(d, plan));
  selectElements(planIds(plan));
  requestAnimationFrame(zoomToFit);
  const skipped = errors.length ? ` (${errors.length} row${errors.length > 1 ? 's' : ''} skipped)` : '';
  toast(`Imported ${nodes.length} bubbles${skipped}`);
  if (errors.length) console.warn('CSV import warnings:\n' + errors.join('\n'));
}
