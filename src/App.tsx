import { useEffect } from 'react';
import { CanvasStage } from './canvas/CanvasStage';
import { TabBar } from './ui/TabBar';
import { StandardsPanel } from './ui/panels/StandardsPanel';
import { SelectionBar } from './ui/selection/SelectionBar';
import { ToolPalette } from './ui/ToolPalette';
import { Wing } from './ui/Wing';
import { Toast } from './ui/Toast';
import { Splash } from './ui/Splash';
import { ExportDialog } from './ui/ExportDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { installSelectionPruning } from './store/actions';
import { installAutosave } from './io/autosave';
import { installClipboard } from './io/clipboardActions';
import { installStandardsSync } from './store/workspaceStore';
import { openProject, saveProject, saveProjectAs } from './io/fileActions';

const shortcutHandlers = { save: saveProject, saveAs: saveProjectAs, open: openProject };

export function App() {
  useEffect(() => installSelectionPruning(), []);
  useEffect(() => installAutosave(), []);
  useEffect(() => installClipboard(), []);
  useEffect(() => installStandardsSync(), []);
  useKeyboardShortcuts(shortcutHandlers);
  return (
    <div className="app">
      <TabBar />
      <SelectionBar />
      <main className="workspace">
        {/* the canvas fills the workspace; the wings float over its edges (before it, so they
            have reported what they cover by the time it first centers the drawing) */}
        <Wing id="tools" side="left" title="Tools" shortcut="A">
          <ToolPalette />
        </Wing>
        <Wing id="controls" side="right" title="Standards" shortcut="D">
          <StandardsPanel />
        </Wing>
        <div className="canvas-wrap">
          <CanvasStage />
        </div>
      </main>
      <ExportDialog />
      <Toast />
      <Splash />
    </div>
  );
}
