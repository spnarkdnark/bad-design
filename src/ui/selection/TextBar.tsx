/** Selected text blocks: font, size, color, emphasis, alignment, wrapping. */
import type { TextAlign, TextBlock, TextFont, TextStyle } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { TEXT_FONTS } from '../../model/defaults';
import { formatPaperIn, formatPt, parsePaperIn, parsePt } from '../../model/units';
import { Checkbox, ColorField, Field, NumberField, SelectField } from '../controls/Controls';
import { common } from '../controls/mixed';
import { Toggle } from './Toggle';

const FONT_OPTIONS = (Object.keys(TEXT_FONTS) as TextFont[]).map((f) => ({ value: f, label: TEXT_FONTS[f].label }));
const ALIGNS: { value: TextAlign; label: string; glyph: string }[] = [
  { value: 'left', label: 'Align left', glyph: '⇤' },
  { value: 'center', label: 'Center', glyph: '↔' },
  { value: 'right', label: 'Align right', glyph: '⇥' },
];

export function TextBar({ ids }: { ids: string[] }) {
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
      <span className="bar-title">{texts.length > 1 ? `${texts.length} text blocks` : 'Text'}</span>
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
          width={64}
          onCommit={(sizePt) => set({ sizePt })}
        />
      </Field>
      <Field label="Color">
        <ColorField swatchOnly label="Text color" value={get('color')} onChange={(color) => set({ color })} />
      </Field>
      <span className="bar-sep" />
      <span className="toggle-row" role="group" aria-label="Emphasis">
        <Toggle label="Bold" pressed={get('bold')} onChange={(bold) => set({ bold })}>
          <b>B</b>
        </Toggle>
        <Toggle label="Italic" pressed={get('italic')} onChange={(italic) => set({ italic })}>
          <i>I</i>
        </Toggle>
        <Toggle label="All caps" pressed={get('caps')} onChange={(caps) => set({ caps })}>
          AA
        </Toggle>
      </span>
      <span className="toggle-row" role="group" aria-label="Align">
        {ALIGNS.map((a) => (
          <Toggle
            key={a.value}
            label={a.label}
            pressed={align === null ? null : align === a.value}
            onChange={() => set({ align: a.value })}
          >
            {a.glyph}
          </Toggle>
        ))}
      </span>
      <span className="bar-sep" />
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
            width={72}
            onCommit={(w) => A.setTextWidth(ids, w)}
          />
        </Field>
      )}
      {texts.length === 1 && (
        <button className="btn ghost" onClick={() => A.editText(texts[0].id)}>
          Edit text
        </button>
      )}
    </>
  );
}
