import { doc, expect, field, nodes, openMenu, select, test, ui } from './helpers';

test('a 10 ft bubble is 120 px across its radius at 1/8" and 100%', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  const [n] = await nodes(page);
  expect(n.shape.radiusFt).toBe(10);
  // clicking 119 px below center still hits it; 125 px does not (below avoids the resize handle)
  await page.keyboard.press('Escape');
  await canvas.click(400, 300 + 119);
  expect((await ui(page)).selection.nodes).toEqual([n.id]);
  await canvas.click(400, 300 + 125);
  expect((await ui(page)).selection.nodes).toEqual([]);
});

test("drag moves, resize handle snaps to 1', wheel steps 1'", async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  const before = (await nodes(page))[0];
  await canvas.drag([400, 300], [460, 300]);
  const moved = (await nodes(page))[0];
  expect(moved.x - before.x).toBeCloseTo(5, 1); // 60 px / 12 px per ft
  // handle sits on the right edge of the selected bubble (center now at 460)
  await canvas.drag([580, 300], [609, 300]);
  expect((await nodes(page))[0].shape.radiusFt).toBe(12); // 149 px -> 12.4 ft -> snapped to 1'
  await page.mouse.move(canvas.x + 460, canvas.y + 300);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await nodes(page))[0].shape.radiusFt).toBe(15);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await nodes(page))[0].shape.radiusFt).toBe(14);
});

test('the bubble tool shows its shape at the cursor; the wheel sizes it before placing', async ({ page, canvas }) => {
  const placeSize = () => page.evaluate(() => (window as any).__bd.ui.getState().placeSize);
  await page.keyboard.press('b');
  await page.mouse.move(canvas.x + 400, canvas.y + 300);
  expect(await placeSize()).toBe(10);
  const zoom = (await ui(page)).view.zoom;
  // two notches up: 1' steps (the size snap), not a zoom
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  await expect.poll(placeSize).toBe(12);
  expect((await ui(page)).view.zoom).toBe(zoom);
  // Shift (held to place several) doesn't change the step
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Shift');
  await expect.poll(placeSize).toBe(11);
  await page.mouse.wheel(0, -100);
  await expect.poll(placeSize).toBe(12);
  await canvas.click(400, 300);
  expect((await nodes(page))[0].shape).toEqual({ kind: 'circle', radiusFt: 12 });
  // the square tool places the same area, until the wheel changes it
  await page.keyboard.press('q');
  await canvas.click(800, 300);
  const sq = (await nodes(page))[1].shape;
  expect(sq.kind).toBe('rect');
  expect(sq.widthFt * sq.heightFt).toBeCloseTo(Math.PI * 12 * 12, 6);
  // Ctrl+wheel still zooms with the tool active
  await page.keyboard.press('b');
  await page.mouse.move(canvas.x + 600, canvas.y + 600);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await ui(page)).view.zoom).toBeGreaterThan(zoom);
  expect(await placeSize()).toBe(12); // back on the circle: the same area again
});

test('with the bubble tool the bar sets up the next bubble: shape, category, area', async ({ page, canvas }) => {
  const catName = async (n: any) => (await doc(page)).categories[n.categoryId]?.name;
  await page.keyboard.press('b');
  await expect(page.locator('.selbar .bar-title')).toHaveText(/New circle/i);
  // B, Tab, type the area, Tab to the category, pick one by keyboard
  await page.keyboard.press('Tab');
  await expect(field(page, 'Area')).toBeFocused();
  await page.keyboard.type('600');
  await page.keyboard.press('Tab');
  await expect(select(page, 'Category')).toBeFocused();
  await select(page, 'Category').selectOption({ label: 'Bedroom' });
  // Shift+click keeps placing with the same setup
  await page.keyboard.down('Shift');
  await canvas.click(400, 300);
  await page.keyboard.up('Shift');
  let [a] = await nodes(page);
  expect(await catName(a)).toBe('Bedroom');
  expect(Math.PI * a.shape.radiusFt ** 2).toBeCloseTo(600, 6);
  // the shape toggle; a plain click places and returns to select, showing the new bubble's settings
  await page.locator('.selbar .seg:has-text("Square")').click();
  await canvas.click(800, 300);
  const b = (await nodes(page))[1];
  expect(b.shape.kind).toBe('rect');
  expect(b.shape.widthFt * b.shape.heightFt).toBeCloseTo(600, 6);
  expect(await catName(b)).toBe('Bedroom');
  await expect(page.locator('.selbar .bar-title')).toHaveText('Square');
  // the setup is remembered for the next time the tool is picked
  await page.keyboard.press('b');
  await expect(select(page, 'Category')).toHaveValue(b.categoryId);
  a = (await nodes(page))[0];
  expect(a.style).toEqual({}); // styles come from the category, not copied onto the bubble
});

test('with the bubble tool, right-click cycles the category to place', async ({ page, canvas }) => {
  const picked = () => page.evaluate(() => (window as any).__bd.ui.getState().placeCategory);
  const order: string[] = (await doc(page)).categoryOrder;
  await page.keyboard.press('b');
  const right = async (shift = false) => {
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.click(canvas.x + 500, canvas.y + 400, { button: 'right' });
    if (shift) await page.keyboard.up('Shift');
  };
  expect(await picked()).toBeNull();
  await right();
  expect(await picked()).toBe(order[0]);
  await right();
  expect(await picked()).toBe(order[1]);
  await expect(select(page, 'Category')).toHaveValue(order[1]);
  // Shift goes back; past the first comes None, then the last
  await right(true);
  await right(true);
  expect(await picked()).toBeNull();
  await right(true);
  expect(await picked()).toBe(order[order.length - 1]);
  // a right-click places nothing; a left click places in that category
  expect(await nodes(page)).toHaveLength(0);
  await canvas.click(500, 400);
  expect((await nodes(page))[0].categoryId).toBe(order[order.length - 1]);
});

test('right-click recategorizes bubbles; on a selected one, the whole selection', async ({ page, canvas }) => {
  const order: string[] = (await doc(page)).categoryOrder;
  const cats = async () => (await nodes(page)).map((n: any) => n.categoryId);
  const right = async (x: number, y: number, shift = false) => {
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.click(canvas.x + x, canvas.y + y, { button: 'right' });
    if (shift) await page.keyboard.up('Shift');
  };
  await canvas.bubble(300, 300);
  await canvas.bubble(600, 300);
  await canvas.bubble(900, 300);
  await canvas.click(1000, 700); // nothing selected
  await right(300, 300);
  await right(300, 300);
  expect(await cats()).toEqual([order[1], null, null]);
  await right(300, 300, true);
  expect(await cats()).toEqual([order[0], null, null]);
  // the selection (2nd and 3rd) steps together, from the clicked one's category
  await canvas.click(600, 300);
  await page.keyboard.down('Shift');
  await canvas.click(900, 300);
  await page.keyboard.up('Shift');
  await right(900, 300);
  expect(await cats()).toEqual([order[0], order[0], order[0]]);
  // quick clicks are one undo step; empty canvas does nothing
  await right(900, 300);
  await right(900, 300);
  expect(await cats()).toEqual([order[0], order[2], order[2]]);
  await right(1000, 700);
  await page.keyboard.press('Control+z');
  expect(await cats()).toEqual([order[0], null, null]);
});

test('wheel over empty canvas zooms', async ({ page, canvas }) => {
  await page.mouse.move(canvas.x + 200, canvas.y + 200);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await ui(page)).view.zoom).toBeGreaterThan(1.2);
});

test('selection: marquee, shift-click, select all, duplicate, nudge, delete, undo/redo', async ({ page, canvas }) => {
  await canvas.bubble(250, 250);
  await canvas.bubble(550, 250);
  await canvas.bubble(850, 250);
  await canvas.click(1000, 700);
  await canvas.drag([180, 80], [700, 450]); // starts just right of the tools wing
  expect((await ui(page)).selection.nodes).toHaveLength(2);
  await canvas.click(250, 250);
  await page.keyboard.down('Shift');
  await canvas.click(850, 250);
  await page.keyboard.up('Shift');
  expect((await ui(page)).selection.nodes).toHaveLength(2);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+d');
  expect(await nodes(page)).toHaveLength(6);
  const x0 = (await nodes(page))[5].x;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  expect((await nodes(page))[5].x - x0).toBeCloseTo(11);
  await page.keyboard.press('Delete');
  expect(await nodes(page)).toHaveLength(3);
  await page.keyboard.press('Control+z'); // undo delete
  expect(await nodes(page)).toHaveLength(6);
  await page.keyboard.press('Control+z'); // undo both nudges (one coalesced step)
  expect((await nodes(page))[5].x).toBeCloseTo(x0);
  await page.keyboard.press('Control+Shift+z');
  expect((await nodes(page))[5].x - x0).toBeCloseTo(11);
});

test('connect tool links two bubbles; connection type can change', async ({ page, canvas }) => {
  await canvas.bubble(300, 300);
  await canvas.bubble(700, 300);
  await page.keyboard.press('c');
  await canvas.click(300, 300);
  await canvas.click(700, 300);
  await page.keyboard.press('v');
  const d = await doc(page);
  const conns = Object.values(d.connections) as any[];
  expect(conns).toHaveLength(1);
  await canvas.click(500, 300); // the line between them
  await page.getByRole('button', { name: /Strong adjacency/ }).click();
  expect((Object.values((await doc(page)).connections) as any[])[0].type).toBe('strong');
});

test('size by radius, diameter or area', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  await field(page, 'Area').fill('1,200 sf');
  await field(page, 'Area').press('Enter');
  await openMenu(page, 'Size');
  await expect(field(page, 'Radius')).toHaveValue(`19'-7"`);
  expect((await nodes(page))[0].shape.radiusFt).toBeCloseTo(Math.sqrt(1200 / Math.PI), 6);
  await field(page, 'Diameter').fill(`30'`);
  await field(page, 'Diameter').press('Enter');
  await expect(field(page, 'Area')).toHaveValue('707 sf');
});

test('Tab types an area for the selected bubbles (circles and squares)', async ({ page, canvas }) => {
  const area = (n: any) =>
    n.shape.kind === 'circle' ? Math.PI * n.shape.radiusFt ** 2 : n.shape.widthFt * n.shape.heightFt;
  await canvas.bubble(400, 300);
  await page.keyboard.press('Tab');
  await expect(field(page, 'Area')).toBeFocused();
  await page.keyboard.type('1,200 sf');
  await page.keyboard.press('Enter');
  expect(area((await nodes(page))[0])).toBeCloseTo(1200, 6);
  // the shortcuts work again once the area is in
  await expect(field(page, 'Area')).not.toBeFocused();

  await page.keyboard.press('q');
  await canvas.click(900, 300);
  await page.keyboard.press('Tab');
  await page.keyboard.type('400');
  await page.keyboard.press('Enter');
  expect((await nodes(page))[1].shape).toEqual({ kind: 'rect', widthFt: 20, heightFt: 20 });

  // with text selected too, Tab switches the bar to the bubbles first
  await page.keyboard.press('t');
  await canvas.click(600, 600);
  await page.keyboard.type('Note');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await page.locator('.kind-chip:has-text("Text")').click();
  await page.keyboard.press('Tab');
  await expect(field(page, 'Area')).toBeFocused();
  await page.keyboard.type('900');
  await page.keyboard.press('Enter');
  for (const n of await nodes(page)) expect(area(n)).toBeCloseTo(900, 6);

  // text alone: Tab does nothing
  await page.keyboard.press('Escape');
  await canvas.click(610, 607);
  await page.keyboard.press('Tab');
  await expect(page.locator('.selbar .field-label:text-is("Area")')).toHaveCount(0);
});

test('names edit in place only on the selected bubble', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  await canvas.click(1000, 700);
  await canvas.click(400, 297); // selects
  await expect(page.locator('.label-editor')).toHaveCount(0);
  await canvas.click(400, 297); // edits
  await expect(page.locator('.label-editor')).toHaveCount(1);
  await page.keyboard.type('Reading Room');
  await page.keyboard.press('Enter');
  expect((await nodes(page))[0].name).toBe('Reading Room');
  await canvas.dblclick(400, 297);
  await page.keyboard.type('Nope');
  await page.keyboard.press('Escape');
  expect((await nodes(page))[0].name).toBe('Reading Room');
});

test('a bubble can have no name; double-click it to name it again', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  await canvas.dblclick(400, 297); // the name
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  expect((await nodes(page))[0].name).toBe('');
  await expect(page.locator('.label-editor')).toHaveCount(0);
  // no name text to click: double-click anywhere on the bubble
  await canvas.dblclick(400, 250);
  await expect(page.locator('.label-editor[aria-label="Name"]')).toHaveValue('');
  await page.keyboard.type('Lobby');
  await page.keyboard.press('Enter');
  expect((await nodes(page))[0].name).toBe('Lobby');
  await page.keyboard.press('Control+z');
  expect((await nodes(page))[0].name).toBe('');
});

test('the Labels box hides bubble annotations for this tab only', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  const labels = page.locator('.tabbar label.checkbox:has-text("Labels") input');
  await expect(labels).toBeChecked();
  await labels.uncheck();
  expect((await doc(page)).settings.showLabels).toBe(false);
  // nothing to click: no in-place editor, not even for a nameless bubble
  await canvas.dblclick(400, 297);
  await expect(page.locator('.label-editor')).toHaveCount(0);
  await page.locator('.tab-new').click();
  await expect(labels).toBeChecked();
  await page.locator('.tab').nth(0).click();
  await expect(labels).not.toBeChecked();
  await page.keyboard.press('Control+z');
  await expect(labels).toBeChecked();
});

test('area edits in place on the selected bubble', async ({ page, canvas }) => {
  await canvas.bubble(400, 300);
  await canvas.click(1000, 700);
  await canvas.click(400, 309); // selects (the area line sits just below the name)
  await expect(page.locator('.label-editor')).toHaveCount(0);
  await canvas.click(400, 309); // edits the area, not the name
  await expect(page.locator('.label-editor[aria-label="Area"]')).toHaveValue('314 sf');
  await page.keyboard.type('1,200 sf');
  await page.keyboard.press('Enter');
  const [n] = await nodes(page);
  expect(Math.PI * n.shape.radiusFt ** 2).toBeCloseTo(1200, 6);
  expect(n.name).toBe('Space 1');
  // nonsense is ignored; Esc cancels
  await canvas.dblclick(400, 309);
  await page.keyboard.type('big');
  await page.keyboard.press('Enter');
  await canvas.dblclick(400, 309);
  await page.keyboard.type('50');
  await page.keyboard.press('Escape');
  expect((await nodes(page))[0].shape.radiusFt).toBe(n.shape.radiusFt);
  // one undo step back to 10'
  await page.keyboard.press('Control+z');
  expect((await nodes(page))[0].shape.radiusFt).toBe(10);
});

test('drag from one bubble to another connects them', async ({ page, canvas }) => {
  await canvas.bubble(300, 300);
  await canvas.bubble(700, 300);
  await page.keyboard.press('c');
  await canvas.drag([300, 300], [700, 300]);
  expect(Object.keys((await doc(page)).connections)).toHaveLength(1);
});

test('squares: place, corner hit, corner resize, width/height, convert keeping area', async ({ page, canvas }) => {
  await page.keyboard.press('q'); // the Square tool
  await page.keyboard.press('Tab'); // type its area
  await page.keyboard.type('400');
  await page.keyboard.press('Enter');
  await canvas.click(400, 300);
  let [n] = await nodes(page);
  expect(n.shape).toEqual({ kind: 'rect', widthFt: 20, heightFt: 20 });
  // 20' side = 240 px at 1/8" and 100%: a point near the corner is inside (a circle would miss it)
  await canvas.click(1000, 700);
  await canvas.click(400 + 110, 300 - 110);
  expect((await ui(page)).selection.nodes).toEqual([n.id]);
  // the corner handle resizes proportionally, snapping the half-side to 6"
  await canvas.drag([520, 420], [580, 470]);
  [n] = await nodes(page);
  expect(n.shape).toEqual({ kind: 'rect', widthFt: 30, heightFt: 30 });
  // width and height can differ
  await openMenu(page, 'Size');
  await field(page, 'Height').fill('12');
  await field(page, 'Height').press('Enter');
  [n] = await nodes(page);
  expect(n.shape).toEqual({ kind: 'rect', widthFt: 30, heightFt: 12 });
  // converting keeps the area
  await select(page, 'Shape').selectOption('circle');
  [n] = await nodes(page);
  expect(Math.PI * n.shape.radiusFt ** 2).toBeCloseTo(360, 6);
  // Bubble (B) and Square (Q) are separate tiles in the tool palette
  await page.keyboard.press('b');
  await expect(page.locator('.tool-tile.active')).toHaveText(/Bubble/);
  await page.locator('.tool-tile:has-text("Square")').click();
  expect((await ui(page)).bubbleKind).toBe('rect');
  await expect(page.locator('.tool-tile.active')).toHaveText(/Square/);
});
