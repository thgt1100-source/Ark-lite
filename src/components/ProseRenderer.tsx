import React, { memo, useMemo } from 'react';
import {
  extractSpeakerPrefixFromLine,
  normalizeCharacterKey,
} from '../utils/characterUtils';
import { findMatchRanges } from '../utils/search';
import { CharacterNameBadge } from './CharacterNameBadge';

interface ProseRendererProps {
  text: string;
  highlightQuery?: string;
  isStreaming?: boolean;
  emptyPlaceholder?: string;
  knownCharacterKeys?: Set<string>;
  mcNameKey?: string;
  onCharacterClick?: (characterName: string) => void;
}

const RAW_META_OPEN_TAG_RE =
  /<(?:thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|meta|system)\b[^>]*>/gi;
const RAW_META_CLOSE_TAG_RE =
  /<\/(?:thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|meta|system)\s*>/gi;

function updateMetaBlockDepth(line: string, currentDepth: number): {
  insideMeta: boolean;
  nextDepth: number;
} {
  if (!line.includes('<')) {
    return { insideMeta: currentDepth > 0, nextDepth: currentDepth };
  }
  const opens = (line.match(RAW_META_OPEN_TAG_RE) || []).length;
  const closes = (line.match(RAW_META_CLOSE_TAG_RE) || []).length;
  const insideMeta = currentDepth > 0 || opens > 0;
  const nextDepth = Math.max(0, currentDepth + opens - closes);
  return { insideMeta, nextDepth };
}

function renderWithHighlights(
  text: string,
  query: string | undefined,
  baseClass: string,
  keyPrefix: string,
): React.ReactNode {
  if (!query || !query.trim()) {
    return <span className={baseClass}>{text}</span>;
  }
  const ranges = findMatchRanges(text, query);
  if (!ranges.length) {
    return <span className={baseClass}>{text}</span>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) {
      parts.push(
        <span key={`${keyPrefix}-t-${i}`} className={baseClass}>
          {text.slice(cursor, start)}
        </span>,
      );
    }
    parts.push(
      <mark
        key={`${keyPrefix}-m-${i}`}
        className="rounded bg-amber-400/25 px-0.5 text-amber-100"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    parts.push(
      <span key={`${keyPrefix}-e`} className={baseClass}>
        {text.slice(cursor)}
      </span>,
    );
  }
  return parts;
}

function renderStyledRuns(
  segment: string,
  highlightQuery?: string,
  softenTrailing = false,
): React.ReactNode[] {
  const tokenRe = /("[^"\n]+"|“[^”\n]+”|‘[^’\n]+’)/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRe.exec(segment)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(
        <React.Fragment key={`a-${keyIdx}`}>
          {renderWithHighlights(
            segment.slice(lastIdx, match.index),
            highlightQuery,
            'text-[#e8eff8]',
            `a-${keyIdx}`,
          )}
        </React.Fragment>,
      );
      keyIdx++;
    }
    nodes.push(
      <React.Fragment key={`d-${keyIdx}`}>
        {renderWithHighlights(
          match[0],
          highlightQuery,
          'font-medium text-emerald-300',
          `d-${keyIdx}`,
        )}
      </React.Fragment>,
    );
    keyIdx++;
    lastIdx = tokenRe.lastIndex;
  }

  if (lastIdx < segment.length) {
    const rest = segment.slice(lastIdx);
    if (softenTrailing && !highlightQuery && rest.length > 4) {
      const tipLen = Math.min(6, rest.length);
      const midLen = Math.min(8, Math.max(0, rest.length - tipLen));
      const softLen = Math.min(14, Math.max(0, rest.length - tipLen - midLen));
      const headEnd = rest.length - tipLen - midLen - softLen;
      const softEnd = headEnd + softLen;
      const midEnd = softEnd + midLen;

      if (headEnd > 0) {
        nodes.push(
          <span
            key={`r-${keyIdx}-head`}
            className="text-[#e8eff8] transition-colors duration-500 ease-out"
          >
            {rest.slice(0, headEnd)}
          </span>,
        );
      }
      if (softLen > 0) {
        nodes.push(
          <span
            key={`r-${keyIdx}-soft`}
            className="text-[#e8eff8]/80 transition-colors duration-500 ease-out"
          >
            {rest.slice(headEnd, softEnd)}
          </span>,
        );
      }
      if (midLen > 0) {
        nodes.push(
          <span
            key={`r-${keyIdx}-mid`}
            className="text-[#e8eff8]/65 transition-colors duration-500 ease-out"
          >
            {rest.slice(softEnd, midEnd)}
          </span>,
        );
      }
      nodes.push(
        <span
          key={`r-${keyIdx}-tip`}
          className="text-[#e8eff8]/45 transition-colors duration-500 ease-out"
        >
          {rest.slice(midEnd)}
        </span>,
      );
    } else {
      nodes.push(
        <React.Fragment key={`r-${keyIdx}`}>
          {renderWithHighlights(
            rest,
            highlightQuery,
            'text-[#e8eff8] transition-colors duration-500 ease-out',
            `r-${keyIdx}`,
          )}
        </React.Fragment>,
      );
    }
  }

  return nodes;
}

interface ParagraphBlock {
  text: string;
  initialMetaDepth: number;
}

interface MemoParagraphProps {
  part: string;
  initialMetaDepth: number;
  idx: number;
  highlightQuery?: string;
  isActiveStreaming?: boolean;
  knownCharacterKeys?: Set<string>;
  mcNameKey?: string;
  onCharacterClick?: (characterName: string) => void;
}

const MemoParagraph = memo(function MemoParagraph({
  part,
  initialMetaDepth,
  idx,
  highlightQuery,
  isActiveStreaming = false,
  knownCharacterKeys,
  mcNameKey,
  onCharacterClick,
}: MemoParagraphProps) {
  const isThought =
    /^(\[\s*(suy nghĩ|nghĩ thầm|nội tâm)[^\]]*\]|\(\s*(suy nghĩ|nghĩ thầm|nội tâm)[^)]*\))/i.test(
      part,
    );

  const lines = useMemo(() => part.split(/\r?\n/), [part]);

  const renderedContent = useMemo(() => {
    if (isThought) {
      return renderWithHighlights(
        part,
        highlightQuery,
        'italic text-sky-300',
        `th-${idx}`,
      );
    }

    let depth = initialMetaDepth;
    return lines.map((line, lineIdx) => {
      const isLastLine = lineIdx === lines.length - 1;
      const { insideMeta, nextDepth } = updateMetaBlockDepth(line, depth);
      depth = nextDepth;
      const soften = isActiveStreaming && isLastLine && !insideMeta;

      const speakerMatch = !insideMeta
        ? extractSpeakerPrefixFromLine(line, knownCharacterKeys)
        : null;

      return (
        <React.Fragment key={`ln-${idx}-${lineIdx}`}>
          {lineIdx > 0 && '\n'}
          {speakerMatch ? (
            <>
              {speakerMatch.leadingPrefix && (
                <span className="text-slate-400">
                  {speakerMatch.leadingPrefix}
                </span>
              )}
              <CharacterNameBadge
                name={speakerMatch.displayName}
                variant="prose"
                isMc={
                  Boolean(mcNameKey) &&
                  normalizeCharacterKey(speakerMatch.displayName) === mcNameKey
                }
                highlightQuery={highlightQuery}
                onClick={
                  onCharacterClick
                    ? () => onCharacterClick(speakerMatch.displayName)
                    : undefined
                }
                className="mr-1"
              />
              {speakerMatch.stageNote && (
                <span className="italic text-slate-400">
                  {speakerMatch.stageNote}
                </span>
              )}
              {speakerMatch.hasColon && (
                <span className="mr-1 text-slate-400">:</span>
              )}
              {speakerMatch.remainder &&
                renderStyledRuns(
                  speakerMatch.remainder,
                  highlightQuery,
                  soften,
                )}
            </>
          ) : (
            renderStyledRuns(line, highlightQuery, soften)
          )}
        </React.Fragment>
      );
    });
  }, [
    highlightQuery,
    idx,
    initialMetaDepth,
    isActiveStreaming,
    isThought,
    knownCharacterKeys,
    lines,
    mcNameKey,
    onCharacterClick,
    part,
  ]);

  return (
    <p
      className={`whitespace-pre-wrap break-words transition-opacity duration-700 ease-out ${
        isActiveStreaming ? 'stream-text-breathing' : 'opacity-100'
      }`}
    >
      {renderedContent}
      {isActiveStreaming && (
        <span
          aria-hidden="true"
          className="stream-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
        />
      )}
    </p>
  );
});

export const ProseRenderer = memo(function ProseRenderer({
  text,
  highlightQuery,
  isStreaming = false,
  emptyPlaceholder = '(Chưa có nội dung)',
  knownCharacterKeys,
  mcNameKey,
  onCharacterClick,
}: ProseRendererProps) {
  const blocks = useMemo<ParagraphBlock[]>(() => {
    const rawParts = String(text || '')
      .split(/\n{2,}|\r\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    let depth = 0;
    return rawParts.map((part) => {
      const initialMetaDepth = depth;
      const lines = part.split(/\r?\n/);
      for (const ln of lines) {
        depth = updateMetaBlockDepth(ln, depth).nextDepth;
      }
      return { text: part, initialMetaDepth };
    });
  }, [text]);

  if (!blocks.length) {
    return (
      <p
        className={`text-sm text-slate-400 transition-opacity duration-700 ease-out ${
          isStreaming ? 'stream-text-breathing' : 'opacity-100'
        }`}
      >
        {emptyPlaceholder}
        {isStreaming && (
          <span
            aria-hidden="true"
            className="stream-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
          />
        )}
      </p>
    );
  }

  return (
    <div
      className={`space-y-3.5 text-[15.5px] leading-[1.8] tracking-[0.006em] transition-opacity duration-700 ease-out ${
        isStreaming ? 'opacity-[0.88]' : 'opacity-100'
      }`}
    >
      {blocks.map((block, idx) => (
        <MemoParagraph
          key={idx}
          part={block.text}
          initialMetaDepth={block.initialMetaDepth}
          idx={idx}
          highlightQuery={highlightQuery}
          isActiveStreaming={isStreaming && idx === blocks.length - 1}
          knownCharacterKeys={knownCharacterKeys}
          mcNameKey={mcNameKey}
          onCharacterClick={onCharacterClick}
        />
      ))}
    </div>
  );
});
