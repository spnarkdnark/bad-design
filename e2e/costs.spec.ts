import { doc, expect, field, nodes, openMenu, openSection, select, test } from './helpers';

test('cost per sf: firm default, drawing rate, element override, totals and the cost line', async ({
  page,
  canvas,
}) => {
  await canvas.bubble(400, 300); // 10' radius: 314.16 sf
  await select(page, 'Category').selectOption({ label: 'Public' });
  await canvas.click(1000, 700);

  // firm default (shared standard) in Category standards
  const publicRow = page.locator('.category-list > li').nth(1);
  await publicRow.locator('.chev').click();
  await field(page, 'Default / sf').fill('200');
  await field(page, 'Default / sf').press('Enter');
  const total = page.locator('.standards .field:has(.field-label:text-is("Total cost")) .readonly');
  await expect(total).toHaveText('$62,832');

  // this drawing's own rate overrides the firm default
  await openSection(page, 'Costs');
  const rate = page.locator('.cost-row:has-text("Public") input');
  await rate.fill('$250/sf');
  await rate.press('Enter');
  await expect(total).toHaveText('$78,540');
  expect((await doc(page)).costRates.categories).toEqual({ [(await nodes(page))[0].categoryId]: 250 });

  // a new tab follows the firm default, not the other drawing's rate
  await page.locator('.tab-new').click();
  const d2 = await doc(page);
  expect(d2.costRates.categories).toEqual({});
  expect((Object.values(d2.categories) as any[]).find((c) => c.name === 'Public').costPerSf).toBe(200);
  await page.locator('.tab').nth(0).click();

  // the element's own rate, and resetting it
  await canvas.click(400, 270);
  await field(page, 'Cost / sf').fill('100');
  await field(page, 'Cost / sf').press('Enter');
  expect((await nodes(page))[0].costPerSf).toBe(100);
  await page.locator('.selbar .field:has(.field-label:has-text("Cost / sf")) .override-dot').click();
  expect((await nodes(page))[0].costPerSf).toBeUndefined();

  // the cost line under the area edits in place (find it below the name)
  let found = false;
  for (let y = 304; y <= 344 && !found; y += 4) {
    await canvas.dblclick(400, y);
    found = (await page.locator('.label-editor[aria-label="Cost"]').count()) > 0;
    if (!found) await page.keyboard.press('Escape');
  }
  expect(found).toBe(true);
  await expect(page.locator('.label-editor')).toHaveValue('$250/sf');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('125');
  await page.keyboard.press('Enter');
  expect((await nodes(page))[0].costPerSf).toBe(125);

  // the cost line can be turned off like the area
  await openMenu(page, 'Label');
  await select(page, 'Show cost').selectOption('none');
  expect((await nodes(page))[0].style.labelCost).toBe('none');
});

test('CSV cost column sets each element’s rate', async ({ page, canvas }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() =>
    navigator.clipboard.writeText('name\tarea\tcategory\t$/sf\nKitchen\t400\tService\t$300\nPatio\t900\tExterior\t'),
  );
  await canvas.click(600, 400);
  await page.keyboard.press('Control+v');
  await expect.poll(async () => (await nodes(page)).length).toBe(2);
  const [kitchen, patio] = await nodes(page);
  expect(kitchen.costPerSf).toBe(300);
  expect(kitchen.shape.radiusFt ** 2 * Math.PI).toBeCloseTo(400, 0); // "$/sf" is not read as area
  expect(patio.costPerSf).toBeUndefined();
});
