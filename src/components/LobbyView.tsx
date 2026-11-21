import {
  Clock,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Play,
  Settings,
} from 'lucide-react';
import type { ViewName } from '../types/ark';

interface LobbyViewProps {
  lobbyBgDataUrl: string;
  turnCount: number;
  onStartNewStory: () => void;
  onNavigate: (view: ViewName) => void;
  onPickBg: () => void;
}

export function LobbyView({
  lobbyBgDataUrl,
  turnCount,
  onStartNewStory,
  onNavigate,
  onPickBg,
}: LobbyViewProps) {
  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center px-4 py-5 sm:px-6">
      <div
        className="relative flex min-h-[calc(100dvh-2.5rem)] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#162032]/88 bg-cover bg-center px-5 pb-9 pt-16 ring-1 ring-white/[0.08] shadow-[0_24px_64px_-20px_rgba(2,8,23,0.75)] backdrop-blur-xl"
        style={
          lobbyBgDataUrl
            ? { backgroundImage: `url("${lobbyBgDataUrl.replace(/"/g, '\\"')}")` }
            : undefined
        }
      >
        {lobbyBgDataUrl ? (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0f1726]/55 via-[#101828]/72 to-[#0e1524]/88"
            aria-hidden="true"
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_0%,rgba(56,189,248,0.18),transparent_65%),radial-gradient(ellipse_70%_45%_at_85%_95%,rgba(45,212,191,0.10),transparent_60%)]"
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          onClick={onPickBg}
          title="Chọn hoặc xóa ảnh nền sảnh"
          className="absolute left-4 top-4 z-10 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#111a2c]/72 px-3.5 py-2 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.10] backdrop-blur-md transition-all hover:bg-[#19263d]/85 hover:ring-sky-400/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
        >
          <ImageIcon className="h-4 w-4 text-sky-300" />
          <span>Ảnh nền</span>
        </button>

        <div className="relative z-10 mb-9 text-center">
          <h1
            className="font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            Ark Lite
          </h1>
          <p className="mt-2.5 text-[11px] font-semibold tracking-[0.28em] text-sky-200/75 uppercase">
            Mobile Edition
          </p>
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onStartNewStory}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-sky-500 to-blue-600 px-5 py-3.5 text-sm font-semibold tracking-wide text-white shadow-[0_12px_28px_-8px_rgba(14,165,233,0.52)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-white text-white" />
            <span>Khởi tạo</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('companion')}
            className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1a263b]/80 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-100 ring-1 ring-inset ring-white/[0.09] backdrop-blur-md transition-all hover:bg-[#213049]/90 hover:ring-sky-300/30 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
          >
            <FileText className="h-4 w-4 text-sky-300" />
            <span>Đồng nhân</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#1a263b]/80 px-3 py-3.5 text-center ring-1 ring-inset ring-white/[0.09] backdrop-blur-md transition-all hover:bg-[#213049]/90 hover:ring-sky-300/30 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Clock className="h-5 w-5 text-sky-300" />
              <span className="text-xs font-semibold tracking-wide text-slate-100 whitespace-nowrap">
                Tiếp tục
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {turnCount} lượt
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('data')}
              className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#1a263b]/80 px-3 py-3.5 text-center ring-1 ring-inset ring-white/[0.09] backdrop-blur-md transition-all hover:bg-[#213049]/90 hover:ring-sky-300/30 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <FolderOpen className="h-5 w-5 text-teal-300" />
              <span className="text-xs font-semibold tracking-wide text-slate-100 whitespace-nowrap">
                Dữ liệu
              </span>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                Save / Nhập JSON
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('config')}
            className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1a263b]/80 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-100 ring-1 ring-inset ring-white/[0.09] backdrop-blur-md transition-all hover:bg-[#213049]/90 hover:ring-sky-300/30 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
          >
            <Settings className="h-4 w-4 text-slate-300" />
            <span>Cấu hình hệ thống</span>
          </button>
        </div>
      </div>
    </section>
  );
}
