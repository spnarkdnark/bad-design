import { expect, test as base, type Page } from '@playwright/test';
import { doc, ui } from './helpers';

// no canvas fixture here: that one dismisses the splash
const test = base;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as any).__bd);
});

const splashView = async (page: Page) => JSON.parse((await page.getByTestId('splash').getAttribute('data-view'))!);

test('the logo shows on open; moving the mouse keeps it; a key fades it and still does its job', async ({ page }) => {
  const splash = page.getByTestId('splash');
  await expect(splash).toBeVisible();
  await page.mouse.move(300, 300);
  await page.mouse.move(600, 400, { steps: 5 });
  await expect(splash).toBeVisible();
  await page.keyboard.press('t');
  await expect(splash).toHaveCount(0);
  expect((await ui(page)).tool).toBe('text');
  expect((await doc(page)).nodeOrder).toHaveLength(0);
});

test('clicking the logo opens the tutorial exactly where the logo was', async ({ page }) => {
  const v = await splashView(page);
  // the middle of the window is on the logo's red circle
  await page.mouse.click(700, 420);
  const { view } = await ui(page); // before the zoom-out that follows the fade
  await expect(page.getByTestId('splash')).toHaveCount(0);
  const d = await doc(page);
  expect(d.meta.name).toBe('B.A.D. sample');
  expect(d.nodeOrder.length).toBeGreaterThan(0);
  expect(d.settings.scale).toBe('1/16');

  // the same world point sits under the same screen point before and after
  const box = (await page.locator('.canvas').boundingBox())!;
  const k = (z: number) => 96 * (1 / 16) * z; // px per ft at 1/16" (1/16" of paper per foot)
  const before = { x: (700 - v.panX) / k(v.zoom), y: (420 - v.panY) / k(v.zoom) };
  const after = { x: (700 - box.x - view.panX) / k(view.zoom), y: (420 - box.y - view.panY) / k(view.zoom) };
  expect(after.x).toBeCloseTo(before.x, 3);
  expect(after.y).toBeCloseTo(before.y, 3);
  // and the empty tab it opened from was reused
  expect(await page.locator('.tab').count()).toBe(1);

  // then it zooms out until all of the tutorial is in view
  await expect.poll(async () => (await ui(page)).view.zoom, { timeout: 3000 }).toBeLessThan(view.zoom * 0.8);
  await page.waitForTimeout(900);
  const fit = (await ui(page)).view;
  const xs: number[] = [];
  for (const t of Object.values<any>(d.texts)) xs.push(t.x * k(fit.zoom) + fit.panX);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...xs)).toBeLessThanOrEqual(box.width);
});

test("the logo's lettering and arrows don't open the tutorial", async ({ page }) => {
  const v = await splashView(page);
  const k = 96 * (1 / 16) * v.zoom;
  // the middle of "BUBBLE ASSISTED DESIGN" (a text block at x -63.5, y 8.8; 30 pt high)
  await page.mouse.click(v.panX + -20 * k, v.panY + 12 * k);
  await expect(page.getByTestId('splash')).toHaveCount(0);
  expect((await doc(page)).meta.name).not.toBe('B.A.D. sample');
});

test('clicking outside the logo just fades it, without acting on the drawing', async ({ page }) => {
  // with the bubble tool, a click on the canvas would place a bubble
  await page.evaluate(() => (window as any).__bd.ui.getState().setTool('bubble'));
  await page.mouse.click(200, 800);
  await expect(page.getByTestId('splash')).toHaveCount(0);
  const d = await doc(page);
  expect(d.nodeOrder).toHaveLength(0);
  expect(d.meta.name).not.toBe('B.A.D. sample');
});
