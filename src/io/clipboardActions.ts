import { getDoc, useDocument } from '../store/documentStore';
import { useUi } from '../store/uiStore';
import { deleteSelection, selectedElements, selectElements, viewCenterWorld } from '../store/actions';
import { pointer } from '../canvas/pointer';
import { DUPLICATE_OFFSET_FT } from '../model/defaults';
import {
  buildClip,
  clipLineStyle,
  clipStyle,
  clipTextStyle,
  emptyPlan,
  insertPlan,
  parseClip,
  planIds,
  planPaste,
  type ClipPayload,
} from '../model/clip';
import { describeCount, existing } from '../model/elements';
import { buildImport, parseCsv } from './csvImport';
import { isTextEntry } from '../ui/focus';

/** In-memory fallback when the system clipboard is unavailable. */
let lastClip: { text: string; pastes: number } | null = null;
let pasteStyleArmedAt = 0;

export function armPasteStyle() {
  pasteStyleArmedAt = Date.now();
}

function onCopy(e: ClipboardEvent, cut: boolean) {
  if (isTextEntry(document.activeElement) || useUi.getState().exportOpen) return;
  const ids = existing(getDoc(), selectedElements());
  const clip = buildClip(getDoc(), ids);
  if (!clip) return;
  const text = JSON.stringify(clip);
  e.preventDefault();
  e.clipboardData?.setData('text/plain', text);
  lastClip = { text, pastes: 0 };
  if (cut) deleteSelection();
  useUi.getState().showToast(`${cut ? 'Cut' : 'Copied'} ${describeCount(ids)}`);
}

/** Ctrl+Shift+V: each copied kind's look (bubble, text, line) onto the selected elements of that kind. */
function pasteStyle(clip: ClipPayload) {
  const doc = getDoc();
  const ui = useUi.getState();
  const look = clipStyle(doc, clip);
  const textLook = clipTextStyle(clip);
  const nodes = look ? ui.selection.nodes.filter((id) => doc.nodes[id]) : [];
  const texts = textLook ? ui.selection.texts.filter((id) => doc.texts[id]) : [];
  const lineLook = clipLineStyle(clip);
  const lines = lineLook ? ui.selection.lines.filter((id) => doc.lines[id]) : [];
  const n = nodes.length + texts.length + lines.length;
  if (n === 0) return ui.showToast('Select elements like the copied one to paste its style onto');
  useDocument.getState().commit((d) => {
    if (look && nodes.length) {
      if (look.newCategory) {
        d.categories[look.newCategory.id] = look.newCategory;
        d.categoryOrder.push(look.newCategory.id);
      }
      for (const id of nodes) {
        d.nodes[id].categoryId = look.categoryId;
        d.nodes[id].style = { ...look.style };
      }
    }
    if (textLook) for (const id of texts) d.texts[id].style = { ...textLook };
    if (lineLook) for (const id of lines) d.lines[id].style = { ...lineLook };
  });
  ui.showToast(`Pasted style onto ${n} element${n > 1 ? 's' : ''}`);
}

function pasteClip(clip: ClipPayload, text: string) {
  const doc = getDoc();

  if (Date.now() - pasteStyleArmedAt < 1000) {
    pasteStyleArmedAt = 0;
    return pasteStyle(clip);
  }

  // where: at the cursor; otherwise offset from the original (further for repeated pastes)
  if (!lastClip || lastClip.text !== text) lastClip = { text, pastes: 0 };
  lastClip.pastes++;
  const at =
    pointer.inside && pointer.world
      ? pointer.world
      : {
          x: clip.center.x + DUPLICATE_OFFSET_FT * lastClip.pastes,
          y: clip.center.y + DUPLICATE_OFFSET_FT * lastClip.pastes,
        };
  const plan = planPaste(doc, clip, at);
  useDocument.getState().commit((d) => insertPlan(d, plan));
  selectElements(planIds(plan));
}

/** Rows copied from a spreadsheet (tab or comma separated with a header) become bubbles. */
function pasteTable(text: string): boolean {
  if (!/\n/.test(text.trim())) return false;
  const { rows } = parseCsv(text);
  if (rows.length === 0) return false;
  const doc = getDoc();
  const { nodes, categories } = buildImport(
    doc,
    rows,
    pointer.inside && pointer.world ? pointer.world : viewCenterWorld(),
  );
  const plan = { ...emptyPlan(), nodes, categories };
  useDocument.getState().commit((d) => insertPlan(d, plan));
  selectElements(planIds(plan));
  useUi.getState().showToast(`Pasted ${nodes.length} bubbles from table`);
  return true;
}

function onPaste(e: ClipboardEvent) {
  if (isTextEntry(document.activeElement) || useUi.getState().exportOpen) return;
  const text = e.clipboardData?.getData('text/plain') || lastClip?.text || '';
  const clip = parseClip(text);
  if (clip) {
    e.preventDefault();
    pasteClip(clip, text);
  } else if (pasteTable(text)) e.preventDefault();
}

export function installClipboard(): () => void {
  const copy = (e: ClipboardEvent) => onCopy(e, false);
  const cut = (e: ClipboardEvent) => onCopy(e, true);
  document.addEventListener('copy', copy);
  document.addEventListener('cut', cut);
  document.addEventListener('paste', onPaste);
  return () => {
    document.removeEventListener('copy', copy);
    document.removeEventListener('cut', cut);
    document.removeEventListener('paste', onPaste);
  };
}
