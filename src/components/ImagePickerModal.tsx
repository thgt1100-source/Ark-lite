import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookImage,
  Check,
  Image as ImageIcon,
  Paperclip,
  Search,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  CharacterPortrait,
  PendingImage,
  Turn,
} from '../types/ark';
import { matchesQuery } from '../utils/search';

export type ImagePickerSource = 'all' | 'portraits' | 'story' | 'attached';

export interface ImagePickerTarget {
  mode: 'composer' | 'turn' | 'character';
  portraitId?: string;
  portraitName?: string;
}

export interface PickableImageItem {
  id: string;
  src: string;
  title: string;
  subtitle: string;
  source: Exclude<ImagePickerSource, 'all'>;
  sourceLabel: string;
  caption?: string;
}

interface ImagePickerModalProps {
  target: ImagePickerTarget;
  portraits: CharacterPortrait[];
  turns: Turn[];
  currentPage: number;
  pendingImage?: PendingImage | null;
  onClose: () => void;
  onAttachToComposer?: (img: PendingImage, suggestedCaption?: string) => void;
  onAssignToCurrentTurn?: (src: string, subjectLabel: string) => void;
  onAssignToCharacter?: (portraitId: string, src: string, label: string) => void;
  onPickFromDevice?: () => void;
}

const SOURCE_TABS: Array<{
  id: ImagePickerSource;
  label: string;
}> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'portraits', label: 'Ảnh NV/NPC' },
  { id: 'story', label: 'Ảnh trong truyện' },
  { id: 'attached', label: 'Ảnh đính kèm' },
];

export const ImagePickerModal = memo(function ImagePickerModal({
  target,
  portraits,
  turns,
  currentPage,
  pendingImage,
  onClose,
  onAttachToComposer,
  onAssignToCurrentTurn,
  onAssignToCharacter,
  onPickFromDevice,
}: ImagePickerModalProps) {
  const [sourceFilter, setSourceFilter] = useState<ImagePickerSource>(
    target.mode === 'character' ? 'all' : 'all',
  );
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignCharId, setAssignCharId] = useState<string>(
    target.portraitId || portraits[0]?.id || '',
  );
  const [localUploadItem, setLocalUploadItem] =
    useState<PickableImageItem | null>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const allItems = useMemo<PickableImageItem[]>(() => {
    const items: PickableImageItem[] = [];

    if (localUploadItem) {
      items.push(localUploadItem);
    }

    // 1. Character / NPC Portraits
    for (const p of portraits) {
      const src = (p.imageData || '').trim();
      if (!src) continue;
      items.push({
        id: `portrait:${p.id}`,
        src,
        title: p.name || 'Nhân vật',
        subtitle: p.role || (p.isMc ? 'Nhân vật chính' : 'NPC'),
        source: 'portraits',
        sourceLabel: 'Ảnh NV/NPC',
        caption: p.name ? `Chân dung ${p.name}` : undefined,
      });
    }

    // 2. Story generated images (newest first)
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      const src = (t.storyImageData || '').trim();
      if (!src) continue;
      const subject = (t.storyImageSubject || '').trim();
      items.push({
        id: `story:${t.id || i}`,
        src,
        title: subject || `Minh họa Trang ${i + 1}`,
        subtitle: `Trang ${i + 1}`,
        source: 'story',
        sourceLabel: 'Ảnh trong truyện',
        caption: subject || `Ảnh minh họa Trang ${i + 1}`,
      });
    }

    // 3. Attached images (pending + turn attachments, newest first)
    if (pendingImage?.dataUrl) {
      items.push({
        id: 'attached:pending',
        src: pendingImage.dataUrl,
        title: pendingImage.name || 'Ảnh đang chờ gửi',
        subtitle: 'Đang đính kèm lượt mới',
        source: 'attached',
        sourceLabel: 'Ảnh đính kèm',
        caption: pendingImage.name,
      });
    }

    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      const src = (t.imageData || '').trim();
      if (!src) continue;
      const cap = (t.imageCaption || '').trim();
      items.push({
        id: `attached:${t.id || i}`,
        src,
        title: cap || `Ảnh đính kèm Trang ${i + 1}`,
        subtitle: `Trang ${i + 1}`,
        source: 'attached',
        sourceLabel: 'Ảnh đính kèm',
        caption: cap || undefined,
      });
    }

    return items;
  }, [localUploadItem, portraits, turns, pendingImage]);

  const counts = useMemo(() => {
    let portraitsCount = 0;
    let storyCount = 0;
    let attachedCount = 0;
    for (const item of allItems) {
      if (item.source === 'portraits') portraitsCount++;
      else if (item.source === 'story') storyCount++;
      else attachedCount++;
    }
    return {
      all: allItems.length,
      portraits: portraitsCount,
      story: storyCount,
      attached: attachedCount,
    };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim();
    return allItems.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (!q) return true;
      return matchesQuery(
        `${item.title} ${item.subtitle} ${item.sourceLabel} ${item.caption || ''}`,
        q,
      );
    });
  }, [allItems, sourceFilter, query]);

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === selectedId) || null,
    [allItems, selectedId],
  );

  const hasCurrentTurn = currentPage >= 0 && currentPage < turns.length;

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      const item: PickableImageItem = {
        id: `local:${Date.now()}`,
        src: dataUrl,
        title: file.name || 'Ảnh từ thiết bị',
        subtitle: 'Tải lên từ máy',
        source: 'attached',
        sourceLabel: 'Ảnh đính kèm',
        caption: file.name.replace(/\.[^.]+$/, ''),
      };
      setLocalUploadItem(item);
      setSelectedId(item.id);
      if (sourceFilter !== 'all' && sourceFilter !== 'attached') {
        setSourceFilter('all');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmAttachComposer = () => {
    if (!selectedItem || !onAttachToComposer) return;
    const safeName =
      selectedItem.title.replace(/[^\p{L}\p{N}_ .-]+/gu, '').trim() ||
      'anh_da_chon';
    onAttachToComposer(
      {
        dataUrl: selectedItem.src,
        name: `${safeName}.png`,
      },
      selectedItem.caption,
    );
    onClose();
  };

  const handleConfirmAssignTurn = () => {
    if (!selectedItem || !onAssignToCurrentTurn || !hasCurrentTurn) return;
    onAssignToCurrentTurn(selectedItem.src, selectedItem.title);
    onClose();
  };

  const handleConfirmAssignCharacter = (portraitIdOverride?: string) => {
    const targetPid = portraitIdOverride || target.portraitId || assignCharId;
    if (!selectedItem || !onAssignToCharacter || !targetPid) return;
    onAssignToCharacter(targetPid, selectedItem.src, selectedItem.title);
    onClose();
  };

  const modalTitle =
    target.mode === 'character' && target.portraitName
      ? `Chọn ảnh cho ${target.portraitName}`
      : 'Chọn ảnh';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#070c16]/78 sm:items-center sm:p-4 backdrop-blur-sm"
    >
      <input
        ref={localFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLocalFileChange}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[#162032] ring-1 ring-white/[0.10] shadow-[0_24px_60px_-14px_rgba(2,6,23,0.88)] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ImageIcon className="h-4 w-4 shrink-0 text-sky-300" />
            <h2 className="truncate text-sm font-bold text-slate-50">
              {modalTitle}
            </h2>
            <span className="shrink-0 text-[11px] font-medium text-slate-400 tabular-nums">
              {allItems.length} ảnh
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (target.mode === 'composer' && onPickFromDevice) {
                  onClose();
                  onPickFromDevice();
                } else {
                  localFileInputRef.current?.click();
                }
              }}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.06] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.11] hover:text-white whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5 text-sky-300" />
              <span>Từ máy</span>
            </button>
            <button
              type="button"
              aria-label="Đóng chọn ảnh"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.12]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs + Search */}
        <div className="space-y-2 border-b border-white/[0.07] bg-[#121b2b] px-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {SOURCE_TABS.map((tab) => {
              const active = sourceFilter === tab.id;
              const count = counts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSourceFilter(tab.id)}
                  className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                      : 'bg-white/[0.045] text-slate-300 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.09] hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      active ? 'text-sky-200/90' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm ảnh theo tên nhân vật, số trang hoặc chú thích..."
              className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625] py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm ảnh"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lightweight Thumbnail Grid */}
        <div className="min-h-[200px] flex-1 overflow-y-auto bg-[#0f1726] p-3">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.10] bg-[#131d2f] px-4 py-8 text-center">
              <ImageIcon className="mb-2 h-7 w-7 text-slate-500" />
              <p className="text-xs font-medium text-slate-300">
                {allItems.length === 0
                  ? 'Chưa có ảnh nào trong thư viện hoặc các lượt truyện.'
                  : 'Không có ảnh nào khớp với bộ lọc hiện tại.'}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Bạn có thể sinh ảnh bằng Seedream 5 Pro hoặc tải ảnh trực tiếp
                từ thiết bị.
              </p>
              <button
                type="button"
                onClick={() => localFileInputRef.current?.click()}
                className="mt-3 inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Chọn ảnh từ thiết bị</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filteredItems.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedId((prev) => (prev === item.id ? null : item.id))
                    }
                    className={`group relative aspect-square overflow-hidden rounded-xl bg-[#0a101d] text-left transition-transform active:scale-[0.98] focus:outline-none ${
                      isSelected
                        ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-[#0f1726]'
                        : 'ring-1 ring-white/[0.08] hover:ring-sky-400/50'
                    }`}
                  >
                    <img
                      src={item.src}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#080d18]/92 via-[#080d18]/45 to-transparent"
                    />
                    <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 block truncate text-[11px] font-semibold text-slate-100">
                      {item.title}
                    </span>

                    {/* Compact Source Indicator */}
                    <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#0b1220]/80 text-slate-200 ring-1 ring-white/[0.12]">
                      {item.source === 'portraits' ? (
                        <Users className="h-3 w-3 text-emerald-300" />
                      ) : item.source === 'story' ? (
                        <BookImage className="h-3 w-3 text-sky-300" />
                      ) : (
                        <Paperclip className="h-3 w-3 text-amber-300" />
                      )}
                    </span>

                    {isSelected && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Preview & Confirm Footer */}
        <div className="border-t border-white/[0.08] bg-[#141e30] px-4 py-3">
          {!selectedItem ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span>Chạm vào một ảnh để xem trước và xác nhận áp dụng.</span>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[34px] shrink-0 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
              >
                Đóng
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <img
                  src={selectedItem.src}
                  alt={selectedItem.title}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 shrink-0 rounded-xl bg-[#0a101d] object-cover ring-1 ring-white/[0.12] sm:h-20 sm:w-20"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-50">
                    {selectedItem.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">
                    {selectedItem.sourceLabel} · {selectedItem.subtitle}
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {target.mode === 'character' &&
                      target.portraitId &&
                      onAssignToCharacter && (
                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmAssignCharacter(target.portraitId)
                          }
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500 whitespace-nowrap"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>
                            Gán cho {target.portraitName || 'nhân vật'}
                          </span>
                        </button>
                      )}

                    {onAttachToComposer && (
                      <button
                        type="button"
                        onClick={handleConfirmAttachComposer}
                        className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap ${
                          target.mode === 'character'
                            ? 'bg-white/[0.06] text-slate-100 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11]'
                            : 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500'
                        }`}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>Đính kèm lượt mới</span>
                      </button>
                    )}

                    {onAssignToCurrentTurn && hasCurrentTurn && (
                      <button
                        type="button"
                        onClick={handleConfirmAssignTurn}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-colors hover:bg-emerald-500/22 whitespace-nowrap"
                      >
                        <BookImage className="h-3.5 w-3.5" />
                        <span>Gán vào Trang {currentPage + 1}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Character Assignment Row (when opened from composer/utility) */}
              {target.mode !== 'character' &&
                onAssignToCharacter &&
                portraits.length > 0 && (
                  <div className="flex items-center gap-2 border-t border-white/[0.07] pt-2">
                    <select
                      aria-label="Chọn nhân vật để gán ảnh"
                      value={assignCharId}
                      onChange={(e) => setAssignCharId(e.target.value)}
                      className="min-h-[34px] min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-[#0e1625] px-2.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    >
                      {portraits.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isMc ? ' (NV chính)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!assignCharId}
                      onClick={() => handleConfirmAssignCharacter(assignCharId)}
                      className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.11] disabled:opacity-40 whitespace-nowrap"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Gán cho NV</span>
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
