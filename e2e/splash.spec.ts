import { expect, test as base } from '@playwright/test';
import { ui } from './helpers';

// no canvas fixture here: that one dismisses the splash
const test = base;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__bd);
});

test('the logo shows on open; moving the mouse keeps it; a click fades it without acting on the drawing', async ({
  page,
}) => {
  const splash = page.getByTestId('splash');
  await expect(splash).toBeVisible();
  const logo = page.getByAltText('Bubble Assisted Design');
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(2000);

  await page.mouse.move(300, 300);
  await page.mouse.move(600, 400, { steps: 5 });
  await expect(splash).toBeVisible();

  // with the bubble tool, a click on the canvas would place a bubble
  await page.evaluate(() => (window as any).__bd.ui.getState().setTool('bubble'));
  await page.mouse.click(600, 400);
  await expect(splash).toHaveClass(/fading/);
  await expect(splash).toHaveCount(0);
  const d = await page.evaluate(() => (window as any).__bd.doc.getState().history.present);
  expect(d.nodeOrder).toHaveLength(0); // the dismissing click was caught by the splash
});

test('a key fades the logo and still does its job', async ({ page }) => {
  await page.keyboard.press('t');
  await expect(page.getByTestId('splash')).toHaveCount(0);
  expect((await ui(page)).tool).toBe('text');
});
