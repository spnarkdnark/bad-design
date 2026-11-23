/**
 * Panning without redrawing: the rendered drawing is kept as a bitmap a little larger
 * than the screen and slid while only the pan changes. Hand-drawn styles paint tens of
 * thousands of translucent strokes (pencil fill), which zoomed in cost tens of ms per
 * frame to rasterize; a pan frame is then a single drawImage.
 *
 * The bitmap is built only once the drawing has been the same for two frames in a row
 * (so dragging, typing and zooming draw directly, as before) and rebuilt when the zoom,
 * the scene or the canvas changes, or the pan runs past its margin. It extends further
 * on the side the pan is heading, so a steady pan rebuilds rarely.
 */

/** Extra bitmap around the screen, in CSS px. */
const MARGIN_CSS = 320;

interface Cache {
  canvas: HTMLCanvasElement;
  /** what it shows: any change means a rebuild */
  key: readonly unknown[];
  scale: number;
  /** device translation of world (0,0) when it was drawn */
  e: number;
  f: number;
  /** device position of the bitmap's top-left when it was drawn */
  ox: number;
  oy: number;
}

export interface SceneCache {
  draw(ctx: CanvasRenderingContext2D, key: readonly unknown[], paint: (ctx: CanvasRenderingContext2D) => void): void;
}

const same = (a: readonly unknown[] | null, b: readonly unknown[]) =>
  !!a && a.length === b.length && a.every((x, i) => x === b[i]);

export function createSceneCache(): SceneCache {
  let cache: Cache | null = null;
  let lastKey: readonly unknown[] | null = null;
  let lastScale = NaN;
  let last = { e: 0, f: 0 };

  return {
    draw(ctx, key, paint) {
      const t = ctx.getTransform();
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const s = t.a;
      const fullKey = [...key, W, H];
      const vx = t.e - last.e;
      const vy = t.f - last.f;
      last = { e: t.e, f: t.f };
      const stable = same(lastKey, fullKey) && s === lastScale;
      lastKey = fullKey;
      lastScale = s;

      // a drawing in motion (or just zoomed): draw it directly
      if (!stable || t.b !== 0 || t.c !== 0 || s !== t.d) {
        cache = null;
        paint(ctx);
        return;
      }

      const valid = (c: Cache) => {
        const x = c.ox + t.e - c.e;
        const y = c.oy + t.f - c.f;
        return x <= 0 && y <= 0 && x + c.canvas.width >= W && y + c.canvas.height >= H;
      };
      if (!cache || !same(cache.key, fullKey) || cache.scale !== s || !valid(cache)) {
        const m = Math.round(MARGIN_CSS * (window.devicePixelRatio || 1));
        // lean the bitmap toward where the pan is going
        const bias = (v: number) => (v === 0 ? 0 : v > 0 ? 0.8 : -0.8) * m;
        const ox = Math.round(-m - bias(vx));
        const oy = Math.round(-m - bias(vy));
        const canvas = cache?.canvas ?? document.createElement('canvas');
        if (canvas.width !== W + 2 * m || canvas.height !== H + 2 * m) {
          canvas.width = W + 2 * m;
          canvas.height = H + 2 * m;
        }
        const c = canvas.getContext('2d');
        if (!c) {
          paint(ctx);
          return;
        }
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.setTransform(s, 0, 0, s, t.e - ox, t.f - oy);
        paint(c);
        cache = { canvas, key: fullKey, scale: s, e: t.e, f: t.f, ox, oy };
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cache.canvas, Math.round(cache.ox + t.e - cache.e), Math.round(cache.oy + t.f - cache.f));
      ctx.restore();
    },
  };
}
