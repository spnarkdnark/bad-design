/** Selected connections: their type (strong adjacency, near, visual). */
import type { ConnectionType, Id } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { CONNECTION_STYLES } from '../../model/defaults';
import { common } from '../controls/mixed';

const TYPES: ConnectionType[] = ['strong', 'near', 'visual'];

function LinePreview({ type }: { type: ConnectionType }) {
  const st = CONNECTION_STYLES[type];
  return (
    <svg width="28" height="10" aria-hidden>
      <line
        x1="2"
        y1="5"
        x2="26"
        y2="5"
        stroke="currentColor"
        strokeWidth={st.weightPt}
        strokeDasharray={st.style === 'dashed' ? '4 3' : undefined}
      />
    </svg>
  );
}

export function ConnectionBar({ ids }: { ids: Id[] }) {
  const doc = useDoc();
  const conns = ids.map((id) => doc.connections[id]).filter(Boolean);
  if (conns.length === 0) return null;
  const type = common(conns, (c) => c.type);
  const single = conns.length === 1 ? conns[0] : null;
  const name = (id: Id) => doc.nodes[id]?.name || 'Unnamed';

  return (
    <>
      <span className="bar-title">{single ? 'Connection' : `${conns.length} connections`}</span>
      {single && (
        <span className="bar-note ellipsis">
          {name(single.from)} ↔ {name(single.to)}
        </span>
      )}
      <span className="segmented-inline" role="group" aria-label="Connection type">
        {TYPES.map((t) => (
          <button
            key={t}
            className={`seg ${type === t ? 'active' : ''}`}
            aria-pressed={type === t}
            onClick={() => A.setConnectionType(ids, t)}
          >
            <LinePreview type={t} />
            {CONNECTION_STYLES[t].label}
          </button>
        ))}
      </span>
      <div className="bar-actions">
        <button className="btn ghost danger" onClick={A.deleteSelection}>
          Delete
        </button>
      </div>
    </>
  );
}
