import { statSync } from 'node:fs';
import { doc, expect, fakeFileDialogs, importSampleCsv, noFileDialogs, nodes, test } from './helpers';

// `canvas: _app` requests the fixture that opens a fresh app; the tests themselves drive the menus
test('CSV import, then export PDF, PNG and SVG with sketch style on (download fallback)', async ({
  page,
  canvas: _app,
}) => {
  await noFileDialogs(page);
  await importSampleCsv(page);
  expect(await nodes(page)).toHaveLength(11);
  await page.locator('.toolbar label:has-text("Style") select').selectOption('watercolor');
  for (const fmt of ['PDF', 'PNG', 'SVG']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator(`.dialog .seg:has-text("${fmt}")`).click();
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.locator(`.dialog button:has-text("Export ${fmt}")`).click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${fmt.toLowerCase()}$`));
    // a real drawing, not an empty file
    expect(statSync(await dl.path()).size).toBeGreaterThan(5_000);
  }
});

test('export asks where to save; Cancel keeps the dialog open', async ({ page, canvas }) => {
  await fakeFileDialogs(page);
  await canvas.bubble(400, 300);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.evaluate(() => ((window as any).__cancelNext = true));
  await page.locator('.dialog button:has-text("Export PDF")').click();
  await expect(page.locator('.dialog')).toBeVisible();
  expect(await page.evaluate(() => Object.keys((window as any).__files))).toEqual([]);
  await page.evaluate(() => ((window as any).__saveAs = 'Site plan.pdf'));
  await page.locator('.dialog button:has-text("Export PDF")').click();
  await expect(page.locator('.dialog')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Site plan.pdf');
  expect(await page.evaluate(() => (window as any).__files['Site plan.pdf'].size)).toBeGreaterThan(1_000);
});

test('Save As picks the file; Save writes back to it; Open remembers its file', async ({ page, canvas }) => {
  await fakeFileDialogs(page);
  await canvas.bubble(400, 300);
  await page.evaluate(() => ((window as any).__saveAs = 'Smith House.bubbles.json'));
  await page.keyboard.press('Control+s'); // no file yet: Save asks where
  await expect(page.locator('.toast')).toContainText('Saved “Smith House.bubbles.json”');
  expect((await doc(page)).meta.name).toBe('Smith House'); // the tab takes the file's name
  // Save again writes to the same file without asking
  await page.evaluate(() => ((window as any).__saveAs = 'should-not-be-used.json'));
  await canvas.bubble(700, 300);
  await page.keyboard.press('Control+s');
  await expect.poll(() => page.evaluate(() => (window as any).__writes)).toBe(2);
  const files = await page.evaluate(() => (window as any).__files);
  expect(Object.keys(files)).toEqual(['Smith House.bubbles.json']);
  expect(Object.keys(JSON.parse(files['Smith House.bubbles.json'].text).nodes)).toHaveLength(2);

  // open it in a new tab, change it, Save: written back to that file
  await page.locator('.tab-new').click();
  await canvas.bubble(400, 300); // the new tab isn't empty, so Open makes another tab
  await page.evaluate(() => ((window as any).__openName = 'Smith House.bubbles.json'));
  await page.keyboard.press('Control+o');
  await expect.poll(async () => (await nodes(page)).length).toBe(2);
  await canvas.bubble(400, 650);
  await page.keyboard.press('Control+s');
  await expect.poll(() => page.evaluate(() => (window as any).__writes)).toBe(3);
  const saved = await page.evaluate(() => (window as any).__files['Smith House.bubbles.json'].text);
  expect(Object.keys(JSON.parse(saved).nodes)).toHaveLength(3);
});

test('B.A.D. Example opens the example drawing at 1/16" and 100%, centered; again in a new tab', async ({
  page,
  canvas,
}) => {
  void canvas;
  await page.getByRole('button', { name: 'B.A.D. Example', exact: true }).click();
  const d = await doc(page);
  expect(d.meta.name).toBe('B.A.D. Example');
  expect(d.settings.scale).toBe('1/16');
  expect(d.nodeOrder.length).toBeGreaterThan(0);
  expect(await page.locator('.tab').count()).toBe(1); // the empty tab was reused
  const { view } = await page.evaluate(() => ({ view: (window as any).__bd.ui.getState().view }));
  expect(view.zoom).toBe(1);
  // its content is centered in the canvas
  const xs = Object.values<any>(d.texts).map((t) => t.x);
  const box = (await page.locator('.canvas').boundingBox())!;
  const k = 96 * (1 / 16);
  const bubbleXs = Object.values<any>(d.nodes).map((n) => n.x);
  const mid = (Math.min(...bubbleXs, ...xs) + Math.max(...bubbleXs)) / 2;
  expect(Math.abs(mid * k + view.panX - box.width / 2)).toBeLessThan(box.width * 0.2);

  await page.getByRole('button', { name: 'B.A.D. Example', exact: true }).click();
  expect(await page.locator('.tab').count()).toBe(2);
});
