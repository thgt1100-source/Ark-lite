/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Home,
  Layers,
  Save,
  Settings,
  Sliders,
  Upload,
  X,
} from 'lucide-react';
import { ChatView } from './components/ChatView';
import { CompanionView } from './components/CompanionView';
import { ConfigView } from './components/ConfigView';
import { ConfirmModal } from './components/ConfirmModal';
import { ContextView } from './components/ContextView';
import { DataView } from './components/DataView';
import { ImageSaveModal } from './components/ImageSaveModal';
import { LobbyView } from './components/LobbyView';
import type { BgPortraitStatus } from './components/PortraitBankPanel';
import { PresetView } from './components/PresetView';
import { WorldSetupView } from './components/WorldSetupView';
import type {
  AppConfig,
  ArkState,
  BannerMessage,
  CharacterPortrait,
  CharacterStateSnapshot,
  CompanionProfile,
  ContextConfig,
  MemoryEntry,
  MemoryManagerConfig,
  PendingImage,
  PlayerInfo,
  PortraitBankConfig,
  StoryClockState,
  StoryImageConfig,
  Turn,
  ViewName,
  WorldInfo,
  WorldSetupPayload,
} from './types/ark';
import {
  detectCharactersInTurnForPortraits,
  enrichVividNpcProfilesWithAi,
  executeModelTurn,
  generateCharacterPortraitImage,
  generateStoryImage,
  generateTurnSuggestionsWithAi,
  normalizeCharacterKey,
  runAiMemorySync,
  runRollingSummaryUpdate,
  stripStoryPlanningAndMeta,
} from './utils/api';
import {
  cleanJunkPortraitsFromBank,
  resolveLocalVividNpcProfile,
} from './utils/characterUtils';
import {
  extractTurnsFromObject,
  getLeadingDraftEndOffset,
  parseSaveJsonSafe,
  sanitizeCompletedStoryResponse,
} from './utils/saveParser';
import {
  createDefaultMemoryConfig,
  createDefaultModules,
  createDefaultPortraitBank,
  createInitialState,
  DEFAULT_PREFILL,
  DEFAULT_SAFETY,
  downloadImageSource,
  getActiveCompanionFromState,
  loadPersistedState,
  normalizeMemoryConfig,
  normalizePortraitBank,
  normalizeTawaPreset,
  persistState,
  STORAGE_KEY,
  syncPortraitBankWithCompanion,
  triggerDownloadJson,
  type ImageSaveFallbackPayload,
} from './utils/storage';
import {
  applyClockDeltaToCultivation,
  createStarterCultivationProfile,
  detectCultivationSystemKind,
} from './utils/cultivation';
import {
  advanceStoryClockFromTurn,
  clockToEpochMinutes,
  createDefaultStoryClock,
  formatStoryClock,
  inferStoryClockFromLegacyTurns,
  normalizeStoryClock,
  reconcileAiClockUpdate,
} from './utils/storyClock';
import {
  clampPageIndex,
  deleteTurnFromState,
  ensureUniqueTurnIds,
  reindexPreClockMapOnDelete,
} from './utils/turnSync';

const VIEW_LABELS: Record<ViewName, string> = {
  lobby: 'Sảnh chính · Sẵn sàng',
  setup: 'Khởi tạo · Dựng Thế giới & Phiên mới',
  chat: 'Truyện · 1 Lượt = 1 Trang',
  config: 'Cấu hình hệ thống · Proxy & Seedream 5 Pro',
  companion: 'Đồng nhân · Tạo Thế giới Đồng nhân',
  preset: 'P&P Preset · Tawa / Omega',
  context: 'Ngữ cảnh · Ký ức & Trạng thái AI',
  data: 'Dữ liệu · Slots & Tải Save',
};

const SYSTEM_CONFIG_VIEWS: ViewName[] = ['config', 'preset', 'context'];

const SYSTEM_QUICK_MENU_ITEMS: Array<{ id: ViewName; label: string }> = [
  { id: 'lobby', label: 'Sảnh chính' },
  { id: 'config', label: 'Cấu hình hệ thống' },
  { id: 'preset', label: 'P&P Preset' },
  { id: 'context', label: 'Ngữ cảnh' },
];

const SESSION_QUICK_MENU_ITEMS: Array<{ id: ViewName; label: string }> = [
  { id: 'lobby', label: 'Sảnh chính' },
  { id: 'setup', label: 'Khởi tạo thế giới' },
  { id: 'companion', label: 'Đồng nhân' },
  { id: 'context', label: 'Ngữ cảnh' },
  { id: 'preset', label: 'P&P Preset' },
  { id: 'config', label: 'Cấu hình hệ thống' },
  { id: 'data', label: 'Dữ liệu & Save' },
];

const SYSTEM_BOTTOM_NAV_ITEMS: Array<{
  id: ViewName;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'lobby', label: 'Sảnh', icon: Home },
  { id: 'config', label: 'Cấu hình', icon: Settings },
  { id: 'preset', label: 'Preset', icon: Sliders },
  { id: 'context', label: 'Ngữ cảnh', icon: Layers },
];

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function App() {
  const [state, setState] = useState<ArkState>(() => loadPersistedState());
  const stateRef = useRef<ArkState>(state);
  stateRef.current = state;

  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [imageSaveFallback, setImageSaveFallback] =
    useState<ImageSaveFallbackPayload | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState({ text: 'Sẵn sàng', isErr: false });
  const [streamingState, setStreamingState] = useState<{
    turnIndex: number;
    turnId: string;
    text: string;
  } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatingImageTurnIdx, setGeneratingImageTurnIdx] = useState<
    number | null
  >(null);
  const [generatingImageTurnId, setGeneratingImageTurnId] = useState<
    string | null
  >(null);
  const [generatingPortraitIds, setGeneratingPortraitIds] = useState<string[]>(
    [],
  );
  const [enrichingAppearanceIds, setEnrichingAppearanceIds] = useState<
    string[]
  >([]);
  const [isEnrichingAppearances, setIsEnrichingAppearances] = useState(false);
  const [enrichingNpcIds, setEnrichingNpcIds] = useState<string[]>([]);
  const [isEnrichingAllNpcs, setIsEnrichingAllNpcs] = useState(false);
  const [bgPortraitStatus, setBgPortraitStatus] =
    useState<BgPortraitStatus | null>(null);
  const [isSyncingMemory, setIsSyncingMemory] = useState(false);
  const [isSyncingStates, setIsSyncingStates] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [proxyLogs, setProxyLogs] = useState<string[]>([
    'Sẵn sàng kiểm tra proxy...',
  ]);
  const [navBottomOffset, setNavBottomOffset] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Xác nhận',
    cancelLabel: 'Hủy',
    confirmTone: 'primary',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const activeStoryCompanionIdRef = useRef<string | null>(
    state.activeStoryCompanionId ?? null,
  );
  const turnPreClockRef = useRef<Map<number, StoryClockState>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const imageAbortControllerRef = useRef<AbortController | null>(null);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const bgPortraitAbortRef = useRef<AbortController | null>(null);
  const bgPortraitClearTimerRef = useRef<number | null>(null);
  const streamRafRef = useRef<number | null>(null);
  const streamDrainTimerRef = useRef<number | null>(null);
  const streamDrainResolveRef = useRef<(() => void) | null>(null);
  const streamLastTickRef = useRef<number>(0);
  const streamLastCommitRef = useRef<number>(0);
  const streamTargetRef = useRef<{
    turnIndex: number;
    turnId: string;
    text: string;
  } | null>(null);
  const streamDisplayedLenRef = useRef<number>(0);
  const streamCarryRef = useRef<number>(0);
  const streamFastDrainRef = useRef<boolean>(false);
  const streamAbortedRef = useRef<boolean>(false);
  const persistTimerRef = useRef<number | null>(null);
  const persistDirtyRef = useRef<boolean>(false);
  const lastPersistedFieldsRef = useRef<unknown[] | null>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const saveFileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const lobbyBgInputRef = useRef<HTMLInputElement>(null);

  const flushPersistNow = useCallback((overrideState?: ArkState) => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const target = overrideState || stateRef.current;
    persistState(target);
    persistDirtyRef.current = false;
    lastPersistedFieldsRef.current = [
      target.player,
      target.world,
      target.config,
      target.tawaPreset,
      target.context,
      target.turns,
      target.currentPage,
      target.slots,
      target.checkpoint,
      target.streamEnabled,
      target.hideBottomNav,
      target.lobbyBgDataUrl,
      target.storyImage,
      target.memory,
      target.portraitBank,
      target.companions,
      target.companionStories,
      target.companionMemories,
      target.companionPortraits,
      target.activeCompanionId,
      target.activeStoryCompanionId,
    ];
  }, []);

  // Mobile-friendly debounced persistence: skip serialization on transient UI-only switches
  // (activeView/showRawTags/showPostMeta) and debounce routine writes so page taps stay instant.
  useEffect(() => {
    const nextFields: unknown[] = [
      state.player,
      state.world,
      state.config,
      state.tawaPreset,
      state.context,
      state.turns,
      state.currentPage,
      state.slots,
      state.checkpoint,
      state.streamEnabled,
      state.hideBottomNav,
      state.lobbyBgDataUrl,
      state.storyImage,
      state.memory,
      state.portraitBank,
      state.companions,
      state.companionStories,
      state.companionMemories,
      state.companionPortraits,
      state.activeCompanionId,
      state.activeStoryCompanionId,
    ];
    const prevFields = lastPersistedFieldsRef.current;
    if (
      prevFields &&
      prevFields.length === nextFields.length &&
      prevFields.every((val, idx) => Object.is(val, nextFields[idx]))
    ) {
      return;
    }

    persistDirtyRef.current = true;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      flushPersistNow(stateRef.current);
    }, 220);
  }, [state, flushPersistNow]);

  // Flush any pending debounced write immediately when mobile browser backgrounds or unloads
  useEffect(() => {
    const handleFlush = () => {
      if (persistDirtyRef.current || persistTimerRef.current !== null) {
        flushPersistNow(stateRef.current);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };
    window.addEventListener('pagehide', handleFlush);
    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handleFlush);
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [flushPersistNow]);

  // Close quick menu when clicking/tapping outside or pressing Escape
  useEffect(() => {
    if (!quickMenuOpen) return;
    const handlePointerDown = (ev: PointerEvent) => {
      if (
        quickMenuRef.current &&
        !quickMenuRef.current.contains(ev.target as Node)
      ) {
        setQuickMenuOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setQuickMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [quickMenuOpen]);

  // Ensure quick menu never remains stuck open across view changes or confirmation modals
  useEffect(() => {
    setQuickMenuOpen(false);
  }, [state.activeView, confirmDialog.open]);

  // Keep bottom navigation synced with visualViewport on mobile keyboards/toolbars
  useEffect(() => {
    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setNavBottomOffset(0);
        return;
      }
      const offset = Math.max(
        0,
        Math.round(window.innerHeight - (vv.height + vv.offsetTop)),
      );
      setNavBottomOffset(offset);
    };
    syncViewport();
    window.visualViewport?.addEventListener('resize', syncViewport, {
      passive: true,
    });
    window.visualViewport?.addEventListener('scroll', syncViewport, {
      passive: true,
    });
    window.addEventListener('resize', syncViewport, { passive: true });
    window.addEventListener('scroll', syncViewport, { passive: true });
    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('scroll', syncViewport);
    };
  }, []);

  const showBanner = useCallback((text: string, type: 'info' | 'err' = 'info') => {
    setBanner(text ? { text, type } : null);
  }, []);

  const closeImageSaveFallback = useCallback(() => {
    setImageSaveFallback((prev) => {
      if (prev?.ownsObjectUrl && prev.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, []);

  const handleDownloadImage = useCallback(
    (src: string, filename: string) => {
      void downloadImageSource(src, filename, showBanner, {
        onFallbackPreview: (payload) => {
          setImageSaveFallback((prev) => {
            if (prev?.ownsObjectUrl && prev.previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(prev.previewUrl);
            }
            return payload;
          });
        },
      });
    },
    [showBanner],
  );

  const appendProxyLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setProxyLogs((prev) => [...prev, `[${ts}] ${line}`]);
  }, []);

  const goView = useCallback((viewName: ViewName) => {
    setQuickMenuOpen(false);
    setState((prev) => ({ ...prev, activeView: viewName }));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Sync active companion story whenever turns change while inside a companion story
  const updateTurnsWithCompanionSync = useCallback(
    (updater: (turns: Turn[]) => Turn[], nextPage?: number) => {
      setState((prev) => {
        const nextTurns = updater(prev.turns);
        const compKey = activeStoryCompanionIdRef.current;
        const nextCompanionStories = compKey
          ? { ...prev.companionStories, [compKey]: nextTurns }
          : prev.companionStories;
        return {
          ...prev,
          turns: nextTurns,
          currentPage:
            typeof nextPage === 'number'
              ? nextPage
              : Math.min(prev.currentPage, Math.max(0, nextTurns.length - 1)),
          companionStories: nextCompanionStories,
        };
      });
    },
    [],
  );

  const handleUpdateStoryImageConfig = useCallback(
    (patch: Partial<StoryImageConfig>) => {
      setState((prev) => ({
        ...prev,
        storyImage: {
          ...prev.storyImage,
          ...patch,
        },
      }));
    },
    [],
  );

  const updateMemoryWithCompanionSync = useCallback(
    (updater: (prev: MemoryManagerConfig) => MemoryManagerConfig) => {
      setState((prev) => {
        const nextMem = updater(prev.memory || createDefaultMemoryConfig());
        const compKey = activeStoryCompanionIdRef.current;
        const nextCompMemories = compKey
          ? { ...(prev.companionMemories || {}), [compKey]: nextMem }
          : prev.companionMemories || {};
        return {
          ...prev,
          memory: nextMem,
          companionMemories: nextCompMemories,
        };
      });
    },
    [],
  );

  const handleRunMemorySync = useCallback(
    async (
      turnIndex: number,
      mode: 'memory' | 'state' | 'both',
      silent = false,
      stateOverride?: ArkState,
    ) => {
      const working = stateOverride || stateRef.current;
      if (mode === 'memory' || mode === 'both') setIsSyncingMemory(true);
      if (mode === 'state' || mode === 'both') setIsSyncingStates(true);

      const res = await runAiMemorySync({
        state: working,
        turnIndex,
        mode,
        onLog: appendProxyLog,
      });

      if (mode === 'memory' || mode === 'both') setIsSyncingMemory(false);
      if (mode === 'state' || mode === 'both') setIsSyncingStates(false);

      if (!res.ok) {
        if (!silent) {
          showBanner(
            res.error || 'Không thể cập nhật ký ức / trạng thái từ AI.',
            'err',
          );
        }
        return;
      }

      const normKey = (s: string) =>
        String(s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

      const nowTs = Date.now();
      const addedMems = res.memories || [];
      const updatedStates = res.states || [];

      updateMemoryWithCompanionSync((prev) => {
        let nextEntries = [...(prev.entries || [])];
        if (addedMems.length) {
          for (let i = 0; i < addedMems.length; i++) {
            const item = addedMems[i];
            const titleKey = normKey(item.title);
            const contentKey = normKey(item.content);
            const existingIdx = nextEntries.findIndex(
              (e) =>
                (titleKey && normKey(e.title) === titleKey) ||
                (contentKey && normKey(e.content) === contentKey),
            );
            if (existingIdx >= 0) {
              const cur = nextEntries[existingIdx];
              nextEntries[existingIdx] = {
                ...cur,
                title: item.title || cur.title,
                content: item.content || cur.content,
                category: item.category || cur.category,
                turnIndex: item.turnIndex ?? cur.turnIndex,
                updatedAt: nowTs + i,
              };
            } else {
              const newEntry: MemoryEntry = {
                id: `mem_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
                title: item.title,
                content: item.content,
                category: item.category,
                turnIndex: item.turnIndex,
                pinned: false,
                updatedAt: nowTs + i,
              };
              nextEntries = [newEntry, ...nextEntries];
            }
          }
        }

        let nextStates = [...(prev.characterStates || [])];
        if (updatedStates.length) {
          for (let i = 0; i < updatedStates.length; i++) {
            const st = updatedStates[i];
            const nameKey = normKey(st.name);
            const existingIdx = nextStates.findIndex(
              (s) =>
                (nameKey && normKey(s.name) === nameKey) ||
                (st.isMc && s.isMc),
            );
            if (existingIdx >= 0) {
              const cur = nextStates[existingIdx];
              nextStates[existingIdx] = {
                ...cur,
                name: st.name || cur.name,
                isMc: st.isMc || cur.isMc,
                location: st.location || cur.location,
                mood: st.mood || cur.mood,
                status: st.status || cur.status,
                lastTurnIndex: st.lastTurnIndex ?? cur.lastTurnIndex,
                updatedAt: nowTs + i,
              };
            } else {
              const newSnapshot: CharacterStateSnapshot = {
                id: `st_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
                name: st.name,
                isMc: st.isMc,
                location: st.location,
                mood: st.mood,
                status: st.status,
                lastTurnIndex: st.lastTurnIndex,
                updatedAt: nowTs + i,
              };
              nextStates = [...nextStates, newSnapshot];
            }
          }
        }

        let nextClock = prev.storyClock;
        let nextCultivation = prev.cultivation;
        const preClock = turnPreClockRef.current.get(turnIndex);
        if (
          res.clockUpdate &&
          preClock &&
          prev.storyClock?.enabled &&
          prev.storyClock?.autoAdvance &&
          prev.storyClock?.lastTurnIndex === turnIndex &&
          prev.storyClock?.lastAdvanceReason !== 'Chỉnh tay'
        ) {
          const reconciled = reconcileAiClockUpdate(
            preClock,
            res.clockUpdate,
            turnIndex,
          );
          if (reconciled) {
            const extraDelta =
              clockToEpochMinutes(reconciled) -
              clockToEpochMinutes(prev.storyClock);
            nextClock = reconciled;
            if (extraDelta > 0 && prev.cultivation?.enabled) {
              const cultDelta = applyClockDeltaToCultivation(
                prev.cultivation,
                extraDelta,
                { reason: 'Đồng bộ thời gian AI' },
              );
              nextCultivation = cultDelta.nextProfile;
            }
          }
        }

        return {
          ...prev,
          entries: nextEntries,
          characterStates: nextStates,
          storyClock: nextClock,
          cultivation: nextCultivation,
        };
      });

      if (res.clockUpdate) {
        const preClock = turnPreClockRef.current.get(turnIndex);
        const curClock = stateRef.current.memory?.storyClock;
        if (
          preClock &&
          curClock?.enabled &&
          curClock?.autoAdvance &&
          curClock?.lastTurnIndex === turnIndex &&
          curClock?.lastAdvanceReason !== 'Chỉnh tay'
        ) {
          const reconciled = reconcileAiClockUpdate(
            preClock,
            res.clockUpdate,
            turnIndex,
          );
          if (reconciled) {
            const snap = formatStoryClock(reconciled).compactLabel;
            updateTurnsWithCompanionSync((turns) =>
              turns.map((t, i) =>
                i === turnIndex ? { ...t, storyClockSnapshot: snap } : t,
              ),
            );
          }
        }
      }

      if (!silent) {
        if (mode === 'memory') {
          showBanner(
            addedMems.length
              ? `Đã cập nhật ${addedMems.length} mục ký ức từ Trang ${turnIndex + 1}.`
              : `Trang ${turnIndex + 1} chưa có chi tiết mới cần ghi thêm vào sổ tay.`,
          );
        } else if (mode === 'state') {
          showBanner(
            updatedStates.length
              ? `Đã cập nhật trạng thái cho ${updatedStates.length} nhân vật tại Trang ${turnIndex + 1}.`
              : `Không tìm thấy thay đổi trạng thái nhân vật ở Trang ${turnIndex + 1}.`,
          );
        } else {
          showBanner(
            `Đã đồng bộ ${addedMems.length} ký ức & ${updatedStates.length} trạng thái nhân vật.`,
          );
        }
      }
    },
    [
      appendProxyLog,
      showBanner,
      updateMemoryWithCompanionSync,
      updateTurnsWithCompanionSync,
    ],
  );

  const handleRunRollingSummary = useCallback(
    async (
      forceAllOlder = false,
      silent = false,
      stateOverride?: ArkState,
    ) => {
      const working = stateOverride || stateRef.current;
      setIsSummarizing(true);
      const res = await runRollingSummaryUpdate({
        state: working,
        forceAllOlder,
        onLog: appendProxyLog,
      });
      setIsSummarizing(false);

      if (!res.ok) {
        if (!silent) {
          showBanner(
            res.error || 'Không thể tóm tắt các lượt cũ.',
            'err',
          );
        }
        return;
      }

      updateMemoryWithCompanionSync((prev) => ({
        ...prev,
        rollingSummary: {
          content: res.content || prev.rollingSummary.content,
          summarizedUpToTurn:
            typeof res.summarizedUpToTurn === 'number'
              ? res.summarizedUpToTurn
              : prev.rollingSummary.summarizedUpToTurn,
          updatedAt: Date.now(),
        },
      }));

      if (!silent) {
        showBanner(
          `Đã cập nhật bản tóm tắt mạch truyện dài (Trang 1–${res.summarizedUpToTurn || 0}).`,
        );
      }
    },
    [appendProxyLog, showBanner, updateMemoryWithCompanionSync],
  );

  const handleCancelStoryImage = useCallback(() => {
    if (imageAbortControllerRef.current) {
      imageAbortControllerRef.current.abort();
      imageAbortControllerRef.current = null;
    }
    setIsGeneratingImage(false);
    setGeneratingImageTurnIdx(null);
    setGeneratingImageTurnId(null);
  }, []);

  const handleCancelAiSuggestions = useCallback(() => {
    if (suggestionAbortRef.current) {
      suggestionAbortRef.current.abort();
      suggestionAbortRef.current = null;
    }
    setIsGeneratingSuggestions(false);
  }, []);

  const handleRequestAiSuggestions = useCallback(
    async (existingSuggestions: string[]) => {
      if (suggestionAbortRef.current) {
        suggestionAbortRef.current.abort();
      }
      const controller = new AbortController();
      suggestionAbortRef.current = controller;
      setIsGeneratingSuggestions(true);

      const curState = stateRef.current;
      const res = await generateTurnSuggestionsWithAi({
        state: curState,
        existingSuggestions,
        signal: controller.signal,
        onLog: appendProxyLog,
      });

      if (suggestionAbortRef.current === controller) {
        suggestionAbortRef.current = null;
      }
      setIsGeneratingSuggestions(false);
      return res;
    },
    [appendProxyLog],
  );

  const handleGenerateStoryImage = useCallback(
    async (turnIndex: number, turnOverride?: Turn) => {
      if (imageAbortControllerRef.current) {
        imageAbortControllerRef.current.abort();
      }
      const curState = stateRef.current;
      const targetTurn = turnOverride || curState.turns[turnIndex];
      if (!targetTurn) {
        showBanner('Chưa có lượt truyện để sinh ảnh minh họa.', 'err');
        return;
      }
      const targetTurnId = targetTurn.id;

      const controller = new AbortController();
      imageAbortControllerRef.current = controller;
      setIsGeneratingImage(true);
      setGeneratingImageTurnIdx(turnIndex);
      setGeneratingImageTurnId(targetTurnId);

      const res = await generateStoryImage({
        state: curState,
        turn: targetTurn,
        storyImageConfig: curState.storyImage,
        signal: controller.signal,
        onLog: appendProxyLog,
      });

      if (imageAbortControllerRef.current === controller) {
        imageAbortControllerRef.current = null;
      }
      setIsGeneratingImage(false);
      setGeneratingImageTurnIdx(null);
      setGeneratingImageTurnId(null);

      if (res.aborted) {
        showBanner('Đã hủy yêu cầu sinh ảnh.');
        return;
      }

      if (!res.ok || !res.imageUrl) {
        showBanner(
          res.error || 'Không thể sinh ảnh minh họa. Kiểm tra lại cấu hình Seedream.',
          'err',
        );
        return;
      }

      const resolvedIdx = stateRef.current.turns.findIndex(
        (t) => t.id === targetTurnId,
      );
      if (resolvedIdx === -1) {
        // Target turn was deleted while image was generating; do not overwrite another page
        return;
      }

      updateTurnsWithCompanionSync((turns) =>
        turns.map((t) =>
          t.id === targetTurnId
            ? {
                ...t,
                storyImageData: res.imageUrl,
                storyImagePrompt: res.prompt,
                storyImageSubject: res.subjectLabel,
              }
            : t,
        ),
      );
      showBanner(
        `Đã sinh ảnh minh họa cho Trang ${resolvedIdx + 1} (${res.subjectLabel}).`,
      );
    },
    [appendProxyLog, showBanner, updateTurnsWithCompanionSync],
  );

  const handleClearTurnStoryImage = useCallback(
    (turnIndex: number) => {
      updateTurnsWithCompanionSync((turns) =>
        turns.map((t, i) =>
          i === turnIndex
            ? {
                ...t,
                storyImageData: undefined,
                storyImagePrompt: undefined,
                storyImageSubject: undefined,
              }
            : t,
        ),
      );
    },
    [updateTurnsWithCompanionSync],
  );

  const clearBgPortraitTimer = useCallback(() => {
    if (bgPortraitClearTimerRef.current !== null) {
      window.clearTimeout(bgPortraitClearTimerRef.current);
      bgPortraitClearTimerRef.current = null;
    }
  }, []);

  const updatePortraitBankWithCompanionSync = useCallback(
    (updater: (prev: PortraitBankConfig) => PortraitBankConfig) => {
      setState((prev) => {
        const prevBank = prev.portraitBank || createDefaultPortraitBank();
        const nextBank = updater(prevBank);
        const compKey =
          activeStoryCompanionIdRef.current || prev.activeCompanionId || '';
        const nextCompPortraits = compKey
          ? { ...(prev.companionPortraits || {}), [compKey]: nextBank }
          : prev.companionPortraits || {};

        // 2-way sync: mirror manual portrait profile edits back into matching active Companion NPCs
        let nextCompanions = prev.companions;
        if (compKey && Array.isArray(prev.companions) && prev.companions.length) {
          const prevById = new Map(
            (prevBank.portraits || []).map((p) => [p.id, p]),
          );
          const changedPortraits: Array<{
            prevPortrait?: CharacterPortrait;
            nextPortrait: CharacterPortrait;
          }> = [];
          for (const np of nextBank.portraits || []) {
            if (np.isMc) continue;
            const op = prevById.get(np.id);
            if (!op) continue;
            const profileChanged =
              (op.name || '') !== (np.name || '') ||
              (op.role || '') !== (np.role || '') ||
              (op.age || '') !== (np.age || '') ||
              (op.birthday || '') !== (np.birthday || '') ||
              (op.fashionStyle || '') !== (np.fashionStyle || '') ||
              (op.appearance || '') !== (np.appearance || '') ||
              (op.personality || '') !== (np.personality || '') ||
              (op.relationships || '') !== (np.relationships || '') ||
              (op.signature || '') !== (np.signature || '');
            if (profileChanged && (np.profileManual || np.appearanceManual)) {
              changedPortraits.push({ prevPortrait: op, nextPortrait: np });
            }
          }

          if (changedPortraits.length > 0) {
            let compTouched = false;
            nextCompanions = prev.companions.map((comp) => {
              if (comp.id !== compKey) return comp;
              let npcsTouched = false;
              const updatedNpcs = (comp.npcs || []).map((npc) => {
                const npcKey = normalizeCharacterKey(npc.name);
                const match = changedPortraits.find(({ prevPortrait, nextPortrait }) => {
                  if (nextPortrait.npcId && npc.id === nextPortrait.npcId) return true;
                  if (prevPortrait?.npcId && npc.id === prevPortrait.npcId) return true;
                  const oldKey = prevPortrait
                    ? normalizeCharacterKey(prevPortrait.name)
                    : '';
                  const newKey = normalizeCharacterKey(nextPortrait.name);
                  return (
                    (Boolean(oldKey) && npcKey === oldKey) ||
                    (Boolean(newKey) && npcKey === newKey)
                  );
                });
                if (!match) return npc;
                const p = match.nextPortrait;
                npcsTouched = true;
                const nextDesc = [
                  p.appearance?.trim(),
                  p.fashionStyle?.trim() ? `Style: ${p.fashionStyle.trim()}` : '',
                  p.personality?.trim(),
                  p.relationships?.trim(),
                  p.signature?.trim(),
                ]
                  .filter(Boolean)
                  .join(' · ')
                  .slice(0, 260);
                return {
                  ...npc,
                  name: p.name.trim() || npc.name,
                  role: p.role.trim() || npc.role,
                  age: p.age?.trim() || undefined,
                  birthday: p.birthday?.trim() || undefined,
                  fashionStyle: p.fashionStyle?.trim() || undefined,
                  appearance: p.appearance.trim() || undefined,
                  personality: p.personality?.trim() || undefined,
                  relationships: p.relationships?.trim() || undefined,
                  signature: p.signature?.trim() || undefined,
                  desc: nextDesc || npc.desc,
                  profileManual: Boolean(p.profileManual || p.appearanceManual),
                };
              });
              if (!npcsTouched) return comp;
              compTouched = true;
              return { ...comp, npcs: updatedNpcs };
            });
            if (!compTouched) {
              nextCompanions = prev.companions;
            }
          }
        }

        return {
          ...prev,
          companions: nextCompanions,
          portraitBank: nextBank,
          companionPortraits: nextCompPortraits,
        };
      });
    },
    [],
  );

  const collectCleanStoryExcerpt = useCallback(
    (workingState: ArkState, preferredTurnIndex?: number): string => {
      const turns = workingState.turns || [];
      if (!turns.length) return '';
      const center =
        typeof preferredTurnIndex === 'number' &&
        preferredTurnIndex >= 0 &&
        preferredTurnIndex < turns.length
          ? preferredTurnIndex
          : Math.min(workingState.currentPage, turns.length - 1);
      const indices = Array.from(
        new Set(
          [center, center - 1, center - 2].filter(
            (i) => i >= 0 && i < turns.length,
          ),
        ),
      );
      return indices
        .map((i) => stripStoryPlanningAndMeta(turns[i]?.assistant || ''))
        .filter(Boolean)
        .join('\n\n');
    },
    [],
  );

  const collectCleanUserExcerpt = useCallback(
    (workingState: ArkState, preferredTurnIndex?: number): string => {
      const turns = workingState.turns || [];
      if (!turns.length) return '';
      const center =
        typeof preferredTurnIndex === 'number' &&
        preferredTurnIndex >= 0 &&
        preferredTurnIndex < turns.length
          ? preferredTurnIndex
          : Math.min(workingState.currentPage, turns.length - 1);
      const indices = Array.from(
        new Set(
          [center, center - 1].filter((i) => i >= 0 && i < turns.length),
        ),
      );
      return indices
        .map((i) => stripStoryPlanningAndMeta(turns[i]?.user || ''))
        .filter(Boolean)
        .join('\n');
    },
    [],
  );

  const syncVividUpdatesToCompanionNpcs = useCallback(
    (
      updatesByNameKey: Map<
        string,
        {
          role?: string;
          age?: string;
          birthday?: string;
          fashionStyle?: string;
          personality?: string;
          appearance?: string;
          relationships?: string;
          signature?: string;
        }
      >,
      forceManual: boolean,
    ) => {
      if (!updatesByNameKey.size) return;
      setState((prev) => {
        const activeId = prev.activeCompanionId;
        if (!activeId) return prev;
        let touched = false;
        const nextCompanions = prev.companions.map((comp) => {
          if (comp.id !== activeId) return comp;
          const nextNpcs = (comp.npcs || []).map((npc) => {
            const key = normalizeCharacterKey(npc.name);
            const hit = updatesByNameKey.get(key);
            if (!hit) return npc;
            if (npc.profileManual && !forceManual) return npc;
            const nextRole =
              !npc.role || npc.role === 'NPC' || npc.role === 'Nhân vật đồng nhân' || npc.role === 'Đồng nhân'
                ? hit.role || npc.role
                : npc.role;
            const nextAge = forceManual
              ? hit.age || npc.age
              : npc.age?.trim() || hit.age || undefined;
            const nextBirthday = forceManual
              ? hit.birthday || npc.birthday
              : npc.birthday?.trim() || hit.birthday || undefined;
            const nextFashion = forceManual
              ? hit.fashionStyle || npc.fashionStyle
              : npc.fashionStyle?.trim() || hit.fashionStyle || undefined;
            const nextPersonality = forceManual
              ? hit.personality || npc.personality
              : npc.personality?.trim() || hit.personality || undefined;
            const nextAppearance = forceManual
              ? hit.appearance || npc.appearance
              : npc.appearance?.trim() || hit.appearance || undefined;
            const nextRelationships = forceManual
              ? hit.relationships || npc.relationships
              : npc.relationships?.trim() || hit.relationships || undefined;
            const nextSignature = forceManual
              ? hit.signature || npc.signature
              : npc.signature?.trim() || hit.signature || undefined;
            const nextDesc =
              npc.desc?.trim() ||
              [
                nextAppearance,
                nextFashion ? `Style: ${nextFashion}` : '',
                nextPersonality,
                nextRelationships,
                nextSignature,
              ]
                .filter(Boolean)
                .join(' · ')
                .slice(0, 260);
            touched = true;
            return {
              ...npc,
              role: nextRole,
              desc: nextDesc,
              ...(nextAge ? { age: nextAge } : {}),
              ...(nextBirthday ? { birthday: nextBirthday } : {}),
              ...(nextFashion ? { fashionStyle: nextFashion } : {}),
              ...(nextPersonality ? { personality: nextPersonality } : {}),
              ...(nextAppearance ? { appearance: nextAppearance } : {}),
              ...(nextRelationships ? { relationships: nextRelationships } : {}),
              ...(nextSignature ? { signature: nextSignature } : {}),
              ...(forceManual ? { profileManual: false } : {}),
            };
          });
          return { ...comp, npcs: nextNpcs };
        });
        return touched ? { ...prev, companions: nextCompanions } : prev;
      });
    },
    [],
  );

  const enrichPortraitsAppearances = useCallback(
    async (options?: {
      portraitIds?: string[];
      forceManual?: boolean;
      silent?: boolean;
      turnIndex?: number;
      stateOverride?: ArkState;
    }) => {
      const workingState = options?.stateOverride || stateRef.current;
      const forceManual = Boolean(options?.forceManual);
      const silent = Boolean(options?.silent);
      const activeComp = getActiveCompanionFromState(workingState);
      const cleanStoryText = collectCleanStoryExcerpt(
        workingState,
        options?.turnIndex,
      );
      const cleanUserText = collectCleanUserExcerpt(
        workingState,
        options?.turnIndex,
      );

      const allPortraits = workingState.portraitBank?.portraits || [];
      const targetList = options?.portraitIds?.length
        ? allPortraits.filter((p) => options.portraitIds!.includes(p.id))
        : allPortraits.filter(
            (p) => forceManual || !p.appearanceManual || !p.profileManual,
          );

      if (!targetList.length) {
        if (!silent) {
          showBanner(
            'Không có nhân vật nào cần làm sinh động hồ sơ (các mục bạn đã sửa thủ công được giữ nguyên).',
          );
        }
        return;
      }

      const targetIds = targetList.map((p) => p.id);
      if (!options?.portraitIds?.length) setIsEnrichingAppearances(true);
      setEnrichingAppearanceIds((prev) =>
        Array.from(new Set([...prev, ...targetIds])),
      );

      // Step 1: Instant local 3-tier resolution (a) Companion -> (b) Story visual cues -> (c) Built-in vivid celebrity profiles
      const localUpdates = new Map<
        string,
        {
          role?: string;
          age?: string;
          birthday?: string;
          fashionStyle?: string;
          personality?: string;
          appearance: string;
          relationships?: string;
          signature?: string;
          source: 'companion' | 'story' | 'celebrity' | 'combined' | 'none';
        }
      >();
      for (const p of targetList) {
        const allowApp = forceManual || !p.appearanceManual;
        const allowVivid = forceManual || !p.profileManual;
        if (!allowApp && !allowVivid) continue;
        const resolved = resolveLocalVividNpcProfile({
          name: p.name,
          isMc: p.isMc,
          comp: activeComp,
          cleanStoryText,
          storyClock: workingState.memory?.storyClock,
        });
        if (
          resolved.appearance ||
          resolved.personality ||
          resolved.relationships ||
          resolved.signature ||
          resolved.role ||
          resolved.age ||
          resolved.birthday ||
          resolved.fashionStyle
        ) {
          localUpdates.set(p.id, {
            role: resolved.role || undefined,
            age: resolved.age || undefined,
            birthday: resolved.birthday || undefined,
            fashionStyle: resolved.fashionStyle || undefined,
            personality: resolved.personality || undefined,
            appearance: resolved.appearance,
            relationships: resolved.relationships || undefined,
            signature: resolved.signature || undefined,
            source: resolved.source,
          });
        }
      }

      if (localUpdates.size > 0) {
        const compSyncMap = new Map<
          string,
          {
            role?: string;
            age?: string;
            birthday?: string;
            fashionStyle?: string;
            personality?: string;
            appearance?: string;
            relationships?: string;
            signature?: string;
          }
        >();
        updatePortraitBankWithCompanionSync((prev) => ({
          ...prev,
          portraits: (prev.portraits || []).map((p) => {
            const u = localUpdates.get(p.id);
            if (!u) return p;
            const allowApp = forceManual || !p.appearanceManual;
            const allowVivid = forceManual || !p.profileManual;
            const nextAge = allowVivid
              ? forceManual
                ? u.age || p.age
                : p.age?.trim() || u.age
              : p.age;
            const nextBirthday = allowVivid
              ? forceManual
                ? u.birthday || p.birthday
                : p.birthday?.trim() || u.birthday
              : p.birthday;
            const nextFashion = allowVivid
              ? forceManual
                ? u.fashionStyle || p.fashionStyle
                : p.fashionStyle?.trim() || u.fashionStyle
              : p.fashionStyle;
            const nextAppearance = allowApp
              ? forceManual
                ? u.appearance || p.appearance
                : p.appearance?.trim()
                  ? u.source === 'story' || u.source === 'combined'
                    ? u.appearance
                    : p.appearance
                  : u.appearance || p.appearance
              : p.appearance;
            const nextPersonality = allowVivid
              ? forceManual
                ? u.personality || p.personality
                : p.personality?.trim() || u.personality
              : p.personality;
            const nextRelationships = allowVivid
              ? forceManual
                ? u.relationships || p.relationships
                : p.relationships?.trim() || u.relationships
              : p.relationships;
            const nextSignature = allowVivid
              ? forceManual
                ? u.signature || p.signature
                : p.signature?.trim() || u.signature
              : p.signature;
            if (!p.isMc) {
              compSyncMap.set(normalizeCharacterKey(p.name), {
                role: u.role,
                age: nextAge,
                birthday: nextBirthday,
                fashionStyle: nextFashion,
                personality: nextPersonality,
                appearance: nextAppearance,
                relationships: nextRelationships,
                signature: nextSignature,
              });
            }
            return {
              ...p,
              role: p.role || u.role || p.role,
              ...(nextAge ? { age: nextAge } : {}),
              ...(nextBirthday ? { birthday: nextBirthday } : {}),
              ...(nextFashion ? { fashionStyle: nextFashion } : {}),
              appearance: nextAppearance,
              ...(nextPersonality ? { personality: nextPersonality } : {}),
              ...(nextRelationships ? { relationships: nextRelationships } : {}),
              ...(nextSignature ? { signature: nextSignature } : {}),
              appearanceManual: forceManual ? false : p.appearanceManual,
              profileManual: forceManual ? false : p.profileManual,
              updatedAt: Date.now(),
            };
          }),
        }));
        syncVividUpdatesToCompanionNpcs(compSyncMap, forceManual);
      }

      // Step 2: AI Proxy enrichment (synthesizes all 8 vivid fields grounded in actual story + celebrity/character knowledge + story clock, never forcing MC when absent)
      const hasProxy = Boolean((workingState.config?.proxyUrl || '').trim());
      let aiUpdatedCount = 0;

      if (hasProxy) {
        const aiTargets = targetList
          .filter((p) => {
            const allowApp = forceManual || !p.appearanceManual;
            const allowVivid = forceManual || !p.profileManual;
            if (!allowApp && !allowVivid) return false;
            if (forceManual) return true;
            const missingAnyField =
              !p.age?.trim() ||
              !p.birthday?.trim() ||
              !p.fashionStyle?.trim() ||
              !p.appearance?.trim() ||
              !p.personality?.trim() ||
              !p.relationships?.trim() ||
              !p.signature?.trim();
            return missingAnyField || Boolean(cleanStoryText);
          })
          .map((p) => {
            const loc = localUpdates.get(p.id);
            return {
              id: p.id,
              name: p.name,
              isMc: p.isMc,
              role: p.role,
              currentAge: loc?.age || p.age || '',
              currentBirthday: loc?.birthday || p.birthday || '',
              currentFashionStyle: loc?.fashionStyle || p.fashionStyle || '',
              currentAppearance: loc?.appearance || p.appearance || '',
              currentPersonality: loc?.personality || p.personality || '',
              currentRelationships: loc?.relationships || p.relationships || '',
              currentSignature: loc?.signature || p.signature || '',
            };
          });

        if (aiTargets.length > 0) {
          const aiRes = await enrichVividNpcProfilesWithAi({
            state: workingState,
            targets: aiTargets,
            cleanStoryText,
            cleanUserText,
            onLog: appendProxyLog,
          });

          if (aiRes.ok && Object.keys(aiRes.results).length > 0) {
            const targetIdSet = new Set(aiTargets.map((t) => t.id));
            const compSyncMap = new Map<
              string,
              {
                role?: string;
                age?: string;
                birthday?: string;
                fashionStyle?: string;
                personality?: string;
                appearance?: string;
                relationships?: string;
                signature?: string;
              }
            >();

            updatePortraitBankWithCompanionSync((prev) => ({
              ...prev,
              portraits: (prev.portraits || []).map((p) => {
                if (!targetIdSet.has(p.id)) return p;
                const allowApp = forceManual || !p.appearanceManual;
                const allowVivid = forceManual || !p.profileManual;
                if (!allowApp && !allowVivid) return p;
                const hit = aiRes.results[normalizeCharacterKey(p.name)];
                if (!hit) return p;
                aiUpdatedCount += 1;
                const nextRole =
                  p.role &&
                  p.role !== 'NPC' &&
                  p.role !== 'NPC trong truyện' &&
                  p.role !== 'NPC đồng nhân'
                    ? p.role
                    : hit.role || p.role;
                const nextAge = allowVivid
                  ? hit.age || p.age
                  : p.age;
                const nextBirthday = allowVivid
                  ? hit.birthday || p.birthday
                  : p.birthday;
                const nextFashion = allowVivid
                  ? hit.fashionStyle || p.fashionStyle
                  : p.fashionStyle;
                const nextAppearance = allowApp
                  ? hit.appearance || p.appearance
                  : p.appearance;
                const nextPersonality = allowVivid
                  ? hit.personality || p.personality
                  : p.personality;
                const nextRelationships = allowVivid
                  ? hit.relationships || p.relationships
                  : p.relationships;
                const nextSignature = allowVivid
                  ? hit.signature || p.signature
                  : p.signature;
                if (!p.isMc) {
                  compSyncMap.set(normalizeCharacterKey(p.name), {
                    role: nextRole,
                    age: nextAge,
                    birthday: nextBirthday,
                    fashionStyle: nextFashion,
                    personality: nextPersonality,
                    appearance: nextAppearance,
                    relationships: nextRelationships,
                    signature: nextSignature,
                  });
                }
                return {
                  ...p,
                  role: nextRole,
                  ...(nextAge ? { age: nextAge } : {}),
                  ...(nextBirthday ? { birthday: nextBirthday } : {}),
                  ...(nextFashion ? { fashionStyle: nextFashion } : {}),
                  appearance: nextAppearance,
                  ...(nextPersonality ? { personality: nextPersonality } : {}),
                  ...(nextRelationships
                    ? { relationships: nextRelationships }
                    : {}),
                  ...(nextSignature ? { signature: nextSignature } : {}),
                  appearanceManual: forceManual ? false : p.appearanceManual,
                  profileManual: forceManual ? false : p.profileManual,
                  updatedAt: Date.now(),
                };
              }),
            }));
            syncVividUpdatesToCompanionNpcs(compSyncMap, forceManual);
          }
        }
      }

      if (!options?.portraitIds?.length) setIsEnrichingAppearances(false);
      setEnrichingAppearanceIds((prev) =>
        prev.filter((id) => !targetIds.includes(id)),
      );

      if (!silent) {
        const totalUpdated = Math.max(aiUpdatedCount, localUpdates.size);
        if (totalUpdated > 0) {
          showBanner(
            `Đã làm sinh động hồ sơ cho ${totalUpdated} nhân vật (giữ nguyên các phần bạn đã chỉnh thủ công).`,
          );
        } else if (!hasProxy) {
          showBanner(
            'Đã kiểm tra hồ sơ cục bộ. Cấu hình Proxy API để AI làm sinh động đầy đủ tuổi tác, style ăn mặc, tính cách và ngoại hình.',
          );
        } else {
          showBanner('Đã kiểm tra và cập nhật hồ sơ nhân vật.');
        }
      }
    },
    [
      appendProxyLog,
      collectCleanStoryExcerpt,
      collectCleanUserExcerpt,
      showBanner,
      syncVividUpdatesToCompanionNpcs,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const enrichCompanionNpcs = useCallback(
    async (options?: { npcIds?: string[]; forceManual?: boolean }) => {
      const workingState = stateRef.current;
      const forceManual = Boolean(options?.forceManual);
      const activeComp = getActiveCompanionFromState(workingState);
      const allNpcs = activeComp?.npcs || [];
      if (!allNpcs.length) {
        showBanner('Chưa có NPC đồng nhân nào để làm sinh động.', 'err');
        return;
      }

      const targetList = options?.npcIds?.length
        ? allNpcs.filter((n) => options.npcIds!.includes(n.id))
        : allNpcs.filter(
            (n) =>
              forceManual ||
              !n.profileManual ||
              !n.age?.trim() ||
              !n.birthday?.trim() ||
              !n.fashionStyle?.trim() ||
              !n.personality?.trim() ||
              !n.appearance?.trim(),
          );

      if (!targetList.length) {
        showBanner(
          'Tất cả NPC đã có hồ sơ thủ công hoàn chỉnh. Bấm "Làm sinh động" trên từng NPC nếu muốn làm mới.',
        );
        return;
      }

      const targetIds = targetList.map((n) => n.id);
      if (!options?.npcIds?.length) setIsEnrichingAllNpcs(true);
      setEnrichingNpcIds((prev) => Array.from(new Set([...prev, ...targetIds])));

      const cleanStoryText = collectCleanStoryExcerpt(workingState);
      const cleanUserText = collectCleanUserExcerpt(workingState);

      // Step 1: Instant local vivid profile resolution
      const localMap = new Map<
        string,
        {
          role?: string;
          age?: string;
          birthday?: string;
          fashionStyle?: string;
          personality?: string;
          appearance?: string;
          relationships?: string;
          signature?: string;
        }
      >();
      for (const npc of targetList) {
        const resolved = resolveLocalVividNpcProfile({
          name: npc.name,
          isMc: false,
          comp: activeComp,
          cleanStoryText,
          storyClock: workingState.memory?.storyClock,
        });
        if (
          resolved.appearance ||
          resolved.personality ||
          resolved.relationships ||
          resolved.signature ||
          resolved.age ||
          resolved.birthday ||
          resolved.fashionStyle
        ) {
          localMap.set(normalizeCharacterKey(npc.name), {
            role: resolved.role || undefined,
            age: resolved.age || undefined,
            birthday: resolved.birthday || undefined,
            fashionStyle: resolved.fashionStyle || undefined,
            personality: resolved.personality || undefined,
            appearance: resolved.appearance || undefined,
            relationships: resolved.relationships || undefined,
            signature: resolved.signature || undefined,
          });
        }
      }
      if (localMap.size > 0) {
        syncVividUpdatesToCompanionNpcs(localMap, forceManual);
        updatePortraitBankWithCompanionSync((prev) => ({
          ...prev,
          portraits: (prev.portraits || []).map((p) => {
            if (p.isMc) return p;
            const hit = localMap.get(normalizeCharacterKey(p.name));
            if (!hit) return p;
            const allowApp = forceManual || !p.appearanceManual;
            const allowVivid = forceManual || !p.profileManual;
            return {
              ...p,
              role: p.role || hit.role || p.role,
              ...(allowVivid && (forceManual ? hit.age : !p.age?.trim() && hit.age)
                ? { age: hit.age }
                : {}),
              ...(allowVivid &&
              (forceManual ? hit.birthday : !p.birthday?.trim() && hit.birthday)
                ? { birthday: hit.birthday }
                : {}),
              ...(allowVivid &&
              (forceManual
                ? hit.fashionStyle
                : !p.fashionStyle?.trim() && hit.fashionStyle)
                ? { fashionStyle: hit.fashionStyle }
                : {}),
              appearance: allowApp
                ? forceManual
                  ? hit.appearance || p.appearance
                  : p.appearance || hit.appearance || ''
                : p.appearance,
              ...(allowVivid && hit.personality && (forceManual || !p.personality?.trim())
                ? { personality: hit.personality }
                : {}),
              ...(allowVivid && hit.relationships && (forceManual || !p.relationships?.trim())
                ? { relationships: hit.relationships }
                : {}),
              ...(allowVivid && hit.signature && (forceManual || !p.signature?.trim())
                ? { signature: hit.signature }
                : {}),
              updatedAt: Date.now(),
            };
          }),
        }));
      }

      // Step 2: AI enrichment via Proxy API
      const hasProxy = Boolean((workingState.config?.proxyUrl || '').trim());
      let aiUpdatedCount = 0;

      if (hasProxy) {
        const aiTargets = targetList.map((npc) => {
          const loc = localMap.get(normalizeCharacterKey(npc.name));
          return {
            id: npc.id,
            name: npc.name,
            isMc: false,
            role: npc.role || 'NPC',
            currentAge: npc.age || loc?.age || '',
            currentBirthday: npc.birthday || loc?.birthday || '',
            currentFashionStyle: npc.fashionStyle || loc?.fashionStyle || '',
            currentAppearance:
              npc.appearance || loc?.appearance || npc.desc || '',
            currentPersonality: npc.personality || loc?.personality || '',
            currentRelationships: npc.relationships || loc?.relationships || '',
            currentSignature: npc.signature || loc?.signature || '',
          };
        });

        const aiRes = await enrichVividNpcProfilesWithAi({
          state: workingState,
          targets: aiTargets,
          cleanStoryText,
          cleanUserText,
          onLog: appendProxyLog,
        });

        if (aiRes.ok && Object.keys(aiRes.results).length > 0) {
          const aiMap = new Map<
            string,
            {
              role?: string;
              age?: string;
              birthday?: string;
              fashionStyle?: string;
              personality?: string;
              appearance?: string;
              relationships?: string;
              signature?: string;
            }
          >();
          for (const [k, v] of Object.entries(aiRes.results)) {
            aiMap.set(k, v);
          }
          aiUpdatedCount = aiMap.size;
          syncVividUpdatesToCompanionNpcs(aiMap, forceManual);

          // Mirror vivid updates straight into Portrait Bank too (respecting manual edits unless forced)
          updatePortraitBankWithCompanionSync((prev) => ({
            ...prev,
            portraits: (prev.portraits || []).map((p) => {
              if (p.isMc) return p;
              const hit = aiMap.get(normalizeCharacterKey(p.name));
              if (!hit) return p;
              const allowApp = forceManual || !p.appearanceManual;
              const allowVivid = forceManual || !p.profileManual;
              return {
                ...p,
                role: p.role || hit.role || p.role,
                ...(allowVivid && hit.age ? { age: hit.age } : {}),
                ...(allowVivid && hit.birthday
                  ? { birthday: hit.birthday }
                  : {}),
                ...(allowVivid && hit.fashionStyle
                  ? { fashionStyle: hit.fashionStyle }
                  : {}),
                appearance: allowApp
                  ? hit.appearance || p.appearance
                  : p.appearance,
                ...(allowVivid && hit.personality
                  ? { personality: hit.personality }
                  : {}),
                ...(allowVivid && hit.relationships
                  ? { relationships: hit.relationships }
                  : {}),
                ...(allowVivid && hit.signature
                  ? { signature: hit.signature }
                  : {}),
                updatedAt: Date.now(),
              };
            }),
          }));
        }
      }

      if (!options?.npcIds?.length) setIsEnrichingAllNpcs(false);
      setEnrichingNpcIds((prev) => prev.filter((id) => !targetIds.includes(id)));

      const totalUpdated = Math.max(aiUpdatedCount, localMap.size);
      if (totalUpdated > 0) {
        showBanner(
          `Đã làm sinh động hồ sơ cho ${totalUpdated} NPC (đồng bộ cùng Thư viện Ảnh Nhân vật).`,
        );
      } else if (!hasProxy) {
        showBanner(
          'Chưa cấu hình Proxy API. Hãy cấu hình Proxy để AI tự làm sinh động hồ sơ NPC.',
          'err',
        );
      } else {
        showBanner('Đã kiểm tra hồ sơ NPC hiện tại.');
      }
    },
    [
      appendProxyLog,
      collectCleanStoryExcerpt,
      collectCleanUserExcerpt,
      showBanner,
      syncVividUpdatesToCompanionNpcs,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const handleCleanJunkPortraits = useCallback(() => {
    const curState = stateRef.current;
    const activeComp = getActiveCompanionFromState(curState);
    const { bank: cleanedBank, removedNames } = cleanJunkPortraitsFromBank(
      curState.portraitBank || createDefaultPortraitBank(),
      activeComp,
      curState.player?.name,
    );
    if (removedNames.length > 0) {
      updatePortraitBankWithCompanionSync(() => cleanedBank);
      const preview = removedNames.slice(0, 4).join(', ');
      showBanner(
        `Đã lọc bỏ ${removedNames.length} mục tên rác (${preview}${
          removedNames.length > 4 ? '...' : ''
        }), giữ nguyên ${cleanedBank.portraits.length} nhân vật hợp lệ.`,
      );
    } else {
      showBanner(
        'Danh sách nhân vật đã sạch, không phát hiện mục tên rác nào.',
      );
    }
  }, [showBanner, updatePortraitBankWithCompanionSync]);

  const handleSyncPortraitsFromCompanion = useCallback(() => {
    const curState = stateRef.current;
    const activeComp = getActiveCompanionFromState(curState);
    const { removedNames } = cleanJunkPortraitsFromBank(
      curState.portraitBank || createDefaultPortraitBank(),
      activeComp,
      curState.player?.name,
    );
    updatePortraitBankWithCompanionSync((prev) =>
      syncPortraitBankWithCompanion(
        prev,
        activeComp,
        curState.player?.name,
        curState.memory?.storyClock,
      ),
    );
    showBanner(
      removedNames.length > 0
        ? `Đã đồng bộ từ Đồng nhân và tự lọc bỏ ${removedNames.length} mục tên rác.`
        : 'Đã đồng bộ danh sách nhân vật & NPC từ hồ sơ Đồng nhân.',
    );
    window.setTimeout(() => {
      void enrichPortraitsAppearances({ silent: true });
    }, 60);
  }, [
    enrichPortraitsAppearances,
    showBanner,
    updatePortraitBankWithCompanionSync,
  ]);

  const handleCancelBgPortraits = useCallback(() => {
    clearBgPortraitTimer();
    if (bgPortraitAbortRef.current) {
      bgPortraitAbortRef.current.abort();
      bgPortraitAbortRef.current = null;
    }
    setBgPortraitStatus(null);
    setGeneratingPortraitIds([]);
  }, [clearBgPortraitTimer]);

  const handleGenerateSinglePortrait = useCallback(
    async (portraitId: string) => {
      let curState = stateRef.current;
      let target = (curState.portraitBank?.portraits || []).find(
        (p) => p.id === portraitId,
      );
      if (!target) return;

      // Auto-resolve missing appearance before calling Seedream 5 Pro (never overwrites manual edits)
      if (!target.appearance?.trim() && !target.appearanceManual) {
        await enrichPortraitsAppearances({
          portraitIds: [portraitId],
          forceManual: false,
          silent: true,
        });
        curState = stateRef.current;
        target =
          (curState.portraitBank?.portraits || []).find(
            (p) => p.id === portraitId,
          ) || target;
      }

      setGeneratingPortraitIds((prev) =>
        prev.includes(portraitId) ? prev : [...prev, portraitId],
      );

      const currentTurn = curState.turns[curState.currentPage];
      const sceneHint = stripStoryPlanningAndMeta(
        currentTurn?.assistant || currentTurn?.user || '',
      );

      const res = await generateCharacterPortraitImage({
        state: curState,
        character: target,
        sceneContext: sceneHint,
        onLog: appendProxyLog,
      });

      setGeneratingPortraitIds((prev) =>
        prev.filter((id) => id !== portraitId),
      );

      if (res.aborted) return;

      if (!res.ok || !res.imageUrl) {
        showBanner(
          res.error ||
            `Không thể tạo ảnh cho "${target.name}". Kiểm tra cấu hình Seedream 5 Pro.`,
          'err',
        );
        return;
      }

      updatePortraitBankWithCompanionSync((prev) => ({
        ...prev,
        portraits: prev.portraits.map((p) =>
          p.id === portraitId
            ? {
                ...p,
                imageData: res.imageUrl,
                prompt: res.prompt,
                autoGenerated: false,
                updatedAt: Date.now(),
              }
            : p,
        ),
      }));
      showBanner(`Đã tạo ảnh nhân vật: ${target.name}.`);
    },
    [
      appendProxyLog,
      enrichPortraitsAppearances,
      showBanner,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const handleRunBackgroundAutoPortraits = useCallback(
    async (
      turnIndex: number,
      options?: { manual?: boolean; stateOverride?: ArkState },
    ) => {
      const manual = Boolean(options?.manual);
      const workingState = options?.stateOverride || stateRef.current;
      const activeComp = getActiveCompanionFromState(workingState);
      const targetTurn = workingState.turns[turnIndex];
      if (!targetTurn) {
        if (manual) {
          showBanner('Chưa có lượt truyện để quét nhân vật.', 'err');
        }
        return;
      }

      // Clean any previously leaked junk entries first without deleting valid characters/images
      const { bank: cleanedBank, removedNames } = cleanJunkPortraitsFromBank(
        workingState.portraitBank || createDefaultPortraitBank(),
        activeComp,
        workingState.player?.name,
      );
      if (removedNames.length > 0) {
        updatePortraitBankWithCompanionSync(() => cleanedBank);
      }

      const cleanWorkingState: ArkState = {
        ...workingState,
        portraitBank: cleanedBank,
      };

      const detected = detectCharactersInTurnForPortraits(
        targetTurn,
        cleanWorkingState,
      );
      if (!detected.length) {
        if (manual) {
          showBanner(
            removedNames.length > 0
              ? `Đã lọc bỏ ${removedNames.length} mục tên rác. Không nhận diện được thêm nhân vật hợp lệ ở Trang ${turnIndex + 1}.`
              : `Không nhận diện được tên nhân vật cụ thể ở Trang ${turnIndex + 1}.`,
          );
        }
        return;
      }

      const nowTs = Date.now();
      const mergedPortraits: CharacterPortrait[] = [
        ...(cleanedBank.portraits || []),
      ];
      const matchedQueue: Array<{
        portrait: CharacterPortrait;
        contextSnippet: string;
      }> = [];

      for (let i = 0; i < detected.length; i++) {
        const cand = detected[i];
        const candKey = normalizeCharacterKey(cand.name);
        if (!candKey) continue;

        const existingIdx = mergedPortraits.findIndex(
          (p) =>
            (cand.npcId && p.npcId === cand.npcId) ||
            normalizeCharacterKey(p.name) === candKey ||
            (cand.isMc && p.isMc),
        );

        let entry: CharacterPortrait;
        if (existingIdx >= 0) {
          const cur = mergedPortraits[existingIdx];
          entry = {
            ...cur,
            role: cur.role || cand.role,
            appearance: cur.appearanceManual
              ? cur.appearance
              : cur.appearance || cand.appearance,
            ...(cur.profileManual
              ? {}
              : {
                  age: cur.age || cand.age || undefined,
                  birthday: cur.birthday || cand.birthday || undefined,
                  fashionStyle:
                    cur.fashionStyle || cand.fashionStyle || undefined,
                  personality: cur.personality || cand.personality || undefined,
                  relationships:
                    cur.relationships || cand.relationships || undefined,
                  signature: cur.signature || cand.signature || undefined,
                }),
            npcId: cur.npcId || cand.npcId,
            lastSeenTurnIndex: turnIndex,
          };
          mergedPortraits[existingIdx] = entry;
        } else {
          entry = {
            id: `port_auto_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
            name: cand.name,
            isMc: cand.isMc,
            role: cand.role,
            ...(cand.age ? { age: cand.age } : {}),
            ...(cand.birthday ? { birthday: cand.birthday } : {}),
            ...(cand.fashionStyle ? { fashionStyle: cand.fashionStyle } : {}),
            appearance: cand.appearance,
            ...(cand.personality ? { personality: cand.personality } : {}),
            ...(cand.relationships
              ? { relationships: cand.relationships }
              : {}),
            ...(cand.signature ? { signature: cand.signature } : {}),
            appearanceManual: false,
            profileManual: false,
            npcId: cand.npcId,
            lastSeenTurnIndex: turnIndex,
            updatedAt: nowTs + i,
          };
          mergedPortraits.push(entry);
        }
        matchedQueue.push({
          portrait: entry,
          contextSnippet: cand.contextSnippet,
        });
      }

      const updatedBankSnapshot: PortraitBankConfig = {
        ...cleanedBank,
        portraits: mergedPortraits,
      };

      // Persist newly discovered valid characters and lastSeenTurnIndex immediately
      updatePortraitBankWithCompanionSync((prev) => {
        const { bank: safePrev } = cleanJunkPortraitsFromBank(
          prev,
          activeComp,
          workingState.player?.name,
        );
        const nextList = [...(safePrev.portraits || [])];
        for (const item of matchedQueue) {
          const p = item.portrait;
          const pKey = normalizeCharacterKey(p.name);
          const idx = nextList.findIndex(
            (x) =>
              x.id === p.id ||
              (p.npcId && x.npcId === p.npcId) ||
              normalizeCharacterKey(x.name) === pKey ||
              (p.isMc && x.isMc),
          );
          if (idx >= 0) {
            const cur = nextList[idx];
            nextList[idx] = {
              ...cur,
              role: cur.role || p.role,
              appearance: cur.appearanceManual
                ? cur.appearance
                : cur.appearance || p.appearance,
              ...(cur.profileManual
                ? {}
                : {
                    age: cur.age || p.age || undefined,
                    birthday: cur.birthday || p.birthday || undefined,
                    fashionStyle:
                      cur.fashionStyle || p.fashionStyle || undefined,
                    personality: cur.personality || p.personality || undefined,
                    relationships:
                      cur.relationships || p.relationships || undefined,
                    signature: cur.signature || p.signature || undefined,
                  }),
              npcId: cur.npcId || p.npcId,
              lastSeenTurnIndex: turnIndex,
            };
          } else {
            nextList.push(p);
          }
        }
        return { ...safePrev, portraits: nextList };
      });

      // Enrich vivid profiles & appearances of detected non-manual characters with AI before Seedream
      const idsToEnrich = matchedQueue
        .filter(
          (item) =>
            !item.portrait.appearanceManual || !item.portrait.profileManual,
        )
        .map((item) => item.portrait.id);
      if (idsToEnrich.length > 0) {
        await enrichPortraitsAppearances({
          portraitIds: idsToEnrich,
          forceManual: false,
          silent: true,
          turnIndex,
          stateOverride: {
            ...cleanWorkingState,
            portraitBank: updatedBankSnapshot,
          },
        });
      }

      const includeMc = Boolean(cleanedBank.includeMcAuto);
      const maxPerTurn = Math.max(
        1,
        Math.min(3, Number(cleanedBank.maxAutoPerTurn) || 2),
      );

      const missingTargets = matchedQueue
        .filter((item) => {
          if (item.portrait.imageData) return false;
          if (item.portrait.isMc && !includeMc) return false;
          return true;
        })
        .slice(0, maxPerTurn);

      if (!missingTargets.length) {
        if (manual) {
          showBanner(
            `Đã cập nhật mô tả ngoại hình — các nhân vật xuất hiện ở Trang ${turnIndex + 1} đều đã có ảnh.`,
          );
        }
        return;
      }

      const hasSeedream = Boolean(
        (
          workingState.config.seedreamUrl ||
          workingState.config.proxyUrl ||
          ''
        ).trim(),
      );
      if (!hasSeedream) {
        if (manual) {
          showBanner(
            'Chưa cấu hình Seedream 5 Pro Endpoint trong tab Cấu hình để sinh ảnh nhân vật.',
            'err',
          );
        } else {
          setBgPortraitStatus({
            active: false,
            text: 'Chưa cấu hình Seedream Endpoint để tự sinh ảnh NPC ngầm.',
            isErr: true,
          });
        }
        return;
      }

      clearBgPortraitTimer();
      if (bgPortraitAbortRef.current) {
        bgPortraitAbortRef.current.abort();
      }
      const controller = new AbortController();
      bgPortraitAbortRef.current = controller;

      const generatedNames: string[] = [];
      let lastError = '';

      for (let i = 0; i < missingTargets.length; i++) {
        if (controller.signal.aborted) break;
        const { portrait, contextSnippet } = missingTargets[i];

        // Re-check latest state so we use the newly enriched appearance & skip if already generated
        const latestEntry = (
          stateRef.current.portraitBank?.portraits || []
        ).find(
          (x) =>
            x.id === portrait.id ||
            normalizeCharacterKey(x.name) ===
              normalizeCharacterKey(portrait.name),
        );
        if (latestEntry?.imageData) continue;
        const targetId = latestEntry?.id || portrait.id;
        const targetChar = latestEntry || portrait;

        setBgPortraitStatus({
          active: true,
          text: `Đang sinh ảnh ngầm (${i + 1}/${missingTargets.length}): ${targetChar.name}...`,
        });
        setGeneratingPortraitIds((prev) =>
          prev.includes(targetId) ? prev : [...prev, targetId],
        );

        const res = await generateCharacterPortraitImage({
          state: stateRef.current,
          character: targetChar,
          sceneContext: contextSnippet,
          signal: controller.signal,
          onLog: appendProxyLog,
        });

        setGeneratingPortraitIds((prev) =>
          prev.filter((id) => id !== targetId),
        );

        if (res.aborted || controller.signal.aborted) {
          if (bgPortraitAbortRef.current === controller) {
            bgPortraitAbortRef.current = null;
          }
          setBgPortraitStatus(null);
          return;
        }

        if (res.ok && res.imageUrl) {
          generatedNames.push(targetChar.name);
          updatePortraitBankWithCompanionSync((prev) => ({
            ...prev,
            portraits: prev.portraits.map((p) =>
              p.id === targetId ||
              normalizeCharacterKey(p.name) ===
                normalizeCharacterKey(targetChar.name)
                ? {
                    ...p,
                    imageData: res.imageUrl,
                    prompt: res.prompt,
                    autoGenerated: true,
                    lastSeenTurnIndex: turnIndex,
                    updatedAt: Date.now(),
                  }
                : p,
            ),
          }));
        } else if (res.error) {
          lastError = res.error;
        }
      }

      if (bgPortraitAbortRef.current === controller) {
        bgPortraitAbortRef.current = null;
      }

      if (generatedNames.length > 0) {
        setBgPortraitStatus({
          active: false,
          text: `Đã tự sinh ảnh ngầm: ${generatedNames.join(', ')}`,
          isErr: false,
        });
        bgPortraitClearTimerRef.current = window.setTimeout(() => {
          bgPortraitClearTimerRef.current = null;
          setBgPortraitStatus((cur) => (cur && !cur.active ? null : cur));
        }, 12000);
      } else if (lastError) {
        setBgPortraitStatus({
          active: false,
          text: `Sinh ảnh ngầm lỗi: ${lastError}`,
          isErr: true,
        });
      } else {
        setBgPortraitStatus(null);
      }
    },
    [
      appendProxyLog,
      clearBgPortraitTimer,
      enrichPortraitsAppearances,
      showBanner,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const cancelScheduledStreamFrame = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    if (streamDrainTimerRef.current !== null) {
      window.clearTimeout(streamDrainTimerRef.current);
      streamDrainTimerRef.current = null;
    }
    if (streamDrainResolveRef.current) {
      const resolve = streamDrainResolveRef.current;
      streamDrainResolveRef.current = null;
      resolve();
    }
  }, []);

  useEffect(
    () => () => {
      cancelScheduledStreamFrame();
      clearBgPortraitTimer();
      bgPortraitAbortRef.current?.abort();
    },
    [cancelScheduledStreamFrame, clearBgPortraitTimer],
  );

  // Model execution engine
  const runModelTurn = useCallback(
    async (turnIndex: number, snapshotState?: ArkState) => {
      if (isGenerating) return;
      const workingState = snapshotState || stateRef.current;
      const baseTurn = workingState.turns[turnIndex];
      if (!baseTurn) return;
      const targetTurnId = baseTurn.id;

      // Capture pre-turn clock so regenerating this turn recalculates from the exact pre-turn anchor
      const existingPreClock = turnPreClockRef.current.get(turnIndex);
      const preTurnClock = existingPreClock
        ? normalizeStoryClock(existingPreClock)
        : normalizeStoryClock(workingState.memory?.storyClock);
      turnPreClockRef.current.set(turnIndex, preTurnClock);

      cancelScheduledStreamFrame();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const startTs = Date.now();
      streamAbortedRef.current = false;
      streamLastTickRef.current = 0;
      streamLastCommitRef.current = 0;
      streamDisplayedLenRef.current = 0;
      streamCarryRef.current = 0;
      streamFastDrainRef.current = false;
      streamTargetRef.current = { turnIndex, turnId: targetTurnId, text: '' };
      setIsGenerating(true);
      setStreamingState({ turnIndex, turnId: targetTurnId, text: '' });
      setGenStatus({
        text: workingState.streamEnabled ? 'Đang stream...' : 'Đang gọi...',
        isErr: false,
      });

      // Clear target turn's assistant text before streaming (matched strictly by turnId)
      updateTurnsWithCompanionSync((turns) =>
        turns.map((t) =>
          t.id === targetTurnId
            ? { ...t, assistant: '', rawAssistant: undefined }
            : t,
        ),
      );

      const stepStreamPacer = (now: number) => {
        streamRafRef.current = null;
        if (streamAbortedRef.current) return;
        const target = streamTargetRef.current;
        if (!target) return;

        const total = target.text.length;
        const curLen = streamDisplayedLenRef.current;
        const backlog = total - curLen;

        if (backlog <= 0) {
          streamLastTickRef.current = 0;
          if (streamDrainResolveRef.current) {
            const resolve = streamDrainResolveRef.current;
            streamDrainResolveRef.current = null;
            if (streamDrainTimerRef.current !== null) {
              window.clearTimeout(streamDrainTimerRef.current);
              streamDrainTimerRef.current = null;
            }
            resolve();
          }
          return;
        }

        // Detect whether cursor is still inside leading thinking / draft / English outline before main story
        const draftEndOffset = getLeadingDraftEndOffset(target.text);
        const inLeadingDraft = curLen < draftEndOffset;

        // Faster frame cadence during thinking/draft/English outline; keep unhurried 34ms cadence for main story
        const minCommitIntervalMs = inLeadingDraft ? 16 : 34;
        if (
          streamLastCommitRef.current > 0 &&
          now - streamLastCommitRef.current < minCommitIntervalMs
        ) {
          streamRafRef.current = requestAnimationFrame(stepStreamPacer);
          return;
        }

        const prevTick = streamLastTickRef.current || now - minCommitIntervalMs;
        const dtMs = Math.min(72, Math.max(16, now - prevTick));
        streamLastTickRef.current = now;

        // Fast sweep through thinking/draft/outline; preserve unhurried, graceful pacing for main story
        const fastDrain = streamFastDrainRef.current;
        const charsPerSec = inLeadingDraft
          ? Math.min(2600, 900 + backlog * 4.5)
          : fastDrain
            ? Math.min(175, 62 + backlog * 0.55)
            : Math.min(135, 44 + backlog * 0.42);

        const rawAdvance = (charsPerSec * dtMs) / 1000 + streamCarryRef.current;
        const wholeChars = Math.floor(rawAdvance);
        streamCarryRef.current = rawAdvance - wholeChars;

        if (wholeChars > 0) {
          const maxStep = inLeadingDraft
            ? Math.max(18, Math.min(96, Math.ceil(backlog * 0.35)))
            : fastDrain
              ? Math.max(2, Math.min(6, Math.ceil(backlog * 0.055)))
              : Math.max(2, Math.min(5, Math.ceil(backlog * 0.045)));

          let nextLen = Math.min(total, curLen + Math.min(wholeChars, maxStep));

          // Stop cleanly right at the end of the draft/outline so main story always starts at gentle pace
          if (inLeadingDraft && draftEndOffset < total && nextLen > draftEndOffset) {
            nextLen = draftEndOffset;
            streamCarryRef.current = 0;
          }

          // Never split UTF-16 surrogate pairs
          if (nextLen < total) {
            const code = target.text.charCodeAt(nextLen - 1);
            if (code >= 0xd800 && code <= 0xdbff) {
              nextLen = Math.min(total, nextLen + 1);
            }
          }

          // Never flash half-open XML tags like `</thi` or `<sto`
          const revealedSlice = target.text.slice(curLen, nextLen);
          const lastLt = revealedSlice.lastIndexOf('<');
          const lastGt = revealedSlice.lastIndexOf('>');
          if (lastLt > lastGt) {
            const absLt = curLen + lastLt;
            const closeIdx = target.text.indexOf('>', absLt);
            if (closeIdx !== -1 && closeIdx - absLt <= 32) {
              nextLen = closeIdx + 1;
            } else if (absLt > curLen) {
              nextLen = absLt;
            }
          }

          if (nextLen > curLen) {
            streamDisplayedLenRef.current = nextLen;
            streamLastCommitRef.current = now;
            setStreamingState({
              turnIndex: target.turnIndex,
              turnId: target.turnId,
              text: target.text.slice(0, nextLen),
            });
          }
        }

        if (streamDisplayedLenRef.current < target.text.length) {
          streamRafRef.current = requestAnimationFrame(stepStreamPacer);
        } else if (streamDrainResolveRef.current) {
          const resolve = streamDrainResolveRef.current;
          streamDrainResolveRef.current = null;
          if (streamDrainTimerRef.current !== null) {
            window.clearTimeout(streamDrainTimerRef.current);
            streamDrainTimerRef.current = null;
          }
          resolve();
        }
      };

      const ensurePacerRunning = () => {
        if (streamAbortedRef.current || streamRafRef.current !== null) return;
        streamRafRef.current = requestAnimationFrame(stepStreamPacer);
      };

      const result = await executeModelTurn({
        state: workingState,
        turnIndex,
        signal: controller.signal,
        onChunk: (accumulated) => {
          if (streamAbortedRef.current) return;
          streamTargetRef.current = {
            turnIndex,
            turnId: targetTurnId,
            text: accumulated,
          };
          ensurePacerRunning();
        },
        onLog: appendProxyLog,
      });

      // If user already pressed Stop, handleStopGeneration has already cleaned up & saved partial text
      if (streamAbortedRef.current || result.aborted) {
        if (!streamAbortedRef.current) {
          const target = streamTargetRef.current;
          const visibleLen = streamDisplayedLenRef.current;
          const partialText = target
            ? visibleLen > 0
              ? target.text.slice(0, visibleLen)
              : target.text
            : '';
          cancelScheduledStreamFrame();
          streamTargetRef.current = null;
          streamDisplayedLenRef.current = 0;
          streamCarryRef.current = 0;
          streamFastDrainRef.current = false;
          abortControllerRef.current = null;
          setStreamingState(null);
          setIsGenerating(false);
          if (partialText) {
            const cleanPartial = sanitizeCompletedStoryResponse(partialText);
            updateTurnsWithCompanionSync((turns) =>
              turns.map((t) =>
                t.id === targetTurnId
                  ? {
                      ...t,
                      assistant: cleanPartial,
                      ...(partialText !== cleanPartial
                        ? { rawAssistant: partialText }
                        : {}),
                    }
                  : t,
              ),
            );
          }
          setGenStatus({ text: 'Đã dừng', isErr: false });
        }
        return;
      }

      const elapsedMs = Math.max(1, Date.now() - startTs);
      const rawFinalText =
        result.rawText || streamTargetRef.current?.text || result.text || '';
      const finalText = result.ok
        ? sanitizeCompletedStoryResponse(result.text || rawFinalText)
        : result.text || rawFinalText;
      const drainSourceText =
        streamTargetRef.current?.text || rawFinalText || finalText;

      // Gracefully glide through the remaining buffered tail without teleporting
      const remainingTail = drainSourceText.length - streamDisplayedLenRef.current;
      if (
        workingState.streamEnabled &&
        result.ok &&
        drainSourceText &&
        remainingTail > 0 &&
        remainingTail <= 2400 &&
        !document.hidden
      ) {
        streamTargetRef.current = {
          turnIndex,
          turnId: targetTurnId,
          text: drainSourceText,
        };
        streamFastDrainRef.current = true;
        const maxDrainMs = Math.min(
          9000,
          Math.max(1200, Math.ceil((remainingTail / 60) * 1000) + 400),
        );
        await new Promise<void>((resolve) => {
          streamDrainResolveRef.current = resolve;
          streamDrainTimerRef.current = window.setTimeout(() => {
            streamDrainTimerRef.current = null;
            if (streamDrainResolveRef.current === resolve) {
              streamDrainResolveRef.current = null;
              resolve();
            }
          }, maxDrainMs);
          ensurePacerRunning();
        });
        if (streamAbortedRef.current) return;
      }

      cancelScheduledStreamFrame();
      streamTargetRef.current = null;
      streamDisplayedLenRef.current = 0;
      streamCarryRef.current = 0;
      streamFastDrainRef.current = false;
      abortControllerRef.current = null;
      setStreamingState(null);
      setIsGenerating(false);

      // Verify target turn still exists (protect against cross-page overwrite if deleted mid-flight)
      const latest = stateRef.current;
      const resolvedTurnIndex = latest.turns.findIndex(
        (t) => t.id === targetTurnId,
      );
      if (resolvedTurnIndex === -1) {
        setGenStatus({ text: 'Sẵn sàng', isErr: false });
        return;
      }

      // Deterministically advance Story Clock on every completed turn (independent of system wall-clock)
      const activeCompForClock = getActiveCompanionFromState(latest);
      const curClock = normalizeStoryClock(latest.memory?.storyClock);
      let nextStoryClock: StoryClockState = curClock;
      let nextCultivationAfterTurn = latest.memory?.cultivation;
      let turnClockSnapshot: string | undefined;

      if (result.ok && finalText && curClock.enabled) {
        if (curClock.autoAdvance) {
          const clockBase =
            curClock.lastAdvanceReason === 'Chỉnh tay' &&
            curClock.lastTurnIndex !== resolvedTurnIndex
              ? curClock
              : preTurnClock;
          const stepped = advanceStoryClockFromTurn(clockBase, {
            userText: baseTurn.user || '',
            assistantText: finalText,
            turnIndex: resolvedTurnIndex,
            worldHint:
              activeCompForClock?.worldSetting || latest.world?.name || '',
          });
          nextStoryClock = stepped.nextClock;
          turnClockSnapshot = formatStoryClock(nextStoryClock).compactLabel;

          let breakthroughReadyNotice = false;
          let leveledTechNotice: string[] = [];
          if (
            stepped.deltaMinutes > 0 &&
            latest.memory?.cultivation?.enabled
          ) {
            const previewCalc = applyClockDeltaToCultivation(
              latest.memory.cultivation,
              stepped.deltaMinutes,
              {
                sceneText: `${baseTurn.user || ''}\n${finalText}`,
                reason: stepped.reason,
              },
            );
            nextCultivationAfterTurn = previewCalc.nextProfile;
            breakthroughReadyNotice = previewCalc.becameReadyToBreakthrough;
            leveledTechNotice = previewCalc.leveledTechniques;
          }

          updateMemoryWithCompanionSync((prev) => {
            const cultUpdated =
              stepped.deltaMinutes > 0 && prev.cultivation?.enabled
                ? applyClockDeltaToCultivation(
                    prev.cultivation,
                    stepped.deltaMinutes,
                    {
                      sceneText: `${baseTurn.user || ''}\n${finalText}`,
                      reason: stepped.reason,
                    },
                  ).nextProfile
                : prev.cultivation;
            return {
              ...prev,
              storyClock: nextStoryClock,
              cultivation: cultUpdated,
            };
          });

          if (breakthroughReadyNotice) {
            showBanner(
              'Đã tích đủ tu vi/nội lực — Sẵn sàng đột phá cảnh giới trong Hồ sơ Tu luyện!',
            );
          } else if (leveledTechNotice.length > 0) {
            showBanner(
              `Công pháp thăng cấp: ${leveledTechNotice.join(', ')}.`,
            );
          }
        } else {
          turnClockSnapshot = formatStoryClock(curClock).compactLabel;
        }
      }

      const savedRawAssistant =
        rawFinalText && rawFinalText.trim() !== finalText.trim()
          ? rawFinalText
          : undefined;

      if (finalText) {
        updateTurnsWithCompanionSync((turns) =>
          turns.map((t) =>
            t.id === targetTurnId
              ? {
                  ...t,
                  assistant: finalText,
                  ...(savedRawAssistant
                    ? { rawAssistant: savedRawAssistant }
                    : { rawAssistant: undefined }),
                  ...(result.ok ? { durationMs: elapsedMs } : {}),
                  ...(turnClockSnapshot
                    ? { storyClockSnapshot: turnClockSnapshot }
                    : {}),
                }
              : t,
          ),
        );
      }

      setGenStatus({
        text: result.statusLabel,
        isErr: !result.ok,
      });

      // Auto-generate story illustration when enabled & Seedream endpoint is available
      const updatedTurnsSnapshot = finalText
        ? latest.turns.map((t) =>
            t.id === targetTurnId
              ? {
                  ...t,
                  assistant: finalText,
                  ...(savedRawAssistant
                    ? { rawAssistant: savedRawAssistant }
                    : { rawAssistant: undefined }),
                  ...(result.ok ? { durationMs: elapsedMs } : {}),
                  ...(turnClockSnapshot
                    ? { storyClockSnapshot: turnClockSnapshot }
                    : {}),
                }
              : t,
          )
        : latest.turns;
      const postTurnStateSnapshot: ArkState = {
        ...latest,
        memory: {
          ...(latest.memory || createDefaultMemoryConfig()),
          storyClock: nextStoryClock,
          cultivation: nextCultivationAfterTurn,
        },
        turns: updatedTurnsSnapshot,
      };

      if (
        result.ok &&
        finalText &&
        latest.storyImage?.enabled &&
        latest.storyImage?.autoGenerate &&
        (latest.config.seedreamUrl || latest.config.proxyUrl || '').trim()
      ) {
        void handleGenerateStoryImage(resolvedTurnIndex, {
          ...baseTurn,
          assistant: finalText,
        });
      }

      // Auto AI Memory, State Tracker & Rolling Summary when enabled & Proxy API is configured
      if (
        result.ok &&
        finalText &&
        latest.memory?.enabled &&
        (latest.config.proxyUrl || '').trim()
      ) {
        const wantMem = Boolean(latest.memory.autoMemory);
        const wantState = Boolean(latest.memory.autoStateTracker);
        if (wantMem || wantState) {
          void handleRunMemorySync(
            resolvedTurnIndex,
            wantMem && wantState ? 'both' : wantMem ? 'memory' : 'state',
            true,
            postTurnStateSnapshot,
          );
        }

        if (latest.memory.autoRollingSummary) {
          const historyWin = Math.max(1, latest.context?.historyTurns || 12);
          const cutoff = Math.max(0, updatedTurnsSnapshot.length - historyWin);
          const alreadyUpTo =
            latest.memory.rollingSummary?.summarizedUpToTurn || 0;
          if (cutoff > alreadyUpTo) {
            void handleRunRollingSummary(false, true, postTurnStateSnapshot);
          }
        }
      }

      // Background auto-portrait generation for appearing characters/NPCs (non-blocking)
      if (
        result.ok &&
        finalText &&
        latest.portraitBank?.autoGenerateOnAppear
      ) {
        void handleRunBackgroundAutoPortraits(resolvedTurnIndex, {
          manual: false,
          stateOverride: postTurnStateSnapshot,
        });
      }
    },
    [
      appendProxyLog,
      cancelScheduledStreamFrame,
      handleGenerateStoryImage,
      handleRunBackgroundAutoPortraits,
      handleRunMemorySync,
      handleRunRollingSummary,
      isGenerating,
      updateMemoryWithCompanionSync,
      updateTurnsWithCompanionSync,
    ],
  );

  const handleStopGeneration = useCallback(
    (skipSavePartial = false) => {
      streamAbortedRef.current = true;
      const target = streamTargetRef.current;
      const visibleLen = streamDisplayedLenRef.current;
      cancelScheduledStreamFrame();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (!skipSavePartial && target && target.text) {
        const savedRaw =
          visibleLen > 0 ? target.text.slice(0, visibleLen) : target.text;
        if (savedRaw) {
          const cleanSaved = sanitizeCompletedStoryResponse(savedRaw);
          updateTurnsWithCompanionSync((turns) =>
            turns.map((t) =>
              t.id === target.turnId
                ? {
                    ...t,
                    assistant: cleanSaved,
                    ...(savedRaw !== cleanSaved ? { rawAssistant: savedRaw } : {}),
                  }
                : t,
            ),
          );
        }
      }
      streamTargetRef.current = null;
      streamDisplayedLenRef.current = 0;
      streamCarryRef.current = 0;
      streamFastDrainRef.current = false;
      setStreamingState(null);
      setIsGenerating(false);
      setGenStatus({ text: 'Đã dừng', isErr: false });
    },
    [cancelScheduledStreamFrame, updateTurnsWithCompanionSync],
  );

  const handleSendNewTurn = useCallback(
    (userText: string) => {
      if (isGenerating) return;
      const imgUrl = pendingImage ? pendingImage.dataUrl : '';
      const caption = imageCaption.trim();

      if (!userText && !imgUrl) {
        showBanner('Hãy nhập nội dung lượt gọi hoặc chọn ảnh trước khi gửi.', 'err');
        return;
      }

      const nowTs = Date.now();
      const newTurn: Turn = {
        id: `turn_${nowTs}_${Math.random().toString(36).slice(2, 6)}`,
        user: userText,
        assistant: '',
        imageData: imgUrl,
        imageCaption: caption,
        createdAt: nowTs,
      };

      const prev = stateRef.current;
      const nextTurns = ensureUniqueTurnIds([...prev.turns, newTurn]);
      const nextIndex = nextTurns.length - 1;
      const compKey = activeStoryCompanionIdRef.current;
      const nextState: ArkState = {
        ...prev,
        turns: nextTurns,
        currentPage: nextIndex,
        companionStories: compKey
          ? { ...prev.companionStories, [compKey]: nextTurns }
          : prev.companionStories,
      };

      setState(nextState);
      setPendingImage(null);
      setImageCaption('');
      void runModelTurn(nextIndex, nextState);
    },
    [imageCaption, isGenerating, pendingImage, runModelTurn, showBanner],
  );

  const handleRegenerateCurrent = useCallback(() => {
    if (isGenerating || !stateRef.current.turns.length) return;
    const safeIdx = clampPageIndex(
      stateRef.current.currentPage,
      stateRef.current.turns.length,
    );
    void runModelTurn(safeIdx);
  }, [isGenerating, runModelTurn]);

  const handleDeleteTurn = useCallback(
    (turnIndex: number) => {
      const cur = stateRef.current;
      if (turnIndex < 0 || turnIndex >= cur.turns.length) return;
      const targetTurn = cur.turns[turnIndex];
      const targetTurnId = targetTurn?.id || '';
      const pageNum = turnIndex + 1;

      setConfirmDialog({
        open: true,
        title: `Xóa Trang ${pageNum}?`,
        message: `Xóa hoàn toàn Trang ${pageNum} (cả lượt gọi, câu trả lời và ảnh minh họa của trang này), đồng thời đồng bộ lại số trang, ký ức và lịch sử truyện để tránh lệch trang.`,
        confirmLabel: `Xóa Trang ${pageNum}`,
        cancelLabel: 'Hủy',
        confirmTone: 'danger',
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));

          // Stop any in-flight generation / image / portrait scan so no stale response writes to a shifted page
          if (streamTargetRef.current || abortControllerRef.current) {
            const deletingStreamingTurn =
              streamTargetRef.current?.turnId === targetTurnId ||
              streamTargetRef.current?.turnIndex === turnIndex;
            handleStopGeneration(deletingStreamingTurn);
          }
          if (imageAbortControllerRef.current) {
            handleCancelStoryImage();
          }
          if (bgPortraitAbortRef.current) {
            handleCancelBgPortraits();
          }

          const latest = stateRef.current;
          const exactIdx = targetTurnId
            ? latest.turns.findIndex((t) => t.id === targetTurnId)
            : turnIndex;
          if (exactIdx === -1) return;

          reindexPreClockMapOnDelete(turnPreClockRef.current, exactIdx);
          const { nextState, deletedTurn } = deleteTurnFromState(
            latest,
            exactIdx,
            activeStoryCompanionIdRef.current,
          );
          if (!deletedTurn) return;

          stateRef.current = nextState;
          setState(nextState);
          flushPersistNow(nextState);
          showBanner(
            nextState.turns.length > 0
              ? `Đã xóa Trang ${exactIdx + 1} và đồng bộ lại số trang (${nextState.turns.length} trang còn lại).`
              : `Đã xóa Trang ${exactIdx + 1}. Hiện chưa còn trang truyện nào.`,
          );
        },
        onCancel: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
        },
      });
    },
    [
      flushPersistNow,
      handleCancelBgPortraits,
      handleCancelStoryImage,
      handleStopGeneration,
      showBanner,
    ],
  );

  // Lobby & World Setup actions
  const handleOpenWorldSetup = useCallback(() => {
    goView('setup');
  }, [goView]);

  const handleStartBlankSession = useCallback(() => {
    handleStopGeneration();
    activeStoryCompanionIdRef.current = null;
    turnPreClockRef.current.clear();
    setState((prev) => {
      const activeComp = getActiveCompanionFromState(prev);
      const freshPortraits = syncPortraitBankWithCompanion(
        createDefaultPortraitBank({
          autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
          maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
          includeMcAuto: prev.portraitBank?.includeMcAuto,
        }),
        activeComp,
        prev.player.name,
      );
      return {
        ...prev,
        checkpoint: {
          savedAt: new Date().toISOString(),
          turns: JSON.parse(JSON.stringify(prev.turns)),
          player: { ...prev.player },
          world: { ...prev.world },
          memory: JSON.parse(
            JSON.stringify(prev.memory || createDefaultMemoryConfig()),
          ),
          portraitBank: JSON.parse(
            JSON.stringify(prev.portraitBank || createDefaultPortraitBank()),
          ),
          context: { ...prev.context },
          activeCompanionId: prev.activeCompanionId,
          tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
        },
        turns: [],
        memory: createDefaultMemoryConfig({
          enabled: prev.memory?.enabled,
          autoMemory: prev.memory?.autoMemory,
          autoStateTracker: prev.memory?.autoStateTracker,
          autoRollingSummary: prev.memory?.autoRollingSummary,
          storyClock: createDefaultStoryClock({
            enabled: prev.memory?.storyClock?.enabled,
            autoAdvance: prev.memory?.storyClock?.autoAdvance,
          }),
        }),
        portraitBank: freshPortraits,
        activeStoryCompanionId: null,
        currentPage: 0,
        activeView: 'chat',
      };
    });
    showBanner(
      'Đã khởi tạo trang truyện trống (có thể Hoàn tác trong mục Dữ liệu nếu cần).',
    );
  }, [handleStopGeneration, showBanner]);

  const handleStartConfiguredWorld = useCallback(
    (payload: WorldSetupPayload) => {
      handleStopGeneration();
      turnPreClockRef.current.clear();

      const prev = stateRef.current;
      const nowTs = Date.now();
      const newProfileId = `world_${nowTs}`;

      const startClock: StoryClockState = normalizeStoryClock({
        enabled: true,
        autoAdvance: payload.startClock.autoAdvance,
        initialized: true,
        year: payload.startClock.year,
        month: payload.startClock.month,
        day: payload.startClock.day,
        hour: payload.startClock.hour,
        minute: payload.startClock.minute,
        eraLabel: payload.startClock.eraLabel || undefined,
        lastAdvanceReason: 'Mốc khởi đầu thế giới',
        updatedAt: nowTs,
      });
      const formattedStartClock = formatStoryClock(startClock);

      const nextPlayer: PlayerInfo = {
        name: payload.mc.name,
        pronoun: payload.mc.pronoun,
        role: payload.mc.role || undefined,
        description: payload.mc.description || undefined,
        absentAtStart: payload.mc.absentAtStart,
      };

      const nextWorld: WorldInfo = {
        name: payload.worldName,
        genre: payload.genre,
        genreLabel: payload.genreLabel,
        setting: payload.setting || undefined,
        rules: payload.rules || undefined,
        atmosphere: payload.atmosphere || undefined,
        dramaLevel: payload.dramaLevel,
        eraLabel: payload.startClock.eraLabel || undefined,
        openingScenario: payload.openingScenario || undefined,
      };

      // Build synchronized profile so NPCs, vivid profiles, blue name badges & Portrait Bank work seamlessly
      const syncedCompanion: CompanionProfile = {
        id: newProfileId,
        name: payload.worldName,
        role: payload.genreLabel,
        sourceQuery: payload.genreLabel,
        sourceContent: '',
        mc: {
          sourceMode: 'custom',
          name: payload.mc.absentAtStart ? '' : payload.mc.name,
          pronoun: payload.mc.absentAtStart ? '' : payload.mc.pronoun,
          roleType: 'custom',
          canonMcName: '',
          originRole: payload.mc.role,
          canonMcRelation: '',
          gender: '',
          age: '',
          personality: payload.mc.description,
          appearance: payload.mc.description,
        },
        worldSetting: payload.setting,
        worldRules: payload.rules,
        npcs: payload.npcs.map((n, idx) => ({
          id: n.id || `npc_${nowTs}_${idx}`,
          name: n.name,
          role: n.role || 'NPC',
          desc: [n.personality, n.appearance].filter(Boolean).join(' · '),
          personality: n.personality || undefined,
          appearance: n.appearance || undefined,
          profileManual: Boolean(n.personality || n.appearance),
        })),
        canonCandidates: [],
        note: [
          payload.atmosphere ? `Không khí: ${payload.atmosphere}` : '',
          payload.mc.absentAtStart
            ? 'Nhân vật chính chưa có mặt từ đầu — tập trung vào dàn NPC và bối cảnh.'
            : '',
        ]
          .filter(Boolean)
          .join(' | '),
      };

      // Seed Lorebook entries
      const seededEntries: MemoryEntry[] = [
        {
          id: `mem_world_start_${nowTs}`,
          title: `Khởi điểm: ${payload.worldName}`,
          content: [
            `Mốc thời gian bắt đầu: ${formattedStartClock.fullLabel}.`,
            payload.setting || `Thể loại ${payload.genreLabel}.`,
          ]
            .filter(Boolean)
            .join(' '),
          category: 'timeline',
          pinned: true,
          updatedAt: nowTs,
        },
      ];
      if (payload.rules || payload.atmosphere) {
        seededEntries.push({
          id: `mem_world_rules_${nowTs}`,
          title: 'Luật lệ & Không khí thế giới',
          content: [
            payload.atmosphere ? `Không khí: ${payload.atmosphere}.` : '',
            payload.rules,
          ]
            .filter(Boolean)
            .join(' '),
          category: 'detail',
          pinned: true,
          updatedAt: nowTs + 1,
        });
      }

      // Seed initial Character States
      const seededStates: CharacterStateSnapshot[] = [];
      if (payload.syncPortraitsAndStates) {
        if (!payload.mc.absentAtStart && payload.mc.name) {
          seededStates.push({
            id: `st_mc_${nowTs}`,
            name: payload.mc.name,
            isMc: true,
            location: payload.mc.role || payload.worldName,
            mood: 'Bắt đầu hành trình',
            status: payload.mc.description || 'Vừa bước vào bối cảnh mở đầu',
            updatedAt: nowTs,
          });
        }
        payload.npcs.forEach((n, idx) => {
          seededStates.push({
            id: `st_npc_${nowTs}_${idx}`,
            name: n.name,
            isMc: false,
            location: n.initialLocation || payload.worldName,
            mood: n.initialMood || 'Ổn định',
            status: n.role || 'Có mặt trong bối cảnh khởi đầu',
            updatedAt: nowTs + idx + 1,
          });
        });
      }

      const detectedCultKind = detectCultivationSystemKind({
        genre: payload.genre,
        genreLabel: payload.genreLabel,
        worldName: payload.worldName,
        setting: payload.setting,
        rules: payload.rules,
        mcRole: payload.mc.role,
        mcDesc: payload.mc.description,
        openingScenario: payload.openingScenario,
        enableMartialSystem: payload.enableMartialSystem,
      });
      const initialCultivation = detectedCultKind
        ? createStarterCultivationProfile(detectedCultKind, {
            mcRole: payload.mc.role,
            mcDesc: payload.mc.description,
            worldName: payload.worldName,
          })
        : undefined;

      const nextMemory: MemoryManagerConfig = {
        ...createDefaultMemoryConfig({
          enabled: true,
          autoMemory: prev.memory?.autoMemory ?? false,
          autoStateTracker: prev.memory?.autoStateTracker ?? false,
          autoRollingSummary: prev.memory?.autoRollingSummary ?? false,
          storyClock: startClock,
          cultivation: initialCultivation,
        }),
        entries: seededEntries,
        characterStates: seededStates,
      };

      const freshPortraitBase = createDefaultPortraitBank({
        autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
        maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
        includeMcAuto: prev.portraitBank?.includeMcAuto,
      });
      const nextPortraitBank: PortraitBankConfig = payload.syncPortraitsAndStates
        ? syncPortraitBankWithCompanion(
            freshPortraitBase,
            syncedCompanion,
            payload.mc.absentAtStart ? '' : payload.mc.name,
          )
        : freshPortraitBase;

      const entitiesSummary = [
        `Thế giới: ${payload.worldName} (${payload.genreLabel}).`,
        payload.atmosphere ? `Không khí: ${payload.atmosphere}.` : '',
        payload.setting ? `Bối cảnh: ${payload.setting}` : '',
        payload.rules ? `Quy tắc: ${payload.rules}` : '',
        payload.mc.absentAtStart
          ? 'Nhân vật chính không có mặt từ đầu; tập trung vào dàn NPC và bối cảnh.'
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      const nextContext: ContextConfig = {
        ...prev.context,
        entitiesNote: entitiesSummary || prev.context.entitiesNote,
      };

      const checkpoint = {
        savedAt: new Date().toISOString(),
        turns: JSON.parse(JSON.stringify(prev.turns)),
        player: { ...prev.player },
        world: { ...prev.world },
        memory: JSON.parse(
          JSON.stringify(prev.memory || createDefaultMemoryConfig()),
        ),
        portraitBank: JSON.parse(
          JSON.stringify(prev.portraitBank || createDefaultPortraitBank()),
        ),
        context: { ...prev.context },
        activeCompanionId: prev.activeCompanionId,
        tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
      };

      const wantAiOpening = payload.launchMode === 'ai_opening';
      let initialTurns: Turn[] = [];
      if (wantAiOpening) {
        const openingPrompt = payload.openingScenario
          ? payload.openingScenario
          : [
              `Bắt đầu cảnh mở màn cho thế giới "${payload.worldName}" (${payload.genreLabel}) tại mốc thời gian ${formattedStartClock.fullLabel}.`,
              payload.mc.absentAtStart
                ? 'Hãy mở màn bằng góc nhìn bối cảnh và dàn NPC khởi đầu (chưa có mặt nhân vật chính).'
                : payload.mc.name
                  ? `Hãy dẫn nhập tự nhiên vào bối cảnh mở đầu cùng nhân vật chính ${payload.mc.name}.`
                  : 'Hãy dẫn nhập giàu không khí vào khung cảnh mở đầu.',
            ].join(' ');
        initialTurns = [
          {
            id: `turn_${nowTs}`,
            user: openingPrompt,
            assistant: '',
            createdAt: nowTs,
            storyClockSnapshot: formattedStartClock.compactLabel,
          },
        ];
      }

      activeStoryCompanionIdRef.current = newProfileId;
      const nextState: ArkState = {
        ...prev,
        checkpoint,
        player: nextPlayer,
        world: nextWorld,
        context: nextContext,
        companions: [syncedCompanion, ...prev.companions],
        activeCompanionId: newProfileId,
        activeStoryCompanionId: newProfileId,
        companionStories: {
          ...prev.companionStories,
          [newProfileId]: initialTurns,
        },
        companionMemories: {
          ...(prev.companionMemories || {}),
          [newProfileId]: nextMemory,
        },
        companionPortraits: {
          ...(prev.companionPortraits || {}),
          [newProfileId]: nextPortraitBank,
        },
        memory: nextMemory,
        portraitBank: nextPortraitBank,
        turns: initialTurns,
        currentPage: 0,
        activeView: 'chat',
      };

      setState(nextState);
      setPendingImage(null);
      setImageCaption('');

      if (wantAiOpening) {
        showBanner(
          `Đã khởi tạo "${payload.worldName}" (${formattedStartClock.compactLabel}) — đang gọi AI viết cảnh mở màn...`,
        );
        void runModelTurn(0, nextState);
      } else {
        showBanner(
          `Đã khởi tạo "${payload.worldName}" · Mốc ${formattedStartClock.compactLabel}${
            payload.npcs.length ? ` · ${payload.npcs.length} NPC` : ''
          } (đã lưu Checkpoint phiên cũ).`,
        );
      }
    },
    [handleStopGeneration, runModelTurn, showBanner],
  );

  const handlePickLobbyBg = useCallback(() => {
    if (stateRef.current.lobbyBgDataUrl) {
      setConfirmDialog({
        open: true,
        title: 'Ảnh nền sảnh chính',
        message:
          'Bạn muốn chọn một ảnh nền mới hay xóa ảnh nền hiện tại để quay về mặc định?',
        confirmLabel: 'Chọn ảnh mới',
        cancelLabel: 'Xóa ảnh nền',
        confirmTone: 'primary',
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          if (lobbyBgInputRef.current) {
            lobbyBgInputRef.current.value = '';
            lobbyBgInputRef.current.click();
          }
        },
        onCancel: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          setState((prev) => ({ ...prev, lobbyBgDataUrl: '' }));
          showBanner('Đã xóa ảnh nền sảnh về mặc định.');
        },
      });
      return;
    }
    if (lobbyBgInputRef.current) {
      lobbyBgInputRef.current.value = '';
      lobbyBgInputRef.current.click();
    }
  }, [showBanner]);

  const handleLobbyBgFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setState((prev) => ({
        ...prev,
        lobbyBgDataUrl: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  };

  // Chat image picker
  const handleChatImageFileChange = (
    ev: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage({
        dataUrl: String(reader.result || ''),
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  // Save JSON import / slots / backups
  const applyImportedJsonText = useCallback(
    (rawText: string) => {
      if (!rawText) {
        showBanner('Chưa dán nội dung JSON.', 'err');
        return;
      }
      let parsedRes;
      try {
        parsedRes = parseSaveJsonSafe(rawText);
      } catch (e) {
        showBanner(
          `File JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}`,
          'err',
        );
        return;
      }

      const data = parsedRes.data;
      const savedState =
        data.savedState && typeof data.savedState === 'object'
          ? (data.savedState as Record<string, unknown>)
          : null;
      const root: Record<string, unknown> = savedState
        ? { ...data, ...savedState }
        : data;

      const extracted = ensureUniqueTurnIds(extractTurnsFromObject(data));
      activeStoryCompanionIdRef.current = null;
      turnPreClockRef.current.clear();

      setState((prev) => {
        const nextPlayer =
          root.player && typeof root.player === 'object'
            ? { ...prev.player, ...(root.player as Partial<PlayerInfo>) }
            : prev.player;
        const nextWorld =
          root.world && typeof root.world === 'object'
            ? { ...prev.world, ...(root.world as Partial<WorldInfo>) }
            : prev.world;
        const nextConfig =
          root.config && typeof root.config === 'object'
            ? { ...prev.config, ...(root.config as Partial<AppConfig>) }
            : prev.config;
        const nextPreset =
          root.tawaPreset && typeof root.tawaPreset === 'object'
            ? normalizeTawaPreset(root.tawaPreset, prev.tawaPreset)
            : prev.tawaPreset;

        const rawImportedMemory = root.memory
          ? normalizeMemoryConfig(root.memory)
          : createDefaultMemoryConfig({
              enabled: prev.memory?.enabled,
              autoMemory: prev.memory?.autoMemory,
              autoStateTracker: prev.memory?.autoStateTracker,
              autoRollingSummary: prev.memory?.autoRollingSummary,
              storyClock: createDefaultStoryClock({
                enabled: prev.memory?.storyClock?.enabled,
                autoAdvance: prev.memory?.storyClock?.autoAdvance,
              }),
            });
        const importedHasClock = Boolean(
          root.memory &&
            typeof root.memory === 'object' &&
            (root.memory as Record<string, unknown>).storyClock &&
            rawImportedMemory.storyClock?.initialized,
        );
        const nextMemory: MemoryManagerConfig =
          !importedHasClock && extracted.length > 0
            ? {
                ...rawImportedMemory,
                storyClock: inferStoryClockFromLegacyTurns(
                  extracted,
                  nextWorld.name,
                  {
                    enabled: rawImportedMemory.storyClock?.enabled,
                    autoAdvance: rawImportedMemory.storyClock?.autoAdvance,
                  },
                ),
              }
            : rawImportedMemory;

        const activeComp = getActiveCompanionFromState(prev);
        const nextPortraitBank = root.portraitBank
          ? normalizePortraitBank(root.portraitBank)
          : syncPortraitBankWithCompanion(
              createDefaultPortraitBank({
                autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
                maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                includeMcAuto: prev.portraitBank?.includeMcAuto,
              }),
              activeComp,
              nextPlayer.name,
            );

        const newSlot = {
          id: `slot_${Date.now()}`,
          name: `${nextPlayer.name ? `${nextPlayer.name} — ` : ''}${new Date().toLocaleTimeString(
            'vi-VN',
            { hour12: false },
          )}`,
          savedAt: new Date().toISOString(),
          turns: JSON.parse(JSON.stringify(extracted)),
          player: { ...nextPlayer },
          world: { ...nextWorld },
          memory: JSON.parse(JSON.stringify(nextMemory)),
          portraitBank: JSON.parse(JSON.stringify(nextPortraitBank)),
          tawaPreset: JSON.parse(JSON.stringify(nextPreset)),
        };

        return {
          ...prev,
          checkpoint: {
            savedAt: new Date().toISOString(),
            turns: JSON.parse(JSON.stringify(prev.turns)),
            player: { ...prev.player },
            world: { ...prev.world },
            memory: JSON.parse(
              JSON.stringify(prev.memory || createDefaultMemoryConfig()),
            ),
            portraitBank: JSON.parse(
              JSON.stringify(prev.portraitBank || createDefaultPortraitBank()),
            ),
            context: { ...prev.context },
            activeCompanionId: prev.activeCompanionId,
            tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
          },
          player: nextPlayer,
          world: nextWorld,
          config: nextConfig,
          tawaPreset: nextPreset,
          memory: nextMemory,
          portraitBank: nextPortraitBank,
          turns: extracted,
          activeStoryCompanionId: null,
          currentPage: extracted.length ? extracted.length - 1 : 0,
          slots: [newSlot, ...prev.slots],
          activeView: 'chat',
        };
      });

      if (extracted.length > 0) {
        showBanner(
          `Đã nhập thành công ${extracted.length} lượt truyện${
            parsedRes.repaired ? ' (đã tự khép phần đuôi JSON bị cắt dở).' : '.'
          }`,
        );
      } else {
        const keys = Object.keys(data || {}).join(', ');
        showBanner(
          `Đã nạp hồ sơ nhưng tìm thấy 0 lượt truyện (các khóa cấp cao: ${keys}).`,
          'err',
        );
      }
    },
    [showBanner],
  );

  const handleSaveFileChange = async (
    ev: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      applyImportedJsonText(txt);
    } catch {
      const fr = new FileReader();
      fr.onload = () => applyImportedJsonText(String(fr.result || ''));
      fr.readAsText(file, 'utf-8');
    } finally {
      ev.target.value = '';
    }
  };

  const triggerImportSave = useCallback(() => {
    if (saveFileInputRef.current) {
      saveFileInputRef.current.value = '';
      saveFileInputRef.current.click();
    }
  }, []);

  const handleSaveCurrentToSlot = useCallback(() => {
    const cur = stateRef.current;
    const slot = {
      id: `slot_${Date.now()}`,
      name: `${cur.player.name || 'Slot'} (${cur.turns.length} lượt)`,
      savedAt: new Date().toISOString(),
      turns: JSON.parse(JSON.stringify(cur.turns)),
      player: { ...cur.player },
      world: { ...cur.world },
      memory: JSON.parse(
        JSON.stringify(cur.memory || createDefaultMemoryConfig()),
      ),
      portraitBank: JSON.parse(
        JSON.stringify(cur.portraitBank || createDefaultPortraitBank()),
      ),
      tawaPreset: JSON.parse(JSON.stringify(cur.tawaPreset)),
    };
    const nextState: ArkState = {
      ...cur,
      slots: [slot, ...cur.slots],
    };
    stateRef.current = nextState;
    setState(nextState);
    flushPersistNow(nextState);
    showBanner(`Đã lưu vào slot: ${slot.name}`);
  }, [flushPersistNow, showBanner]);

  const handleDownloadSave = useCallback(
    (slotIdx?: number) => {
      const cur = stateRef.current;
      const target =
        typeof slotIdx === 'number' && cur.slots[slotIdx]
          ? cur.slots[slotIdx]
          : null;
      const payload = {
        player: target ? target.player : cur.player,
        world: target ? target.world : cur.world,
        config: cur.config,
        tawaPreset: target?.tawaPreset || cur.tawaPreset,
        context: cur.context,
        memory: target?.memory || cur.memory,
        portraitBank: target?.portraitBank || cur.portraitBank,
        turns: target ? target.turns : cur.turns,
        savedState: { turns: target ? target.turns : cur.turns },
      };
      const safeName = (payload.player?.name || 'Ark_Lite').replace(
        /[^a-zA-Z0-9_\-À-ɏḀ-ỿ]+/g,
        '_',
      );
      triggerDownloadJson(`ARK_save_${safeName}.json`, payload);
      showBanner('Đã tải file Save (.json).');
    },
    [showBanner],
  );

  const handleDownloadFullBackup = useCallback(() => {
    const cur = stateRef.current;
    triggerDownloadJson(`ARK_full_backup_${Date.now()}.json`, {
      player: cur.player,
      world: cur.world,
      config: cur.config,
      tawaPreset: cur.tawaPreset,
      context: cur.context,
      memory: cur.memory,
      companionMemories: cur.companionMemories,
      portraitBank: cur.portraitBank,
      companionPortraits: cur.companionPortraits,
      turns: cur.turns,
      slots: cur.slots,
    });
    showBanner('Đã xuất Full Backup (.json).');
  }, [showBanner]);

  const handleUndoCheckpoint = useCallback(() => {
    const cp = stateRef.current.checkpoint;
    if (!cp) {
      showBanner('Không có checkpoint để hoàn tác.', 'err');
      return;
    }
    activeStoryCompanionIdRef.current = null;
    turnPreClockRef.current.clear();
    const restoredTurns = ensureUniqueTurnIds(
      JSON.parse(JSON.stringify(cp.turns || [])) as Turn[],
    );
    setState((prev) => ({
      ...prev,
      turns: restoredTurns,
      player: cp.player ? { ...cp.player } : prev.player,
      world: cp.world ? { ...cp.world } : prev.world,
      context: cp.context ? { ...cp.context } : prev.context,
      activeCompanionId:
        cp.activeCompanionId &&
        prev.companions.some((c) => c.id === cp.activeCompanionId)
          ? cp.activeCompanionId
          : prev.activeCompanionId,
      activeStoryCompanionId: null,
      memory: cp.memory ? normalizeMemoryConfig(cp.memory) : prev.memory,
      portraitBank: cp.portraitBank
        ? normalizePortraitBank(cp.portraitBank)
        : prev.portraitBank,
      tawaPreset: cp.tawaPreset
        ? normalizeTawaPreset(cp.tawaPreset, prev.tawaPreset)
        : prev.tawaPreset,
      currentPage: Math.max(0, restoredTurns.length - 1),
    }));
    showBanner('Đã hoàn tác về checkpoint trước đó.');
  }, [showBanner]);

  const handleRequestResetClean = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: 'Reset sạch toàn bộ dữ liệu?',
      message:
        'Thao tác này sẽ xóa toàn bộ dữ liệu save, slot, checkpoint, truyện đồng nhân và cấu hình lưu trên trình duyệt để đưa về trạng thái trắng mặc định.',
      confirmLabel: 'Xóa sạch dữ liệu',
      cancelLabel: 'Hủy',
      confirmTone: 'danger',
      onConfirm: () => {
        setConfirmDialog((d) => ({ ...d, open: false }));
        handleStopGeneration(true);
        handleCancelStoryImage();
        handleCancelBgPortraits();
        if (persistTimerRef.current !== null) {
          window.clearTimeout(persistTimerRef.current);
          persistTimerRef.current = null;
        }
        persistDirtyRef.current = false;
        turnPreClockRef.current.clear();
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        activeStoryCompanionIdRef.current = null;
        setPendingImage(null);
        setImageCaption('');
        setProxyLogs(['Sẵn sàng kiểm tra proxy...']);
        const fresh = createInitialState();
        stateRef.current = fresh;
        setState(fresh);
        flushPersistNow(fresh);
        showBanner('Đã reset sạch toàn bộ dữ liệu về mặc định.');
      },
      onCancel: () => {
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  }, [
    flushPersistNow,
    handleCancelBgPortraits,
    handleCancelStoryImage,
    handleStopGeneration,
    showBanner,
  ]);

  // Companion handlers
  const handleUpdateActiveCompanion = useCallback(
    (
      updater: (cur: CompanionProfile) => CompanionProfile,
      syncPlayerWorld = false,
    ) => {
      setState((prev) => {
        const current = getActiveCompanionFromState(prev);
        const updated = updater(current);
        const exists = prev.companions.some((c) => c.id === current.id);
        const nextCompanions = exists
          ? prev.companions.map((c) => (c.id === current.id ? updated : c))
          : [updated, ...prev.companions];

        const prevNpcById = new Map(
          (current.npcs || []).map((n) => [n.id, n]),
        );
        const changedNpcIds = new Set<string>();
        for (const n of updated.npcs || []) {
          if (!n.id) continue;
          const prevNpc = prevNpcById.get(n.id);
          if (
            !prevNpc ||
            (prevNpc.name || '') !== (n.name || '') ||
            (prevNpc.role || '') !== (n.role || '') ||
            (prevNpc.age || '') !== (n.age || '') ||
            (prevNpc.birthday || '') !== (n.birthday || '') ||
            (prevNpc.fashionStyle || '') !== (n.fashionStyle || '') ||
            (prevNpc.appearance || '') !== (n.appearance || '') ||
            (prevNpc.personality || '') !== (n.personality || '') ||
            (prevNpc.relationships || '') !== (n.relationships || '') ||
            (prevNpc.signature || '') !== (n.signature || '')
          ) {
            changedNpcIds.add(n.id);
          }
        }

        const syncedPortraits = syncPortraitBankWithCompanion(
          prev.portraitBank || createDefaultPortraitBank(),
          updated,
          updated.mc?.name || prev.player.name,
          prev.memory?.storyClock,
          changedNpcIds.size > 0 ? changedNpcIds : undefined,
        );

        return {
          ...prev,
          companions: nextCompanions,
          activeCompanionId: updated.id,
          portraitBank: syncedPortraits,
          companionPortraits: {
            ...(prev.companionPortraits || {}),
            [updated.id]: syncedPortraits,
          },
          ...(syncPlayerWorld
            ? {
                player: {
                  name: updated.mc?.name || prev.player.name,
                  pronoun: updated.mc?.pronoun || prev.player.pronoun,
                },
                world: {
                  name: updated.name || prev.world.name,
                },
              }
            : {}),
        };
      });
    },
    [],
  );

  const handleCreateNewFanficProfile = useCallback(() => {
    const idx = (stateRef.current.companions?.length || 0) + 1;
    const next: CompanionProfile = {
      id: `comp_${Date.now()}`,
      name: `Thế giới đồng nhân ${idx}`,
      role: 'Đồng nhân / AU',
      sourceQuery: '',
      sourceContent: '',
      mc: {
        sourceMode: 'custom',
        name: stateRef.current.player.name || '',
        pronoun: stateRef.current.player.pronoun || '',
        roleType: 'transmigrator',
        canonMcName: '',
        originRole: '',
        canonMcRelation: '',
        gender: 'Nam',
        age: '20',
        personality: '',
        appearance: '',
      },
      worldSetting: '',
      worldRules: '',
      npcs: [],
      canonCandidates: [],
      note: '',
    };
    setState((prev) => {
      const prevCompKey = prev.activeCompanionId || '';
      const updatedMap = prevCompKey
        ? {
            ...(prev.companionPortraits || {}),
            [prevCompKey]: prev.portraitBank || createDefaultPortraitBank(),
          }
        : prev.companionPortraits || {};
      const nextBank = syncPortraitBankWithCompanion(
        createDefaultPortraitBank({
          autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
          maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
          includeMcAuto: prev.portraitBank?.includeMcAuto,
        }),
        next,
        next.mc?.name || prev.player.name,
      );
      return {
        ...prev,
        companions: [next, ...prev.companions],
        activeCompanionId: next.id,
        portraitBank: nextBank,
        companionPortraits: {
          ...updatedMap,
          [next.id]: nextBank,
        },
      };
    });
    showBanner(`Đã tạo hồ sơ Đồng nhân mới #${idx}`);
  }, [showBanner]);

  const handleDeleteFanficProfile = useCallback(
    (id: string) => {
      if (stateRef.current.companions.length <= 1) {
        showBanner('Cần giữ ít nhất 1 hồ sơ đồng nhân.', 'err');
        return;
      }
      setState((prev) => {
        const remaining = prev.companions.filter((c) => c.id !== id);
        const nextActiveId =
          prev.activeCompanionId === id
            ? remaining[0].id
            : prev.activeCompanionId;
        const nextCompPortraits = { ...(prev.companionPortraits || {}) };
        delete nextCompPortraits[id];
        const nextComp =
          remaining.find((c) => c.id === nextActiveId) || remaining[0];
        const nextBank =
          prev.activeCompanionId === id
            ? syncPortraitBankWithCompanion(
                nextCompPortraits[nextActiveId]
                  ? normalizePortraitBank(nextCompPortraits[nextActiveId])
                  : createDefaultPortraitBank({
                      autoGenerateOnAppear:
                        prev.portraitBank?.autoGenerateOnAppear,
                      maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                      includeMcAuto: prev.portraitBank?.includeMcAuto,
                    }),
                nextComp,
                nextComp?.mc?.name || prev.player.name,
              )
            : prev.portraitBank;
        return {
          ...prev,
          companions: remaining,
          activeCompanionId: nextActiveId,
          portraitBank: nextBank,
          companionPortraits: nextCompPortraits,
        };
      });
    },
    [showBanner],
  );

  const handleImportFanficProfile = useCallback(
    (profile: CompanionProfile) => {
      setState((prev) => {
        const prevCompKey = prev.activeCompanionId || '';
        const updatedMap = prevCompKey
          ? {
              ...(prev.companionPortraits || {}),
              [prevCompKey]: prev.portraitBank || createDefaultPortraitBank(),
            }
          : prev.companionPortraits || {};
        const nextBank = syncPortraitBankWithCompanion(
          createDefaultPortraitBank({
            autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
            maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
            includeMcAuto: prev.portraitBank?.includeMcAuto,
          }),
          profile,
          profile.mc?.name || prev.player.name,
        );
        return {
          ...prev,
          companions: [profile, ...prev.companions],
          activeCompanionId: profile.id,
          portraitBank: nextBank,
          companionPortraits: {
            ...updatedMap,
            [profile.id]: nextBank,
          },
        };
      });
      showBanner(`Đã nạp hồ sơ Đồng nhân: ${profile.name}`);
    },
    [showBanner],
  );

  const handleEnterCompanionWorld = useCallback(() => {
    const curState = stateRef.current;
    const cur = getActiveCompanionFromState(curState);
    const compKey = cur.id || 'default';
    activeStoryCompanionIdRef.current = compKey;
    turnPreClockRef.current.clear();

    setState((prev) => {
      const checkpoint =
        prev.turns.length > 0
          ? {
              savedAt: new Date().toISOString(),
              turns: JSON.parse(JSON.stringify(prev.turns)),
              player: { ...prev.player },
              world: { ...prev.world },
              memory: JSON.parse(
                JSON.stringify(prev.memory || createDefaultMemoryConfig()),
              ),
              portraitBank: JSON.parse(
                JSON.stringify(
                  prev.portraitBank || createDefaultPortraitBank(),
                ),
              ),
              context: { ...prev.context },
              activeCompanionId: prev.activeCompanionId,
              tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
            }
          : prev.checkpoint;

      const existingStories = prev.companionStories || {};
      const existingMemories = prev.companionMemories || {};
      const existingPortraits = prev.companionPortraits || {};
      let storyTurns = existingStories[compKey];

      if (!Array.isArray(storyTurns)) {
        const mcName =
          cur.mc?.name || prev.player.name || 'Nhân vật chính';
        const mcPronoun =
          cur.mc?.pronoun || prev.player.pronoun || 'ta';
        const worldLabel = cur.name || 'Thế giới đồng nhân';
        const settingSummary = cur.worldSetting
          ? cur.worldSetting.trim().slice(0, 220)
          : 'Khung cảnh mở đầu của bản đồng nhân đang bắt đầu.';

        storyTurns = [
          {
            id: `dn_page_${compKey}_${Date.now()}`,
            user: `Bắt đầu hành trình tại ${worldLabel} với nhân vật chính ${mcName} (xưng hô: ${mcPronoun}).`,
            assistant:
              `Trang truyện riêng cho "${worldLabel}" đã được khởi tạo.\n\n` +
              `Nhân vật chính: ${mcName} (${mcPronoun}).\n` +
              `Bối cảnh: ${settingSummary}\n\n` +
              'Bạn có thể nhập lượt gọi đầu tiên ở ô bên dưới để bắt đầu diễn biến mới.',
          },
        ];
      }

      const clonedTurns = ensureUniqueTurnIds(
        JSON.parse(JSON.stringify(storyTurns)) as Turn[],
      );
      const baseCompMemory = existingMemories[compKey]
        ? normalizeMemoryConfig(existingMemories[compKey])
        : createDefaultMemoryConfig({
            enabled: prev.memory?.enabled,
            autoMemory: prev.memory?.autoMemory,
            autoStateTracker: prev.memory?.autoStateTracker,
            autoRollingSummary: prev.memory?.autoRollingSummary,
          });
      let compMemory = baseCompMemory;
      if (!compMemory.cultivation) {
        const compCultKind = detectCultivationSystemKind({
          worldName: cur.name,
          genreLabel: cur.role,
          setting: cur.worldSetting,
          rules: cur.worldRules,
          mcRole: cur.mc?.originRole,
          mcDesc: cur.mc?.appearance,
        });
        if (compCultKind) {
          compMemory = {
            ...compMemory,
            cultivation: createStarterCultivationProfile(compCultKind, {
              mcRole: cur.mc?.originRole,
              mcDesc: cur.mc?.appearance,
              worldName: cur.name,
            }),
          };
        }
      }
      const baseCompPortraits = existingPortraits[compKey]
        ? normalizePortraitBank(existingPortraits[compKey])
        : createDefaultPortraitBank({
            autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
            maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
            includeMcAuto: prev.portraitBank?.includeMcAuto,
          });
      const compPortraits = syncPortraitBankWithCompanion(
        baseCompPortraits,
        cur,
        cur.mc?.name || prev.player.name,
      );

      return {
        ...prev,
        checkpoint,
        player: {
          name: cur.mc?.name || prev.player.name,
          pronoun: cur.mc?.pronoun || prev.player.pronoun,
        },
        world: {
          name: cur.name || prev.world.name,
        },
        activeStoryCompanionId: compKey,
        companionStories: {
          ...existingStories,
          [compKey]: clonedTurns,
        },
        companionMemories: {
          ...existingMemories,
          [compKey]: compMemory,
        },
        companionPortraits: {
          ...existingPortraits,
          [compKey]: compPortraits,
        },
        memory: compMemory,
        portraitBank: compPortraits,
        turns: clonedTurns,
        currentPage: Math.max(0, clonedTurns.length - 1),
        activeView: 'chat',
      };
    });

    showBanner(
      `Đã mở trang truyện riêng cho Đồng nhân: ${
        cur.name || 'Đồng nhân'
      } (save cũ đã được tách riêng & lưu checkpoint).`,
    );
  }, [showBanner]);

  const isLobby = state.activeView === 'lobby';
  const isSystemConfigView = SYSTEM_CONFIG_VIEWS.includes(state.activeView);
  const isChatView = state.activeView === 'chat';
  const isDataView = state.activeView === 'data';
  const activeQuickMenuItems = isSystemConfigView
    ? SYSTEM_QUICK_MENU_ITEMS
    : SESSION_QUICK_MENU_ITEMS;
  const isBottomNavHidden = !isSystemConfigView || state.hideBottomNav;
  const showFloatingRestoreNav = isSystemConfigView && state.hideBottomNav;

  return (
    <div className="min-h-[100dvh] bg-transparent text-[#ecf2f9]">
      {/* Hidden File Inputs */}
      <input
        ref={saveFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleSaveFileChange}
      />
      <input
        ref={chatImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChatImageFileChange}
      />
      <input
        ref={lobbyBgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLobbyBgFileChange}
      />

      {isLobby ? (
        <>
          {banner && (
            <div className="mx-auto max-w-2xl px-4 pt-3.5 sm:px-6">
              <div
                className={`flex items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 text-xs backdrop-blur-md ring-1 ring-inset ${
                  banner.type === 'err'
                    ? 'bg-rose-500/14 text-rose-100 ring-rose-400/30'
                    : 'bg-sky-500/14 text-sky-100 ring-sky-400/30'
                }`}
              >
                <span className="leading-relaxed">{banner.text}</span>
                <button
                  type="button"
                  aria-label="Đóng thông báo"
                  onClick={() => setBanner(null)}
                  className="shrink-0 rounded-lg p-1 text-current/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          <LobbyView
            lobbyBgDataUrl={state.lobbyBgDataUrl}
            turnCount={state.turns.length}
            onStartNewStory={handleOpenWorldSetup}
            onNavigate={goView}
            onPickBg={handlePickLobbyBg}
          />
        </>
      ) : (
        <div
          className="mx-auto w-full max-w-4xl px-3.5 pt-3.5 sm:px-6"
          style={{
            paddingBottom: isBottomNavHidden
              ? '32px'
              : 'calc(var(--nav-h) + var(--safe-b) + 24px)',
          }}
        >
          {/* Topbar */}
          <header className="relative z-[80] mb-3.5 flex items-center justify-between gap-3 overflow-visible rounded-2xl bg-[#162032]/88 px-3.5 py-2.5 ring-1 ring-white/[0.08] shadow-[0_12px_30px_-16px_rgba(2,8,23,0.72)] backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => goView('lobby')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/25 via-sky-500/15 to-indigo-500/20 text-[11px] font-bold tracking-wider text-sky-200 ring-1 ring-inset ring-sky-300/30 transition-all hover:from-sky-400/35 hover:to-indigo-500/30 active:scale-[0.97]"
              >
                ARK
              </button>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight tracking-tight text-slate-50 whitespace-nowrap">
                  Ark Lite
                </div>
                <div className="truncate text-[11px] font-medium text-slate-400">
                  {VIEW_LABELS[state.activeView]}
                </div>
              </div>
            </div>

            <div
              ref={quickMenuRef}
              className="relative z-[85] flex shrink-0 items-center gap-1.5"
            >
              {!isDataView && (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={quickMenuOpen}
                  onClick={() => setQuickMenuOpen((v) => !v)}
                  className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                    quickMenuOpen
                      ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                      : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                  }`}
                >
                  <span>Mục</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                      quickMenuOpen ? 'rotate-180 text-sky-300' : ''
                    }`}
                  />
                </button>
              )}

              {isChatView ? (
                <>
                  <button
                    type="button"
                    onClick={triggerImportSave}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/14 px-2.5 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 transition-all hover:bg-sky-500/22 hover:text-sky-100 active:scale-[0.98] whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5 hidden sm:block" />
                    <span>Nhập Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCurrentToSlot}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-2.5 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 hover:text-emerald-100 active:scale-[0.98] whitespace-nowrap"
                  >
                    <Save className="h-3.5 w-3.5 hidden sm:block" />
                    <span>Lưu Slot</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => goView('lobby')}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
                >
                  <Home className="h-3.5 w-3.5 text-sky-300" />
                  <span>Về Sảnh</span>
                </button>
              )}

              {quickMenuOpen && !isDataView && (
                <div
                  role="menu"
                  aria-label="Menu chuyển mục"
                  className="absolute right-0 top-[calc(100%+8px)] z-[90] flex min-w-[196px] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl bg-[#182438]/98 p-1.5 ring-1 ring-white/[0.12] shadow-[0_24px_56px_-10px_rgba(2,6,23,0.9)] backdrop-blur-xl"
                >
                  {activeQuickMenuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => goView(item.id)}
                      className={`min-h-[38px] rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                        state.activeView === item.id
                          ? 'bg-sky-400/18 text-sky-200'
                          : 'text-slate-200 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* Global Banner */}
          {banner && (
            <div
              className={`mb-3.5 flex items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 text-xs backdrop-blur-md ring-1 ring-inset ${
                banner.type === 'err'
                  ? 'bg-rose-500/14 text-rose-100 ring-rose-400/30'
                  : 'bg-sky-500/14 text-sky-100 ring-sky-400/30'
              }`}
            >
              <span className="leading-relaxed">{banner.text}</span>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setBanner(null)}
                className="shrink-0 rounded-lg p-1 text-current/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Active Screen */}
          <main>
            {state.activeView === 'setup' && (
              <WorldSetupView
                state={state}
                hasProxyConfigured={Boolean(
                  (state.config.proxyUrl || '').trim(),
                )}
                onStartConfiguredWorld={handleStartConfiguredWorld}
                onStartBlankSession={handleStartBlankSession}
                onNavigate={goView}
                onNotify={showBanner}
                onAppendProxyLog={appendProxyLog}
              />
            )}

            {state.activeView === 'chat' && (() => {
              const activeComp = getActiveCompanionFromState(state);
              return (
                <ChatView
                  appState={state}
                  turns={state.turns}
                  currentPage={state.currentPage}
                  streamEnabled={state.streamEnabled}
                  showRawTags={state.showRawTags}
                  showPostMeta={state.showPostMeta}
                  hideBottomNav={state.hideBottomNav}
                  isGenerating={isGenerating}
                  genStatus={genStatus}
                  streamingTurnIndex={streamingState?.turnIndex ?? null}
                  streamingTurnId={streamingState?.turnId ?? null}
                  streamingText={streamingState?.text ?? ''}
                  pendingImage={pendingImage}
                  imageCaption={imageCaption}
                  storyImageConfig={state.storyImage}
                  memoryConfig={state.memory}
                  portraitBank={state.portraitBank}
                  generatingPortraitIds={generatingPortraitIds}
                  enrichingAppearanceIds={enrichingAppearanceIds}
                  isEnrichingAppearances={isEnrichingAppearances}
                  bgPortraitStatus={bgPortraitStatus}
                  historyTurns={state.context.historyTurns || 12}
                  hasProxyConfigured={Boolean(
                    (state.config.proxyUrl || '').trim(),
                  )}
                  isSyncingMemory={isSyncingMemory}
                  isSyncingStates={isSyncingStates}
                  isSummarizing={isSummarizing}
                  npcs={activeComp?.npcs || []}
                  activeCompanionName={activeComp?.name || 'Đồng nhân'}
                  mcName={activeComp?.mc?.name || state.player.name || ''}
                  mcPronoun={activeComp?.mc?.pronoun || state.player.pronoun || 'tôi'}
                  mcAbsentAtStart={Boolean(state.player.absentAtStart)}
                  hasSeedreamConfigured={Boolean(
                    (state.config.seedreamUrl || state.config.proxyUrl || '').trim(),
                  )}
                  isGeneratingImage={isGeneratingImage}
                  generatingImageTurnIdx={generatingImageTurnIdx}
                  generatingImageTurnId={generatingImageTurnId}
                  isGeneratingSuggestions={isGeneratingSuggestions}
                  onRequestAiSuggestions={handleRequestAiSuggestions}
                  onCancelAiSuggestions={handleCancelAiSuggestions}
                  onImageCaptionChange={setImageCaption}
                  onNavigate={goView}
                  onPageChange={(page) =>
                    setState((prev) => {
                      const clamped = clampPageIndex(page, prev.turns.length);
                      return clamped === prev.currentPage
                        ? prev
                        : { ...prev, currentPage: clamped };
                    })
                  }
                  onToggleStream={() =>
                    setState((prev) => ({
                      ...prev,
                      streamEnabled: !prev.streamEnabled,
                    }))
                  }
                  onStopGeneration={() => handleStopGeneration(false)}
                  onRegenerateCurrent={handleRegenerateCurrent}
                  onToggleRawTags={() =>
                    setState((prev) => ({
                      ...prev,
                      showRawTags: !prev.showRawTags,
                    }))
                  }
                  onTogglePostMeta={() =>
                    setState((prev) => ({
                      ...prev,
                      showPostMeta: !prev.showPostMeta,
                    }))
                  }
                  onToggleBottomNav={() =>
                    setState((prev) => ({
                      ...prev,
                      hideBottomNav: !prev.hideBottomNav,
                    }))
                  }
                  onUpdateStoryImageConfig={handleUpdateStoryImageConfig}
                  onUpdateMemory={updateMemoryWithCompanionSync}
                  onUpdatePortraitBank={updatePortraitBankWithCompanionSync}
                  onSyncPortraitsFromCompanion={
                    handleSyncPortraitsFromCompanion
                  }
                  onCleanJunkPortraits={handleCleanJunkPortraits}
                  onAutoFillAppearances={() =>
                    void enrichPortraitsAppearances({
                      forceManual: false,
                      silent: false,
                    })
                  }
                  onRefreshPortraitAppearance={(portraitId, force) =>
                    void enrichPortraitsAppearances({
                      portraitIds: [portraitId],
                      forceManual: Boolean(force),
                      silent: !force,
                    })
                  }
                  onGeneratePortrait={(portraitId) =>
                    void handleGenerateSinglePortrait(portraitId)
                  }
                  onScanCurrentPagePortraits={(turnIdx) =>
                    void handleRunBackgroundAutoPortraits(turnIdx, {
                      manual: true,
                    })
                  }
                  onCancelBgPortraits={handleCancelBgPortraits}
                  onDismissBgPortraitStatus={() => setBgPortraitStatus(null)}
                  onExtractMemories={(turnIdx) =>
                    void handleRunMemorySync(turnIdx, 'memory')
                  }
                  onExtractStates={(turnIdx) =>
                    void handleRunMemorySync(turnIdx, 'state')
                  }
                  onRunRollingSummary={(forceAllOlder) =>
                    void handleRunRollingSummary(Boolean(forceAllOlder))
                  }
                  onGenerateStoryImage={(turnIdx) =>
                    void handleGenerateStoryImage(turnIdx)
                  }
                  onCancelStoryImage={handleCancelStoryImage}
                  onClearTurnStoryImage={handleClearTurnStoryImage}
                  onUpdateTurn={(idx, patch) =>
                    updateTurnsWithCompanionSync((turns) =>
                      turns.map((t, i) =>
                        i === idx
                          ? {
                              ...t,
                              ...patch,
                              ...(Object.prototype.hasOwnProperty.call(
                                patch,
                                'assistant',
                              )
                                ? { rawAssistant: undefined }
                                : {}),
                            }
                          : t,
                      ),
                    )
                  }
                  onDeleteTurn={handleDeleteTurn}
                  onPickImage={() => {
                    if (chatImageInputRef.current) {
                      chatImageInputRef.current.value = '';
                      chatImageInputRef.current.click();
                    }
                  }}
                  onSelectPendingImage={(img, suggestedCaption) => {
                    setPendingImage(img);
                    if (suggestedCaption && !imageCaption.trim()) {
                      setImageCaption(suggestedCaption);
                    }
                    showBanner(
                      `Đã chọn ảnh "${img.name}" để đính kèm lượt gọi mới.`,
                    );
                  }}
                  onClearPendingImage={() => {
                    setPendingImage(null);
                    setImageCaption('');
                  }}
                  onSendTurn={handleSendNewTurn}
                  onDownloadImage={handleDownloadImage}
                  onNotify={showBanner}
                />
              );
            })()}

            {state.activeView === 'config' && (
              <ConfigView
                appState={state}
                config={state.config}
                storyImageConfig={state.storyImage}
                tawaPreset={state.tawaPreset}
                proxyLogs={proxyLogs}
                onAppendProxyLog={appendProxyLog}
                onSaveConfig={({ config, prefill }) => {
                  setState((prev) => ({
                    ...prev,
                    config,
                    tawaPreset: { ...prev.tawaPreset, prefill },
                  }));
                  showBanner(
                    'Đã lưu Cấu hình hệ thống (Proxy API, Prefill, Safety Settings và Seedream 5 Pro).',
                  );
                }}
                onUpdateStoryImageConfig={handleUpdateStoryImageConfig}
                onTogglePrefill={(currentPrefill) => {
                  const nextEnabled = !stateRef.current.tawaPreset.prefillEnabled;
                  setState((prev) => ({
                    ...prev,
                    tawaPreset: {
                      ...prev.tawaPreset,
                      prefillEnabled: nextEnabled,
                      prefill: currentPrefill,
                    },
                  }));
                  showBanner(
                    nextEnabled
                      ? 'Đã BẬT gửi Prefill khi gọi AI.'
                      : 'Đã TẮT gửi Prefill khi gọi AI.',
                  );
                }}
                onResetSafety={() => {
                  setState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      safetySettings: DEFAULT_SAFETY.map((s) => ({ ...s })),
                    },
                  }));
                  showBanner('Đã khôi phục Safety Settings về BLOCK_NONE.');
                }}
                onNotify={showBanner}
                onDownloadImage={handleDownloadImage}
                onAttachSeedreamToChat={(imgUrl, caption) => {
                  setPendingImage({
                    dataUrl: imgUrl,
                    name: `seedream_${Date.now()}.png`,
                  });
                  if (caption && !imageCaption.trim()) {
                    setImageCaption(caption);
                  }
                  showBanner(
                    'Đã gắn ảnh Seedream vào hàng chờ. Quay về Sảnh và bấm "Tiếp tục" để gửi kèm trong lượt truyện.',
                  );
                }}
              />
            )}

            {state.activeView === 'companion' && (
              <CompanionView
                state={state}
                generatingPortraitIds={generatingPortraitIds}
                enrichingAppearanceIds={enrichingAppearanceIds}
                isEnrichingAppearances={isEnrichingAppearances}
                enrichingNpcIds={enrichingNpcIds}
                isEnrichingAllNpcs={isEnrichingAllNpcs}
                bgPortraitStatus={bgPortraitStatus}
                onUpdateActiveCompanion={handleUpdateActiveCompanion}
                onUpdatePortraitBank={updatePortraitBankWithCompanionSync}
                onSyncPortraitsFromCompanion={handleSyncPortraitsFromCompanion}
                onCleanJunkPortraits={handleCleanJunkPortraits}
                onAutoFillAppearances={() =>
                  void enrichPortraitsAppearances({
                    forceManual: false,
                    silent: false,
                  })
                }
                onRefreshPortraitAppearance={(portraitId, force) =>
                  void enrichPortraitsAppearances({
                    portraitIds: [portraitId],
                    forceManual: Boolean(force),
                    silent: !force,
                  })
                }
                onEnrichNpcProfile={(npcId, force) =>
                  void enrichCompanionNpcs({
                    npcIds: [npcId],
                    forceManual: Boolean(force),
                  })
                }
                onEnrichAllNpcs={() =>
                  void enrichCompanionNpcs({ forceManual: false })
                }
                onGeneratePortrait={(portraitId) =>
                  void handleGenerateSinglePortrait(portraitId)
                }
                onCancelBgPortraits={handleCancelBgPortraits}
                onDownloadImage={handleDownloadImage}
                onSelectCompanion={(id) =>
                  setState((prev) => {
                    const prevCompKey = prev.activeCompanionId || '';
                    const updatedMap = prevCompKey
                      ? {
                          ...(prev.companionPortraits || {}),
                          [prevCompKey]:
                            prev.portraitBank || createDefaultPortraitBank(),
                        }
                      : prev.companionPortraits || {};
                    const nextComp =
                      prev.companions.find((c) => c.id === id) ||
                      prev.companions[0];
                    const nextBase = updatedMap[id]
                      ? normalizePortraitBank(updatedMap[id])
                      : createDefaultPortraitBank({
                          autoGenerateOnAppear:
                            prev.portraitBank?.autoGenerateOnAppear,
                          maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                          includeMcAuto: prev.portraitBank?.includeMcAuto,
                        });
                    const nextBank = syncPortraitBankWithCompanion(
                      nextBase,
                      nextComp,
                      nextComp?.mc?.name || prev.player.name,
                    );
                    return {
                      ...prev,
                      activeCompanionId: id,
                      portraitBank: nextBank,
                      companionPortraits: {
                        ...updatedMap,
                        [id]: nextBank,
                      },
                    };
                  })
                }
                onCreateNewProfile={handleCreateNewFanficProfile}
                onDeleteProfile={handleDeleteFanficProfile}
                onImportProfile={handleImportFanficProfile}
                onEnterCompanionWorld={handleEnterCompanionWorld}
                onNavigate={goView}
                onNotify={showBanner}
              />
            )}

            {state.activeView === 'preset' && (
              <PresetView
                tawaPreset={state.tawaPreset}
                onSavePreset={(modules, prefill, options) => {
                  setState((prev) => ({
                    ...prev,
                    tawaPreset: {
                      ...prev.tawaPreset,
                      modules,
                      prefill,
                      ...(typeof options?.exclusiveStyleMode === 'boolean'
                        ? { exclusiveStyleMode: options.exclusiveStyleMode }
                        : {}),
                    },
                  }));
                  if (!options?.silent) {
                    showBanner(
                      options?.message || 'Đã lưu chuỗi P&P Preset.',
                    );
                  }
                }}
                onResetDefault={() => {
                  setState((prev) => ({
                    ...prev,
                    tawaPreset: {
                      ...prev.tawaPreset,
                      modules: createDefaultModules(),
                      prefill: DEFAULT_PREFILL,
                      exclusiveStyleMode: true,
                    },
                  }));
                  showBanner('Đã khôi phục P&P Preset mặc định.');
                }}
              />
            )}

            {state.activeView === 'context' && (
              <ContextView
                context={state.context}
                memory={state.memory}
                turnCount={state.turns.length}
                currentPage={state.currentPage}
                hasProxyConfigured={Boolean(
                  (state.config.proxyUrl || '').trim(),
                )}
                isSyncingMemory={isSyncingMemory}
                isSyncingStates={isSyncingStates}
                isSummarizing={isSummarizing}
                onSaveContext={(next: ContextConfig) => {
                  setState((prev) => ({ ...prev, context: next }));
                  showBanner('Đã lưu cài đặt Ngữ cảnh.');
                }}
                onNavigate={goView}
                onUpdateMemory={updateMemoryWithCompanionSync}
                onExtractMemories={(turnIdx) =>
                  void handleRunMemorySync(turnIdx, 'memory')
                }
                onExtractStates={(turnIdx) =>
                  void handleRunMemorySync(turnIdx, 'state')
                }
                onRunRollingSummary={(forceAllOlder) =>
                  void handleRunRollingSummary(Boolean(forceAllOlder))
                }
              />
            )}

            {state.activeView === 'data' && (
              <DataView
                slots={state.slots}
                hasCheckpoint={Boolean(state.checkpoint)}
                onTriggerImport={triggerImportSave}
                onImportJsonText={applyImportedJsonText}
                onSaveSlot={handleSaveCurrentToSlot}
                onDownloadSave={handleDownloadSave}
                onDownloadFullBackup={handleDownloadFullBackup}
                onUndoCheckpoint={handleUndoCheckpoint}
                onRequestResetClean={handleRequestResetClean}
                onLoadSlot={(idx) => {
                  const s = stateRef.current.slots[idx];
                  if (!s) return;
                  activeStoryCompanionIdRef.current = null;
                  turnPreClockRef.current.clear();
                  const loadedTurns = ensureUniqueTurnIds(
                    JSON.parse(JSON.stringify(s.turns || [])) as Turn[],
                  );
                  setState((prev) => {
                    const nextPlayer = s.player
                      ? { ...prev.player, ...s.player }
                      : prev.player;
                    const activeComp = getActiveCompanionFromState(prev);
                    const nextPortraits = s.portraitBank
                      ? normalizePortraitBank(s.portraitBank)
                      : syncPortraitBankWithCompanion(
                          createDefaultPortraitBank({
                            autoGenerateOnAppear:
                              prev.portraitBank?.autoGenerateOnAppear,
                            maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                            includeMcAuto: prev.portraitBank?.includeMcAuto,
                          }),
                          activeComp,
                          nextPlayer.name,
                        );
                    return {
                      ...prev,
                      turns: loadedTurns,
                      activeStoryCompanionId: null,
                      player: nextPlayer,
                      world: s.world
                        ? { ...prev.world, ...s.world }
                        : prev.world,
                      memory: s.memory
                        ? normalizeMemoryConfig(s.memory)
                        : createDefaultMemoryConfig({
                            enabled: prev.memory?.enabled,
                            autoMemory: prev.memory?.autoMemory,
                            autoStateTracker: prev.memory?.autoStateTracker,
                            autoRollingSummary:
                              prev.memory?.autoRollingSummary,
                          }),
                      portraitBank: nextPortraits,
                      tawaPreset: s.tawaPreset
                        ? normalizeTawaPreset(s.tawaPreset, prev.tawaPreset)
                        : prev.tawaPreset,
                      currentPage: Math.max(0, loadedTurns.length - 1),
                      activeView: 'chat',
                    };
                  });
                }}
                onCloneSlot={(idx) => {
                  setState((prev) => {
                    const s = prev.slots[idx];
                    if (!s) return prev;
                    const cloned = {
                      ...JSON.parse(JSON.stringify(s)),
                      id: `slot_${Date.now()}`,
                      name: `${s.name || 'Slot'} (Bản sao)`,
                      savedAt: new Date().toISOString(),
                    };
                    const nextSlots = [...prev.slots];
                    nextSlots.splice(idx + 1, 0, cloned);
                    return { ...prev, slots: nextSlots };
                  });
                }}
                onDeleteSlot={(idx) => {
                  const nextState: ArkState = {
                    ...stateRef.current,
                    slots: stateRef.current.slots.filter((_, i) => i !== idx),
                  };
                  stateRef.current = nextState;
                  setState(nextState);
                  flushPersistNow(nextState);
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Floating Restore Bottom Nav Button */}
      {showFloatingRestoreNav && (
        <button
          type="button"
          onClick={() =>
            setState((prev) => ({ ...prev, hideBottomNav: false }))
          }
          className="fixed right-3.5 z-40 min-h-[38px] rounded-xl bg-[#1a263b]/92 px-3.5 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/35 shadow-[0_12px_28px_-8px_rgba(2,6,23,0.7)] backdrop-blur-xl transition-all hover:bg-[#22314a] active:scale-[0.98]"
          style={{ bottom: 'calc(14px + var(--safe-b))' }}
        >
          Hiện thanh mục
        </button>
      )}

      {/* Fixed Bottom Navigation (System Config Tabs Only) */}
      {!isBottomNavHidden && (
        <nav
          aria-label="Điều hướng cấu hình hệ thống"
          className="fixed left-0 right-0 z-40 grid grid-cols-4 border-t border-white/[0.08] bg-[#121a2a]/92 px-1.5 pt-1.5 backdrop-blur-xl shadow-[0_-10px_30px_-14px_rgba(2,6,23,0.7)]"
          style={{
            bottom: `${navBottomOffset}px`,
            height: 'calc(var(--nav-h) + var(--safe-b))',
            paddingBottom: 'var(--safe-b)',
          }}
        >
          {SYSTEM_BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = state.activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goView(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition-all ${
                  active
                    ? 'bg-sky-400/14 text-sky-300'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-sky-300' : ''}`} />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Cross-platform Mobile / Fallback Image Save Modal */}
      <ImageSaveModal
        payload={imageSaveFallback}
        onClose={closeImageSaveFallback}
        onNotify={showBanner}
      />

      {/* In-app Confirmation Modal */}
      <ConfirmModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        confirmTone={confirmDialog.confirmTone}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        onDismiss={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}
