import { APP_CONTROLS, type AppControlId } from './controls';
import { CONTROL_LAYOUT, type ControlRegion } from './layout';

/** One region's controls, grouped as `layout.ts` says. */
export function ControlGroups({ region }: { region: ControlRegion }) {
  const groups: AppControlId[][] = CONTROL_LAYOUT[region];
  return (
    <div className={`control-groups ${region}`}>
      {groups.map((g, i) => (
        <div key={i} className="group">
          {g.map((id) => {
            const Control = APP_CONTROLS[id];
            return <Control key={id} />;
          })}
        </div>
      ))}
    </div>
  );
}
