import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Backpack,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Flame,
  Minus,
  Plus,
  Sparkles,
  Swords,
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import type {
  CultivationProfile,
  CultivationSystemKind,
  CultivationTechnique,
  InventoryItem,
  InventoryItemCategory,
  InventoryItemQuality,
  StoryClockState,
  TechniqueCategory,
  TechniqueMove,
  TechniqueTier,
} from '../types/ark';
import {
  bumpMoveMastery,
  consumeInventoryItem,
  CULTIVATION_SYSTEM_META,
  generateSuggestedMovesForTechnique,
  getNextRealmStage,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_QUALITY_META,
  performBreakthrough,
  scanTurnForLootSuggestions,
  TECHNIQUE_TIER_META,
  type LootSuggestion,
} from '../utils/cultivation';
import {
  addMinutesToClock,
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from '../utils/storyClock';

export type CultivationSubTab = 'realm' | 'techniques' | 'inventory';

export interface QuickCultivateResult {
  expGained: number;
  leveledTechniques: string[];
  leveledMoves: string[];
  becameReadyToBreakthrough: boolean;
  readyToBreakthrough: boolean;
  clockBeforeLabel: string;
  clockAfterLabel: string;
  deltaLabel: string;
}

interface CultivationPanelProps {
  profile: CultivationProfile;
  mcName?: string;
  storyClock?: StoryClockState;
  currentTurnText?: string;
  initialTab?: CultivationSubTab;
  onUpdateProfile: (
    updater: (prev: CultivationProfile) => CultivationProfile,
  ) => void;
  onQuickCultivate?: (
    durationMinutes: number,
    label: string,
  ) => QuickCultivateResult | null;
  onOpenClock?: () => void;
  onClose?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
}

const TIER_ORDER: TechniqueTier[] = [
  'pham',
  'linh',
  'huyen',
  'dia',
  'thien',
  'chiton',
];

const QUALITY_ORDER: InventoryItemQuality[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

const CATEGORY_ORDER: InventoryItemCategory[] = [
  'consumable',
  'weapon',
  'material',
  'talisman',
  'misc',
];

export function CultivationPanel({
  profile,
  mcName,
  storyClock,
  currentTurnText = '',
  initialTab = 'realm',
  onUpdateProfile,
  onQuickCultivate,
  onOpenClock,
  onClose,
  onNotify,
}: CultivationPanelProps) {
  const [activeTab, setActiveTab] = useState<CultivationSubTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Quick Cultivation (Tu luyện nhanh) state
  const [quickTrainOpen, setQuickTrainOpen] = useState(true);
  const [customTrainHours, setCustomTrainHours] = useState('2');
  const [lastQuickResult, setLastQuickResult] =
    useState<QuickCultivateResult | null>(null);

  // Realm quick-edit state
  const [editingRealm, setEditingRealm] = useState(false);
  const [draftSystemKind, setDraftSystemKind] = useState<CultivationSystemKind>(
    profile.systemKind,
  );
  const [draftRealmIndex, setDraftRealmIndex] = useState(profile.realmIndex);
  const [draftRealmName, setDraftRealmName] = useState(profile.realmName);
  const [draftExp, setDraftExp] = useState(String(profile.exp));
  const [draftMaxExp, setDraftMaxExp] = useState(String(profile.maxExp));
  const [draftBagName, setDraftBagName] = useState(profile.bagName);

  // Technique composer / editor
  const [techFormOpen, setTechFormOpen] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [techName, setTechName] = useState('');
  const [techCategory, setTechCategory] =
    useState<TechniqueCategory>('martial');
  const [techTier, setTechTier] = useState<TechniqueTier>('linh');
  const [techLevel, setTechLevel] = useState('1');
  const [techMaxLevel, setTechMaxLevel] = useState('9');
  const [techMastery, setTechMastery] = useState('10');
  const [techActiveTraining, setTechActiveTraining] = useState(false);
  const [techAutoGenerateMoves, setTechAutoGenerateMoves] = useState(true);
  const [techDesc, setTechDesc] = useState('');

  // Moves (Chiêu thức) expand + add/edit state
  const [expandedMovesTechIds, setExpandedMovesTechIds] = useState<
    Record<string, boolean>
  >({});
  const [moveFormTechId, setMoveFormTechId] = useState<string | null>(null);
  const [editingMoveId, setEditingMoveId] = useState<string | null>(null);
  const [moveName, setMoveName] = useState('');
  const [moveDesc, setMoveDesc] = useState('');
  const [moveLevel, setMoveLevel] = useState('1');
  const [moveMaxLevel, setMoveMaxLevel] = useState('5');
  const [moveMastery, setMoveMastery] = useState('20');

  // Inventory composer / editor
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemQuality, setItemQuality] =
    useState<InventoryItemQuality>('uncommon');
  const [itemCategory, setItemCategory] =
    useState<InventoryItemCategory>('consumable');
  const [itemDesc, setItemDesc] = useState('');

  const meta = CULTIVATION_SYSTEM_META[profile.systemKind];
  const nextRealm = getNextRealmStage(profile);
  const expPct = Math.min(
    100,
    Math.round((profile.exp / Math.max(1, profile.maxExp)) * 100),
  );
  const canBreakthrough =
    profile.readyToBreakthrough || profile.exp >= profile.maxExp;

  const normalizedClock = useMemo(
    () => (storyClock ? normalizeStoryClock(storyClock) : null),
    [storyClock],
  );
  const formattedClock = useMemo(
    () => (normalizedClock ? formatStoryClock(normalizedClock) : null),
    [normalizedClock],
  );
  const activeTrainingNames = useMemo(() => {
    const active = profile.techniques
      .filter((t) => t.isActiveTraining)
      .map((t) => t.name);
    if (active.length > 0) return active;
    const fallback =
      profile.techniques.find((t) => t.category === 'mental') ||
      profile.techniques[0];
    return fallback ? [`${fallback.name} (mặc định)`] : [];
  }, [profile.techniques]);

  const lootSuggestions = useMemo(
    () => scanTurnForLootSuggestions(currentTurnText, profile),
    [currentTurnText, profile],
  );

  const openRealmEditor = () => {
    setDraftSystemKind(profile.systemKind);
    setDraftRealmIndex(profile.realmIndex);
    setDraftRealmName(profile.realmName);
    setDraftExp(String(profile.exp));
    setDraftMaxExp(String(profile.maxExp));
    setDraftBagName(profile.bagName);
    setEditingRealm(true);
  };

  const handleSaveRealmEdit = () => {
    const nextMeta = CULTIVATION_SYSTEM_META[draftSystemKind];
    const safeIdx = Math.max(
      0,
      Math.min(nextMeta.realms.length - 1, draftRealmIndex),
    );
    const parsedMax = Math.max(
      10,
      parseInt(draftMaxExp, 10) || nextMeta.realms[safeIdx]?.maxExp || 120,
    );
    const parsedExp = Math.max(0, parseInt(draftExp, 10) || 0);
    const cleanRealmName =
      draftRealmName.trim() || nextMeta.realms[safeIdx]?.name || profile.realmName;
    const cleanBagName = draftBagName.trim() || nextMeta.bagName;

    onUpdateProfile((prev) => ({
      ...prev,
      systemKind: draftSystemKind,
      realmIndex: safeIdx,
      realmName: cleanRealmName,
      energyLabel: nextMeta.energyLabel,
      exp: parsedExp,
      maxExp: parsedMax,
      readyToBreakthrough: parsedExp >= parsedMax,
      bagName: cleanBagName,
      lastUpdatedAt: Date.now(),
    }));
    setEditingRealm(false);
    onNotify?.('Đã cập nhật cảnh giới và chỉ số tu luyện.');
  };

  const handleBreakthrough = () => {
    const res = performBreakthrough(profile);
    onUpdateProfile(() => res.nextProfile);
    onNotify?.(
      res.isMaxRealm
        ? `Đã củng cố cảnh giới đỉnh phong ${res.nextRealmName}.`
        : `Đột phá thành công lên cảnh giới ${res.nextRealmName}!`,
    );
  };

  const handleQuickAddExp = (amount: number) => {
    onUpdateProfile((prev) => {
      const cap = Math.round(prev.maxExp * 1.35);
      const nextExp = Math.min(cap, Math.max(0, prev.exp + amount));
      return {
        ...prev,
        exp: nextExp,
        readyToBreakthrough: nextExp >= prev.maxExp,
        lastGainSummary: `${amount > 0 ? '+' : ''}${amount} ${prev.energyLabel.split('/')[0].trim()} (cập nhật thủ công)`,
        lastUpdatedAt: Date.now(),
      };
    });
  };

  const handleRunQuickCultivate = (hours: number, customLabel?: string) => {
    if (!Number.isFinite(hours) || hours <= 0) {
      onNotify?.('Vui lòng nhập số giờ tu luyện hợp lệ (lớn hơn 0).', 'err');
      return;
    }
    const clampedHours = Math.min(240, Math.max(0.5, hours));
    const deltaMinutes = Math.round(clampedHours * 60);
    const label = customLabel || formatDeltaMinutesVi(deltaMinutes).replace(/^\+/, '');
    if (onQuickCultivate) {
      const res = onQuickCultivate(deltaMinutes, label);
      if (res) {
        setLastQuickResult(res);
      }
    }
  };

  const openNewTechniqueForm = () => {
    setEditingTechId(null);
    setTechName('');
    setTechCategory('martial');
    setTechTier('linh');
    setTechLevel('1');
    setTechMaxLevel('9');
    setTechMastery('10');
    setTechActiveTraining(false);
    setTechAutoGenerateMoves(true);
    setTechDesc('');
    setTechFormOpen(true);
  };

  const openEditTechniqueForm = (tech: CultivationTechnique) => {
    setEditingTechId(tech.id);
    setTechName(tech.name);
    setTechCategory(tech.category);
    setTechTier(tech.tier);
    setTechLevel(String(tech.level));
    setTechMaxLevel(String(tech.maxLevel));
    setTechMastery(String(tech.mastery));
    setTechActiveTraining(tech.isActiveTraining);
    setTechAutoGenerateMoves(false);
    setTechDesc(tech.description || '');
    setTechFormOpen(true);
  };

  const handleSaveTechnique = () => {
    const cleanName = techName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên công pháp / võ công.', 'err');
      return;
    }
    const maxLv = Math.max(1, Math.min(99, parseInt(techMaxLevel, 10) || 9));
    const lv = Math.max(1, Math.min(maxLv, parseInt(techLevel, 10) || 1));
    const mastery = Math.max(0, Math.min(100, parseInt(techMastery, 10) || 0));

    const existingTech = editingTechId
      ? profile.techniques.find((t) => t.id === editingTechId)
      : undefined;
    const generatedMoves =
      !editingTechId && techAutoGenerateMoves
        ? generateSuggestedMovesForTechnique({
            name: cleanName,
            category: techCategory,
            systemKind: profile.systemKind,
          })
        : undefined;
    const movesToKeep = editingTechId ? existingTech?.moves : generatedMoves;
    const newId =
      editingTechId ||
      `tech_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const entry: CultivationTechnique = {
      id: newId,
      name: cleanName,
      category: techCategory,
      tier: techTier,
      level: lv,
      maxLevel: maxLv,
      mastery,
      isActiveTraining: techActiveTraining,
      ...(techDesc.trim() ? { description: techDesc.trim() } : {}),
      ...(movesToKeep && movesToKeep.length > 0 ? { moves: movesToKeep } : {}),
    };

    onUpdateProfile((prev) => ({
      ...prev,
      techniques: editingTechId
        ? prev.techniques.map((t) => (t.id === editingTechId ? entry : t))
        : [...prev.techniques, entry],
      lastUpdatedAt: Date.now(),
    }));
    if (!editingTechId && generatedMoves && generatedMoves.length > 0) {
      setExpandedMovesTechIds((prev) => ({ ...prev, [newId]: true }));
    }
    setTechFormOpen(false);
    setEditingTechId(null);
    onNotify?.(
      editingTechId
        ? `Đã cập nhật "${cleanName}".`
        : generatedMoves?.length
          ? `Đã thêm "${cleanName}" kèm ${generatedMoves.length} chiêu thức gợi ý.`
          : `Đã thêm công pháp "${cleanName}".`,
    );
  };

  const handleBumpTechniqueMastery = (techId: string, delta: number) => {
    let leveledMsg = '';
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== techId) return t;
        let nextLevel = t.level;
        let nextMastery = Math.max(0, t.mastery + delta);
        while (nextMastery >= 100 && nextLevel < t.maxLevel) {
          nextMastery -= 100;
          nextLevel += 1;
        }
        if (nextLevel >= t.maxLevel && nextMastery > 100) {
          nextMastery = 100;
        }
        if (nextLevel > t.level) {
          leveledMsg = `${t.name} thăng lên Tầng ${nextLevel}!`;
        }
        const nextMoves =
          t.moves && t.moves.length > 0
            ? t.moves.map((mv) => bumpMoveMastery(mv, Math.max(2, Math.round(delta * 0.6))).nextMove)
            : t.moves;
        return {
          ...t,
          level: nextLevel,
          mastery: nextMastery,
          ...(nextMoves ? { moves: nextMoves } : {}),
        };
      }),
      lastUpdatedAt: Date.now(),
    }));
    if (leveledMsg) onNotify?.(leveledMsg);
  };

  const handleToggleTechniqueTraining = (techId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) =>
        t.id === techId ? { ...t, isActiveTraining: !t.isActiveTraining } : t,
      ),
      lastUpdatedAt: Date.now(),
    }));
  };

  const handleDeleteTechnique = (techId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.filter((t) => t.id !== techId),
      lastUpdatedAt: Date.now(),
    }));
  };

  const toggleMovesExpand = (techId: string) => {
    setExpandedMovesTechIds((prev) => ({ ...prev, [techId]: !prev[techId] }));
  };

  const openNewMoveForm = (techId: string) => {
    setExpandedMovesTechIds((prev) => ({ ...prev, [techId]: true }));
    setMoveFormTechId(techId);
    setEditingMoveId(null);
    setMoveName('');
    setMoveDesc('');
    setMoveLevel('1');
    setMoveMaxLevel('5');
    setMoveMastery('20');
  };

  const openEditMoveForm = (techId: string, move: TechniqueMove) => {
    setExpandedMovesTechIds((prev) => ({ ...prev, [techId]: true }));
    setMoveFormTechId(techId);
    setEditingMoveId(move.id);
    setMoveName(move.name);
    setMoveDesc(move.description || '');
    setMoveLevel(String(move.level));
    setMoveMaxLevel(String(move.maxLevel));
    setMoveMastery(String(move.mastery));
  };

  const handleSaveMove = (techId: string) => {
    const cleanName = moveName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên chiêu thức.', 'err');
      return;
    }
    const maxLv = Math.max(1, Math.min(20, parseInt(moveMaxLevel, 10) || 5));
    const lv = Math.max(1, Math.min(maxLv, parseInt(moveLevel, 10) || 1));
    const mastery = Math.max(0, Math.min(100, parseInt(moveMastery, 10) || 0));

    const entry: TechniqueMove = {
      id:
        editingMoveId ||
        `mv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      level: lv,
      maxLevel: maxLv,
      mastery,
      ...(moveDesc.trim() ? { description: moveDesc.trim() } : {}),
    };

    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== techId) return t;
        const curMoves = t.moves || [];
        return {
          ...t,
          moves: editingMoveId
            ? curMoves.map((m) => (m.id === editingMoveId ? entry : m))
            : [...curMoves, entry],
        };
      }),
      lastUpdatedAt: Date.now(),
    }));

    setMoveFormTechId(null);
    setEditingMoveId(null);
    onNotify?.(
      editingMoveId
        ? `Đã cập nhật chiêu thức "${cleanName}".`
        : `Đã thêm chiêu thức "${cleanName}".`,
    );
  };

  const handleGenerateMovesForTech = (tech: CultivationTechnique) => {
    const generated = generateSuggestedMovesForTechnique({
      name: tech.name,
      category: tech.category,
      systemKind: profile.systemKind,
    });
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== tech.id) return t;
        const existing = t.moves || [];
        const existingLower = new Set(existing.map((m) => m.name.toLowerCase()));
        const uniqueNew = generated.filter(
          (m) => !existingLower.has(m.name.toLowerCase()),
        );
        return {
          ...t,
          moves: existing.length > 0 ? [...existing, ...uniqueNew] : generated,
        };
      }),
      lastUpdatedAt: Date.now(),
    }));
    setExpandedMovesTechIds((prev) => ({ ...prev, [tech.id]: true }));
    onNotify?.(`Đã tạo gợi ý ${generated.length} chiêu thức cho "${tech.name}".`);
  };

  const handleBumpSingleMove = (techId: string, moveId: string, delta: number) => {
    let notice = '';
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== techId || !t.moves) return t;
        const nextMoves = t.moves.map((m) => {
          if (m.id !== moveId) return m;
          const res = bumpMoveMastery(m, delta);
          if (res.leveledUp) {
            notice = `Chiêu thức "${m.name}" đạt Cấp ${res.nextMove.level}!`;
          }
          return res.nextMove;
        });
        // Gently nudge parent technique mastery (+2%) when practicing an individual move
        let nextLevel = t.level;
        let nextMastery = t.mastery + 2;
        while (nextMastery >= 100 && nextLevel < t.maxLevel) {
          nextMastery -= 100;
          nextLevel += 1;
        }
        if (nextLevel >= t.maxLevel && nextMastery > 100) nextMastery = 100;
        return {
          ...t,
          level: nextLevel,
          mastery: nextMastery,
          moves: nextMoves,
        };
      }),
      lastUpdatedAt: Date.now(),
    }));
    if (notice) onNotify?.(notice);
  };

  const handleDeleteMove = (techId: string, moveId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== techId || !t.moves) return t;
        return {
          ...t,
          moves: t.moves.filter((m) => m.id !== moveId),
        };
      }),
      lastUpdatedAt: Date.now(),
    }));
  };

  const openNewItemForm = () => {
    setEditingItemId(null);
    setItemName('');
    setItemQty('1');
    setItemQuality('uncommon');
    setItemCategory('consumable');
    setItemDesc('');
    setItemFormOpen(true);
  };

  const openEditItemForm = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemQty(String(item.quantity));
    setItemQuality(item.quality);
    setItemCategory(item.category);
    setItemDesc(item.description || '');
    setItemFormOpen(true);
  };

  const handleSaveItem = () => {
    const cleanName = itemName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên vật phẩm.', 'err');
      return;
    }
    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
    const entry: InventoryItem = {
      id: editingItemId || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      quantity: qty,
      quality: itemQuality,
      category: itemCategory,
      ...(itemDesc.trim() ? { description: itemDesc.trim() } : {}),
    };

    onUpdateProfile((prev) => {
      if (editingItemId) {
        return {
          ...prev,
          inventory: prev.inventory.map((i) =>
            i.id === editingItemId ? entry : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      // Merge quantity if same name exists
      const existingIdx = prev.inventory.findIndex(
        (i) => i.name.trim().toLowerCase() === cleanName.toLowerCase(),
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          inventory: prev.inventory.map((i, idx) =>
            idx === existingIdx
              ? {
                  ...i,
                  quantity: i.quantity + qty,
                  ...(entry.description ? { description: entry.description } : {}),
                }
              : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        inventory: [...prev.inventory, entry],
        lastUpdatedAt: Date.now(),
      };
    });

    setItemFormOpen(false);
    setEditingItemId(null);
    onNotify?.(
      editingItemId
        ? `Đã cập nhật vật phẩm "${cleanName}".`
        : `Đã thêm "${cleanName}" vào ${profile.bagName}.`,
    );
  };

  const handlePickLootSuggestion = (loot: LootSuggestion) => {
    onUpdateProfile((prev) => {
      const existingIdx = prev.inventory.findIndex(
        (i) => i.name.trim().toLowerCase() === loot.name.trim().toLowerCase(),
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          inventory: prev.inventory.map((i, idx) =>
            idx === existingIdx ? { ...i, quantity: i.quantity + loot.quantity } : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        inventory: [
          ...prev.inventory,
          {
            id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: loot.name,
            quantity: loot.quantity,
            quality: loot.quality,
            category: loot.category,
            description: loot.description,
          },
        ],
        lastUpdatedAt: Date.now(),
      };
    });
    onNotify?.(`Đã nhặt "${loot.name}" vào ${profile.bagName}.`);
  };

  const handleUseItem = (itemId: string) => {
    const res = consumeInventoryItem(profile, itemId);
    if (!res.itemName) return;
    onUpdateProfile(() => res.nextProfile);
    onNotify?.(
      res.expBonus > 0
        ? `Đã dùng ${res.itemName} (+${res.expBonus} ${profile.energyLabel.split('/')[0].trim()}).`
        : `Đã dùng 1 ${res.itemName}.`,
    );
  };

  const handleAdjustItemQty = (itemId: string, delta: number) => {
    onUpdateProfile((prev) => ({
      ...prev,
      inventory: prev.inventory
        .map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
      lastUpdatedAt: Date.now(),
    }));
  };

  const handleDeleteItem = (itemId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((i) => i.id !== itemId),
      lastUpdatedAt: Date.now(),
    }));
  };

  return (
    <div className="space-y-3">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 shrink-0 text-amber-300" />
            <h3 className="truncate text-sm font-bold text-slate-50">
              Hồ sơ {meta.label}
              {mcName ? ` · ${mcName}` : ''}
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
            {profile.realmName} · {profile.exp}/{profile.maxExp}{' '}
            {profile.energyLabel.split('/')[0].trim()} ·{' '}
            {profile.techniques.length} công pháp · {profile.inventory.length}{' '}
            vật phẩm
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onQuickCultivate && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('realm');
                setQuickTrainOpen((v) => (activeTab === 'realm' ? !v : true));
              }}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                quickTrainOpen && activeTab === 'realm'
                  ? 'bg-emerald-500/22 text-emerald-100 ring-emerald-400/40'
                  : 'bg-emerald-500/12 text-emerald-200 ring-emerald-400/28 hover:bg-emerald-500/20'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-emerald-300" />
              <span>Tu luyện nhanh</span>
            </button>
          )}
          {onOpenClock && (
            <button
              type="button"
              onClick={onOpenClock}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] whitespace-nowrap"
            >
              <Clock className="h-3.5 w-3.5 text-amber-300" />
              <span>Đồng hồ</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Đóng hồ sơ tu luyện"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Mục hồ sơ tu luyện"
        className="grid grid-cols-3 gap-1 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07]"
      >
        {(
          [
            { id: 'realm', label: 'Cảnh giới', icon: Flame },
            {
              id: 'techniques',
              label: `Công pháp (${profile.techniques.length})`,
              icon: BookOpen,
            },
            {
              id: 'inventory',
              label: `Túi đồ (${profile.inventory.length})`,
              icon: Backpack,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                active
                  ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: REALM & EXP */}
      {activeTab === 'realm' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#0e1625]/75 p-3.5 ring-1 ring-inset ring-white/[0.07] space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-400">
                  Cảnh giới hiện tại · {meta.label}
                </div>
                <div className="mt-0.5 text-base font-bold tracking-tight text-amber-200">
                  {profile.realmName}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  editingRealm ? setEditingRealm(false) : openRealmEditor()
                }
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] whitespace-nowrap"
              >
                <Edit3 className="h-3.5 w-3.5 text-sky-300" />
                <span>{editingRealm ? 'Đóng sửa' : 'Chỉnh sửa'}</span>
              </button>
            </div>

            {/* EXP Progress */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                <span className="text-slate-300 font-medium">
                  {profile.energyLabel}
                </span>
                <span className="font-semibold text-slate-100">
                  {profile.exp.toLocaleString('vi-VN')} /{' '}
                  {profile.maxExp.toLocaleString('vi-VN')} ({expPct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    canBreakthrough
                      ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                      : 'bg-gradient-to-r from-sky-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, expPct)}%` }}
                />
              </div>
              {nextRealm && (
                <div className="text-[11px] text-slate-400">
                  Cảnh giới kế tiếp:{' '}
                  <span className="font-medium text-slate-200">
                    {nextRealm.name}
                  </span>
                </div>
              )}
            </div>

            {/* Breakthrough Ready Callout */}
            {canBreakthrough && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/12 px-3 py-2.5 ring-1 ring-inset ring-amber-400/32">
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-amber-200">
                    Sẵn sàng đột phá cảnh giới
                  </div>
                  <div className="text-[11px] text-amber-100/80">
                    {nextRealm
                      ? `Đủ ${profile.energyLabel.toLowerCase()} để bước lên ${nextRealm.name}.`
                      : 'Đã đạt mốc viên mãn cảnh giới hiện tại.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBreakthrough}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(245,158,11,0.55)] transition-all hover:from-amber-400 hover:to-orange-500 active:scale-[0.985] whitespace-nowrap shrink-0"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  <span>Đột phá ngay</span>
                </button>
              </div>
            )}

            {/* Quick Cultivation Mode (Tu luyện nhanh) */}
            {onQuickCultivate && (
              <div className="space-y-2.5 rounded-xl bg-emerald-500/[0.06] p-3 ring-1 ring-inset ring-emerald-400/22">
                <button
                  type="button"
                  onClick={() => setQuickTrainOpen((v) => !v)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span className="text-xs font-semibold text-emerald-100">
                      Chế độ Tu luyện nhanh
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formattedClock && (
                      <span className="text-[11px] text-amber-200/90 tabular-nums">
                        {formattedClock.shortDateTime}
                      </span>
                    )}
                    {quickTrainOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {quickTrainOpen && (
                  <>
                    <div className="text-[11px] leading-relaxed text-slate-300">
                      Chuyên tu:{' '}
                      <span className="font-medium text-slate-100">
                        {activeTrainingNames.length > 0
                          ? activeTrainingNames.join(', ')
                          : 'Tự tăng tu vi cơ bản'}
                      </span>
                      {' · '}Tự tịnh tiến đồng hồ truyện, cộng{' '}
                      {profile.energyLabel.split('/')[0].trim()} &amp; thuần thục
                      công pháp/chiêu thức.
                    </div>

                    {/* Quick Duration Presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { hours: 1, label: '1 giờ', sub: '+60 phút' },
                          { hours: 4, label: '4 giờ', sub: '1 buổi' },
                          { hours: 8, label: '8 giờ', sub: '1 đêm' },
                        ] as const
                      ).map((preset) => {
                        const previewClock = normalizedClock
                          ? formatStoryClock(
                              addMinutesToClock(
                                normalizedClock,
                                preset.hours * 60,
                              ),
                            ).timeStr
                          : null;
                        return (
                          <button
                            key={preset.hours}
                            type="button"
                            onClick={() =>
                              handleRunQuickCultivate(
                                preset.hours,
                                preset.hours === 8
                                  ? '8 giờ (1 đêm)'
                                  : preset.label,
                              )
                            }
                            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl bg-[#111c2e]/90 px-2 py-1.5 text-center ring-1 ring-inset ring-emerald-400/24 transition-all hover:bg-emerald-500/18 active:scale-[0.98]"
                          >
                            <span className="text-xs font-semibold text-emerald-100 tabular-nums">
                              {preset.label}
                            </span>
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {previewClock ? `→ ${previewClock}` : preset.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Hours Input */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#162032] px-2.5">
                        <span className="shrink-0 text-[11px] text-slate-400">
                          Tùy chỉnh:
                        </span>
                        <input
                          type="number"
                          min={0.5}
                          max={240}
                          step={0.5}
                          value={customTrainHours}
                          onChange={(e) => setCustomTrainHours(e.target.value)}
                          aria-label="Số giờ tu luyện tùy chỉnh"
                          className="min-h-[36px] w-full bg-transparent text-xs font-semibold text-slate-100 tabular-nums focus:outline-none"
                        />
                        <span className="shrink-0 text-[11px] text-slate-400">
                          giờ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRunQuickCultivate(parseFloat(customTrainHours))
                        }
                        className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-[0.985] whitespace-nowrap"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>Tu luyện</span>
                      </button>
                    </div>

                    {/* Result summary after Quick Cultivation */}
                    {lastQuickResult && (
                      <div className="space-y-1 rounded-lg bg-[#0c1524]/90 px-2.5 py-2 text-[11px] ring-1 ring-inset ring-white/[0.07]">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-emerald-200">
                          <span className="font-semibold tabular-nums">
                            +{lastQuickResult.expGained}{' '}
                            {profile.energyLabel.split('/')[0].trim()} (
                            {lastQuickResult.deltaLabel})
                          </span>
                          <span className="text-amber-200/90 tabular-nums">
                            {lastQuickResult.clockBeforeLabel} →{' '}
                            {lastQuickResult.clockAfterLabel}
                          </span>
                        </div>
                        {lastQuickResult.leveledTechniques.length > 0 && (
                          <div className="text-sky-200">
                            Công pháp thăng tầng:{' '}
                            {lastQuickResult.leveledTechniques.join(', ')}
                          </div>
                        )}
                        {lastQuickResult.leveledMoves.length > 0 && (
                          <div className="text-indigo-200">
                            Chiêu thức tiến cảnh:{' '}
                            {lastQuickResult.leveledMoves.join(', ')}
                          </div>
                        )}
                        {lastQuickResult.readyToBreakthrough && (
                          <div className="font-semibold text-amber-300">
                            Đã đạt mốc sẵn sàng đột phá cảnh giới!
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Latest clock gain summary */}
            {profile.lastGainSummary && (
              <div className="border-t border-white/[0.06] pt-2 text-[11px] text-emerald-200/90">
                Gần nhất: {profile.lastGainSummary}
              </div>
            )}

            {/* Quick EXP & Auto-Clock Switch */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={profile.autoProgressByClock}
                onClick={() =>
                  onUpdateProfile((prev) => ({
                    ...prev,
                    autoProgressByClock: !prev.autoProgressByClock,
                  }))
                }
                className={`inline-flex min-h-[34px] items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                  profile.autoProgressByClock
                    ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/22'
                    : 'bg-white/[0.045] text-slate-400 ring-white/[0.08] hover:text-slate-200'
                }`}
              >
                <span>Tự tăng theo đồng hồ: {profile.autoProgressByClock ? 'Bật' : 'Tắt'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAddExp(15)}
                  className="min-h-[34px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] tabular-nums whitespace-nowrap"
                >
                  +15 EXP
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddExp(50)}
                  className="min-h-[34px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] tabular-nums whitespace-nowrap"
                >
                  +50 EXP
                </button>
              </div>
            </div>

            {/* Inline Manual Realm Editor */}
            {editingRealm && (
              <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Hệ thống thể loại
                    </span>
                    <select
                      value={draftSystemKind}
                      onChange={(e) => {
                        const nextKind = e.target.value as CultivationSystemKind;
                        const nextM = CULTIVATION_SYSTEM_META[nextKind];
                        const safeI = Math.min(
                          draftRealmIndex,
                          nextM.realms.length - 1,
                        );
                        setDraftSystemKind(nextKind);
                        setDraftRealmIndex(safeI);
                        setDraftRealmName(nextM.realms[safeI].name);
                        setDraftMaxExp(String(nextM.realms[safeI].maxExp));
                        setDraftBagName(nextM.bagName);
                      }}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    >
                      <option value="xianxia">Tiên Hiệp (Tu Tiên)</option>
                      <option value="xuanhuan">Huyền Huyễn (Huyền Khí)</option>
                      <option value="wuxia">Kiếm Hiệp (Võ Học)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Chọn mốc cảnh giới chuẩn
                    </span>
                    <select
                      value={draftRealmIndex}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10) || 0;
                        const st =
                          CULTIVATION_SYSTEM_META[draftSystemKind].realms[idx];
                        setDraftRealmIndex(idx);
                        if (st) {
                          setDraftRealmName(st.name);
                          setDraftMaxExp(String(st.maxExp));
                        }
                      }}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    >
                      {CULTIVATION_SYSTEM_META[draftSystemKind].realms.map(
                        (r, i) => (
                          <option key={r.name} value={i}>
                            {i + 1}. {r.name} (mốc {r.maxExp})
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="space-y-1 sm:col-span-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Tên cảnh giới hiển thị
                    </span>
                    <input
                      type="text"
                      value={draftRealmName}
                      onChange={(e) => setDraftRealmName(e.target.value)}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      EXP hiện tại
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draftExp}
                      onChange={(e) => setDraftExp(e.target.value)}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Mốc đột phá
                    </span>
                    <input
                      type="number"
                      min={10}
                      value={draftMaxExp}
                      onChange={(e) => setDraftMaxExp(e.target.value)}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Tên túi đồ / hành trang
                  </span>
                  <input
                    type="text"
                    value={draftBagName}
                    onChange={(e) => setDraftBagName(e.target.value)}
                    placeholder="VD: Túi trữ vật, Nhẫn không gian, Hành trang giang hồ..."
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRealm(false)}
                    className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRealmEdit}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Lưu cảnh giới</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TECHNIQUES / MARTIAL ARTS */}
      {activeTab === 'techniques' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              {meta.techniqueSectionLabel} · Bộ đang tu luyện tự tăng thuần thục
              theo đồng hồ
            </span>
            <button
              type="button"
              onClick={openNewTechniqueForm}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/18 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm công pháp</span>
            </button>
          </div>

          {techFormOpen && (
            <div className="space-y-2.5 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-sky-400/30">
              <div className="text-xs font-semibold text-sky-200">
                {editingTechId ? 'Sửa công pháp / võ công' : 'Thêm công pháp mới'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="Tên công pháp / kiếm pháp / tâm pháp..."
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                />
                <select
                  value={techCategory}
                  onChange={(e) =>
                    setTechCategory(e.target.value as TechniqueCategory)
                  }
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                >
                  {(
                    Object.keys(meta.categoryLabels) as TechniqueCategory[]
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {meta.categoryLabels[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select
                  value={techTier}
                  onChange={(e) => setTechTier(e.target.value as TechniqueTier)}
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                >
                  {TIER_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TECHNIQUE_TIER_META[t].label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={techLevel}
                  onChange={(e) => setTechLevel(e.target.value)}
                  placeholder="Tầng"
                  aria-label="Tầng hiện tại"
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                />
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={techMaxLevel}
                  onChange={(e) => setTechMaxLevel(e.target.value)}
                  placeholder="Tối đa"
                  aria-label="Tầng tối đa"
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={techMastery}
                  onChange={(e) => setTechMastery(e.target.value)}
                  placeholder="% Thuần thục"
                  aria-label="Độ thuần thục phần trăm"
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={techDesc}
                onChange={(e) => setTechDesc(e.target.value)}
                placeholder="Mô tả ngắn hiệu quả / đặc điểm (tùy chọn)..."
                className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTechActiveTraining((v) => !v)}
                    className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset ${
                      techActiveTraining
                        ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/35'
                        : 'bg-white/[0.05] text-slate-400 ring-white/[0.08]'
                    }`}
                  >
                    Đang chuyên tu: {techActiveTraining ? 'Có' : 'Không'}
                  </button>
                  {!editingTechId && (
                    <button
                      type="button"
                      onClick={() => setTechAutoGenerateMoves((v) => !v)}
                      className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset ${
                        techAutoGenerateMoves
                          ? 'bg-sky-500/16 text-sky-200 ring-sky-400/35'
                          : 'bg-white/[0.05] text-slate-400 ring-white/[0.08]'
                      }`}
                    >
                      Tự sinh 4–5 chiêu: {techAutoGenerateMoves ? 'Bật' : 'Tắt'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTechFormOpen(false);
                      setEditingTechId(null);
                    }}
                    className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTechnique}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Lưu</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {profile.techniques.length === 0 ? (
            <div className="rounded-xl bg-[#0e1625]/60 px-3.5 py-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
              Chưa có công pháp hoặc võ công nào. Bấm &quot;Thêm công pháp&quot;
              để bổ sung.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-[#0e1625]/70 ring-1 ring-inset ring-white/[0.07]">
              {profile.techniques.map((tech) => {
                const tierInfo =
                  TECHNIQUE_TIER_META[tech.tier] || TECHNIQUE_TIER_META.pham;
                const catLabel =
                  meta.categoryLabels[tech.category] || 'Công pháp';
                const moves = tech.moves || [];
                const movesExpanded = Boolean(expandedMovesTechIds[tech.id]);
                return (
                  <div key={tech.id} className="space-y-2 px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-100">
                            {tech.name}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${tierInfo.textClass}`}
                          >
                            {tierInfo.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                          {catLabel} · Tầng {tech.level}/{tech.maxLevel} · Thuần
                          thục {tech.mastery}% · {moves.length} chiêu thức
                        </div>
                        {tech.description && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                            {tech.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTechniqueForm(tech)}
                          aria-label={`Sửa ${tech.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.11] hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTechnique(tech.id)}
                          aria-label={`Xóa ${tech.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          tech.isActiveTraining
                            ? 'bg-emerald-400'
                            : 'bg-sky-400/80'
                        }`}
                        style={{ width: `${Math.min(100, tech.mastery)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleTechniqueTraining(tech.id)}
                          className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                            tech.isActiveTraining
                              ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/32 hover:bg-emerald-500/24'
                              : 'bg-white/[0.045] text-slate-400 ring-white/[0.08] hover:text-slate-200'
                          }`}
                        >
                          {tech.isActiveTraining
                            ? 'Đang chuyên tu'
                            : 'Đặt làm chuyên tu'}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleMovesExpand(tech.id)}
                          className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap tabular-nums ${
                            movesExpanded
                              ? 'bg-indigo-500/18 text-indigo-100 ring-indigo-400/35'
                              : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10]'
                          }`}
                        >
                          <Swords className="h-3 w-3 text-indigo-300" />
                          <span>Chiêu thức ({moves.length})</span>
                          {movesExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBumpTechniqueMastery(tech.id, 10)}
                        className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] tabular-nums whitespace-nowrap"
                      >
                        +10% thuần thục
                      </button>
                    </div>

                    {/* Collapsible Moves (Chiêu thức) List */}
                    {movesExpanded && (
                      <div className="mt-1 space-y-2 rounded-xl bg-[#131e31]/85 p-2.5 ring-1 ring-inset ring-indigo-400/18">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[11px] font-semibold text-indigo-200">
                            Chiêu thức trong bí kíp ({moves.length})
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleGenerateMovesForTech(tech)}
                              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-indigo-500/16 px-2 text-[11px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/30 hover:bg-indigo-500/24 whitespace-nowrap"
                            >
                              <Wand2 className="h-3 w-3" />
                              <span>Gợi ý 4–5 chiêu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openNewMoveForm(tech.id)}
                              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/16 px-2 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24 whitespace-nowrap"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Thêm chiêu</span>
                            </button>
                          </div>
                        </div>

                        {/* Add / Edit Move Form */}
                        {moveFormTechId === tech.id && (
                          <div className="space-y-2 rounded-lg bg-[#0d1626] p-2.5 ring-1 ring-inset ring-sky-400/28">
                            <div className="text-[11px] font-semibold text-sky-200">
                              {editingMoveId
                                ? 'Sửa chiêu thức'
                                : 'Thêm chiêu thức mới'}
                            </div>
                            <input
                              type="text"
                              value={moveName}
                              onChange={(e) => setMoveName(e.target.value)}
                              placeholder="Tên chiêu thức (VD: Thanh Phong Phất Liễu)..."
                              className="min-h-[36px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={moveDesc}
                              onChange={(e) => setMoveDesc(e.target.value)}
                              placeholder="Hiệu ứng / động tác ngắn (tùy chọn)..."
                              className="min-h-[36px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                            />
                            <div className="grid grid-cols-3 gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={moveLevel}
                                onChange={(e) => setMoveLevel(e.target.value)}
                                placeholder="Cấp"
                                aria-label="Cấp chiêu thức"
                                className="min-h-[34px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                              />
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={moveMaxLevel}
                                onChange={(e) => setMoveMaxLevel(e.target.value)}
                                placeholder="Cấp tối đa"
                                aria-label="Cấp tối đa chiêu thức"
                                className="min-h-[34px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                              />
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={moveMastery}
                                onChange={(e) => setMoveMastery(e.target.value)}
                                placeholder="% Thuần thục"
                                aria-label="Phần trăm thuần thục chiêu thức"
                                className="min-h-[34px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                              />
                            </div>
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setMoveFormTechId(null);
                                  setEditingMoveId(null);
                                }}
                                className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveMove(tech.id)}
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                              >
                                <Check className="h-3 w-3" />
                                <span>Lưu chiêu</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {moves.length === 0 ? (
                          <div className="rounded-lg bg-[#0d1626]/70 px-3 py-2.5 text-center text-[11px] text-slate-400">
                            Chưa có chiêu thức nào. Bấm &quot;Gợi ý 4–5 chiêu&quot;
                            hoặc &quot;Thêm chiêu&quot; để khởi tạo.
                          </div>
                        ) : (
                          <div className="divide-y divide-white/[0.05] overflow-hidden rounded-lg bg-[#0d1626]/80 ring-1 ring-inset ring-white/[0.06]">
                            {moves.map((mv, mvIdx) => (
                              <div
                                key={mv.id}
                                className="space-y-1.5 px-2.5 py-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                      <span className="text-xs font-semibold text-slate-100">
                                        {mvIdx + 1}. {mv.name}
                                      </span>
                                      <span className="text-[11px] font-medium text-indigo-300 tabular-nums">
                                        Cấp {mv.level}/{mv.maxLevel} · {mv.mastery}%
                                      </span>
                                    </div>
                                    {mv.description && (
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                                        {mv.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleBumpSingleMove(tech.id, mv.id, 15)
                                      }
                                      className="min-h-[26px] rounded-md bg-white/[0.055] px-1.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-white/[0.08] hover:bg-emerald-500/20 tabular-nums whitespace-nowrap"
                                    >
                                      +15%
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditMoveForm(tech.id, mv)
                                      }
                                      aria-label={`Sửa chiêu ${mv.name}`}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-slate-300 hover:bg-white/[0.11] hover:text-white"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteMove(tech.id, mv.id)
                                      }
                                      aria-label={`Xóa chiêu ${mv.name}`}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                                  <div
                                    className="h-full rounded-full bg-indigo-400/85 transition-all duration-300"
                                    style={{
                                      width: `${Math.min(100, mv.mastery)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INVENTORY / BAG */}
      {activeTab === 'inventory' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              {profile.bagName} · Thêm, sửa, dùng hoặc nhặt từ diễn biến truyện
            </span>
            <button
              type="button"
              onClick={openNewItemForm}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/18 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm vật phẩm</span>
            </button>
          </div>

          {/* Detected loot suggestions from current story page */}
          {lootSuggestions.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-emerald-500/[0.08] p-2.5 ring-1 ring-inset ring-emerald-400/25">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>Phát hiện vật phẩm ở trang hiện tại — chạm để nhặt</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lootSuggestions.map((loot) => (
                  <button
                    key={loot.name}
                    type="button"
                    onClick={() => handlePickLootSuggestion(loot)}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/25"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{loot.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {itemFormOpen && (
            <div className="space-y-2.5 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-sky-400/30">
              <div className="text-xs font-semibold text-sky-200">
                {editingItemId
                  ? 'Chỉnh sửa vật phẩm'
                  : `Thêm vào ${profile.bagName}`}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Tên vật phẩm (VD: Trúc Cơ Đan, Linh thạch...)"
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none sm:col-span-2"
                />
                <input
                  type="number"
                  min={1}
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  placeholder="Số lượng"
                  aria-label="Số lượng"
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={itemQuality}
                  onChange={(e) =>
                    setItemQuality(e.target.value as InventoryItemQuality)
                  }
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                >
                  {QUALITY_ORDER.map((q) => (
                    <option key={q} value={q}>
                      {INVENTORY_QUALITY_META[q].label}
                    </option>
                  ))}
                </select>
                <select
                  value={itemCategory}
                  onChange={(e) =>
                    setItemCategory(e.target.value as InventoryItemCategory)
                  }
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {INVENTORY_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="Công dụng / mô tả ngắn (tùy chọn)..."
                className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setItemFormOpen(false);
                    setEditingItemId(null);
                  }}
                  className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu vật phẩm</span>
                </button>
              </div>
            </div>
          )}

          {profile.inventory.length === 0 ? (
            <div className="rounded-xl bg-[#0e1625]/60 px-3.5 py-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
              {profile.bagName} đang trống. Bấm &quot;Thêm vật phẩm&quot; để bổ
              sung.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-[#0e1625]/70 ring-1 ring-inset ring-white/[0.07]">
              {profile.inventory.map((item) => {
                const qInfo =
                  INVENTORY_QUALITY_META[item.quality] ||
                  INVENTORY_QUALITY_META.common;
                return (
                  <div key={item.id} className="space-y-2 px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-100">
                            {item.name}
                          </span>
                          <span className="text-xs font-bold text-amber-200 tabular-nums">
                            x{item.quantity}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${qInfo.textClass}`}
                          >
                            {qInfo.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {INVENTORY_CATEGORY_LABELS[item.category] || 'Vật phẩm'}
                        </div>
                        {item.description && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditItemForm(item)}
                          aria-label={`Sửa ${item.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.11] hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          aria-label={`Xóa ${item.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseItem(item.id)}
                        className="min-h-[30px] rounded-lg bg-amber-500/14 px-2.5 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 hover:bg-amber-500/24 whitespace-nowrap"
                      >
                        Dùng (-1)
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Giảm số lượng ${item.name}`}
                          onClick={() => handleAdjustItemQty(item.id, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Tăng số lượng ${item.name}`}
                          onClick={() => handleAdjustItemQty(item.id, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
