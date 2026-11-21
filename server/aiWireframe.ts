import { GoogleGenAI, Type } from '@google/genai';
import type {
  DevicePreset,
  FillTone,
  WidgetType,
  WireframeWidget,
} from '../src/types/wireframe.ts';

export type AiProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'openai-compatible';

export type AiGenerationMode = 'text' | 'screenshot';

export interface AiModelOption {
  id: string;
  label: string;
  supportsVision: boolean;
}

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  description: string;
  configured: boolean;
  envVarHint: string;
  supportsVision: boolean;
  supportsCustomModel: boolean;
  defaultModel: string;
  models: AiModelOption[];
}

export interface WireframeGenerationRequest {
  mode: AiGenerationMode;
  provider: AiProviderId;
  model?: string;
  prompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
  device: DevicePreset;
  artboardWidth: number;
  artboardHeight: number;
}

export interface WireframeGenerationResult {
  screenName: string;
  summary: string;
  device: DevicePreset;
  widgets: WireframeWidget[];
  provider: AiProviderId;
  model: string;
}

interface RawAiWidget {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  text?: unknown;
  subtext?: unknown;
  fill?: unknown;
  bordered?: unknown;
  activeIndex?: unknown;
  scribble?: unknown;
  disabled?: unknown;
  align?: unknown;
  fontSize?: unknown;
  direction?: unknown;
  scrollPos?: unknown;
  locked?: unknown;
  groupKey?: unknown;
}

interface RawAiWireframePayload {
  screenName?: unknown;
  summary?: unknown;
  widgets?: unknown;
}

const VALID_WIDGET_TYPES = new Set<WidgetType>([
  'browser',
  'mobile',
  'box',
  'modal',
  'button',
  'input',
  'search',
  'checkbox',
  'select',
  'tabs',
  'navbar',
  'heading',
  'paragraph',
  'image',
  'avatar',
  'table',
  'divider',
  'arrow',
  'note',
  'callout',
  'vscrollbar',
  'hscrollbar',
]);

const VALID_FILL_TONES = new Set<FillTone>([
  'white',
  'muted',
  'hatch',
  'dark',
  'transparent',
  'note',
]);

const VALID_ALIGN = new Set<'left' | 'center' | 'right'>(['left', 'center', 'right']);
const VALID_FONT_SIZES = new Set<'sm' | 'md' | 'lg' | 'xl'>(['sm', 'md', 'lg', 'xl']);
const VALID_DIRECTIONS = new Set<'right' | 'left' | 'down' | 'up' | 'diag-down' | 'diag-up'>([
  'right',
  'left',
  'down',
  'up',
  'diag-down',
  'diag-up',
]);

const MIN_WIDGET_DIMS: Record<WidgetType, { minW: number; minH: number }> = {
  browser: { minW: 260, minH: 180 },
  mobile: { minW: 220, minH: 360 },
  box: { minW: 40, minH: 28 },
  modal: { minW: 200, minH: 140 },
  button: { minW: 64, minH: 30 },
  input: { minW: 110, minH: 38 },
  search: { minW: 120, minH: 32 },
  checkbox: { minW: 110, minH: 32 },
  select: { minW: 100, minH: 32 },
  tabs: { minW: 160, minH: 34 },
  navbar: { minW: 260, minH: 42 },
  heading: { minW: 60, minH: 26 },
  paragraph: { minW: 80, minH: 24 },
  image: { minW: 48, minH: 48 },
  avatar: { minW: 28, minH: 28 },
  table: { minW: 220, minH: 96 },
  divider: { minW: 40, minH: 16 },
  arrow: { minW: 44, minH: 28 },
  note: { minW: 110, minH: 80 },
  callout: { minW: 28, minH: 28 },
  vscrollbar: { minW: 14, minH: 64 },
  hscrollbar: { minW: 64, minH: 14 },
};

function getCompatibleBaseUrl(): string {
  const raw =
    process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    '';
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

export function getAvailableProviders(): AiProviderInfo[] {
  const compatBase = getCompatibleBaseUrl();
  const customDefaultModel =
    process.env.OPENAI_COMPATIBLE_MODEL?.trim() || 'llama3.2-vision';

  return [
    {
      id: 'gemini',
      label: 'Google Gemini',
      description: 'Fast multimodal wireframing via Google GenAI SDK.',
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      envVarHint: 'GEMINI_API_KEY',
      supportsVision: true,
      supportsCustomModel: false,
      defaultModel: 'gemini-4-hydrogen',
      models: [
        { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Recommended)', supportsVision: true },
        { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Fast)', supportsVision: true },
      ],
    },
    {
      id: 'openai',
      label: 'OpenAI',
      description: 'GPT-4o & GPT-4.1 text and screenshot vision models.',
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      envVarHint: 'OPENAI_API_KEY',
      supportsVision: true,
      supportsCustomModel: false,
      defaultModel: 'gpt-4o',
      models: [
        { id: 'gpt-4o', label: 'GPT-4o (Text & Vision)', supportsVision: true },
        { id: 'gpt-4o-mini', label: 'GPT-4o mini (Fast)', supportsVision: true },
        { id: 'gpt-4.1', label: 'GPT-4.1 (Structured)', supportsVision: true },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', supportsVision: true },
      ],
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      description: 'Claude Sonnet & Haiku for layout synthesis and vision.',
      configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      envVarHint: 'ANTHROPIC_API_KEY',
      supportsVision: true,
      supportsCustomModel: false,
      defaultModel: 'claude-sonnet-4-20250514',
      models: [
        { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Text & Vision)', supportsVision: true },
        { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Fast)', supportsVision: true },
      ],
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      description: 'DeepSeek-V3 & DeepSeek-R1 for Text-to-Wireframe synthesis.',
      configured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      envVarHint: 'DEEPSEEK_API_KEY',
      supportsVision: false,
      supportsCustomModel: false,
      defaultModel: 'deepseek-chat',
      models: [
        { id: 'deepseek-chat', label: 'DeepSeek Chat / V3 (Text)', supportsVision: false },
        { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner / R1 (Text)', supportsVision: false },
      ],
    },
    {
      id: 'openai-compatible',
      label: 'Ollama / OpenAI-Compatible',
      description: 'Local Ollama, LM Studio, vLLM, or any OpenAI-compatible endpoint.',
      configured: Boolean(compatBase),
      envVarHint: 'OLLAMA_BASE_URL or OPENAI_COMPATIBLE_BASE_URL',
      supportsVision: true,
      supportsCustomModel: true,
      defaultModel: customDefaultModel,
      models: [
        { id: customDefaultModel, label: `${customDefaultModel} (Default)`, supportsVision: true },
        { id: 'llama3.2-vision', label: 'llama3.2-vision (Ollama)', supportsVision: true },
        { id: 'qwen2.5vl', label: 'qwen2.5vl (Ollama)', supportsVision: true },
        { id: 'llama3.1', label: 'llama3.1 (Text Only)', supportsVision: false },
      ],
    },
  ];
}

function buildSystemPrompt(
  mode: AiGenerationMode,
  device: DevicePreset,
  width: number,
  height: number
): string {
  const modeNote =
    mode === 'screenshot'
      ? `TASK: Convert the uploaded UI screenshot or hand-drawn sketch into an editable low-fidelity wireframe using RoughDraft widgets.
- Reconstruct the overall layout structure, navigation, cards, forms, tables, headings, images, and CTAs proportionally to fit cleanly inside the ${width}x${height} (${device}) artboard.
- Transcribe visible labels, headings, tab titles, button text, and sample table columns accurately, keeping copy concise and low-fidelity.
- Ignore OS window chrome outside the app unless representing a browser/mobile frame.`
      : `TASK: Design a complete, clean, usable low-fidelity wireframe screen from the user's description that fits cleanly inside the ${width}x${height} (${device}) artboard.`;

  return `You are RoughDraft's wireframe architect. Output ONLY valid JSON matching the requested schema—no markdown fences, no commentary outside JSON.

${modeNote}

ARTBOARD CONSTRAINTS:
- Device preset: ${device}
- Artboard dimensions: width=${width}px, height=${height}px (all widgets must stay within 0..${width} horizontally and 0..${height} vertically).
- Align positions and sizes to a clean 8px grid where possible, leaving 20-32px outer margins and 12-20px gaps between sibling elements so text never overlaps.
- Order widgets from back-to-front (outer browser/mobile frame or background cards FIRST with "locked": true if background frame, then inner content, controls, headings, and overlays LAST).

ALLOWED WIDGET TYPES (exactly these 22 strings):
1. "browser": Web browser window chrome. text=Tab title, subtext=URL, fill="white", bordered=true. Header takes top ~58px; place child widgets below y+68.
2. "mobile": Phone frame bezel. text=Status bar time (e.g. "9:41"), fill="white", bordered=true. Top bezel takes ~46px, bottom ~24px.
3. "box": Container/card/panel/sidebar. text=optional centered label (usually ""), fill="white"|"muted"|"hatch"|"dark"|"transparent", bordered=true|false.
4. "modal": Overlay dialog box. text=Modal title, subtext=body copy, fill="white", bordered=true. Title bar takes top ~42px.
5. "button": Clickable button. text=Label, fill="dark" (primary CTA) | "white" (secondary) | "muted". Height typically 36-44px.
6. "input": Form field with label above. text=Field label (e.g. "Work Email"), subtext=Placeholder (e.g. "you@company.com"), fill="white". Height typically 60-66px.
7. "search": Search input with magnifying glass. text=Placeholder, fill="white". Height ~38-42px.
8. "select": Dropdown select box. text=Selected option, fill="white". Height ~38-42px.
9. "checkbox": Multi-line checklist or radio options. text=lines prefixed with "[x] ", "[ ] ", "(o) ", or "( ) ". fill="transparent".
10. "tabs": Horizontal tab switcher. text=Comma-separated labels (e.g. "Overview, Activity, Billing"), activeIndex=0..N-1, fill="white". Height ~40-44px.
11. "navbar": Top navigation bar. text=Brand name, subtext=Comma-separated nav links (e.g. "Home, Projects, Team, Settings"), activeIndex=0..N-1, fill="white". Height ~52-58px.
12. "heading": Section/page title. text=Heading text (supports *bold*, _italic_, {color:blue}), fontSize="lg"|"xl", align="left"|"center"|"right", fill="transparent".
13. "paragraph": Body copy or bullet list. text=Body text (supports *bold*, _italic_, [link], bullet lines starting with "* "), scribble=false (or true for squiggly wireframe lines), fontSize="sm"|"md", align="left"|"center"|"right", fill="transparent".
14. "image": Crossed media/chart/photo placeholder. text=Descriptive caption (e.g. "Hero Product Photo"), fill="muted".
15. "avatar": Circular user avatar/icon. text=2-letter initials (e.g. "AC"), fill="muted"|"dark".
16. "table": Data table. text=First line comma-separated headers, subsequent lines comma-separated cells. Supports {c} center, {r} right align, {bg:green}|{bg:yellow}|{bg:red}|{bg:blue} cell fills, [x]/[ ] checkboxes, and *bold*. fill="white".
17. "divider": Horizontal rule. text="", fill="transparent", h=18-20.
18. "arrow": Directional flow arrow. direction="right"|"left"|"down"|"up"|"diag-down"|"diag-up", fill="transparent".
19. "note": Yellow sticky note UX annotation. text=Concise UX note, fill="note".
20. "callout": Numbered spec marker circle. text="1".."9", fill="note", w=34, h=34.
21. "vscrollbar": Vertical scrollbar track. w=18, scrollPos=0..100, fill="muted".
22. "hscrollbar": Horizontal scrollbar track. h=18, scrollPos=0..100, fill="muted".

GROUPING:
- Use optional "groupKey" (a short string like "kpi-1", "nav-card", "sidebar-menu") ONLY when multiple small widgets form one logical composite component (like a stat card = box + heading + paragraph). Do NOT group everything into one giant group.

OUTPUT JSON SHAPE:
{
  "screenName": "Short Screen Title",
  "summary": "One-sentence description of the generated wireframe layout",
  "widgets": [
    {
      "type": "navbar",
      "x": 24,
      "y": 24,
      "w": 976,
      "h": 54,
      "text": "Acme App",
      "subtext": "Overview, Analytics, Billing, Settings",
      "activeIndex": 0,
      "fill": "white",
      "bordered": true
    }
  ]
}

Produce 8 to 35 well-crafted widgets with realistic proportions and readable layout spacing.`;
}

function makeShortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseJsonPayload(rawText: string): RawAiWireframePayload {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('The AI provider returned an empty response.');
  }

  // Strip optional markdown code fences if a provider wrapped the JSON
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as RawAiWireframePayload;
  } catch {
    // Fallback: extract outermost JSON object
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as RawAiWireframePayload;
    }
    throw new Error('Could not parse structured JSON wireframe output from the AI provider.');
  }
}

function toFiniteNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function snap8(n: number): number {
  return Math.round(n / 4) * 4;
}

export function sanitizeWireframeResponse(
  rawText: string,
  device: DevicePreset,
  artboardWidth: number,
  artboardHeight: number,
  provider: AiProviderId,
  model: string
): WireframeGenerationResult {
  const parsed = parseJsonPayload(rawText);
  const rawWidgets = Array.isArray(parsed.widgets) ? (parsed.widgets as RawAiWidget[]) : [];

  if (rawWidgets.length === 0) {
    throw new Error('The AI model did not return any wireframe widgets.');
  }

  // Count groupKey occurrences so single-item groups are omitted
  const groupKeyCounts = new Map<string, number>();
  for (const rw of rawWidgets) {
    if (typeof rw.groupKey === 'string' && rw.groupKey.trim()) {
      const k = rw.groupKey.trim();
      groupKeyCounts.set(k, (groupKeyCounts.get(k) || 0) + 1);
    }
  }
  const groupIdMap = new Map<string, string>();
  groupKeyCounts.forEach((count, key) => {
    if (count >= 2) {
      groupIdMap.set(key, makeShortId('grp'));
    }
  });

  const widgets: WireframeWidget[] = [];

  for (const rw of rawWidgets) {
    if (typeof rw.type !== 'string') continue;
    const wType = rw.type.trim().toLowerCase() as WidgetType;
    if (!VALID_WIDGET_TYPES.has(wType)) continue;

    const mins = MIN_WIDGET_DIMS[wType];
    let w = Math.max(mins.minW, snap8(toFiniteNumber(rw.w, mins.minW * 2)));
    let h = Math.max(mins.minH, snap8(toFiniteNumber(rw.h, mins.minH * 2)));
    w = Math.min(w, artboardWidth);
    h = Math.min(h, artboardHeight);

    let x = snap8(toFiniteNumber(rw.x, 24));
    let y = snap8(toFiniteNumber(rw.y, 24));
    x = Math.max(0, Math.min(artboardWidth - w, x));
    y = Math.max(0, Math.min(artboardHeight - h, y));

    const fillRaw = typeof rw.fill === 'string' ? rw.fill.trim().toLowerCase() : 'white';
    const fill: FillTone = VALID_FILL_TONES.has(fillRaw as FillTone)
      ? (fillRaw as FillTone)
      : wType === 'note' || wType === 'callout'
      ? 'note'
      : wType === 'heading' || wType === 'paragraph' || wType === 'checkbox' || wType === 'divider' || wType === 'arrow'
      ? 'transparent'
      : 'white';

    const widget: WireframeWidget = {
      id: makeShortId('w'),
      type: wType,
      x,
      y,
      w,
      h,
      text: typeof rw.text === 'string' ? rw.text : '',
      fill,
    };

    if (typeof rw.subtext === 'string' && rw.subtext.length > 0) {
      widget.subtext = rw.subtext;
    }
    if (typeof rw.bordered === 'boolean') {
      widget.bordered = rw.bordered;
    } else if (wType === 'box' || wType === 'browser' || wType === 'mobile' || wType === 'modal') {
      widget.bordered = true;
    }
    if (typeof rw.activeIndex === 'number' && Number.isFinite(rw.activeIndex)) {
      widget.activeIndex = Math.max(0, Math.floor(rw.activeIndex));
    }
    if (typeof rw.scribble === 'boolean') {
      widget.scribble = rw.scribble;
    }
    if (typeof rw.disabled === 'boolean') {
      widget.disabled = rw.disabled;
    }
    if (typeof rw.align === 'string' && VALID_ALIGN.has(rw.align as 'left' | 'center' | 'right')) {
      widget.align = rw.align as 'left' | 'center' | 'right';
    }
    if (typeof rw.fontSize === 'string' && VALID_FONT_SIZES.has(rw.fontSize as 'sm' | 'md' | 'lg' | 'xl')) {
      widget.fontSize = rw.fontSize as 'sm' | 'md' | 'lg' | 'xl';
    }
    if (
      typeof rw.direction === 'string' &&
      VALID_DIRECTIONS.has(rw.direction as 'right' | 'left' | 'down' | 'up' | 'diag-down' | 'diag-up')
    ) {
      widget.direction = rw.direction as 'right' | 'left' | 'down' | 'up' | 'diag-down' | 'diag-up';
    }
    if (typeof rw.scrollPos === 'number' && Number.isFinite(rw.scrollPos)) {
      widget.scrollPos = Math.max(0, Math.min(100, Math.round(rw.scrollPos)));
    }
    if (typeof rw.locked === 'boolean') {
      widget.locked = rw.locked;
    }
    if (typeof rw.groupKey === 'string') {
      const gid = groupIdMap.get(rw.groupKey.trim());
      if (gid) widget.groupId = gid;
    }

    widgets.push(widget);
  }

  if (widgets.length === 0) {
    throw new Error('No valid RoughDraft widgets were produced by the AI model.');
  }

  const screenName =
    typeof parsed.screenName === 'string' && parsed.screenName.trim()
      ? parsed.screenName.trim().slice(0, 48)
      : 'AI Wireframe';
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : `Generated ${widgets.length} wireframe elements.`;

  return {
    screenName,
    summary,
    device,
    widgets,
    provider,
    model,
  };
}

function cleanBase64Image(raw: string): { base64: string; mimeType?: string } {
  const dataUrlMatch = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], base64: dataUrlMatch[2] };
  }
  return { base64: raw.trim() };
}

async function generateWithGemini(
  req: WireframeGenerationRequest,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Google Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets or .env.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (req.mode === 'screenshot' && req.imageBase64) {
    const cleaned = cleanBase64Image(req.imageBase64);
    parts.push({
      inlineData: {
        mimeType: req.imageMimeType || cleaned.mimeType || 'image/png',
        data: cleaned.base64,
      },
    });
  }
  parts.push({ text: userPrompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          screenName: { type: Type.STRING, description: 'Short 2-4 word screen title' },
          summary: { type: Type.STRING, description: 'One-sentence summary of the wireframe' },
          widgets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                w: { type: Type.NUMBER },
                h: { type: Type.NUMBER },
                text: { type: Type.STRING },
                subtext: { type: Type.STRING },
                fill: { type: Type.STRING },
                bordered: { type: Type.BOOLEAN },
                activeIndex: { type: Type.INTEGER },
                scribble: { type: Type.BOOLEAN },
                disabled: { type: Type.BOOLEAN },
                align: { type: Type.STRING },
                fontSize: { type: Type.STRING },
                direction: { type: Type.STRING },
                scrollPos: { type: Type.INTEGER },
                locked: { type: Type.BOOLEAN },
                groupKey: { type: Type.STRING },
              },
              required: ['type', 'x', 'y', 'w', 'h', 'text', 'fill'],
            },
          },
        },
        required: ['screenName', 'widgets'],
      },
    },
  });

  return response.text ?? '';
}

async function generateWithOpenAiCompatible(
  req: WireframeGenerationRequest,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  target: 'openai' | 'deepseek' | 'custom'
): Promise<string> {
  const baseUrl =
    target === 'custom'
      ? getCompatibleBaseUrl()
      : target === 'deepseek'
      ? (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
      : (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');

  const apiKey =
    target === 'custom'
      ? process.env.OPENAI_COMPATIBLE_API_KEY?.trim() || 'ollama'
      : target === 'deepseek'
      ? process.env.DEEPSEEK_API_KEY?.trim()
      : process.env.OPENAI_API_KEY?.trim();

  if (target === 'custom' && !baseUrl) {
    throw new Error(
      'No local/compatible endpoint configured. Set OLLAMA_BASE_URL or OPENAI_COMPATIBLE_BASE_URL in your server .env file.'
    );
  }
  if (target === 'deepseek' && !apiKey) {
    throw new Error(
      'DeepSeek API key is not configured on the server. Set DEEPSEEK_API_KEY in your server .env file.'
    );
  }
  if (target === 'openai' && !apiKey) {
    throw new Error(
      'OpenAI API key is not configured on the server. Set OPENAI_API_KEY in your server .env file.'
    );
  }

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  if (req.mode === 'screenshot' && req.imageBase64) {
    const cleaned = cleanBase64Image(req.imageBase64);
    const mime = req.imageMimeType || cleaned.mimeType || 'image/png';
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${mime};base64,${cleaned.base64}`,
      },
    });
  }
  userContent.push({ type: 'text', text: userPrompt });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const bodyPayload: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: userContent.length === 1 && userContent[0].type === 'text'
          ? userContent[0].text
          : userContent,
      },
    ],
  };

  if (target === 'openai' || (target === 'deepseek' && model !== 'deepseek-reasoner')) {
    bodyPayload.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const providerLabel =
      target === 'custom' ? 'OpenAI-compatible' : target === 'deepseek' ? 'DeepSeek' : 'OpenAI';
    throw new Error(
      `Upstream ${providerLabel} error (${res.status}): ${errText.slice(0, 240) || res.statusText}`
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || '';
}

async function generateWithAnthropic(
  req: WireframeGenerationRequest,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured on the server. Set ANTHROPIC_API_KEY in your server .env file.'
    );
  }

  const contentBlocks: Array<
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'text'; text: string }
  > = [];

  if (req.mode === 'screenshot' && req.imageBase64) {
    const cleaned = cleanBase64Image(req.imageBase64);
    const mime = req.imageMimeType || cleaned.mimeType || 'image/png';
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mime,
        data: cleaned.base64,
      },
    });
  }
  contentBlocks.push({ type: 'text', text: userPrompt });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Upstream Anthropic error (${res.status}): ${errText.slice(0, 240) || res.statusText}`
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const textBlock = data.content?.find((b) => b.type === 'text');
  return textBlock?.text || '';
}

export async function generateWireframeWithProvider(
  req: WireframeGenerationRequest
): Promise<WireframeGenerationResult> {
  const providers = getAvailableProviders();
  const providerInfo = providers.find((p) => p.id === req.provider);
  if (!providerInfo) {
    throw new Error(`Unsupported AI provider "${req.provider}".`);
  }

  const chosenModel = req.model?.trim() || providerInfo.defaultModel;
  const chosenModelMeta = providerInfo.models.find((m) => m.id === chosenModel);
  const supportsVision = chosenModelMeta ? chosenModelMeta.supportsVision : providerInfo.supportsVision;

  if (req.mode === 'screenshot' && !supportsVision) {
    throw new Error(
      `${providerInfo.label} (${chosenModel}) supports Text-to-Wireframe only. Please choose a vision-capable provider such as Google Gemini, OpenAI, or Anthropic Claude for Screenshot-to-Wireframe.`
    );
  }

  const systemPrompt = buildSystemPrompt(
    req.mode,
    req.device,
    req.artboardWidth,
    req.artboardHeight
  );

  const userPrompt =
    req.mode === 'screenshot'
      ? req.prompt?.trim()
        ? `Convert the attached UI screenshot/sketch into a ${req.device} (${req.artboardWidth}x${req.artboardHeight}) RoughDraft wireframe. Additional user notes: ${req.prompt.trim()}`
        : `Convert the attached UI screenshot/sketch into a ${req.device} (${req.artboardWidth}x${req.artboardHeight}) RoughDraft wireframe. Return strictly JSON.`
      : `Design a ${req.device} (${req.artboardWidth}x${req.artboardHeight}) RoughDraft wireframe for: ${req.prompt?.trim()}. Return strictly JSON.`;

  let rawText = '';

  if (req.provider === 'gemini') {
    rawText = await generateWithGemini(req, chosenModel, systemPrompt, userPrompt);
  } else if (req.provider === 'openai') {
    rawText = await generateWithOpenAiCompatible(req, chosenModel, systemPrompt, userPrompt, 'openai');
  } else if (req.provider === 'deepseek') {
    rawText = await generateWithOpenAiCompatible(req, chosenModel, systemPrompt, userPrompt, 'deepseek');
  } else if (req.provider === 'anthropic') {
    rawText = await generateWithAnthropic(req, chosenModel, systemPrompt, userPrompt);
  } else if (req.provider === 'openai-compatible') {
    rawText = await generateWithOpenAiCompatible(req, chosenModel, systemPrompt, userPrompt, 'custom');
  }

  return sanitizeWireframeResponse(
    rawText,
    req.device,
    req.artboardWidth,
    req.artboardHeight,
    req.provider,
    chosenModel
  );
}
