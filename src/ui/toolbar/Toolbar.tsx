import { TOOLBAR_CONTROLS } from './controls';
import { TOOLBAR_LAYOUT } from './layout';

/** The toolbar, as arranged in `layout.ts`. */
export function Toolbar() {
  return (
    <header className="toolbar">
      {TOOLBAR_LAYOUT.map((slot, i) =>
        slot === 'spacer' ? (
          <div key={i} className="spacer" />
        ) : (
          <div key={i} className="group">
            {slot.map((id) => {
              const Control = TOOLBAR_CONTROLS[id];
              return <Control key={id} />;
            })}
          </div>
        ),
      )}
    </header>
  );
}
