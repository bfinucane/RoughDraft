import React from 'react';
import { FillTone, SketchStyle, WireframeWidget } from '../types/wireframe';
import {
  sketchEllipsePath,
  sketchHatchPath,
  sketchLinePath,
  sketchRectPaths,
  sketchScribbleLinesPath,
} from '../utils/sketchPath';

interface SketchWidgetSvgProps {
  widget: WireframeWidget;
  sketchStyle: SketchStyle;
  isPresentMode?: boolean;
  showHotspotHint?: boolean;
}

const INK = '#1e293b';
const INK_MUTED = '#64748b';
const INK_LIGHT = '#94a3b8';

function resolveFillColor(fill: FillTone): string {
  switch (fill) {
    case 'white':
      return '#ffffff';
    case 'muted':
      return '#f1f5f9';
    case 'hatch':
      return '#f8fafc';
    case 'dark':
      return '#1e293b';
    case 'note':
      return '#fef08a';
    case 'transparent':
    default:
      return 'none';
  }
}

function wrapTextLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  if (!text) return [];
  const rawParagraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of rawParagraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((current + ' ' + words[i]).length <= maxCharsPerLine) {
        current += ' ' + words[i];
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const sliced = lines.slice(0, maxLines);
    sliced[maxLines - 1] = sliced[maxLines - 1].replace(/\.*$/, '') + '…';
    return sliced;
  }
  return lines;
}

export const SketchWidgetSvg: React.FC<SketchWidgetSvgProps> = ({
  widget,
  sketchStyle,
  isPresentMode = false,
  showHotspotHint = false,
}) => {
  const { id, type, x, y, w, h, text, subtext, fill, disabled } = widget;
  const fontFamily =
    sketchStyle === 'hand'
      ? "'Architects Daughter', cursive, sans-serif"
      : "'Plus Jakarta Sans', sans-serif";

  const strokeColor = disabled ? INK_LIGHT : INK;
  const fillBg = resolveFillColor(fill);
  const textOnFill = fill === 'dark' ? '#ffffff' : disabled ? INK_LIGHT : INK;

  const renderRectBase = (
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    seedSuffix: string,
    customFill?: FillTone,
    bordered = true,
    strokeWidth = 2,
    dropOffset = false
  ) => {
    const effectiveFill = customFill ?? fill;
    const bg = resolveFillColor(effectiveFill);
    const { fillPath, strokePath } = sketchRectPaths(
      rx,
      ry,
      rw,
      rh,
      `${id}-${seedSuffix}`,
      sketchStyle
    );

    return (
      <>
        {dropOffset && !disabled && (
          <path
            d={
              sketchRectPaths(
                rx + 3,
                ry + 3,
                rw,
                rh,
                `${id}-${seedSuffix}-sh`,
                sketchStyle
              ).fillPath
            }
            fill={effectiveFill === 'dark' ? '#94a3b8' : '#cbd5e1'}
            stroke="none"
          />
        )}
        {bg !== 'none' && <path d={fillPath} fill={bg} stroke="none" />}
        {effectiveFill === 'hatch' && (
          <path
            d={sketchHatchPath(rx + 2, ry + 2, rw - 4, rh - 4, `${id}-hatch`, 11)}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1.2}
          />
        )}
        {bordered && (
          <path
            d={strokePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </>
    );
  };

  const renderWidgetBody = () => {
    switch (type) {
      case 'browser': {
        const headerH = Math.min(44, Math.max(34, h * 0.12));
        const addrX = x + 76;
        const addrW = Math.max(60, w - 92);
        const addrY = y + 8;
        const addrH = headerH - 16;
        return (
          <g>
            {renderRectBase(x, y, w, h, 'browser', fill, true, 2.2)}
            {/* Header bar fill */}
            <path
              d={
                sketchRectPaths(x + 1, y + 1, w - 2, headerH, `${id}-bh`, sketchStyle)
                  .fillPath
              }
              fill="#e2e8f0"
            />
            <path
              d={sketchLinePath(x, y + headerH, x + w, y + headerH, `${id}-bdiv`, sketchStyle)}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
            />
            {/* 3 window traffic circles */}
            {[0, 1, 2].map((idx) => (
              <path
                key={idx}
                d={sketchEllipsePath(
                  x + 18 + idx * 18,
                  y + headerH / 2,
                  5,
                  5,
                  `${id}-dot-${idx}`,
                  sketchStyle
                )}
                fill="#ffffff"
                stroke={strokeColor}
                strokeWidth={1.6}
              />
            ))}
            {/* URL bar */}
            {renderRectBase(addrX, addrY, addrW, addrH, 'url', 'white', true, 1.5)}
            <text
              x={addrX + 10}
              y={addrY + addrH / 2 + 4}
              fontFamily={fontFamily}
              fontSize={12}
              fill={INK_MUTED}
            >
              {(subtext !== undefined ? subtext : text).slice(0, Math.floor(addrW / 7))}
            </text>
          </g>
        );
      }

      case 'mobile': {
        const outerPaths = sketchRectPaths(x, y, w, h, `${id}-mob-out`, sketchStyle, 22);
        const screenPad = 12;
        const topBarH = 34;
        const bottomBarH = 26;
        return (
          <g>
            <path d={outerPaths.fillPath} fill="#f8fafc" />
            <path
              d={outerPaths.strokePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            {/* Inner viewport */}
            {renderRectBase(
              x + screenPad,
              y + topBarH,
              w - screenPad * 2,
              h - topBarH - bottomBarH,
              'mob-in',
              fill,
              true,
              1.6
            )}
            {/* Speaker notch */}
            <path
              d={sketchLinePath(
                x + w / 2 - 24,
                y + 17,
                x + w / 2 + 24,
                y + 17,
                `${id}-speaker`,
                sketchStyle
              )}
              stroke={strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* Home indicator */}
            <path
              d={sketchLinePath(
                x + w / 2 - 36,
                y + h - 13,
                x + w / 2 + 36,
                y + h - 13,
                `${id}-homebar`,
                sketchStyle
              )}
              stroke={INK_MUTED}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        );
      }

      case 'box': {
        const isBordered = widget.bordered !== false;
        const align = widget.align || 'center';
        const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
        const tx = align === 'left' ? x + 16 : align === 'right' ? x + w - 16 : x + w / 2;
        return (
          <g>
            {renderRectBase(x, y, w, h, 'box', fill, isBordered, 2)}
            {text && (
              <text
                x={tx}
                y={subtext ? y + h / 2 - 4 : y + h / 2 + 5}
                textAnchor={anchor}
                fontFamily={fontFamily}
                fontSize={16}
                fontWeight={600}
                fill={textOnFill}
              >
                {text}
              </text>
            )}
            {subtext && (
              <text
                x={tx}
                y={y + h / 2 + 18}
                textAnchor={anchor}
                fontFamily={fontFamily}
                fontSize={13}
                fill={fill === 'dark' ? '#cbd5e1' : INK_MUTED}
              >
                {subtext}
              </text>
            )}
          </g>
        );
      }

      case 'modal': {
        const titleH = 44;
        return (
          <g>
            {/* Subtle drop shadow behind modal */}
            <path
              d={sketchRectPaths(x + 6, y + 6, w, h, `${id}-msh`, sketchStyle).fillPath}
              fill="#cbd5e1"
              opacity={0.75}
            />
            {renderRectBase(x, y, w, h, 'modal', fill, true, 2.2)}
            <path
              d={sketchLinePath(x, y + titleH, x + w, y + titleH, `${id}-mdiv`, sketchStyle)}
              stroke={strokeColor}
              strokeWidth={1.8}
              fill="none"
            />
            {text && (
              <text
                x={x + 18}
                y={y + 28}
                fontFamily={fontFamily}
                fontSize={16}
                fontWeight={600}
                fill={textOnFill}
              >
                {text}
              </text>
            )}
            {/* Close X */}
            <path
              d={[
                sketchLinePath(x + w - 28, y + 16, x + w - 16, y + 28, `${id}-x1`, sketchStyle),
                sketchLinePath(x + w - 16, y + 16, x + w - 28, y + 28, `${id}-x2`, sketchStyle),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {subtext &&
              wrapTextLines(subtext, Math.max(16, Math.floor((w - 36) / 8)), 4).map((ln, idx) => (
                <text
                  key={idx}
                  x={x + 18}
                  y={y + titleH + 28 + idx * 20}
                  fontFamily={fontFamily}
                  fontSize={14}
                  fill={INK_MUTED}
                >
                  {ln}
                </text>
              ))}
          </g>
        );
      }

      case 'button': {
        return (
          <g>
            {renderRectBase(x, y, w, h, 'btn', fill, true, 2, true)}
            <text
              x={x + w / 2}
              y={y + h / 2 + 5}
              textAnchor="middle"
              fontFamily={fontFamily}
              fontSize={15}
              fontWeight={600}
              fill={textOnFill}
            >
              {text}
            </text>
          </g>
        );
      }

      case 'input': {
        const hasLabel = Boolean(text && h >= 52);
        const boxY = hasLabel ? y + 22 : y;
        const boxH = hasLabel ? Math.max(28, h - 22) : h;
        const placeholder = hasLabel ? subtext || '' : subtext || text || '';
        return (
          <g>
            {hasLabel && (
              <text
                x={x + 2}
                y={y + 15}
                fontFamily={fontFamily}
                fontSize={13}
                fontWeight={600}
                fill={strokeColor}
              >
                {text}
              </text>
            )}
            {renderRectBase(x, boxY, w, boxH, 'inp', fill, true, 1.9)}
            <text
              x={x + 12}
              y={boxY + boxH / 2 + 5}
              fontFamily={fontFamily}
              fontSize={14}
              fill={INK_MUTED}
            >
              {placeholder.slice(0, Math.max(8, Math.floor((w - 24) / 7.5)))}
            </text>
          </g>
        );
      }

      case 'search': {
        const iconCx = x + 18;
        const iconCy = y + h / 2 - 1;
        return (
          <g>
            {renderRectBase(x, y, w, h, 'srch', fill, true, 1.9)}
            <path
              d={sketchEllipsePath(iconCx, iconCy, 6, 6, `${id}-mg`, sketchStyle)}
              fill="none"
              stroke={INK_MUTED}
              strokeWidth={1.8}
            />
            <path
              d={sketchLinePath(
                iconCx + 4.5,
                iconCy + 4.5,
                iconCx + 10,
                iconCy + 10,
                `${id}-mgh`,
                sketchStyle
              )}
              stroke={INK_MUTED}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <text
              x={x + 36}
              y={y + h / 2 + 5}
              fontFamily={fontFamily}
              fontSize={14}
              fill={INK_MUTED}
            >
              {(text || '').slice(0, Math.max(6, Math.floor((w - 44) / 7.5)))}
            </text>
          </g>
        );
      }

      case 'select': {
        const divX = x + w - 34;
        const cy = y + h / 2;
        return (
          <g>
            {renderRectBase(x, y, w, h, 'sel', fill, true, 1.9)}
            <path
              d={sketchLinePath(divX, y + 2, divX, y + h - 2, `${id}-sdiv`, sketchStyle)}
              stroke={strokeColor}
              strokeWidth={1.6}
            />
            {/* Downward caret */}
            <path
              d={[
                sketchLinePath(divX + 11, cy - 3, divX + 17, cy + 4, `${id}-c1`, sketchStyle),
                sketchLinePath(divX + 17, cy + 4, divX + 23, cy - 3, `${id}-c2`, sketchStyle),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <text
              x={x + 12}
              y={cy + 5}
              fontFamily={fontFamily}
              fontSize={14}
              fill={textOnFill}
            >
              {(text || '').slice(0, Math.max(6, Math.floor((w - 48) / 7.5)))}
            </text>
          </g>
        );
      }

      case 'checkbox': {
        const items = (text || '[x] Option 1\n[ ] Option 2').split('\n').filter(Boolean);
        const rowH = 28;
        return (
          <g>
            {items.slice(0, Math.max(1, Math.floor((h + 8) / rowH))).map((raw, idx) => {
              const ry = y + 4 + idx * rowH;
              const trimmed = raw.trim();
              const isRadioChecked = /^\(\s*[xo*]\s*\)/i.test(trimmed);
              const isRadioUnchecked = /^\(\s*\)/.test(trimmed);
              const isRadio = isRadioChecked || isRadioUnchecked;
              const isChecked =
                isRadioChecked || /^\[\s*[x*]\s*\]/i.test(trimmed);
              const cleanLabel = trimmed
                .replace(/^(\[\s*[x*]?\s*\]|\(\s*[xo*]?\s*\))\s*/i, '')
                .trim();

              return (
                <g key={idx}>
                  {isRadio ? (
                    <>
                      <path
                        d={sketchEllipsePath(
                          x + 10,
                          ry + 10,
                          8,
                          8,
                          `${id}-rad-${idx}`,
                          sketchStyle
                        )}
                        fill="#ffffff"
                        stroke={strokeColor}
                        strokeWidth={1.8}
                      />
                      {isChecked && (
                        <path
                          d={sketchEllipsePath(
                            x + 10,
                            ry + 10,
                            4,
                            4,
                            `${id}-raddot-${idx}`,
                            sketchStyle
                          )}
                          fill={strokeColor}
                          stroke="none"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {renderRectBase(x + 2, ry + 2, 16, 16, `chk-${idx}`, 'white', true, 1.8)}
                      {isChecked && (
                        <path
                          d={[
                            sketchLinePath(
                              x + 5,
                              ry + 10,
                              x + 9,
                              ry + 15,
                              `${id}-ck1-${idx}`,
                              sketchStyle
                            ),
                            sketchLinePath(
                              x + 9,
                              ry + 15,
                              x + 17,
                              ry + 4,
                              `${id}-ck2-${idx}`,
                              sketchStyle
                            ),
                          ].join(' ')}
                          stroke={strokeColor}
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          fill="none"
                        />
                      )}
                    </>
                  )}
                  <text
                    x={x + 28}
                    y={ry + 15}
                    fontFamily={fontFamily}
                    fontSize={14}
                    fill={strokeColor}
                  >
                    {cleanLabel || trimmed}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'tabs': {
        const items = (text || 'Tab 1, Tab 2, Tab 3')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const count = Math.max(1, items.length);
        const activeIdx = Math.min(count - 1, Math.max(0, widget.activeIndex ?? 0));
        const tabW = Math.min(132, (w - 8) / count);
        const baseLineY = y + h - 2;

        return (
          <g>
            {items.map((item, idx) => {
              const tx = x + idx * tabW;
              const isActive = idx === activeIdx;
              const tabTop = isActive ? y : y + 5;
              const tabH = baseLineY - tabTop;
              return (
                <g key={idx}>
                  <path
                    d={
                      sketchRectPaths(tx, tabTop, tabW - 4, tabH, `${id}-tb-${idx}`, sketchStyle)
                        .fillPath
                    }
                    fill={isActive ? '#ffffff' : '#e2e8f0'}
                  />
                  <path
                    d={[
                      sketchLinePath(tx, baseLineY, tx, tabTop, `${id}-tl-${idx}`, sketchStyle),
                      sketchLinePath(
                        tx,
                        tabTop,
                        tx + tabW - 4,
                        tabTop,
                        `${id}-tt-${idx}`,
                        sketchStyle
                      ),
                      sketchLinePath(
                        tx + tabW - 4,
                        tabTop,
                        tx + tabW - 4,
                        baseLineY,
                        `${id}-tr-${idx}`,
                        sketchStyle
                      ),
                    ].join(' ')}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isActive ? 2.1 : 1.6}
                    strokeLinecap="round"
                  />
                  <text
                    x={tx + (tabW - 4) / 2}
                    y={tabTop + tabH / 2 + 5}
                    textAnchor="middle"
                    fontFamily={fontFamily}
                    fontSize={13}
                    fontWeight={isActive ? 700 : 400}
                    fill={isActive ? INK : INK_MUTED}
                  >
                    {item.replace(/^\*/, '')}
                  </text>
                </g>
              );
            })}
            {/* Baseline across remaining width */}
            <path
              d={sketchLinePath(
                x + activeIdx * tabW + tabW - 4,
                baseLineY,
                x + w,
                baseLineY,
                `${id}-tbase-r`,
                sketchStyle
              )}
              stroke={strokeColor}
              strokeWidth={2}
            />
            {activeIdx > 0 && (
              <path
                d={sketchLinePath(
                  x,
                  baseLineY,
                  x + activeIdx * tabW,
                  baseLineY,
                  `${id}-tbase-l`,
                  sketchStyle
                )}
                stroke={strokeColor}
                strokeWidth={2}
              />
            )}
          </g>
        );
      }

      case 'navbar': {
        const links = (subtext !== undefined ? subtext : '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const cy = y + h / 2 + 5;
        return (
          <g>
            {renderRectBase(x, y, w, h, 'nav', fill, true, 2)}
            {text && (
              <text
                x={x + 20}
                y={cy}
                fontFamily={fontFamily}
                fontSize={17}
                fontWeight={700}
                fill={textOnFill}
              >
                {text}
              </text>
            )}
            {links.map((lnk, idx) => {
              const lx = x + w - 24 - (links.length - 1 - idx) * 92;
              const isAct = idx === (widget.activeIndex ?? 0);
              return (
                <g key={idx}>
                  <text
                    x={lx}
                    y={cy}
                    textAnchor="end"
                    fontFamily={fontFamily}
                    fontSize={13}
                    fontWeight={isAct ? 700 : 400}
                    fill={fill === 'dark' ? '#f8fafc' : isAct ? INK : INK_MUTED}
                  >
                    {lnk}
                  </text>
                  {isAct && (
                    <path
                      d={sketchLinePath(
                        lx - lnk.length * 7.2,
                        cy + 5,
                        lx,
                        cy + 5,
                        `${id}-nu-${idx}`,
                        sketchStyle
                      )}
                      stroke={textOnFill}
                      strokeWidth={1.8}
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      }

      case 'heading': {
        const sizeMap = { sm: 15, md: 19, lg: 23, xl: 28 };
        const fSize = sizeMap[widget.fontSize || 'xl'];
        const align = widget.align || 'left';
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 4 : x + 2;
        return (
          <g>
            <text
              x={tx}
              y={y + h / 2 + fSize * 0.34}
              textAnchor={anchor}
              fontFamily={fontFamily}
              fontSize={fSize}
              fontWeight={700}
              fill={strokeColor}
            >
              {text}
            </text>
          </g>
        );
      }

      case 'paragraph': {
        if (widget.scribble) {
          return (
            <path
              d={sketchScribbleLinesPath(x + 2, y + 4, w - 4, h - 8, `${id}-scrib`, sketchStyle)}
              fill="none"
              stroke={INK_MUTED}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          );
        }
        const fSize = widget.fontSize === 'sm' ? 12 : widget.fontSize === 'lg' ? 16 : 14;
        const maxChars = Math.max(12, Math.floor(w / (fSize * 0.56)));
        const maxLines = Math.max(1, Math.floor(h / (fSize * 1.45)));
        const lines = wrapTextLines(text, maxChars, maxLines);
        return (
          <g>
            {lines.map((ln, idx) => (
              <text
                key={idx}
                x={x + 2}
                y={y + fSize + 2 + idx * Math.round(fSize * 1.45)}
                fontFamily={fontFamily}
                fontSize={fSize}
                fill={INK}
              >
                {ln}
              </text>
            ))}
          </g>
        );
      }

      case 'image': {
        return (
          <g>
            {renderRectBase(x, y, w, h, 'img', fill === 'transparent' ? 'muted' : fill, true, 2)}
            <path
              d={[
                sketchLinePath(x + 2, y + 2, x + w - 2, y + h - 2, `${id}-ix1`, sketchStyle),
                sketchLinePath(x + w - 2, y + 2, x + 2, y + h - 2, `${id}-ix2`, sketchStyle),
              ].join(' ')}
              stroke="#94a3b8"
              strokeWidth={1.6}
              fill="none"
            />
            {text && w >= 90 && h >= 54 && (
              <g>
                <rect
                  x={x + w / 2 - Math.min(w - 16, text.length * 7.8 + 18) / 2}
                  y={y + h / 2 - 13}
                  width={Math.min(w - 16, text.length * 7.8 + 18)}
                  height={26}
                  rx={4}
                  fill="#ffffff"
                  stroke={INK_LIGHT}
                  strokeWidth={1}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 4}
                  textAnchor="middle"
                  fontFamily={fontFamily}
                  fontSize={12}
                  fill={INK_MUTED}
                >
                  {text.slice(0, Math.floor((w - 24) / 7))}
                </text>
              </g>
            )}
          </g>
        );
      }

      case 'avatar': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = Math.max(10, w / 2 - 2);
        const ry = Math.max(10, h / 2 - 2);
        return (
          <g>
            <path
              d={sketchEllipsePath(cx, cy, rx, ry, `${id}-av`, sketchStyle)}
              fill={fillBg === 'none' ? '#e2e8f0' : fillBg}
              stroke={strokeColor}
              strokeWidth={2}
            />
            {text ? (
              <text
                x={cx}
                y={cy + 5}
                textAnchor="middle"
                fontFamily={fontFamily}
                fontSize={Math.max(11, Math.min(18, Math.min(w, h) * 0.34))}
                fontWeight={700}
                fill={textOnFill}
              >
                {text.slice(0, 3)}
              </text>
            ) : (
              <>
                <path
                  d={sketchEllipsePath(
                    cx,
                    cy - ry * 0.22,
                    rx * 0.32,
                    ry * 0.32,
                    `${id}-avh`,
                    sketchStyle
                  )}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${cx - rx * 0.55} ${cy + ry * 0.65} Q ${cx} ${cy + ry * 0.1} ${
                    cx + rx * 0.55
                  } ${cy + ry * 0.65}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.6}
                />
              </>
            )}
          </g>
        );
      }

      case 'table': {
        const rawRows = (text || 'Column A, Column B\nValue 1, Value 2')
          .split('\n')
          .filter((r) => r.trim().length > 0);
        const parsed = rawRows.map((r) => r.split(',').map((c) => c.trim()));
        const colCount = Math.max(1, ...parsed.map((r) => r.length));
        const colW = w / colCount;
        const headerH = 38;
        const bodyRowH = 36;
        const maxVisibleRows = Math.max(1, Math.floor((h - headerH) / bodyRowH) + 1);
        const visibleRows = parsed.slice(0, maxVisibleRows);

        return (
          <g>
            {renderRectBase(x, y, w, h, 'tbl', fill, true, 2)}
            {/* Header background */}
            <path
              d={sketchRectPaths(x + 1, y + 1, w - 2, headerH, `${id}-thbg`, sketchStyle).fillPath}
              fill="#e2e8f0"
            />
            <path
              d={sketchLinePath(x, y + headerH, x + w, y + headerH, `${id}-thl`, sketchStyle)}
              stroke={strokeColor}
              strokeWidth={2}
            />
            {/* Vertical column dividers */}
            {Array.from({ length: colCount - 1 }).map((_, cIdx) => {
              const cx = x + (cIdx + 1) * colW;
              return (
                <path
                  key={cIdx}
                  d={sketchLinePath(cx, y, cx, y + h, `${id}-tcol-${cIdx}`, sketchStyle)}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />
              );
            })}
            {/* Rows & cells */}
            {visibleRows.map((cells, rIdx) => {
              const isHead = rIdx === 0;
              const rowTop = isHead ? y : y + headerH + (rIdx - 1) * bodyRowH;
              const curH = isHead ? headerH : bodyRowH;
              return (
                <g key={rIdx}>
                  {!isHead && rIdx > 1 && (
                    <path
                      d={sketchLinePath(x, rowTop, x + w, rowTop, `${id}-trw-${rIdx}`, sketchStyle)}
                      stroke="#e2e8f0"
                      strokeWidth={1.4}
                    />
                  )}
                  {Array.from({ length: colCount }).map((_, cIdx) => {
                    const cellText = cells[cIdx] || '';
                    return (
                      <text
                        key={cIdx}
                        x={x + cIdx * colW + 12}
                        y={rowTop + curH / 2 + 5}
                        fontFamily={fontFamily}
                        fontSize={13}
                        fontWeight={isHead ? 700 : 400}
                        fill={isHead ? INK : '#334155'}
                      >
                        {cellText.slice(0, Math.max(4, Math.floor((colW - 20) / 7.5)))}
                      </text>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      }

      case 'divider': {
        const my = y + h / 2;
        return (
          <path
            d={sketchLinePath(x, my, x + w, my, `${id}-hr`, sketchStyle)}
            stroke={INK_MUTED}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        );
      }

      case 'arrow': {
        const dir = widget.direction || 'right';
        let sx = x + 6;
        let sy = y + h / 2;
        let ex = x + w - 6;
        let ey = y + h / 2;

        if (dir === 'left') {
          sx = x + w - 6;
          ex = x + 6;
        } else if (dir === 'down') {
          sx = x + w / 2;
          sy = y + 6;
          ex = x + w / 2;
          ey = y + h - 6;
        } else if (dir === 'up') {
          sx = x + w / 2;
          sy = y + h - 6;
          ex = x + w / 2;
          ey = y + 6;
        } else if (dir === 'diag-down') {
          sx = x + 6;
          sy = y + 6;
          ex = x + w - 6;
          ey = y + h - 6;
        } else if (dir === 'diag-up') {
          sx = x + 6;
          sy = y + h - 6;
          ex = x + w - 6;
          ey = y + 6;
        }

        const angle = Math.atan2(ey - sy, ex - sx);
        const headLen = 12;
        const ax1 = ex - headLen * Math.cos(angle - Math.PI / 6);
        const ay1 = ey - headLen * Math.sin(angle - Math.PI / 6);
        const ax2 = ex - headLen * Math.cos(angle + Math.PI / 6);
        const ay2 = ey - headLen * Math.sin(angle + Math.PI / 6);

        return (
          <g>
            <path
              d={sketchLinePath(sx, sy, ex, ey, `${id}-arr`, sketchStyle)}
              stroke={strokeColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={[
                sketchLinePath(ex, ey, ax1, ay1, `${id}-ah1`, sketchStyle),
                sketchLinePath(ex, ey, ax2, ay2, `${id}-ah2`, sketchStyle),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      }

      case 'note': {
        const fold = 18;
        const lines = wrapTextLines(
          text,
          Math.max(12, Math.floor((w - 24) / 7.5)),
          Math.max(2, Math.floor((h - 24) / 18))
        );
        const poly = `M ${x} ${y} L ${x + w - fold} ${y} L ${x + w} ${y + fold} L ${x + w} ${
          y + h
        } L ${x} ${y + h} Z`;
        return (
          <g>
            <path
              d={`M ${x + 4} ${y + 5} L ${x + w + 4} ${y + 5} L ${x + w + 4} ${
                y + h + 5
              } L ${x + 4} ${y + h + 5} Z`}
              fill="#cbd5e1"
              opacity={0.55}
            />
            <path
              d={poly}
              fill="#fef08a"
              stroke="#ca8a04"
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <path
              d={`M ${x + w - fold} ${y} L ${x + w - fold} ${y + fold} L ${x + w} ${y + fold}`}
              fill="#fde047"
              stroke="#ca8a04"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {lines.map((ln, idx) => (
              <text
                key={idx}
                x={x + 12}
                y={y + 26 + idx * 18}
                fontFamily={fontFamily}
                fontSize={13}
                fill="#713f12"
              >
                {ln}
              </text>
            ))}
          </g>
        );
      }

      case 'callout': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.max(12, Math.min(w, h) / 2 - 2);
        return (
          <g>
            <path
              d={sketchEllipsePath(cx, cy, r, r, `${id}-call`, sketchStyle)}
              fill="#facc15"
              stroke="#854d0e"
              strokeWidth={2}
            />
            <text
              x={cx}
              y={cy + 5}
              textAnchor="middle"
              fontFamily={fontFamily}
              fontSize={14}
              fontWeight={700}
              fill="#422006"
            >
              {(text || '1').slice(0, 3)}
            </text>
          </g>
        );
      }

      case 'vscrollbar': {
        const capH = Math.min(20, Math.max(12, Math.floor(h * 0.16)));
        const innerH = Math.max(12, h - capH * 2 - 6);
        const thumbH = Math.max(14, Math.round(innerH * 0.34));
        const pct = Math.max(0, Math.min(100, widget.scrollPos ?? 20)) / 100;
        const thumbY = y + capH + 3 + Math.round((innerH - thumbH) * pct);
        const thumbW = Math.max(6, w - 6);
        const cx = x + w / 2;
        const thumbMidY = thumbY + thumbH / 2;

        return (
          <g>
            {renderRectBase(x, y, w, h, 'vsb-track', fill, true, 1.9)}
            {/* Top & bottom stepper dividers */}
            <path
              d={[
                sketchLinePath(x + 1, y + capH, x + w - 1, y + capH, `${id}-vtdiv`, sketchStyle),
                sketchLinePath(
                  x + 1,
                  y + h - capH,
                  x + w - 1,
                  y + h - capH,
                  `${id}-vbdiv`,
                  sketchStyle
                ),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={1.6}
              fill="none"
            />
            {/* Top chevron ▲ */}
            <path
              d={[
                sketchLinePath(
                  cx - 3.5,
                  y + capH / 2 + 2,
                  cx,
                  y + capH / 2 - 2.5,
                  `${id}-vuc1`,
                  sketchStyle
                ),
                sketchLinePath(
                  cx,
                  y + capH / 2 - 2.5,
                  cx + 3.5,
                  y + capH / 2 + 2,
                  `${id}-vuc2`,
                  sketchStyle
                ),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
            {/* Bottom chevron ▼ */}
            <path
              d={[
                sketchLinePath(
                  cx - 3.5,
                  y + h - capH / 2 - 2,
                  cx,
                  y + h - capH / 2 + 2.5,
                  `${id}-vdc1`,
                  sketchStyle
                ),
                sketchLinePath(
                  cx,
                  y + h - capH / 2 + 2.5,
                  cx + 3.5,
                  y + h - capH / 2 - 2,
                  `${id}-vdc2`,
                  sketchStyle
                ),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
            {/* Draggable-look thumb */}
            <path
              d={
                sketchRectPaths(x + 3, thumbY, thumbW, thumbH, `${id}-vth`, sketchStyle)
                  .fillPath
              }
              fill={fill === 'dark' ? '#94a3b8' : '#cbd5e1'}
            />
            <path
              d={
                sketchRectPaths(x + 3, thumbY, thumbW, thumbH, `${id}-vth`, sketchStyle)
                  .strokePath
              }
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.6}
            />
            {thumbH >= 22 && (
              <path
                d={[
                  sketchLinePath(
                    cx - 3,
                    thumbMidY - 3,
                    cx + 3,
                    thumbMidY - 3,
                    `${id}-vg1`,
                    sketchStyle
                  ),
                  sketchLinePath(cx - 3, thumbMidY, cx + 3, thumbMidY, `${id}-vg2`, sketchStyle),
                  sketchLinePath(
                    cx - 3,
                    thumbMidY + 3,
                    cx + 3,
                    thumbMidY + 3,
                    `${id}-vg3`,
                    sketchStyle
                  ),
                ].join(' ')}
                stroke={strokeColor}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      }

      case 'hscrollbar': {
        const capW = Math.min(20, Math.max(12, Math.floor(w * 0.16)));
        const innerW = Math.max(12, w - capW * 2 - 6);
        const thumbW = Math.max(14, Math.round(innerW * 0.34));
        const pct = Math.max(0, Math.min(100, widget.scrollPos ?? 20)) / 100;
        const thumbX = x + capW + 3 + Math.round((innerW - thumbW) * pct);
        const thumbH = Math.max(6, h - 6);
        const cy = y + h / 2;
        const thumbMidX = thumbX + thumbW / 2;

        return (
          <g>
            {renderRectBase(x, y, w, h, 'hsb-track', fill, true, 1.9)}
            {/* Left & right stepper dividers */}
            <path
              d={[
                sketchLinePath(x + capW, y + 1, x + capW, y + h - 1, `${id}-hldiv`, sketchStyle),
                sketchLinePath(
                  x + w - capW,
                  y + 1,
                  x + w - capW,
                  y + h - 1,
                  `${id}-hrdiv`,
                  sketchStyle
                ),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={1.6}
              fill="none"
            />
            {/* Left chevron ◀ */}
            <path
              d={[
                sketchLinePath(
                  x + capW / 2 + 2,
                  cy - 3.5,
                  x + capW / 2 - 2.5,
                  cy,
                  `${id}-hlc1`,
                  sketchStyle
                ),
                sketchLinePath(
                  x + capW / 2 - 2.5,
                  cy,
                  x + capW / 2 + 2,
                  cy + 3.5,
                  `${id}-hlc2`,
                  sketchStyle
                ),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
            {/* Right chevron ▶ */}
            <path
              d={[
                sketchLinePath(
                  x + w - capW / 2 - 2,
                  cy - 3.5,
                  x + w - capW / 2 + 2.5,
                  cy,
                  `${id}-hrc1`,
                  sketchStyle
                ),
                sketchLinePath(
                  x + w - capW / 2 + 2.5,
                  cy,
                  x + w - capW / 2 - 2,
                  cy + 3.5,
                  `${id}-hrc2`,
                  sketchStyle
                ),
              ].join(' ')}
              stroke={strokeColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
            {/* Draggable-look thumb */}
            <path
              d={
                sketchRectPaths(thumbX, y + 3, thumbW, thumbH, `${id}-hth`, sketchStyle)
                  .fillPath
              }
              fill={fill === 'dark' ? '#94a3b8' : '#cbd5e1'}
            />
            <path
              d={
                sketchRectPaths(thumbX, y + 3, thumbW, thumbH, `${id}-hth`, sketchStyle)
                  .strokePath
              }
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.6}
            />
            {thumbW >= 22 && (
              <path
                d={[
                  sketchLinePath(
                    thumbMidX - 3,
                    cy - 3,
                    thumbMidX - 3,
                    cy + 3,
                    `${id}-hg1`,
                    sketchStyle
                  ),
                  sketchLinePath(thumbMidX, cy - 3, thumbMidX, cy + 3, `${id}-hg2`, sketchStyle),
                  sketchLinePath(
                    thumbMidX + 3,
                    cy - 3,
                    thumbMidX + 3,
                    cy + 3,
                    `${id}-hg3`,
                    sketchStyle
                  ),
                ].join(' ')}
                stroke={strokeColor}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      }

      default:
        return renderRectBase(x, y, w, h, 'fallback', fill, true, 2);
    }
  };

  return (
    <g opacity={disabled ? 0.55 : 1}>
      {renderWidgetBody()}

      {/* Prototype link badge in Edit mode */}
      {!isPresentMode && widget.linkToScreenId && (
        <g transform={`translate(${x + w - 10}, ${y - 8})`}>
          <rect
            x={-8}
            y={-8}
            width={20}
            height={20}
            rx={5}
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          <path
            d="M -2 2 L 5 -3 M 1 -3 L 5 -3 L 5 1"
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Hotspot highlight flash in Present Prototype mode */}
      {isPresentMode && widget.linkToScreenId && showHotspotHint && (
        <rect
          x={x - 4}
          y={y - 4}
          width={w + 8}
          height={h + 8}
          rx={6}
          fill="rgba(37, 99, 235, 0.16)"
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      )}
    </g>
  );
};
