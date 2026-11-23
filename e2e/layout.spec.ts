import { checkbox, doc, expect, field, openSection, reloadApp, select, test } from './helpers';

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
  // the wings float over the canvas: it never resizes
  expect(await width()).toBe(w0);
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

test('folding or unfolding a wing leaves the drawing where it is on screen', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  // where the bubble's center is on screen
  const onScreen = async () => {
    const box = (await page.locator('.canvas').boundingBox())!;
    return page.evaluate(
      ({ left, top }) => {
        const bd = (window as any).__bd;
        const p = bd.doc.getState().history.present;
        const n = p.nodes[p.nodeOrder[0]];
        const v = bd.ui.getState().view;
        const k = 12 * v.zoom; // 1/8"
        return { x: Math.round(left + n.x * k + v.panX), y: Math.round(top + n.y * k + v.panY) };
      },
      { left: box.x, top: box.y },
    );
  };
  const start = await onScreen();
  for (const key of ['a', 'd', 'a', 'd']) {
    await page.keyboard.press(key);
    await expect.poll(onScreen).toEqual(start);
  }
});

test('the drawing scale and grid are set in the Drawing section', async ({ page, canvas }) => {
  void canvas;
  await select(page, 'Scale').selectOption('1/4');
  expect((await doc(page)).settings.scale).toBe('1/4');
  await page.getByLabel('Grid spacing').selectOption('5');
  await checkbox(page, 'Show').uncheck();
  expect((await doc(page)).settings.grid).toEqual({ visible: false, spacingFt: 5 });
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

test('a part that fails to draw shows a notice instead of blanking the app', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  // a bubble listed in the drawing order but missing from the drawing (only a bug could do this)
  await page.evaluate(() => {
    const d = (window as any).__bd.doc.getState();
    const p = d.history.present;
    d.replace({ ...p, nodeOrder: [...p.nodeOrder, 'ghost'] }, true);
  });
  await expect(page.locator('.error-notice').first()).toBeVisible();
  await expect(page.locator('.error-notice', { hasText: 'the drawing' })).toHaveCount(1);
  // the rest still works
  await expect(page.locator('.tool-tile')).toHaveCount(7);
  await expect(page.locator('.tab')).toHaveCount(1);
});
