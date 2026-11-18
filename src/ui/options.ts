/** Choice lists shared by more than one control (toolbar and sidebar), so either can move freely. */
import { PRESETS } from '../render/sketch';

/** Graphic style presets, plus "Custom" (shown, not choosable) once the sliders are tuned. */
export const PRESET_OPTIONS = [
  ...PRESETS.map((p) => ({ value: p.id, label: p.label })),
  { value: 'custom', label: 'Custom' },
];
