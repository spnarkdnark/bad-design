import { expect, type Page } from '@playwright/test';
import { checkbox, fakeFileDialogs, field, lines, select, test, ui, type Canvas } from './helpers';

/** World points of a line (feet). */
const world = (l: any) => l.points.map((p: any) => ({ x: l.x + p.x, y: l.y + p.y }));

/** Canvas px for a world point (12 px per ft at 1/8" and 100%). */
async function toScreen(page: Page, p: { x: number; y: number }): Promise<[number, number]> {
  const { view } = await ui(page);
  const k = 12 * view.zoom;
  return [p.x * k + view.panX, p.y * k + view.panY];
}

async function drawLine(page: Page, canvas: Canvas, pts: [number, number][]) {
  await page.keyboard.press('p');
  for (const [x, y] of pts) await canvas.click(x, y);
  await page.keyboard.press('Enter');
}

test('pen: click points, Enter finishes; the tool stays for the next line; one undo step', async ({ page, canvas }) => {
  await drawLine(page, canvas, [
    [200, 200],
    [400, 200],
    [400, 350],
  ]);
  let all = await lines(page);
  expect(all).toHaveLength(1);
  expect(all[0].points).toHaveLength(3);
  expect(all[0].closed).toBe(false);
  const u = await ui(page);
  expect(u.tool).toBe('pen');
  expect(u.selection.lines).toEqual([all[0].id]);
  const pts = world(all[0]);
  expect(pts[1].x - pts[0].x).toBeCloseTo(200 / 12, 1);

  // Backspace takes back a point; Esc finishes and keeps the line
  await canvas.click(600, 200);
  await canvas.click(700, 300);
  await canvas.click(700, 400);
  await page.keyboard.press('Backspace');
  expect((await ui(page)).lineDraft).toHaveLength(2);
  await page.keyboard.press('Escape');
  all = await lines(page);
  expect(all).toHaveLength(2);
  expect(all[1].points).toHaveLength(2);

  await page.keyboard.press('Control+z');
  expect(await lines(page)).toHaveLength(1);
});

test('pen: Shift keeps 45°; clicking the first point closes; double-click finishes; drag draws freehand', async ({
  page,
  canvas,
}) => {
  await page.keyboard.press('p');
  await canvas.click(200, 200);
  await page.keyboard.down('Shift');
  await canvas.click(400, 215); // nearly level: locked to horizontal
  await page.keyboard.up('Shift');
  await canvas.click(400, 350);
  await canvas.click(203, 203); // the first point (snaps within 10 px): closes
  let [l] = await lines(page);
  expect(l.closed).toBe(true);
  expect(l.points).toHaveLength(3);
  expect(l.points[1].y).toBeCloseTo(0, 5);

  await canvas.click(600, 200);
  await canvas.click(700, 250);
  await canvas.dblclick(750, 400);
  l = (await lines(page))[1];
  expect(l.points).toHaveLength(3);

  await canvas.drag([200, 450], [420, 520], 20);
  l = (await lines(page))[2];
  expect(l.points.length).toBeGreaterThanOrEqual(2);
});

test('pen points snap to other lines; the selected line edits by its points', async ({ page, canvas }) => {
  await drawLine(page, canvas, [
    [200, 200],
    [400, 200],
  ]);
  // a second line starting 5 px from the first one's end starts exactly on it
  await drawLine(page, canvas, [
    [404, 204],
    [400, 400],
  ]);
  const [a, b] = await lines(page);
  expect(world(b)[0].x).toBeCloseTo(world(a)[1].x, 6);
  expect(world(b)[0].y).toBeCloseTo(world(a)[1].y, 6);

  // select the first line by clicking its stroke
  await page.keyboard.press('v');
  await canvas.click(300, 200);
  expect((await ui(page)).selection.lines).toEqual([a.id]);

  // drag its start point down
  const start = await toScreen(page, world(a)[0]);
  await canvas.drag(start, [start[0], start[1] + 60]);
  let l = (await lines(page))[0];
  expect(world(l)[0].y - world(a)[0].y).toBeCloseTo(60 / 12, 1);

  // double-click the middle of the edge: a point is added; double-click it again: removed
  const p0 = await toScreen(page, world(l)[0]);
  const p1 = await toScreen(page, world(l)[1]);
  const mid: [number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  await canvas.dblclick(...mid);
  l = (await lines(page))[0];
  expect(l.points).toHaveLength(3);
  await canvas.dblclick(...mid);
  expect((await lines(page))[0].points).toHaveLength(2);
});

test('sidebar styles lines; marquee, copy/paste and export include them', async ({ page, canvas }) => {
  await drawLine(page, canvas, [
    [200, 200],
    [400, 200],
    [400, 350],
  ]);
  await field(page, 'Weight').fill('3');
  await field(page, 'Weight').press('Enter');
  await select(page, 'Style').selectOption('dashed');
  await checkbox(page, 'At end').check();
  let [l] = await lines(page);
  expect(l.style).toMatchObject({ weightPt: 3, dash: 'dashed', arrowEnd: true });

  await checkbox(page, 'Closed').check();
  await checkbox(page, 'Filled').check();
  [l] = await lines(page);
  expect(l.closed).toBe(true);
  expect(l.style.fill).not.toBeNull();

  // the next line is drawn in the same look
  await drawLine(page, canvas, [
    [600, 200],
    [700, 300],
  ]);
  expect((await lines(page))[1].style).toMatchObject({ weightPt: 3, dash: 'dashed' });

  // marquee from empty canvas over both, then copy and paste
  await page.keyboard.press('v');
  await canvas.drag([180, 150], [760, 420]);
  expect((await ui(page)).selection.lines).toHaveLength(2);
  await page.keyboard.press('Control+c');
  await page.mouse.move(canvas.x + 500, canvas.y + 500);
  await page.keyboard.press('Control+v');
  expect(await lines(page)).toHaveLength(4);

  await fakeFileDialogs(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.locator('.dialog .seg:has-text("SVG")').click();
  await page.evaluate(() => ((window as any).__saveAs = 'lines.svg'));
  await page.locator('.dialog button:has-text("Export SVG")').click();
  await expect(page.locator('.dialog')).toHaveCount(0);
  const svg: string = await page.evaluate(() => (window as any).__files['lines.svg'].text);
  expect((svg.match(/<g id="line-/g) ?? []).length).toBe(4);
  expect(svg).not.toContain('NaN');
});
