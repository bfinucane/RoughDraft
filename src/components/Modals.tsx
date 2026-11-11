import React, { useRef } from 'react';
import { Download, FileCode2, FileJson, Image as ImageIcon, Upload, X } from 'lucide-react';
import { STARTER_TEMPLATES } from '../data/presets';
import { ProjectData } from '../types/wireframe';

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
  onClose: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportJson: () => void;
  onImportJson: (data: ProjectData) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  screenName,
  projectName,
  onClose,
  onExportPng,
  onExportSvg,
  onExportJson,
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
          onImportJson(parsed as ProjectData);
          onClose();
        }
      } catch {
        // Ignore malformed files gracefully
      }
    };
    reader.readAsText(file);
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

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onExportJson();
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <FileJson className="h-4 w-4" />
              <span>Save .json Project</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              <span>Open .json Project</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
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
    ['/', 'Open Quick Add stencil launcher'],
    ['Double-click', 'Edit widget text / CSV rows inline'],
    ['Ctrl / Cmd + B, I, U', 'Format text as bold, italic, or underline'],
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

        <div className="divide-y divide-slate-100 px-6 py-2">
          {shortcuts.map(([keyCombo, desc]) => (
            <div key={keyCombo} className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-slate-600">{desc}</span>
              <kbd className="font-mono-tabular rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-800 whitespace-nowrap">
                {keyCombo}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
