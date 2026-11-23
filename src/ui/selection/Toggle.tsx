/** A small on/off button (bold, italic, align…); `pressed: null` = mixed across the selection. */
import type { ReactNode } from 'react';

export function Toggle({
  label,
  pressed,
  onChange,
  children,
}: {
  label: string;
  pressed: boolean | null;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`toggle ${pressed ? 'on' : ''} ${pressed === null ? 'mixed' : ''}`}
      aria-pressed={pressed === null ? 'mixed' : pressed}
      aria-label={label}
      title={label}
      onClick={() => onChange(!pressed)}
    >
      {children}
    </button>
  );
}
