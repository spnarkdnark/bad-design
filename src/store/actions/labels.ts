/** The on-canvas label editor: what each part of a label edits (canvas/LabelEditor.tsx). */
import type { Id, LabelPart } from '../../model/types';
import { getDoc } from '../documentStore';
import { renameNode } from './nodes';
import { setSizeFromText, sizeEditText } from './size';
import { costEditText, setCostFromText } from './costs';

const EDITS: Record<LabelPart, { text: (id: Id) => string; commit: (id: Id, text: string) => void }> = {
  name: { text: (id) => getDoc().nodes[id]?.name ?? '', commit: renameNode },
  size: { text: sizeEditText, commit: setSizeFromText },
  cost: { text: costEditText, commit: setCostFromText },
};

export const labelEditText = (id: Id, part: LabelPart) => EDITS[part].text(id);
export const commitLabelEdit = (id: Id, part: LabelPart, text: string) => EDITS[part].commit(id, text);
