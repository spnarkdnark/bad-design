import { doc, expect, nodes, test, reloadApp, ui } from './helpers';

test('tabs keep separate diagrams and undo; restore after reload; reopen after close', async ({ page, canvas }) => {
  const names = async () => (await page.locator('.tab .tab-name').allTextContents()).join(' | ');
  await canvas.bubble(300, 300);
  await canvas.bubble(600, 300);
  await page.locator('.tab-new').click();
  await canvas.bubble(400, 300);
  await page.locator('.tab').nth(1).dblclick();
  await page.keyboard.type('Scheme B');
  await page.keyboard.press('Enter');
  expect(await names()).toBe('Untitled diagram | Scheme B');
  await page.locator('.tab').nth(0).click();
  expect(await nodes(page)).toHaveLength(2);
  await page.keyboard.press('Control+z');
  expect(await nodes(page)).toHaveLength(1);
  await page.locator('.tab').nth(1).click();
  expect(await nodes(page)).toHaveLength(1);
  await page.waitForTimeout(700); // autosave debounce
  await reloadApp(page);
  expect(await names()).toBe('Untitled diagram | Scheme B');
  await page.locator('.tab.active .tab-close').click();
  expect(await names()).toBe('Untitled diagram');
  await page.locator('.toast-action').click();
  expect(await names()).toBe('Untitled diagram | Scheme B');
});

test('new drawings start at 1/16"; opening the site shows the drawing at 100%, centered', async ({ page, canvas }) => {
  await page.locator('.tab-new').click();
  expect((await doc(page)).settings.scale).toBe('1/16');
  await canvas.bubble(500, 300);
  await page.keyboard.press('Control+=');
  await page.keyboard.press('Control+=');
  expect((await ui(page)).view.zoom).toBeGreaterThan(1.2);
  await page.waitForTimeout(700); // autosave
  await reloadApp(page);
  const { view } = await ui(page);
  expect(view.zoom).toBe(1);
  // the bubble is in the middle of the canvas
  const n = (await doc(page)).nodes[(await doc(page)).nodeOrder[0]];
  const box = (await page.locator('.canvas').boundingBox())!;
  const k = 96 * (1 / 16); // px per ft at 1/16" and 100%
  expect(n.x * k + view.panX).toBeCloseTo(box.width / 2, 0);
  expect(n.y * k + view.panY).toBeCloseTo(box.height / 2, 0);
});
