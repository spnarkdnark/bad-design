/**
 * The bar under the tabs: the settings of what's selected (each element's own overrides), and
 * empty when nothing is. One part per element kind; with several kinds selected, chips pick
 * which kind's settings show. Drawing-wide settings and standards live in the right wing.
 */
import { useState } from 'react';
import { useUi } from '../../store/uiStore';
import { ELEMENT_KINDS, type ElementKind } from '../../model/elements';
import { BubbleBar } from './BubbleBar';
import { TextBar } from './TextBar';
import { LineBar } from './LineBar';
import { ConnectionBar } from './ConnectionBar';
import { OverlapBar } from './overlaps';
import { ElementActions } from './ElementActions';

const KIND_LABEL: Record<ElementKind, string> = { nodes: 'Bubbles', lines: 'Lines', texts: 'Text' };

export function SelectionBar() {
  const sel = useUi((s) => s.selection);
  const [pick, setPick] = useState<ElementKind | null>(null);
  const kinds = ELEMENT_KINDS.filter((k) => sel[k].length > 0);
  const kind = pick && kinds.includes(pick) ? pick : kinds[0];

  let body = null;
  if (kind) {
    body = (
      <>
        {kinds.length > 1 && (
          <span className="kind-chips" role="tablist" aria-label="Selected kinds">
            {kinds.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={k === kind}
                className={`kind-chip ${k === kind ? 'active' : ''}`}
                onClick={() => setPick(k)}
              >
                {KIND_LABEL[k]} <span className="count-inline">{sel[k].length}</span>
              </button>
            ))}
          </span>
        )}
        {kind === 'nodes' && <BubbleBar key="nodes" ids={sel.nodes} />}
        {kind === 'lines' && <LineBar key="lines" ids={sel.lines} />}
        {kind === 'texts' && <TextBar key="texts" ids={sel.texts} />}
        <ElementActions />
      </>
    );
  } else if (sel.overlaps.length > 0) body = <OverlapBar keys={sel.overlaps} />;
  else if (sel.connections.length > 0) body = <ConnectionBar ids={sel.connections} />;

  return (
    <div className={`selbar ${body ? '' : 'empty'}`} aria-label="Selection properties">
      {body}
    </div>
  );
}
