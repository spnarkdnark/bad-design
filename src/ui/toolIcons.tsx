/**
 * Large icons for the tool palette (32 px box, line drawings in currentColor). Each shows
 * what the tool makes. Swap freely: the palette only needs one per entry in ui/toolList.ts.
 */
import type { ReactNode } from 'react';

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      {children}
    </svg>
  );
}

export const TOOL_ICONS = {
  select: (
    <Icon>
      <path {...S} d="M9 5l15 9-6.5 1.5L14 22z" />
      <path {...S} d="M17.5 15.5l5 7" />
    </Icon>
  ),
  bubble: (
    <Icon>
      <circle cx="16" cy="16" r="10" fill="currentColor" opacity={0.14} />
      <circle {...S} cx="16" cy="16" r="10" />
    </Icon>
  ),
  square: (
    <Icon>
      <rect x="6.5" y="6.5" width="19" height="19" fill="currentColor" opacity={0.14} />
      <rect {...S} x="6.5" y="6.5" width="19" height="19" />
    </Icon>
  ),
  connect: (
    <Icon>
      <circle {...S} cx="9" cy="22" r="5" />
      <circle {...S} cx="23" cy="10" r="5" />
      <path {...S} strokeWidth={2.4} d="M12.8 18.8l6.4-5.6" />
    </Icon>
  ),
  shape: (
    <Icon>
      <circle {...S} strokeWidth={1.2} cx="11.5" cy="17" r="4.5" opacity={0.55} />
      <circle {...S} strokeWidth={1.2} cx="21" cy="14" r="4" opacity={0.55} />
      <path
        fill="currentColor"
        opacity={0.14}
        d="M6 18c-1-5 3-8.5 7-7.5 2-3.5 7-4 10-1.5s3.5 7.5.5 10.5-7.5 3.5-10.5 3S6.6 21 6 18z"
      />
      <path {...S} d="M6 18c-1-5 3-8.5 7-7.5 2-3.5 7-4 10-1.5s3.5 7.5.5 10.5-7.5 3.5-10.5 3S6.6 21 6 18z" />
    </Icon>
  ),
  pen: (
    <Icon>
      <path {...S} d="M5 25l6-9 6 4 8-11" />
      <circle cx="5" cy="25" r="1.8" fill="currentColor" />
      <circle cx="11" cy="16" r="1.8" fill="currentColor" />
      <circle cx="17" cy="20" r="1.8" fill="currentColor" />
      <circle cx="25" cy="9" r="1.8" fill="currentColor" />
    </Icon>
  ),
  text: (
    <Icon>
      <path {...S} strokeWidth={2} d="M8 8h16M16 8v17M12.5 25h7" />
    </Icon>
  ),
} satisfies Record<string, ReactNode>;

export type ToolIconId = keyof typeof TOOL_ICONS;
