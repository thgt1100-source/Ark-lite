import React from 'react';
import { findMatchRanges } from '../utils/search';

export interface CharacterNameBadgeProps {
  name: string;
  variant?: 'prose' | 'list';
  isMc?: boolean;
  highlightQuery?: string;
  onClick?: () => void;
  title?: string;
  className?: string;
}

function renderHighlightedName(
  text: string,
  query?: string,
): React.ReactNode {
  if (!query || !query.trim()) return text;
  const ranges = findMatchRanges(text, query);
  if (!ranges.length) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) {
      nodes.push(
        <React.Fragment key={`n-${i}`}>
          {text.slice(cursor, start)}
        </React.Fragment>,
      );
    }
    nodes.push(
      <mark
        key={`m-${i}`}
        className="rounded bg-amber-300/35 px-0.5 text-amber-50"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    nodes.push(
      <React.Fragment key="e">{text.slice(cursor)}</React.Fragment>,
    );
  }
  return nodes;
}

export function CharacterNameBadge({
  name,
  variant = 'prose',
  isMc = false,
  highlightQuery,
  onClick,
  title,
  className = '',
}: CharacterNameBadgeProps) {
  const baseTone = isMc
    ? 'border-blue-300/70 bg-blue-500/26 text-blue-50 shadow-[0_1px_2px_rgba(15,23,42,0.28)]'
    : 'border-blue-400/55 bg-blue-500/20 text-blue-100 shadow-[0_1px_2px_rgba(15,23,42,0.22)]';

  const sizeClass =
    variant === 'prose'
      ? 'inline-flex items-center rounded-full border px-2 py-[0.5px] text-[0.85em] font-semibold leading-[1.35] tracking-[0.01em] align-baseline'
      : 'inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-snug tracking-[0.01em]';

  const interactiveClass = onClick
    ? 'cursor-pointer transition-all hover:border-blue-300/85 hover:bg-blue-500/34 hover:text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70'
    : '';

  const content = (
    <span className={variant === 'list' ? 'truncate' : undefined}>
      {renderHighlightedName(name, highlightQuery)}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || `Xem nhanh hồ sơ & ảnh của ${name}`}
        className={`${sizeClass} ${baseTone} ${interactiveClass} ${className}`.trim()}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={title}
      className={`${sizeClass} ${baseTone} ${className}`.trim()}
    >
      {content}
    </span>
  );
}
