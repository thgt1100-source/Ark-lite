import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileCode2,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react';
import type {
  ArkState,
  ImageGenerationMode,
  ImageGridMode,
  StoryImageConfig,
  Turn,
} from '../types/ark';
import {
  DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  IMAGE_GENERATION_MODE_LABELS,
  IMAGE_GRID_MODE_LABELS,
  IMAGE_PROMPT_TEMPLATE_VARIABLES,
  previewStoryImagePrompt,
} from '../utils/api';

interface ImagePromptTemplatePanelProps {
  appState: ArkState;
  currentTurn?: Turn;
  storyImageConfig: StoryImageConfig;
  onUpdateStoryImageConfig: (patch: Partial<StoryImageConfig>) => void;
  overrideStoryText?: string;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
  defaultOpen?: boolean;
}

export function ImagePromptTemplatePanel({
  appState,
  currentTurn,
  storyImageConfig,
  onUpdateStoryImageConfig,
  overrideStoryText,
  onNotify,
  defaultOpen = false,
}: ImagePromptTemplatePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('after');
  const [draftTemplate, setDraftTemplate] = useState(
    storyImageConfig.promptTemplate?.trim() ||
      DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = storyImageConfig.promptTemplate?.trim() || '';
    setDraftTemplate(saved || DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE);
  }, [storyImageConfig.promptTemplate]);

  const isCustomSaved = Boolean(storyImageConfig.promptTemplate?.trim());
  const hasUnsavedChanges =
    draftTemplate.trim() !==
    (
      storyImageConfig.promptTemplate?.trim() ||
      DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE
    ).trim();

  const preview = useMemo(
    () =>
      previewStoryImagePrompt({
        state: appState,
        turn: currentTurn,
        storyImageConfig,
        draftTemplate,
        overrideStoryText,
      }),
    [appState, currentTurn, storyImageConfig, draftTemplate, overrideStoryText],
  );

  const handleInsertToken = (token: string) => {
    const el = textareaRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next =
        draftTemplate.slice(0, start) + token + draftTemplate.slice(end);
      setDraftTemplate(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setDraftTemplate((prev) =>
        prev.trim() ? `${prev.trimEnd()} ${token}` : token,
      );
    }
  };

  const handleSaveTemplate = () => {
    const cleaned = draftTemplate.trim();
    if (!cleaned) {
      onUpdateStoryImageConfig({ promptTemplate: '' });
      setDraftTemplate(DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE);
      onNotify?.('Đã khôi phục mẫu prompt sinh ảnh mặc định.');
      return;
    }
    const isSameAsDefault =
      cleaned === DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE.trim();
    onUpdateStoryImageConfig({
      promptTemplate: isSameAsDefault ? '' : cleaned,
    });
    onNotify?.('Đã lưu mẫu prompt sinh ảnh vào cấu hình.');
  };

  const handleResetTemplate = () => {
    setDraftTemplate(DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE);
    onUpdateStoryImageConfig({ promptTemplate: '' });
    onNotify?.('Đã khôi phục mẫu prompt sinh ảnh mặc định.');
  };

  const handleCopyPreview = async () => {
    const text =
      previewMode === 'before'
        ? preview.beforeInjection
        : preview.afterInjection;
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.(
        previewMode === 'before'
          ? 'Đã sao chép prompt Trước khi tiêm.'
          : 'Đã sao chép prompt Sau khi tiêm.',
      );
    } catch {
      onNotify?.('Không thể sao chép tự động trên trình duyệt này.', 'err');
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/75">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span className="text-xs font-semibold text-slate-100">
              Mẫu Prompt sinh ảnh & Xem trước
            </span>
            {isCustomSaved && (
              <span className="text-[10px] font-semibold text-emerald-300">
                (Đã tùy chỉnh)
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Chỉnh sửa biến mẫu & so sánh Trước khi tiêm / Sau khi tiêm theo cảnh
            hiện tại
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08]">
          <span>{open ? 'Thu gọn' : 'Mở mẫu'}</span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.07] p-3">
          {/* Quick Mode / Grid / Image Count Selectors */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                Chế độ sinh ({'${image_generation_mode}'})
              </label>
              <select
                value={storyImageConfig.imageGenerationMode || 'scene'}
                onChange={(e) =>
                  onUpdateStoryImageConfig({
                    imageGenerationMode: e.target.value as ImageGenerationMode,
                  })
                }
                className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
              >
                {(
                  Object.keys(
                    IMAGE_GENERATION_MODE_LABELS,
                  ) as ImageGenerationMode[]
                ).map((mode) => (
                  <option key={mode} value={mode}>
                    {IMAGE_GENERATION_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                Bố cục lưới ({'${image_grid_mode}'})
              </label>
              <select
                value={storyImageConfig.imageGridMode || 'single'}
                onChange={(e) =>
                  onUpdateStoryImageConfig({
                    imageGridMode: e.target.value as ImageGridMode,
                  })
                }
                className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
              >
                {(Object.keys(IMAGE_GRID_MODE_LABELS) as ImageGridMode[]).map(
                  (grid) => (
                    <option key={grid} value={grid}>
                      {IMAGE_GRID_MODE_LABELS[grid]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                Số lượng ảnh ({'${image_count}'})
              </label>
              <select
                value={String(storyImageConfig.imageCount || 1)}
                onChange={(e) =>
                  onUpdateStoryImageConfig({
                    imageCount: Number(e.target.value) || 1,
                  })
                }
                className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
              >
                <option value="1">1 ảnh</option>
                <option value="2">2 ảnh</option>
                <option value="4">4 ảnh</option>
              </select>
            </div>
          </div>

          {/* 1-Tap Variable Insertion Strip */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">
              Chèn nhanh biến ngữ cảnh & phong cách vào mẫu:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_PROMPT_TEMPLATE_VARIABLES.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => handleInsertToken(item.token)}
                  title={`Chèn ${item.token} (${item.label})`}
                  className={`inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition-all active:scale-[0.98] ${
                    item.group === 'style'
                      ? 'bg-sky-500/14 text-sky-200 ring-1 ring-inset ring-sky-400/28 hover:bg-sky-500/24'
                      : item.group === 'mode'
                        ? 'bg-amber-500/12 text-amber-200 ring-1 ring-inset ring-amber-400/26 hover:bg-amber-500/22'
                        : 'bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-400/26 hover:bg-emerald-500/22'
                  }`}
                >
                  <Plus className="h-2.5 w-2.5 shrink-0" />
                  <span>{item.token}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">
                Nội dung mẫu Prompt sinh ảnh
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.11] hover:text-white whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Khôi phục mặc định</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                    hasUnsavedChanges
                      ? 'bg-sky-500 text-white shadow-[0_4px_12px_-4px_rgba(14,165,233,0.55)] hover:bg-sky-400'
                      : 'bg-emerald-500/16 text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24'
                  }`}
                >
                  <Save className="h-3 w-3" />
                  <span>{hasUnsavedChanges ? 'Lưu mẫu *' : 'Lưu mẫu'}</span>
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={draftTemplate}
              onChange={(e) => setDraftTemplate(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0b1220] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          {/* Live Prompt Preview: Trước khi tiêm / Sau khi tiêm */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0b1220]/95 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-[11px] font-semibold text-slate-200">
                  Xem trước Prompt
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex rounded-lg bg-[#162032] p-0.5 ring-1 ring-inset ring-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('before')}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                      previewMode === 'before'
                        ? 'bg-amber-500/22 text-amber-100 ring-1 ring-inset ring-amber-400/38'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Trước khi tiêm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('after')}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                      previewMode === 'after'
                        ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/38'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sau khi tiêm
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.12] hover:text-white"
                  title="Sao chép nội dung xem trước"
                >
                  <Copy className="h-3 w-3" />
                  <span>Chép</span>
                </button>
              </div>
            </div>

            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[#070d18] p-2.5 font-mono text-[11px] leading-relaxed text-slate-200 ring-1 ring-inset ring-white/[0.05]">
              {previewMode === 'before'
                ? preview.beforeInjection
                : preview.afterInjection}
            </pre>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>
                {previewMode === 'before'
                  ? 'Hiển thị mẫu gốc với các biến ${...} chưa thay thế.'
                  : 'Hiển thị prompt thực tế đã tiêm ngữ cảnh, nhân vật, thời gian, địa điểm & phong cách.'}
              </span>
              <span className="font-mono">
                {(previewMode === 'before'
                  ? preview.beforeInjection
                  : preview.afterInjection
                ).length}{' '}
                ký tự
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
