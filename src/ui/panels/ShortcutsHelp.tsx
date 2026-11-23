/**
 * Keyboard and mouse reference, and the how-to tips the old sidebar showed. NOT shown right
 * now (the UI is being reorganized); kept to bring back in a help panel. Keep in sync with
 * hooks/useKeyboardShortcuts.ts and canvas/tools.
 */
import { useDoc } from '../../store/documentStore';
import { formatLengthCompact } from '../../model/units';
import { Section } from '../controls/Controls';
import { TOOL_LIST } from '../toolList';

export function ShortcutsHelp() {
  const step = formatLengthCompact(useDoc().settings.snap.radiusIncrementFt);
  const rows: [string, string][] = [
    [TOOL_LIST.map((t) => t.key.toUpperCase()).join(' / '), TOOL_LIST.map((t) => t.label).join(' / ')],
    ['A / D', 'Hide or show the tools / the standards'],
    ['Tab', 'Bubble tool: type the area to place, Tab again for its category; selected bubbles: type their area'],
    ['Right-click', 'Bubble tool: next category (Shift: previous)'],
    ['Shape tool', 'Drag freehand or click points; double-click a gap to fill it'],
    [
      'Pen tool',
      'Click points (Shift: 45°), click the first to close; Enter / double-click / Esc finishes; drag: freehand',
    ],
    ['Selected line', 'Drag a point; double-click a point to delete it, an edge to add one'],
    ['Text tool', 'Click to place text, drag to set its width'],
    ['Double-click text / Enter', 'Edit a text block (Esc or click away finishes)'],
    ['Scroll', `Zoom (over selected bubble: resize ${step})`],
    ['Space + drag', 'Pan (or middle mouse)'],
    ['Shift + click', 'Add to selection'],
    ['Click name / area / cost', 'Edit it in place (selected bubble; or double-click)'],
    ['Arrows', 'Nudge 1′ (Shift 10′)'],
    ['Ctrl C / X / V', 'Copy / Cut / Paste at cursor'],
    ['Ctrl ⇧V', 'Paste style onto selection'],
    ['Ctrl D / A', 'Duplicate / Select all'],
    ['Ctrl Z / ⇧Z', 'Undo / Redo'],
    ['Ctrl S / ⇧S', 'Save / Save As (choose where)'],
    ['F / Ctrl 0', 'Fit / 100% (true size)'],
    ['Del', 'Delete'],
  ];
  return (
    <Section id="shortcuts" title="Shortcuts">
      <dl className="shortcuts">
        {rows.map(([keys, what]) => (
          <div key={keys} className="shortcut-row">
            <dt>{keys}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** How-to tips per selection, as the old sidebar showed them under each kind's settings. */
export const TIPS = {
  bubble:
    'A dot next to a setting means it overrides the category. Scroll over a selected bubble to resize it by the size snap (Shift: 1").',
  shape:
    'Drag a point to move it; near a bubble it snaps on (Alt: no snapping). Double-click a point to delete it, or the edge to add one.',
  text: 'Double-click a text block (or press Enter) to edit it. Drag the handle on its right edge to set how wide it wraps; double-click the handle to stop wrapping.',
  line: 'Drag a point to move it (it snaps to other lines; Shift keeps 45°). Double-click a point to delete it, or an edge to add one.',
  overlap:
    'Overlapping bubbles read as spaces with a direct relationship. Pick how this one is drawn, or leave it on the drawing default.',
};
