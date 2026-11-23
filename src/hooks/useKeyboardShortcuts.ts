import { useEffect } from 'react';
import { useDocument } from '../store/documentStore';
import { useUi } from '../store/uiStore';
import { usePanels } from '../store/panelStore';
import * as A from '../store/actions';
import { NUDGE_BIG_FT, NUDGE_FT } from '../model/defaults';
import { countElements } from '../model/elements';
import { isSizable } from '../model/geometry';
import { armPasteStyle } from '../io/clipboardActions';
import { isTextEntry } from '../ui/focus';
import { activateTool, toolForKey } from '../ui/toolList';

export interface ShortcutHandlers {
  save?: () => void;
  saveAs?: () => void;
  open?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const doc = useDocument.getState();
      const ui = useUi.getState();

      // Undo/redo/save work even while typing? Only outside text fields (let inputs undo text).
      if (isTextEntry(e.target)) return;
      if (ui.exportOpen) {
        if (e.key === 'Escape') ui.setExportOpen(false);
        return;
      }

      // Ctrl+C / X / V are handled by native copy/cut/paste events (io/clipboardActions.ts)
      if (mod && e.shiftKey && key === 'v') armPasteStyle();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        doc.redo();
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        if (e.shiftKey) handlers.saveAs?.();
        else handlers.save?.();
        return;
      }
      if (mod && key === 'o') {
        e.preventDefault();
        handlers.open?.();
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        A.duplicateSelection();
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        A.selectAll();
        return;
      }
      if (mod && key === '0') {
        e.preventDefault();
        A.setZoom(1);
        return;
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault();
        A.setZoom(ui.view.zoom * 1.25);
        return;
      }
      if (mod && key === '-') {
        e.preventDefault();
        A.setZoom(ui.view.zoom / 1.25);
        return;
      }
      if (mod) return;

      // pen draft: Enter or Esc finishes (keeping the line), Backspace takes back the last point
      if (ui.lineDraft?.length) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          if (ui.lineDraft.length >= 2) A.finishLineDraft(false);
          else ui.setLineDraft(null);
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          const d = ui.lineDraft.slice(0, -1);
          ui.setLineDraft(d.length ? d : null);
          return;
        }
      }

      // shape tool draft editing
      if (ui.shapeDraft?.length) {
        if (e.key === 'Enter') {
          e.preventDefault();
          A.finishShapeDraft();
          ui.setTool('select');
          return;
        }
        if (e.key === 'Escape') {
          ui.setShapeDraft(null);
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          const d = ui.shapeDraft.slice(0, -1);
          ui.setShapeDraft(d.length ? d : null);
          return;
        }
      }

      switch (e.key) {
        case 'Tab': {
          // type an area for the selected bubbles (any sizable shape)
          const doc = useDocument.getState().history.present;
          const sel = ui.selection.nodes.map((id) => doc.nodes[id]).filter(Boolean);
          // (or, with the bubble tool, the area of the next one placed)
          if (ui.tool === 'bubble' || (sel.length && sel.every((n) => isSizable(n.shape)))) {
            e.preventDefault();
            ui.setAreaFocus(true);
          }
          return;
        }
        case 'Enter':
          // type into the one selected text block
          if (ui.selection.texts.length === 1 && countElements(A.selectedElements()) === 1) {
            e.preventDefault();
            A.editText(ui.selection.texts[0]);
          }
          return;
        case ' ':
          e.preventDefault();
          if (!ui.spaceDown) ui.setSpaceDown(true);
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          A.deleteSelection();
          return;
        case 'Escape':
          if (doc.gestureBase) doc.cancelGesture();
          else if (ui.connectFrom) ui.setConnectFrom(null);
          else if (ui.tool !== 'select') ui.setTool('select');
          else ui.clearSelection();
          ui.setReadout(null);
          return;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (countElements(A.selectedElements()) === 0) return;
          e.preventDefault();
          const d = e.shiftKey ? NUDGE_BIG_FT : NUDGE_FT;
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
          const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
          A.nudgeSelection(dx, dy);
          return;
        }
      }
      switch (key) {
        case 'a':
          usePanels.getState().toggleWing('tools');
          return;
        case 'd':
          usePanels.getState().toggleWing('controls');
          return;
        case 'f':
          A.zoomToFit();
          return;
      }
      const tool = toolForKey(key);
      if (tool) activateTool(tool);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === ' ') useUi.getState().setSpaceDown(false);
    };
    const onBlur = () => useUi.getState().setSpaceDown(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handlers]);
}
