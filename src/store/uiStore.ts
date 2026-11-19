import { create } from 'zustand';
import type { Id, LabelPart, LineStyle, Point, SizableKind, TextStyle } from '../model/types';
import { DEFAULT_LINE_STYLE, DEFAULT_TEXT_STYLE, SIZABLE_SHAPES } from '../model/defaults';
import { noElements, type ElementIds } from '../model/elements';

/** Which canvas tool is active (implementations live in canvas/tools/). */
export type ToolId = 'select' | 'bubble' | 'connect' | 'shape' | 'text' | 'pen';

/** Selected elements (ids per kind, see model/elements.ts) plus connections and overlaps. */
export interface Selection extends ElementIds {
  connections: Id[];
  /** overlap keys (see model/overlaps.overlapKey) */
  overlaps: string[];
}

export interface EditingLabel {
  id: Id;
  part: LabelPart;
}

/** Text being typed on the canvas: an existing block, or a new one not yet in the document. */
export type TextEdit = { id: Id } | { id: null; x: number; y: number; widthPt: number | null };

export interface View {
  zoom: number;
  /** stage translation in screen px */
  panX: number;
  panY: number;
}

interface UiState {
  tool: ToolId;
  /** what the bubble tool places */
  bubbleKind: SizableKind;
  setBubbleKind: (k: SizableKind) => void;
  selection: Selection;
  connectFrom: Id | null;
  view: View;
  stageSize: { width: number; height: number };
  spaceDown: boolean;
  /** live dimension readout while resizing, anchored in world feet */
  readout: { text: string; at: Point } | null;
  exportOpen: boolean;
  toast: { message: string; id: number; action?: { label: string; run: () => void } } | null;
  /** bumps when a web font finishes loading so the canvas re-measures labels */
  fontEpoch: number;
  bumpFontEpoch: () => void;
  /** points clicked so far with the shape tool (world feet) */
  shapeDraft: Point[] | null;
  /** label line being edited on the canvas: a node's name or its size line (area / dimensions) */
  editingLabel: EditingLabel | null;
  setEditingLabel: (e: EditingLabel | null) => void;
  /** text block being typed (never at the same time as editingLabel) */
  editingText: TextEdit | null;
  setEditingText: (e: TextEdit | null) => void;
  /** the look new text blocks get: the last one placed or restyled (this session only) */
  textStyle: TextStyle;
  setTextStyle: (s: TextStyle) => void;
  /** points placed so far with the pen (world feet) */
  lineDraft: Point[] | null;
  setLineDraft: (pts: Point[] | null) => void;
  /** the look new pen lines get: the last one drawn or restyled (this session only) */
  lineStyle: LineStyle;
  setLineStyle: (s: LineStyle) => void;
  setShapeDraft: (pts: Point[] | null) => void;

  setTool: (t: ToolId) => void;
  select: (sel: Partial<Selection>) => void;
  clearSelection: () => void;
  setConnectFrom: (id: Id | null) => void;
  setView: (v: Partial<View>) => void;
  setStageSize: (w: number, h: number) => void;
  setSpaceDown: (v: boolean) => void;
  setReadout: (r: UiState['readout']) => void;
  setExportOpen: (v: boolean) => void;
  showToast: (message: string, action?: { label: string; run: () => void }) => void;
}

/** The bubble shape after `k` in the picker (B pressed again with the bubble tool active). */
export function nextBubbleKind(k: SizableKind): SizableKind {
  const i = SIZABLE_SHAPES.findIndex((s) => s.kind === k);
  return SIZABLE_SHAPES[(i + 1) % SIZABLE_SHAPES.length].kind;
}

export const emptySelection = (): Selection => ({ ...noElements(), connections: [], overlaps: [] });

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 32;

export const useUi = create<UiState>((set) => ({
  tool: 'select',
  bubbleKind: 'circle',
  setBubbleKind: (bubbleKind) => set({ bubbleKind }),
  selection: emptySelection(),
  connectFrom: null,
  view: { zoom: 1, panX: 0, panY: 0 },
  stageSize: { width: 800, height: 600 },
  spaceDown: false,
  readout: null,
  exportOpen: false,
  toast: null,
  fontEpoch: 0,
  shapeDraft: null,
  editingLabel: null,
  setEditingLabel: (editingLabel) => set(editingLabel ? { editingLabel, editingText: null } : { editingLabel }),
  editingText: null,
  setEditingText: (editingText) => set(editingText ? { editingText, editingLabel: null } : { editingText }),
  textStyle: DEFAULT_TEXT_STYLE,
  setTextStyle: (textStyle) => set({ textStyle }),
  lineDraft: null,
  setLineDraft: (lineDraft) => set({ lineDraft }),
  lineStyle: DEFAULT_LINE_STYLE,
  setLineStyle: (lineStyle) => set({ lineStyle }),
  setShapeDraft: (shapeDraft) => set({ shapeDraft }),
  bumpFontEpoch: () => set((s) => ({ fontEpoch: s.fontEpoch + 1 })),

  setTool: (tool) => set({ tool, connectFrom: null, shapeDraft: null, lineDraft: null }),
  // anything not given is deselected
  select: (sel) => set({ selection: { ...emptySelection(), ...sel } }),
  clearSelection: () => set({ selection: emptySelection() }),
  setConnectFrom: (connectFrom) => set({ connectFrom }),
  setView: (v) =>
    set((s) => {
      const view = { ...s.view, ...v };
      view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
      return { view };
    }),
  setStageSize: (width, height) => set({ stageSize: { width, height } }),
  setSpaceDown: (spaceDown) => set({ spaceDown }),
  setReadout: (readout) => set({ readout }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  showToast: (message, action) => set({ toast: { message, id: Date.now(), action } }),
}));
