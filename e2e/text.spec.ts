import { expect } from '@playwright/test';
import { fakeFileDialogs, field, nodes, select, test, texts, ui, reloadApp } from './helpers';

const editor = (page: import('@playwright/test').Page) => page.getByRole('textbox', { name: 'Text', exact: true });

test('text tool: click to place, type, finish; one undo step; nothing placed when left empty', async ({
  page,
  canvas,
}) => {
  await page.keyboard.press('t');
  expect((await ui(page)).tool).toBe('text');
  await canvas.click(300, 200);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type('Site notes');
  await page.keyboard.press('Enter');
  await page.keyboard.type('North yard');
  await page.keyboard.press('Escape');
  await expect(editor(page)).toHaveCount(0);

  const [t] = await texts(page);
  expect(t.text).toBe('Site notes\nNorth yard');
  expect(t.widthPt).toBeNull();
  const u = await ui(page);
  expect(u.tool).toBe('select');
  expect(u.selection.texts).toEqual([t.id]);

  // the sidebar shows the text section
  await expect(select(page, 'Font')).toHaveValue('helvetica');

  await page.keyboard.press('Control+z');
  expect(await texts(page)).toHaveLength(0);
  await page.keyboard.press('Control+Shift+z');
  expect(await texts(page)).toHaveLength(1);

  // an empty block is not kept
  await page.keyboard.press('t');
  await canvas.click(300, 400);
  await page.keyboard.press('Escape');
  expect(await texts(page)).toHaveLength(1);
});

test('edit text by double-click, Enter or clicking the selected block; emptying deletes it', async ({
  page,
  canvas,
}) => {
  await page.keyboard.press('t');
  await canvas.click(300, 200);
  await page.keyboard.type('Entry');
  await canvas.click(600, 450); // click away finishes
  expect((await texts(page))[0].text).toBe('Entry');

  await canvas.dblclick(310, 208);
  await expect(editor(page)).toHaveValue('Entry');
  await page.keyboard.press('End');
  await page.keyboard.type(' court');
  await page.keyboard.press('Control+Enter');
  expect((await texts(page))[0].text).toBe('Entry court');

  // Enter on the selected block
  await page.keyboard.press('Enter');
  await expect(editor(page)).toBeVisible();
  await page.keyboard.press('Escape');

  // a click on the already-selected block types into it
  await canvas.click(310, 208);
  await expect(editor(page)).toBeVisible();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  expect(await texts(page)).toHaveLength(0);
  await page.keyboard.press('Control+z');
  expect((await texts(page))[0].text).toBe('Entry court');
});

test('text moves, nudges, deletes and selects by marquee together with bubbles', async ({ page, canvas }) => {
  await canvas.bubble(200, 300);
  await page.keyboard.press('t');
  await canvas.click(400, 300);
  await page.keyboard.type('Label');
  await page.keyboard.press('Escape');
  const before = (await texts(page))[0];

  await canvas.drag([410, 307], [470, 347]);
  const moved = (await texts(page))[0];
  expect(moved.x - before.x).toBeCloseTo(60 / 12, 1); // 12 px per ft at 1/8" and 100%
  expect(moved.y - before.y).toBeCloseTo(40 / 12, 1);

  await page.keyboard.press('ArrowRight');
  expect((await texts(page))[0].x - moved.x).toBeCloseTo(1, 5);

  // marquee over the bubble and the text selects both; move them together
  await canvas.drag([100, 150], [650, 450]);
  const sel = (await ui(page)).selection;
  expect(sel.nodes).toHaveLength(1);
  expect(sel.texts).toHaveLength(1);
  const n0 = (await nodes(page))[0];
  const t0 = (await texts(page))[0];
  await page.keyboard.press('ArrowDown');
  expect((await nodes(page))[0].y - n0.y).toBeCloseTo(1, 5);
  expect((await texts(page))[0].y - t0.y).toBeCloseTo(1, 5);

  await page.keyboard.press('Delete');
  expect(await nodes(page)).toHaveLength(0);
  expect(await texts(page)).toHaveLength(0);
});

test('sidebar styles text; the width handle sets wrapping; new text keeps the last look', async ({ page, canvas }) => {
  await page.keyboard.press('t');
  await canvas.click(250, 200);
  await page.keyboard.type('Program diagram for the north house');
  await page.keyboard.press('Escape');

  await select(page, 'Font').selectOption('times');
  await field(page, 'Size').fill('18');
  await field(page, 'Size').press('Enter');
  await page.getByLabel('Bold').check();
  await page.getByRole('button', { name: 'Center' }).click();
  let t = (await texts(page))[0];
  expect(t.style).toMatchObject({ font: 'times', sizePt: 18, bold: true, align: 'center' });

  // drag the width handle (middle of the right edge) to make it wrap at 12' (on paper: 1.5")
  const { view } = await ui(page);
  const k = 12 * view.zoom; // px per ft at 1/8"
  const handle = await page.evaluate(() => {
    const bd = (window as any).__bd;
    const p = bd.doc.getState().history.present;
    return bd.textWidthHandle(p.texts[p.textOrder[0]], p);
  });
  const sx = (x: number) => x * k + view.panX;
  const sy = (y: number) => y * k + view.panY;
  await canvas.drag([sx(handle.x), sy(handle.y)], [sx(t.x + 12), sy(handle.y)]);
  t = (await texts(page))[0];
  expect(t.widthPt).toBeCloseTo(1.5 * 72, 0);

  // double-click the handle: no wrapping again (one undo step back to wrapping)
  const h2 = await page.evaluate(() => {
    const bd = (window as any).__bd;
    const p = bd.doc.getState().history.present;
    return bd.textWidthHandle(p.texts[p.textOrder[0]], p);
  });
  await canvas.dblclick(sx(h2.x), sy(h2.y));
  expect((await texts(page))[0].widthPt).toBeNull();
  await page.keyboard.press('Control+z');
  expect((await texts(page))[0].widthPt).toBeCloseTo(1.5 * 72, 0);

  await expect(page.getByLabel('At a set width')).toBeChecked();
  await page.getByLabel('At a set width').uncheck();
  expect((await texts(page))[0].widthPt).toBeNull();

  // the next block is typed in the same look
  await page.keyboard.press('t');
  await canvas.click(250, 450);
  await page.keyboard.type('Second');
  await page.keyboard.press('Escape');
  expect((await texts(page))[1].style).toMatchObject({ font: 'times', sizePt: 18, bold: true, align: 'center' });
});

test('copy/paste and duplicate carry text; paste style copies a text look', async ({ page, canvas }) => {
  await page.keyboard.press('t');
  await canvas.click(250, 200);
  await page.keyboard.type('Garden');
  await page.keyboard.press('Escape');
  await select(page, 'Font').selectOption('comic');

  await page.keyboard.press('Control+d');
  let all = await texts(page);
  expect(all).toHaveLength(2);
  expect(all[1]).toMatchObject({ text: 'Garden', style: { font: 'comic' } });
  expect((await ui(page)).selection.texts).toEqual([all[1].id]);

  await page.keyboard.press('Control+c');
  await page.mouse.move(canvas.x + 500, canvas.y + 400);
  await page.keyboard.press('Control+v');
  all = await texts(page);
  expect(all).toHaveLength(3);
  expect(all[2].text).toBe('Garden');

  // a third, plain block takes the copied look with Ctrl+Shift+V
  await page.keyboard.press('t');
  await canvas.click(250, 480);
  await page.keyboard.type('Plain');
  await page.keyboard.press('Escape');
  await select(page, 'Font').selectOption('courier');
  await page.keyboard.press('Control+Shift+v');
  expect((await texts(page))[3].style.font).toBe('comic');
});

test('text survives reload and exports as text (standard fonts) or outlines (bundled fonts)', async ({
  page,
  canvas,
}) => {
  await page.keyboard.press('t');
  await canvas.click(250, 200);
  await page.keyboard.type('Helvetica note');
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  await canvas.click(250, 300);
  await page.keyboard.type('Architect note');
  await page.keyboard.press('Escape');
  await select(page, 'Font').selectOption('architect');

  await page.waitForTimeout(700); // autosave
  await reloadApp(page);
  expect((await texts(page)).map((t) => t.text)).toEqual(['Helvetica note', 'Architect note']);

  await fakeFileDialogs(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.locator('.dialog .seg:has-text("SVG")').click();
  await page.evaluate(() => ((window as any).__saveAs = 'notes.svg'));
  await page.locator('.dialog button:has-text("Export SVG")').click();
  await expect(page.locator('.dialog')).toHaveCount(0);
  const svg: string = await page.evaluate(() => (window as any).__files['notes.svg'].text);
  expect(svg).toContain('>Helvetica note</text>');
  expect(svg).not.toContain('Architect note');
  expect(svg).toMatch(/<g id="text-[^"]+"><path d="M/);
});
