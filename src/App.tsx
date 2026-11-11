import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  Grid,
  Group,
  Italic,
  Link2,
  Minus,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Search,
  StickyNote,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Ungroup,
  X,
} from 'lucide-react';
import { applyFormatToInput } from './utils/textMarkup';
import { InspectorPanel } from './components/InspectorPanel';
import { ExportModal, ShortcutsModal, TemplatesModal } from './components/Modals';
import { QuickAddPalette } from './components/QuickAddPalette';
import { SketchWidgetSvg } from './components/SketchWidgetSvg';
import { StencilIcon } from './components/StencilIcon';
import {
  DEVICE_DIMENSIONS,
  STARTER_TEMPLATES,
  STENCIL_LIBRARY,
  getStencilByType,
} from './data/presets';
import {
  AlignmentGuide,
  DevicePreset,
  ProjectData,
  ScreenFrame,
  SketchStyle,
  WidgetCategory,
  WidgetType,
  WireframeWidget,
} from './types/wireframe';

const STORAGE_KEY = 'roughdraft_wireframe_project_v1';
const MAX_HISTORY = 45;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragInteraction {
  mode: 'move' | 'resize' | 'marquee' | 'pan';
  startClientX: number;
  startClientY: number;
  startCanvasX: number;
  startCanvasY: number;
  handle?: ResizeHandle;
  initialProject: ProjectData;
  initialBounds?: RectBox;
  initialWidgets: Record<string, RectBox>;
  initialPan?: { x: number; y: number };
  hasMoved: boolean;
}

function makeId(prefix = 'w'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function computeUnionBounds(items: RectBox[]): RectBox {
  if (items.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.w));
  const maxY = Math.max(...items.map((i) => i.y + i.h));
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

function scaleChildInBounds(
  initChild: RectBox,
  initBounds: RectBox,
  nextBounds: RectBox,
  minW: number,
  minH: number
): RectBox {
  const relX = initBounds.w > 0 ? (initChild.x - initBounds.x) / initBounds.w : 0;
  const relY = initBounds.h > 0 ? (initChild.y - initBounds.y) / initBounds.h : 0;
  const relW = initBounds.w > 0 ? initChild.w / initBounds.w : 1;
  const relH = initBounds.h > 0 ? initChild.h / initBounds.h : 1;

  const effectiveMinW = Math.min(minW, nextBounds.w);
  const effectiveMinH = Math.min(minH, nextBounds.h);

  const w = Math.max(effectiveMinW, Math.round(relW * nextBounds.w));
  const h = Math.max(effectiveMinH, Math.round(relH * nextBounds.h));

  const rawX = Math.round(nextBounds.x + relX * nextBounds.w);
  const rawY = Math.round(nextBounds.y + relY * nextBounds.h);

  const x = Math.min(nextBounds.x + nextBounds.w - w, Math.max(nextBounds.x, rawX));
  const y = Math.min(nextBounds.y + nextBounds.h - h, Math.max(nextBounds.y, rawY));

  return { x, y, w, h };
}

function loadInitialProject(): ProjectData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectData;
      if (parsed && Array.isArray(parsed.screens) && parsed.screens.length > 0) {
        return {
          ...parsed,
          screens: parsed.screens.map((scr) => ({
            ...scr,
            widgets: scr.widgets.map((w) =>
              w.type === 'modal' &&
              w.subtext === 'Are you sure you want to archive this workspace?'
                ? { ...w, subtext: '' }
                : w
            ),
          })),
        };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return STARTER_TEMPLATES[0].build();
}

export default function App() {
  const [project, setProject] = useState<ProjectData>(loadInitialProject);
  const [past, setPast] = useState<ProjectData[]>([]);
  const [future, setFuture] = useState<ProjectData[]>([]);

  const [activeScreenId, setActiveScreenId] = useState<string>(
    () => loadInitialProject().screens[0]?.id || ''
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'text' | 'subtext'>('text');
  const [editingDraft, setEditingDraft] = useState<string>('');

  // Left palette state
  const [stencilCategory, setStencilCategory] = useState<'All' | WidgetCategory>('All');
  const [stencilQuery, setStencilQuery] = useState('');

  // Canvas viewport state
  const [zoom, setZoom] = useState<number>(0.9);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<RectBox | null>(null);

  // Modes & dialogs
  const [isPresentMode, setIsPresentMode] = useState(false);
  const [showHotspotHint, setShowHotspotHint] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const mainViewportRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const interactionRef = useRef<DragInteraction | null>(null);
  const inlineInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Ensure activeScreenId always resolves to an existing screen
  const activeScreen = useMemo<ScreenFrame>(() => {
    return (
      project.screens.find((s) => s.id === activeScreenId) || project.screens[0]
    );
  }, [project.screens, activeScreenId]);

  useEffect(() => {
    if (!project.screens.some((s) => s.id === activeScreenId) && project.screens[0]) {
      setActiveScreenId(project.screens[0].id);
    }
  }, [project.screens, activeScreenId]);

  const centerCanvasScroll = useCallback(() => {
    const el = mainViewportRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / 2));
    el.scrollTop = Math.max(0, Math.round((el.scrollHeight - el.clientHeight) / 2));
  }, []);

  useEffect(() => {
    requestAnimationFrame(centerCanvasScroll);
  }, [activeScreen.id, centerCanvasScroll]);

  // Autosave to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // Ignore quota issues
    }
  }, [project]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Commit state mutation with Undo history
  const commitProject = useCallback(
    (updater: ProjectData | ((prev: ProjectData) => ProjectData)) => {
      setProject((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next === prev) return prev;
        setPast((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
        setFuture([]);
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setProject((current) => {
        setFuture((f) => [current, ...f]);
        return previous;
      });
      setSelectedIds([]);
      setEditingWidgetId(null);
      return prevPast.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const [next, ...rest] = prevFuture;
      setProject((current) => {
        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), current]);
        return next;
      });
      setSelectedIds([]);
      setEditingWidgetId(null);
      return rest;
    });
  }, []);

  // Visible widgets on current screen
  const visibleWidgets = useMemo(() => {
    if (project.showAnnotations) return activeScreen.widgets;
    return activeScreen.widgets.filter((w) => w.type !== 'note' && w.type !== 'callout');
  }, [activeScreen.widgets, project.showAnnotations]);

  // Helper to expand any widget IDs so bound group siblings are selected together
  const expandGroupSelection = useCallback(
    (candidateIds: string[]): string[] => {
      const idSet = new Set(candidateIds);
      const groupIds = new Set<string>();
      for (const w of visibleWidgets) {
        if (idSet.has(w.id) && w.groupId) {
          groupIds.add(w.groupId);
        }
      }
      if (groupIds.size === 0) return Array.from(idSet);
      for (const w of visibleWidgets) {
        if (w.groupId && groupIds.has(w.groupId)) {
          idSet.add(w.id);
        }
      }
      return Array.from(idSet);
    },
    [visibleWidgets]
  );

  const selectedWidgets = useMemo(
    () => visibleWidgets.filter((w) => selectedIds.includes(w.id)),
    [visibleWidgets, selectedIds]
  );

  // Detect whether current selection is one cohesive bound group
  const activeSelectedGroupId = useMemo<string | null>(() => {
    if (
      selectedWidgets.length > 1 &&
      selectedWidgets[0].groupId &&
      selectedWidgets.every((w) => w.groupId === selectedWidgets[0].groupId)
    ) {
      return selectedWidgets[0].groupId;
    }
    return null;
  }, [selectedWidgets]);

  const canGroup = useMemo(() => {
    return (
      selectedWidgets.length >= 2 &&
      !selectedWidgets.some((w) => w.locked) &&
      !activeSelectedGroupId
    );
  }, [activeSelectedGroupId, selectedWidgets]);

  const canUngroup = useMemo(() => {
    return selectedWidgets.some((w) => Boolean(w.groupId));
  }, [selectedWidgets]);

  // Convert client mouse coords into artboard SVG coordinates
  const clientToArtboard = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svgEl = svgRef.current;
      if (!svgEl) return { x: 0, y: 0 };
      const rect = svgEl.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      };
    },
    [zoom]
  );

  // Add a new stencil widget to the active screen
  const addStencilToScreen = useCallback(
    (type: WidgetType, customPos?: { x: number; y: number }) => {
      const stencil = getStencilByType(type);
      const countOffset = (activeScreen.widgets.length % 6) * 16;
      const rawX =
        customPos?.x ??
        Math.round((activeScreen.width - stencil.defaultW) / 2) + countOffset - 24;
      const rawY =
        customPos?.y ??
        Math.round((activeScreen.height - stencil.defaultH) / 2) + countOffset - 24;

      const snap = project.snapToGrid ? 8 : 1;
      const x = Math.max(
        8,
        Math.min(
          activeScreen.width - stencil.defaultW - 8,
          Math.round(rawX / snap) * snap
        )
      );
      const y = Math.max(
        8,
        Math.min(
          activeScreen.height - stencil.defaultH - 8,
          Math.round(rawY / snap) * snap
        )
      );

      let defaultText = stencil.defaultProps.text ?? '';
      if (type === 'callout') {
        const calloutCount = activeScreen.widgets.filter((w) => w.type === 'callout').length;
        defaultText = String(calloutCount + 1);
      }

      const newWidget: WireframeWidget = {
        id: makeId('w'),
        type,
        x,
        y,
        w: stencil.defaultW,
        h: stencil.defaultH,
        text: defaultText,
        subtext: stencil.defaultProps.subtext,
        fill: stencil.defaultProps.fill || 'white',
        bordered: stencil.defaultProps.bordered,
        activeIndex: stencil.defaultProps.activeIndex,
        scribble: stencil.defaultProps.scribble,
        align: stencil.defaultProps.align,
        fontSize: stencil.defaultProps.fontSize,
        direction: stencil.defaultProps.direction,
        scrollPos: stencil.defaultProps.scrollPos,
      };

      commitProject((prev) => ({
        ...prev,
        showAnnotations:
          type === 'note' || type === 'callout' ? true : prev.showAnnotations,
        screens: prev.screens.map((s) =>
          s.id === activeScreen.id ? { ...s, widgets: [...s.widgets, newWidget] } : s
        ),
      }));

      setSelectedIds([newWidget.id]);
      setEditingWidgetId(null);
    },
    [activeScreen, commitProject, project.snapToGrid]
  );

  // Update single widget
  const updateWidget = useCallback(
    (widgetId: string, patch: Partial<WireframeWidget>) => {
      commitProject((prev) => ({
        ...prev,
        screens: prev.screens.map((s) =>
          s.id === activeScreen.id
            ? {
                ...s,
                widgets: s.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)),
              }
            : s
        ),
      }));
    },
    [activeScreen.id, commitProject]
  );

  // Group selected widgets into a single bound entity
  const handleGroupSelected = useCallback(() => {
    if (selectedWidgets.length < 2 || selectedWidgets.some((w) => w.locked)) return;
    const newGroupId = makeId('grp');
    const selectedSet = new Set(selectedIds);

    commitProject((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => {
        if (s.id !== activeScreen.id) return s;
        // Consolidate grouped members at the z-position of the topmost selected member
        // while preserving their internal stacking order
        let highestSelectedIndex = -1;
        s.widgets.forEach((w, idx) => {
          if (selectedSet.has(w.id)) highestSelectedIndex = idx;
        });

        if (highestSelectedIndex === -1) return s;

        const before: WireframeWidget[] = [];
        const groupedMembers: WireframeWidget[] = [];
        const after: WireframeWidget[] = [];

        s.widgets.forEach((w, idx) => {
          if (selectedSet.has(w.id)) {
            groupedMembers.push({ ...w, groupId: newGroupId });
          } else if (idx < highestSelectedIndex) {
            before.push(w);
          } else {
            after.push(w);
          }
        });

        return {
          ...s,
          widgets: [...before, ...groupedMembers, ...after],
        };
      }),
    }));

    showToast(`Grouped ${selectedWidgets.length} elements`);
  }, [activeScreen.id, commitProject, selectedIds, selectedWidgets, showToast]);

  // Ungroup selected group(s)
  const handleUngroupSelected = useCallback(() => {
    if (!selectedWidgets.some((w) => Boolean(w.groupId))) return;
    const selectedSet = new Set(selectedIds);
    commitProject((prev) => ({
      ...prev,
      screens: prev.screens.map((s) =>
        s.id === activeScreen.id
          ? {
              ...s,
              widgets: s.widgets.map((w) =>
                selectedSet.has(w.id) ? { ...w, groupId: undefined } : w
              ),
            }
          : s
      ),
    }));
    showToast('Ungrouped elements');
  }, [activeScreen.id, commitProject, selectedIds, selectedWidgets, showToast]);

  // Numeric group move / proportional scale from Inspector
  const handleUpdateGroupBounds = useCallback(
    (groupId: string, patch: Partial<RectBox>) => {
      commitProject((prev) => ({
        ...prev,
        screens: prev.screens.map((s) => {
          if (s.id !== activeScreen.id) return s;
          const members = s.widgets.filter((w) => w.groupId === groupId);
          if (members.length === 0 || members.some((w) => w.locked)) return s;

          const initBounds = computeUnionBounds(members);
          const nextBounds: RectBox = {
            x: patch.x !== undefined ? patch.x : initBounds.x,
            y: patch.y !== undefined ? patch.y : initBounds.y,
            w: patch.w !== undefined ? Math.max(48, patch.w) : initBounds.w,
            h: patch.h !== undefined ? Math.max(36, patch.h) : initBounds.h,
          };

          return {
            ...s,
            widgets: s.widgets.map((w) => {
              if (w.groupId !== groupId) return w;
              const stencil = getStencilByType(w.type);
              const scaled = scaleChildInBounds(
                { x: w.x, y: w.y, w: w.w, h: w.h },
                initBounds,
                nextBounds,
                stencil.minW,
                stencil.minH
              );
              return { ...w, ...scaled };
            }),
          };
        }),
      }));
    },
    [activeScreen.id, commitProject]
  );

  const handleToggleGroupLock = useCallback(
    (groupId: string, locked: boolean) => {
      commitProject((prev) => ({
        ...prev,
        screens: prev.screens.map((s) =>
          s.id === activeScreen.id
            ? {
                ...s,
                widgets: s.widgets.map((w) =>
                  w.groupId === groupId ? { ...w, locked } : w
                ),
              }
            : s
        ),
      }));
    },
    [activeScreen.id, commitProject]
  );

  const handleGroupLayerAction = useCallback(
    (groupId: string, action: 'front' | 'back') => {
      commitProject((prev) => ({
        ...prev,
        screens: prev.screens.map((s) => {
          if (s.id !== activeScreen.id) return s;
          const members = s.widgets.filter((w) => w.groupId === groupId);
          const others = s.widgets.filter((w) => w.groupId !== groupId);
          return {
            ...s,
            widgets: action === 'front' ? [...others, ...members] : [...members, ...others],
          };
        }),
      }));
    },
    [activeScreen.id, commitProject]
  );

  // Delete selected widgets
  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    commitProject((prev) => ({
      ...prev,
      screens: prev.screens.map((s) =>
        s.id === activeScreen.id
          ? { ...s, widgets: s.widgets.filter((w) => !selectedIds.includes(w.id)) }
          : s
      ),
    }));
    setSelectedIds([]);
    setEditingWidgetId(null);
  }, [activeScreen.id, commitProject, selectedIds]);

  // Duplicate selected widgets (preserving independent group bindings for cloned groups)
  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const createdIds: string[] = [];
    const clonedGroupIds = new Map<string, string>();

    commitProject((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => {
        if (s.id !== activeScreen.id) return s;
        const clones: WireframeWidget[] = [];
        for (const w of s.widgets) {
          if (selectedIds.includes(w.id)) {
            const nid = makeId('w');
            createdIds.push(nid);
            let nextGroupId: string | undefined;
            if (w.groupId) {
              if (!clonedGroupIds.has(w.groupId)) {
                clonedGroupIds.set(w.groupId, makeId('grp'));
              }
              nextGroupId = clonedGroupIds.get(w.groupId);
            }
            clones.push({
              ...w,
              id: nid,
              groupId: nextGroupId,
              x: Math.min(s.width - w.w, w.x + 20),
              y: Math.min(s.height - w.h, w.y + 20),
              locked: false,
            });
          }
        }
        return { ...s, widgets: [...s.widgets, ...clones] };
      }),
    }));
    setSelectedIds(createdIds);
  }, [activeScreen.id, commitProject, selectedIds]);

  // Layer ordering for single widget
  const handleLayerAction = useCallback(
    (widgetId: string, action: 'front' | 'back' | 'forward' | 'backward') => {
      commitProject((prev) => ({
        ...prev,
        screens: prev.screens.map((s) => {
          if (s.id !== activeScreen.id) return s;
          const idx = s.widgets.findIndex((w) => w.id === widgetId);
          if (idx === -1) return s;
          const list = [...s.widgets];
          const [item] = list.splice(idx, 1);
          if (action === 'front') list.push(item);
          else if (action === 'back') list.unshift(item);
          else if (action === 'forward') list.splice(Math.min(list.length, idx + 1), 0, item);
          else if (action === 'backward') list.splice(Math.max(0, idx - 1), 0, item);
          return { ...s, widgets: list };
        }),
      }));
    },
    [activeScreen.id, commitProject]
  );

  // Multi-select alignment (treats bound sub-groups as single units if multiple groups are aligned, or individual items if ungrouped)
  const handleAlignSelected = useCallback(
    (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (selectedIds.length < 2) return;
      commitProject((prev) => ({
        ...prev,
        screens: prev.screens.map((s) => {
          if (s.id !== activeScreen.id) return s;
          const targets = s.widgets.filter((w) => selectedIds.includes(w.id));
          if (targets.length < 2) return s;
          const minX = Math.min(...targets.map((t) => t.x));
          const maxX = Math.max(...targets.map((t) => t.x + t.w));
          const minY = Math.min(...targets.map((t) => t.y));
          const maxY = Math.max(...targets.map((t) => t.y + t.h));
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;

          // Build unit bounding boxes per groupId (or per ungrouped widget)
          const groupBounds = new Map<string, RectBox>();
          const groupedLists = new Map<string, WireframeWidget[]>();
          for (const t of targets) {
            if (t.groupId) {
              const list = groupedLists.get(t.groupId) || [];
              list.push(t);
              groupedLists.set(t.groupId, list);
            }
          }
          groupedLists.forEach((members, gid) => {
            groupBounds.set(gid, computeUnionBounds(members));
          });

          return {
            ...s,
            widgets: s.widgets.map((w) => {
              if (!selectedIds.includes(w.id) || w.locked) return w;
              if (w.groupId && groupBounds.has(w.groupId)) {
                const gb = groupBounds.get(w.groupId)!;
                let dx = 0;
                let dy = 0;
                if (mode === 'left') dx = minX - gb.x;
                else if (mode === 'center') dx = Math.round(midX - gb.w / 2) - gb.x;
                else if (mode === 'right') dx = maxX - gb.w - gb.x;
                else if (mode === 'top') dy = minY - gb.y;
                else if (mode === 'middle') dy = Math.round(midY - gb.h / 2) - gb.y;
                else if (mode === 'bottom') dy = maxY - gb.h - gb.y;
                return { ...w, x: w.x + dx, y: w.y + dy };
              }

              if (mode === 'left') return { ...w, x: minX };
              if (mode === 'center') return { ...w, x: Math.round(midX - w.w / 2) };
              if (mode === 'right') return { ...w, x: maxX - w.w };
              if (mode === 'top') return { ...w, y: minY };
              if (mode === 'middle') return { ...w, y: Math.round(midY - w.h / 2) };
              if (mode === 'bottom') return { ...w, y: maxY - w.h };
              return w;
            }),
          };
        }),
      }));
    },
    [activeScreen.id, commitProject, selectedIds]
  );

  // Screen CRUD
  const handleAddScreen = () => {
    const nextIdx = project.screens.length + 1;
    const dims = DEVICE_DIMENSIONS[activeScreen.device];
    const newScreen: ScreenFrame = {
      id: makeId('scr'),
      name: `${nextIdx}. New Screen`,
      device: activeScreen.device,
      width: dims.width,
      height: dims.height,
      widgets: [],
    };
    commitProject((prev) => ({
      ...prev,
      screens: [...prev.screens, newScreen],
    }));
    setActiveScreenId(newScreen.id);
    setSelectedIds([]);
  };

  const handleDuplicateScreen = (screen: ScreenFrame) => {
    const groupMap = new Map<string, string>();
    const copy: ScreenFrame = {
      ...screen,
      id: makeId('scr'),
      name: `${screen.name} Copy`,
      widgets: screen.widgets.map((w) => {
        let nextGid: string | undefined;
        if (w.groupId) {
          if (!groupMap.has(w.groupId)) groupMap.set(w.groupId, makeId('grp'));
          nextGid = groupMap.get(w.groupId);
        }
        return { ...w, id: makeId('w'), groupId: nextGid };
      }),
    };
    commitProject((prev) => ({
      ...prev,
      screens: [...prev.screens, copy],
    }));
    setActiveScreenId(copy.id);
    setSelectedIds([]);
  };

  const handleDeleteScreen = (screenId: string) => {
    if (project.screens.length <= 1) return;
    const remaining = project.screens.filter((s) => s.id !== screenId);
    commitProject((prev) => ({
      ...prev,
      screens: remaining.map((s) => ({
        ...s,
        widgets: s.widgets.map((w) =>
          w.linkToScreenId === screenId ? { ...w, linkToScreenId: undefined } : w
        ),
      })),
    }));
    if (activeScreenId === screenId && remaining[0]) {
      setActiveScreenId(remaining[0].id);
    }
    setSelectedIds([]);
  };

  // Inline Double-Click Editing (zone-aware for header vs body/placeholder/links)
  const startInlineEdit = (
    widget: WireframeWidget,
    clickPoint?: { x: number; y: number }
  ) => {
    if (widget.type === 'vscrollbar' || widget.type === 'hscrollbar') {
      const cur = widget.scrollPos ?? 20;
      const next = cur < 40 ? 50 : cur < 90 ? 100 : 0;
      updateWidget(widget.id, { scrollPos: next });
      return;
    }
    if (widget.type === 'divider' || widget.type === 'mobile' || widget.type === 'arrow') {
      return;
    }

    let field: 'text' | 'subtext' = 'text';
    if (widget.type === 'browser') {
      field = 'subtext';
    } else if (widget.type === 'modal' && clickPoint && clickPoint.y > widget.y + 44) {
      field = 'subtext';
    } else if (
      widget.type === 'input' &&
      clickPoint &&
      widget.h >= 52 &&
      clickPoint.y > widget.y + 22
    ) {
      field = 'subtext';
    } else if (widget.type === 'navbar' && clickPoint && clickPoint.x > widget.x + 180) {
      field = 'subtext';
    } else if (
      widget.type === 'box' &&
      widget.subtext &&
      clickPoint &&
      clickPoint.y > widget.y + widget.h / 2
    ) {
      field = 'subtext';
    }

    setEditingWidgetId(widget.id);
    setEditingField(field);
    setEditingDraft(
      field === 'subtext'
        ? widget.subtext !== undefined
          ? widget.subtext
          : widget.type === 'browser'
          ? widget.text
          : ''
        : widget.text
    );
    requestAnimationFrame(() => {
      inlineInputRef.current?.focus();
      inlineInputRef.current?.select();
    });
  };

  const commitInlineEdit = useCallback(() => {
    if (!editingWidgetId) return;
    const target = activeScreen.widgets.find((w) => w.id === editingWidgetId);
    if (target) {
      if (editingField === 'subtext') {
        updateWidget(target.id, { subtext: editingDraft });
      } else {
        updateWidget(target.id, { text: editingDraft });
      }
    }
    setEditingWidgetId(null);
  }, [activeScreen.widgets, editingDraft, editingField, editingWidgetId, updateWidget]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isTyping =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        Boolean(editingWidgetId);

      if (e.code === 'Space' && !isTyping) {
        setIsSpaceHeld(true);
      }

      if (e.key === 'Escape') {
        if (editingWidgetId) {
          setEditingWidgetId(null);
          return;
        }
        if (isPresentMode) {
          setIsPresentMode(false);
          return;
        }
        setSelectedIds([]);
      }

      if (isTyping || isPresentMode || isQuickAddOpen) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === '/') {
        e.preventDefault();
        setIsQuickAddOpen(true);
        return;
      }

      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelected();
        } else {
          handleGroupSelected();
        }
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }

      if (e.key === ']' && selectedIds.length === 1) {
        e.preventDefault();
        handleLayerAction(selectedIds[0], 'forward');
        return;
      }

      if (e.key === '[' && selectedIds.length === 1) {
        e.preventDefault();
        handleLayerAction(selectedIds[0], 'backward');
        return;
      }

      // Arrow key nudging
      if (
        selectedIds.length > 0 &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 8 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commitProject((prev) => ({
          ...prev,
          screens: prev.screens.map((s) =>
            s.id === activeScreen.id
              ? {
                  ...s,
                  widgets: s.widgets.map((w) =>
                    selectedIds.includes(w.id) && !w.locked
                      ? { ...w, x: w.x + dx, y: w.y + dy }
                      : w
                  ),
                }
              : s
          ),
        }));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeScreen.id,
    commitProject,
    deleteSelected,
    duplicateSelected,
    editingWidgetId,
    handleGroupSelected,
    handleLayerAction,
    handleRedo,
    handleUndo,
    handleUngroupSelected,
    isPresentMode,
    isQuickAddOpen,
    selectedIds,
  ]);

  // Pointer drag, proportional resize, marquee, and pan handlers
  useEffect(() => {
    const onPointerMove = (e: MouseEvent) => {
      const drag = interactionRef.current;
      if (!drag) return;

      if (drag.mode === 'pan' && drag.initialPan && mainViewportRef.current) {
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        mainViewportRef.current.scrollLeft = drag.initialPan.x - dx;
        mainViewportRef.current.scrollTop = drag.initialPan.y - dy;
        return;
      }

      const pt = clientToArtboard(e.clientX, e.clientY);
      const dx = pt.x - drag.startCanvasX;
      const dy = pt.y - drag.startCanvasY;

      if (!drag.hasMoved && Math.hypot(dx, dy) < 2) return;
      drag.hasMoved = true;

      if (drag.mode === 'marquee') {
        const rx = Math.min(drag.startCanvasX, pt.x);
        const ry = Math.min(drag.startCanvasY, pt.y);
        const rw = Math.abs(pt.x - drag.startCanvasX);
        const rh = Math.abs(pt.y - drag.startCanvasY);
        setMarqueeRect({ x: rx, y: ry, w: rw, h: rh });

        const hits = visibleWidgets
          .filter(
            (w) =>
              !w.locked &&
              w.x < rx + rw &&
              w.x + w.w > rx &&
              w.y < ry + rh &&
              w.y + w.h > ry
          )
          .map((w) => w.id);
        setSelectedIds(expandGroupSelection(hits));
        return;
      }

      if (drag.mode === 'move') {
        const snap = project.snapToGrid ? 8 : 1;
        const movingIds = Object.keys(drag.initialWidgets);
        const movingSet = new Set(movingIds);
        const newGuides: AlignmentGuide[] = [];

        let adjDx = Math.round(dx / snap) * snap;
        let adjDy = Math.round(dy / snap) * snap;

        // Smart alignment guides using the unified bounding box of the moving widget or group
        if (movingIds.length >= 1) {
          const initUnion =
            drag.initialBounds ||
            computeUnionBounds(movingIds.map((id) => drag.initialWidgets[id]));
          const candX = initUnion.x + adjDx;
          const candY = initUnion.y + adjDy;
          const candMidX = candX + initUnion.w / 2;
          const candMidY = candY + initUnion.h / 2;
          const threshold = 5;

          if (Math.abs(candMidX - activeScreen.width / 2) <= threshold) {
            adjDx = activeScreen.width / 2 - initUnion.w / 2 - initUnion.x;
            newGuides.push({ orientation: 'vertical', position: activeScreen.width / 2 });
          }
          if (Math.abs(candMidY - activeScreen.height / 2) <= threshold) {
            adjDy = activeScreen.height / 2 - initUnion.h / 2 - initUnion.y;
            newGuides.push({ orientation: 'horizontal', position: activeScreen.height / 2 });
          }

          for (const sib of visibleWidgets) {
            if (movingSet.has(sib.id)) continue;
            if (newGuides.every((g) => g.orientation !== 'vertical')) {
              if (Math.abs(candX - sib.x) <= threshold) {
                adjDx = sib.x - initUnion.x;
                newGuides.push({ orientation: 'vertical', position: sib.x });
              } else if (Math.abs(candMidX - (sib.x + sib.w / 2)) <= threshold) {
                adjDx = sib.x + sib.w / 2 - initUnion.w / 2 - initUnion.x;
                newGuides.push({ orientation: 'vertical', position: sib.x + sib.w / 2 });
              } else if (Math.abs(candX + initUnion.w - (sib.x + sib.w)) <= threshold) {
                adjDx = sib.x + sib.w - initUnion.w - initUnion.x;
                newGuides.push({ orientation: 'vertical', position: sib.x + sib.w });
              }
            }

            if (newGuides.every((g) => g.orientation !== 'horizontal')) {
              if (Math.abs(candY - sib.y) <= threshold) {
                adjDy = sib.y - initUnion.y;
                newGuides.push({ orientation: 'horizontal', position: sib.y });
              } else if (Math.abs(candMidY - (sib.y + sib.h / 2)) <= threshold) {
                adjDy = sib.y + sib.h / 2 - initUnion.h / 2 - initUnion.y;
                newGuides.push({ orientation: 'horizontal', position: sib.y + sib.h / 2 });
              }
            }
          }
        }

        setGuides(newGuides);

        setProject((prev) => ({
          ...prev,
          screens: prev.screens.map((s) =>
            s.id === activeScreen.id
              ? {
                  ...s,
                  widgets: s.widgets.map((w) => {
                    const init = drag.initialWidgets[w.id];
                    if (!init || w.locked) return w;
                    return {
                      ...w,
                      x: Math.round(init.x + adjDx),
                      y: Math.round(init.y + adjDy),
                    };
                  }),
                }
              : s
          ),
        }));
      }

      if (drag.mode === 'resize' && drag.handle && drag.initialBounds) {
        const resizingIds = Object.keys(drag.initialWidgets);
        if (resizingIds.length === 0) return;

        const initB = drag.initialBounds;
        const isGroupResize = resizingIds.length > 1;
        let minBoxW = 48;
        let minBoxH = 36;

        if (!isGroupResize) {
          const singleWidget = activeScreen.widgets.find((w) => w.id === resizingIds[0]);
          if (singleWidget) {
            const stencil = getStencilByType(singleWidget.type);
            minBoxW = stencil.minW;
            minBoxH = stencil.minH;
          }
        }

        const snap = project.snapToGrid ? 8 : 1;
        const sdx = Math.round(dx / snap) * snap;
        const sdy = Math.round(dy / snap) * snap;

        let nx = initB.x;
        let ny = initB.y;
        let nw = initB.w;
        let nh = initB.h;

        if (drag.handle.includes('e')) {
          nw = Math.max(minBoxW, initB.w + sdx);
        }
        if (drag.handle.includes('s')) {
          nh = Math.max(minBoxH, initB.h + sdy);
        }
        if (drag.handle.includes('w')) {
          const possibleW = initB.w - sdx;
          if (possibleW >= minBoxW) {
            nw = possibleW;
            nx = initB.x + sdx;
          } else {
            nw = minBoxW;
            nx = initB.x + (initB.w - minBoxW);
          }
        }
        if (drag.handle.includes('n')) {
          const possibleH = initB.h - sdy;
          if (possibleH >= minBoxH) {
            nh = possibleH;
            ny = initB.y + sdy;
          } else {
            nh = minBoxH;
            ny = initB.y + (initB.h - minBoxH);
          }
        }

        const nextBounds: RectBox = { x: nx, y: ny, w: nw, h: nh };

        setProject((prev) => ({
          ...prev,
          screens: prev.screens.map((s) =>
            s.id === activeScreen.id
              ? {
                  ...s,
                  widgets: s.widgets.map((w) => {
                    const initChild = drag.initialWidgets[w.id];
                    if (!initChild || w.locked) return w;
                    if (!isGroupResize) {
                      return { ...w, ...nextBounds };
                    }
                    const stencil = getStencilByType(w.type);
                    const scaled = scaleChildInBounds(
                      initChild,
                      initB,
                      nextBounds,
                      stencil.minW,
                      stencil.minH
                    );
                    return { ...w, ...scaled };
                  }),
                }
              : s
          ),
        }));
      }
    };

    const onPointerUp = () => {
      const drag = interactionRef.current;
      if (!drag) return;
      if ((drag.mode === 'move' || drag.mode === 'resize') && drag.hasMoved) {
        setPast((h) => [...h.slice(-(MAX_HISTORY - 1)), drag.initialProject]);
        setFuture([]);
      }
      interactionRef.current = null;
      setGuides([]);
      setMarqueeRect(null);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [
    activeScreen,
    clientToArtboard,
    expandGroupSelection,
    project.snapToGrid,
    visibleWidgets,
  ]);

  // SVG / PNG / JSON Export helpers
  const buildCleanSvgMarkup = (): string | null => {
    const svgEl = svgRef.current;
    if (!svgEl) return null;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-editor-overlay="true"]').forEach((n) => n.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(activeScreen.width));
    clone.setAttribute('height', String(activeScreen.height));
    clone.setAttribute('viewBox', `0 0 ${activeScreen.width} ${activeScreen.height}`);
    return new XMLSerializer().serializeToString(clone);
  };

  const handleExportSvg = () => {
    const markup = buildCleanSvgMarkup();
    if (!markup) return;
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeScreen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported vector SVG wireframe');
  };

  const handleExportPng = () => {
    const markup = buildCleanSvgMarkup();
    if (!markup) return;
    const img = new Image();
    const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = activeScreen.width * scale;
      canvas.height = activeScreen.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${activeScreen.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
        a.click();
        showToast('Exported 2× PNG wireframe');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.roughdraft.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Saved project JSON file');
  };

  // Filtered stencils in left sidebar
  const filteredStencils = useMemo(() => {
    const q = stencilQuery.trim().toLowerCase();
    return STENCIL_LIBRARY.filter((s) => {
      const matchesCat = stencilCategory === 'All' || s.category === stencilCategory;
      const matchesQuery =
        !q ||
        s.label.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.includes(q));
      return matchesCat && matchesQuery;
    });
  }, [stencilCategory, stencilQuery]);

  // Unified resizable bounds for either a single unlocked widget OR a single unlocked bound group
  const resizableSelectionBounds = useMemo<RectBox | null>(() => {
    if (selectedWidgets.length === 1 && !selectedWidgets[0].locked) {
      const w = selectedWidgets[0];
      return { x: w.x, y: w.y, w: w.w, h: w.h };
    }
    if (activeSelectedGroupId && !selectedWidgets.some((w) => w.locked)) {
      return computeUnionBounds(selectedWidgets);
    }
    return null;
  }, [activeSelectedGroupId, selectedWidgets]);

  // Group bounding boxes for any selected groups (used to render cohesive group frames)
  const selectedGroupBoxes = useMemo<Array<{ groupId: string; box: RectBox; locked: boolean }>>(
    () => {
      const byGroup = new Map<string, WireframeWidget[]>();
      for (const w of selectedWidgets) {
        if (w.groupId) {
          const list = byGroup.get(w.groupId) || [];
          list.push(w);
          byGroup.set(w.groupId, list);
        }
      }
      const res: Array<{ groupId: string; box: RectBox; locked: boolean }> = [];
      byGroup.forEach((members, groupId) => {
        res.push({
          groupId,
          box: computeUnionBounds(members),
          locked: members.some((m) => m.locked),
        });
      });
      return res;
    },
    [selectedWidgets]
  );

  const editingWidget = editingWidgetId
    ? activeScreen.widgets.find((w) => w.id === editingWidgetId) || null
    : null;

  const activeScreenIndex = project.screens.findIndex((s) => s.id === activeScreen.id);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* Top Bar Contract: strictly 3 zones separated by gap-8 */}
      <header className="z-20 flex shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setIsPresentMode(false)}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          RoughDraft
        </button>

        {/* Zone 2: 4 clean single-line text links */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
          <button
            type="button"
            onClick={() => {
              setIsPresentMode(false);
              setIsTemplatesOpen(true);
            }}
            className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPresentMode(false);
              setIsQuickAddOpen(true);
            }}
            className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Quick Add
          </button>
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Shortcuts
          </button>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Export
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingWidgetId(null);
              setSelectedIds([]);
              setIsPresentMode((prev) => !prev);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isPresentMode
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isPresentMode ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Exit Prototype</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Present Prototype</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Secondary Studio Workspace Toolbar (Edit Mode Only) */}
      {!isPresentMode && (
        <div className="z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-4 py-2">
          {/* Left: Project Title + Undo/Redo + Contextual Group/Ungroup */}
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="text"
              aria-label="Project Name"
              value={project.name}
              onChange={(e) =>
                setProject((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-44 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-slate-800 hover:border-slate-200 hover:bg-white focus:border-blue-600 focus:bg-white focus:outline-none sm:w-52"
            />

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={past.length === 0}
                onClick={handleUndo}
                title="Undo (Ctrl/Cmd+Z)"
                className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={future.length === 0}
                onClick={handleRedo}
                title="Redo (Ctrl/Cmd+Shift+Z)"
                className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>

            {(canGroup || canUngroup) && (
              <>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  {canGroup && (
                    <button
                      type="button"
                      onClick={handleGroupSelected}
                      title="Group selected widgets (Ctrl/Cmd+G)"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 whitespace-nowrap"
                    >
                      <Group className="h-3.5 w-3.5" />
                      <span>Group</span>
                    </button>
                  )}
                  {canUngroup && (
                    <button
                      type="button"
                      onClick={handleUngroupSelected}
                      title="Ungroup selected group (Ctrl/Cmd+Shift+G)"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
                    >
                      <Ungroup className="h-3.5 w-3.5" />
                      <span>Ungroup</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Center: Balsamiq-inspired Quick Add Trigger */}
          <button
            type="button"
            onClick={() => setIsQuickAddOpen(true)}
            className="hidden max-w-xs flex-1 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 md:flex"
          >
            <span className="flex items-center gap-2 truncate">
              <Plus className="h-3.5 w-3.5 text-slate-400" />
              <span>Quick add widget...</span>
            </span>
            <kbd className="font-mono-tabular rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              /
            </kbd>
          </button>

          {/* Right: Sketch Style, Snap, Notes, Zoom */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-lg border border-slate-200 bg-white p-0.5 lg:flex">
              <button
                type="button"
                onClick={() =>
                  commitProject((prev) => ({ ...prev, sketchStyle: 'hand' as SketchStyle }))
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  project.sketchStyle === 'hand'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sketch
              </button>
              <button
                type="button"
                onClick={() =>
                  commitProject((prev) => ({ ...prev, sketchStyle: 'clean' as SketchStyle }))
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  project.sketchStyle === 'clean'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Wire
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setProject((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }))
              }
              title="Toggle 8px Grid Snap"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                project.snapToGrid
                  ? 'border-slate-300 bg-white text-slate-900'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-200/60'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Snap</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setProject((prev) => ({
                  ...prev,
                  showAnnotations: !prev.showAnnotations,
                }))
              }
              title="Show or Hide Sticky Note Annotations"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                project.showAnnotations
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-200/60'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Notes</span>
            </button>

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
                className="p-1.5 text-slate-600 hover:text-slate-900"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  requestAnimationFrame(centerCanvasScroll);
                }}
                title="Reset Zoom to 100% and Center"
                className="font-mono-tabular px-2 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                className="p-1.5 text-slate-600 hover:text-slate-900"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Sidebar: Screens + Stencil Library (Edit Mode Only) */}
        {!isPresentMode && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
            {/* Screens Section */}
            <div className="border-b border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Screens ({project.screens.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddScreen}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New</span>
                </button>
              </div>

              <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
                {project.screens.map((scr) => {
                  const isActive = scr.id === activeScreen.id;
                  const linksOut = scr.widgets.filter((w) => w.linkToScreenId).length;
                  return (
                    <div
                      key={scr.id}
                      onClick={() => {
                        setActiveScreenId(scr.id);
                        setSelectedIds([]);
                        setEditingWidgetId(null);
                      }}
                      className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{scr.name}</div>
                        <div
                          className={`flex items-center gap-1.5 text-[11px] font-mono-tabular ${
                            isActive ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          <span>{scr.widgets.length} items</span>
                          {linksOut > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{linksOut} linked</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          title="Duplicate Screen"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateScreen(scr);
                          }}
                          className={`rounded p-1 ${
                            isActive
                              ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                          }`}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {project.screens.length > 1 && (
                          <button
                            type="button"
                            title="Delete Screen"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScreen(scr.id);
                            }}
                            className={`rounded p-1 ${
                              isActive
                                ? 'text-slate-300 hover:bg-red-500/20 hover:text-red-300'
                                : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stencil Palette Section */}
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <div className="relative mb-2.5">
                <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={stencilQuery}
                  onChange={(e) => setStencilQuery(e.target.value)}
                  placeholder="Filter stencils..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Category Filter Tabs */}
              <div className="mb-3 flex flex-wrap gap-1">
                {(['All', 'Containers', 'Controls', 'Content', 'Markup'] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setStencilCategory(cat)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        stencilCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>

              {/* Draggable + Clickable Stencil Grid */}
              <div className="grid flex-1 auto-rows-max grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                {filteredStencils.map((stencil) => (
                  <button
                    key={stencil.type}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-roughdraft-stencil', stencil.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addStencilToScreen(stencil.type)}
                    title={`${stencil.hint} (Click or drag onto canvas)`}
                    className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-blue-600 hover:bg-blue-50/30 active:scale-[0.99]"
                  >
                    <StencilIcon type={stencil.type} className="h-4 w-4 text-slate-700" />
                    <span className="w-full truncate text-xs font-medium text-slate-800">
                      {stencil.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Center Viewport: Artboard Canvas with Horizontal & Vertical Scrollbars */}
        <main
          ref={mainViewportRef}
          className={`relative flex-1 ${
            isPresentMode
              ? 'overflow-auto bg-slate-900'
              : 'studio-canvas-scroll canvas-dot-backdrop'
          } ${isSpaceHeld ? 'cursor-grab' : ''}`}
          onMouseDown={(e) => {
            if (isSpaceHeld || e.button === 1) {
              e.preventDefault();
              const vp = mainViewportRef.current;
              interactionRef.current = {
                mode: 'pan',
                startClientX: e.clientX,
                startClientY: e.clientY,
                startCanvasX: 0,
                startCanvasY: 0,
                initialProject: project,
                initialWidgets: {},
                initialPan: {
                  x: vp ? vp.scrollLeft : 0,
                  y: vp ? vp.scrollTop : 0,
                },
                hasMoved: false,
              };
              return;
            }
            if (e.target === e.currentTarget && !isPresentMode) {
              setSelectedIds([]);
              commitInlineEdit();
            }
          }}
        >
          {/* Present Prototype Floating Navigation Bar */}
          {isPresentMode && (
            <div className="sticky top-4 z-30 mx-auto flex w-fit items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/95 px-4 py-2 text-xs text-slate-100 shadow-lg backdrop-blur-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={activeScreenIndex <= 0}
                  onClick={() =>
                    setActiveScreenId(project.screens[activeScreenIndex - 1].id)
                  }
                  className="rounded p-1 hover:bg-slate-700 disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono-tabular px-1 font-medium whitespace-nowrap">
                  {activeScreenIndex + 1} / {project.screens.length} · {activeScreen.name}
                </span>
                <button
                  type="button"
                  disabled={activeScreenIndex >= project.screens.length - 1}
                  onClick={() =>
                    setActiveScreenId(project.screens[activeScreenIndex + 1].id)
                  }
                  className="rounded p-1 hover:bg-slate-700 disabled:opacity-35"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              <button
                type="button"
                onMouseDown={() => setShowHotspotHint(true)}
                onMouseUp={() => setShowHotspotHint(false)}
                onMouseLeave={() => setShowHotspotHint(false)}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600/20 px-2.5 py-1 font-medium text-blue-300 hover:bg-blue-600/30 whitespace-nowrap"
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                <span>Hold to Reveal Hotspots</span>
              </button>
            </div>
          )}

          {/* Artboard Scrollable Stage */}
          <div
            className="flex p-16"
            style={{
              minWidth: isPresentMode
                ? '100%'
                : Math.round(activeScreen.width * zoom + 380),
              minHeight: isPresentMode
                ? '100%'
                : Math.round(activeScreen.height * zoom + 280),
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !isPresentMode && !isSpaceHeld) {
                setSelectedIds([]);
                commitInlineEdit();
              }
            }}
          >
            <div
              className="relative m-auto shrink-0 bg-white shadow-sm ring-1 ring-slate-300/80 transition-shadow"
              style={{
                width: activeScreen.width * zoom,
                height: activeScreen.height * zoom,
              }}
              onDragOver={(e) => {
                if (isPresentMode) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                if (isPresentMode) return;
                e.preventDefault();
                const rawType = e.dataTransfer.getData(
                  'application/x-roughdraft-stencil'
                ) as WidgetType;
                if (!rawType) return;
                const stencil = getStencilByType(rawType);
                const pt = clientToArtboard(e.clientX, e.clientY);
                addStencilToScreen(rawType, {
                  x: pt.x - stencil.defaultW / 2,
                  y: pt.y - stencil.defaultH / 2,
                });
              }}
            >
              {/* Screen Label Header in Edit Mode */}
              {!isPresentMode && (
                <div className="pointer-events-none absolute -top-6 left-0 flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                  <span className="font-medium text-slate-700">{activeScreen.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {activeScreen.width}×{activeScreen.height}
                  </span>
                </div>
              )}

              {/* Primary SVG Wireframe Artboard */}
              <svg
                ref={svgRef}
                width={activeScreen.width * zoom}
                height={activeScreen.height * zoom}
                viewBox={`0 0 ${activeScreen.width} ${activeScreen.height}`}
                className="block select-none"
                onMouseDown={(e) => {
                  if (isSpaceHeld) return;
                  if (editingWidgetId) {
                    commitInlineEdit();
                  }

                  if (isPresentMode) {
                    setShowHotspotHint(true);
                    window.setTimeout(() => setShowHotspotHint(false), 750);
                    return;
                  }

                  if (
                    e.target === e.currentTarget ||
                    (e.target as Element).getAttribute('data-artboard-bg') === 'true'
                  ) {
                    setSelectedIds([]);
                    const pt = clientToArtboard(e.clientX, e.clientY);
                    interactionRef.current = {
                      mode: 'marquee',
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startCanvasX: pt.x,
                      startCanvasY: pt.y,
                      initialProject: project,
                      initialWidgets: {},
                      hasMoved: false,
                    };
                  }
                }}
              >
                {/* White Artboard Paper Background */}
                <rect
                  data-artboard-bg="true"
                  x={0}
                  y={0}
                  width={activeScreen.width}
                  height={activeScreen.height}
                  fill="#ffffff"
                />

                {/* Subtle 8px dot/grid lines when snapping & dragging */}
                {!isPresentMode && project.snapToGrid && interactionRef.current && (
                  <g data-editor-overlay="true" opacity={0.35}>
                    <defs>
                      <pattern
                        id="artboard-snap-grid"
                        width={16}
                        height={16}
                        patternUnits="userSpaceOnUse"
                      >
                        <circle cx={1} cy={1} r={0.9} fill="#cbd5e1" />
                      </pattern>
                    </defs>
                    <rect
                      pointerEvents="none"
                      x={0}
                      y={0}
                      width={activeScreen.width}
                      height={activeScreen.height}
                      fill="url(#artboard-snap-grid)"
                    />
                  </g>
                )}

                {/* Render Wireframe Widgets */}
                {visibleWidgets.map((widget) => {
                  const isLinked = Boolean(widget.linkToScreenId);
                  return (
                    <g
                      key={widget.id}
                      className={
                        isPresentMode
                          ? isLinked
                            ? 'cursor-pointer'
                            : 'cursor-default'
                          : widget.locked
                          ? 'cursor-default'
                          : 'cursor-move'
                      }
                      onMouseDown={(e) => {
                        if (isSpaceHeld) return;
                        e.stopPropagation();

                        if (isPresentMode) {
                          if (widget.linkToScreenId) {
                            const exists = project.screens.some(
                              (s) => s.id === widget.linkToScreenId
                            );
                            if (exists) {
                              setActiveScreenId(widget.linkToScreenId);
                              return;
                            }
                          }
                          setShowHotspotHint(true);
                          window.setTimeout(() => setShowHotspotHint(false), 750);
                          return;
                        }

                        if (editingWidgetId && editingWidgetId !== widget.id) {
                          commitInlineEdit();
                        }

                        // Resolve target unit (either this widget alone or its entire bound group)
                        const unitIds = widget.groupId
                          ? visibleWidgets
                              .filter((vw) => vw.groupId === widget.groupId)
                              .map((vw) => vw.id)
                          : [widget.id];

                        let nextSel = selectedIds;
                        if (e.shiftKey) {
                          const alreadySelected = selectedIds.includes(widget.id);
                          if (alreadySelected) {
                            const removeSet = new Set(unitIds);
                            nextSel = selectedIds.filter((id) => !removeSet.has(id));
                          } else {
                            nextSel = Array.from(new Set([...selectedIds, ...unitIds]));
                          }
                          setSelectedIds(nextSel);
                        } else if (!selectedIds.includes(widget.id)) {
                          nextSel = unitIds;
                          setSelectedIds(nextSel);
                        }

                        const unitLocked = activeScreen.widgets.some(
                          (aw) => unitIds.includes(aw.id) && aw.locked
                        );
                        if (unitLocked) return;

                        const pt = clientToArtboard(e.clientX, e.clientY);
                        const initialWidgets: Record<string, RectBox> = {};
                        const movingBoxes: RectBox[] = [];
                        for (const w of activeScreen.widgets) {
                          if (nextSel.includes(w.id) && !w.locked) {
                            const box = { x: w.x, y: w.y, w: w.w, h: w.h };
                            initialWidgets[w.id] = box;
                            movingBoxes.push(box);
                          }
                        }

                        if (movingBoxes.length === 0) return;

                        interactionRef.current = {
                          mode: 'move',
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          startCanvasX: pt.x,
                          startCanvasY: pt.y,
                          initialProject: project,
                          initialBounds: computeUnionBounds(movingBoxes),
                          initialWidgets,
                          hasMoved: false,
                        };
                      }}
                      onDoubleClick={(e) => {
                        if (isPresentMode) return;
                        e.stopPropagation();
                        const pt = clientToArtboard(e.clientX, e.clientY);
                        startInlineEdit(widget, pt);
                      }}
                    >
                      <rect
                        x={widget.x}
                        y={widget.y}
                        width={widget.w}
                        height={widget.h}
                        fill="transparent"
                      />
                      <SketchWidgetSvg
                        widget={widget}
                        sketchStyle={project.sketchStyle}
                        isPresentMode={isPresentMode}
                        showHotspotHint={showHotspotHint}
                      />
                    </g>
                  );
                })}

                {/* Selection Outlines, Bound Group Frames & 8 Resize Handles (Edit Mode Only) */}
                {!isPresentMode && (
                  <g data-editor-overlay="true">
                    {/* Individual widget outlines (dashed & lighter when part of a bound group) */}
                    {selectedWidgets.map((w) => {
                      const inGroup = Boolean(w.groupId);
                      return (
                        <rect
                          key={`sel-${w.id}`}
                          x={w.x - 2}
                          y={w.y - 2}
                          width={w.w + 4}
                          height={w.h + 4}
                          fill="none"
                          stroke={
                            w.locked
                              ? '#d97706'
                              : inGroup
                              ? 'rgba(37, 99, 235, 0.35)'
                              : '#2563eb'
                          }
                          strokeWidth={inGroup ? 1 : 1.5}
                          strokeDasharray={w.locked || inGroup ? '3 3' : undefined}
                          pointerEvents="none"
                        />
                      );
                    })}

                    {/* Cohesive outer frame for each selected Bound Group */}
                    {selectedGroupBoxes.map(({ groupId, box, locked }) => (
                      <rect
                        key={`grp-box-${groupId}`}
                        x={box.x - 4}
                        y={box.y - 4}
                        width={box.w + 8}
                        height={box.h + 8}
                        rx={3}
                        fill="none"
                        stroke={locked ? '#d97706' : '#2563eb'}
                        strokeWidth={1.8}
                        strokeDasharray={locked ? '5 3' : undefined}
                        pointerEvents="none"
                      />
                    ))}

                    {/* 8 Resize Handles for Single Unlocked Widget OR Single Unlocked Bound Group */}
                    {resizableSelectionBounds &&
                      (() => {
                        const pad = activeSelectedGroupId ? 4 : 2;
                        const bx = resizableSelectionBounds.x - pad;
                        const by = resizableSelectionBounds.y - pad;
                        const bw = resizableSelectionBounds.w + pad * 2;
                        const bh = resizableSelectionBounds.h + pad * 2;

                        return (
                          [
                            ['nw', bx - 4, by - 4, 'nwse-resize'],
                            ['n', bx + bw / 2 - 4, by - 4, 'ns-resize'],
                            ['ne', bx + bw - 4, by - 4, 'nesw-resize'],
                            ['e', bx + bw - 4, by + bh / 2 - 4, 'ew-resize'],
                            ['se', bx + bw - 4, by + bh - 4, 'nwse-resize'],
                            ['s', bx + bw / 2 - 4, by + bh - 4, 'ns-resize'],
                            ['sw', bx - 4, by + bh - 4, 'nesw-resize'],
                            ['w', bx - 4, by + bh / 2 - 4, 'ew-resize'],
                          ] as Array<[ResizeHandle, number, number, string]>
                        ).map(([handle, hx, hy, cursor]) => (
                          <rect
                            key={handle}
                            x={hx}
                            y={hy}
                            width={8}
                            height={8}
                            rx={1.5}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={1.8}
                            style={{ cursor }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const pt = clientToArtboard(e.clientX, e.clientY);
                              const initialWidgets: Record<string, RectBox> = {};
                              for (const sw of selectedWidgets) {
                                if (!sw.locked) {
                                  initialWidgets[sw.id] = {
                                    x: sw.x,
                                    y: sw.y,
                                    w: sw.w,
                                    h: sw.h,
                                  };
                                }
                              }
                              interactionRef.current = {
                                mode: 'resize',
                                handle,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                startCanvasX: pt.x,
                                startCanvasY: pt.y,
                                initialProject: project,
                                initialBounds: { ...resizableSelectionBounds },
                                initialWidgets,
                                hasMoved: false,
                              };
                            }}
                          />
                        ));
                      })()}

                    {/* Smart Alignment Guides */}
                    {guides.map((g, i) =>
                      g.orientation === 'vertical' ? (
                        <line
                          key={i}
                          x1={g.position}
                          y1={0}
                          x2={g.position}
                          y2={activeScreen.height}
                          stroke="#2563eb"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          pointerEvents="none"
                        />
                      ) : (
                        <line
                          key={i}
                          x1={0}
                          y1={g.position}
                          x2={activeScreen.width}
                          y2={g.position}
                          stroke="#2563eb"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          pointerEvents="none"
                        />
                      )
                    )}

                    {/* Marquee Box */}
                    {marqueeRect && (
                      <rect
                        x={marqueeRect.x}
                        y={marqueeRect.y}
                        width={marqueeRect.w}
                        height={marqueeRect.h}
                        fill="rgba(37, 99, 235, 0.08)"
                        stroke="#2563eb"
                        strokeWidth={1.2}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                )}
              </svg>

              {/* Empty Screen Quick-Start Overlay */}
              {!isPresentMode && activeScreen.widgets.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="pointer-events-auto max-w-sm rounded-xl border border-dashed border-slate-300 bg-slate-50/90 p-6 text-center">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Blank Wireframe Artboard
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Drag stencils from the left palette, press{' '}
                      <kbd className="font-mono-tabular rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700">
                        /
                      </kbd>{' '}
                      to quick-add by name, or drop a frame below.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => addStencilToScreen('browser', { x: 72, y: 48 })}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-600 hover:text-blue-600 whitespace-nowrap"
                      >
                        + Browser Frame
                      </button>
                      <button
                        type="button"
                        onClick={() => addStencilToScreen('mobile', { x: 340, y: 24 })}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-600 hover:text-blue-600 whitespace-nowrap"
                      >
                        + Phone Frame
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Double-Click Text Editor Overlay */}
              {editingWidget && !isPresentMode && (
                <div
                  className="absolute z-30"
                  style={{
                    left: editingWidget.x * zoom,
                    top:
                      (editingWidget.type === 'modal' && editingField === 'subtext'
                        ? editingWidget.y + 52
                        : editingWidget.y) * zoom,
                    width: Math.max(220, editingWidget.w * zoom),
                  }}
                >
                  {(editingWidget.type === 'table' ||
                    editingWidget.type === 'paragraph' ||
                    editingWidget.type === 'heading' ||
                    editingWidget.type === 'note' ||
                    editingWidget.type === 'box') && (
                    <div
                      className="mb-1 flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-300 bg-white/95 px-1.5 py-1 shadow-md backdrop-blur-xs"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <button
                        type="button"
                        title="Bold: *text* (Ctrl+B)"
                        onClick={() =>
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '*',
                            '*',
                            'bold',
                            setEditingDraft
                          )
                        }
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Bold className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Italic: _text_ (Ctrl+I)"
                        onClick={() =>
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '_',
                            '_',
                            'italic',
                            setEditingDraft
                          )
                        }
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Italic className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Underline: +text+ (Ctrl+U)"
                        onClick={() =>
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '+',
                            '+',
                            'underline',
                            setEditingDraft
                          )
                        }
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Underline className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Strikethrough: ~text~"
                        onClick={() =>
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '~',
                            '~',
                            'strike',
                            setEditingDraft
                          )
                        }
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Strikethrough className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Code: `code`"
                        onClick={() =>
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '`',
                            '`',
                            'code',
                            setEditingDraft
                          )
                        }
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Code className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Link: [link text]"
                        onClick={() =>
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '[',
                            ']',
                            'link text',
                            setEditingDraft
                          )
                        }
                        className="rounded p-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Link2 className="h-3 w-3" />
                      </button>

                      {editingWidget.type === 'table' && (
                        <>
                          <div className="mx-0.5 h-3.5 w-px bg-slate-200" />
                          <button
                            type="button"
                            title="Cell green fill {bg:green}"
                            onClick={() =>
                              applyFormatToInput(
                                inlineInputRef.current,
                                editingDraft,
                                '{bg:green}',
                                '',
                                '',
                                setEditingDraft
                              )
                            }
                            className="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            +Green
                          </button>
                          <button
                            type="button"
                            title="Cell yellow fill {bg:yellow}"
                            onClick={() =>
                              applyFormatToInput(
                                inlineInputRef.current,
                                editingDraft,
                                '{bg:yellow}',
                                '',
                                '',
                                setEditingDraft
                              )
                            }
                            className="rounded bg-yellow-50 px-1 py-0.5 text-[10px] font-semibold text-yellow-700 hover:bg-yellow-100"
                          >
                            +Yellow
                          </button>
                          <button
                            type="button"
                            title="Cell right-align {r}"
                            onClick={() =>
                              applyFormatToInput(
                                inlineInputRef.current,
                                editingDraft,
                                '{r}',
                                '',
                                '',
                                setEditingDraft
                              )
                            }
                            className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            {'{r}'}
                          </button>
                          <button
                            type="button"
                            title="Checkbox [x]"
                            onClick={() =>
                              applyFormatToInput(
                                inlineInputRef.current,
                                editingDraft,
                                '[x] ',
                                '',
                                '',
                                setEditingDraft
                              )
                            }
                            className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            [x]
                          </button>
                        </>
                      )}

                      <span className="ml-auto text-[10px] text-slate-400">
                        {editingWidget.type === 'table' || editingWidget.type === 'paragraph'
                          ? 'Ctrl+Enter saves'
                          : 'Enter saves'}
                      </span>
                    </div>
                  )}

                  {editingWidget.type === 'table' ||
                  editingWidget.type === 'checkbox' ||
                  editingWidget.type === 'paragraph' ||
                  editingWidget.type === 'note' ||
                  (editingWidget.type === 'modal' && editingField === 'subtext') ? (
                    <textarea
                      ref={(el) => {
                        inlineInputRef.current = el;
                      }}
                      rows={5}
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      onBlur={commitInlineEdit}
                      onKeyDown={(e) => {
                        const mod = e.metaKey || e.ctrlKey;
                        if (mod && e.key.toLowerCase() === 'b') {
                          e.preventDefault();
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '*',
                            '*',
                            'bold',
                            setEditingDraft
                          );
                        } else if (mod && e.key.toLowerCase() === 'i') {
                          e.preventDefault();
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '_',
                            '_',
                            'italic',
                            setEditingDraft
                          );
                        } else if (mod && e.key.toLowerCase() === 'u') {
                          e.preventDefault();
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '+',
                            '+',
                            'underline',
                            setEditingDraft
                          );
                        } else if (e.key === 'Enter' && mod) {
                          e.preventDefault();
                          commitInlineEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingWidgetId(null);
                        }
                      }}
                      className="w-full rounded-lg border-2 border-blue-600 bg-white p-2.5 text-xs leading-relaxed text-slate-900 shadow-lg focus:outline-none"
                    />
                  ) : (
                    <input
                      ref={(el) => {
                        inlineInputRef.current = el;
                      }}
                      type="text"
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      onBlur={commitInlineEdit}
                      onKeyDown={(e) => {
                        const mod = e.metaKey || e.ctrlKey;
                        if (mod && e.key.toLowerCase() === 'b') {
                          e.preventDefault();
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '*',
                            '*',
                            'bold',
                            setEditingDraft
                          );
                        } else if (mod && e.key.toLowerCase() === 'i') {
                          e.preventDefault();
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '_',
                            '_',
                            'italic',
                            setEditingDraft
                          );
                        } else if (mod && e.key.toLowerCase() === 'u') {
                          e.preventDefault();
                          applyFormatToInput(
                            inlineInputRef.current,
                            editingDraft,
                            '+',
                            '+',
                            'underline',
                            setEditingDraft
                          );
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          commitInlineEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingWidgetId(null);
                        }
                      }}
                      className="w-full rounded-lg border-2 border-blue-600 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-lg focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right Low-Fidelity Inspector Panel (Edit Mode Only) */}
        {!isPresentMode && (
          <InspectorPanel
            activeScreen={activeScreen}
            allScreens={project.screens}
            selectedWidgets={selectedWidgets}
            sketchStyle={project.sketchStyle}
            showAnnotations={project.showAnnotations}
            onUpdateScreen={(patch) => {
              commitProject((prev) => ({
                ...prev,
                screens: prev.screens.map((s) =>
                  s.id === activeScreen.id ? { ...s, ...patch } : s
                ),
              }));
            }}
            onChangeDevice={(device: DevicePreset) => {
              const dims = DEVICE_DIMENSIONS[device];
              commitProject((prev) => ({
                ...prev,
                screens: prev.screens.map((s) =>
                  s.id === activeScreen.id
                    ? { ...s, device, width: dims.width, height: dims.height }
                    : s
                ),
              }));
            }}
            onChangeSketchStyle={(style) =>
              commitProject((prev) => ({ ...prev, sketchStyle: style }))
            }
            onToggleAnnotations={() =>
              setProject((prev) => ({ ...prev, showAnnotations: !prev.showAnnotations }))
            }
            onUpdateWidget={updateWidget}
            onDeleteSelected={deleteSelected}
            onDuplicateSelected={duplicateSelected}
            onLayerAction={handleLayerAction}
            onAlignSelected={handleAlignSelected}
            onGroupSelected={handleGroupSelected}
            onUngroupSelected={handleUngroupSelected}
            onUpdateGroupBounds={handleUpdateGroupBounds}
            onToggleGroupLock={handleToggleGroupLock}
            onGroupLayerAction={handleGroupLayerAction}
            onSelectSingleWidget={(id) => setSelectedIds([id])}
          />
        )}
      </div>

      {/* Modals & Palettes */}
      <QuickAddPalette
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddStencil={(type) => addStencilToScreen(type)}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={(nextProj) => {
          commitProject(nextProj);
          setActiveScreenId(nextProj.screens[0]?.id || '');
          setSelectedIds([]);
          setEditingWidgetId(null);
          showToast(`Loaded "${nextProj.name}"`);
        }}
      />

      <ExportModal
        isOpen={isExportOpen}
        screenName={activeScreen.name}
        projectName={project.name}
        onClose={() => setIsExportOpen(false)}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onExportJson={handleExportJson}
        onImportJson={(imported) => {
          commitProject(imported);
          setActiveScreenId(imported.screens[0]?.id || '');
          setSelectedIds([]);
          showToast(`Opened "${imported.name}"`);
        }}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Non-blocking Toast Feedback */}
      {toastMessage && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
