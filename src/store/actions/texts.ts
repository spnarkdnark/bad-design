/** Text blocks: placing, typing, restyling and wrapping (move/delete/duplicate: elements.ts). */
import type { Draft } from 'immer';
import type { Id, Point, TextBlock, TextStyle } from '../../model/types';
import { createText } from '../../model/factory';
import { removeElements } from '../../model/elements';
import { layoutText } from '../../model/text';
import { getDoc } from '../documentStore';
import type { TextEdit } from '../uiStore';
import { commit, ui } from './shared';
import { selectElements } from './selection';

/** Trailing blank lines and spaces are dropped; a block with no visible text is no block. */
const tidy = (text: string) => text.replace(/\s+$/, '');

/** Add a text block (with the last used look unless given) and select it. */
export function addText(at: Point, text: string, opts: { widthPt?: number | null; style?: TextStyle } = {}): Id {
  const t = createText({ x: at.x, y: at.y, text, widthPt: opts.widthPt ?? null, style: opts.style ?? ui().textStyle });
  commit((d) => {
    d.texts[t.id] = t;
    d.textOrder.push(t.id);
  });
  selectElements({ texts: [t.id] });
  return t.id;
}

/** Start typing into a text block on the canvas (selecting it). */
export function editText(id: Id) {
  if (!getDoc().texts[id]) return;
  selectElements({ texts: [id] });
  ui().setEditingText({ id });
}

/**
 * Finish typing: a new block is added if it has any text; an existing block takes the
 * text, or is deleted when emptied. One undo step; no step when nothing changed.
 */
export function commitTextEdit(edit: TextEdit, text: string) {
  ui().setEditingText(null);
  const clean = tidy(text);
  if (edit.id === null) {
    if (clean) addText({ x: edit.x, y: edit.y }, clean, { widthPt: edit.widthPt });
    return;
  }
  const t = getDoc().texts[edit.id];
  if (!t || t.text === clean) return;
  if (!clean) commit((d) => removeElements(d, { texts: [edit.id!] }));
  else updateTexts([edit.id], (d) => void (d.text = clean));
}

export function updateTexts(ids: Id[], fn: (t: Draft<TextBlock>) => void, coalesceKey?: string) {
  if (ids.length === 0) return;
  commit(
    (d) => {
      for (const id of ids) if (d.texts[id]) fn(d.texts[id]);
    },
    coalesceKey ? { coalesceKey: `${coalesceKey}:${ids.join(',')}` } : undefined,
  );
}

/** Change part of the look of text blocks; new blocks then get this look too. */
export function setTextStyle(ids: Id[], patch: Partial<TextStyle>) {
  const key = Object.keys(patch).join(',');
  updateTexts(ids, (t) => void Object.assign(t.style, patch), `text-style:${key}`);
  const first = getDoc().texts[ids[0]];
  if (first) ui().setTextStyle({ ...first.style });
}

/** Wrapping width on paper (pt), or null to stop wrapping. */
export function setTextWidth(ids: Id[], widthPt: number | null) {
  updateTexts(ids, (t) => void (t.widthPt = widthPt), 'text-width');
}

/** Turn wrapping on (at the block's current width, so nothing moves) or off. */
export function setTextWrap(ids: Id[], wrap: boolean) {
  const doc = getDoc();
  updateTexts(ids, (t) => {
    const src = doc.texts[t.id];
    t.widthPt = wrap ? (src.widthPt ?? layoutText(src).widthPt) : null;
  });
}
