import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Filter,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Square,
  Trash2,
  User,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import type {
  CharacterPortrait,
  PortraitBankConfig,
  StoryClockState,
  ViewName,
} from '../types/ark';
import {
  computeAgeFromBirthday,
  formatAgeBirthdayLabel,
  lookupKnownCelebrityProfile,
} from '../utils/characterUtils';
import { matchesQuery } from '../utils/search';
import { CharacterNameBadge } from './CharacterNameBadge';

export interface BgPortraitStatus {
  active: boolean;
  text: string;
  isErr?: boolean;
}

interface PortraitBankPanelProps {
  portraitBank: PortraitBankConfig;
  activeCompanionName: string;
  storyClock?: StoryClockState;
  hasSeedreamConfigured: boolean;
  generatingPortraitIds: string[];
  enrichingAppearanceIds: string[];
  isEnrichingAppearances: boolean;
  bgPortraitStatus: BgPortraitStatus | null;
  currentPage?: number;
  turnCount?: number;
  compact?: boolean;
  onClose?: () => void;
  onNavigate: (view: ViewName) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncFromCompanion: () => void;
  onCleanJunkPortraits: () => void;
  onAutoFillAppearances: () => void;
  onRefreshPortraitAppearance: (portraitId: string, force?: boolean) => void;
  onGeneratePortrait: (portraitId: string) => void;
  onScanCurrentPagePortraits?: (turnIndex: number) => void;
  onCancelBgPortraits: () => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onOpenImagePicker?: (portraitId: string, portraitName: string) => void;
}

type PortraitFilter = 'all' | 'with_img' | 'missing_img';

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function PortraitBankPanel({
  portraitBank,
  activeCompanionName,
  storyClock,
  hasSeedreamConfigured,
  generatingPortraitIds,
  enrichingAppearanceIds,
  isEnrichingAppearances,
  bgPortraitStatus,
  currentPage = 0,
  turnCount = 0,
  compact = false,
  onClose,
  onNavigate,
  onUpdatePortraitBank,
  onSyncFromCompanion,
  onCleanJunkPortraits,
  onAutoFillAppearances,
  onRefreshPortraitAppearance,
  onGeneratePortrait,
  onScanCurrentPagePortraits,
  onCancelBgPortraits,
  onDownloadImage,
  onOpenImagePicker,
}: PortraitBankPanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PortraitFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [newFashionStyle, setNewFashionStyle] = useState('');
  const [newAppearance, setNewAppearance] = useState('');
  const [newPersonality, setNewPersonality] = useState('');
  const [newRelationships, setNewRelationships] = useState('');
  const [newSignature, setNewSignature] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editFashionStyle, setEditFashionStyle] = useState('');
  const [editAppearance, setEditAppearance] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editRelationships, setEditRelationships] = useState('');
  const [editSignature, setEditSignature] = useState('');
  const [expandedDetailIds, setExpandedDetailIds] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<CharacterPortrait | null>(null);

  const toggleDetailExpand = (id: string) => {
    setExpandedDetailIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const portraits = portraitBank.portraits || [];
  const withImageCount = useMemo(
    () => portraits.filter((p) => Boolean(p.imageData)).length,
    [portraits],
  );

  const filteredPortraits = useMemo(() => {
    const sorted = [...portraits].sort((a, b) => {
      if (a.isMc !== b.isMc) return a.isMc ? -1 : 1;
      const aHas = a.imageData ? 1 : 0;
      const bHas = b.imageData ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return sorted.filter((p) => {
      if (filter === 'with_img' && !p.imageData) return false;
      if (filter === 'missing_img' && p.imageData) return false;
      if (
        query.trim() &&
        !matchesQuery(
          `${p.name} ${p.role} ${p.age || ''} ${p.birthday || ''} ${p.fashionStyle || ''} ${p.appearance} ${p.personality || ''} ${p.relationships || ''} ${p.signature || ''}`,
          query,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [portraits, filter, query]);

  const handleAddCharacter = () => {
    const name = newName.trim();
    if (!name) return;
    const nowTs = Date.now();
    const manualAge = newAge.trim();
    const manualBirth = newBirthday.trim();
    const manualFashion = newFashionStyle.trim();
    const manualApp = newAppearance.trim();
    const manualPers = newPersonality.trim();
    const manualRel = newRelationships.trim();
    const manualSig = newSignature.trim();
    const hasManualVivid = Boolean(
      manualAge ||
        manualBirth ||
        manualFashion ||
        manualPers ||
        manualRel ||
        manualSig,
    );
    const celeb = lookupKnownCelebrityProfile(name);
    const createdId = `port_custom_${nowTs}_${Math.random().toString(36).slice(2, 5)}`;
    const finalBirthday = manualBirth || celeb?.birthday || '';
    const finalAge =
      manualAge || computeAgeFromBirthday(finalBirthday, storyClock);
    const finalFashion = manualFashion || celeb?.fashionStyle || '';
    const finalPersonality = manualPers || celeb?.personality || '';
    const finalRelationships = manualRel || celeb?.relationships || '';
    const finalSignature = manualSig || celeb?.signature || '';
    const created: CharacterPortrait = {
      id: createdId,
      name: celeb?.canonicalName || name,
      role: newRole.trim() || celeb?.role || 'NPC',
      ...(finalAge ? { age: finalAge } : {}),
      ...(finalBirthday ? { birthday: finalBirthday } : {}),
      ...(finalFashion ? { fashionStyle: finalFashion } : {}),
      appearance: manualApp || celeb?.appearance || '',
      ...(finalPersonality ? { personality: finalPersonality } : {}),
      ...(finalRelationships ? { relationships: finalRelationships } : {}),
      ...(finalSignature ? { signature: finalSignature } : {}),
      appearanceManual: Boolean(manualApp),
      profileManual: hasManualVivid,
      isMc: false,
      updatedAt: nowTs,
    };
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: [created, ...(prev.portraits || [])],
    }));
    setNewName('');
    setNewRole('');
    setNewAge('');
    setNewBirthday('');
    setNewFashionStyle('');
    setNewAppearance('');
    setNewPersonality('');
    setNewRelationships('');
    setNewSignature('');
    setShowAddForm(false);
    if (!manualApp && !hasManualVivid) {
      window.setTimeout(() => {
        onRefreshPortraitAppearance(createdId, false);
      }, 40);
    }
  };

  const startEdit = (p: CharacterPortrait) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditRole(p.role);
    setEditAge(p.age || '');
    setEditBirthday(p.birthday || '');
    setEditFashionStyle(p.fashionStyle || '');
    setEditAppearance(p.appearance);
    setEditPersonality(p.personality || '');
    setEditRelationships(p.relationships || '');
    setEditSignature(p.signature || '');
  };

  const saveEdit = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const trimmedAge = editAge.trim();
    const trimmedBirth = editBirthday.trim();
    const trimmedFashion = editFashionStyle.trim();
    const trimmedApp = editAppearance.trim();
    const trimmedPers = editPersonality.trim();
    const trimmedRel = editRelationships.trim();
    const trimmedSig = editSignature.trim();
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) => {
        if (p.id !== id) return p;
        const appearanceChanged = trimmedApp !== (p.appearance || '').trim();
        const vividChanged =
          trimmedAge !== (p.age || '').trim() ||
          trimmedBirth !== (p.birthday || '').trim() ||
          trimmedFashion !== (p.fashionStyle || '').trim() ||
          trimmedPers !== (p.personality || '').trim() ||
          trimmedRel !== (p.relationships || '').trim() ||
          trimmedSig !== (p.signature || '').trim();
        const hasAnyVivid = Boolean(
          trimmedAge ||
            trimmedBirth ||
            trimmedFashion ||
            trimmedPers ||
            trimmedRel ||
            trimmedSig,
        );
        return {
          ...p,
          name,
          role: editRole.trim(),
          age: trimmedAge || undefined,
          birthday: trimmedBirth || undefined,
          fashionStyle: trimmedFashion || undefined,
          appearance: trimmedApp,
          personality: trimmedPers || undefined,
          relationships: trimmedRel || undefined,
          signature: trimmedSig || undefined,
          appearanceManual: trimmedApp
            ? appearanceChanged
              ? true
              : Boolean(p.appearanceManual)
            : false,
          profileManual: hasAnyVivid
            ? vividChanged
              ? true
              : Boolean(p.profileManual)
            : false,
          updatedAt: Date.now(),
        };
      }),
    }));
    setEditingId(null);
  };

  const handleClearImage = (id: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === id
          ? {
              ...p,
              imageData: undefined,
              prompt: undefined,
              autoGenerated: undefined,
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
  };

  const handleDeleteEntry = (id: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).filter((p) => p.id !== id),
    }));
  };

  return (
    <div
      className={`space-y-3 rounded-2xl backdrop-blur-md ${
        compact
          ? 'bg-[#162135]/94 p-3.5 ring-1 ring-sky-400/22 shadow-[0_12px_32px_-16px_rgba(2,8,23,0.65)]'
          : 'bg-[#111b2c]/80 p-4 ring-1 ring-inset ring-white/[0.08]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/16 text-sky-300 ring-1 ring-inset ring-sky-400/28">
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold tracking-tight text-slate-50 sm:text-sm">
              Thư viện Ảnh Nhân vật &amp; NPC
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              <span className="truncate">{activeCompanionName || 'Phiên hiện tại'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {withImageCount}/{portraits.length} nhân vật có ảnh
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onCleanJunkPortraits}
            title="Xóa các mục tên rác mà không xóa nhân vật hay ảnh hợp lệ"
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-amber-500/14 px-2.5 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/22 whitespace-nowrap"
          >
            <Filter className="h-3 w-3" />
            <span>Lọc tên rác</span>
          </button>
          <button
            type="button"
            onClick={onSyncFromCompanion}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Đồng bộ ĐN</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-emerald-500/14 px-2.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            <span>Thêm NV</span>
          </button>
          {onClose && (
            <button
              type="button"
              aria-label="Đóng thư viện ảnh nhân vật"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Auto-Generation Controls */}
      <div className="space-y-2.5 rounded-xl bg-[#111b2c]/85 p-3 ring-1 ring-inset ring-white/[0.07]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdatePortraitBank((prev) => ({
                ...prev,
                autoGenerateOnAppear: !prev.autoGenerateOnAppear,
              }))
            }
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
              portraitBank.autoGenerateOnAppear
                ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Tự sinh ảnh NPC khi xuất hiện:{' '}
              {portraitBank.autoGenerateOnAppear ? 'Bật' : 'Tắt'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 whitespace-nowrap">
              <span>Giới hạn/lượt:</span>
              <select
                aria-label="Giới hạn số ảnh NPC tự sinh mỗi lượt"
                value={String(portraitBank.maxAutoPerTurn || 1)}
                onChange={(e) => {
                  const val = Math.min(3, Math.max(1, Number(e.target.value) || 1));
                  onUpdatePortraitBank((prev) => ({
                    ...prev,
                    maxAutoPerTurn: val,
                  }));
                }}
                className="min-h-[30px] rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 text-xs font-semibold text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              >
                <option value="1">1 ảnh</option>
                <option value="2">2 ảnh</option>
                <option value="3">3 ảnh</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() =>
                onUpdatePortraitBank((prev) => ({
                  ...prev,
                  includeMcAuto: !prev.includeMcAuto,
                }))
              }
              className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                portraitBank.includeMcAuto
                  ? 'bg-sky-500/16 text-sky-100 ring-1 ring-inset ring-sky-400/30'
                  : 'bg-white/[0.055] text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:text-slate-200'
              }`}
            >
              Gồm NV chính: {portraitBank.includeMcAuto ? 'Có' : 'Không'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Chỉ quét phần truyện thực tế (không ép NV chính khi vắng mặt), tự
            làm sinh động hồ sơ (tính cách, ngoại hình, quan hệ, điểm nhấn) rồi
            gọi Seedream chạy ngầm.
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {portraits.length > 0 && (
              <button
                type="button"
                disabled={isEnrichingAppearances}
                onClick={onAutoFillAppearances}
                className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-indigo-500/16 px-2.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/30 transition-all hover:bg-indigo-500/24 disabled:opacity-45 whitespace-nowrap"
              >
                {isEnrichingAppearances ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                <span>
                  {isEnrichingAppearances
                    ? 'Đang làm sinh động...'
                    : 'Làm sinh động hồ sơ'}
                </span>
              </button>
            )}
            {onScanCurrentPagePortraits && turnCount > 0 && (
              <button
                type="button"
                disabled={bgPortraitStatus?.active}
                onClick={() => onScanCurrentPagePortraits(currentPage)}
                className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 disabled:opacity-45 whitespace-nowrap"
              >
                <Sparkles className="h-3 w-3" />
                <span>Quét &amp; vẽ Trang {currentPage + 1}</span>
              </button>
            )}
          </div>
        </div>

        {!hasSeedreamConfigured && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/[0.10] px-2.5 py-2 text-[11px] text-amber-200 ring-1 ring-inset ring-amber-400/28">
            <span>
              Chưa cấu hình Seedream 5 Pro Endpoint (cần thiết để tạo ảnh chân
              dung).
            </span>
            <button
              type="button"
              onClick={() => onNavigate('config')}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-amber-500/16 px-2 font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/25 whitespace-nowrap"
            >
              <Settings className="h-3 w-3" />
              <span>Mở Cấu hình</span>
            </button>
          </div>
        )}

        {bgPortraitStatus && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[11px] ring-1 ring-inset ${
              bgPortraitStatus.isErr
                ? 'bg-rose-500/[0.10] text-rose-200 ring-rose-400/28'
                : bgPortraitStatus.active
                  ? 'bg-sky-500/[0.10] text-sky-200 ring-sky-400/28'
                  : 'bg-emerald-500/[0.10] text-emerald-200 ring-emerald-400/28'
            }`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {bgPortraitStatus.active && (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              )}
              <span className="truncate">{bgPortraitStatus.text}</span>
            </div>
            {bgPortraitStatus.active && (
              <button
                type="button"
                onClick={onCancelBgPortraits}
                className="inline-flex min-h-[26px] shrink-0 items-center gap-1 rounded-lg bg-rose-500/16 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                <span>Dừng ngầm</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Character Form */}
      {showAddForm && (
        <div className="space-y-2 rounded-xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-emerald-400/28">
          <div className="text-xs font-semibold text-emerald-200">
            Thêm nhân vật / NPC vào thư viện ảnh
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên nhân vật / NPC (bắt buộc)..."
              className="min-h-[36px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Vai trò (VD: Đồng minh, Sư tỷ, Rapper UK...)"
              className="min-h-[36px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newAge}
              onChange={(e) => setNewAge(e.target.value)}
              placeholder="Tuổi tác (VD: 28 tuổi)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <input
              type="text"
              value={newBirthday}
              onChange={(e) => setNewBirthday(e.target.value)}
              placeholder="Ngày sinh (VD: 04/06/1998)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <textarea
            value={newFashionStyle}
            onChange={(e) => setNewFashionStyle(e.target.value)}
            rows={2}
            placeholder="Style ăn mặc theo nghề nghiệp & bối cảnh (VD: streetwear London, tracksuit/puffer, quiet luxury... để trống để tự nhận diện)..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
          <textarea
            value={newAppearance}
            onChange={(e) => setNewAppearance(e.target.value)}
            rows={2}
            placeholder="Ngoại hình (vóc dáng, kiểu tóc, nét mặt, thần thái... để trống để tự nhận diện)..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newPersonality}
              onChange={(e) => setNewPersonality(e.target.value)}
              placeholder="Tính cách & khí chất (tùy chọn)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <input
              type="text"
              value={newRelationships}
              onChange={(e) => setNewRelationships(e.target.value)}
              placeholder="Quan hệ & thái độ (tùy chọn)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <input
            type="text"
            value={newSignature}
            onChange={(e) => setNewSignature(e.target.value)}
            placeholder="Điểm nhấn / Thói quen / Câu cửa miệng (tùy chọn)..."
            className="min-h-[34px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[32px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={handleAddCharacter}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-emerald-500/16 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24 disabled:opacity-45"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Lưu nhân vật</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      {portraits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm nhân vật trong thư viện ảnh"
              placeholder="Tìm tên, vai trò, ngoại hình..."
              className="min-h-[34px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1 pl-8 pr-7 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm nhân vật"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#0e1625]/85 p-0.5 ring-1 ring-inset ring-white/[0.07]">
            {(
              [
                { id: 'all', label: `Tất cả (${portraits.length})` },
                { id: 'with_img', label: `Có ảnh (${withImageCount})` },
                {
                  id: 'missing_img',
                  label: `Chưa có (${portraits.length - withImageCount})`,
                },
              ] as Array<{ id: PortraitFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Portrait Grid */}
      {!filteredPortraits.length ? (
        <div className="rounded-xl border border-dashed border-white/[0.10] bg-[#111b2c]/60 p-4 text-center text-xs text-slate-400">
          {portraits.length === 0
            ? 'Chưa có nhân vật nào trong thư viện. Bấm "Đồng bộ ĐN" để lấy danh sách từ hồ sơ Đồng nhân, hoặc bấm "Thêm NV".'
            : 'Không tìm thấy nhân vật nào khớp với bộ lọc hiện tại.'}
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${
            compact ? 'max-h-[420px] overflow-y-auto pr-0.5' : ''
          }`}
        >
          {filteredPortraits.map((p) => {
            const isBusy = generatingPortraitIds.includes(p.id);
            const isEnrichingOne = enrichingAppearanceIds.includes(p.id);
            const isEditing = editingId === p.id;
            const ageBirthLabel = formatAgeBirthdayLabel(p.age, p.birthday);
            const hasVividDetails = Boolean(
              p.age?.trim() ||
                p.birthday?.trim() ||
                p.fashionStyle?.trim() ||
                p.personality?.trim() ||
                p.relationships?.trim() ||
                p.signature?.trim(),
            );
            const isExpanded = expandedDetailIds.includes(p.id);
            return (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-xl bg-[#111b2c]/85 ring-1 ring-inset ring-white/[0.08]"
              >
                <div className="flex gap-3 p-2.5">
                  {/* Portrait Thumbnail */}
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0c1422] ring-1 ring-white/[0.10]">
                    {p.imageData ? (
                      <button
                        type="button"
                        onClick={() => setLightbox(p)}
                        aria-label={`Phóng to ảnh của ${p.name}`}
                        className="group relative block h-full w-full focus:outline-none"
                      >
                        <img
                          src={p.imageData}
                          alt={`Chân dung ${p.name}`}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                        <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-[#0a101d]/75 p-0.5 text-slate-100 opacity-80 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-3 w-3" />
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-[#1a2944] to-[#0f1729] text-slate-400">
                        {p.isMc ? (
                          <User className="h-4 w-4 text-sky-400/85" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-400/80" />
                        )}
                        <span className="text-[11px] font-bold tracking-wide text-slate-200">
                          {getInitials(p.name)}
                        </span>
                      </div>
                    )}

                    {isBusy && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#0c1422]/80 text-[10px] font-semibold text-sky-200 backdrop-blur-[2px]">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                        <span>Đang vẽ</span>
                      </div>
                    )}
                  </div>

                  {/* Character Info */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Tên nhân vật"
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-xs font-semibold text-slate-100 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          placeholder="Vai trò / Nghề nghiệp & vị thế"
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={editAge}
                            onChange={(e) => setEditAge(e.target.value)}
                            placeholder="Tuổi (VD: 28 tuổi)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <input
                            type="text"
                            value={editBirthday}
                            onChange={(e) => setEditBirthday(e.target.value)}
                            placeholder="Ngày sinh (DD/MM/YYYY)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                        </div>
                        <textarea
                          value={editFashionStyle}
                          onChange={(e) => setEditFashionStyle(e.target.value)}
                          rows={2}
                          placeholder="Style ăn mặc (đúng nghề nghiệp & bối cảnh, tránh rập khuôn vest)..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <textarea
                          value={editAppearance}
                          onChange={(e) => setEditAppearance(e.target.value)}
                          rows={2}
                          placeholder="Ngoại hình (vóc dáng, kiểu tóc, nét mặt, thần thái)..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <textarea
                          value={editPersonality}
                          onChange={(e) => setEditPersonality(e.target.value)}
                          rows={2}
                          placeholder="Tính cách & khí chất đặc trưng..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <textarea
                          value={editRelationships}
                          onChange={(e) => setEditRelationships(e.target.value)}
                          rows={2}
                          placeholder="Mối quan hệ & thái độ..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <input
                          type="text"
                          value={editSignature}
                          onChange={(e) => setEditSignature(e.target.value)}
                          placeholder="Điểm nhấn / Thói quen / Chi tiết ghi nhớ..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(p.id)}
                            className="min-h-[26px] rounded-lg bg-emerald-500/16 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:bg-emerald-500/24"
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[26px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center">
                              <CharacterNameBadge
                                name={p.name}
                                variant="list"
                                isMc={p.isMc}
                                onClick={() =>
                                  p.imageData
                                    ? setLightbox(p)
                                    : hasVividDetails
                                      ? toggleDetailExpand(p.id)
                                      : startEdit(p)
                                }
                                title={
                                  p.imageData
                                    ? `Xem ảnh chân dung ${p.name}`
                                    : `Xem hồ sơ ${p.name}`
                                }
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                              <span
                                className={
                                  p.isMc ? 'font-semibold text-sky-300' : ''
                                }
                              >
                                {p.isMc ? 'NV chính' : 'NPC'}
                              </span>
                              {p.role && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{p.role}</span>
                                </>
                              )}
                              {ageBirthLabel && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums text-slate-300">
                                    {ageBirthLabel}
                                  </span>
                                </>
                              )}
                              {typeof p.lastSeenTurnIndex === 'number' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">
                                    Trang {p.lastSeenTurnIndex + 1}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              disabled={isEnrichingOne}
                              title="Làm sinh động hồ sơ, tuổi tác & style ăn mặc từ diễn biến truyện và đặc trưng nhân vật"
                              aria-label={`Làm sinh động hồ sơ cho ${p.name}`}
                              onClick={() =>
                                onRefreshPortraitAppearance(p.id, true)
                              }
                              className="rounded-lg p-1 text-indigo-300/85 transition-colors hover:bg-indigo-500/16 hover:text-indigo-200 disabled:opacity-45"
                            >
                              {isEnrichingOne ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label={`Sửa thông tin ${p.name}`}
                              onClick={() => startEdit(p)}
                              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400">
                          {isEnrichingOne
                            ? 'Đang làm sinh động hồ sơ, tuổi tác & style...'
                            : p.appearance ||
                              'Chưa có mô tả ngoại hình (bấm đũa phép để làm sinh động hồ sơ hoặc sửa thủ công).'}
                        </p>
                        {hasVividDetails && !isEnrichingOne && (
                          <button
                            type="button"
                            onClick={() => toggleDetailExpand(p.id)}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 transition-colors hover:text-indigo-200"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            <span>
                              {isExpanded
                                ? 'Thu gọn hồ sơ'
                                : 'Hồ sơ chi tiết'}
                            </span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Vivid Profile Drawer */}
                {!isEditing && hasVividDetails && isExpanded && (
                  <div className="space-y-1.5 border-t border-white/[0.07] bg-[#0e1625]/70 px-3 py-2 text-[11px] leading-relaxed">
                    {ageBirthLabel && (
                      <div>
                        <span className="font-semibold text-cyan-300">
                          Tuổi tác &amp; ngày sinh:{' '}
                        </span>
                        <span className="tabular-nums text-slate-200">
                          {ageBirthLabel}
                        </span>
                      </div>
                    )}
                    {p.fashionStyle?.trim() && (
                      <div>
                        <span className="font-semibold text-violet-300">
                          Style ăn mặc:{' '}
                        </span>
                        <span className="text-slate-300">{p.fashionStyle}</span>
                      </div>
                    )}
                    {p.personality?.trim() && (
                      <div>
                        <span className="font-semibold text-sky-300">
                          Tính cách &amp; khí chất:{' '}
                        </span>
                        <span className="text-slate-300">{p.personality}</span>
                      </div>
                    )}
                    {p.relationships?.trim() && (
                      <div>
                        <span className="font-semibold text-emerald-300">
                          Quan hệ &amp; thái độ:{' '}
                        </span>
                        <span className="text-slate-300">
                          {p.relationships}
                        </span>
                      </div>
                    )}
                    {p.signature?.trim() && (
                      <div>
                        <span className="font-semibold text-amber-300">
                          Điểm nhấn:{' '}
                        </span>
                        <span className="text-slate-300">{p.signature}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-Character Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-white/[0.07] bg-[#0f1829]/90 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onGeneratePortrait(p.id)}
                      className="inline-flex min-h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24 disabled:opacity-45"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      <span>
                        {isBusy
                          ? 'Đang tạo...'
                          : p.imageData
                            ? 'Tạo lại ảnh'
                            : 'Tạo ảnh'}
                      </span>
                    </button>
                    {onOpenImagePicker && (
                      <button
                        type="button"
                        onClick={() => onOpenImagePicker(p.id, p.name)}
                        className="inline-flex min-h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                      >
                        <ImageIcon className="h-3 w-3 text-sky-300" />
                        <span>Chọn ảnh</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {p.imageData && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onDownloadImage(
                              p.imageData || '',
                              `chan_dung_${p.name}.png`,
                            )
                          }
                          className="inline-flex min-h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                        >
                          <Download className="h-3 w-3" />
                          <span>Tải</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearImage(p.id)}
                          className="inline-flex min-h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-amber-500/14 px-2 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-colors hover:bg-amber-500/22"
                        >
                          <span>Xóa ảnh</span>
                        </button>
                      </>
                    )}
                    {!p.isMc && (
                      <button
                        type="button"
                        aria-label={`Xóa ${p.name} khỏi thư viện`}
                        onClick={() => handleDeleteEntry(p.id)}
                        className="inline-flex min-h-[30px] shrink-0 items-center justify-center rounded-lg bg-rose-500/14 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-colors hover:bg-rose-500/22"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Portrait Lightbox */}
      {lightbox && lightbox.imageData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh chân dung ${lightbox.name}`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#060a14]/82 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#162135]/96 shadow-2xl ring-1 ring-white/[0.10]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-100">
                  {lightbox.name}
                  {lightbox.role ? ` · ${lightbox.role}` : ''}
                </div>
                {lightbox.appearance && (
                  <div className="truncate text-[11px] text-slate-400">
                    {lightbox.appearance}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onDownloadImage(
                      lightbox.imageData || '',
                      `chan_dung_${lightbox.name}.png`,
                    )
                  }
                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-sky-500/16 px-2.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải ảnh</span>
                </button>
                <button
                  type="button"
                  aria-label="Đóng xem ảnh"
                  onClick={() => setLightbox(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-[#0a101d] p-3">
              <img
                src={lightbox.imageData}
                alt={`Chân dung ${lightbox.name}`}
                referrerPolicy="no-referrer"
                className="max-h-[72dvh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
            {(lightbox.age ||
              lightbox.birthday ||
              lightbox.fashionStyle ||
              lightbox.personality ||
              lightbox.relationships ||
              lightbox.signature ||
              lightbox.prompt) && (
              <div className="space-y-1 border-t border-white/[0.08] bg-[#101829]/95 px-4 py-2.5 text-[11px] text-slate-400">
                {formatAgeBirthdayLabel(lightbox.age, lightbox.birthday) && (
                  <div>
                    <span className="font-semibold text-cyan-300">
                      Tuổi tác &amp; ngày sinh:{' '}
                    </span>
                    <span className="tabular-nums text-slate-200">
                      {formatAgeBirthdayLabel(lightbox.age, lightbox.birthday)}
                    </span>
                  </div>
                )}
                {lightbox.fashionStyle && (
                  <div>
                    <span className="font-semibold text-violet-300">
                      Style ăn mặc:{' '}
                    </span>
                    <span className="text-slate-300">
                      {lightbox.fashionStyle}
                    </span>
                  </div>
                )}
                {lightbox.personality && (
                  <div>
                    <span className="font-semibold text-sky-300">
                      Tính cách:{' '}
                    </span>
                    <span className="text-slate-300">
                      {lightbox.personality}
                    </span>
                  </div>
                )}
                {lightbox.relationships && (
                  <div>
                    <span className="font-semibold text-emerald-300">
                      Quan hệ:{' '}
                    </span>
                    <span className="text-slate-300">
                      {lightbox.relationships}
                    </span>
                  </div>
                )}
                {lightbox.signature && (
                  <div>
                    <span className="font-semibold text-amber-300">
                      Điểm nhấn:{' '}
                    </span>
                    <span className="text-slate-300">{lightbox.signature}</span>
                  </div>
                )}
                {lightbox.prompt && (
                  <div className="pt-0.5 text-slate-500">
                    <span className="font-semibold text-slate-400">Prompt: </span>
                    <span className="line-clamp-2">{lightbox.prompt}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
