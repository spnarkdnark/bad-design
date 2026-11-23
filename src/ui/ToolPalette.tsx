/** The tools wing: one large tile per entry in ui/toolList.ts. */
import { useUi } from '../store/uiStore';
import { TOOL_LIST, activateTool, isActiveTool } from './toolList';
import { TOOL_ICONS } from './toolIcons';

export function ToolPalette() {
  const tool = useUi((s) => s.tool);
  const kind = useUi((s) => s.bubbleKind);
  return (
    <div className="tool-palette" role="toolbar" aria-label="Drawing tools">
      {TOOL_LIST.map((t) => {
        const active = isActiveTool(t, tool, kind);
        return (
          <button
            key={t.key}
            type="button"
            className={`tool-tile ${active ? 'active' : ''}`}
            aria-pressed={active}
            title={`${t.label} (${t.key.toUpperCase()})`}
            onClick={() => activateTool(t)}
          >
            {TOOL_ICONS[t.icon]}
            <span className="tool-tile-label">{t.label}</span>
            <kbd className="tool-tile-key">{t.key.toUpperCase()}</kbd>
          </button>
        );
      })}
    </div>
  );
}
