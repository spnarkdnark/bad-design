import { create } from 'zustand';
import type { Id, LabelPart, LineStyle, Point, SizableKind, TextStyle } from '../model/types';
import { DEFAULT_LINE_STYLE, DEFAULT_RADIUS_FT, DEFAULT_TEXT_STYLE, MIN_SIZE_FT } from '../model/defaults';
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
  /** size (half-extent, feet) the bubble tool places; the wheel changes it before a click. Session only. */
  placeSize: number;
  setPlaceSize: (ft: number) => void;
  /** set by Tab: the selection bar's Area field takes focus when it shows, then clears it (ui/selection/SizeFields) */
  areaFocus: boolean;
  setAreaFocus: (v: boolean) => void;
  selection: Selection;
  connectFrom: Id | null;
  view: View;
  stageSize: { width: number; height: number };
  /** screen px of the canvas covered by the wings at its left and right (they float over it) */
  insets: { left: number; right: number };
  setInset: (side: 'left' | 'right', px: number) => void;
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

export const emptySelection = (): Selection => ({ ...noElements(), connections: [], overlaps: [] });

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 32;

export const useUi = create<UiState>((set) => ({
  tool: 'select',
  bubbleKind: 'circle',
  setBubbleKind: (bubbleKind) => set({ bubbleKind }),
  areaFocus: false,
  setAreaFocus: (areaFocus) => set({ areaFocus }),
  placeSize: DEFAULT_RADIUS_FT,
  setPlaceSize: (placeSize) => set({ placeSize: Math.max(MIN_SIZE_FT, placeSize) }),
  selection: emptySelection(),
  connectFrom: null,
  view: { zoom: 1, panX: 0, panY: 0 },
  stageSize: { width: 800, height: 600 },
  insets: { left: 0, right: 0 },
  setInset: (side, px) => set((s) => (s.insets[side] === px ? s : { insets: { ...s.insets, [side]: px } })),
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
