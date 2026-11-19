# Bubble Diagram — notes for future sessions

Web app for architectural bubble (program) diagrams. React 18 + Vite + TypeScript,
react-konva canvas, Zustand + Immer state. No UI framework; plain CSS with tokens.

## Commands

- `npm run dev` — dev server (http://localhost:5173)
- `npm test` — Vitest unit tests (`tests/`, model/store/io/render; no DOM)
- `npm run e2e` — Playwright browser tests (`e2e/`; starts its own dev server on 5199).
  First time on a machine: `npx playwright install chromium`.
- `npm run lint` (ESLint) / `npm run format` (Prettier) / `npm run typecheck` / `npm run build`
- Before committing: typecheck, lint, `npm run format:check`, `npm test`, `npm run e2e` all pass.
- TypeScript is pinned to 5.9 (typescript-eslint does not support TS 7 yet).
- Deploy: `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
  every push to main (repo Settings → Pages → Source must be "GitHub Actions"). The build
  uses `BASE_PATH=/<repo>/` (vite `base`); runtime asset URLs must go through Vite imports
  (e.g. `?url`), never hard-coded absolute paths, or they break under the sub-path.

## Conventions

- Prettier owns formatting (single quotes, 120 cols). Don't hand-format.
- No `any` outside `model/migrate.ts` (untrusted JSON) and tests.
- e2e tests read app state via `window.__bd` (dev builds only, set in `main.tsx`;
  stripped from production). Prefer asserting on document state over pixels.
- The opening splash covers the app until any key, click, wheel or touch (not mouse
  moves); the click that dismisses it is swallowed, keys pass through. e2e: the `canvas`
  fixture dismisses it; after a reload use `helpers.reloadApp`, never bare `page.reload()`.
- Edit with tools that fail loudly when text doesn't match; scripted find/replace
  that silently no-ops has bitten this codebase before.
- `model/` is pure (no React, no stores). UI never mutates stores directly: it calls
  `store/actions`.

## The one rule: units

- **Model space = feet.** Every coordinate, radius, grid spacing, nudge is in feet.
  Never store pixels in the document.
- **Paper space = points (1/72").** Line weights (`strokeWeightPt`, overlap `weightPt`)
  and label sizes (`labelSizePt`) are paper sizes, like CAD annotative objects: changing
  the drawing scale changes bubble size on paper but not text/line size.
- Conversions live only in `src/model/units.ts`:
  - `pxPerFt(scale, zoom) = 96 * paperInPerFt * zoom` (96 px = 1 paper inch at 100%)
  - `ptToFt(pt, scale)` for rendering paper-space values in model space
- The Konva `Stage` is transformed by `scale = pxPerFt(scale, zoom)` and
  `position = (panX, panY)`; shapes are drawn directly in feet. Screen-constant
  overlay sizes (handles, hit widths) are `px / k` where `k` is the stage scale
  (`canvas/viewport.ts#pxToFt`).

## Layout

```
src/model/    pure TS: types, units, geometry (all shape-kind switches), color,
              defaults, factory, selectors (resolveStyle…), migrate, overlaps,
              elements (registry of element kinds: selection/move/delete/copy/bounds
              for any kind), clip (copy/paste/duplicate payloads), text (text block
              layout + bounds; measurement injected by canvas/textLayout),
              costs (cost per sf: firm → drawing → element; totals, breakdown),
              standards (shared library + firm defaults), categories (matching by
              name: the one rule for files, paste, CSV, reset), polygon,
              blob/ (geometry.ts resolve+sample, build.ts from input, edit.ts points)
src/store/    history.ts (pure undo stack), documentStore (active tab's undoable
              Project), uiStore (selection/tool/view, NOT undoable), workspaceStore
              (tabs + standards sync), standardsStore, actions/ (all document ops,
              one file per area: nodes, size (circles/rectangles), blobs (freeform),
              costs, labels (in-place label edits), texts (text blocks), elements
              (delete/duplicate/nudge/to-front of any kind), categories, styles,
              connections, overlaps, graphic, settings, view, selection; index.ts re-exports: import * as A from 'store/actions')
src/render/   scene.ts (Project -> primitives: nodes, labels, connections),
              overlapScene.ts (overlap treatments), primitives.ts (Prim types +
              helpers), drawCanvas.ts, sketch.ts (hand-drawn geometry + presets),
              paper.ts, fonts.ts (bundled fonts: web fonts on screen, outlines for
              export via outlineText)
src/canvas/   CanvasStage (stage + layers only), OverlayLayer (selection, handles,
              previews), tools/ (select, bubble, connect, shape, text behind the Tool/Gesture
              interface in tools/types.ts), input/useCanvasInput (pan, dispatch to the
              active tool, cursor) + input/wheel, query.ts (hit testing, snapping),
              overlayStore (marquee/stroke/snap hint), viewport.ts, hitTest,
              textLayout, LabelEditor, TextEditor, pointer, layers/GridLayer, theme.ts
              (overlay/grid colors read from the CSS tokens)
src/ui/       TabBar, Toolbar, FileMenu, ScaleBar, ExportDialog, Toast, Splash (opening logo,
              src/assets/logo.webp), focus.ts,
              icons.tsx (icon set), options.ts (choice lists shared by several
              controls), controls/ (Controls.tsx inputs; mixed.ts = common()/MIXED
              for multi-selection), panels/ (PropertiesPanel composes: BubbleProps
              + SizeFields + CostFields + StyleFields, TextProps, ConnectionProps, OverlapProps,
              DrawingPanel, CostPanel, GraphicPanel,
              OverlapSettingsPanel, ShortcutsHelp, CategoryPanel)
src/io/       fileActions (New/Open/Save/Save As/Import CSV), projectFile (JSON),
              fileSystem (system save/open dialogs, download fallback),
              clipboardActions (copy/paste events; logic in model/clip), autosave, csvImport, autoLayout,
              download, export/ (svg.ts is the single exporter; png/pdf build on it)
src/styles/   index.css imports, in cascade order: tokens (ALL colors, sizes, type,
              shadows, z-index), base (reset, shell, utilities), controls, chrome
              (tabs + toolbar), canvas (overlays on the drawing), sidebar, overlays
              (menus, dialogs, toast)
src/hooks/    useKeyboardShortcuts
tests/        Vitest unit tests (render-regression.test.ts guards scene output)
e2e/          Playwright, one spec per feature area (helpers.ts: fixtures, readers,
              field()/select() for sidebar inputs by label)
```

## Data model (src/model/types.ts)

`Project { schemaVersion, meta, settings, categories, categoryOrder, nodes, nodeOrder, connections, texts, textOrder, overlaps, costRates }`
Schema v2 (v1 files upgrade in `migrate.ts`; files without `texts` read as none).

- `BubbleNode { id, name, x, y, shape, categoryId, style }` — x/y = center (circles) or
  the origin free blob points are relative to.
- `shape` is a tagged union: `{kind:'circle', radiusFt}` | `{kind:'rect', widthFt, heightFt}`
  (centered on x/y; a square when equal) | `{kind:'blob', points, gapFt}`. Node-level
  geometry functions take `project`, because blob geometry depends on other bubbles.
- **Sizable shapes** (`SizableKind` = circle | rect; `geometry.isSizable`): placed by the
  bubble tool, resizable, sized by area, convertible (`convertShape` keeps the area).
  Their common "size" is the half-extent (`shapeSize`: radius / half-width), so the
  radius snap, wheel step and handle work the same for every kind. Everything except
  circles is drawn and hit-tested from `geometry.nodeOutline` (a polygon).
- Overlap treatments and blob ring-snapping/pockets are circles only; rectangles simply
  stack.
- **Styles**: `Category.style` and `settings.defaultStyle` are full `StyleProps`
  (fill, opacity, outline color/weight/style, label size/color/bold/secondary,
  sketchAmount). `node.style` holds only overrides (`Partial<StyleProps>`).
  Always read via `selectors.resolveStyle(node, project)`. `stroke: null` = auto.
- **Blobs**: points are `free` (ft, relative to node x/y) or `anchor` (bubble id +
  angle on its ring at `radius + gapFt`, `dir`, `arc` = follow ring to next point).
  Anchors follow bubbles. Deleting/copying without the hugged bubble calls
  `detachAnchors` (freezes them as free points); duplicate/paste remap ids.
- **Overlaps**: computed, never stored, by `overlaps.findOverlaps` (circles only).
  `project.overlaps[overlapKey(a,b)]` stores per-pair mode overrides;
  `settings.overlap` holds the default mode/weight/color/inner arcs (shared standard;
  per-pair overrides stay per diagram).
- `settings.graphic`: the drawing's sketch character (render/sketch.ts PRESETS), paper,
  lettering font and seed. Part of the shared standards (see below).
- **Costs** (`model/costs.ts`): cost per sf at three levels, each falling back to the one
  above: firm default (`Category.costPerSf`, `settings.defaultCostPerSf`; part of the
  shared standards) → this drawing's rate (`project.costRates.categories[id]` /
  `.uncategorized`; NOT a standard) → the element's own (`node.costPerSf`). Cost = area ×
  rate; overlapping elements each count their full area. Always resolve with `nodeRate`.
  An element losing its category keeps its rate (`keepRate`, like baked styles). Opening a
  file keeps its costs: its rates become the drawing's rates (`adoptProject`); a blank
  project follows the firm. `StyleProps.labelCost` (none | rate | total) shows the cost
  line; it hides while the rate is $0. The scene cache key includes `nodeRate`.
- `Connection { id, from, to, type: 'strong'|'near'|'visual' }`. Endpoints are never
  stored; `geometry.connectionSegment` computes edge-to-edge points.
- `TextBlock { id, x, y, text, widthPt, style: TextStyle }`: free text. x/y = top-left
  (feet); `widthPt` = wrapping width on paper (null = no wrapping); `TextStyle { font,
sizePt, color, bold, italic, caps, align }` (paper points, like labels; per element, no
  categories). Fonts: `TEXT_FONTS` in `model/defaults.ts` — Helvetica, Times, Courier are
  PDF standard fonts (exported as `<text>`); the other seven are bundled (`render/fonts.ts`)
  and exported as outlines. Layout (`model/text.ts#layoutText`) is shared by canvas,
  editor, hit testing and export. All text draws above bubbles; `textOrder` orders texts.

## Elements (model/elements.ts)

Bubbles and text blocks are _element kinds_, registered in `KINDS` (drawing order, back to
front). Selection (`uiStore.Selection` = ids per kind + connections + overlaps), marquee,
hit testing (`elementAt`, topmost kind first), moving (`translateElements` from the
gesture base), nudge, delete, duplicate, copy/paste, export subsets (`subsetProject`),
zoom to fit (`elementsBounds`) and the "empty drawing" checks (`hasElements`) all loop
over the registry. Never write `nodeOrder.length` / `selection.nodes` for something that
applies to every kind.

- Every kind is `project[kind]: Record<Id, T>` + an order array, and its position is
  x/y with all other geometry relative to it (moving = changing x/y).
- Copy, paste and duplicate are one path (`model/clip.ts`): `buildClip` → `planPaste` →
  `insertPlan`; CSV import and table paste also insert through `insertPlan`. Clips carry
  each kind (old clips without a kind still paste).
- Kind-specific dependents stay explicit: deleting bubbles also deletes their
  connections/overlaps and detaches hugging shapes (`actions/elements.deleteSelection`).

## Tabs

`store/workspaceStore.ts`. The ACTIVE tab's document/history live in useDocument and its
view/selection in useUi, exactly as before tabs existed, so features stay tab-unaware.
Inactive tabs are parked (`parked[id] = {history, view, selection}`) and swapped in by
`switchTab`. New/Open open tabs (Open reuses an empty tab). Autosave stores every tab's
project + view + the standards under `bubble-diagram:workspace:v1`; undo history is per
tab and in memory only. Closed tabs can be reopened from the toast.

## Standards (categories, graphic style, overlap defaults)

Categories, the uncategorized default style, `settings.graphic` and `settings.overlap` are ONE
shared library for all tabs
(`model/standards.ts` pure logic, `store/standardsStore.ts` current value, sync in
`workspaceStore.ts`). Each Project still stores a copy (files stay self-contained).

- Editing any of them in the active tab → `installStandardsSync` makes them the standards
  and `setStandardsEverywhere` rewrites every other tab's whole undo history, so undo in
  another tab can never restore an old category style. The editing tab keeps its own
  history (its undo can revert its edit, which then propagates).
- New tabs, opened files and restored tabs go through `adoptProject`: categories match via
  `model/categories.ts` (same id + name, else name ignoring case — use it for any new
  import path); the standards' styles (and graphic style) win; unknown categories join the
  standards. Paste and CSV import add unknown categories to the active tab, and the sync
  then adds them to the standards everywhere.
- Firm defaults (fresh workspace, new projects): `DEFAULT_CATEGORIES` in `model/defaults.ts`
  (Garage, Public, Bedroom, Service, Exterior: 3 pt auto outline, 10 pt #333 labels).
  A saved workspace keeps its own standards; Category standards → Reset
  (`actions.resetStandards` → pure `standards.withFirmDefaults`) restores the defaults
  everywhere, matching categories by name.
- Adding another shared setting: put it in `Standards` (`standardsOf`, `hasStandards`,
  `applyStandards`) and `io/autosave.ts#readStandards`; sync and adoption follow.

## State & undo conventions

- Every document change goes through `useDocument.commit(recipe, {coalesceKey?})`,
  normally via `store/actions/*`. Never `set()` the document directly.
- Continuous gestures (drag, resize handle, point drag): `beginGesture()` → `preview()`…
  → `endGesture()` = one undo step; Esc calls `cancelGesture()` (gestures check
  `gestureBase` and stop).
- Rapid repeated edits (typing, color picker, arrow nudge, wheel resize) pass a
  `coalesceKey`; same key within 800 ms merges into one undo step.
- Selection lives in `uiStore` and is pruned automatically when ids disappear.

## Rendering

`render/scene.ts#buildScene(project)` returns primitives in feet (circles, arcs, paths,
labels). The canvas draws them in one Konva `Shape` (`drawCanvas.ts`); the SVG exporter
writes the same primitives, so screen and export always match. Sketch mode swaps exact
geometry for seeded hand-drawn ops (`render/sketch.ts`, amounts in paper points); use
`primitives.openStrokePrims` for "exact if clean, sketched otherwise" lines. Per-node
results are cached by a JSON key of everything visual (identity is not enough: blobs
depend on other nodes) — keep anything visual in that key. Labels are drawn counter-scaled.
Bundled fonts (hand-lettered labels, seven text fonts) come from @fontsource; exports
outline them with opentype.js (`fonts.loadOutlineFont` for every font in `fontsIn(project)`
must run before `buildSvg`; ExportDialog does this). Use `fonts.outlineText`, never
opentype's `getPath`/`getAdvanceWidth`/`toPathData`: its text shaping throws on some of
these fonts and its number formatting writes NaN, which silently cuts glyphs out of PDFs
(`tests/fonts.test.ts` guards this). Styles a family lacks are faked (bold = stroke,
italic = slant), as the browser does on screen.

## Interaction summary

- Tools: V select, B bubble (click to place; the toolbar picker or B again switches circle /
  square), C connect (click A then B, or drag A→B;
  Esc exits), S shape (drag freehand or click points; Enter/double-click/first point
  closes; double-click a gap between bubbles to fill the pocket), T text (click to place,
  drag to set the wrapping width, click a block to edit it; back to select afterwards).
- Text blocks: typed in place (`canvas/TextEditor.tsx`, `uiStore.editingText` = `{id}` or a
  new block `{id: null, x, y, widthPt}` that only enters the document when committed with
  text). Enter = new line; Esc, Ctrl/⌘+Enter or click away = finish (keeps the text;
  emptied blocks are deleted). Edit: double-click, Enter on the selected block, or click
  the already-selected block. The selected block's right-edge handle sets `widthPt`
  (double-click it: no wrapping). New blocks take the last used style
  (`uiStore.textStyle`, session only). Ctrl+Shift+V pastes a copied text's style onto
  selected text blocks.
- Selected shape: drag control points (snap to rings; Alt = no snap), double-click a
  point to delete it, the edge to insert one.
- Overlaps: ◇ marker at each overlap of a selected bubble; click it to set its mode.
- Names, areas and costs: click the name (or the area or cost line below it) of the
  already-selected element, or double-click any, to edit it in place
  (`canvas/LabelEditor.tsx`, `uiStore.editingLabel = {id, part: LabelPart}`,
  `query.labelAt`; what each part edits: `actions/labels.ts`). Label lines carry their
  `part` ('name' | 'size' | 'cost'). Names may be empty (the element draws unlabeled);
  a nameless element has nothing to click, so double-clicking anywhere on it opens the
  name editor, placed via `scene.editorLabel` (a stand-in name sizes the box). Enter saves,
  Shift+Enter breaks a name's line, Esc cancels, blur saves. One undo step. The size line
  edits whatever the label shows: area, a circle's radius or a rectangle's `W × H`
  (`actions.setSizeFromText`); circles and rectangles only (a freeform shape's area
  follows its outline). The cost line edits the element's rate (or its total cost, when
  the label shows that); typing the inherited rate clears the override.
- Ctrl+C/X/V use native clipboard events (JSON text, works across tabs); paste goes
  to the cursor. Ctrl+Shift+V pastes the copied element's look onto the selection.
  Pasting tab/comma-separated rows with a header imports bubbles.
- Wheel: zoom at cursor. Wheel over a selected bubble resizes it by the radius snap
  (default 6"; Shift = 1"); Ctrl/⌘+wheel (and trackpad pinch) always zooms.
- Pan: Space+drag or middle mouse. Marquee: drag on empty canvas (Shift adds).
- Resize handle (circle: right edge; rectangle: bottom-right corner, proportional) snaps the
  half-extent to `settings.snap.radiusIncrementFt` (stored name kept for old files; the UI
  calls it "Size snap"); Shift = free. Minimum half-extent: `MIN_SIZE_FT`.
- Costs: firm default per category in Category standards (expand a category); this
  drawing's rates, the breakdown and the total in the Costs panel (nothing selected);
  an element's own rate in its Cost section (dot = own; click to reset).
- Sidebar (sizing actions in `store/actions/size.ts`): Shape (convert, keeps area); a
  circle by radius, diameter or area; a rectangle by width, height (unlocks rectangles)
  or area. Area is exact (unsnapped) and keeps proportions; multi-select applies to each.
- Shortcuts: Del, ⌘/Ctrl+D, ⌘/Ctrl+A, arrows (1', Shift 10'), Enter (edit selected text), ⌘/Ctrl+Z / Shift+Z / Y,
  ⌘/Ctrl+S save (⌘/Ctrl+Shift+S save as), ⌘/Ctrl+O open, F zoom to fit, ⌘/Ctrl+0 100% (true paper size). Keep
  `ui/panels/ShortcutsHelp.tsx` in sync.

## CSV import

Columns (case-insensitive, aliases in `csvImport.ts`): `name`, `radius`, `category`,
optional `area`, `shape` (circle | square; a square's radius = half its side) and `cost`
(aliases incl. `$/sf`, `rate`; any header with `$` is cost, checked before symbols are
stripped; sets the element's own rate). Radius accepts `12.5`, `12'`, `12'-6"`; area accepts `1200`, `1,200 sf`.
Radius wins if both are given; otherwise radius = sqrt(area/π) (squares: side = sqrt(area)). Unknown categories are
created with the next palette color. Imported bubbles go in a loose grid below existing
content (`autoLayout.ts`). Sample: `examples/sample-program.csv`.

## Saving files

- `io/fileSystem.ts` uses the File System Access API (system Save As / Open dialogs;
  Chrome, Edge, Brave, Opera desktop) and falls back to a download / file input
  (Safari, Firefox). The save dialog only opens from a click or key press, so call
  `chooseSaveTarget` BEFORE slow work (PDF build), then `writeTarget`. Cancel → null.
- Exports (PDF/PNG/SVG) ask where every time. Drawings: Save As asks and remembers the
  file per tab (`fileActions.tabFiles`, in memory, lost on reload); Save writes back to
  it (asking permission again if needed), or falls through to Save As. Open remembers
  the picked file. A file name the user typed becomes the drawing's name.
- e2e: `helpers.fakeFileDialogs` stands in for the dialogs (writes land in
  `window.__files`); `noFileDialogs` tests the download fallback.

## Export

- `io/export/svg.ts` builds SVG from the scene in paper points at true scale
  (independent of zoom). PDF = svg2pdf.js onto a jsPDF page (fit-to-drawing or a
  standard sheet, centered, warns if too big). PNG = SVG rasterized at chosen DPI.
- Label wrapping is shared by canvas and export (`canvas/textLayout.ts`).
- jsPDF/svg2pdf are lazy-loaded on first PDF export.

## How to add a feature

Every feature: add/extend a unit test for pure logic, add an e2e test in the matching
`e2e/*.spec.ts` for the interaction, update this file.

- **New style property** (e.g. label italic): add it to `StyleProps` + `DEFAULT_STYLE`
  (migration picks it up automatically via the default keys), a field in
  `ui/panels/StyleFields.tsx`, and use the resolved value in `render/scene.ts` (and
  `canvas/textLayout.ts` for labels). Categories, overrides, reset dots, standards and
  paste-style all work without further changes.
- **New drawing setting**: field in `DrawingSettings` + `DEFAULT_SETTINGS`; check that
  `migrateProject` fills it for old files (nested objects need an explicit merge there);
  an action in `store/actions/settings.ts`; a control in the relevant panel.
- **New shape kind** (hexagon, ellipse, rounded rectangle): extend the `Shape` union (and
  `SizableKind` if the bubble tool should place it); TypeScript then flags every switch
  in `model/geometry.ts` to complete: `nodeOutline` (a polygon; drawing, hit-testing,
  marquee and connections come from it), area/size/handle cases, `labelWidthFt`. Then
  `cleanShape` in `model/migrate.ts`, `dimensionText` in `selectors.ts`, a row in
  `SHAPE_LABELS` in `model/defaults.ts` and `BUBBLE_ICONS` in `ui/Toolbar.tsx` (both
  typed `Record<SizableKind, …>`, so TypeScript asks for them), `newShape` / `convertShape`,
  its fields in `ui/panels/SizeFields.tsx`, and CSV names in `io/csvImport.ts`.
  Sketch mode keeps corners via `primitives.subdivide`; smooth outlines use `resample`.
- **New element kind** (e.g. linework): its type in `types.ts` (+ `Project[kind]`, an
  order array, `factory.createProject`, `migrate.ts` cleaning, like `cleanText`), a row in
  `model/elements.ts` (`ElementOf`, `KINDS`, `noElements`) with bounds/contains/intersects —
  then selection, marquee, move, nudge, delete, export subsets and zoom to fit work.
  TypeScript then asks for it in `model/clip.ts` (payload, `planPaste`, `insertPlan`,
  `planIds`). Add its scene entry + canvas draw + SVG output, an editing action file, a
  tool, a sidebar section in `PropertiesPanel`, and overlay selection drawing.
- **New canvas tool**: implement `Tool` in `canvas/tools/<name>.ts` (return a `Gesture`
  from `down` for drags), register it in `tools/index.ts` and `ToolId` in uiStore, add a
  toolbar button and a shortcut.
- **New per-element number that rolls up** (like cost): follow `model/costs.ts`: resolve
  in one function, total/breakdown there, a `labelX` style property for the label line
  (a `LabelPart` + a row in `actions/labels.ts` to edit it in place), sidebar fields.
- **New document data** (anything saved in files): add to `types.ts`, `factory.ts`,
  `migrate.ts`; if old files can't be read as-is, bump `SCHEMA_VERSION` with an upgrade
  step. Copy/paste/duplicate (`model/clip.ts`) may need to carry it.
- **UI / layout work**:
  - Restyle via `styles/tokens.css`; component rules use tokens, never raw colors or
    sizes (the canvas overlay picks them up through `canvas/theme.ts`).
  - New rules go in the file for their area; keep one definition per selector.
  - Layout regions: `App.tsx` (TabBar, Toolbar, workspace = canvas-wrap + sidebar);
    sizes in tokens (`--sidebar-w`, `--toolbar-h`, `--tabbar-h`).
  - Sidebar: each block is a `Section` component in `ui/panels/`; `PropertiesPanel`
    decides which appear (selection vs. drawing). Moving a block = moving one line there.
  - Inputs come from `ui/controls/Controls.tsx`; a choice list used in two places goes in
    `ui/options.ts`; icons in `ui/icons.tsx`.
  - e2e tests find sidebar inputs by their field label (`helpers.field/select`), so
    renaming a label means updating tests; moving a field does not.
- **Intentional visual change**: `tests/render-regression.test.ts` will fail; check the
  app/export, then replace the expected hash.

## Testing notes

- Unit tests (73): units, geometry, squares/rectangles, history, project file + v1 migration, CSV, styles,
  standards + category matching + firm defaults, costs, clipboard, overlaps, sketch determinism, blobs,
  text (layout, elements registry, clips, files), font outlines (no NaN), render regression.
- e2e (34, one file per area): splash, bubbles (scale, drag/resize/wheel, selection + undo,
  connect, sizing, names (+ nameless), in-place area, squares), styles + category/graphic/overlap standards + reset, clipboard (+ paste adds categories), costs (+ CSV cost column), overlaps, shapes, text (place/edit/move/style/wrap/copy/export), tabs, io (exports + save dialogs + download fallback).
- Canvas hit-testing is geometric (`canvas/query.ts`, `canvas/hitTest.ts`); Konva layers
  are `listening={false}`. Window-level move/up (input/useCanvasInput.ts) so drags
  continue outside the canvas.

## Out of scope for v1 (hooks left in place)

- More shapes (hexagon, ellipse, rounded rectangle): see "New shape kind" above.
- Overlap treatments between rectangles/circles need polygon intersection (not built).
- Metric: `settings.unitSystem`; formatting/parsing is confined to `units.ts`.
- Layers / locking: planned next after linework; add `layerId` to every element kind and
  filter through `model/elements.ts` (hit testing, marquee, drawing, export).
- Text styles shared like categories, rotation, leader lines (wait for linework).

## Style

Neutral grays, white space, system sans-serif UI (all values in `styles/tokens.css`);
labels use Helvetica/Arial (matches PDF built-in font). Firm categories and the palette for new ones are in `model/defaults.ts`.
