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

test('panning slides a cached image of the drawing that matches drawing it afresh', async ({ page, canvas }) => {
  void canvas;
  await page.getByRole('button', { name: 'B.A.D. Example', exact: true }).click();
  await page.evaluate(() => (window as any).__bd.ui.getState().setView({ zoom: 3 }));
  // snapshots stay in the page (they are megabytes); only the share of differing values comes back
  const snap = (name: string) =>
    page.evaluate((name) => {
      const w = window as any;
      w.__snaps = w.__snaps ?? {};
      w.__snaps[name] = [...document.querySelectorAll<HTMLCanvasElement>('.canvas canvas')].map(
        (c) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data,
      );
    }, name);
  const differing = (a: string, b: string) =>
    page.evaluate(
      ([a, b]) => {
        const s = (window as any).__snaps;
        let n = 0;
        let total = 0;
        s[a].forEach((layer: Uint8ClampedArray, j: number) => {
          total += layer.length;
          for (let i = 0; i < layer.length; i++) if (Math.abs(layer[i] - s[b][j][i]) > 8) n++;
        });
        return n / total;
      },
      [a, b],
    );
  await snap('before');
  // pan (Space + drag): the cached image slides
  await page.keyboard.down('Space');
  await page.mouse.move(700, 400);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(700 + i * 15, 400 + i * 5);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await page.waitForTimeout(100);
  await snap('cached');
  // a zoom away and back draws the same view directly
  await page.evaluate(() => (window as any).__bd.ui.getState().setView({ zoom: 3.001 }));
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__bd.ui.getState().setView({ zoom: 3 }));
  await page.waitForTimeout(100);
  await snap('direct');
  expect(await differing('before', 'cached')).toBeGreaterThan(0.01); // it moved
  expect(await differing('cached', 'direct')).toBeLessThan(0.005); // and looks the same (anti-aliasing aside)
});

test('a first visit shows how to open each wing after 10 s; each hint goes once its own wing is toggled', async ({
  page,
  canvas,
}) => {
  void canvas;
  await page.evaluate(() => localStorage.removeItem('bad:panels:v1'));
  await page.clock.install();
  await page.reload();
  await page.waitForSelector('.canvas canvas');
  const toolsHint = page.getByTestId('wing-hint-tools');
  const controlHint = page.getByTestId('wing-hint-controls');
  // nothing under the logo, nor in the first seconds after it
  await page.clock.runFor(20_000);
  await expect(toolsHint).toHaveCount(0);
  await page.keyboard.press('Shift');
  await page.clock.runFor(9_000);
  await expect(toolsHint).toHaveCount(0);
  await page.clock.runFor(2_000);
  await expect(toolsHint).toHaveText('Click here or press "A" to expand / collapse');
  await expect(controlHint).toHaveText('Click here or press "D" to expand / collapse');
  await page.keyboard.press('a');
  await expect(toolsHint).toHaveCount(0);
  await expect(controlHint).toBeVisible();
  // clicking the hint toggles its wing too
  await controlHint.click();
  await expect(controlHint).toHaveCount(0);
  await expect(page.locator('.wing-tab.right')).toHaveText(/Control/);
  // gone for good
  await page.reload();
  await page.keyboard.press('Shift');
  await page.clock.runFor(15_000);
  await expect(page.getByTestId('splash')).toHaveCount(0);
  await expect(toolsHint).toHaveCount(0);
  await expect(controlHint).toHaveCount(0);
});
