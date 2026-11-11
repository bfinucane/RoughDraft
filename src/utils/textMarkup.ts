/**
 * textMarkup.ts
 * Formatting markup parser and utilities for RoughDraft wireframe objects.
 * Supports Balsamiq/Markdown style syntax:
 *   - *bold* or **bold**
 *   - _italic_ or //italic//
 *   - +underline+
 *   - ~strikethrough~
 *   - `code/monospace`
 *   - [link text] or [link text|url]
 *   - {color:red}colored text{color} or {red}colored text{/red}
 *   - Table cell directives: {r}, {c}, {l}, {bg:color}, [x], [ ], (o), ( )
 */

export interface TextStyleState {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  link?: boolean;
  color?: string;
}

export interface FormattedSpan extends TextStyleState {
  text: string;
}

export interface FormattedLine {
  spans: FormattedSpan[];
  bullet?: 'bullet' | 'number';
  bulletLabel?: string;
  plainText: string;
}

export interface ParsedTableCell {
  raw: string;
  align: 'left' | 'center' | 'right';
  bg?: string;
  checkbox?: 'checked' | 'unchecked' | 'radio-checked' | 'radio-unchecked';
  spans: FormattedSpan[];
  plainText: string;
}

export const COLOR_MAP: Record<string, string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
  amber: '#d97706',
  orange: '#ea580c',
  yellow: '#ca8a04',
  purple: '#9333ea',
  violet: '#7c3aed',
  gray: '#64748b',
  grey: '#64748b',
  muted: '#64748b',
  dark: '#0f172a',
  ink: '#0f172a',
  black: '#000000',
  white: '#ffffff',
};

export const BG_COLOR_MAP: Record<string, string> = {
  yellow: '#fef08a',
  green: '#dcfce7',
  blue: '#dbeafe',
  red: '#fee2e2',
  rose: '#ffe4e6',
  purple: '#f3e8ff',
  amber: '#fef3c7',
  orange: '#ffedd5',
  gray: '#f1f5f9',
  grey: '#f1f5f9',
  muted: '#f1f5f9',
};

export function resolveColor(val: string): string {
  const clean = val.trim().toLowerCase();
  if (COLOR_MAP[clean]) return COLOR_MAP[clean];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val.trim())) return val.trim();
  return '#1e293b';
}

export function resolveBgColor(val: string): string {
  const clean = val.trim().toLowerCase();
  if (BG_COLOR_MAP[clean]) return BG_COLOR_MAP[clean];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val.trim())) return val.trim();
  return '#f1f5f9';
}

interface MatchRule {
  type: keyof TextStyleState | 'colorTag' | 'namedColorTag';
  regex: RegExp;
  apply: (match: RegExpExecArray, currentStyle: TextStyleState) => {
    inner: string;
    style: TextStyleState;
  };
}

const TAG_RULES: MatchRule[] = [
  // {color:red}text{color} or {color:#hex}text{/color}
  {
    type: 'colorTag',
    regex: /\{color:([#a-zA-Z0-9]+)\}([\s\S]*?)\{(?:\/color|color)\}/,
    apply: (m, cur) => ({
      inner: m[2],
      style: { ...cur, color: resolveColor(m[1]) },
    }),
  },
  // {red}text{/red} shorthand
  {
    type: 'namedColorTag',
    regex: /\{(red|green|blue|amber|orange|purple|gray|muted)\}([\s\S]*?)\{\/\1\}/,
    apply: (m, cur) => ({
      inner: m[2],
      style: { ...cur, color: resolveColor(m[1]) },
    }),
  },
  // **bold**
  {
    type: 'bold',
    regex: /\*\*([^\s*](?:[\s\S]*?[^\s*])?)\*\*/,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, bold: true } }),
  },
  // *bold*
  {
    type: 'bold',
    regex: /\*([^\s*](?:[\s\S]*?[^\s*])?)\*/,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, bold: true } }),
  },
  // //italic//
  {
    type: 'italic',
    regex: /\/\/([^\s/](?:[\s\S]*?[^\s/])?)\/\//,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, italic: true } }),
  },
  // _italic_
  {
    type: 'italic',
    regex: /_([^\s_](?:[\s\S]*?[^\s_])?)_/,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, italic: true } }),
  },
  // +underline+
  {
    type: 'underline',
    regex: /\+([^\s+](?:[\s\S]*?[^\s+])?)\+/,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, underline: true } }),
  },
  // ~strikethrough~
  {
    type: 'strikethrough',
    regex: /~([^\s~](?:[\s\S]*?[^\s~])?)~/,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, strikethrough: true } }),
  },
  // `code`
  {
    type: 'code',
    regex: /`([^`]+)`/,
    apply: (m, cur) => ({ inner: m[1], style: { ...cur, code: true } }),
  },
  // [link text] or [link text|https://...]
  {
    type: 'link',
    regex: /\[([^\]\n]+)\]/,
    apply: (m, cur) => {
      const rawContent = m[1];
      const pipeIdx = rawContent.indexOf('|');
      const displayText = pipeIdx >= 0 ? rawContent.slice(0, pipeIdx) : rawContent;
      return { inner: displayText, style: { ...cur, link: true, underline: true } };
    },
  },
];

/**
 * Parses raw text containing markup syntax into a list of styled spans.
 */
export function parseFormattedText(
  input: string,
  baseStyle: TextStyleState = {}
): FormattedSpan[] {
  if (!input) return [];

  // Find the earliest matching tag in the input
  let earliestMatch: {
    index: number;
    match: RegExpExecArray;
    rule: MatchRule;
  } | null = null;

  for (const rule of TAG_RULES) {
    const m = rule.regex.exec(input);
    if (m && m.index !== undefined) {
      if (!earliestMatch || m.index < earliestMatch.index) {
        earliestMatch = { index: m.index, match: m, rule };
      }
    }
  }

  if (!earliestMatch) {
    return [{ text: input, ...baseStyle }];
  }

  const { index, match, rule } = earliestMatch;
  const matchLen = match[0].length;
  const before = input.slice(0, index);
  const after = input.slice(index + matchLen);

  const { inner, style: nextStyle } = rule.apply(match, baseStyle);

  const result: FormattedSpan[] = [];

  if (before) {
    result.push(...parseFormattedText(before, baseStyle));
  }

  // Parse inner text with updated styles recursively
  result.push(...parseFormattedText(inner, nextStyle));

  if (after) {
    result.push(...parseFormattedText(after, baseStyle));
  }

  return mergeSpans(result);
}

function mergeSpans(spans: FormattedSpan[]): FormattedSpan[] {
  const merged: FormattedSpan[] = [];
  for (const s of spans) {
    if (!s.text) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      Boolean(last.bold) === Boolean(s.bold) &&
      Boolean(last.italic) === Boolean(s.italic) &&
      Boolean(last.underline) === Boolean(s.underline) &&
      Boolean(last.strikethrough) === Boolean(s.strikethrough) &&
      Boolean(last.code) === Boolean(s.code) &&
      Boolean(last.link) === Boolean(s.link) &&
      last.color === s.color
    ) {
      last.text += s.text;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/**
 * Strips all formatting markup to return plain text.
 */
export function stripMarkup(raw: string): string {
  if (!raw) return '';
  const spans = parseFormattedText(raw);
  return spans.map((s) => s.text).join('');
}

interface WordAtom {
  text: string;
  isSpace: boolean;
  style: TextStyleState;
}

function spansToWordAtoms(spans: FormattedSpan[]): WordAtom[] {
  const atoms: WordAtom[] = [];
  for (const span of spans) {
    const { text, ...style } = span;
    // Split into tokens preserving whitespace boundaries
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      atoms.push({
        text: part,
        isSpace: /^\s+$/.test(part),
        style,
      });
    }
  }
  return atoms;
}

/**
 * Word-wraps a formatted paragraph while preserving markup styles across wrapped lines.
 * Supports bullet lines (* / - / •) and numbered lists (1. / 2. / etc.).
 */
export function wrapFormattedParagraph(
  rawText: string,
  maxCharsPerLine: number,
  maxLines: number
): FormattedLine[] {
  if (!rawText) return [];

  const rawParagraphs = rawText.split('\n');
  const lines: FormattedLine[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push({ spans: [], plainText: '' });
      continue;
    }

    let bullet: 'bullet' | 'number' | undefined;
    let bulletLabel: string | undefined;
    let contentToParse = para;

    const bulletMatch = /^\s*([*\-•])\s+(.*)$/.exec(para);
    const numberMatch = /^\s*(\d+[.)])\s+(.*)$/.exec(para);

    if (bulletMatch) {
      bullet = 'bullet';
      bulletLabel = '•';
      contentToParse = bulletMatch[2];
    } else if (numberMatch) {
      bullet = 'number';
      bulletLabel = numberMatch[1];
      contentToParse = numberMatch[2];
    }

    const spans = parseFormattedText(contentToParse);
    const atoms = spansToWordAtoms(spans);

    let currentLineAtoms: WordAtom[] = [];
    let currentLineLen = 0;
    const effectiveMaxChars = bullet
      ? Math.max(10, maxCharsPerLine - (bulletLabel?.length || 2) - 2)
      : maxCharsPerLine;

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];

      // Ignore leading spaces on a new line
      if (currentLineAtoms.length === 0 && atom.isSpace) {
        continue;
      }

      if (currentLineLen + atom.text.length <= effectiveMaxChars) {
        currentLineAtoms.push(atom);
        currentLineLen += atom.text.length;
      } else {
        // Line break
        if (currentLineAtoms.length > 0) {
          const lineSpans = atomsToSpans(currentLineAtoms);
          lines.push({
            spans: lineSpans,
            bullet: lines.length === 0 || !lines[lines.length - 1].bullet ? bullet : undefined,
            bulletLabel: lines.length === 0 || !lines[lines.length - 1].bullet ? bulletLabel : undefined,
            plainText: lineSpans.map((s) => s.text).join(''),
          });
          // Reset bullet for subsequent wrapped lines of the same paragraph
          bullet = undefined;
          bulletLabel = undefined;
        }

        if (!atom.isSpace) {
          currentLineAtoms = [atom];
          currentLineLen = atom.text.length;
        } else {
          currentLineAtoms = [];
          currentLineLen = 0;
        }
      }
    }

    if (currentLineAtoms.length > 0) {
      const lineSpans = atomsToSpans(currentLineAtoms);
      lines.push({
        spans: lineSpans,
        bullet,
        bulletLabel,
        plainText: lineSpans.map((s) => s.text).join(''),
      });
    }
  }

  if (lines.length > maxLines) {
    const sliced = lines.slice(0, maxLines);
    const lastLine = sliced[maxLines - 1];
    if (lastLine.spans.length > 0) {
      const lastSpan = lastLine.spans[lastLine.spans.length - 1];
      lastSpan.text = lastSpan.text.replace(/\.*$/, '') + '…';
      lastLine.plainText = lastLine.spans.map((s) => s.text).join('');
    }
    return sliced;
  }

  return lines;
}

function atomsToSpans(atoms: WordAtom[]): FormattedSpan[] {
  const spans: FormattedSpan[] = atoms.map((a) => ({
    text: a.text,
    ...a.style,
  }));
  return mergeSpans(spans);
}

/**
 * Parses a single data table cell.
 * Extracts alignment directives ({r}, {c}, {l}), background colors ({bg:green}),
 * checkboxes ([x], [ ]), and inline text markup.
 */
export function parseTableCell(rawCell: string, isHeader = false): ParsedTableCell {
  let text = rawCell.trim();
  let align: 'left' | 'center' | 'right' = 'left';
  let bg: string | undefined;
  let checkbox: 'checked' | 'unchecked' | 'radio-checked' | 'radio-unchecked' | undefined;

  // 1. Cell Alignment directives: {r}, {right}, {c}, {center}, {l}, {left}
  const alignMatch = /\{(r(?:ight)?|c(?:enter)?|l(?:eft)?)\}/i.exec(text);
  if (alignMatch) {
    const key = alignMatch[1].toLowerCase();
    if (key.startsWith('r')) align = 'right';
    else if (key.startsWith('c')) align = 'center';
    else if (key.startsWith('l')) align = 'left';
    text = text.replace(alignMatch[0], '').trim();
  }

  // 2. Cell Background fill: {bg:yellow}, {bg:green}, {bg:#hex}
  const bgMatch = /\{bg:([#a-zA-Z0-9]+)\}/i.exec(text);
  if (bgMatch) {
    bg = resolveBgColor(bgMatch[1]);
    text = text.replace(bgMatch[0], '').trim();
  }

  // 3. Leading Checkbox / Radio
  const chkChecked = /^\[([xX*])\]\s*/.exec(text);
  const chkUnchecked = /^\[\s*\]\s*/.exec(text);
  const radChecked = /^\(([xX*oO])\)\s*/.exec(text);
  const radUnchecked = /^\(\s*\)\s*/.exec(text);

  if (chkChecked) {
    checkbox = 'checked';
    text = text.slice(chkChecked[0].length);
  } else if (chkUnchecked) {
    checkbox = 'unchecked';
    text = text.slice(chkUnchecked[0].length);
  } else if (radChecked) {
    checkbox = 'radio-checked';
    text = text.slice(radChecked[0].length);
  } else if (radUnchecked) {
    checkbox = 'radio-unchecked';
    text = text.slice(radUnchecked[0].length);
  }

  const spans = parseFormattedText(text, isHeader ? { bold: true } : {});
  const plainText = spans.map((s) => s.text).join('');

  return {
    raw: rawCell,
    align,
    bg,
    checkbox,
    spans,
    plainText,
  };
}

/**
 * Truncates styled spans so the total visible plain text does not exceed maxChars.
 */
export function truncateSpans(spans: FormattedSpan[], maxChars: number): FormattedSpan[] {
  if (maxChars <= 0) return [];
  const result: FormattedSpan[] = [];
  let curLen = 0;

  for (const span of spans) {
    if (curLen >= maxChars) break;
    const remaining = maxChars - curLen;
    if (span.text.length <= remaining) {
      result.push({ ...span });
      curLen += span.text.length;
    } else {
      result.push({
        ...span,
        text: span.text.slice(0, remaining) + '…',
      });
      curLen = maxChars;
      break;
    }
  }

  return result;
}

/**
 * Applies or toggles a formatting wrapper to a textarea/input element selection.
 */
export function applyFormatToInput(
  inputEl: HTMLTextAreaElement | HTMLInputElement | null,
  currentValue: string,
  prefix: string,
  suffix: string,
  placeholder: string,
  onChange: (nextValue: string) => void
): void {
  if (!inputEl) {
    onChange(currentValue ? `${currentValue} ${prefix}${placeholder}${suffix}` : `${prefix}${placeholder}${suffix}`);
    return;
  }

  const start = inputEl.selectionStart ?? currentValue.length;
  const end = inputEl.selectionEnd ?? currentValue.length;
  const before = currentValue.slice(0, start);
  const selected = currentValue.slice(start, end);
  const after = currentValue.slice(end);

  const textToWrap = selected || placeholder;
  const nextVal = `${before}${prefix}${textToWrap}${suffix}${after}`;
  onChange(nextVal);

  requestAnimationFrame(() => {
    inputEl.focus();
    const newStart = start + prefix.length;
    const newEnd = newStart + textToWrap.length;
    inputEl.setSelectionRange(newStart, newEnd);
  });
}
