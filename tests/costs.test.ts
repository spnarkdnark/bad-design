import { describe, expect, it } from 'vitest';
import { createNode, createProject } from '../src/model/factory';
import { costBreakdown, costLabel, drawingRate, nodeCost, nodeRate, totalCost } from '../src/model/costs';
import { adoptProject, applyStandards, standardsOf } from '../src/model/standards';
import { migrateProject } from '../src/model/migrate';
import { formatMoney, formatRate, parseMoney } from '../src/model/units';
import { buildImport, parseCsv } from '../src/io/csvImport';
import type { Project } from '../src/model/types';

const catId = (p: Project, name: string) => p.categoryOrder.find((id) => p.categories[id].name === name)!;
const square = (side: number, categoryId: string | null) =>
  createNode({ shape: { kind: 'rect', widthFt: side, heightFt: side }, categoryId });

describe('cost per sf', () => {
  it('rates fall back: element → drawing → firm default', () => {
    const p = createProject();
    const pub = catId(p, 'Public');
    p.categories[pub].costPerSf = 200;
    const n = square(10, pub); // 100 sf
    p.nodes[n.id] = n;
    expect(nodeRate(n, p)).toBe(200);
    p.costRates.categories[pub] = 250;
    expect(nodeRate(n, p)).toBe(250);
    n.costPerSf = 100;
    expect(nodeCost(n, p)).toBe(10000);
    const loose = square(10, null);
    p.nodes[loose.id] = loose;
    p.settings.defaultCostPerSf = 50;
    expect(totalCost(p)).toBe(10000 + 5000);
    p.costRates.uncategorized = 0;
    expect(totalCost(p)).toBe(10000);
  });

  it('breakdown by category uses each element’s own rate', () => {
    const p = createProject();
    const pub = catId(p, 'Public');
    p.costRates.categories[pub] = 10;
    const a = square(10, pub);
    const b = { ...square(10, pub), costPerSf: 30 };
    p.nodes = { [a.id]: a, [b.id]: b };
    const row = costBreakdown(p).find((r) => r.categoryId === pub)!;
    expect(row).toMatchObject({ rate: 10, ownRate: true, count: 2, area: 200, cost: 4000 });
    expect(costBreakdown(p).at(-1)).toMatchObject({ categoryId: null, name: 'No category', cost: 0 });
  });

  it('the cost line shows the rate or the total, and hides at $0 or when off', () => {
    const p = createProject();
    const n = { ...square(20, null), costPerSf: 12.5 }; // 400 sf
    expect(costLabel(n, p, 'rate')).toBe('$12.50/sf');
    expect(costLabel(n, p, 'total')).toBe('$5,000');
    expect(costLabel(n, p, 'none')).toBeNull();
    expect(costLabel({ ...n, costPerSf: 0 }, p, 'rate')).toBeNull();
  });

  it('money in and out', () => {
    expect(formatMoney(1234567.4)).toBe('$1,234,567');
    expect(formatRate(150)).toBe('$150/sf');
    expect(formatRate(1250.5)).toBe('$1,250.50/sf');
    expect(parseMoney('$1,200.50')).toBe(1200.5);
    expect(parseMoney(' $150 / sf ')).toBe(150);
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('lots')).toBeNull();
  });

  it('files keep valid rates and drop bad ones', () => {
    const p = createProject();
    const pub = catId(p, 'Public');
    const n = square(10, pub);
    const raw = JSON.parse(
      JSON.stringify({
        ...p,
        nodes: { [n.id]: { ...n, costPerSf: 75 } },
        nodeOrder: [n.id],
        categories: { ...p.categories, [pub]: { ...p.categories[pub], costPerSf: -3 } },
        costRates: { categories: { [pub]: 120, ghost: 9 }, uncategorized: 'x' },
      }),
    );
    const out = migrateProject(raw);
    expect(out.nodes[n.id].costPerSf).toBe(75);
    expect(out.categories[pub].costPerSf).toBeUndefined();
    expect(out.costRates).toEqual({ categories: { [pub]: 120 } });
    // files from before costs existed
    const old = migrateProject(JSON.parse(JSON.stringify({ ...createProject(), costRates: undefined })));
    expect(old.costRates).toEqual({ categories: {} });
    expect(old.settings.defaultCostPerSf).toBe(0);
  });

  it('opening a file keeps its costs; a blank project follows the firm', () => {
    const lib = createProject();
    lib.categories[catId(lib, 'Public')].costPerSf = 300;
    const s = standardsOf(lib);
    const file = createProject(); // different ids
    file.categories[catId(file, 'Public')].costPerSf = 180; // the file's own firm default
    file.costRates.categories[catId(file, 'Garage')] = 90;
    const n = square(10, catId(file, 'Public'));
    file.nodes[n.id] = n;
    const { project } = adoptProject(file, s);
    const pub = catId(lib, 'Public');
    expect(project.categories[pub].costPerSf).toBe(300); // the standard wins…
    expect(nodeRate(project.nodes[n.id], project)).toBe(180); // …but the drawing's cost doesn't change
    expect(drawingRate(project, catId(lib, 'Garage'))).toBe(90);
    const blank = adoptProject(createProject(), s).project;
    expect(blank.costRates).toEqual({ categories: {} });
    expect(drawingRate(blank, pub)).toBe(300);
  });

  it('an element losing its category keeps its rate', () => {
    const p = createProject();
    const pub = catId(p, 'Public');
    p.costRates.categories[pub] = 220;
    const n = square(10, pub);
    p.nodes[n.id] = n;
    const s = standardsOf(p);
    const categories = { ...s.categories };
    delete categories[pub];
    const out = applyStandards(p, { ...s, categories, categoryOrder: s.categoryOrder.filter((id) => id !== pub) });
    expect(out.nodes[n.id].categoryId).toBeNull();
    expect(out.nodes[n.id].costPerSf).toBe(220);
    expect(out.costRates.categories).toEqual({});
  });

  it('CSV cost column, including a "$/sf" header that must not read as area', () => {
    const { rows, errors } = parseCsv('name,area,category,$/sf\nLab,400,Public,$310\nShop,100,Public,n/a');
    expect(errors).toHaveLength(1);
    expect(rows.map((r) => r.costPerSf)).toEqual([310, undefined]);
    const { nodes } = buildImport(createProject(), rows, { x: 0, y: 0 });
    expect(nodes[0].costPerSf).toBe(310);
    expect('costPerSf' in nodes[1]).toBe(false);
  });
});
