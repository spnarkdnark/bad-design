import { doc, expect, openMenu, test } from './helpers';

test('overlaps: default merge, per-overlap override via the bubble panel', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  await canvas.bubble(560, 300); // 160 px apart < 240: overlapping
  await canvas.click(1000, 700);
  await expect(page.locator('.standards .field:has-text("Overlaps") .readonly')).toHaveText('1 direct');
  await canvas.click(380, 300);
  await openMenu(page, 'Overlaps (1)');
  await page.locator('.bar-pop select').selectOption('threshold');
  const d = await doc(page);
  expect(Object.values(d.overlaps)).toEqual([{ mode: 'threshold' }]);
});
