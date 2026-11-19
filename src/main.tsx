import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
import { restoreAutosave } from './io/autosave';

restoreAutosave();

// test hook for the Playwright suite (development builds only)
if (import.meta.env.DEV) {
  void Promise.all([
    import('./store/documentStore'),
    import('./store/uiStore'),
    import('./store/workspaceStore'),
    import('./model/blob'),
    import('./model/text'),
  ]).then(([d, u, w, b, t]) => {
    (window as unknown as { __bd: unknown }).__bd = {
      doc: d.useDocument,
      ui: u.useUi,
      ws: w.useWorkspace,
      blobGeometry: b.blobGeometry,
      textWidthHandle: t.textWidthHandle,
    };
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
