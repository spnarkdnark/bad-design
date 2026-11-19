/** Grid spacing rules shared by the canvas grid and the splash screen's copy of it. */

/** Every Nth line is a major line. */
export const GRID_MAJOR_EVERY = 5;

/** The grid step actually drawn: doubled until lines are at least ~6 px apart. */
export function gridStepFt(spacingFt: number, k: number): number {
  let step = spacingFt;
  while (step * k < 6) step *= 2;
  return step;
}

/**
 * Line positions along one axis, in screen px.
 * @param originPx screen position of world 0 on this axis
 * @param lengthPx how far the screen extends
 */
export function gridLinesPx(stepFt: number, k: number, originPx: number, lengthPx: number) {
  const stepPx = stepFt * k;
  const out: { px: number; major: boolean }[] = [];
  for (let i = Math.floor(-originPx / stepPx); i <= Math.ceil((lengthPx - originPx) / stepPx); i++)
    out.push({ px: originPx + i * stepPx, major: i % GRID_MAJOR_EVERY === 0 });
  return out;
}
