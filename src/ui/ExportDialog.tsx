import { useEffect, useMemo, useState } from 'react';
import { fontsIn, loadOutlineFont, type BundledFont } from '../render/fonts';
import { useDoc } from '../store/documentStore';
import { useUi } from '../store/uiStore';
import { countElements } from '../model/elements';
import { buildSvg } from '../io/export/svg';
import { clampDpi, svgToPng } from '../io/export/png';
import { pageLayout, SHEETS, svgToPdf, type Orientation, type SheetId } from '../io/export/pdf';
import { safeFilename } from '../io/download';
import { chooseSaveTarget, writeTarget } from '../io/fileSystem';
import { PT_PER_IN } from '../model/units';
import { Checkbox, Field, SelectField } from './controls/Controls';

type Format = 'pdf' | 'png' | 'svg';
const fmtIn = (pt: number) => `${(pt / PT_PER_IN).toFixed(2)}"`;

export function ExportDialog() {
  const open = useUi((s) => s.exportOpen);
  if (!open) return null;
  return <ExportDialogBody />;
}

function ExportDialogBody() {
  const doc = useDoc();
  const selection = useUi((s) => s.selection);
  const selectedCount = countElements(selection);
  const close = () => useUi.getState().setExportOpen(false);
  const [format, setFormat] = useState<Format>('pdf');
  const [includeGrid, setIncludeGrid] = useState(false);
  const [includeScaleBar, setIncludeScaleBar] = useState(false);
  const [onlySelection, setOnlySelection] = useState(false);
  const [dpi, setDpi] = useState('300');
  const [sheet, setSheet] = useState<SheetId>('fit');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [busy, setBusy] = useState(false);

  // bundled fonts (hand-lettered labels, text blocks) must be parsed before they can be outlined
  const fonts = fontsIn(doc).join(',');
  const [fontsReady, setFontsReady] = useState('');
  const fontReady = fontsReady === fonts;
  useEffect(() => {
    let alive = true;
    const done = () => alive && setFontsReady(fonts);
    Promise.all(
      fonts
        .split(',')
        .filter(Boolean)
        .map((f) => loadOutlineFont(f as BundledFont)),
    )
      .then(done)
      .catch(done);
    return () => {
      alive = false;
    };
  }, [fonts]);
  const svg = useMemo(
    () =>
      fontReady
        ? buildSvg(doc, {
            includeGrid,
            includeScaleBar,
            marginIn: 0.5,
            only: onlySelection && selectedCount ? selection : undefined,
          })
        : null,
    [doc, includeGrid, includeScaleBar, onlySelection, selection, selectedCount, fontReady],
  );
  const layout = svg && format === 'pdf' ? pageLayout(svg, sheet, orientation) : null;
  const effDpi = svg && format === 'png' ? clampDpi(svg, parseInt(dpi)) : 0;

  const run = async () => {
    if (!svg) return;
    setBusy(true);
    try {
      // ask where first: the save dialog must open straight from the click, before the slow part
      const target = await chooseSaveTarget(format, `${safeFilename(doc.meta.name)}.${format}`);
      if (!target) return; // cancelled: stay in the dialog
      const blob =
        format === 'svg'
          ? new Blob([svg.svg], { type: 'image/svg+xml' })
          : format === 'png'
            ? await svgToPng(svg, parseInt(dpi))
            : await svgToPdf(svg, sheet, orientation);
      await writeTarget(target, blob);
      useUi.getState().showToast(`Exported “${target.name}”`);
      close();
    } catch (e) {
      useUi.getState().showToast(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog" role="dialog" aria-label="Export" onKeyDown={(e) => e.key === 'Escape' && close()}>
        <h2>Export</h2>
        <div className="segmented-row">
          {(['pdf', 'png', 'svg'] as Format[]).map((f) => (
            <button key={f} className={`seg ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <Checkbox label="Include scale bar & title" checked={includeScaleBar} onChange={setIncludeScaleBar} />
        <Checkbox label="Include grid" checked={includeGrid} onChange={setIncludeGrid} />
        {selectedCount > 0 && (
          <Checkbox
            label={`Only selected elements (${selectedCount})`}
            checked={onlySelection}
            onChange={setOnlySelection}
          />
        )}

        {format === 'pdf' && (
          <>
            <Field label="Sheet">
              <SelectField<SheetId>
                value={sheet}
                options={SHEETS.map((s) => ({ value: s.id, label: s.label }))}
                onChange={setSheet}
              />
            </Field>
            {sheet !== 'fit' && (
              <Field label="Orientation">
                <SelectField<Orientation>
                  value={orientation}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                  onChange={setOrientation}
                />
              </Field>
            )}
          </>
        )}
        {format === 'png' && (
          <Field label="Resolution">
            <SelectField
              value={dpi}
              options={[
                { value: '150', label: '150 dpi' },
                { value: '300', label: '300 dpi' },
                { value: '600', label: '600 dpi' },
              ]}
              onChange={setDpi}
            />
          </Field>
        )}

        {!svg && fontReady && <div className="warning">Nothing to export yet — add some bubbles first.</div>}
        {svg && (
          <div className="info">
            Drawing at true scale: {fmtIn(svg.widthPt)} × {fmtIn(svg.heightPt)}
            {layout && sheet !== 'fit' && (
              <>
                {' '}
                on a {fmtIn(layout.pageWPt)} × {fmtIn(layout.pageHPt)} sheet
              </>
            )}
            {format === 'png' && (
              <>
                {' '}
                → {Math.round((svg.widthPt / PT_PER_IN) * effDpi)} × {Math.round((svg.heightPt / PT_PER_IN) * effDpi)}{' '}
                px
                {effDpi < parseInt(dpi) && ` (limited to ${effDpi} dpi)`}
              </>
            )}
          </div>
        )}
        {layout && !layout.fits && (
          <div className="warning">
            The drawing doesn't fit this sheet at the current scale and will be clipped. Choose a larger sheet, a
            smaller scale, or “Fit to drawing”.
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" disabled={!svg || busy} onClick={run}>
            {busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
