import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Group,
  Link2,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { DEVICE_DIMENSIONS, getStencilByType } from '../data/presets';
import {
  DevicePreset,
  FillTone,
  ScreenFrame,
  SketchStyle,
  WireframeWidget,
} from '../types/wireframe';

interface InspectorPanelProps {
  activeScreen: ScreenFrame;
  allScreens: ScreenFrame[];
  selectedWidgets: WireframeWidget[];
  sketchStyle: SketchStyle;
  showAnnotations: boolean;
  onUpdateScreen: (patch: Partial<ScreenFrame>) => void;
  onChangeDevice: (device: DevicePreset) => void;
  onChangeSketchStyle: (style: SketchStyle) => void;
  onToggleAnnotations: () => void;
  onUpdateWidget: (id: string, patch: Partial<WireframeWidget>) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onLayerAction: (id: string, action: 'front' | 'back' | 'forward' | 'backward') => void;
  onAlignSelected: (
    mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  ) => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onUpdateGroupBounds: (
    groupId: string,
    patch: Partial<{ x: number; y: number; w: number; h: number }>
  ) => void;
  onToggleGroupLock: (groupId: string, locked: boolean) => void;
  onGroupLayerAction: (groupId: string, action: 'front' | 'back') => void;
  onSelectSingleWidget: (id: string) => void;
}

const FILL_OPTIONS: Array<{ value: FillTone; label: string; swatchClass: string }> = [
  { value: 'white', label: 'White', swatchClass: 'bg-white border-slate-300' },
  { value: 'muted', label: 'Ash', swatchClass: 'bg-slate-200 border-slate-300' },
  {
    value: 'hatch',
    label: 'Hatch',
    swatchClass:
      'bg-[repeating-linear-gradient(-45deg,#cbd5e1,#cbd5e1_2px,#f8fafc_2px,#f8fafc_6px)] border-slate-300',
  },
  { value: 'dark', label: 'Ink', swatchClass: 'bg-slate-800 border-slate-900' },
  {
    value: 'transparent',
    label: 'None',
    swatchClass: 'bg-transparent border-dashed border-slate-400',
  },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activeScreen,
  allScreens,
  selectedWidgets,
  sketchStyle,
  showAnnotations,
  onUpdateScreen,
  onChangeDevice,
  onChangeSketchStyle,
  onToggleAnnotations,
  onUpdateWidget,
  onDeleteSelected,
  onDuplicateSelected,
  onLayerAction,
  onAlignSelected,
  onGroupSelected,
  onUngroupSelected,
  onUpdateGroupBounds,
  onToggleGroupLock,
  onGroupLayerAction,
  onSelectSingleWidget,
}) => {
  const sharedGroupId =
    selectedWidgets.length > 1 &&
    selectedWidgets[0].groupId &&
    selectedWidgets.every((w) => w.groupId === selectedWidgets[0].groupId)
      ? selectedWidgets[0].groupId
      : null;

  // Bound Group Inspector (single cohesive group entity selected)
  if (sharedGroupId) {
    const isLocked = selectedWidgets.some((w) => w.locked);
    const minX = Math.min(...selectedWidgets.map((w) => w.x));
    const minY = Math.min(...selectedWidgets.map((w) => w.y));
    const maxX = Math.max(...selectedWidgets.map((w) => w.x + w.w));
    const maxY = Math.max(...selectedWidgets.map((w) => w.y + w.h));
    const groupW = Math.max(1, maxX - minX);
    const groupH = Math.max(1, maxY - minY);

    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">Bound Group</div>
            <div className="truncate text-sm font-semibold text-slate-900">
              Group · {selectedWidgets.length} items
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleGroupLock(sharedGroupId, !isLocked)}
              title={isLocked ? 'Unlock group' : 'Lock group'}
              className={`rounded-md p-1.5 transition-colors ${
                isLocked
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onDuplicateSelected}
              title="Duplicate Group (Ctrl/Cmd+D)"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              title="Delete Group (Backspace)"
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <button
            type="button"
            onClick={onUngroupSelected}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap"
          >
            <Ungroup className="h-3.5 w-3.5" />
            <span>Ungroup Elements</span>
          </button>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Group Position &amp; Scale
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['x', 'X', minX],
                  ['y', 'Y', minY],
                  ['w', 'W', groupW],
                  ['h', 'H', groupH],
                ] as const
              ).map(([field, label, val]) => (
                <div key={field} className="relative">
                  <span className="pointer-events-none absolute top-1.5 left-2 text-[10px] font-medium text-slate-400">
                    {label}
                  </span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={Math.round(val)}
                    onChange={(e) => {
                      const num = Number(e.target.value) || 0;
                      onUpdateGroupBounds(sharedGroupId, { [field]: num });
                    }}
                    className="font-mono-tabular w-full rounded-md border border-slate-200 bg-slate-50 pt-4 pr-1.5 pb-1 pl-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Drag corner handles on the canvas or edit W/H to scale all grouped items proportionally.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Group Layer Order
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onGroupLayerAction(sharedGroupId, 'front')}
                className="flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <ArrowUpToLine className="h-3.5 w-3.5" />
                <span>Bring to Front</span>
              </button>
              <button
                type="button"
                onClick={() => onGroupLayerAction(sharedGroupId, 'back')}
                className="flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                <span>Send to Back</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Group Members (click to inspect)
            </label>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {selectedWidgets.map((member) => {
                const mStencil = getStencilByType(member.type);
                const summary = member.text || member.subtext || mStencil.label;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onSelectSingleWidget(member.id)}
                    className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:border-blue-600 hover:bg-blue-50/40"
                  >
                    <span className="truncate font-medium">{mStencil.label}</span>
                    <span className="ml-2 max-w-[110px] truncate text-[11px] text-slate-400">
                      {summary}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Tip: Double-click any item on the canvas (or select a member above) to edit its text without ungrouping.
          </div>
        </div>
      </aside>
    );
  }

  // Multi-select inspector (ungrouped or multiple groups selected)
  if (selectedWidgets.length > 1) {
    const hasLocked = selectedWidgets.some((w) => w.locked);
    const hasAnyGrouped = selectedWidgets.some((w) => Boolean(w.groupId));
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-xs font-medium text-slate-500">Multi-Selection</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {selectedWidgets.length} widgets selected
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto p-4">
          <div className="space-y-2">
            <button
              type="button"
              disabled={hasLocked}
              onClick={onGroupSelected}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
            >
              <Group className="h-3.5 w-3.5" />
              <span>Group Selection</span>
            </button>
            {hasAnyGrouped && (
              <button
                type="button"
                onClick={onUngroupSelected}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
              >
                <Ungroup className="h-3.5 w-3.5" />
                <span>Ungroup All Selected</span>
              </button>
            )}
            {hasLocked && (
              <p className="text-xs text-amber-700">
                Unlock locked frames before binding into a group.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">
              Align Elements
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['left', 'Left'],
                  ['center', 'Center'],
                  ['right', 'Right'],
                  ['top', 'Top'],
                  ['middle', 'Middle'],
                  ['bottom', 'Bottom'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onAlignSelected(mode)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onDuplicateSelected}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Screen-level inspector when nothing is selected
  if (selectedWidgets.length === 0) {
    const linkedCount = activeScreen.widgets.filter((w) => Boolean(w.linkToScreenId)).length;
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-xs font-medium text-slate-500">Artboard Properties</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
            {activeScreen.name}
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Screen Name
            </label>
            <input
              type="text"
              value={activeScreen.name}
              onChange={(e) => onUpdateScreen({ name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Viewport Size Preset
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(['desktop', 'tablet', 'mobile'] as DevicePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeDevice(preset)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                    activeScreen.device === preset
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-xs text-slate-500">Width (px)</span>
                <input
                  type="number"
                  min={280}
                  max={2400}
                  value={activeScreen.width}
                  onChange={(e) =>
                    onUpdateScreen({
                      width: Math.max(280, Math.min(2400, Number(e.target.value) || 320)),
                    })
                  }
                  className="font-mono-tabular w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-slate-500">Height (px)</span>
                <input
                  type="number"
                  min={320}
                  max={3200}
                  value={activeScreen.height}
                  onChange={(e) =>
                    onUpdateScreen({
                      height: Math.max(320, Math.min(3200, Number(e.target.value) || 480)),
                    })
                  }
                  className="font-mono-tabular w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {DEVICE_DIMENSIONS[activeScreen.device].label}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Line Aesthetics
            </label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => onChangeSketchStyle('hand')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sketchStyle === 'hand'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hand Sketch
              </button>
              <button
                type="button"
                onClick={() => onChangeSketchStyle('clean')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sketchStyle === 'clean'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Crisp Wire
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <div className="text-xs font-medium text-slate-700">UX Sticky Notes</div>
              <div className="text-xs text-slate-500">Show notes &amp; callout pins</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showAnnotations}
              onClick={onToggleAnnotations}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                showAnnotations ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                  showAnnotations ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-mono-tabular">
              <span>{activeScreen.widgets.length} elements</span>
              <span aria-hidden="true">·</span>
              <span>{linkedCount} prototype links</span>
            </div>
            <p className="mt-2 leading-relaxed text-slate-500">
              Tip: Select multiple widgets and press{' '}
              <kbd className="font-mono-tabular rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-slate-700">
                Ctrl/Cmd+G
              </kbd>{' '}
              to group and scale them together.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // Single selected widget inspector
  const w = selectedWidgets[0];
  const stencil = getStencilByType(w.type);
  const isMultilineContent =
    w.type === 'checkbox' ||
    w.type === 'table' ||
    w.type === 'paragraph' ||
    w.type === 'note';

  const hasSubtext =
    w.type === 'browser' ||
    w.type === 'input' ||
    w.type === 'modal' ||
    w.type === 'box' ||
    w.type === 'navbar';

  const subtextLabel =
    w.type === 'browser'
      ? 'Address Bar URL'
      : w.type === 'input'
      ? 'Placeholder Text'
      : w.type === 'navbar'
      ? 'Navigation Links (comma-separated)'
      : w.type === 'modal'
      ? 'Background Body Copy (optional)'
      : 'Secondary Text';

  const tabItems =
    w.type === 'tabs'
      ? w.text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : w.type === 'navbar'
      ? (w.subtext || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{stencil.category}</div>
          <div className="truncate text-sm font-semibold text-slate-900">{stencil.label}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateWidget(w.id, { locked: !w.locked })}
            title={w.locked ? 'Unlock position' : 'Lock position'}
            className={`rounded-md p-1.5 transition-colors ${
              w.locked
                ? 'bg-amber-50 text-amber-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {w.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onDuplicateSelected}
            title="Duplicate (Ctrl/Cmd+D)"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDeleteSelected}
            title="Delete (Backspace)"
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        {/* Geometry */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Position &amp; Size
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['x', 'X', w.x],
                ['y', 'Y', w.y],
                ['w', 'W', w.w],
                ['h', 'H', w.h],
              ] as const
            ).map(([field, label, val]) => (
              <div key={field} className="relative">
                <span className="pointer-events-none absolute top-1.5 left-2 text-[10px] font-medium text-slate-400">
                  {label}
                </span>
                <input
                  type="number"
                  disabled={w.locked}
                  value={Math.round(val)}
                  onChange={(e) => {
                    const num = Number(e.target.value) || 0;
                    if (field === 'w') {
                      onUpdateWidget(w.id, { w: Math.max(stencil.minW, num) });
                    } else if (field === 'h') {
                      onUpdateWidget(w.id, { h: Math.max(stencil.minH, num) });
                    } else {
                      onUpdateWidget(w.id, { [field]: num });
                    }
                  }}
                  className="font-mono-tabular w-full rounded-md border border-slate-200 bg-slate-50 pt-4 pr-1.5 pb-1 pl-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content Editor */}
        {w.type !== 'divider' &&
          w.type !== 'mobile' &&
          w.type !== 'arrow' &&
          w.type !== 'vscrollbar' &&
          w.type !== 'hscrollbar' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {w.type === 'table'
                ? 'Table Rows (CSV lines)'
                : w.type === 'checkbox'
                ? 'Checklist Items ([x] or [ ])'
                : w.type === 'tabs'
                ? 'Tabs (comma-separated)'
                : w.type === 'modal'
                ? 'Modal Header Title'
                : 'Label / Content'}
            </label>
            {isMultilineContent ? (
              <textarea
                rows={w.type === 'table' ? 5 : 4}
                value={w.text}
                onChange={(e) => onUpdateWidget(w.id, { text: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            ) : (
              <input
                type="text"
                value={w.text}
                onChange={(e) => onUpdateWidget(w.id, { text: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            )}
          </div>
        )}

        {hasSubtext && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-600">
                {subtextLabel}
              </label>
              {w.subtext && (
                <button
                  type="button"
                  onClick={() => onUpdateWidget(w.id, { subtext: '' })}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="text"
              value={w.subtext || ''}
              placeholder={w.type === 'modal' ? 'Leave empty for blank dialog body' : ''}
              onChange={(e) => onUpdateWidget(w.id, { subtext: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        )}

        {/* Paragraph Scribble Toggle */}
        {w.type === 'paragraph' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Copy Representation
            </label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => onUpdateWidget(w.id, { scribble: false })}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  !w.scribble
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Readable Text
              </button>
              <button
                type="button"
                onClick={() => onUpdateWidget(w.id, { scribble: true })}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  w.scribble
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Line Scribble
              </button>
            </div>
          </div>
        )}

        {/* Active Tab / Nav Link Selector */}
        {tabItems.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Active Item
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tabItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onUpdateWidget(w.id, { activeIndex: idx })}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    (w.activeIndex ?? 0) === idx
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Arrow Direction */}
        {w.type === 'arrow' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Arrow Direction
            </label>
            <div className="grid grid-cols-6 gap-1">
              {(
                [
                  ['right', '→'],
                  ['left', '←'],
                  ['down', '↓'],
                  ['up', '↑'],
                  ['diag-down', '↘'],
                  ['diag-up', '↗'],
                ] as const
              ).map(([dir, sym]) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => onUpdateWidget(w.id, { direction: dir })}
                  className={`rounded-md border py-1.5 text-sm font-semibold transition-colors ${
                    (w.direction || 'right') === dir
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollbar Orientation & Thumb Position */}
        {(w.type === 'vscrollbar' || w.type === 'hscrollbar') && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Orientation
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (w.type !== 'vscrollbar') {
                      onUpdateWidget(w.id, {
                        type: 'vscrollbar',
                        w: Math.max(14, Math.min(48, w.h)),
                        h: Math.max(64, w.w),
                      });
                    }
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    w.type === 'vscrollbar'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vertical
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (w.type !== 'hscrollbar') {
                      onUpdateWidget(w.id, {
                        type: 'hscrollbar',
                        w: Math.max(64, w.h),
                        h: Math.max(14, Math.min(48, w.w)),
                      });
                    }
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    w.type === 'hscrollbar'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Horizontal
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">Scroll Thumb Position</span>
                <span className="font-mono-tabular text-slate-500">
                  {Math.round(w.scrollPos ?? 20)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={w.scrollPos ?? 20}
                onChange={(e) =>
                  onUpdateWidget(w.id, { scrollPos: Number(e.target.value) })
                }
                className="w-full accent-blue-600"
              />
            </div>
          </div>
        )}

        {/* Heading / Box Alignment & Size */}
        {(w.type === 'heading' || w.type === 'box') && (
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Alignment
              </label>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(
                  [
                    ['left', AlignLeft],
                    ['center', AlignCenter],
                    ['right', AlignRight],
                  ] as const
                ).map(([al, Icon]) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => onUpdateWidget(w.id, { align: al })}
                    className={`rounded-md p-1.5 transition-colors ${
                      (w.align || 'left') === al
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {w.type === 'heading' && (
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Scale
                </label>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-0.5">
                  {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onUpdateWidget(w.id, { fontSize: sz })}
                      className={`rounded-md py-1 text-xs font-medium uppercase transition-colors ${
                        (w.fontSize || 'xl') === sz
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {w.type === 'box' && (
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="box-border-toggle"
                  type="checkbox"
                  checked={w.bordered !== false}
                  onChange={(e) => onUpdateWidget(w.id, { bordered: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="box-border-toggle" className="text-xs font-medium text-slate-700">
                  Border
                </label>
              </div>
            )}
          </div>
        )}

        {/* Low-Fi Paper Tone */}
        {w.type !== 'note' &&
          w.type !== 'callout' &&
          w.type !== 'divider' &&
          w.type !== 'arrow' &&
          w.type !== 'heading' &&
          w.type !== 'paragraph' &&
          w.type !== 'checkbox' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Paper Tone
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {FILL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdateWidget(w.id, { fill: opt.value })}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                      w.fill === opt.value
                        ? 'border-blue-600 bg-blue-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-4 w-6 rounded-xs border ${opt.swatchClass}`} />
                    <span className="text-[10px] font-medium text-slate-600">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Disabled control toggle */}
        {(w.type === 'button' ||
          w.type === 'input' ||
          w.type === 'select' ||
          w.type === 'search' ||
          w.type === 'vscrollbar' ||
          w.type === 'hscrollbar') && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-slate-600">Disabled State</span>
            <input
              type="checkbox"
              checked={Boolean(w.disabled)}
              onChange={(e) => onUpdateWidget(w.id, { disabled: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
          </div>
        )}

        {/* Layering */}
        <div className="border-t border-slate-100 pt-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Layer Order
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onLayerAction(w.id, 'front')}
              className="flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" />
              <span>Bring to Front</span>
            </button>
            <button
              type="button"
              onClick={() => onLayerAction(w.id, 'back')}
              className="flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span>Send to Back</span>
            </button>
          </div>
        </div>

        {/* Interactive Prototype Screen Link */}
        <div className="border-t border-slate-100 pt-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <Link2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Prototype Click Target</span>
          </label>
          <select
            value={w.linkToScreenId || ''}
            onChange={(e) =>
              onUpdateWidget(w.id, { linkToScreenId: e.target.value || undefined })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            <option value="">No screen link</option>
            {allScreens
              .filter((s) => s.id !== activeScreen.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  Go to: {s.name}
                </option>
              ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-400">
            Linked widgets navigate between screens in Present Prototype mode.
          </p>
        </div>
      </div>
    </aside>
  );
};
