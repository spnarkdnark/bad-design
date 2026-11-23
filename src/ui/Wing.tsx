/**
 * A side panel floating over the drawing's edge that folds toward the screen edge: an arrow on
 * its inner edge (the one facing the drawing) folds it away, leaving a slim tab with its title
 * to bring it back. It covers the canvas rather than resizing it, so folding never moves the
 * drawing; it reports how much it covers (`uiStore.insets`) so centering uses the visible part.
 * Open/closed is remembered (store/panelStore); A and D toggle them (hooks/useKeyboardShortcuts).
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePanels, type WingId } from '../store/panelStore';
import { useUi } from '../store/uiStore';

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
  const slot = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = slot.current!;
    const report = () => useUi.getState().setInset(side, el.offsetWidth);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [side]);

  // the arrow points the way the wing will move
  const arrow = (side === 'left') === open ? '‹' : '›';
  return (
    <div ref={slot} className={`wing-slot ${side}`}>
      {open ? (
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
      ) : (
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
      )}
    </div>
  );
}
