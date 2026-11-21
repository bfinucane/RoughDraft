import { DEVICE_DIMENSIONS } from '../data/presets';
import type { DevicePreset, ScreenFrame, WireframeWidget } from '../types/wireframe';

export interface ScreenClipboardEnvelope {
  roughdraft: 'screen-v1';
  screen: ScreenFrame;
}

export interface WidgetsClipboardEnvelope {
  roughdraft: 'widgets-v1';
  sourceScreenId?: string;
  widgets: WireframeWidget[];
}

export type ParsedClipboardData =
  | { kind: 'screen'; screen: ScreenFrame }
  | { kind: 'widgets'; sourceScreenId?: string; widgets: WireframeWidget[] };

export function serializeScreenForClipboard(screen: ScreenFrame): string {
  const payload: ScreenClipboardEnvelope = {
    roughdraft: 'screen-v1',
    screen,
  };
  return JSON.stringify(payload, null, 2);
}

export function serializeWidgetsForClipboard(
  widgets: WireframeWidget[],
  sourceScreenId?: string
): string {
  const payload: WidgetsClipboardEnvelope = {
    roughdraft: 'widgets-v1',
    sourceScreenId,
    widgets,
  };
  return JSON.stringify(payload, null, 2);
}

function isValidWidgetLike(obj: unknown): obj is WireframeWidget {
  if (!obj || typeof obj !== 'object') return false;
  const w = obj as Record<string, unknown>;
  return (
    typeof w.type === 'string' &&
    typeof w.x === 'number' &&
    typeof w.y === 'number' &&
    typeof w.w === 'number' &&
    typeof w.h === 'number'
  );
}

function isValidScreenLike(obj: unknown): obj is ScreenFrame {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return typeof s.name === 'string' && Array.isArray(s.widgets);
}

export function parseRoughDraftClipboard(rawText: string): ParsedClipboardData | null {
  const trimmed = rawText.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | unknown[];

    if (Array.isArray(parsed)) {
      const widgets = parsed.filter(isValidWidgetLike);
      return widgets.length > 0 ? { kind: 'widgets', widgets } : null;
    }

    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.roughdraft === 'screen-v1' && isValidScreenLike(parsed.screen)) {
      return { kind: 'screen', screen: parsed.screen };
    }

    if (parsed.roughdraft === 'widgets-v1' && Array.isArray(parsed.widgets)) {
      const widgets = parsed.widgets.filter(isValidWidgetLike);
      return widgets.length > 0
        ? {
            kind: 'widgets',
            sourceScreenId:
              typeof parsed.sourceScreenId === 'string' ? parsed.sourceScreenId : undefined,
            widgets,
          }
        : null;
    }

    // Also accept a raw ScreenFrame object or single-screen ProjectData export
    if (isValidScreenLike(parsed)) {
      return { kind: 'screen', screen: parsed };
    }

    if (Array.isArray(parsed.screens) && parsed.screens.length === 1 && isValidScreenLike(parsed.screens[0])) {
      return { kind: 'screen', screen: parsed.screens[0] };
    }

    return null;
  } catch {
    return null;
  }
}

export function instantiatePastedScreen(
  source: ScreenFrame,
  existingScreens: ScreenFrame[],
  makeId: (prefix: string) => string
): ScreenFrame {
  const device: DevicePreset =
    source.device === 'mobile' || source.device === 'tablet' ? source.device : 'desktop';
  const fallbackDims = DEVICE_DIMENSIONS[device];
  const width =
    typeof source.width === 'number' && Number.isFinite(source.width) && source.width >= 200
      ? Math.round(source.width)
      : fallbackDims.width;
  const height =
    typeof source.height === 'number' && Number.isFinite(source.height) && source.height >= 200
      ? Math.round(source.height)
      : fallbackDims.height;

  const existingNames = new Set(existingScreens.map((s) => s.name.trim().toLowerCase()));
  const baseName = source.name.trim() || 'Pasted Screen';
  let finalName = baseName;
  if (existingNames.has(finalName.toLowerCase())) {
    let suffix = 1;
    do {
      finalName = suffix === 1 ? `${baseName} (Copy)` : `${baseName} (Copy ${suffix})`;
      suffix += 1;
    } while (existingNames.has(finalName.toLowerCase()));
  }

  const existingScreenIds = new Set(existingScreens.map((s) => s.id));
  const groupMap = new Map<string, string>();

  const widgets: WireframeWidget[] = source.widgets
    .filter(isValidWidgetLike)
    .map((w) => {
      let nextGroupId: string | undefined;
      if (w.groupId) {
        if (!groupMap.has(w.groupId)) {
          groupMap.set(w.groupId, makeId('grp'));
        }
        nextGroupId = groupMap.get(w.groupId);
      }

      const validLink =
        w.linkToScreenId && existingScreenIds.has(w.linkToScreenId)
          ? w.linkToScreenId
          : undefined;

      return {
        ...w,
        id: makeId('w'),
        text: typeof w.text === 'string' ? w.text : '',
        fill: w.fill || 'white',
        groupId: nextGroupId,
        linkToScreenId: validLink,
      };
    });

  return {
    id: makeId('scr'),
    name: finalName,
    device,
    width,
    height,
    widgets,
  };
}

export function instantiatePastedWidgets(
  sourceWidgets: WireframeWidget[],
  targetScreen: ScreenFrame,
  allProjectScreens: ScreenFrame[],
  sameScreenOffset: boolean,
  makeId: (prefix: string) => string
): WireframeWidget[] {
  const existingScreenIds = new Set(allProjectScreens.map((s) => s.id));
  const groupMap = new Map<string, string>();
  const offset = sameScreenOffset ? 24 : 0;

  return sourceWidgets.filter(isValidWidgetLike).map((w) => {
    let nextGroupId: string | undefined;
    if (w.groupId) {
      if (!groupMap.has(w.groupId)) {
        groupMap.set(w.groupId, makeId('grp'));
      }
      nextGroupId = groupMap.get(w.groupId);
    }

    const validLink =
      w.linkToScreenId && existingScreenIds.has(w.linkToScreenId)
        ? w.linkToScreenId
        : undefined;

    const clampedX = Math.max(0, Math.min(targetScreen.width - Math.min(w.w, targetScreen.width), w.x + offset));
    const clampedY = Math.max(0, Math.min(targetScreen.height - Math.min(w.h, targetScreen.height), w.y + offset));

    return {
      ...w,
      id: makeId('w'),
      x: clampedX,
      y: clampedY,
      text: typeof w.text === 'string' ? w.text : '',
      fill: w.fill || 'white',
      groupId: nextGroupId,
      linkToScreenId: validLink,
    };
  });
}

export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
