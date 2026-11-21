import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Camera,
  CheckSquare,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Edit3,
  Group,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Ungroup,
  Unlock,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SketchStyle, WireframeWidget } from '../types/wireframe';

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  selectedWidgets: WireframeWidget[];
  sketchStyle: SketchStyle;
  onCopyWidgets?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onLayerAction: (action: 'front' | 'back' | 'forward' | 'backward') => void;
  onToggleLock: () => void;
  onStartEdit?: () => void;
  onAlign: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onSelectAll: () => void;
  onQuickAdd: () => void;
  onCopyScreen?: () => void;
  onPasteFromClipboard?: () => void;
  onOpenAiGenerate?: (mode: 'text' | 'screenshot') => void;
  onChangeSketchStyle: (style: SketchStyle) => void;
  onZoom: (delta: number) => void;
  onResetZoom: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  selectedWidgets,
  sketchStyle,
  onCopyWidgets,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onLayerAction,
  onToggleLock,
  onStartEdit,
  onAlign,
  onSelectAll,
  onQuickAdd,
  onCopyScreen,
  onPasteFromClipboard,
  onOpenAiGenerate,
  onChangeSketchStyle,
  onZoom,
  onResetZoom,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ left: x, top: y });

  const hasSelection = selectedWidgets.length > 0;
  const isSingle = selectedWidgets.length === 1;
  const hasMultiple = selectedWidgets.length > 1;
  const hasLocked = selectedWidgets.some((w) => w.locked);
  const allLocked = hasSelection && selectedWidgets.every((w) => w.locked);
  const hasGrouped = selectedWidgets.some((w) => Boolean(w.groupId));

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  // Keep menu within window bounds
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    let nextX = x;
    let nextY = y;

    if (x + rect.width > window.innerWidth - pad) {
      nextX = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (y + rect.height > window.innerHeight - pad) {
      nextY = Math.max(pad, window.innerHeight - rect.height - pad);
    }

    setCoords({ left: nextX, top: nextY });
  }, [x, y]);

  // Dismiss on outside click, escape, or canvas scroll
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [onClose]);

  const runAndClose = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Canvas Context Menu"
      style={{ left: coords.left, top: coords.top }}
      className="fixed z-50 min-w-[210px] max-w-[260px] rounded-xl border border-slate-200/90 bg-white/95 p-1 text-slate-800 shadow-xl backdrop-blur-md select-none transition-opacity"
      onContextMenu={(e) => e.preventDefault()}
    >
      {hasSelection ? (
        <>
          {/* Header indicator */}
          <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            {isSingle
              ? selectedWidgets[0].groupId
                ? 'Group Member'
                : 'Selected Widget'
              : `${selectedWidgets.length} Items Selected`}
          </div>

          {/* Quick Edit (single widget) */}
          {isSingle && onStartEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onStartEdit)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <div className="flex items-center gap-2">
                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit Text</span>
              </div>
              <span className="font-mono-tabular text-[10px] text-slate-400">Double-click</span>
            </button>
          )}

          {/* Copy to Clipboard */}
          {onCopyWidgets && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onCopyWidgets)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <div className="flex items-center gap-2">
                <ClipboardCopy className="h-3.5 w-3.5 text-slate-500" />
                <span>Copy</span>
              </div>
              <kbd className="font-mono-tabular text-[10px] text-slate-400">{modKey}C</kbd>
            </button>
          )}

          {/* Duplicate */}
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onDuplicate)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <Copy className="h-3.5 w-3.5 text-slate-500" />
              <span>Duplicate</span>
            </div>
            <kbd className="font-mono-tabular text-[10px] text-slate-400">{modKey}D</kbd>
          </button>

          {/* Delete */}
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onDelete)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
              <span>Delete</span>
            </div>
            <kbd className="font-mono-tabular text-[10px] text-red-400">Del</kbd>
          </button>

          <div className="my-1 h-px bg-slate-100" />

          {/* Grouping */}
          {hasMultiple && (
            <button
              type="button"
              role="menuitem"
              disabled={hasLocked}
              onClick={() => runAndClose(onGroup)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                <Group className="h-3.5 w-3.5 text-slate-500" />
                <span>Group Elements</span>
              </div>
              <kbd className="font-mono-tabular text-[10px] text-slate-400">{modKey}G</kbd>
            </button>
          )}

          {hasGrouped && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onUngroup)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <div className="flex items-center gap-2">
                <Ungroup className="h-3.5 w-3.5 text-slate-500" />
                <span>Ungroup Elements</span>
              </div>
              <kbd className="font-mono-tabular text-[10px] text-slate-400">
                {modKey}⇧G
              </kbd>
            </button>
          )}

          <div className="my-1 h-px bg-slate-100" />

          {/* Layer Ordering */}
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(() => onLayerAction('front'))}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <ArrowUpToLine className="h-3.5 w-3.5 text-slate-500" />
              <span>Bring to Front</span>
            </div>
            <kbd className="font-mono-tabular text-[10px] text-slate-400">]</kbd>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(() => onLayerAction('forward'))}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
              <span>Bring Forward</span>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(() => onLayerAction('backward'))}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
              <span>Send Backward</span>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(() => onLayerAction('back'))}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-3.5 w-3.5 text-slate-500" />
              <span>Send to Back</span>
            </div>
            <kbd className="font-mono-tabular text-[10px] text-slate-400">[</kbd>
          </button>

          <div className="my-1 h-px bg-slate-100" />

          {/* Alignment Strip (if 2+ selected) */}
          {hasMultiple && (
            <div className="px-2 py-1.5">
              <div className="mb-1 text-[10px] font-medium text-slate-400">
                Align Selection
              </div>
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    ['left', AlignLeft, 'Left'],
                    ['center', AlignCenter, 'Center'],
                    ['right', AlignRight, 'Right'],
                    ['top', AlignLeft, 'Top'],
                    ['middle', AlignCenter, 'Middle'],
                    ['bottom', AlignRight, 'Bottom'],
                  ] as const
                ).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    title={`Align ${label}`}
                    onClick={() => runAndClose(() => onAlign(mode))}
                    className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-1 text-slate-700 hover:bg-white hover:text-slate-900"
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lock / Unlock */}
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onToggleLock)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              {allLocked ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Unlock Elements</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Lock Elements</span>
                </>
              )}
            </div>
          </button>
        </>
      ) : (
        /* Empty canvas context menu */
        <>
          <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Artboard Canvas
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onQuickAdd)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-blue-600" />
              <span>Quick Add Stencil</span>
            </div>
            <kbd className="font-mono-tabular text-[10px] text-slate-400">/</kbd>
          </button>

          {onOpenAiGenerate && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(() => onOpenAiGenerate('text'))}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>AI Text to Wireframe</span>
                </div>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(() => onOpenAiGenerate('screenshot'))}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <div className="flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-blue-600" />
                  <span>AI Screenshot to Wireframe</span>
                </div>
              </button>
            </>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onSelectAll)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
              <span>Select All Elements</span>
            </div>
            <kbd className="font-mono-tabular text-[10px] text-slate-400">{modKey}A</kbd>
          </button>

          {(onCopyScreen || onPasteFromClipboard) && (
            <>
              <div className="my-1 h-px bg-slate-100" />
              {onCopyScreen && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAndClose(onCopyScreen)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardCopy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copy Current Screen</span>
                  </div>
                  <kbd className="font-mono-tabular text-[10px] text-slate-400">{modKey}C</kbd>
                </button>
              )}
              {onPasteFromClipboard && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAndClose(onPasteFromClipboard)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardPaste className="h-3.5 w-3.5 text-slate-500" />
                    <span>Paste Screen / Widgets</span>
                  </div>
                  <kbd className="font-mono-tabular text-[10px] text-slate-400">{modKey}V</kbd>
                </button>
              )}
            </>
          )}

          <div className="my-1 h-px bg-slate-100" />

          {/* Sketch Style Toggle */}
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              runAndClose(() =>
                onChangeSketchStyle(sketchStyle === 'hand' ? 'clean' : 'hand')
              )
            }
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>
                {sketchStyle === 'hand' ? 'Switch to Crisp Wire' : 'Switch to Hand Sketch'}
              </span>
            </div>
          </button>

          <div className="my-1 h-px bg-slate-100" />

          {/* Zoom Controls */}
          <div className="grid grid-cols-3 gap-1 px-1 py-0.5">
            <button
              type="button"
              title="Zoom In"
              onClick={() => runAndClose(() => onZoom(0.1))}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 text-xs font-medium text-slate-700 hover:bg-white"
            >
              <ZoomIn className="h-3 w-3" />
              <span>+</span>
            </button>
            <button
              type="button"
              title="Zoom Out"
              onClick={() => runAndClose(() => onZoom(-0.1))}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 text-xs font-medium text-slate-700 hover:bg-white"
            >
              <ZoomOut className="h-3 w-3" />
              <span>-</span>
            </button>
            <button
              type="button"
              title="Reset Zoom to 100%"
              onClick={() => runAndClose(onResetZoom)}
              className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 py-1 text-[11px] font-medium text-slate-700 hover:bg-white"
            >
              100%
            </button>
          </div>
        </>
      )}
    </div>
  );
};
