import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createLine, createProject } from '../src/model/factory';
import {
  arrowHead,
  constrain45,
  deletePoint,
  insertPoint,
  lineBounds,
  lineContains,
  lineIntersects,
  linePoints,
  movePoint,
  pullBack,
  segmentAt,
} from '../src/model/linework';
import { allElements, elementAt, elementsInRect, translateElements } from '../src/model/elements';
import { buildClip, parseClip, planPaste } from '../src/model/clip';
import { cleanLine, migrateProject } from '../src/model/migrate';
import { simplifyPolyline } from '../src/model/polygon';

const L = createLine(
  [
    { x: 10, y: 10 },
    { x: 30, y: 10 },
    { x: 30, y: 20 },
  ],
  false,
);

describe('pen line geometry', () => {
  it('stores points relative to the first; world points come back', () => {
    expect(L.x).toBe(10);
    expect(L.points[0]).toEqual({ x: 0, y: 0 });
    expect(linePoints(L)[2]).toEqual({ x: 30, y: 20 });
  });

  it('hits the stroke within tolerance; a filled closed line also inside', () => {
    const p = createProject();
    expect(lineContains(L, { x: 20, y: 10.2 }, p, 0.3)).toBe(true);
    expect(lineContains(L, { x: 20, y: 15 }, p, 0.3)).toBe(false); // open: the inside isn't the line
    const closed = { ...L, closed: true, style: { ...L.style, fill: '#ccc' } };
    expect(lineContains(closed, { x: 28, y: 12 }, p, 0.3)).toBe(true);
    expect(lineContains({ ...closed, style: { ...closed.style, fill: null } }, { x: 28, y: 12 }, p, 0.3)).toBe(false);
  });

  it('bounds cover the points (plus the stroke or arrowheads); marquee touches crossing segments', () => {
    const p = createProject();
    const b = lineBounds(L, p);
    expect(b.minX).toBeLessThan(10);
    expect(b.maxY).toBeGreaterThan(20);
    // a rectangle across the middle of the first segment, with no point inside it
    expect(lineIntersects(L, { minX: 19, minY: 5, maxX: 21, maxY: 15 }, p)).toBe(true);
    expect(lineIntersects(L, { minX: 0, minY: 30, maxX: 5, maxY: 35 }, p)).toBe(false);
  });

  it('Shift locks to 45° steps keeping the distance', () => {
    const q = constrain45({ x: 0, y: 0 }, { x: 10, y: 1 });
    expect(q.y).toBeCloseTo(0, 9);
    expect(q.x).toBeCloseTo(Math.hypot(10, 1), 9);
    const d = constrain45({ x: 0, y: 0 }, { x: 10, y: 9 });
    expect(d.x).toBeCloseTo(d.y, 9);
  });

  it('arrowheads point along the line; the stroke stops inside them', () => {
    const [tip, a, b] = arrowHead({ x: 10, y: 0 }, { x: 0, y: 0 }, 2);
    expect(tip).toEqual({ x: 10, y: 0 });
    expect(a.x).toBeCloseTo(8);
    expect(b.x).toBeCloseTo(8);
    expect(Math.abs(a.y - b.y)).toBeCloseTo(1);
    expect(pullBack({ x: 10, y: 0 }, { x: 0, y: 0 }, 1.6).x).toBeCloseTo(8.4);
  });

  it('point edits: move, insert on an edge, delete down to the minimum', () => {
    expect(movePoint(L, 1, { x: 40, y: 15 })[1]).toEqual({ x: 30, y: 5 });
    const seg = segmentAt(L, { x: 20, y: 10.1 }, 0.5);
    expect(seg).toBe(0);
    expect(insertPoint(L, seg, { x: 20, y: 10 })).toHaveLength(4);
    const two = { ...L, points: L.points.slice(0, 2) };
    expect(deletePoint(two, 0)).toBeNull();
    expect(deletePoint(L, 1)).toEqual([L.points[0], L.points[2]]);
  });

  it('freehand strokes simplify to their corners', () => {
    const pts = [0, 1, 2, 3, 4, 5].map((x) => ({ x, y: 0 })).concat([1, 2, 3].map((y) => ({ x: 5, y })));
    expect(simplifyPolyline(pts, 0.01)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
    ]);
  });
});

describe('pen lines as elements', () => {
  const withLine = () => {
    const p = createProject();
    p.lines[L.id] = L;
    p.lineOrder.push(L.id);
    return p;
  };

  it('select, marquee, move and copy like every element', () => {
    const p = withLine();
    expect(elementAt(p, { x: 20, y: 10 }, 0.2)).toEqual({ kind: 'lines', id: L.id });
    expect(elementsInRect(p, { minX: 19, minY: 5, maxX: 21, maxY: 15 }).lines).toEqual([L.id]);
    const moved = produce(p, (d) => translateElements(d, p, allElements(p), 3, 0));
    expect(linePoints(moved.lines[L.id])[0]).toEqual({ x: 13, y: 10 });
    const clip = parseClip(JSON.stringify(buildClip(p, { lines: [L.id] })))!;
    const plan = planPaste(p, clip, { x: clip.center.x + 5, y: clip.center.y });
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].id).not.toBe(L.id);
    expect(plan.lines[0].x).toBeCloseTo(15);
  });

  it('round-trips through files; old files have none; bad lines are cleaned', () => {
    const p = withLine();
    expect(migrateProject(JSON.parse(JSON.stringify(p))).lines[L.id]).toEqual(L);
    const old = JSON.parse(JSON.stringify(createProject()));
    delete old.lines;
    delete old.lineOrder;
    expect(migrateProject(old).lineOrder).toEqual([]);
    expect(cleanLine({ x: 0, y: 0, points: [{ x: 0, y: 0 }] }, 'a')).toBeNull(); // one point
    const c = cleanLine(
      {
        x: 0,
        y: 0,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        closed: true,
        style: { dash: 'wavy' },
      },
      'a',
    )!;
    expect(c.closed).toBe(false); // two points can't close
    expect(c.style.dash).toBe('solid');
  });
});
