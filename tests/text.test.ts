import { describe, expect, it } from 'vitest';
import { createNode, createProject, createText } from '../src/model/factory';
import { layoutText, setTextMeasurer, textBounds, textWidthAt } from '../src/model/text';
import {
  allElements,
  elementAt,
  elementsBounds,
  elementsInRect,
  removeElements,
  subsetProject,
  translateElements,
} from '../src/model/elements';
import { buildClip, insertPlan, parseClip, planIds, planPaste } from '../src/model/clip';
import { cleanText, migrateProject } from '../src/model/migrate';
import { produce } from 'immer';
import { ptToFt } from '../src/model/units';

// every character 0.5 em wide, so widths are easy to reason about
setTextMeasurer((text) => text.length * 0.5);

describe('text layout', () => {
  it('keeps line breaks and empty lines; width is the longest line without wrapping', () => {
    const l = layoutText(createText({ text: 'Abcd\n\nAb', style: { sizePt: 10 } as never }));
    expect(l.lines.map((x) => x.text)).toEqual(['Abcd', '', 'Ab']);
    expect(l.widthPt).toBe(20); // 4 chars × 0.5 em × 10 pt
    expect(l.heightPt).toBeCloseTo(3 * 12);
    expect(l.lines[2].topPt).toBeCloseTo(24);
  });

  it('wraps words at the set width and aligns lines within it', () => {
    const t = createText({ text: 'aa bb cc dd', widthPt: 30, style: { sizePt: 10, align: 'right' } as never });
    const l = layoutText(t);
    expect(l.lines.map((x) => x.text)).toEqual(['aa bb', 'cc dd']); // "aa bb" = 25 pt fits, "aa bb cc" doesn't
    expect(l.widthPt).toBe(30);
    expect(l.lines[0].xPt).toBe(5);
    const c = layoutText({ ...t, style: { ...t.style, align: 'center' } });
    expect(c.lines[0].xPt).toBe(2.5);
  });

  it('caps changes what is drawn, not the text', () => {
    const t = createText({ text: 'north yard', style: { caps: true } as never });
    expect(layoutText(t).lines[0].text).toBe('NORTH YARD');
    expect(t.text).toBe('north yard');
  });

  it('bounds are in feet at the drawing scale; the width handle never goes below 2 em', () => {
    const p = createProject();
    const t = createText({ x: 10, y: 5, text: 'Abcd', style: { sizePt: 10 } as never });
    const b = textBounds(t, p);
    expect(b.minX).toBe(10);
    expect(b.maxX - b.minX).toBeCloseTo(ptToFt(20, p.settings.scale));
    expect(b.maxY - b.minY).toBeCloseTo(ptToFt(12, p.settings.scale));
    expect(textWidthAt(t, { x: 10.01, y: 0 }, p)).toBe(20);
  });
});

function withText() {
  const p = createProject();
  const n = createNode({ name: 'A', x: 0, y: 0 });
  const t = createText({ x: 40, y: 0, text: 'Note' });
  p.nodes[n.id] = n;
  p.nodeOrder.push(n.id);
  p.texts[t.id] = t;
  p.textOrder.push(t.id);
  return { p, n, t };
}

describe('elements: text alongside bubbles', () => {
  it('bounds, marquee and hit testing include text, with text on top', () => {
    const { p, n, t } = withText();
    const b = elementsBounds(p)!;
    expect(b.maxX).toBeGreaterThan(40);
    expect(elementsInRect(p, { minX: 39, minY: -1, maxX: 41, maxY: 1 })).toEqual({ nodes: [], texts: [t.id] });
    expect(elementAt(p, { x: 0, y: 0 }, 0)).toEqual({ kind: 'nodes', id: n.id });
    // a text block placed over the bubble wins
    const over = produce(p, (d) => void (d.texts[t.id].x = -1));
    expect(elementAt(over, { x: 0, y: 0.3 }, 0)).toEqual({ kind: 'texts', id: t.id });
  });

  it('moves from where the drag began, removes, and subsets every kind', () => {
    const { p, n, t } = withText();
    const ids = allElements(p);
    let d = produce(p, (dr) => translateElements(dr, p, ids, 5, 0));
    d = produce(d, (dr) => translateElements(dr, p, ids, 6, 0)); // previews don't accumulate
    expect(d.nodes[n.id].x).toBe(6);
    expect(d.texts[t.id].x).toBe(46);
    const gone = produce(p, (dr) => removeElements(dr, { texts: [t.id] }));
    expect(gone.texts).toEqual({});
    expect(gone.textOrder).toEqual([]);
    const sub = subsetProject(p, { texts: [t.id] });
    expect(sub.nodeOrder).toEqual([]);
    expect(sub.textOrder).toEqual([t.id]);
  });

  it('copy/paste (and so duplicate) carry text with new ids, offset like the bubbles', () => {
    const { p, t } = withText();
    const clip = parseClip(JSON.stringify(buildClip(p, allElements(p))))!;
    const plan = planPaste(p, clip, { x: clip.center.x + 10, y: clip.center.y });
    expect(plan.texts).toHaveLength(1);
    expect(plan.texts[0].id).not.toBe(t.id);
    expect(plan.texts[0].x).toBe(50);
    expect(plan.nodes[0].x).toBe(10);
    const after = produce(p, (d) => insertPlan(d, plan));
    expect(after.textOrder).toHaveLength(2);
    expect(planIds(plan).texts).toEqual([plan.texts[0].id]);
  });

  it('clips from before text existed still paste', () => {
    const { p, n } = withText();
    const clip = buildClip(p, { nodes: [n.id] })!;
    delete clip.texts;
    expect(planPaste(p, clip, { x: 0, y: 0 }).texts).toEqual([]);
  });
});

describe('text in files', () => {
  it('round-trips and survives old files without text', () => {
    const { p, t } = withText();
    const back = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(back.texts[t.id]).toEqual(t);
    expect(back.textOrder).toEqual([t.id]);
    const old = JSON.parse(JSON.stringify(p));
    delete old.texts;
    delete old.textOrder;
    const m = migrateProject(old);
    expect(m.texts).toEqual({});
    expect(m.textOrder).toEqual([]);
  });

  it('cleans untrusted text blocks', () => {
    expect(cleanText({ x: 1, y: 2 }, 'a')).toBeNull(); // no text
    const c = cleanText(
      { x: 1, y: 2, text: 'Hi', widthPt: -5, style: { font: 'wingdings', sizePt: 'big', align: 'up' } },
      'a',
    )!;
    expect(c.widthPt).toBeNull();
    expect(c.style).toMatchObject({ font: 'helvetica', sizePt: 12, align: 'left' });
  });
});
