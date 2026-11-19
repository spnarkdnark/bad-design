/** Sidebar for selected text blocks: font, size, color, emphasis, alignment, wrapping. */
import type { TextAlign, TextBlock, TextFont, TextStyle } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { TEXT_FONTS } from '../../model/defaults';
import { formatPaperIn, formatPt, parsePaperIn, parsePt } from '../../model/units';
import { Checkbox, ColorField, Field, NumberField, Section, SelectField } from '../controls/Controls';
import { common } from '../controls/mixed';

const FONT_OPTIONS = (Object.keys(TEXT_FONTS) as TextFont[]).map((f) => ({ value: f, label: TEXT_FONTS[f].label }));
const ALIGNS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

/** `actions`: show the Duplicate/Delete row (off when the bubble section above already has one). */
export function TextProps({ ids, actions = true }: { ids: string[]; actions?: boolean }) {
  const doc = useDoc();
  const texts = ids.map((id) => doc.texts[id]).filter(Boolean) as TextBlock[];
  if (texts.length === 0) return null;
  const get = <K extends keyof TextStyle>(k: K) => common(texts, (t) => t.style[k]);
  const set = (patch: Partial<TextStyle>) => A.setTextStyle(ids, patch);
  const wrap = common(texts, (t) => t.widthPt !== null);
  const width = common(texts, (t) => t.widthPt);
  const align = get('align');

  return (
    <>
      <Section title={texts.length > 1 ? `${texts.length} text blocks` : 'Text'}>
        <Field label="Font">
          <SelectField<TextFont> value={get('font')} options={FONT_OPTIONS} onChange={(font) => set({ font })} />
        </Field>
        <Field label="Size" hint="On paper, like labels: stays the same when the scale changes">
          <NumberField
            value={get('sizePt')}
            format={formatPt}
            parse={parsePt}
            step={1}
            min={2}
            max={288}
            onCommit={(sizePt) => set({ sizePt })}
          />
        </Field>
        <Field label="Color">
          <ColorField value={get('color')} onChange={(color) => set({ color })} />
        </Field>
        <Field label="Style">
          <span className="stack">
            <Checkbox label="Bold" checked={get('bold')} onChange={(bold) => set({ bold })} />
            <Checkbox label="Italic" checked={get('italic')} onChange={(italic) => set({ italic })} />
            <Checkbox label="All caps" checked={get('caps')} onChange={(caps) => set({ caps })} />
          </span>
        </Field>
        <Field label="Align">
          <span className="segmented-row" role="group" aria-label="Align">
            {ALIGNS.map((a) => (
              <button
                key={a.value}
                type="button"
                className={`seg ${align === a.value ? 'active' : ''}`}
                aria-pressed={align === a.value}
                onClick={() => set({ align: a.value })}
              >
                {a.label}
              </button>
            ))}
          </span>
        </Field>
        <Field label="Wrap" hint="Wrap lines at a set width (drag the handle on the right edge)">
          <Checkbox label="At a set width" checked={wrap} onChange={(v) => A.setTextWrap(ids, v)} />
        </Field>
        {wrap !== false && (
          <Field label="Width" hint="Wrapping width on paper">
            <NumberField
              value={width}
              format={formatPaperIn}
              parse={parsePaperIn}
              step={0.25 * 72}
              min={(get('sizePt') ?? 12) * 2}
              onCommit={(w) => A.setTextWidth(ids, w)}
            />
          </Field>
        )}
      </Section>
      {actions && (
        <div className="button-row">
          {texts.length === 1 && (
            <button className="btn" onClick={() => A.editText(texts[0].id)}>
              Edit text
            </button>
          )}
          <button className="btn" onClick={A.duplicateSelection}>
            Duplicate
          </button>
          <button className="btn" onClick={() => A.bringToFront({ texts: ids })}>
            To front
          </button>
          <button className="btn danger" onClick={A.deleteSelection}>
            Delete
          </button>
        </div>
      )}
      <p className="tip">
        Double-click a text block (or press Enter) to edit it. Drag the handle on its right edge to set how wide it
        wraps; double-click the handle to stop wrapping.
      </p>
    </>
  );
}
