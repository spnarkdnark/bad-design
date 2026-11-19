/** Keyboard and mouse reference. Keep in sync with hooks/useKeyboardShortcuts.ts and canvas/tools. */
import { useDoc } from '../../store/documentStore';
import { formatLengthCompact } from '../../model/units';
import { Section } from '../controls/Controls';
import { TOOL_LIST } from '../toolList';

export function ShortcutsHelp() {
  const step = formatLengthCompact(useDoc().settings.snap.radiusIncrementFt);
  const rows: [string, string][] = [
    [TOOL_LIST.map((t) => t.key.toUpperCase()).join(' / '), TOOL_LIST.map((t) => t.label).join(' / ')],
    ['B again', 'Switch bubble shape (circle / square)'],
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
    <Section title="Shortcuts">
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
