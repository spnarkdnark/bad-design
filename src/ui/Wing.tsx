/**
 * A side panel floating over the drawing's edge that folds toward the screen edge: an arrow on
 * its inner edge (the one facing the drawing) folds it away, leaving a slim tab with its title
 * to bring it back. It covers the canvas rather than resizing it, so folding never moves the
 * drawing; it reports how much it covers (`uiStore.insets`) so centering uses the visible part.
 * Open/closed is remembered (store/panelStore); A and D toggle them (hooks/useKeyboardShortcuts).
 * Folding keeps the wing on screen while a CSS animation runs (styles/wingSlide.css, optional:
 * with no animation it folds at once).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  const aside = useRef<HTMLElement>(null);

  // `shown`: the wing is on screen (open, or still sliding shut); `slide`: toggled since mount,
  // so the page doesn't animate its wings on load
  const [shown, setShown] = useState(open);
  const [slide, setSlide] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setSlide(true);
    if (open) setShown(true);
  }
  const closing = !open && shown;
  useEffect(() => {
    if (!closing) return;
    const st = aside.current && getComputedStyle(aside.current);
    // no animation (styles/wingSlide.css removed, reduced motion): fold at once
    if (!st || st.animationName === 'none' || parseFloat(st.animationDuration) === 0) return setShown(false);
    const t = window.setTimeout(() => setShown(false), 1000); // in case animationend never comes
    return () => window.clearTimeout(t);
  }, [closing]);

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
      {shown ? (
        <aside
          ref={aside}
          className={`wing ${side}${slide ? ' slide' : ''}${closing ? ' closing' : ''}`}
          data-wing={closing ? undefined : id}
          aria-label={title}
          aria-hidden={closing || undefined}
          onAnimationEnd={(e) => e.target === e.currentTarget && closing && setShown(false)}
        >
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
          className={`wing-tab ${side}${slide ? ' slide' : ''}`}
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
