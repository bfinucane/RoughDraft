export type WidgetType =
  | 'browser'
  | 'mobile'
  | 'box'
  | 'modal'
  | 'button'
  | 'input'
  | 'search'
  | 'checkbox'
  | 'select'
  | 'tabs'
  | 'navbar'
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'avatar'
  | 'table'
  | 'divider'
  | 'arrow'
  | 'note'
  | 'callout';

export type WidgetCategory = 'Containers' | 'Controls' | 'Content' | 'Markup';

export type SketchStyle = 'hand' | 'clean';

export type FillTone = 'white' | 'muted' | 'hatch' | 'dark' | 'transparent' | 'note';

export type DevicePreset = 'desktop' | 'tablet' | 'mobile';

export interface WireframeWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Primary text or multi-line syntax content */
  text: string;
  /** Optional secondary text (e.g. URL in browser, placeholder in input, caption in image) */
  subtext?: string;
  /** Low-fidelity paper tone */
  fill: FillTone;
  /** Border toggle for boxes/cards */
  bordered?: boolean;
  /** Active item index for tabs or navbar */
  activeIndex?: number;
  /** Render paragraph as squiggly scribble lines instead of words */
  scribble?: boolean;
  /** Disabled visual state for interactive controls */
  disabled?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Font size preset */
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** Arrow direction for arrow widget */
  direction?: 'right' | 'left' | 'down' | 'up' | 'diag-down' | 'diag-up';
  /** Interactive prototype target screen ID */
  linkToScreenId?: string;
  /** Bound group identifier when multiple widgets are grouped as one entity */
  groupId?: string;
  /** Prevent accidental dragging on background frames */
  locked?: boolean;
}

export interface ScreenFrame {
  id: string;
  name: string;
  device: DevicePreset;
  width: number;
  height: number;
  widgets: WireframeWidget[];
}

export interface ProjectData {
  name: string;
  sketchStyle: SketchStyle;
  showAnnotations: boolean;
  snapToGrid: boolean;
  screens: ScreenFrame[];
}

export interface StencilDefinition {
  type: WidgetType;
  label: string;
  category: WidgetCategory;
  keywords: string[];
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
  defaultProps: Partial<WireframeWidget>;
  hint: string;
}

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
}
