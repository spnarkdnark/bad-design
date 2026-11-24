import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import logoUrl from '../assets/logo.webp';
import { useDoc } from '../store/documentStore';
import { useUi } from '../store/uiStore';
import { pxPerFt } from '../model/units';
import { PAPER_COLORS, paperTileUrl } from '../render/paper';
import { gridLinesPx, gridStepFt } from '../canvas/layers/grid';
import { canvasTheme } from '../canvas/theme';

/** Must match --splash-fade in styles/tokens.css (plus a little slack). */
const FADE_MS = 700;

/**
 * The logo, centered over the app when the page opens, on the drawing's paper and grid.
 * The grid is drawn across the whole screen exactly where the canvas draws it, so as the
 * splash fades the grid stays put while the logo fades out and the app fades in.
 *
 * Any real input (a key, a click, the wheel, a touch; not moving the mouse) starts the fade.
 * The click that dismisses it is caught by the splash so it can't act blindly on the hidden
 * drawing; keys pass through.
 */
export function Splash() {
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown');

  useEffect(() => {
    if (phase === 'shown') {
      const events = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
      const dismiss = () => setPhase('fading');
      for (const e of events) window.addEventListener(e, dismiss, { capture: true, passive: true });
      return () => {
        for (const e of events) window.removeEventListener(e, dismiss, { capture: true });
      };
    }
    if (phase === 'fading') {
      useUi.getState().setSplashDone();
      const t = window.setTimeout(() => setPhase('gone'), FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash${phase === 'fading' ? ' fading' : ''}`} data-testid="splash">
      <SplashGrid />
      <img className="splash-logo" src={logoUrl} alt="Bubble Assisted Design" draggable={false} />
      <p className="splash-hint">Press any key or click to start</p>
    </div>
  );
}

/** The drawing's paper and grid across the whole window, aligned with the canvas's own. */
function SplashGrid() {
  const ref = useRef<HTMLCanvasElement>(null);
  const settings = useDoc().settings;
  const view = useUi((s) => s.view);
  const stage = useUi((s) => s.stageSize);
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [origin, setOrigin] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    // where the drawing canvas sits on screen (its grid is relative to its top-left)
    const r = document.querySelector('.canvas')?.getBoundingClientRect();
    const o = { left: r?.left ?? 0, top: r?.top ?? 0 };
    setOrigin((cur) => (cur.left === o.left && cur.top === o.top ? cur : o));
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(win.w * dpr);
    c.height = Math.round(win.h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, win.w, win.h);
    if (!settings.grid.visible) return;
    const k = pxPerFt(settings.scale, view.zoom);
    const step = gridStepFt(settings.grid.spacingFt, k);
    const xs = gridLinesPx(step, k, o.left + view.panX, win.w);
    const ys = gridLinesPx(step, k, o.top + view.panY, win.h);
    const theme = canvasTheme();
    ctx.lineWidth = 1;
    for (const major of [false, true]) {
      ctx.beginPath();
      for (const l of xs)
        if (l.major === major) {
          ctx.moveTo(l.px, 0);
          ctx.lineTo(l.px, win.h);
        }
      for (const l of ys)
        if (l.major === major) {
          ctx.moveTo(0, l.px);
          ctx.lineTo(win.w, l.px);
        }
      ctx.strokeStyle = major ? theme.gridMajor : theme.gridMinor;
      ctx.stroke();
    }
  }, [settings.grid, settings.scale, view, stage, win]);

  const tile = paperTileUrl(settings.graphic.paper);
  return (
    <canvas
      ref={ref}
      className="splash-grid"
      style={{
        width: win.w,
        height: win.h,
        backgroundColor: PAPER_COLORS[settings.graphic.paper],
        backgroundImage: tile ? `url(${tile})` : undefined,
        backgroundPosition: `${origin.left}px ${origin.top}px`,
      }}
    />
  );
}
