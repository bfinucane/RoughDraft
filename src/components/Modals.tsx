import React, { useEffect, useRef, useState } from 'react';
import {
  ClipboardPaste,
  Download,
  FileCode2,
  FileJson,
  Image as ImageIcon,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { STARTER_TEMPLATES } from '../data/presets';
import { ProjectData } from '../types/wireframe';
import { parseRoughDraftClipboard } from '../utils/clipboard';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (project: ProjectData) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Starter Wireframe Kits</h2>
            <p className="text-xs text-slate-500">
              Start with a linked multi-screen prototype or a clean blank board.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close templates dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
          {STARTER_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                onSelectTemplate(tpl.build());
                onClose();
              }}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-600 hover:bg-blue-50/30"
            >
              <div>
                <div className="text-xs text-slate-500">{tpl.screenCount}</div>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{tpl.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{tpl.summary}</p>
              </div>
              <span className="mt-4 text-xs font-semibold text-blue-600">
                Load Wireframe Kit →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ExportModalProps {
  isOpen: boolean;
  screenName: string;
  projectName: string;
  linkedFileName: string | null;
  isFileDirty: boolean;
  onClose: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onSaveFile: () => Promise<void> | void;
  onSaveFileAs: () => Promise<void> | void;
  onOpenFilePicker: () => Promise<boolean>;
  onImportJson: (data: ProjectData, fileName?: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  screenName,
  projectName,
  linkedFileName,
  isFileDirty,
  onClose,
  onExportPng,
  onExportSvg,
  onSaveFile,
  onSaveFileAs,
  onOpenFilePicker,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && Array.isArray(parsed.screens) && parsed.screens.length > 0) {
          onImportJson(parsed as ProjectData, file.name);
          onClose();
        }
      } catch {
        // Ignore malformed files gracefully
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Export &amp; Project File</h2>
            <p className="text-xs text-slate-500">
              {projectName} · Current screen: {screenName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-6">
          <button
            type="button"
            onClick={() => {
              onExportPng();
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-blue-600 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Export Current Screen as PNG (2×)
                </div>
                <div className="text-xs text-slate-500">
                  High-resolution raster image ready for docs, tickets, or slide decks
                </div>
              </div>
            </div>
            <Download className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              onExportSvg();
              onClose();
            }}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-blue-600 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Export Current Screen as Vector SVG
                </div>
                <div className="text-xs text-slate-500">
                  Scalable hand-drawn vector paths for crisp print or vector tools
                </div>
              </div>
            </div>
            <Download className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          <div className="border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Local Project File (.roughdraft.json)</span>
              <span className="text-[11px] text-slate-500 truncate max-w-[230px]">
                {linkedFileName
                  ? `${linkedFileName}${isFileDirty ? ' (unsaved edits)' : ' (saved)'}`
                  : 'No file linked yet'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onSaveFile();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{linkedFileName ? 'Save' : 'Save File'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveFileAs();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <FileJson className="h-3.5 w-3.5" />
                <span>Save As…</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const handled = await onOpenFilePicker();
                  if (handled) {
                    onClose();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Open File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              In Chrome or Edge (standalone window / localhost), <strong>Save</strong> (Ctrl/Cmd+S) overwrites the linked file directly instead of downloading a copy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    ['Ctrl / Cmd + S', 'Save changes to linked project file (or Save As)'],
    ['Right-click', 'Open context menu (Delete, Duplicate, Group, Layering)'],
    ['/', 'Open Quick Add stencil launcher'],
    ['Double-click', 'Edit widget text / CSV rows inline'],
    ['Ctrl / Cmd + B, I, U', 'Format text as bold, italic, or underline'],
    ['Ctrl / Cmd + C', 'Copy selected widgets, or current screen if none selected'],
    ['Ctrl / Cmd + V', 'Paste widgets or entire screen (works across tabs)'],
    ['Ctrl / Cmd + A', 'Select all widgets on artboard'],
    ['Shift + Click', 'Add or remove widget/group from selection'],
    ['Ctrl / Cmd + G', 'Group selected widgets into one entity'],
    ['Ctrl / Cmd + Shift + G', 'Ungroup selected group'],
    ['Arrow Keys', 'Nudge selection by 1px (Shift for 8px)'],
    ['Ctrl / Cmd + D', 'Duplicate selected widgets'],
    ['Ctrl / Cmd + Z', 'Undo last wireframe change'],
    ['Ctrl / Cmd + Shift + Z', 'Redo wireframe change'],
    ['Backspace / Delete', 'Delete selected widgets'],
    ['[ and ]', 'Send backward / Bring forward'],
    ['Space + Drag', 'Pan around the sketch canvas'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto px-6 py-2">
          {shortcuts.map(([keyCombo, desc]) => (
            <div key={keyCombo} className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <span className="text-slate-600">{desc}</span>
              <kbd className="font-mono-tabular rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-800 whitespace-nowrap shrink-0">
                {keyCombo}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface PasteClipboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasteText: (rawText: string) => boolean;
}

export const PasteClipboardModal: React.FC<PasteClipboardModalProps> = ({
  isOpen,
  onClose,
  onPasteText,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tryApply = (value: string) => {
    const parsed = parseRoughDraftClipboard(value);
    if (!parsed) {
      setError(
        'Clipboard text does not contain valid RoughDraft screen or widget JSON. Copy a screen in another RoughDraft tab first, then press Ctrl/Cmd+V here.'
      );
      return;
    }
    const ok = onPasteText(value);
    if (ok) {
      onClose();
    } else {
      setError('Unable to import the pasted screen or widget data.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Paste Screen or Widgets</h2>
            <p className="text-xs text-slate-500">
              Press Ctrl/Cmd + V below to paste data copied from another RoughDraft window
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close paste dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-4">
          <textarea
            ref={textareaRef}
            rows={5}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text/plain');
              if (pasted && parseRoughDraftClipboard(pasted)) {
                e.preventDefault();
                tryApply(pasted);
              }
            }}
            placeholder='Press Ctrl/Cmd+V to paste copied RoughDraft JSON ({"roughdraft": "screen-v1", ...})'
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => tryApply(text)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>Paste into Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
