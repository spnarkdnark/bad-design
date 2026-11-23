/**
 * A side panel that collapses toward the screen edge: an arrow on its inner edge (the one
 * facing the drawing) folds it away, leaving a slim tab with its title to bring it back.
 * Open/closed is remembered (store/panelStore); A and D toggle them (hooks/useKeyboardShortcuts).
 */
import type { ReactNode } from 'react';
import { usePanels, type WingId } from '../store/panelStore';

export function Wing({
  id,
  side,
  title,
  shortcut,
  children,
}: {
  id: WingId;
  side: 'left' | 'right';
  title: string;
  shortcut: string;
  children: ReactNode;
}) {
  const open = usePanels((s) => s.wings[id]);
  const toggle = () => usePanels.getState().toggleWing(id);
  // the arrow points the way the wing will move
  const arrow = (side === 'left') === open ? '‹' : '›';
  if (!open)
    return (
      <button
        type="button"
        className={`wing-tab ${side}`}
        data-wing={id}
        title={`Show ${title.toLowerCase()} (${shortcut})`}
        onClick={toggle}
      >
        <span className="wing-tab-arrow" aria-hidden>
          {arrow}
        </span>
        <span className="wing-tab-label">{title}</span>
      </button>
    );
  return (
    <aside className={`wing ${side}`} data-wing={id} aria-label={title}>
      <div className="wing-body">{children}</div>
      <button
        type="button"
        className="wing-collapse"
        title={`Hide ${title.toLowerCase()} (${shortcut})`}
        aria-label={`Hide ${title.toLowerCase()}`}
        onClick={toggle}
      >
        {arrow}
      </button>
    </aside>
  );
}
