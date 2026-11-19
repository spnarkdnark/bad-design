/**
 * Canvas overlay colors (selection, handles, previews, grid). Konva can't use CSS
 * variables, so they are read once from the design tokens in styles/tokens.css,
 * with the same values as fallbacks.
 */
export interface CanvasTheme {
  accent: string;
  handleFill: string;
  strokePreview: string;
  selectFill: string;
  readoutBg: string;
  readoutText: string;
  gridMinor: string;
  gridMajor: string;
}

const FALLBACK: CanvasTheme = {
  accent: '#2f7de1',
  handleFill: '#ffffff',
  strokePreview: '#3a3a3a',
  selectFill: 'rgba(47,125,225,0.06)',
  readoutBg: '#1f2328',
  readoutText: '#ffffff',
  gridMinor: '#eef0f2',
  gridMajor: '#d9dde2',
};

const TOKENS: Record<keyof CanvasTheme, string> = {
  accent: '--accent',
  handleFill: '--panel',
  strokePreview: '--canvas-stroke-preview',
  selectFill: '--canvas-select-fill',
  readoutBg: '--text',
  readoutText: '--on-dark',
  gridMinor: '--canvas-grid-minor',
  gridMajor: '--canvas-grid-major',
};

let cached: CanvasTheme | null = null;

export function canvasTheme(): CanvasTheme {
  if (cached) return cached;
  if (typeof document === 'undefined') return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const theme = { ...FALLBACK };
  for (const key of Object.keys(TOKENS) as (keyof CanvasTheme)[])
    theme[key] = css.getPropertyValue(TOKENS[key]).trim() || FALLBACK[key];
  cached = theme;
  return theme;
}
