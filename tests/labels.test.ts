import { describe, expect, it } from 'vitest';
import { createNode, createProject, createText } from '../src/model/factory';
import { setTextMeasurer } from '../src/model/text';
import { migrateProject } from '../src/model/migrate';
import { buildScene } from '../src/render/scene';

setTextMeasurer((text) => text.length * 0.5);

function drawing() {
  const p = createProject();
  const n = createNode({ name: 'Lobby', x: 0, y: 0 });
  p.nodes[n.id] = n;
  p.nodeOrder.push(n.id);
  const t = createText({ x: 20, y: 0, text: 'Site notes' });
  p.texts[t.id] = t;
  p.textOrder.push(t.id);
  return p;
}

describe('bubble labels on/off', () => {
  it('hides every bubble annotation but keeps text blocks', () => {
    const p = drawing();
    expect(buildScene(p).nodes[0].label).not.toBeNull();
    p.settings.showLabels = false;
    const s = buildScene(p);
    expect(s.nodes[0].label).toBeNull();
    expect(s.texts).toHaveLength(1);
  });
  it('is saved with the drawing; older files show labels', () => {
    const p = drawing();
    p.settings.showLabels = false;
    expect(migrateProject(JSON.parse(JSON.stringify(p))).settings.showLabels).toBe(false);
    const old = JSON.parse(JSON.stringify(drawing()));
    delete old.settings.showLabels;
    expect(migrateProject(old).settings.showLabels).toBe(true);
  });
});
