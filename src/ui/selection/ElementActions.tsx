/** The buttons for any selected elements, whatever their kinds: duplicate, bring to front, delete. */
import * as A from '../../store/actions';

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

export function ElementActions() {
  return (
    <div className="bar-actions">
      <button
        className="btn ghost icon"
        title="Duplicate (Ctrl+D)"
        aria-label="Duplicate"
        onClick={A.duplicateSelection}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect {...S} x="6" y="6" width="9" height="9" rx="1.5" />
          <path {...S} d="M12 4V3.5A1.5 1.5 0 0 0 10.5 2h-7A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H4" />
        </svg>
      </button>
      <button
        className="btn ghost icon"
        title="Bring to front"
        aria-label="Bring to front"
        onClick={() => A.bringToFront(A.selectedElements())}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect {...S} x="2" y="6" width="8" height="8" rx="1.5" strokeDasharray="2 1.6" />
          <rect x="7" y="2.5" width="8.5" height="8.5" rx="1.5" fill="currentColor" opacity="0.85" />
        </svg>
      </button>
      <button className="btn ghost icon danger" title="Delete (Del)" aria-label="Delete" onClick={A.deleteSelection}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path {...S} d="M3 5h12M7 5V3.5h4V5M4.5 5l.8 9.5h7.4l.8-9.5M7.5 8v4M10.5 8v4" />
        </svg>
      </button>
    </div>
  );
}
