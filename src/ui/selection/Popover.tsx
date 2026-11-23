/**
 * A button in the selection bar that opens a small panel of more settings below it. The
 * panel is fixed-positioned (so the bar can clip) and closes on a click outside or Esc.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function Popover({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = panel.current?.offsetWidth ?? 280;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.bottom + 6 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`btn ghost bar-pop-btn ${open ? 'open' : ''}`}
        aria-expanded={open}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div ref={panel} className="bar-pop" role="dialog" aria-label={label} style={pos}>
          {children}
        </div>
      )}
    </>
  );
}
