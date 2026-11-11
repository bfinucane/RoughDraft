# RoughDraft

**RoughDraft** is a fast, distraction-free UI sketching and low-fidelity wireframing studio inspired by Balsamiq. It is designed strictly for rapid layout exploration, screen flows, and clickable wireframes—keeping teams focused on structure and user journeys rather than pixel-pushing.

---

## Key Features

- **Hand-Drawn & Clean Wire Modes** — Switch instantly between organic marker-style SVG strokes (`Hand Sketch`) and crisp geometric wireframes (`Clean Wire`).
- **22 Purpose-Built UI Stencils** — Drag-and-drop or click to insert containers, form controls, scrollbars, data tables, media placeholders, and UX callouts.
- **Quick Add Launcher (`/`)** — Press `/` anywhere on the canvas to search and drop stencils from the keyboard without touching the sidebar.
- **Grouping & Proportional Scaling** — Select multiple widgets (`Shift + Click` or marquee drag) and press `Ctrl/Cmd + G` to bind them into a single movable, proportionally scalable component.
- **Clickable Low-Fidelity Prototypes** — Link any button, tab, card, or control to another screen and launch **Present Prototype** mode to walk stakeholders through interactive flows.
- **Plain-Text Wireframe Syntax** — Populate checklists, radio groups, tabs, navbars, and multi-column data tables using simple plain-text shorthand.
- **Starter Wireframe Kits** — Jumpstart projects with multi-screen SaaS, Mobile Commerce, Product Landing Page, or Blank Sketchboard templates.
- **Local Auto-Save & Crisp Export** — Projects save automatically in `localStorage` and can be exported at any time as **2× PNG**, **Vector SVG**, or portable **`.json`** project files.

---

## Stencil Library

| Category | Stencils |
| :--- | :--- |
| **Containers** | Browser Frame, Phone Frame, Box / Card, Modal Dialog |
| **Controls** | Button, Text Input, Search Bar, Dropdown Select, Checklist / Radios, Tabs Bar, Top Navbar, Vertical Scrollbar, Horizontal Scrollbar |
| **Content** | Heading Title, Text / Scribble, Image Placeholder, Avatar / Icon, Data Table |
| **Markup** | Horizontal Rule, Flow Arrow, Sticky Note, Numbered Callout |

### Quick Text Shorthand

Double-click any widget on the canvas (or edit its fields in the right-hand Inspector) using simple text patterns:

- **Text & Paragraph Formatting**:
  - `*bold text*` or `**bold**` → **bold**
  - `_italic text_` or `//italic//` → *italic*
  - `+underline+` → <u>underline</u>
  - `~strikethrough~` → ~~strikethrough~~
  - `` `code snippet` `` → `monospace code badge`
  - `[Link Text|https://...]` or `[Link Text]` → clickable link style (blue with underline)
  - `{color:red}Alert text{color}` or `{green}Success{/green}` → custom text color (red, green, blue, amber, purple, muted, or hex code)
  - Bullet lists (`* ` or `- `) and numbered lists (`1. `) are automatically formatted with proper indents and bullet glyphs.

- **Data Tables** (first line = headers, commas = columns):
  ```text
  Project, Owner, Updated, {c}Status
  [x] Onboarding Flow, Claire, 2h ago, {bg:yellow}*Review*
  [x] Checkout v2, Marcus, Yesterday, {bg:green}{color:green}*Active*{color}
  [ ] Billing Portal, Priya, Oct 29, ~Archived~
  ```
  - **Cell Background Fill**: `{bg:green}`, `{bg:yellow}`, `{bg:blue}`, `{bg:red}`, or `{bg:#hex}`
  - **Cell Alignment**: `{r}` / `{right}` (right align), `{c}` / `{center}` (center align)
  - **Checkboxes & Radios in Cells**: `[x]`, `[ ]`, `(o)`, `( )`
  - **Inline Cell Formatting**: Combine `*bold*`, `_italic_`, `[links]`, and colors inside any cell.

- **Checklist & Radio Groups**:
  ```text
  [x] Checked option
  [ ] Unchecked option
  (o) Selected radio button
  ( ) Unselected radio button
  ```
- **Tabs & Top Navbars**: Separate items with commas (e.g., `Overview, Activity, Members, Billing`) and pick the active tab index in the Inspector.
- **Scrollbars**: Double-click a Vertical or Horizontal Scrollbar on the canvas to cycle the thumb position (`0% → 50% → 100%`), or fine-tune it with the Inspector slider.
- **Modal Dialogs & Inputs**: Double-click the header/top zone to edit the primary title/label, or double-click the body area to edit secondary copy/placeholder text.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` | Open Quick Add stencil launcher |
| `Double-click` | Edit widget text inline (or cycle scrollbar thumb) |
| `Shift + Click` | Add or remove widget/group from selection |
| `Ctrl / Cmd + G` | Group selected widgets into a single entity |
| `Ctrl / Cmd + Shift + G` | Ungroup selected group |
| `Arrow Keys` | Nudge selection by `1px` (`Shift + Arrow` for `8px`) |
| `Ctrl / Cmd + D` | Duplicate selected widgets or groups |
| `Ctrl / Cmd + Z` | Undo last wireframe change |
| `Ctrl / Cmd + Shift + Z` | Redo wireframe change |
| `Backspace` / `Delete` | Delete selected widgets |
| `[` and `]` | Send backward / Bring forward |
| `Space + Drag` | Pan around the sketch canvas |
| `Escape` | Close modals, exit inline editing, or clear selection |

---

## Getting Started Locally

RoughDraft runs completely client-side in your browser with Node.js and Vite—no external database or API keys required.

### Prerequisites

- **Node.js** `v18+` (LTS recommended) and **npm**

### Installation & Development Server (Windows, macOS, Linux)

1. Open a terminal (`PowerShell`, `Command Prompt`, or `bash`) in the project directory:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Open **http://localhost:3000** in your browser.

### Building for Production

To create an optimized static production bundle in the `dist/` folder:

```bash
npm run build
npm run preview
```

---

## Project Structure

```text
├── index.html                  # App entry HTML & font imports
├── package.json                # Scripts and dependencies
├── vite.config.ts              # Vite + React + Tailwind v4 configuration
└── src/
    ├── App.tsx                 # Main studio workspace, canvas interactions, undo/redo, export
    ├── index.css               # Tailwind CSS v4 setup & studio scrollbar styles
    ├── main.tsx                # React root mount
    ├── components/
    │   ├── InspectorPanel.tsx  # Contextual right-hand property & prototype link inspector
    │   ├── Modals.tsx          # Starter kits, PNG/SVG/JSON export/import, shortcuts modal
    │   ├── PrototypePlayer.tsx # Interactive full-screen clickable prototype player
    │   ├── QuickAddPalette.tsx # '/' keyboard-driven stencil launcher
    │   ├── SketchWidgetSvg.tsx # Hand-drawn & clean SVG renderer for all 22 stencils
    │   └── StencilIcon.tsx     # Sidebar & Quick Add stencil icons
    ├── data/
    │   └── presets.ts          # Device presets, stencil definitions, and starter kits
    ├── types/
    │   └── wireframe.ts        # TypeScript data models for projects, screens, and widgets
    └── utils/
        └── sketchPath.ts       # Deterministic seeded sketchy SVG path generators
```

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 8**
- **Tailwind CSS v4**
- **Lucide React** (Studio toolbar & inspector iconography)
- **Custom Deterministic SVG Engine** (Seeded hand-drawn strokes, hachure/scribble lines, and pure vector export)
