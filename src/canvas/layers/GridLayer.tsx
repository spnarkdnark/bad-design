import { Layer, Shape } from 'react-konva';
import { canvasTheme } from '../theme';
import { GRID_MAJOR_EVERY, gridStepFt } from './grid';

interface Props {
  spacingFt: number;
  k: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
}

/** Draws only the visible portion of the grid. Lines thinner than ~6px apart are skipped. */
export function GridLayer({ spacingFt, k, panX, panY, width, height }: Props) {
  const step = gridStepFt(spacingFt, k);
  const majorEvery = GRID_MAJOR_EVERY;
  const theme = canvasTheme();
  const x0 = -panX / k;
  const y0 = -panY / k;
  const x1 = (width - panX) / k;
  const y1 = (height - panY) / k;

  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(ctx) => {
          const c = ctx._context;
          const startX = Math.floor(x0 / step);
          const startY = Math.floor(y0 / step);
          const endX = Math.ceil(x1 / step);
          const endY = Math.ceil(y1 / step);
          for (const major of [false, true]) {
            c.beginPath();
            for (let i = startX; i <= endX; i++) {
              if ((i % majorEvery === 0) !== major) continue;
              c.moveTo(i * step, y0);
              c.lineTo(i * step, y1);
            }
            for (let j = startY; j <= endY; j++) {
              if ((j % majorEvery === 0) !== major) continue;
              c.moveTo(x0, j * step);
              c.lineTo(x1, j * step);
            }
            c.strokeStyle = major ? theme.gridMajor : theme.gridMinor;
            c.lineWidth = 1 / k;
            c.stroke();
          }
        }}
      />
    </Layer>
  );
}
