import { useMemo, useState } from 'react';
import {
  Archive,
  ClipboardPaste,
  Copy,
  Download,
  Play,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { SaveSlot } from '../types/ark';
import { matchesQuery } from '../utils/search';

interface DataViewProps {
  slots: SaveSlot[];
  hasCheckpoint: boolean;
  onTriggerImport: () => void;
  onImportJsonText: (raw: string) => void;
  onSaveSlot: () => void;
  onDownloadSave: (slotIdx?: number) => void;
  onDownloadFullBackup: () => void;
  onUndoCheckpoint: () => void;
  onRequestResetClean: () => void;
  onLoadSlot: (idx: number) => void;
  onCloneSlot: (idx: number) => void;
  onDeleteSlot: (idx: number) => void;
}

export function DataView({
  slots,
  hasCheckpoint,
  onTriggerImport,
  onImportJsonText,
  onSaveSlot,
  onDownloadSave,
  onDownloadFullBackup,
  onUndoCheckpoint,
  onRequestResetClean,
  onLoadSlot,
  onCloneSlot,
  onDeleteSlot,
}: DataViewProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [slotSearch, setSlotSearch] = useState('');

  const filteredSlots = useMemo(() => {
    const indexed = slots.map((slot, originalIdx) => ({ slot, originalIdx }));
    if (!slotSearch.trim()) return indexed;
    return indexed.filter(({ slot }) => {
      const metaMatch = matchesQuery(
        `${slot.name || ''} ${slot.player?.name || ''} ${slot.world?.name || ''}`,
        slotSearch,
      );
      if (metaMatch) return true;
      return (slot.turns || []).some(
        (t) =>
          matchesQuery(t.user || '', slotSearch) ||
          matchesQuery(t.assistant || '', slotSearch),
      );
    });
  }, [slots, slotSearch]);

  const handleImportPaste = () => {
    onImportJsonText(pasteValue.trim());
  };

  return (
    <section className="space-y-3.5">
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-slate-50">
            Quản lý Dữ liệu &amp; Tải Save
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Nhập save (.json), tải file save về máy, quản lý đa slot và hoàn tác
            checkpoint.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTriggerImport}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Nhập Save (.json)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>Dán JSON</span>
          </button>
          <button
            type="button"
            onClick={onSaveSlot}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Lưu Slot Mới</span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadSave()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải Save (.json)</span>
          </button>
          <button
            type="button"
            onClick={onDownloadFullBackup}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Xuất Full Backup</span>
          </button>
          <button
            type="button"
            disabled={!hasCheckpoint}
            onClick={onUndoCheckpoint}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-amber-500/14 px-3 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/22 active:scale-[0.98] disabled:opacity-40 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Hoàn tác</span>
          </button>
          <button
            type="button"
            onClick={onRequestResetClean}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22 active:scale-[0.98] whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reset sạch dữ liệu</span>
          </button>
        </div>

        {showPaste && (
          <div className="mt-3.5 space-y-2.5 border-t border-white/[0.07] pt-3.5">
            <label className="block text-xs font-medium text-slate-300">
              Dán JSON save / backup
            </label>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              rows={5}
              placeholder='{"turns": [...]}'
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <button
              type="button"
              onClick={handleImportPaste}
              className="min-h-[38px] rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500"
            >
              Nạp JSON
            </button>
          </div>
        )}
      </div>

      {/* Slots List */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-50">
            Danh sách Slot &amp; Tải Save
          </h3>
          {slots.length > 0 && (
            <span className="text-xs text-slate-400 tabular-nums">
              {slotSearch.trim()
                ? `${filteredSlots.length} / ${slots.length} slot`
                : `${slots.length} slot`}
            </span>
          )}
        </div>

        {slots.length > 0 && (
          <div className="relative mb-3.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={slotSearch}
              onChange={(e) => setSlotSearch(e.target.value)}
              aria-label="Tìm kiếm slot save"
              placeholder="Tìm slot theo tên, nhân vật, thế giới hoặc nội dung truyện..."
              className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {slotSearch && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm slot"
                onClick={() => setSlotSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {!slots.length ? (
          <p className="text-xs text-slate-400">
            Chưa có slot nào. Bấm &quot;Lưu Slot Mới&quot; hoặc nhập file Save
            (.json).
          </p>
        ) : !filteredSlots.length ? (
          <p className="text-xs text-slate-400">
            Không tìm thấy slot nào khớp với &quot;{slotSearch.trim()}&quot;.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredSlots.map(({ slot: s, originalIdx }) => (
              <div
                key={s.id || originalIdx}
                className="rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.07]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-50">
                    {s.name || `Slot ${originalIdx + 1}`}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {s.turns?.length || 0} lượt
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Cập nhật:{' '}
                  {s.savedAt ? new Date(s.savedAt).toLocaleString('vi-VN') : ''}
                  {s.world?.name ? ` · ${s.world.name}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLoadSlot(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24 whitespace-nowrap"
                  >
                    <Play className="h-3 w-3" />
                    <span>Tải vào chơi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadSave(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-colors hover:bg-emerald-500/22 whitespace-nowrap"
                  >
                    <Download className="h-3 w-3" />
                    <span>Tải Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloneSlot(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] whitespace-nowrap"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Nhân bản</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSlot(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-colors hover:bg-rose-500/22 whitespace-nowrap"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
