/**
 * The right wing: the drawing's settings and totals and the shared standards ("total
 * control"). Each block is a collapsible Section; moving one = moving its line here.
 * (What's selected is edited in the selection bar, ui/selection/.)
 */
import { CategoryPanel } from './CategoryPanel';
import { CostPanel } from './CostPanel';
import { DrawingPanel } from './DrawingPanel';
import { GraphicPanel } from './GraphicPanel';
import { OverlapSettingsPanel } from './OverlapSettingsPanel';

export function StandardsPanel() {
  return (
    <div className="standards">
      <DrawingPanel />
      <CategoryPanel />
      <CostPanel />
      <GraphicPanel />
      <OverlapSettingsPanel />
    </div>
  );
}
