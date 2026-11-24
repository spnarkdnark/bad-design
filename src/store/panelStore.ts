/**
 * Which parts of the UI are open: the two wings (tools on the left, standards on the right)
 * and each collapsible section. A per-browser preference, not part of any drawing: saved in
 * localStorage, never undoable.
 */
import { create } from 'zustand';

export type WingId = 'tools' | 'controls';

interface PanelState {
  wings: Record<WingId, boolean>;
  /** open/closed per section id; sections not listed use their default */
  sections: Record<string, boolean>;
  /** the "click here or press A / D" hint beside each wing: gone once that wing is toggled */
  hintsSeen: Record<WingId, boolean>;
  toggleWing: (w: WingId) => void;
  setSection: (id: string, open: boolean) => void;
}

const KEY = 'bad:panels:v1';
type Saved = Pick<PanelState, 'wings' | 'sections' | 'hintsSeen'>;

function load(): Saved {
  const fresh: Saved = {
    wings: { tools: true, controls: true },
    sections: {},
    hintsSeen: { tools: false, controls: false },
  };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!s || typeof s !== 'object') return fresh;
    return {
      wings: { tools: s.wings?.tools !== false, controls: s.wings?.controls !== false },
      sections: s.sections && typeof s.sections === 'object' ? s.sections : {},
      hintsSeen: { tools: s.hintsSeen?.tools === true, controls: s.hintsSeen?.controls === true },
    };
  } catch {
    return fresh;
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wings: s.wings, sections: s.sections, hintsSeen: s.hintsSeen }));
  } catch {
    // private mode or storage full: the layout just isn't remembered
  }
}

export const usePanels = create<PanelState>((set, get) => ({
  ...load(),
  toggleWing: (w) => {
    set({ wings: { ...get().wings, [w]: !get().wings[w] }, hintsSeen: { ...get().hintsSeen, [w]: true } });
    save(get());
  },
  setSection: (id, open) => {
    set({ sections: { ...get().sections, [id]: open } });
    save(get());
  },
}));
