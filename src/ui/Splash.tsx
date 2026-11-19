import { useEffect, useState } from 'react';
import logoUrl from '../assets/logo.webp';

/** Must match --splash-fade in styles/tokens.css (plus a little slack). */
const FADE_MS = 700;

/**
 * The logo, centered over the app when the page opens. Any real input (a key, a click,
 * the wheel, a touch; not moving the mouse) fades it out. The click that dismisses it is
 * caught by the splash so it can't act blindly on the hidden drawing; keys pass through.
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
      const t = window.setTimeout(() => setPhase('gone'), FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash${phase === 'fading' ? ' fading' : ''}`} data-testid="splash">
      <img className="splash-logo" src={logoUrl} alt="Bubble Assisted Design" draggable={false} />
      <p className="splash-hint">Press any key or click to start</p>
    </div>
  );
}
