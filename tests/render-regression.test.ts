/**
 * Render regression guard: a fixture covering every overlap mode, clean and sketched,
 * with shapes, connections, pen lines and a text block. Refactors must not change the hash. When visuals change
 * on purpose, check the app, then replace the expected hash below with the new one
 */
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createConnection, createLine, createNode, createProject, createText } from '../src/model/factory';
import { buildScene } from '../src/render/scene';
import { PRESETS } from '../src/render/sketch';

it('scene output is unchanged', () => {
  const out: string[] = [];
  for (const preset of ['clean', 'watercolor']) {
    for (const mode of ['merge', 'lens', 'lensFill', 'threshold', 'none'] as const) {
      const p = createProject();
      const pr = PRESETS.find((x) => x.id === preset)!;
      Object.assign(p.settings.graphic, pr.params, { paper: pr.paper });
      p.settings.overlap.mode = mode;
      const cat = p.categoryOrder;
      const pts: [number, number, number][] = [
        [0, 0, 10],
        [15, 0, 8],
        [28, 4, 9],
        [60, 0, 6],
        [60, 2, 2],
      ];
      const ids = pts.map(([x, y, r], i) => {
        const n = createNode({ name: `N${i}`, x, y, shape: { kind: 'circle', radiusFt: r }, categoryId: cat[i % 4] });
        p.nodes[`n${i}`] = { ...n, id: `n${i}` };
        p.nodeOrder.push(`n${i}`);
        return `n${i}`;
      });
      const c = createConnection(ids[0], ids[3], 'strong');
      p.connections[c.id] = { ...c, id: 'c1' };
      p.nodes.b = {
        ...createNode({ name: 'Yard', x: 30, y: 30 }),
        id: 'b',
        shape: {
          kind: 'blob',
          gapFt: 2,
          points: [
            { t: 'anchor', node: 'n0', angle: 1, dir: 1, arc: true },
            { t: 'anchor', node: 'n0', angle: 2, dir: 1, arc: false },
            { t: 'free', x: -10, y: 10 },
            { t: 'free', x: 10, y: 10 },
          ],
        },
      };
      p.nodeOrder.unshift('b');
      p.texts.t1 = {
        ...createText({ x: 5, y: 20, text: 'North yard\nservice entry', widthPt: 60 }),
        id: 't1',
        style: {
          font: 'garamond',
          sizePt: 11,
          color: '#553322',
          bold: false,
          italic: true,
          caps: true,
          align: 'center',
        },
      };
      p.textOrder.push('t1');
      p.lines.l1 = {
        ...createLine(
          [
            { x: -5, y: 30 },
            { x: 20, y: 30 },
            { x: 20, y: 40 },
          ],
          false,
          { dash: 'dotted', weightPt: 2, arrowEnd: true, color: '#225588' },
        ),
        id: 'l1',
      };
      p.lines.l2 = {
        ...createLine(
          [
            { x: 40, y: 20 },
            { x: 55, y: 20 },
            { x: 50, y: 32 },
          ],
          true,
          { fill: '#99cc99', fillOpacity: 0.4 },
        ),
        id: 'l2',
      };
      p.lineOrder.push('l1', 'l2');
      out.push(JSON.stringify(buildScene(p)));
    }
  }
  expect(createHash('sha1').update(out.join('|')).digest('hex')).toBe('45ce4add38da4ab620c105728888e2c0b796117e');
});
