/** The selected elements' cost per sf (their own, or inherited) and their cost. */
import type { BubbleNode, Project } from '../../model/types';
import * as A from '../../store/actions';
import { nodeRate, totalCost } from '../../model/costs';
import { formatMoney, formatRate, parseMoney } from '../../model/units';
import { Field, NumberField, ReadOnly } from '../controls/Controls';
import { common } from '../controls/mixed';

export function RateField({ doc, nodes }: { doc: Project; nodes: BubbleNode[] }) {
  const ids = nodes.map((n) => n.id);
  const own = nodes.map((n) => n.costPerSf !== undefined);
  return (
    <Field
      label="Cost / sf"
      hint="Follows this drawing's rate for the category unless set here"
      override={{
        on: own.every(Boolean) ? true : own.some(Boolean) ? null : false,
        reset: () => A.setNodeRate(ids, null),
        title: "This element's own rate. Click to use the category's rate.",
      }}
    >
      <NumberField
        value={common(nodes, (n) => nodeRate(n, doc))}
        format={formatRate}
        parse={parseMoney}
        step={1}
        min={0}
        width={84}
        onCommit={(v) => A.setNodeRate(ids, v)}
      />
    </Field>
  );
}

export function CostReadout({ doc, nodes }: { doc: Project; nodes: BubbleNode[] }) {
  return (
    <Field label={nodes.length > 1 ? 'Total cost' : 'Cost'} hint="Area × cost per sf">
      <ReadOnly
        value={formatMoney(
          totalCost(
            doc,
            nodes.map((n) => n.id),
          ),
        )}
      />
    </Field>
  );
}
