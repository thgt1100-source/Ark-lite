import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type {
  ContextConfig,
  MemoryManagerConfig,
  ViewName,
} from '../types/ark';
import { MemoryManagerPanel } from './MemoryManagerPanel';

interface ContextViewProps {
  context: ContextConfig;
  memory: MemoryManagerConfig;
  turnCount: number;
  currentPage: number;
  hasProxyConfigured: boolean;
  isSyncingMemory: boolean;
  isSyncingStates: boolean;
  isSummarizing: boolean;
  onSaveContext: (next: ContextConfig) => void;
  onNavigate: (view: ViewName) => void;
  onUpdateMemory: (
    updater: (prev: MemoryManagerConfig) => MemoryManagerConfig,
  ) => void;
  onExtractMemories: (turnIndex: number) => void;
  onExtractStates: (turnIndex: number) => void;
  onRunRollingSummary: (forceAllOlder?: boolean) => void;
}

export function ContextView({
  context,
  memory,
  turnCount,
  currentPage,
  hasProxyConfigured,
  isSyncingMemory,
  isSyncingStates,
  isSummarizing,
  onSaveContext,
  onNavigate,
  onUpdateMemory,
  onExtractMemories,
  onExtractStates,
  onRunRollingSummary,
}: ContextViewProps) {
  const [historyTurns, setHistoryTurns] = useState(
    String(context.historyTurns || 12),
  );
  const [targetLength, setTargetLength] = useState(
    context.targetLength || '900 - 1800 từ',
  );
  const [entitiesNote, setEntitiesNote] = useState(context.entitiesNote || '');

  useEffect(() => {
    setHistoryTurns(String(context.historyTurns || 12));
    setTargetLength(context.targetLength || '900 - 1800 từ');
    setEntitiesNote(context.entitiesNote || '');
  }, [context]);

  const handleSave = () => {
    const parsedTurns = Math.min(
      100,
      Math.max(1, parseInt(historyTurns, 10) || 12),
    );
    onSaveContext({
      historyTurns: parsedTurns,
      targetLength: targetLength.trim() || '900 - 1800 từ',
      entitiesNote,
    });
  };

  return (
    <section className="space-y-3.5">
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Cửa sổ Ngữ cảnh &amp; Thực thể
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Điều chỉnh số lượt lịch sử gửi kèm và ghi chú thực thể/bối cảnh.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Lưu Ngữ cảnh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Số lượt lịch sử tối đa
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={historyTurns}
              onChange={(e) => setHistoryTurns(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2 text-sm text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Mục tiêu độ dài hồi đáp (từ)
            </label>
            <input
              type="text"
              value={targetLength}
              onChange={(e) => setTargetLength(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
        </div>

        <div className="mt-3.5">
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Ghi chú thực thể &amp; thế giới
          </label>
          <textarea
            value={entitiesNote}
            onChange={(e) => setEntitiesNote(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>
      </div>

      {/* AI Memory & State Manager Hub */}
      <MemoryManagerPanel
        memory={memory}
        turnCount={turnCount}
        currentPage={currentPage}
        historyTurns={context.historyTurns || 12}
        hasProxyConfigured={hasProxyConfigured}
        isSyncingMemory={isSyncingMemory}
        isSyncingStates={isSyncingStates}
        isSummarizing={isSummarizing}
        onNavigate={onNavigate}
        onUpdateMemory={onUpdateMemory}
        onExtractMemories={onExtractMemories}
        onExtractStates={onExtractStates}
        onRunRollingSummary={onRunRollingSummary}
      />
    </section>
  );
}

