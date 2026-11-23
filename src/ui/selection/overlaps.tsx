/** Overlap treatments: the bar for selected overlap markers, and the selected bubbles' overlaps. */
import type { OverlapMode } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { findOverlaps, OVERLAP_MODE_LABELS } from '../../model/overlaps';
import { Field, SelectField } from '../controls/Controls';
import { Popover } from './Popover';

const MODES = Object.keys(OVERLAP_MODE_LABELS) as OverlapMode[];
const DEFAULT = '__default';

/** Mode picker for overlaps: "Drawing default" or an explicit override. */
function OverlapModeSelect({ keys }: { keys: string[] }) {
  const doc = useDoc();
  const vals = keys.map((k) => doc.overlaps[k]?.mode ?? DEFAULT);
  const value = vals.every((v) => v === vals[0]) ? vals[0] : null;
  return (
    <SelectField<string>
      value={value}
      options={[
        { value: DEFAULT, label: `Default (${OVERLAP_MODE_LABELS[doc.settings.overlap.mode]})` },
        ...MODES.map((m) => ({ value: m, label: OVERLAP_MODE_LABELS[m] })),
      ]}
      onChange={(v) => A.setOverlapMode(keys, v === DEFAULT ? null : (v as OverlapMode))}
    />
  );
}

/** Selected overlap markers: which bubbles, and how the overlap is drawn. */
export function OverlapBar({ keys }: { keys: string[] }) {
  const doc = useDoc();
  const live = new Set(findOverlaps(doc).map((o) => o.key));
  const names = (k: string) =>
    k
      .split('|')
      .map((id) => doc.nodes[id]?.name || 'Unnamed')
      .join(' ↔ ');
  const title =
    keys.length === 1 ? `${names(keys[0])}${live.has(keys[0]) ? '' : ' (no longer overlapping)'}` : `${keys.length}`;
  return (
    <>
      <span className="bar-title">{keys.length === 1 ? 'Overlap' : 'Overlaps'}</span>
      <span className="bar-note ellipsis" title={title}>
        {title}
      </span>
      <Field label="Drawn as">
        <OverlapModeSelect keys={keys} />
      </Field>
    </>
  );
}

/** The selected bubbles' overlaps, each with its own mode picker, behind one menu button. */
export function NodeOverlaps({ ids }: { ids: string[] }) {
  const doc = useDoc();
  const set = new Set(ids);
  const list = findOverlaps(doc).filter((o) => set.has(o.a) || set.has(o.b));
  if (list.length === 0) return null;
  return (
    <Popover label={`Overlaps (${list.length})`} title="How each overlap with the selection is drawn">
      {list.map((o) => {
        const other = set.has(o.a) && !set.has(o.b) ? o.b : set.has(o.b) && !set.has(o.a) ? o.a : null;
        const label = other
          ? doc.nodes[other].name || 'Unnamed'
          : `${doc.nodes[o.a].name || 'Unnamed'} ↔ ${doc.nodes[o.b].name || 'Unnamed'}`;
        return (
          <Field key={o.key} label={label}>
            <OverlapModeSelect keys={[o.key]} />
          </Field>
        );
      })}
    </Popover>
  );
}
