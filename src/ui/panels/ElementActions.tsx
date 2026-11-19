/** The buttons for any selected elements, whatever their kinds: duplicate, bring to front, delete. */
import * as A from '../../store/actions';

export function ElementActions() {
  return (
    <div className="button-row">
      <button className="btn" onClick={A.duplicateSelection}>
        Duplicate
      </button>
      <button className="btn" onClick={() => A.bringToFront(A.selectedElements())}>
        To front
      </button>
      <button className="btn danger" onClick={A.deleteSelection}>
        Delete
      </button>
    </div>
  );
}
