import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { View } from '../store/uiStore';
import { pxPerFt } from '../model/units';
import { elementAt, elementsBounds } from '../model/elements';
import { PAPER_COLORS, paperTileUrl } from '../render/paper';
import { buildScene } from '../render/scene';
import { drawScene } from '../render/drawCanvas';
import { fontsIn, loadWebFont } from '../render/fonts';
import { gridLinesPx, gridStepFt } from '../canvas/layers/grid';
import { canvasTheme } from '../canvas/theme';
import { HIT_TOL_PX } from '../canvas/query';
import { openBuiltIn } from '../io/fileActions';
import { splashLogo, splashView, tutorialProject } from './splash';

/** Must match --splash-fade in styles/tokens.css (plus a little slack). */
const FADE_MS = 700;

/**
 * The opening splash: the logo drawing (ui/splash.ts) on its paper and grid. Any real input
 * (a key, a click, the wheel, a touch; not moving the mouse) fades it out:
 * - a click on an element of the logo opens the tutorial drawing underneath at exactly the
 *   logo's place on screen, so the logo stays put while its notes and the app fade in;
 * - anything else just fades it, back to the work restored from last time (or an empty file).
 * The dismissing click is caught by the splash so it can't act on the drawing underneath.
 */
export function Splash() {
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown');
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight });
  const logo = splashLogo();
  const view = useMemo(() => splashView(elementsBounds(logo)!, logo.settings.scale, win), [logo, win]);
  const k = pxPerFt(logo.settings.scale, view.zoom);
  const toWorld = (x: number, y: number) => ({ x: (x - view.panX) / k, y: (y - view.panY) / k });
  const onLogo = (x: number, y: number) => elementAt(logo, toWorld(x, y), HIT_TOL_PX / k) !== null;

  // the event handlers below are re-created each render, so they see the current view
  const latest = useRef({ onLogo, view });
  latest.current = { onLogo, view };

  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (phase === 'shown') {
      const onKey = () => setPhase('fading');
      const onPointer = (e: PointerEvent | TouchEvent | WheelEvent) => {
        const pt = 'touches' in e ? e.touches[0] : e;
        if (e.type !== 'wheel' && pt && latest.current.onLogo(pt.clientX, pt.clientY))
          openTutorial(latest.current.view);
        setPhase('fading');
      };
      const opts = { capture: true, passive: true };
      window.addEventListener('keydown', onKey, opts);
      for (const ev of ['pointerdown', 'wheel', 'touchstart'] as const) window.addEventListener(ev, onPointer, opts);
      return () => {
        window.removeEventListener('keydown', onKey, { capture: true });
        for (const ev of ['pointerdown', 'wheel', 'touchstart'] as const)
          window.removeEventListener(ev, onPointer, { capture: true });
      };
    }
    if (phase === 'fading') {
      const t = window.setTimeout(() => setPhase('gone'), FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  const [hover, setHover] = useState(false);
  if (phase === 'gone') return null;
  return (
    <div
      className={`splash${phase === 'fading' ? ' fading' : ''}${hover ? ' on-logo' : ''}`}
      data-testid="splash"
      data-view={JSON.stringify(view)}
      onPointerMove={(e) => setHover(onLogo(e.clientX, e.clientY))}
    >
      <SplashDrawing view={view} win={win} />
      <p className="splash-hint" style={{ top: view.panY + elementsBounds(logo)!.maxY * k + 28 }}>
        Click the logo for a guided sample · anywhere else to start drawing
      </p>
    </div>
  );
}

/**
 * Open the tutorial at the splash's place on screen: the canvas sits below the toolbars,
 * so its pan is the splash's (window-relative) pan less the canvas's offset.
 */
function openTutorial(view: View) {
  const r = document.querySelector('.canvas')?.getBoundingClientRect();
  openBuiltIn(tutorialProject(), { ...view, panX: view.panX - (r?.left ?? 0), panY: view.panY - (r?.top ?? 0) });
}

/** The logo drawing on its paper and grid, filling the window. */
function SplashDrawing({ view, win }: { view: View; win: { w: number; h: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const logo = splashLogo();
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const done = () => alive && setFontsReady(true);
    Promise.all(fontsIn(logo).map(loadWebFont)).then(done, done);
    return () => {
      alive = false;
    };
  }, [logo]);

  useLayoutEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(win.w * dpr);
    c.height = Math.round(win.h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { settings } = logo;
    const k = pxPerFt(settings.scale, view.zoom);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, win.w, win.h);

    // the grid, exactly as the canvas draws it for this drawing and view
    if (settings.grid.visible) {
      const step = gridStepFt(settings.grid.spacingFt, k);
      const xs = gridLinesPx(step, k, view.panX, win.w);
      const ys = gridLinesPx(step, k, view.panY, win.h);
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
    }

    // the logo itself, once its lettering font has loaded (so it measures right)
    if (!fontsReady) return;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.panX, dpr * view.panY);
    drawScene(ctx, buildScene(logo), k);
  }, [logo, view, win, fontsReady]);

  const tile = paperTileUrl(logo.settings.graphic.paper);
  return (
    <canvas
      ref={ref}
      className="splash-grid"
      style={{
        width: win.w,
        height: win.h,
        backgroundColor: PAPER_COLORS[logo.settings.graphic.paper],
        backgroundImage: tile ? `url(${tile})` : undefined,
      }}
    />
  );
}
