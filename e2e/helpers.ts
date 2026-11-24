import { expect, test as base, type Page } from '@playwright/test';

/** Read app state through the dev-only window.__bd hook. */
export async function doc(page: Page) {
  return page.evaluate(() => (window as any).__bd.doc.getState().history.present);
}
export async function ui(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__bd.ui.getState();
    return {
      selection: s.selection,
      tool: s.tool,
      bubbleKind: s.bubbleKind,
      view: s.view,
      editingLabel: s.editingLabel,
      editingText: s.editingText,
      lineDraft: s.lineDraft,
    };
  });
}
export async function nodes(page: Page): Promise<any[]> {
  const d = await doc(page);
  return d.nodeOrder.map((id: string) => d.nodes[id]);
}

export async function lines(page: Page): Promise<any[]> {
  const d = await doc(page);
  return d.lineOrder.map((id: string) => d.lines[id]);
}

export async function texts(page: Page): Promise<any[]> {
  const d = await doc(page);
  return d.textOrder.map((id: string) => d.texts[id]);
}

export class Canvas {
  constructor(
    private page: Page,
    public x: number,
    public y: number,
  ) {}
  /** screen point relative to the canvas' top-left */
  at(dx: number, dy: number) {
    return { x: this.x + dx, y: this.y + dy };
  }
  async click(dx: number, dy: number) {
    await this.page.mouse.click(this.x + dx, this.y + dy);
  }
  async dblclick(dx: number, dy: number) {
    await this.page.mouse.dblclick(this.x + dx, this.y + dy);
  }
  async drag(from: [number, number], to: [number, number], steps = 6) {
    await this.page.mouse.move(this.x + from[0], this.y + from[1]);
    await this.page.mouse.down();
    await this.page.mouse.move(this.x + to[0], this.y + to[1], { steps });
    await this.page.mouse.up();
  }
  /** place a 10' bubble (B tool, one click) and return to select */
  async bubble(dx: number, dy: number) {
    await this.page.keyboard.press('b');
    await this.click(dx, dy);
  }
}

/** The opening logo fades on any input; Shift does nothing else in the app. */
export async function dismissSplash(page: Page) {
  await page.keyboard.press('Shift');
  await expect(page.getByTestId('splash')).toHaveCount(0);
}

/** Reload the page as a user would (the splash shows again) and wait until the app is usable. */
export async function reloadApp(page: Page) {
  await page.reload();
  await page.waitForSelector('.canvas canvas');
  await page.waitForFunction(() => (window as any).__bd);
  await dismissSplash(page);
  // the wing hints (they fade in 10 s on, over the canvas the tests click) start put away; the
  // hints test reloads by hand to see them
  await page.evaluate(() => (window as any).__bd.panels.setState({ hintsSeen: { tools: true, controls: true } }));
}

export const test = base.extend<{ canvas: Canvas }>({
  canvas: async ({ page }, use) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await reloadApp(page);
    // the tests' pixel math is written at 1/8" (12 px per ft at 100%), whatever the default scale
    await page.evaluate(() => {
      const d = (window as any).__bd.doc.getState();
      const p = d.history.present;
      d.replace({ ...p, settings: { ...p.settings, scale: '1/8' } }, true);
    });
    const box = (await page.locator('.canvas').boundingBox())!;
    await use(new Canvas(page, box.x, box.y));
  },
});

/*
 * Settings inputs by their field label: the selection bar (and its open menus) comes first in
 * the page, then the standards wing. Menus and collapsed sections only exist while open: use
 * `openMenu` / `openSection` first.
 */

/** Input whose field label is exactly `label`. */
export function field(page: Page, label: string) {
  return page.locator(`.field:has(> .field-label:text-is("${label}")) input`).first();
}

/** Checkbox by its own text (checkbox names also include their row's label). */
export function checkbox(page: Page, text: string) {
  return page.locator(`.field label.checkbox:has-text("${text}") input`).first();
}

/** Dropdown whose field label is exactly `label`. */
export function select(page: Page, label: string) {
  return page.locator(`.field:has(> .field-label:text-is("${label}")) select`).first();
}

/** Open one of the selection bar's menus (Size, Label, More, Overlaps…) by its button text. */
export async function openMenu(page: Page, label: string) {
  const btn = page.locator(`.selbar .bar-pop-btn:has-text("${label}")`);
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}

/** The graphic style picker (Graphic standards → Style), opening its section first. */
export async function graphicStyle(page: Page) {
  await openSection(page, 'Graphic standards');
  return page.locator('.standards .field:has(> .field-label:text-is("Style")) select');
}

/** Expand a section of the standards wing by its title (no-op when already open). */
export async function openSection(page: Page, title: string) {
  const t = page.locator(`.section-toggle:has(h3:text-is("${title}"))`);
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
}

export async function importSampleCsv(page: Page) {
  await page.getByRole('button', { name: 'File ▾' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: /Import CSV/ }).click(),
  ]);
  await chooser.setFiles('examples/sample-program.csv');
  await expect(page.locator('.toast')).toContainText('Imported 11');
}

/**
 * Stand-in for the system save/open dialogs (File System Access API), which a
 * test can't click. Files written land in `window.__files[name]`; set
 * `__saveAs` to the name the user "types", `__cancelNext` to press Cancel,
 * `__openName` for the file Open picks.
 */
export async function fakeFileDialogs(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__files = {};
    w.__writes = 0;
    const handle = (name: string) => ({
      kind: 'file',
      name,
      async createWritable() {
        const chunks: Blob[] = [];
        return {
          async write(b: Blob) {
            chunks.push(b);
          },
          async close() {
            const blob = new Blob(chunks);
            w.__files[name] = { size: blob.size, text: await blob.text() };
            w.__writes++;
          },
        };
      },
      async getFile() {
        return new File([w.__files[name].text], name);
      },
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    });
    // like Chrome, refuse to run detached from window ("Illegal invocation")
    w.showSaveFilePicker = async function (this: unknown, o: { suggestedName: string }) {
      if (this !== window) throw new TypeError('Illegal invocation');
      if (w.__cancelNext) {
        w.__cancelNext = false;
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      return handle(w.__saveAs ?? o.suggestedName);
    };
    w.showOpenFilePicker = async function (this: unknown) {
      if (this !== window) throw new TypeError('Illegal invocation');
      return [handle(w.__openName)];
    };
  });
}

/** Browsers without the dialogs (Safari, Firefox): saving falls back to downloads. */
export async function noFileDialogs(page: Page) {
  await page.evaluate(() => {
    delete (window as any).showSaveFilePicker;
    delete (window as any).showOpenFilePicker;
  });
}

export { expect };
