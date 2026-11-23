import { expect, field, openSection, reloadApp, test } from './helpers';

test('A and D fold the tools and the standards; their tabs and arrows bring them back; remembered', async ({
  page,
  canvas,
}) => {
  const tools = page.locator('aside.wing[data-wing="tools"]');
  const standards = page.locator('aside.wing[data-wing="controls"]');
  const width = async () => (await page.locator('.canvas').boundingBox())!.width;
  const w0 = await width();
  await page.keyboard.press('a');
  await expect(tools).toHaveCount(0);
  await expect(page.locator('.wing-tab.left')).toHaveText(/Tools/);
  await page.keyboard.press('d');
  await expect(standards).toHaveCount(0);
  await expect.poll(width).toBeGreaterThan(w0 + 300);
  // the folded tab reopens it; the arrow on the inner edge folds it again
  await page.locator('.wing-tab.left').click();
  await expect(tools).toHaveCount(1);
  await tools.getByRole('button', { name: 'Hide tools' }).click();
  await expect(tools).toHaveCount(0);
  await reloadApp(page);
  await expect(tools).toHaveCount(0);
  await expect(standards).toHaveCount(0);
  await page.keyboard.press('a');
  await page.keyboard.press('d');
  await expect(tools).toHaveCount(1);
  await expect(standards).toHaveCount(1);
  // typing an A in a field is just typing
  await canvas.bubble(400, 300);
  await field(page, 'Name').fill('');
  await field(page, 'Name').type('Atrium Den');
  await expect(tools).toHaveCount(1);
  await expect(standards).toHaveCount(1);
});

test('standards sections fold to their title and stay that way', async ({ page, canvas }) => {
  void canvas;
  const costs = page.locator('.section[data-section="costs"]');
  await expect(costs).toHaveClass(/closed/);
  await openSection(page, 'Costs');
  await expect(costs.locator('.cost-table')).toBeVisible();
  await page.locator('.section-toggle:has(h3:text-is("Drawing"))').click();
  await expect(page.locator('.section[data-section="drawing"] .field')).toHaveCount(0);
  await reloadApp(page);
  await expect(costs).toHaveClass(/open/);
  await expect(page.locator('.section[data-section="drawing"]')).toHaveClass(/closed/);
});

test('the selection bar is empty with nothing selected; chips pick a kind in a mixed selection', async ({
  page,
  canvas,
}) => {
  const bar = page.locator('.selbar');
  await expect(bar).toHaveClass(/empty/);
  await canvas.bubble(400, 300);
  await expect(bar.locator('.bar-title')).toHaveText('Bubble');
  await page.keyboard.press('t');
  await canvas.click(700, 300);
  await page.keyboard.type('Note');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await expect(bar.locator('.kind-chip')).toHaveText([/Bubbles\s*1/, /Text\s*1/]);
  await expect(bar.locator('.bar-title')).toHaveText('Bubble');
  await bar.locator('.kind-chip:has-text("Text")').click();
  await expect(bar.locator('.bar-title')).toHaveText('Text');
  await page.keyboard.press('Escape');
  await expect(bar).toHaveClass(/empty/);
});
