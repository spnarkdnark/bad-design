import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextBlock } from '../model/types';
import { layoutText, textFont, TEXT_LINE_HEIGHT } from '../model/text';

interface Props {
  /** the block being typed (for a new one: not yet in the document) */
  block: TextBlock;
  /** px per ft */
  k: number;
  panX: number;
  panY: number;
  ftPerPt: number;
  onCommit: (text: string) => void;
}

/**
 * Text box typed straight onto the canvas, exactly where the block draws. Enter adds a
 * line; Esc, Ctrl/⌘+Enter or clicking away finishes (and keeps the text: undo removes it).
 */
export function TextEditor({ block, k, panX, panY, ftPerPt, onCommit }: Props) {
  const [text, setText] = useState(block.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const pxPerPt = ftPerPt * k;
  const { style } = block;
  const fontPx = style.sizePt * pxPerPt;
  // as wide as the text (plus room for the caret) unless the block wraps at a set width
  const width = block.widthPt
    ? block.widthPt * pxPerPt
    : layoutText({ ...block, text }).widthPt * pxPerPt + Math.max(8, fontPx * 0.6);

  useEffect(() => {
    const el = ref.current!;
    el.focus();
    el.select();
  }, []);

  // grow with content
  useLayoutEffect(() => {
    const el = ref.current!;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, fontPx, width]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onCommit(text);
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={text}
      rows={1}
      spellCheck
      aria-label="Text"
      wrap={block.widthPt ? 'soft' : 'off'}
      style={{
        left: block.x * k + panX,
        top: block.y * k + panY,
        width,
        font: textFont(style, fontPx),
        lineHeight: TEXT_LINE_HEIGHT,
        color: style.color,
        textAlign: style.align,
        textTransform: style.caps ? 'uppercase' : 'none',
        whiteSpace: block.widthPt ? 'pre-wrap' : 'pre',
      }}
      onChange={(e) => setText(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          finish();
        }
      }}
      onBlur={finish}
    />
  );
}
