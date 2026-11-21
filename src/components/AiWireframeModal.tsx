import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  FileText,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { DEVICE_DIMENSIONS } from '../data/presets';
import type { DevicePreset, WireframeWidget } from '../types/wireframe';

export type AiProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'openai-compatible';
export type AiGenerationMode = 'text' | 'screenshot';
export type AiInsertTarget = 'new-screen' | 'replace-screen' | 'append-screen';

interface AiModelOption {
  id: string;
  label: string;
  supportsVision: boolean;
}

interface AiProviderInfo {
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

export interface AiGeneratedWireframePayload {
  screenName: string;
  summary: string;
  device: DevicePreset;
  widgets: WireframeWidget[];
  provider: AiProviderId;
  model: string;
  insertTarget: AiInsertTarget;
}

interface AiWireframeModalProps {
  isOpen: boolean;
  initialMode?: AiGenerationMode;
  activeScreenName: string;
  activeDevice: DevicePreset;
  onClose: () => void;
  onApplyWireframe: (payload: AiGeneratedWireframePayload) => void;
}

const PROVIDER_PREF_KEY = 'roughdraft_ai_provider_pref_v1';

const TEXT_STARTER_PROMPTS = [
  {
    label: 'SaaS Billing & Plans',
    prompt:
      'A SaaS billing settings screen inside a browser frame with a top navbar, 3 pricing tier cards (Starter, Pro, Enterprise) with feature checklists, and a recent invoices data table below.',
  },
  {
    label: 'CRM Pipeline Dashboard',
    prompt:
      'A B2B sales dashboard with a left sidebar navigation box, 3 KPI summary cards across the top, a search bar + stage filter dropdown, and a deals data table with status fills.',
  },
  {
    label: 'Mobile Checkout Flow',
    prompt:
      'A mobile e-commerce checkout screen inside a phone frame with shipping address inputs, delivery radio options, an order summary card, and a primary Pay Now button.',
  },
  {
    label: 'Invite Team Modal',
    prompt:
      'A centered invite teammates modal dialog with email input fields, a role dropdown selector, permission checkboxes, and Cancel / Send Invites buttons.',
  },
];

async function normalizeImageForUpload(
  file: File
): Promise<{ dataUrl: string; mimeType: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const maxEdge = 1536;
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;

        if (targetW > maxEdge || targetH > maxEdge) {
          const ratio = Math.min(maxEdge / targetW, maxEdge / targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawUrl,
            mimeType: file.type || 'image/png',
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 0.9);
        resolve({ dataUrl, mimeType, width: targetW, height: targetH });
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const AiWireframeModal: React.FC<AiWireframeModalProps> = ({
  isOpen,
  initialMode = 'text',
  activeScreenName,
  activeDevice,
  onClose,
  onApplyWireframe,
}) => {
  const [mode, setMode] = useState<AiGenerationMode>(initialMode);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [customModel, setCustomModel] = useState<string>('');

  const [prompt, setPrompt] = useState('');
  const [screenshotNote, setScreenshotNote] = useState('');
  const [imagePreview, setImagePreview] = useState<{
    dataUrl: string;
    mimeType: string;
    name: string;
    width: number;
    height: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [device, setDevice] = useState<DevicePreset>(activeDevice);
  const [insertTarget, setInsertTarget] = useState<AiInsertTarget>('new-screen');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset contextual defaults when opening
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setDevice(activeDevice);
    setErrorMessage(null);
  }, [isOpen, initialMode, activeDevice]);

  // Fetch available server-configured providers
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadProviders = async () => {
      setLoadingProviders(true);
      try {
        const res = await fetch('/api/ai/providers');
        if (!res.ok) throw new Error('Failed to load AI providers');
        const data = (await res.json()) as { providers?: AiProviderInfo[] };
        if (cancelled || !Array.isArray(data.providers)) return;

        const list = data.providers;
        setProviders(list);

        // Restore last preference if valid, otherwise pick first configured provider
        let preferredProvider: AiProviderId | null = null;
        let preferredModel: string | null = null;
        try {
          const saved = localStorage.getItem(PROVIDER_PREF_KEY);
          if (saved) {
            const parsed = JSON.parse(saved) as { provider?: AiProviderId; model?: string };
            preferredProvider = parsed.provider || null;
            preferredModel = parsed.model || null;
          }
        } catch {
          // Ignore storage read error
        }

        const matchedPref = preferredProvider
          ? list.find((p) => p.id === preferredProvider)
          : undefined;
        const firstConfigured = list.find((p) => p.configured) || list[0];
        const chosen = matchedPref && matchedPref.configured ? matchedPref : firstConfigured;

        if (chosen) {
          setSelectedProvider(chosen.id);
          const validModel =
            preferredModel && chosen.models.some((m) => m.id === preferredModel)
              ? preferredModel
              : chosen.defaultModel;
          setSelectedModel(validModel);
          if (chosen.supportsCustomModel) {
            setCustomModel(preferredModel || chosen.defaultModel);
          }
        }
      } catch {
        // Leave fallback provider options if fetch fails
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    };

    loadProviders();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const currentProviderInfo = useMemo(
    () => providers.find((p) => p.id === selectedProvider),
    [providers, selectedProvider]
  );

  const handleSelectProvider = (id: AiProviderId) => {
    setSelectedProvider(id);
    setErrorMessage(null);
    const info = providers.find((p) => p.id === id);
    if (info) {
      setSelectedModel(info.defaultModel);
      if (info.supportsCustomModel) {
        setCustomModel(info.defaultModel);
      }
    }
  };

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose an image file (PNG, JPEG, or WebP).');
      return;
    }
    setErrorMessage(null);
    try {
      const normalized = await normalizeImageForUpload(file);
      setImagePreview({
        dataUrl: normalized.dataUrl,
        mimeType: normalized.mimeType,
        name: file.name || 'pasted-screenshot.png',
        width: normalized.width,
        height: normalized.height,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to process image.');
    }
  }, []);

  // Support pasting a screenshot directly into the modal
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setMode('screenshot');
            void handleImageFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, handleImageFile]);

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (isGenerating) return;

    if (mode === 'text' && !prompt.trim()) {
      setErrorMessage('Describe the screen or UI components you want to wireframe.');
      return;
    }
    if (mode === 'screenshot' && !imagePreview) {
      setErrorMessage('Upload, drop, or paste (Ctrl/Cmd+V) a UI screenshot or sketch first.');
      return;
    }

    const effectiveModel =
      currentProviderInfo?.supportsCustomModel && customModel.trim()
        ? customModel.trim()
        : selectedModel;

    try {
      localStorage.setItem(
        PROVIDER_PREF_KEY,
        JSON.stringify({ provider: selectedProvider, model: effectiveModel })
      );
    } catch {
      // Ignore storage write errors
    }

    const dims = DEVICE_DIMENSIONS[device];
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/ai/wireframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          provider: selectedProvider,
          model: effectiveModel,
          prompt: mode === 'text' ? prompt.trim() : screenshotNote.trim(),
          imageBase64: mode === 'screenshot' ? imagePreview?.dataUrl : undefined,
          imageMimeType: mode === 'screenshot' ? imagePreview?.mimeType : undefined,
          device,
          artboardWidth: dims.width,
          artboardHeight: dims.height,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        screenName?: string;
        summary?: string;
        device?: DevicePreset;
        widgets?: WireframeWidget[];
        provider?: AiProviderId;
        model?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `Generation failed (${res.status}).`);
      }

      if (!Array.isArray(data.widgets) || data.widgets.length === 0) {
        throw new Error('The AI model returned no widgets. Try refining your prompt.');
      }

      onApplyWireframe({
        screenName: data.screenName || 'AI Wireframe',
        summary: data.summary || '',
        device: data.device || device,
        widgets: data.widgets,
        provider: data.provider || selectedProvider,
        model: data.model || effectiveModel,
        insertTarget,
      });

      abortControllerRef.current = null;
      setIsGenerating(false);
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate wireframe.');
      setIsGenerating(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (!isOpen) return null;

  const targetDims = DEVICE_DIMENSIONS[device];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isGenerating) handleClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          void handleSubmit();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI Wireframe Generator</h2>
            <p className="text-xs text-slate-500">
              Turn a prompt or UI screenshot into editable low-fidelity stencils
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close AI wireframe generator"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Interactive Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('text');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'text'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Text to Wireframe</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('screenshot');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'screenshot'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Screenshot to Wireframe</span>
            </button>
          </div>

          {/* Mode Content */}
          {mode === 'text' ? (
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="ai-wireframe-prompt"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Describe the screen or layout
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Outputs RoughDraft stencils &amp; markup
                  </span>
                </div>
                <textarea
                  id="ai-wireframe-prompt"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A project management dashboard with top navbar, left filter sidebar, 3 KPI summary cards, and an interactive tasks data table..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                  Quick starter ideas
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setPrompt(item.prompt);
                        if (item.label.includes('Mobile')) setDevice('mobile');
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Upload or paste a screenshot / hand sketch
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Supports PNG, JPEG, WebP · Ctrl/Cmd+V paste
                  </span>
                </div>

                {imagePreview ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start gap-4">
                      <img
                        src={imagePreview.dataUrl}
                        alt="Uploaded UI screenshot preview"
                        className="h-36 w-48 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="truncate text-xs font-semibold text-slate-800">
                          {imagePreview.name}
                        </div>
                        <div className="font-mono-tabular text-xs text-slate-500">
                          {imagePreview.width} × {imagePreview.height} px
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Replace Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setImagePreview(null)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void handleImageFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                      isDragOver
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Upload className="mb-2 h-5 w-5 text-slate-400" />
                    <div className="text-xs font-semibold text-slate-700">
                      Click to upload, drag and drop, or press Ctrl/Cmd+V to paste
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Works with app screenshots, Figma mockups, or whiteboard photos
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageFile(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="ai-screenshot-notes"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  Optional conversion guidance
                </label>
                <input
                  id="ai-screenshot-notes"
                  type="text"
                  value={screenshotNote}
                  onChange={(e) => setScreenshotNote(e.target.value)}
                  placeholder="e.g. Simplify into 3 main cards, or transcribe the table headers accurately"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="h-px bg-slate-100" />

          {/* AI Provider & Model Configuration (Server-side routed) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">AI Provider &amp; Model</span>
              {loadingProviders ? (
                <span className="text-[11px] text-slate-400">Checking providers...</span>
              ) : currentProviderInfo ? (
                <span
                  className={`text-[11px] ${
                    currentProviderInfo.configured ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {currentProviderInfo.configured
                    ? 'Ready on server'
                    : `Configure ${currentProviderInfo.envVarHint} on server`}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(providers.length > 0
                ? providers
                : ([
                    { id: 'gemini', label: 'Google Gemini', configured: true, supportsVision: true },
                    { id: 'openai', label: 'OpenAI', configured: false, supportsVision: true },
                    { id: 'anthropic', label: 'Anthropic Claude', configured: false, supportsVision: true },
                    { id: 'deepseek', label: 'DeepSeek', configured: false, supportsVision: false },
                    { id: 'openai-compatible', label: 'Ollama / Compat', configured: false, supportsVision: true },
                  ] as Array<{ id: AiProviderId; label: string; configured: boolean; supportsVision: boolean }>)
              ).map((p) => {
                const isSelected = selectedProvider === p.id;
                const visionUnsupported = mode === 'screenshot' && !p.supportsVision;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p.id)}
                    className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="w-full truncate text-xs font-semibold">{p.label}</span>
                    <span
                      className={`mt-0.5 text-[10px] ${
                        visionUnsupported
                          ? 'text-amber-700'
                          : p.configured
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {visionUnsupported
                        ? 'Text only'
                        : p.configured
                        ? 'Active'
                        : 'Server env'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ai-model-select"
                  className="mb-1 block text-[11px] font-medium text-slate-600"
                >
                  Model
                </label>
                <select
                  id="ai-model-select"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    if (currentProviderInfo?.supportsCustomModel) {
                      setCustomModel(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  {(currentProviderInfo?.models || [
                    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Recommended)', supportsVision: true },
                  ]).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {currentProviderInfo?.supportsCustomModel ? (
                <div>
                  <label
                    htmlFor="ai-custom-model"
                    className="mb-1 block text-[11px] font-medium text-slate-600"
                  >
                    Custom model ID (optional)
                  </label>
                  <input
                    id="ai-custom-model"
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. llama3.2-vision, qwen2.5vl"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-end pb-1">
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {currentProviderInfo?.description ||
                      'Provider credentials are managed securely on the server.'}
                  </p>
                </div>
              )}
            </div>

            {mode === 'screenshot' &&
              currentProviderInfo &&
              (() => {
                const modelMeta = currentProviderInfo.models.find((m) => m.id === selectedModel);
                const modelSupportsVision = modelMeta
                  ? modelMeta.supportsVision
                  : currentProviderInfo.supportsVision;
                return !modelSupportsVision ? (
                  <p className="text-[11px] text-amber-700">
                    {currentProviderInfo.label} ({selectedModel}) supports Text-to-Wireframe only. Select Google Gemini, OpenAI, or Anthropic Claude for Screenshot-to-Wireframe.
                  </p>
                ) : null;
              })()}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Target Artboard & Insertion Behavior */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-700">Target Viewport</div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ['desktop', 'Desktop', Monitor],
                    ['tablet', 'Tablet', Tablet],
                    ['mobile', 'Mobile', Smartphone],
                  ] as const
                ).map(([preset, label, Icon]) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDevice(preset)}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      device === preset
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 font-mono-tabular text-[11px] text-slate-400">
                Artboard: {targetDims.width} × {targetDims.height} px
              </div>
            </div>

            <div>
              <label
                htmlFor="ai-insert-target"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Placement
              </label>
              <select
                id="ai-insert-target"
                value={insertTarget}
                onChange={(e) => setInsertTarget(e.target.value as AiInsertTarget)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="new-screen">Create New Screen (Recommended)</option>
                <option value="replace-screen">Replace Widgets on “{activeScreenName}”</option>
                <option value="append-screen">Add onto “{activeScreenName}”</option>
              </select>
              <div className="mt-1 text-[11px] text-slate-400">
                Fully editable and undoable with Ctrl/Cmd+Z
              </div>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="font-mono-tabular text-[11px] text-slate-400">
            Ctrl/Cmd + Enter to generate
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap"
            >
              {isGenerating ? 'Cancel' : 'Close'}
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating Wireframe...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>
                    {mode === 'screenshot' ? 'Convert Screenshot' : 'Generate Wireframe'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
