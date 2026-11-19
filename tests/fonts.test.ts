import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'opentype.js';
import { outlineText } from '../src/render/fonts';

const FILES = [
  'eb-garamond/files/eb-garamond-latin-400-normal.woff',
  'jost/files/jost-latin-700-normal.woff',
  'roboto-condensed/files/roboto-condensed-latin-400-italic.woff',
  'oswald/files/oswald-latin-400-normal.woff',
  'comic-neue/files/comic-neue-latin-400-normal.woff',
  'kalam/files/kalam-latin-400-normal.woff',
  'architects-daughter/files/architects-daughter-latin-400-normal.woff',
];

// opentype.js's own text shaping throws on some of these fonts and its path formatting
// writes NaN for tiny fractions; outlineText must avoid both (NaN cuts glyphs short in PDFs)
it('outlines every bundled font without NaN or errors', () => {
  const text = 'The quick brown fox — Kitchen 240 sf, “quoted” & fi/fl';
  for (const file of FILES) {
    const buf = readFileSync(`node_modules/@fontsource/${file}`);
    const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    for (let i = 0; i < 40; i++) {
      const { d, width } = outlineText(font, text, 36 + i * 7.13, 190 + i * 3.71, 14);
      expect(d, file).not.toContain('NaN');
      expect(Number.isFinite(width), file).toBe(true);
      expect(width).toBeGreaterThan(100);
    }
  }
});
