import { useState } from 'react';
import type { Id, StyleKey, StyleProps } from '../../model/types';
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { darken } from '../../model/color';
import { AUTO_STROKE_DARKEN } from '../../model/defaults';
import { Field, NumberField, Section } from '../controls/Controls';
import { formatRate, parseMoney } from '../../model/units';
import { StyleFields, type StyleSource } from './StyleFields';

function sourceFor(id: Id | null, style: StyleProps): StyleSource {
  return {
    get: <K extends StyleKey>(k: K) => style[k],
    set: (k, v) => A.setCategoryStyle(id, k, v),
    strokeColor: style.stroke ?? darken(style.fill, AUTO_STROKE_DARKEN),
  };
}

/** The firm default cost per sf (drawings can set their own under Costs). */
function FirmRateField({ categoryId, value }: { categoryId: Id | null; value: number }) {
  return (
    <div className="compact-group">
      <h4>Cost</h4>
      <Field label="Default / sf" hint="Firm default for every drawing; a drawing can set its own rate under Costs">
        <NumberField
          value={value}
          format={formatRate}
          parse={parseMoney}
          step={1}
          min={0}
          onCommit={(v) => A.setFirmRate(categoryId, v)}
        />
      </Field>
    </div>
  );
}

export function CategoryPanel() {
  const doc = useDoc();
  const [open, setOpen] = useState<string | null>(null);
  const counts = new Map<string, number>();
  let uncategorized = 0;
  for (const n of Object.values(doc.nodes)) {
    if (n.categoryId) counts.set(n.categoryId, (counts.get(n.categoryId) ?? 0) + 1);
    else uncategorized++;
  }
  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));

  return (
    <Section
      title="Category standards"
      actions={
        <>
          <button
            className="btn ghost small"
            title="Restore the firm's default categories, graphic style and overlap settings"
            onClick={() => {
              if (
                window.confirm(
                  'Reset categories (with their default costs), graphic style and overlap settings to the firm defaults in every tab? ' +
                    'Bubbles keep their categories by name. You can undo.',
                )
              )
                A.resetStandards();
            }}
          >
            Reset
          </button>
          <button className="btn ghost small" onClick={() => setOpen(A.addCategory())}>
            + Add
          </button>
        </>
      }
    >
      <p className="tip flush">Shared by every tab. Changes here apply to all open diagrams and new ones.</p>
      <ul className="category-list">
        {doc.categoryOrder.map((id) => {
          const c = doc.categories[id];
          const count = counts.get(id) ?? 0;
          return (
            <li key={id}>
              <div className="cat-row">
                <button
                  className={`chev ${open === id ? 'open' : ''}`}
                  title="Edit category style"
                  onClick={() => toggle(id)}
                >
                  {open === id ? '▾' : '▸'}
                </button>
                <input
                  type="color"
                  className="swatch"
                  value={c.style.fill}
                  title="Category fill (updates bubbles that follow it)"
                  onChange={(e) => A.setCategoryStyle(id, 'fill', e.target.value)}
                />
                <input
                  className="input bare"
                  value={c.name}
                  onChange={(e) => A.renameCategory(id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                <button
                  className="count"
                  title="Select bubbles in this category"
                  onClick={() => A.selectNodes(doc.nodeOrder.filter((nid) => doc.nodes[nid].categoryId === id))}
                >
                  {count}
                </button>
                <button className="icon-btn" title="Delete category" onClick={() => A.deleteCategory(id)}>
                  ×
                </button>
              </div>
              {open === id && (
                <div className="category-style">
                  <FirmRateField categoryId={id} value={c.costPerSf ?? 0} />
                  <StyleFields src={sourceFor(id, c.style)} compact />
                </div>
              )}
            </li>
          );
        })}
        <li>
          <div className="cat-row">
            <button
              className={`chev ${open === '__default' ? 'open' : ''}`}
              title="Edit style for bubbles without a category"
              onClick={() => toggle('__default')}
            >
              {open === '__default' ? '▾' : '▸'}
            </button>
            <input
              type="color"
              className="swatch"
              value={doc.settings.defaultStyle.fill}
              title="Fill for bubbles without a category"
              onChange={(e) => A.setCategoryStyle(null, 'fill', e.target.value)}
            />
            <span className="dim">No category</span>
            <button
              className="count"
              title="Select bubbles without a category"
              onClick={() => A.selectNodes(doc.nodeOrder.filter((nid) => !doc.nodes[nid].categoryId))}
            >
              {uncategorized}
            </button>
            <span className="cat-row-spacer" />
          </div>
          {open === '__default' && (
            <div className="category-style">
              <FirmRateField categoryId={null} value={doc.settings.defaultCostPerSf} />
              <StyleFields src={sourceFor(null, doc.settings.defaultStyle)} compact />
            </div>
          )}
        </li>
      </ul>
    </Section>
  );
}
