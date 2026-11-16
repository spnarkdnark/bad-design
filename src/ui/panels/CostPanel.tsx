/**
 * This drawing's cost rates per category, the cost breakdown and the total
 * (shown when nothing is selected). Firm defaults live in Category standards.
 */
import { useDoc } from '../../store/documentStore';
import * as A from '../../store/actions';
import { costBreakdown, firmRate } from '../../model/costs';
import { formatArea, formatMoney, formatRate, parseMoney } from '../../model/units';
import { NumberField, Section } from '../controls/Controls';

export function CostPanel() {
  const doc = useDoc();
  const rows = costBreakdown(doc);
  const area = rows.reduce((s, r) => s + r.area, 0);
  const total = rows.reduce((s, r) => s + r.cost, 0);
  return (
    <Section title="Costs">
      <p className="tip flush">
        Rates for this drawing. Each starts at the firm default (set in Category standards); a dot marks a rate this
        drawing sets itself.
      </p>
      <div className="cost-table" role="table" aria-label="Cost by category">
        <div className="cost-row head" role="row">
          <span>Category</span>
          <span>Cost / sf</span>
          <span>Cost</span>
        </div>
        {rows.map((r) => {
          const fill = r.categoryId ? doc.categories[r.categoryId].style.fill : doc.settings.defaultStyle.fill;
          const firm = firmRate(doc, r.categoryId);
          return (
            <div className="cost-row" role="row" key={r.categoryId ?? '__none'}>
              <span
                className="cost-name"
                title={`${r.count} element${r.count === 1 ? '' : 's'} · ${formatArea(r.area)}`}
              >
                <i className="cost-swatch" style={{ background: fill }} />
                <span className="cost-label">{r.name}</span>
                {r.ownRate && (
                  <button
                    type="button"
                    className="override-dot"
                    title={`This drawing's own rate. Click to use the firm default (${formatRate(firm)}).`}
                    onClick={() => A.setDrawingRate(r.categoryId, null)}
                  />
                )}
              </span>
              <NumberField
                value={r.rate}
                format={formatRate}
                parse={parseMoney}
                step={1}
                min={0}
                onCommit={(v) => A.setDrawingRate(r.categoryId, v === firm && !r.ownRate ? null : v)}
              />
              <span className="cost-value">{formatMoney(r.cost)}</span>
            </div>
          );
        })}
        <div className="cost-row total" role="row">
          <span>Total</span>
          <span className="cost-area">{formatArea(area)}</span>
          <span className="cost-value">{formatMoney(total)}</span>
        </div>
      </div>
    </Section>
  );
}
