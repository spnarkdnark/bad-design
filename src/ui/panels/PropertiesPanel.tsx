/** Right sidebar: properties of the selection, or drawing settings when nothing is selected. */
import { useUi } from '../../store/uiStore';
import { BubbleProps } from './BubbleProps';
import { CategoryPanel } from './CategoryPanel';
import { ConnectionProps } from './ConnectionProps';
import { CostPanel } from './CostPanel';
import { DrawingPanel } from './DrawingPanel';
import { GraphicPanel } from './GraphicPanel';
import { NodeOverlaps, OverlapProps } from './OverlapProps';
import { OverlapSettingsPanel } from './OverlapSettingsPanel';
import { ShortcutsHelp } from './ShortcutsHelp';
import { TextProps } from './TextProps';
import { LineProps } from './LineProps';

export function PropertiesPanel() {
  const { nodes, lines, texts, connections, overlaps } = useUi((s) => s.selection);
  return (
    <aside className="sidebar">
      {nodes.length > 0 || lines.length > 0 || texts.length > 0 ? (
        <>
          {nodes.length > 0 && <BubbleProps ids={nodes} />}
          {nodes.length > 0 && <NodeOverlaps ids={nodes} />}
          {lines.length > 0 && <LineProps ids={lines} actions={nodes.length === 0} />}
          {texts.length > 0 && <TextProps ids={texts} actions={nodes.length === 0 && lines.length === 0} />}
        </>
      ) : overlaps.length > 0 ? (
        <OverlapProps keys={overlaps} />
      ) : connections.length > 0 ? (
        <ConnectionProps ids={connections} />
      ) : (
        <>
          <DrawingPanel />
          <CostPanel />
          <GraphicPanel />
          <OverlapSettingsPanel />
          <ShortcutsHelp />
        </>
      )}
      <CategoryPanel />
    </aside>
  );
}
