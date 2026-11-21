import type {
  ArkState,
  CharacterPortrait,
  CharacterStateSnapshot,
  CompanionProfile,
  MemoryEntry,
  MemoryManagerConfig,
  PortraitBankConfig,
  PresetGroupId,
  PresetModule,
  SafetySetting,
  StoryClockState,
  StoryImageConfig,
  TawaPreset,
  Turn,
} from '../types/ark';
import {
  cleanJunkPortraitsFromBank,
  normalizeCharacterKey,
  resolveLocalVividNpcProfile,
} from './characterUtils';
import {
  createDefaultStoryClock,
  normalizeStoryClock,
} from './storyClock';
import { normalizeCultivationProfile } from './cultivation';
import { normalizeStoryImageConfig } from './imageStyles';
import {
  clampPageIndex,
  ensureUniqueTurnIds,
  resolveActiveStoryCompanionKey,
} from './turnSync';

export const STORAGE_KEY = 'ARK_LITE_AI_STUDIO_V1';

export const DEFAULT_SAFETY: SafetySetting[] = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

export const DEFAULT_PREFILL = '<thinking>1. [SYSTEM BOOT & RESOURCE LOADING]';

export const DEFAULT_STORY_IMAGE_CONFIG: StoryImageConfig = {
  enabled: false,
  autoGenerate: false,
  targetMode: 'scene',
  selectedNpcId: '',
  customSubject: '',
  stylePreset: 'live_action_cinema',
  size: '',
  cameraAngle: 'auto',
  customStyles: [],
  sampleImages: {},
  promptTemplate: '',
  imageCount: 1,
  imageGridMode: 'single',
  imageGenerationMode: 'scene',
};

export function createDefaultMemoryConfig(
  overrides?: Partial<
    Pick<
      MemoryManagerConfig,
      | 'enabled'
      | 'autoMemory'
      | 'autoStateTracker'
      | 'autoRollingSummary'
      | 'storyClock'
      | 'cultivation'
    >
  >,
): MemoryManagerConfig {
  const normalizedCultivation = overrides?.cultivation
    ? normalizeCultivationProfile(overrides.cultivation)
    : undefined;
  return {
    enabled: overrides?.enabled ?? true,
    autoMemory: overrides?.autoMemory ?? false,
    autoStateTracker: overrides?.autoStateTracker ?? false,
    autoRollingSummary: overrides?.autoRollingSummary ?? false,
    entries: [],
    characterStates: [],
    rollingSummary: {
      content: '',
      summarizedUpToTurn: 0,
      updatedAt: 0,
    },
    storyClock: overrides?.storyClock
      ? normalizeStoryClock(overrides.storyClock)
      : createDefaultStoryClock(),
    ...(normalizedCultivation ? { cultivation: normalizedCultivation } : {}),
  };
}

export function normalizeMemoryConfig(raw: unknown): MemoryManagerConfig {
  const base = createDefaultMemoryConfig();
  if (!raw || typeof raw !== 'object') return base;
  const rec = raw as Record<string, unknown>;
  const validCategories = new Set(['event', 'relationship', 'timeline', 'detail']);

  const entries: MemoryEntry[] = Array.isArray(rec.entries)
    ? rec.entries
        .filter((e) => e && typeof e === 'object')
        .map((e, idx) => {
          const item = e as Record<string, unknown>;
          const cat = String(item.category || 'event');
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `mem_${Date.now()}_${idx}`,
            title: String(item.title || 'Ký ức').trim(),
            content: String(item.content || '').trim(),
            category: (validCategories.has(cat)
              ? cat
              : 'event') as MemoryEntry['category'],
            ...(typeof item.turnIndex === 'number' &&
            Number.isFinite(item.turnIndex)
              ? { turnIndex: item.turnIndex }
              : {}),
            pinned: Boolean(item.pinned),
            updatedAt:
              typeof item.updatedAt === 'number' &&
              Number.isFinite(item.updatedAt)
                ? item.updatedAt
                : Date.now(),
          };
        })
        .filter((e) => e.title || e.content)
    : [];

  const characterStates: CharacterStateSnapshot[] = Array.isArray(
    rec.characterStates,
  )
    ? rec.characterStates
        .filter((s) => s && typeof s === 'object')
        .map((s, idx) => {
          const item = s as Record<string, unknown>;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `st_${Date.now()}_${idx}`,
            name: String(item.name || 'Nhân vật').trim(),
            isMc: Boolean(item.isMc),
            location: String(item.location || '').trim(),
            mood: String(item.mood || '').trim(),
            status: String(item.status || '').trim(),
            ...(typeof item.lastTurnIndex === 'number' &&
            Number.isFinite(item.lastTurnIndex)
              ? { lastTurnIndex: item.lastTurnIndex }
              : {}),
            updatedAt:
              typeof item.updatedAt === 'number' &&
              Number.isFinite(item.updatedAt)
                ? item.updatedAt
                : Date.now(),
          };
        })
        .filter((s) => s.name)
    : [];

  const rsRaw =
    rec.rollingSummary && typeof rec.rollingSummary === 'object'
      ? (rec.rollingSummary as Record<string, unknown>)
      : null;

  return {
    enabled: typeof rec.enabled === 'boolean' ? rec.enabled : base.enabled,
    autoMemory:
      typeof rec.autoMemory === 'boolean' ? rec.autoMemory : base.autoMemory,
    autoStateTracker:
      typeof rec.autoStateTracker === 'boolean'
        ? rec.autoStateTracker
        : base.autoStateTracker,
    autoRollingSummary:
      typeof rec.autoRollingSummary === 'boolean'
        ? rec.autoRollingSummary
        : base.autoRollingSummary,
    entries,
    characterStates,
    rollingSummary: {
      content: rsRaw ? String(rsRaw.content || '') : '',
      summarizedUpToTurn:
        rsRaw &&
        typeof rsRaw.summarizedUpToTurn === 'number' &&
        Number.isFinite(rsRaw.summarizedUpToTurn)
          ? Math.max(0, Math.floor(rsRaw.summarizedUpToTurn))
          : 0,
      updatedAt:
        rsRaw &&
        typeof rsRaw.updatedAt === 'number' &&
        Number.isFinite(rsRaw.updatedAt)
          ? rsRaw.updatedAt
          : 0,
    },
    storyClock: normalizeStoryClock(rec.storyClock),
    ...(rec.cultivation
      ? { cultivation: normalizeCultivationProfile(rec.cultivation) }
      : {}),
  };
}

export function createDefaultPortraitBank(
  overrides?: Partial<
    Pick<
      PortraitBankConfig,
      'autoGenerateOnAppear' | 'maxAutoPerTurn' | 'includeMcAuto'
    >
  >,
): PortraitBankConfig {
  return {
    autoGenerateOnAppear: overrides?.autoGenerateOnAppear ?? false,
    maxAutoPerTurn:
      typeof overrides?.maxAutoPerTurn === 'number' &&
      overrides.maxAutoPerTurn >= 1 &&
      overrides.maxAutoPerTurn <= 3
        ? Math.floor(overrides.maxAutoPerTurn)
        : 1,
    includeMcAuto: overrides?.includeMcAuto ?? false,
    portraits: [],
  };
}

export function normalizePortraitBank(raw: unknown): PortraitBankConfig {
  const base = createDefaultPortraitBank();
  if (!raw || typeof raw !== 'object') return base;
  const rec = raw as Record<string, unknown>;

  const portraits: CharacterPortrait[] = Array.isArray(rec.portraits)
    ? rec.portraits
        .filter((p) => p && typeof p === 'object')
        .map((p, idx) => {
          const item = p as Record<string, unknown>;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `port_${Date.now()}_${idx}`,
            name: String(item.name || '').trim(),
            role: String(item.role || '').trim(),
            ...(typeof item.age === 'string' && item.age.trim()
              ? { age: item.age.trim() }
              : {}),
            ...(typeof item.birthday === 'string' && item.birthday.trim()
              ? { birthday: item.birthday.trim() }
              : {}),
            ...(typeof item.fashionStyle === 'string' && item.fashionStyle.trim()
              ? { fashionStyle: item.fashionStyle.trim() }
              : {}),
            appearance: String(item.appearance || '').trim(),
            ...(typeof item.personality === 'string' && item.personality.trim()
              ? { personality: item.personality.trim() }
              : {}),
            ...(typeof item.relationships === 'string' &&
            item.relationships.trim()
              ? { relationships: item.relationships.trim() }
              : {}),
            ...(typeof item.signature === 'string' && item.signature.trim()
              ? { signature: item.signature.trim() }
              : {}),
            ...(typeof item.appearanceManual === 'boolean'
              ? { appearanceManual: item.appearanceManual }
              : {}),
            ...(typeof item.profileManual === 'boolean'
              ? { profileManual: item.profileManual }
              : {}),
            isMc: Boolean(item.isMc),
            ...(typeof item.npcId === 'string' && item.npcId
              ? { npcId: item.npcId }
              : {}),
            ...(typeof item.imageData === 'string' && item.imageData
              ? { imageData: item.imageData }
              : {}),
            ...(typeof item.prompt === 'string' && item.prompt
              ? { prompt: item.prompt }
              : {}),
            ...(typeof item.lastSeenTurnIndex === 'number' &&
            Number.isFinite(item.lastSeenTurnIndex)
              ? { lastSeenTurnIndex: item.lastSeenTurnIndex }
              : {}),
            ...(typeof item.autoGenerated === 'boolean'
              ? { autoGenerated: item.autoGenerated }
              : {}),
            updatedAt:
              typeof item.updatedAt === 'number' &&
              Number.isFinite(item.updatedAt)
                ? item.updatedAt
                : Date.now(),
          };
        })
        .filter((p) => p.name)
    : [];

  const maxAutoRaw =
    typeof rec.maxAutoPerTurn === 'number' &&
    Number.isFinite(rec.maxAutoPerTurn)
      ? Math.min(3, Math.max(1, Math.floor(rec.maxAutoPerTurn)))
      : base.maxAutoPerTurn;

  return {
    autoGenerateOnAppear:
      typeof rec.autoGenerateOnAppear === 'boolean'
        ? rec.autoGenerateOnAppear
        : base.autoGenerateOnAppear,
    maxAutoPerTurn: maxAutoRaw,
    includeMcAuto:
      typeof rec.includeMcAuto === 'boolean'
        ? rec.includeMcAuto
        : base.includeMcAuto,
    portraits,
  };
}

export function syncPortraitBankWithCompanion(
  bank: PortraitBankConfig | undefined,
  comp: CompanionProfile | undefined,
  fallbackMcName?: string,
  storyClock?: StoryClockState,
  forceSyncNpcIds?: Set<string>,
): PortraitBankConfig {
  const safeBank = normalizePortraitBank(bank);
  const { bank: cleanedBank } = cleanJunkPortraitsFromBank(
    safeBank,
    comp,
    fallbackMcName,
  );
  if (!comp) return cleanedBank;

  const list = cleanedBank.portraits.map((p) => ({ ...p }));
  const nowTs = Date.now();

  // 1. Sync MC entry
  const mcName = (comp.mc?.name || fallbackMcName || '').trim();
  const mcAge = comp.mc?.age?.trim()
    ? /^\d+$/.test(comp.mc.age.trim())
      ? `${comp.mc.age.trim()} tuổi`
      : comp.mc.age.trim()
    : '';
  const mcAppearanceParts = [
    comp.mc?.gender ? comp.mc.gender : '',
    mcAge,
    comp.mc?.appearance ? comp.mc.appearance.trim() : '',
    comp.mc?.personality ? `Khí chất: ${comp.mc.personality.trim()}` : '',
  ].filter(Boolean);
  const mcAppearance = mcAppearanceParts.join(', ');
  const mcRole =
    comp.mc?.originRole?.trim() ||
    (comp.mc?.roleType === 'powerhouse'
      ? 'Đại năng / Cường giả'
      : comp.mc?.roleType === 'transmigrator'
        ? 'Người xuyên không'
        : 'Nhân vật chính');

  if (mcName || mcAppearance) {
    const mcIdx = list.findIndex((p) => p.isMc);
    const resolvedMc = resolveLocalVividNpcProfile({
      name: mcName || 'Nhân vật chính',
      isMc: true,
      comp,
      storyClock,
    });
    const bestMcAge = mcAge || resolvedMc.age;
    const bestMcBirthday = resolvedMc.birthday;
    const bestMcFashion = resolvedMc.fashionStyle;
    const bestMcAppearance = mcAppearance || resolvedMc.appearance;
    const bestMcPersonality =
      comp.mc?.personality?.trim() || resolvedMc.personality;
    const bestMcRelationships =
      comp.mc?.canonMcRelation?.trim() || resolvedMc.relationships;
    if (mcIdx >= 0) {
      const curMc = list[mcIdx];
      list[mcIdx] = {
        ...curMc,
        name: mcName || curMc.name || 'Nhân vật chính',
        role: curMc.role || mcRole,
        age: curMc.profileManual
          ? curMc.age
          : curMc.age || bestMcAge || undefined,
        birthday: curMc.profileManual
          ? curMc.birthday
          : curMc.birthday || bestMcBirthday || undefined,
        fashionStyle: curMc.profileManual
          ? curMc.fashionStyle
          : curMc.fashionStyle || bestMcFashion || undefined,
        appearance: curMc.appearanceManual
          ? curMc.appearance
          : curMc.appearance || bestMcAppearance,
        personality: curMc.profileManual
          ? curMc.personality
          : curMc.personality || bestMcPersonality || undefined,
        relationships: curMc.profileManual
          ? curMc.relationships
          : curMc.relationships || bestMcRelationships || undefined,
      };
    } else {
      list.unshift({
        id: `port_mc_${comp.id || 'main'}`,
        name: mcName || 'Nhân vật chính',
        role: mcRole,
        ...(bestMcAge ? { age: bestMcAge } : {}),
        ...(bestMcBirthday ? { birthday: bestMcBirthday } : {}),
        ...(bestMcFashion ? { fashionStyle: bestMcFashion } : {}),
        appearance: bestMcAppearance,
        ...(bestMcPersonality ? { personality: bestMcPersonality } : {}),
        ...(bestMcRelationships ? { relationships: bestMcRelationships } : {}),
        isMc: true,
        updatedAt: nowTs,
      });
    }
  }

  // 2. Sync NPCs from active companion profile
  for (let i = 0; i < (comp.npcs || []).length; i++) {
    const npc = comp.npcs[i];
    const name = (npc.name || '').trim();
    if (!name) continue;
    const key = normalizeCharacterKey(name);
    const resolvedNpc = resolveLocalVividNpcProfile({
      name,
      isMc: false,
      comp,
      storyClock,
    });
    const bestNpcAge = npc.age?.trim() || resolvedNpc.age;
    const bestNpcBirthday = npc.birthday?.trim() || resolvedNpc.birthday;
    const bestNpcFashion = npc.fashionStyle?.trim() || resolvedNpc.fashionStyle;
    const bestNpcAppearance =
      npc.appearance?.trim() || npc.desc?.trim() || resolvedNpc.appearance;
    const bestNpcRole = npc.role?.trim() || resolvedNpc.role || 'NPC đồng nhân';
    const bestNpcPersonality =
      npc.personality?.trim() || resolvedNpc.personality;
    const bestNpcRelationships =
      npc.relationships?.trim() || resolvedNpc.relationships;
    const bestNpcSignature = npc.signature?.trim() || resolvedNpc.signature;
    const existingIdx = list.findIndex(
      (p) =>
        (npc.id && p.npcId === npc.id) ||
        (!p.isMc && normalizeCharacterKey(p.name) === key),
    );
    const forceOverwriteFromNpc = Boolean(
      forceSyncNpcIds && npc.id && forceSyncNpcIds.has(npc.id),
    );
    if (existingIdx >= 0) {
      const cur = list[existingIdx];
      if (forceOverwriteFromNpc) {
        list[existingIdx] = {
          ...cur,
          npcId: npc.id || cur.npcId,
          name,
          role: npc.role?.trim() || cur.role || bestNpcRole,
          age: npc.age?.trim() || undefined,
          birthday: npc.birthday?.trim() || undefined,
          fashionStyle: npc.fashionStyle?.trim() || undefined,
          appearance: npc.appearance?.trim() ?? cur.appearance,
          personality: npc.personality?.trim() || undefined,
          relationships: npc.relationships?.trim() || undefined,
          signature: npc.signature?.trim() || undefined,
          appearanceManual: Boolean(npc.appearance?.trim()),
          profileManual: Boolean(npc.profileManual),
          updatedAt: nowTs + i,
        };
      } else {
        list[existingIdx] = {
          ...cur,
          npcId: npc.id || cur.npcId,
          name,
          role: cur.role || bestNpcRole,
          age: cur.profileManual
            ? cur.age
            : cur.age || bestNpcAge || undefined,
          birthday: cur.profileManual
            ? cur.birthday
            : cur.birthday || bestNpcBirthday || undefined,
          fashionStyle: cur.profileManual
            ? cur.fashionStyle
            : cur.fashionStyle || bestNpcFashion || undefined,
          appearance: cur.appearanceManual
            ? cur.appearance
            : cur.appearance || bestNpcAppearance,
          personality: cur.profileManual
            ? cur.personality
            : cur.personality || bestNpcPersonality || undefined,
          relationships: cur.profileManual
            ? cur.relationships
            : cur.relationships || bestNpcRelationships || undefined,
          signature: cur.profileManual
            ? cur.signature
            : cur.signature || bestNpcSignature || undefined,
        };
      }
    } else {
      list.push({
        id: `port_npc_${npc.id || `${nowTs}_${i}`}`,
        name,
        role: bestNpcRole,
        ...(bestNpcAge ? { age: bestNpcAge } : {}),
        ...(bestNpcBirthday ? { birthday: bestNpcBirthday } : {}),
        ...(bestNpcFashion ? { fashionStyle: bestNpcFashion } : {}),
        appearance: bestNpcAppearance,
        ...(bestNpcPersonality ? { personality: bestNpcPersonality } : {}),
        ...(bestNpcRelationships ? { relationships: bestNpcRelationships } : {}),
        ...(bestNpcSignature ? { signature: bestNpcSignature } : {}),
        ...(npc.profileManual ? { profileManual: true } : {}),
        isMc: false,
        npcId: npc.id,
        updatedAt: nowTs + i,
      });
    }
  }

  // 3. Auto-fill missing vivid fields for any other existing valid portraits (without overwriting manual edits)
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const missingAppearance = !p.appearanceManual && !p.appearance.trim();
    const missingVivid =
      !p.profileManual &&
      (!p.age?.trim() ||
        !p.birthday?.trim() ||
        !p.fashionStyle?.trim() ||
        !p.personality?.trim() ||
        !p.relationships?.trim() ||
        !p.signature?.trim());
    if (!missingAppearance && !missingVivid) continue;
    const resolved = resolveLocalVividNpcProfile({
      name: p.name,
      isMc: p.isMc,
      comp,
      storyClock,
    });
    const nextAge =
      !p.profileManual && !p.age?.trim() ? resolved.age || p.age : p.age;
    const nextBirthday =
      !p.profileManual && !p.birthday?.trim()
        ? resolved.birthday || p.birthday
        : p.birthday;
    const nextFashion =
      !p.profileManual && !p.fashionStyle?.trim()
        ? resolved.fashionStyle || p.fashionStyle
        : p.fashionStyle;
    const nextAppearance = missingAppearance
      ? resolved.appearance || p.appearance
      : p.appearance;
    const nextPersonality =
      !p.profileManual && !p.personality?.trim()
        ? resolved.personality || p.personality
        : p.personality;
    const nextRelationships =
      !p.profileManual && !p.relationships?.trim()
        ? resolved.relationships || p.relationships
        : p.relationships;
    const nextSignature =
      !p.profileManual && !p.signature?.trim()
        ? resolved.signature || p.signature
        : p.signature;
    if (
      nextAge !== p.age ||
      nextBirthday !== p.birthday ||
      nextFashion !== p.fashionStyle ||
      nextAppearance !== p.appearance ||
      nextPersonality !== p.personality ||
      nextRelationships !== p.relationships ||
      nextSignature !== p.signature ||
      (!p.role && resolved.role)
    ) {
      list[i] = {
        ...p,
        role: p.role || resolved.role || p.role,
        ...(nextAge ? { age: nextAge } : {}),
        ...(nextBirthday ? { birthday: nextBirthday } : {}),
        ...(nextFashion ? { fashionStyle: nextFashion } : {}),
        appearance: nextAppearance,
        ...(nextPersonality ? { personality: nextPersonality } : {}),
        ...(nextRelationships ? { relationships: nextRelationships } : {}),
        ...(nextSignature ? { signature: nextSignature } : {}),
      };
    }
  }

  return {
    ...cleanedBank,
    portraits: list,
  };
}

export const GROUNDED_INTIMACY_MODULE: PresetModule = {
  id: 'm_grounded_intimacy',
  name: 'Grounded Intimacy (Thân mật & Tiếp xúc chân thực)',
  enabled: true,
  content: `<grounded_intimacy>
Một cái chạm trong những mối quan hệ và hoàn cảnh khác nhau liệu có cho ra cùng một cảm giác không? Nhân vật còn có căng thẳng, đau đớn, lúng túng, và cũng có lúc thực sự động tình. Cuộc cách mạng văn học khi viết đến thân thể, điều đáng tranh đấu chính là những khác biệt cụ thể ấy, để cảm xúc và phản ứng đều khớp với con người trước mắt. Tiếp xúc thông thường, lại gần, chăm sóc, va chạm và đánh nhau trước hết phải dựa theo mối quan hệ, ý đồ, vị trí, lực độ và hoàn cảnh mà viết phản ứng bình thường; căng thẳng, đau đớn, ngại ngùng, giật mình không tự động diễn giải thành dục vọng, càng không vì chạm một cái mà toàn thân mất kiểm soát, ý thức rã rời hay đột ngột đòi hỏi. Mập mờ và thân mật hình thành từng bước từ mối quan hệ sẵn có, thiện ý đôi bên và tương tác liền mạch; khi đã có bối cảnh thân mật rõ ràng thì cho phép phản hồi tương xứng, biên độ chịu sự ràng buộc của trạng thái nhân vật và thiết lập. Phản ứng cơ thể không đồng nghĩa với đồng thuận, quyến luyến hay cam kết; thể chất đặc biệt được ghi rõ trong thẻ nhân vật vẫn xử lý theo điều kiện kích hoạt và giới hạn của nó, đừng khái quát hóa sang mọi tiếp xúc.
</grounded_intimacy>

Kiểm tra nhanh (Chống động dục tùy tiện): Khi liên quan đến tiếp xúc hoặc thân mật, xác định phản ứng lượt này thuộc tiếp xúc thông thường, đau đớn, căng thẳng hay tương tác thân mật đã có sẵn, giữ đúng cường độ mà bối cảnh nâng đỡ.`,
};

export const NARRATIVE_PERSON_MODULE: PresetModule = {
  id: 'm_narrative_person',
  name: 'Narrative Person (Ngôi thứ ba)',
  enabled: true,
  content: `<narrative_person>
Khi kể bằng tên hoặc anh ấy / cô ấy, độc giả vẫn cần biết mình đang nhìn theo ai, đang đứng ở đâu. Cuộc cách mạng văn học ở ngôi thứ ba cũng có thể dựa vào một vị trí quan sát rõ ràng để nhân vật và sự việc đều có chỗ đứng. Phần tự sự gọi User và các nhân vật khác bằng tên hoặc anh ấy / cô ấy, không dùng tôi / bạn thay thế, xưng hô trong đối thoại giữ bình thường. Tiếp nối trung tâm quan sát đã có, khi chuyển đổi phải nêu rõ nhân vật và vị trí. Tư liệu không tự động trở thành hiểu biết của nhân vật, tâm lý có công khai hay không tuân theo công tắc tiếng lòng.
</narrative_person>

Vị trí quan sát: Ngôi thứ ba. Xác định rõ tổ chức tự sự xoay quanh trải nghiệm hiện trường của ai, gọi người bằng tên hoặc anh ấy / cô ấy; xưng hô trong đối thoại giữ bình thường.
Quy chuẩn xác lập & chuyển giao góc nhìn tự nhiên: Không chèn các nhãn cứng thô như "Bắt đầu góc nhìn" hay "Kết thúc góc nhìn" làm ngắt mạch văn xuôi của truyện. Ở đầu lượt hoặc khi đổi nhân vật/vị trí quan sát, thể hiện tự nhiên ngay trong phần tự sự rằng đang theo sát trải nghiệm của ai và đang ở vị trí nào; giữ nhất quán góc nhìn đó cho đến khi có chuyển cảnh hoặc chuyển góc nhìn rõ ràng.`,
};

export const DIRECT_TERMS_MODULE: PresetModule = {
  id: 'm_direct_terms',
  name: 'Direct Terms (Từ ngữ trực diện)',
  enabled: true,
  content: `<direct_terms>
Nếu câu chữ cứ đi vòng vo tránh né thứ đang viết, độc giả sẽ nhìn rõ khoảnh khắc này hơn hay khó nhìn rõ hơn? Cuộc cách mạng văn học này cũng sẵn lòng thẳng thắn trong cách dùng từ, để tên gọi đón trúng chính xác nội dung đang viết, sự trực diện vẫn có chừng mực của nó trong bối cảnh. Khi viết đến cơ quan sinh dục của nữ và nam, dùng cách gọi thẳng thông dụng: dương vật, quy đầu, tinh hoàn, âm bộ, môi âm hộ, âm vật, âm đạo, bầu ngực, đầu vú, khe mông, hậu môn — hiện trường cần chạm đến chỗ nào viết chỗ đó, không dùng lời nói tránh thay thế.
Không được dùng các phép ví von, mỹ từ, đồng âm hay hoán dụ như đóa hoa, nhụy, mật, ngọc, châu, con trai, khe, hang, cự long, hung khí, trụ thể, chỗ sâu, vùng cấm, bé cưng để thay thế bản thân cơ quan, cũng không được dùng 'chỗ đó', 'nơi thầm kín' nói lướt mập mờ; hành vi tính dục cũng nói thẳng — khẩu giao, đưa vào, ra vào, xuất tinh, cao trào, khoái cảm viết đúng mặt chữ, không đi vòng vo.
Trực diện không có nghĩa là xếp tên cơ quan thành danh sách: tên gọi xuất hiện theo động tác, cảm nhận và sự chú ý của đối phương, viết rõ ai chạm vào đâu, đối phương phản ứng thế nào, câu chuyện nói tới đâu, đừng để cả đoạn biến thành bản đọc thực đơn; phép ví von vẫn dùng được cho ánh sáng, hơi thở, tâm tư, chỉ không được lấy nó thay tên cơ quan.
Khi thẻ nhân vật, thiết lập hoặc bản thân nhân vật có cách gọi cố định riêng thì viết theo thiết lập gốc, không cưỡng ép đổi từ.
</direct_terms>
Từ ngữ trực diện: khi lượt này viết tới tình dục, xác định cơ quan và hành vi dùng những tên gọi thẳng nào, xuất hiện ở đâu; kiểm tra không bị thay bằng ẩn dụ, mỹ từ, đồng âm hay cách gọi mập mờ, cũng không viết thành danh sách cơ quan.`,
};

export const WILD_CONQUEST_INTIMACY_MODULE: PresetModule = {
  id: 'm_wild_conquest_intimacy',
  name: 'Chinh phục hoang dã (Thân mật)',
  enabled: true,
  content: `<intimacy_tone>
Phong cách thân mật hiện tại: Thân mật chinh phục.
Khi nhân vật rơi vào một mối quan hệ bất bình đẳng, độc giả nhìn từ đâu để thấy hoàn cảnh ấy tác động lên phía yếu thế như thế nào? Mức này vẫn viết cuộc giằng co không cân sức, để sự được mất rơi xuống biểu hiện cơ thể. Cuộc cách mạng văn học của chúng ta viết tới đây cũng phải bàn giao rõ lai lịch của mối quan hệ và phản ứng nhân vật.
Hai người ngay từ đầu đã không ngang hàng: một bên nắm quyền lực, thân phận, thóp yếu, ân tình hoặc thế tiên cơ, bên kia biết rõ không nên nhưng cũng không lùi được. Trước hết viết rõ sự bất đối xứng này đến từ đâu, để nó quyết định ai mở lời, ai ra lệnh, ai không thể bỏ đi; mỗi bước về sau đều mọc ra từ vị trí đó.
Sự kháng cự của phía ở thế dưới là xương sống của mức này, bắt buộc phải viết ra: ánh mắt né đi rồi lại ngước lên, lời ra tới đầu môi lại cắn nuốt xuống, mặt nghiêng đi, tay căng cứng, vạt áo bị nắm nhàu, chân lùi nửa bước — đẩy nhẹ một cái, chặn một cái, giãy một chút đều được. Không viết gào khóc sụp đổ, khóc lóc ầm ĩ, không viết vung nắm đấm đánh người, đập phá đồ đạc, vật lộn thành một cục; có thể từ chối, có thể mắng, có thể nói không, nhưng không được diễn thành một trận ẩu đả, cũng không được viết thành khúc gỗ vô cảm.
Cơ thể phản bội trước: sự kháng cự còn chưa rút mà khoái cảm đã dâng lên rồi, cả hai cùng lúc hiện diện — miệng không chịu nhưng eo lại tự ưỡn đón; trong lòng tự mắng mình nhưng giọng nói đã mềm nhũn. Nắm lấy đúng điểm mâu thuẫn này mà phóng đại lặp lại, lớp này chồng lớp kia, viết sự chênh lệch giữa lòng không muốn mà thân lại đòi thành sức hút sắc dục và độ căng của mức này; không để phía thế dưới sảng khoái đầu hàng nói đồng ý, cũng không viết thành màn chịu tội hoàn toàn vô cảm.
Khoái cảm là chuyện thực sự xảy ra trên cơ thể, không phải hình phạt và cũng không đồng nghĩa với việc đã đồng ý; khi kết thúc, tâm trí dừng ở bước nào thì bàn giao theo nhân vật và hiện trường, không tự kết luận thay phía thế dưới.
Hàng rào cứng: trừ phi User chủ động nói rõ, nếu không thì không xuất tinh thay User, cũng không viết cao trào, mất kiểm soát tiểu tiện, co giật hay mất tự chủ cơ thể thay User. Khi User ở thế dưới cũng áp dụng tương tự: 'cơ thể phản bội trước' chỉ viết lên cơ thể của nhân vật khác, không dùng nó để bày tỏ thái độ thay User; phản ứng của User chỉ viết đến mức chính User đưa ra. Cũng không đi hết cả đoạn thân mật trong một lượt, mà dừng ở vị trí lượt sau vẫn tiếp nối được.
</intimacy_tone>
Kiểm tra nhanh (Chống động dục tùy tiện): Phong cách thân mật: Thân mật chinh phục. Xác định tiền đề bất bình đẳng, biểu hiện cụ thể sự kháng cự của phía thế dưới và điểm mâu thuẫn khi khoái cảm cùng kháng cự đồng thời hiện diện; kiểm tra không có gào khóc sụp đổ, đánh đấm vật lộn hay thuần túy chịu khổ, không tự tháo nút thắt lòng thay nhân vật, càng không viết xuất tinh, cao trào hay mất kiểm soát thay User, và không đi hết cả quy trình trong một lượt.`,
};

export const GROOMING_AND_DRESS_MODULE: PresetModule = {
  id: 'm_grooming_and_dress',
  name: 'Trang phục & trang điểm (Nữ)',
  enabled: true,
  content: `<grooming_and_dress>
Mục này chỉ có hiệu lực với nữ giới: khi viết trang phục và trang điểm của nam giới thì bỏ qua, không áp lối viết ở đây sang nam giới.
Trang phục và lớp trang điểm có thể cho chúng ta biết một người sống ra sao, nhưng đâu nhất thiết phải rách rưới thảm hại mới ra vẻ có câu chuyện? Khi cuộc cách mạng văn học nhìn vào hoàn cảnh của cô ấy, cũng sẵn lòng giữ lại sự tươm tất cho con người cụ thể này, để cách ăn mặc xứng với điều kiện ngày hôm đó. Trang phục nữ giới viết theo thân phận, hoàn cảnh và điều kiện kinh tế: chất vải, đường cắt, màu sắc đều ra dáng, không xù lông, không bạc phếch xám xịt, không ố vàng, không cũ kỹ nhếch nhác; cảm giác rộng thùng thình và rẻ tiền không khoác lên người cô ấy. Có thể nghèo, nhưng nghèo không bẩn: quần áo cũ vẫn giặt sạch sẽ, là phẳng phiu, vải thô mộc cũng có kiểu dáng đẹp; khi gặp nạn mà quần áo rách nát, dính máu mồ hôi bùn đất là do hiện trường như thế, chứ không phải đem cô ấy ra làm nền cho sự thê thảm.
Lớp trang điểm khớp với con người: lúc trang điểm kỹ thì mày mắt sắc nét, tẩy trang đi cũng chỉ sắc mặt nhạt hơn, đường nét dịu hơn chứ không biến thành hai người khác hẳn; không dùng mỹ phẩm kém chất lượng, không viết phấn mốc, vón cục, trôi phấn gây xấu hổ, không viết mùi son phấn rẻ tiền. Trang điểm đậm phải có lý do, sân khấu, màn đêm hay hoàn cảnh đủ sức nâng đỡ mới viết, không trét mặt cô ấy thành một chiếc mặt nạ son phấn.
Sự sạch sẽ cũng viết trong mái tóc, móng tay và mùi hương, đưa ra theo đúng điều kiện hôm đó.
</grooming_and_dress>
Kiểm tra nhanh: Trang phục & trang điểm: xác định áo quần và lớp trang điểm của nhân vật khớp thế nào với thân phận, hoàn cảnh và tình thế; kiểm tra không có rẻ tiền, rách cũ, ố vàng, không có mặt mộc khác hẳn người thật, không có mỹ phẩm kém chất lượng và lối trang điểm đậm lố.`,
};

export const APPEARANCE_AND_POSTURE_MODULE: PresetModule = {
  id: 'm_appearance_and_posture',
  name: 'Appearance & Posture (Nữ)',
  enabled: true,
  content: `<appearance_and_posture>
Mục này chỉ có hiệu lực với nữ giới: khi viết ngũ quan và vóc dáng nam giới thì bỏ qua, không áp lối viết ở đây sang nam giới.
Liệt kê đủ cả ngũ quan lẫn dáng vóc rồi, độc giả đã nhìn thấy con người này chưa? Chỉ khi cô ấy cử động, ngước mắt hay xoay người, diện mạo mới nối liền với cuộc sống ngay lúc này. Cái đẹp mà cuộc cách mạng văn học theo đuổi ở đây cũng phải có dáng vẻ thuộc về riêng nhân vật. Viết gương mặt và vóc dáng phải đi cùng động tác và thần thái ngay lúc đó: khi ngước mắt, nghiêng đầu, khẽ cau mày, mỉm cười, hình dáng đôi mắt, sống mũi, đường nét xương hàm mới được nhìn thấy; khi đứng, ngồi, bước đi, ngoái lại, bờ vai lưng và eo chân mới hiện ra cao thấp nặng nhẹ.
Khi nhân vật xuất hiện, trước hết đưa ra đường nét nhìn một cái là thấy: đường nét khuôn mặt, mày mắt, kiểu tóc, vóc người, tư thế — vài câu bàn giao rõ ràng để người đọc nhớ mặt cô ấy, các cảnh sau mới bổ sung dần qua động tác và thần thái.
Miêu tả bắt buộc phải đẹp mắt: ngũ quan cân đối, tỷ lệ có nét riêng của cô ấy, mày mắt rõ ràng, dáng môi và đôi tai đều nằm đúng chỗ. Không viết lệch lạc, méo miệng, mắt lé, mắt ti hí, miệng rộng quá khổ, tai vểnh to, mũi tẹt, mặt rỗ, răng hô, cũng không dùng 'dung mạo bình thường' cho qua chuyện; nét đặc trưng viết bằng cấu trúc xương, sáng tối và khí chất, không dùng cách làm xấu để tạo ấn tượng.
Cô ấy có thể không chói lòa rực rỡ, nhưng từng chi tiết rơi xuống trang giấy đều phải đẹp mắt hoặc càng nhìn càng ưa, không lấy khuyết điểm làm điểm nhấn ghi nhớ.
</appearance_and_posture>
Ngũ quan & thể thái: xác định đường nét bàn giao trước lúc xuất hiện và chi tiết được động tác kéo ra sau đó; kiểm tra ngũ quan cùng thể thái kết hợp tự nhiên với thần thái, nhất loạt đẹp mắt, không có các từ miêu tả lệch lạc, mắt nhỏ miệng rộng tai to v.v.`,
};

export const BODY_PHYSICS_MODULE: PresetModule = {
  id: 'm_body_physics',
  name: 'Vật lý cơ thể (Body Physics)',
  enabled: true,
  content: `<body_physics>
Khi một bàn tay đang đặt trên ngực cô ấy, làm sao nó có thể cùng lúc luồn xuống giữa hai chân? Hai người áp sát vào nhau, làm sao ngực và chân lại có thể rơi vào cùng một chỗ? Độc giả không thấy sơ đồ vị trí đứng trên sân khấu, nhưng liếc mắt một cái là nhận ra ngay nét bút này là lắp ghép. Cuộc cách mạng văn học khi viết đến cơ thể, hãy để tay, chân, đầu mỗi thứ chiếm một vị trí, một thời điểm chỉ làm một việc.
Trước khi đặt bút hãy sắp xếp xong vị trí tại hiện trường, không cần viết vào chính văn: ai đang đứng, ngồi, quỳ, nằm sấp, nằm nghiêng, độ cao và hướng mặt của hai người ra sao, ai đang chịu lực nâng đỡ, tứ chi mỗi phần nằm ở đâu, lớp vải, giường, tường, lưng ghế đang chắn thứ gì. Sắp xếp chưa rõ thì khoan đặt bút.
· Tay chỉ có hai chiếc: một tay đang ở giữa hai chân thì chỉ còn lại bàn tay kia, miệng, eo và chân; muốn đổi chỗ thì viết rõ động tác rút ra, chống đỡ, dịch chuyển sang, không để một tay làm liền hai việc, cũng không để nó nhảy cóc từ chỗ này sang chỗ khác.
· Một bộ phận không thể xuất hiện đồng thời ở hai nơi: kẹp ngực cần ngực áp ngực, cọ đùi cần khép giữa hai đùi, dùng ngón tay cần tay luồn vào giữa hai chân, xoa ngực cần tay ở trên ngực. Những vị trí này loại trừ lẫn nhau, ghép thành một câu 'vừa… vừa…' tức là cơ thể mọc sai chỗ; thực sự muốn viết đủ thì viết thành trước sau, đổi tay hoặc đổi tư thế.
· Tư thế không tự biến đổi: đoạn này ai đè lên ai, chân nào đang nhấc lên, đoạn sau vẫn dùng thì phải viết quá trình lật người, ngồi dậy, buông ra rồi ôm lại; không mặc định tự dời cơ thể sang vị trí thuận tay, cũng không để người chưa hề nhúc nhích đã đổi hướng.
· Trọng lượng và khớp xương có giới hạn: bế lên, lơ lửng, đứng một chân đều phải tốn sức, cánh tay và eo sẽ mỏi sẽ run, chống không nổi thì đặt xuống; eo uốn được tới đâu, tay vòng ra sau lưng được bao xa, cổ xoay được mấy độ, tất cả viết theo khớp xương người thường.
· Chiều cao và vóc dáng phải tính toán: đứng hôn nhau phải cúi đầu, kiễng chân, khom lưng; một cao một thấp áp sát vào nhau thì bộ phận nào dư ra, góc độ nào hụt đi đều bàn giao theo vóc dáng thực tế của hai người; với không tới thì viết với không tới, không cố ép cho vừa.
· Không gian và quần áo sẽ cản người: tay đang bận thì không mở được cúc áo; trên giường, sát tường, trong phòng tắm làm được những gì là khác nhau — va vào tường, bị lưng ghế cấn, trượt ra mép giường đều tính cả.
· Không đối chọi với động tác của User: động tác User viết ra vẫn xảy ra nguyên bản, nhưng triển khai thành hình dáng một con người thực sự làm được; nếu thực sự không ghép nổi thì tách thành trước sau, đổi tay, đổi tư thế, hoặc để chính nhân vật đổi động tác sang phiên bản làm được, đưa luôn giới hạn bị cản, chống không nổi, đành buông một chỗ vào trong cảnh diễn, không hủy bỏ ngay tại chỗ.
· Không viết thể chất siêu nhân: tứ chi xuyên qua cơ thể, khớp xương bẻ ngược, cơ thể lơ lửng không điểm tựa, dịch thể chảy ngược trọng lực — trừ phi thiết lập ghi rõ, tất cả không xuất hiện.
Mục này giúp động tác đứng vững trên mặt đất chứ không phải để phanh lại: vị trí và giới hạn viết rõ ràng thì sức nặng thân mật lại càng chân thực hơn, không cần vì thế mà viết cảnh thành nguội lạnh.
</body_physics>
Vật lý cơ thể: trước hết nêu rõ tư thế riêng của hai người trong lượt này, ai đang chịu lực, hai bàn tay đang làm gì; đối chiếu không có một tay làm hai việc cùng lúc, không có một bộ phận xuất hiện cùng lúc ở hai chỗ, không có tư thế nhảy cóc thiếu chuyển tiếp, không có với không tới mà viết thành làm được; nếu động tác của User không ghép nổi về mặt vật lý thì ghi rõ đổi sang cách viết khả thi nào.`,
};

export const STYLE_MODERN_MODULE: PresetModule = {
  id: 'm_style_modern',
  name: 'Văn phong: Hiện đại',
  enabled: false,
  group: 'style',
  content: `<genre_style_modern>
Văn phong Hiện đại (Đô thị / Đời thường sắc nét):
· Ngôn từ & khẩu khí: Tiếng Việt hiện đại tự nhiên, gọn gàng, sắc nét, tránh sáo ngữ cổ trang hay hoa mỹ giả tạo. Lời thoại sống động đúng độ tuổi, nghề nghiệp, địa vị và mức độ thân sơ của nhân vật; cho phép nhịp ngắt nghỉ, ngập ngừng, trêu đùa hoặc ẩn ý tinh tế như đời thật.
· Không gian & cảm quan đô thị: Khắc họa bối cảnh qua chi tiết đời thường giàu sức gợi (ánh đèn phố, tiếng điều hòa, kính xe, mùi cà phê, màn hình điện thoại, nhịp phố xá, kết cấu vật liệu và không gian phòng) thay vì liệt kê khô khan.
· Nhịp kể linh hoạt: Chuyển nhịp mượt giữa đời thường chậm rãi và cao trào căng thẳng; lồng ghép tâm lý tinh vi, phản ứng cơ thể thực tế và chi tiết giao tiếp phi ngôn ngữ (ánh mắt, khoảng cách, tư thế, tông giọng).
· Kỷ luật nhất quán: Tuyệt đối giữ đúng bối cảnh hiện đại, không lẫn từ ngữ tu tiên/kiếm hiệp/cổ đại nếu cảnh không cố ý nhắc tới.
</genre_style_modern>`,
};

export const STYLE_XIANXIA_MODULE: PresetModule = {
  id: 'm_style_xianxia',
  name: 'Văn phong: Tiên hiệp',
  enabled: false,
  group: 'style',
  content: `<genre_style_xianxia>
Văn phong Tiên hiệp (Huyền ảo / Tu chân trang nhã):
· Ngôn từ & khí vận: Sử dụng vốn từ Hán-Việt chọn lọc, cổ điển trang nhã nhưng trong sáng, dễ đọc và giàu sức cuốn hút; tránh lạm dụng thuật ngữ khó hiểu đến mức rối mạch truyện.
· Đạo vận & tu luyện: Chú trọng cảm giác linh khí lưu chuyển, uy áp cảnh giới, tâm cảnh tu sĩ, đan dược, pháp bảo, trận pháp và thiên địa dị tượng. Khi giao thủ hoặc vận công, làm rõ tầng bậc tu vi, sự hao tổn chân nguyên và hậu quả thực tế thay vì hô chiêu sáo rỗng.
· Không gian & thần thái: Gợi lên độ cao rộng, tiên khí hoặc u huyền của sơn môn, động phủ, bí cảnh, mây mù cổ tùng; tôn bật khí chất thoát tục, thâm trầm hoặc lạnh nhạt của tu sĩ qua ánh mắt, đạo bào, bước chân và lời nói hàm súc.
· Xưng hô & nhịp truyện: Giữ xưng hô chuẩn mực theo sư môn, bối phận và cảnh giới (đạo hữu, tiền bối, sư tôn, tại hạ, bản tọa... tùy thân phận), đẩy mạch truyện kịch tính, giàu cảm giác cơ duyên và nhân quả.
</genre_style_xianxia>`,
};

export const STYLE_WUXIA_MODULE: PresetModule = {
  id: 'm_style_wuxia',
  name: 'Văn phong: Võ hiệp',
  enabled: false,
  group: 'style',
  content: `<genre_style_wuxia>
Văn phong Võ hiệp (Giang hồ / Khí kình dứt khoát):
· Tiết tấu & câu văn: Nhịp kể dứt khoát, cô đọng, giàu lực căng và khí phách võ lâm; xen kẽ tĩnh và động rõ rệt như trước cơn bão trong tửu lâu hay trên cổ đạo.
· Chiêu thức & thực chiến: Miêu tả binh khí, thân pháp, bộ pháp, nội kình, góc đánh, kẽ hở và cảm giác va chạm sắt thép — da thịt — gió rít một cách cụ thể, có lực nặng và tính thực chiến thay vì phép thuật bay lượn quá đà.
· Giang hồ & nghĩa khí: Làm nổi bật ân oán môn phái, quy củ giang hồ, danh dự, chữ tín, lòng hiệp nghĩa cũng như mưu sâu hiểm ác chốn võ lâm; khắc họa không khí quán trọ, trà lâu, thành trấn cổ, mưa gió đêm khuya đầy bụi trần.
· Khẩu khí nhân vật: Lời thoại sảng khoái, sắc bén hoặc trầm lạnh đúng bản chất hiệp khách, hào kiệt, cao thủ ẩn dật hay nhân vật phản diện; xưng hô đậm chất giang hồ (huynh đài, cô nương, tại hạ, các hạ, tiền bối...).
</genre_style_wuxia>`,
};

export const STYLE_APOCALYPSE_MODULE: PresetModule = {
  id: 'm_style_apocalypse',
  name: 'Văn phong: Tận thế',
  enabled: false,
  group: 'style',
  content: `<genre_style_apocalypse>
Văn phong Tận thế (Sinh tồn khốc liệt / Căng thẳng thực tế):
· Không khí & áp lực sinh tồn: Giọng văn sắc lạnh, căng thẳng, trần trụi và bám sát thực tế; luôn duy trì cảm giác bất an, cảnh giác trước môi trường đổ nát, bóng tối, tiếng động lạ và hiểm họa rình rập.
· Tài nguyên & giới hạn con người: Chú trọng chi tiết vật tư khan hiếm (nước sạch, lương thực, đạn dược, nhiên liệu, thuốc men, pin, ánh sáng) cùng giới hạn sinh lý (mệt mỏi, đói khát, vết thương, nhiễm trùng, nhiệt độ, tâm lý đề phòng).
· Phản ứng & tính người: Nhân vật hành động thực dụng, tính toán rủi ro và hậu quả; không vô lý liều mạng hay tin người dễ dàng. Khi giao tranh hoặc chạy trốn, nhấn mạnh tiếng thở, tầm nhìn hẹp, địa hình chắn và quyết định trong tích tắc.
· Chi tiết bối cảnh: Miêu tả cảnh quan hoang tàn, mùi bụi khói rỉ sét, sự im lặng nặng nề của thành phố chết hoặc căn cứ tạm bợ để tạo sức nặng sinh tồn chân thực.
</genre_style_apocalypse>`,
};

export const STYLE_ANCIENT_MODULE: PresetModule = {
  id: 'm_style_ancient',
  name: 'Văn phong: Cổ trang',
  enabled: false,
  group: 'style',
  content: `<genre_style_ancient>
Văn phong Cổ trang (Cung đình / Xưa cũ chuẩn mực):
· Lễ nghi & xưng hô: Giữ chuẩn mực tôn ti trật tự, lễ tiết và xưng hô cổ trang phù hợp bối cảnh (điện hạ, công tử, tiểu thư, nương nương, nô tỳ, thần, tại hạ, chàng/thiếp... tùy giai tầng và thân phận), tuyệt đối tránh lẫn từ lóng hay khái niệm hiện đại.
· Không gian & phục sức: Tinh tế khắc họa kiến trúc gỗ ngói, bình phong, hương trầm, trà đạo, ánh đèn lồng, tơ lụa, trâm cài, đai ngọc và cử chỉ khoan thai, hàm ẩn lễ giáo nhưng giàu sức gợi cảm xúc.
· Lời thoại & ẩn ý: Giao tiếp giàu sắc thái kín đáo, biết tiến lùi, trọng thể diện và tầng nghĩa ngầm (đặc biệt trong chốn hậu cung, quan trường, thế gia vọng tộc); khi cảm xúc bùng vỡ càng tạo tương phản sâu sắc với vẻ ngoài điềm đạm.
· Nhịp kể: Mượt mà, cổ nhã, trầm ấm hoặc sâu lắng đúng chất truyện cổ trang, giữ mạch kể lôi cuốn và sống động theo từng cử chỉ nhỏ.
</genre_style_ancient>`,
};

export const PERSONAL_SLOT_1_MODULE: PresetModule = {
  id: 'm_personal_slot_1',
  name: 'Đồ riêng 1 — Văn phong cá nhân',
  enabled: false,
  group: 'personal',
  isPersonalSlot: true,
  content: '',
};

export const PERSONAL_SLOT_2_MODULE: PresetModule = {
  id: 'm_personal_slot_2',
  name: 'Đồ riêng 2 — Gu miêu tả riêng',
  enabled: false,
  group: 'personal',
  isPersonalSlot: true,
  content: '',
};

export const PERSONAL_SLOT_3_MODULE: PresetModule = {
  id: 'm_personal_slot_3',
  name: 'Đồ riêng 3 — Ghi chú / Luật riêng',
  enabled: false,
  group: 'personal',
  isPersonalSlot: true,
  content: '',
};

export const GENRE_STYLE_MODULES: PresetModule[] = [
  STYLE_MODERN_MODULE,
  STYLE_XIANXIA_MODULE,
  STYLE_WUXIA_MODULE,
  STYLE_APOCALYPSE_MODULE,
  STYLE_ANCIENT_MODULE,
];

export const PERSONAL_SLOT_MODULES: PresetModule[] = [
  PERSONAL_SLOT_1_MODULE,
  PERSONAL_SLOT_2_MODULE,
  PERSONAL_SLOT_3_MODULE,
];

function stripSongTraoPhrase(text: string): string {
  return text
    .replace(
      /(^|\n)([ \t]*)Sóng\s+Trào\s+à[,.:;!?]*[ \t]*([\p{L}])/giu,
      (_match, prefix: string, indent: string, firstChar: string) =>
        `${prefix}${indent}${firstChar.toLocaleUpperCase('vi-VN')}`,
    )
    .replace(/Sóng\s+Trào\s+à[,.:;!?]*[ \t]*/giu, '');
}

const BUILTIN_PRESET_MODULES: PresetModule[] = [
  ...GENRE_STYLE_MODULES,
  ...PERSONAL_SLOT_MODULES,
  GROUNDED_INTIMACY_MODULE,
  NARRATIVE_PERSON_MODULE,
  DIRECT_TERMS_MODULE,
  WILD_CONQUEST_INTIMACY_MODULE,
  GROOMING_AND_DRESS_MODULE,
  APPEARANCE_AND_POSTURE_MODULE,
  BODY_PHYSICS_MODULE,
];

function cleanUntouchedBuiltinSongTrao(mod: PresetModule): PresetModule {
  if (!/Sóng\s+Trào\s+à/i.test(mod.content || '')) return mod;
  const cleanedNorm = stripSongTraoPhrase(mod.content)
    .replace(/\r\n/g, '\n')
    .trim();
  const matchedBuiltin = BUILTIN_PRESET_MODULES.find(
    (b) => b.content.replace(/\r\n/g, '\n').trim() === cleanedNorm,
  );
  if (!matchedBuiltin) return mod;
  return {
    ...mod,
    content: matchedBuiltin.content,
  };
}

export function createDefaultModules(): PresetModule[] {
  return [
    {
      id: 'm1',
      name: '01. Hệ thống Nhập vai & Xưng hô',
      enabled: true,
      content:
        'Bạn là người kể chuyện nhập vai tiếng Việt mạch lạc, tự nhiên, kể chi tiết và sâu sắc. Nếu có hồ sơ/ngữ cảnh thì bám theo đó; nếu chưa gán tên hoặc xưng hô cụ thể thì tự quyết định tên nhân vật, xưng hô và cách xưng hô giữa các nhân vật sao cho hợp bối cảnh, tự nhiên, nhất quán, phân tách rõ lời thoại và hành động/biểu cảm, không gõ sai dấu hay dính chữ.',
    },
    {
      id: 'm2',
      name: '02. Tawa / Omega P&P Engine',
      enabled: true,
      content:
        'Kể diễn biến chi tiết, mở rộng từng hành động, lời thoại, phản ứng và không khí bối cảnh một cách sống động, đầy đặn (ưu tiên độ dài phong phú theo mục tiêu ngữ cảnh thay vì trả lời ngắn gọn). Giữ mạch kết thúc phân cảnh liền mạch ngay trong nội dung câu chuyện.',
    },
    ...GENRE_STYLE_MODULES.map((m) => ({ ...m })),
    ...PERSONAL_SLOT_MODULES.map((m) => ({ ...m })),
    { ...GROUNDED_INTIMACY_MODULE },
    { ...NARRATIVE_PERSON_MODULE },
    { ...DIRECT_TERMS_MODULE },
    { ...WILD_CONQUEST_INTIMACY_MODULE },
    { ...GROOMING_AND_DRESS_MODULE },
    { ...APPEARANCE_AND_POSTURE_MODULE },
    { ...BODY_PHYSICS_MODULE },
    {
      id: 'm3',
      name: '03. Chat History',
      enabled: true,
      content: 'Chat History',
    },
    {
      id: 'm4',
      name: '04. Đóng thẻ </chathistory>',
      enabled: true,
      content: '</chathistory>',
    },
  ];
}

const VALID_PRESET_GROUPS = new Set<PresetGroupId>([
  'style',
  'personal',
  'perspective',
  'intimacy',
  'appearance',
  'core',
]);

export function ensureBuiltinPresetModules(
  modules: PresetModule[],
): PresetModule[] {
  const normalized: PresetModule[] = (Array.isArray(modules) ? modules : [])
    .filter((m): m is PresetModule => Boolean(m && typeof m === 'object'))
    .map((m, idx) => {
      const group =
        typeof m.group === 'string' &&
        VALID_PRESET_GROUPS.has(m.group as PresetGroupId)
          ? (m.group as PresetGroupId)
          : undefined;
      const isCustom =
        typeof m.isCustom === 'boolean' ? m.isCustom : undefined;
      const isPersonalSlot =
        typeof m.isPersonalSlot === 'boolean' ? m.isPersonalSlot : undefined;
      return cleanUntouchedBuiltinSongTrao({
        id: typeof m.id === 'string' && m.id ? m.id : `mod_${idx + 1}`,
        name: typeof m.name === 'string' ? m.name : `Mô-đun ${idx + 1}`,
        enabled: typeof m.enabled === 'boolean' ? m.enabled : true,
        content: typeof m.content === 'string' ? m.content : '',
        ...(group ? { group } : {}),
        ...(isCustom ? { isCustom } : {}),
        ...(isPersonalSlot ? { isPersonalSlot } : {}),
      });
    });

  if (!normalized.length) {
    return createDefaultModules();
  }

  const insertBeforeHistory = (mod: PresetModule) => {
    const insertIdx = normalized.findIndex(
      (m) =>
        m.content.trim() === 'Chat History' ||
        m.content.trim() === '</chathistory>',
    );
    if (insertIdx >= 0) {
      normalized.splice(insertIdx, 0, mod);
    } else {
      normalized.push(mod);
    }
  };

  for (const styleMod of GENRE_STYLE_MODULES) {
    const tagMatch = styleMod.content.match(/<([a-z0-9_]+)>/i);
    const xmlTag = tagMatch ? tagMatch[1] : '';
    const exists = normalized.some(
      (m) =>
        m.id === styleMod.id ||
        (xmlTag && new RegExp(`<${xmlTag}>`, 'i').test(m.content || '')),
    );
    if (!exists) {
      insertBeforeHistory({ ...styleMod });
    }
  }

  for (const personalSlot of PERSONAL_SLOT_MODULES) {
    const exists = normalized.some((m) => m.id === personalSlot.id);
    if (!exists) {
      insertBeforeHistory({ ...personalSlot });
    }
  }

  const hasGroundedIntimacy = normalized.some(
    (m) =>
      m.id === GROUNDED_INTIMACY_MODULE.id ||
      /grounded\s*intimacy/i.test(m.name || '') ||
      /<grounded_intimacy>/i.test(m.content || ''),
  );
  if (!hasGroundedIntimacy) {
    insertBeforeHistory({ ...GROUNDED_INTIMACY_MODULE });
  }

  const hasNarrativePerson = normalized.some(
    (m) =>
      m.id === NARRATIVE_PERSON_MODULE.id ||
      /narrative\s*person|ngôi thứ ba/i.test(m.name || '') ||
      /<narrative_person>/i.test(m.content || ''),
  );
  if (!hasNarrativePerson) {
    insertBeforeHistory({ ...NARRATIVE_PERSON_MODULE });
  }

  const hasDirectTerms = normalized.some(
    (m) =>
      m.id === DIRECT_TERMS_MODULE.id ||
      /direct\s*terms|từ ngữ trực diện/i.test(m.name || '') ||
      /<direct_terms>/i.test(m.content || ''),
  );
  if (!hasDirectTerms) {
    insertBeforeHistory({ ...DIRECT_TERMS_MODULE });
  }

  const hasWildConquest = normalized.some(
    (m) =>
      m.id === WILD_CONQUEST_INTIMACY_MODULE.id ||
      /chinh phục hoang dã|thân mật chinh phục/i.test(m.name || '') ||
      /<intimacy_tone>/i.test(m.content || ''),
  );
  if (!hasWildConquest) {
    insertBeforeHistory({ ...WILD_CONQUEST_INTIMACY_MODULE });
  }

  const hasGroomingAndDress = normalized.some(
    (m) =>
      m.id === GROOMING_AND_DRESS_MODULE.id ||
      /trang phục\s*&\s*trang điểm/i.test(m.name || '') ||
      /<grooming_and_dress>/i.test(m.content || ''),
  );
  if (!hasGroomingAndDress) {
    insertBeforeHistory({ ...GROOMING_AND_DRESS_MODULE });
  }

  const hasAppearanceAndPosture = normalized.some(
    (m) =>
      m.id === APPEARANCE_AND_POSTURE_MODULE.id ||
      /appearance\s*&\s*posture|ngũ quan\s*&\s*thể thái/i.test(m.name || '') ||
      /<appearance_and_posture>/i.test(m.content || ''),
  );
  if (!hasAppearanceAndPosture) {
    insertBeforeHistory({ ...APPEARANCE_AND_POSTURE_MODULE });
  }

  const hasBodyPhysics = normalized.some(
    (m) =>
      m.id === BODY_PHYSICS_MODULE.id ||
      /body\s*physics|vật lý cơ thể/i.test(m.name || '') ||
      /<body_physics>/i.test(m.content || ''),
  );
  if (!hasBodyPhysics) {
    insertBeforeHistory({ ...BODY_PHYSICS_MODULE });
  }

  return normalized;
}

export function normalizeTawaPreset(
  raw: unknown,
  fallback?: TawaPreset,
): TawaPreset {
  const base: TawaPreset = fallback
    ? {
        modules: ensureBuiltinPresetModules(fallback.modules),
        prefillEnabled: Boolean(fallback.prefillEnabled),
        prefill: fallback.prefill || DEFAULT_PREFILL,
        exclusiveStyleMode:
          typeof fallback.exclusiveStyleMode === 'boolean'
            ? fallback.exclusiveStyleMode
            : true,
      }
    : {
        modules: createDefaultModules(),
        prefillEnabled: false,
        prefill: DEFAULT_PREFILL,
        exclusiveStyleMode: true,
      };

  if (!raw || typeof raw !== 'object') return base;
  const rec = raw as {
    modules?: PresetModule[];
    prefillEnabled?: boolean;
    prefill?: string;
    exclusiveStyleMode?: boolean;
  };

  return {
    modules: Array.isArray(rec.modules)
      ? ensureBuiltinPresetModules(rec.modules)
      : base.modules,
    prefillEnabled:
      typeof rec.prefillEnabled === 'boolean'
        ? rec.prefillEnabled
        : base.prefillEnabled,
    prefill:
      typeof rec.prefill === 'string' && rec.prefill
        ? rec.prefill
        : base.prefill,
    exclusiveStyleMode:
      typeof rec.exclusiveStyleMode === 'boolean'
        ? rec.exclusiveStyleMode
        : base.exclusiveStyleMode,
  };
}

export function createDefaultCompanion(): CompanionProfile {
  return {
    id: 'comp_default_1',
    name: 'Đồng nhân mặc định',
    role: 'Đồng nhân / AU',
    sourceQuery: '',
    sourceContent: '',
    mc: {
      sourceMode: 'custom',
      name: '',
      pronoun: '',
      roleType: 'transmigrator',
      canonMcName: '',
      originRole: '',
      canonMcRelation: '',
      gender: 'Nam',
      age: '24',
      personality: 'Điềm tĩnh, quan sát tinh tế, thẳng thắn.',
      appearance: 'Dáng người gọn gàng, ánh mắt trầm ổn, phong thái tự nhiên.',
    },
    worldSetting: 'Thế giới hiện đại với nhiều tầng bí mật đan xen.',
    worldRules:
      'Mọi hành động và năng lực đều có nguyên nhân, hậu quả và cái giá tương xứng với bối cảnh.',
    npcs: [],
    canonCandidates: [],
    note: 'Giữ mạch tương tác tự nhiên, bám sát bối cảnh và tâm lý nhân vật.',
  };
}

export function createInitialState(): ArkState {
  return {
    activeView: 'lobby',
    currentPage: 0,
    streamEnabled: true,
    showRawTags: false,
    showPostMeta: false,
    hideBottomNav: false,
    lobbyBgDataUrl: '',
    storyImage: { ...DEFAULT_STORY_IMAGE_CONFIG },
    memory: createDefaultMemoryConfig(),
    portraitBank: createDefaultPortraitBank(),
    player: { name: '', pronoun: '' },
    world: { name: 'Thế giới hiện đại' },
    config: {
      proxyUrl: '',
      proxyKey: '',
      model: '',
      apiProtocol: 'openai',
      seedreamUrl: '',
      seedreamApiKey: '',
      seedreamModel: 'seedream-5.0-pro',
      seedreamSize: '1024x1024',
      seedreamPrompt: '',
      safetySettings: DEFAULT_SAFETY.map((s) => ({ ...s })),
    },
    tawaPreset: {
      modules: createDefaultModules(),
      prefillEnabled: false,
      prefill: DEFAULT_PREFILL,
      exclusiveStyleMode: true,
    },
    context: {
      historyTurns: 12,
      targetLength: '900 - 1800 từ',
      entitiesNote:
        'Bối cảnh hiện đại, nhịp kể chậm rãi, chi tiết; tên và xưng hô do AI tự quyết định hoặc theo ngữ cảnh người dùng.',
    },
    turns: [],
    slots: [],
    companions: [createDefaultCompanion()],
    companionStories: {},
    companionMemories: {},
    companionPortraits: {},
    activeCompanionId: 'comp_default_1',
    activeStoryCompanionId: null,
    checkpoint: null,
  };
}

export function loadPersistedState(): ArkState {
  const base = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;

    if (parsed.player) {
      base.player = { ...base.player, ...parsed.player };
      if (base.player.name === 'Trần Thiện') base.player.name = '';
      if (base.player.pronoun === 'anh Thiện') base.player.pronoun = '';
    }
    if (parsed.world) {
      base.world = { ...base.world, ...parsed.world };
    }
    if (parsed.config) {
      base.config = {
        ...base.config,
        ...parsed.config,
        safetySettings:
          Array.isArray(parsed.config.safetySettings) && parsed.config.safetySettings.length === 4
            ? parsed.config.safetySettings
            : DEFAULT_SAFETY.map((s) => ({ ...s })),
      };
    }
    if (parsed.tawaPreset && Array.isArray(parsed.tawaPreset.modules)) {
      base.tawaPreset = normalizeTawaPreset(parsed.tawaPreset, base.tawaPreset);
    }
    if (parsed.context) {
      base.context = { ...base.context, ...parsed.context };
      if (
        typeof base.context.entitiesNote === 'string' &&
        /Trần Thiện|anh Thiện/i.test(base.context.entitiesNote)
      ) {
        base.context.entitiesNote =
          'Bối cảnh hiện đại, nhịp kể chậm rãi, chi tiết; tên và xưng hô do AI tự quyết định hoặc theo ngữ cảnh người dùng.';
      }
    }
    if (Array.isArray(parsed.turns)) {
      base.turns = ensureUniqueTurnIds(parsed.turns);
      base.currentPage =
        typeof parsed.currentPage === 'number' && Number.isFinite(parsed.currentPage)
          ? clampPageIndex(parsed.currentPage, base.turns.length)
          : Math.max(0, base.turns.length - 1);
    }
    if (Array.isArray(parsed.slots)) base.slots = parsed.slots;
    if (parsed.checkpoint) base.checkpoint = parsed.checkpoint;
    if (typeof parsed.streamEnabled === 'boolean') base.streamEnabled = parsed.streamEnabled;
    if (typeof parsed.hideBottomNav === 'boolean') base.hideBottomNav = parsed.hideBottomNav;
    if (typeof parsed.lobbyBgDataUrl === 'string') base.lobbyBgDataUrl = parsed.lobbyBgDataUrl;
    if (parsed.storyImage && typeof parsed.storyImage === 'object') {
      base.storyImage = normalizeStoryImageConfig(
        parsed.storyImage,
        DEFAULT_STORY_IMAGE_CONFIG,
      );
    }
    if (parsed.memory && typeof parsed.memory === 'object') {
      base.memory = normalizeMemoryConfig(parsed.memory);
    }
    if (parsed.portraitBank && typeof parsed.portraitBank === 'object') {
      base.portraitBank = normalizePortraitBank(parsed.portraitBank);
    }
    if (Array.isArray(parsed.companions) && parsed.companions.length) {
      base.companions = parsed.companions.map((c: CompanionProfile) => ({
        ...createDefaultCompanion(),
        ...c,
        mc: {
          ...createDefaultCompanion().mc,
          ...(c.mc || {}),
        },
        npcs: Array.isArray(c.npcs) ? c.npcs : [],
        canonCandidates: Array.isArray(c.canonCandidates) ? c.canonCandidates : [],
      }));
    }
    if (parsed.companionStories && typeof parsed.companionStories === 'object') {
      const normalizedStories: Record<string, Turn[]> = {};
      for (const [k, v] of Object.entries(
        parsed.companionStories as Record<string, unknown>,
      )) {
        if (Array.isArray(v)) {
          normalizedStories[k] = ensureUniqueTurnIds(v as Turn[]);
        }
      }
      base.companionStories = normalizedStories;
    }
    if (
      parsed.companionMemories &&
      typeof parsed.companionMemories === 'object'
    ) {
      const normalizedMap: Record<string, MemoryManagerConfig> = {};
      for (const [k, v] of Object.entries(
        parsed.companionMemories as Record<string, unknown>,
      )) {
        normalizedMap[k] = normalizeMemoryConfig(v);
      }
      base.companionMemories = normalizedMap;
    }
    if (
      parsed.companionPortraits &&
      typeof parsed.companionPortraits === 'object'
    ) {
      const normalizedPortraitsMap: Record<string, PortraitBankConfig> = {};
      for (const [k, v] of Object.entries(
        parsed.companionPortraits as Record<string, unknown>,
      )) {
        normalizedPortraitsMap[k] = normalizePortraitBank(v);
      }
      base.companionPortraits = normalizedPortraitsMap;
    }
    if (typeof parsed.activeCompanionId === 'string' && parsed.activeCompanionId) {
      base.activeCompanionId = parsed.activeCompanionId;
    }
    if (
      typeof parsed.activeStoryCompanionId === 'string' ||
      parsed.activeStoryCompanionId === null
    ) {
      base.activeStoryCompanionId = parsed.activeStoryCompanionId;
    } else {
      base.activeStoryCompanionId = resolveActiveStoryCompanionKey(base);
    }
    base.currentPage = clampPageIndex(base.currentPage, base.turns.length);
  } catch {
    // Fallback cleanly to initial state
  }
  const activeComp = getActiveCompanionFromState(base);
  base.portraitBank = syncPortraitBankWithCompanion(
    base.portraitBank,
    activeComp,
    base.player.name,
    base.memory?.storyClock,
  );
  return base;
}

export function persistState(state: ArkState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        player: state.player,
        world: state.world,
        config: state.config,
        tawaPreset: state.tawaPreset,
        context: state.context,
        turns: state.turns,
        currentPage: clampPageIndex(state.currentPage, state.turns.length),
        slots: state.slots,
        checkpoint: state.checkpoint,
        streamEnabled: state.streamEnabled,
        hideBottomNav: state.hideBottomNav,
        lobbyBgDataUrl: state.lobbyBgDataUrl || '',
        storyImage: state.storyImage || DEFAULT_STORY_IMAGE_CONFIG,
        memory: state.memory || createDefaultMemoryConfig(),
        portraitBank: state.portraitBank || createDefaultPortraitBank(),
        companions: state.companions || [],
        companionStories: state.companionStories || {},
        companionMemories: state.companionMemories || {},
        companionPortraits: state.companionPortraits || {},
        activeCompanionId: state.activeCompanionId || '',
        activeStoryCompanionId: state.activeStoryCompanionId ?? null,
      }),
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function getActiveCompanionFromState(state: ArkState): CompanionProfile {
  if (!state.companions.length) {
    return createDefaultCompanion();
  }
  return (
    state.companions.find((c) => c.id === state.activeCompanionId) ||
    state.companions[0]
  );
}

export function triggerDownloadJson(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImageSaveFallbackPayload {
  /** URL safe to render in <img> (object URL, data URL, or remote URL) */
  previewUrl: string;
  /** Original source string (remote URL or data URL) */
  originalSrc: string;
  /** Safe filename with extension matching actual MIME type */
  filename: string;
  /** Ready-to-share File if Blob could be obtained (enables synchronous Web Share on tap) */
  file: File | null;
  /** Whether previewUrl is an object URL created by downloadImageSource and should be revoked on close */
  ownsObjectUrl: boolean;
  /** Context reason for showing the fallback modal */
  reason: 'mobile-save' | 'share-gesture' | 'cors-blocked' | 'iframe-fallback';
  /** Helpful localized instruction text */
  hint: string;
}

export interface DownloadImageOptions {
  onFallbackPreview?: (payload: ImageSaveFallbackPayload) => void;
}

export type DownloadImageOutcome =
  | 'shared'
  | 'downloaded'
  | 'fallback-modal'
  | 'cancelled'
  | 'error';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

export function detectImageSaveEnv(): {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isWebView: boolean;
  isInIframe: boolean;
} {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isWebView: false,
      isInIframe: false,
    };
  }
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const isMobile =
    isIOS ||
    isAndroid ||
    /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (hasCoarsePointer && window.innerWidth <= 1024);
  const isWebView =
    /\bwv\b|WebView|FBAN|FBAV|Instagram|Line\/|Zalo|MicroMessenger/i.test(ua) ||
    (isIOS && !/Safari/i.test(ua));
  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }
  return { isIOS, isAndroid, isMobile, isWebView, isInIframe };
}

export function ensureImageFilename(
  rawFilename: string,
  mimeType?: string,
): string {
  const cleaned = (rawFilename || `ark_image_${Date.now()}.png`)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = cleaned || `ark_image_${Date.now()}.png`;
  const normalizedMime = (mimeType || '').split(';')[0].trim().toLowerCase();
  const targetExt = MIME_TO_EXT[normalizedMime];
  if (!targetExt) {
    return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.png`;
  }
  if (/\.[a-z0-9]{2,5}$/i.test(base)) {
    return base.replace(/\.[a-z0-9]{2,5}$/i, `.${targetExt}`);
  }
  return `${base}.${targetExt}`;
}

export function dataUrlToBlobSync(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = /^data:([^;,]+)/i.exec(header);
    const mime = mimeMatch?.[1]?.trim() || 'image/png';
    if (/;base64/i.test(header)) {
      const binary = atob(body.replace(/\s+/g, ''));
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    const decoded = decodeURIComponent(body);
    return new Blob([decoded], { type: mime });
  } catch {
    return null;
  }
}

async function fetchRemoteImageAsBlob(imgSrc: string): Promise<Blob | null> {
  try {
    const res = await fetch(imgSrc, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) return blob;
    }
  } catch {
    // Fall through to canvas attempt
  }

  // Secondary CORS-enabled Image -> Canvas attempt (handles some CDN configurations)
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  return new Promise<Blob | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 7000);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = imgSrc;
  });
}

export function canShareImageFile(file: File | null): boolean {
  if (!file || typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }
  return true;
}

export async function shareImageFile(
  file: File,
  title: string,
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!canShareImageFile(file)) return 'unsupported';
  try {
    await navigator.share({
      files: [file],
      title,
    });
    return 'shared';
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

export function triggerAnchorDownload(
  href: string,
  filename: string,
  openInNewTab = false,
): void {
  const a = document.createElement('a');
  a.href = href;
  if (!openInNewTab) {
    a.download = filename;
  } else {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadImageSource(
  imgSrc: string,
  filename: string,
  onNotify: (msg: string, type?: 'info' | 'err') => void,
  options?: DownloadImageOptions,
): Promise<DownloadImageOutcome> {
  if (!imgSrc) {
    onNotify('Không có ảnh để tải về máy.', 'err');
    return 'error';
  }

  const env = detectImageSaveEnv();
  const isDataUrl = imgSrc.startsWith('data:');
  const isBlobUrl = imgSrc.startsWith('blob:');
  const isHttpUrl = /^https?:\/\//i.test(imgSrc);

  // 1. Obtain Blob synchronously when possible (data: URL) so mobile Web Share keeps user activation
  let blob: Blob | null = null;
  let hadAsyncFetch = false;

  if (isDataUrl) {
    blob = dataUrlToBlobSync(imgSrc);
  } else if (isBlobUrl) {
    hadAsyncFetch = true;
    try {
      const r = await fetch(imgSrc);
      if (r.ok) blob = await r.blob();
    } catch {
      blob = null;
    }
  } else if (isHttpUrl) {
    hadAsyncFetch = true;
    blob = await fetchRemoteImageAsBlob(imgSrc);
  }

  const mimeType =
    blob?.type && blob.type.startsWith('image/')
      ? blob.type
      : isDataUrl
        ? /^data:([^;,]+)/i.exec(imgSrc)?.[1] || 'image/png'
        : 'image/png';
  const safeName = ensureImageFilename(filename, mimeType);
  const file =
    blob && typeof File !== 'undefined'
      ? new File([blob], safeName, {
          type: mimeType,
          lastModified: Date.now(),
        })
      : null;

  const openFallbackModal = (
    reason: ImageSaveFallbackPayload['reason'],
    hint: string,
    bannerMsg: string,
  ): DownloadImageOutcome => {
    const ownsObjectUrl = Boolean(blob && !isBlobUrl);
    const previewUrl = ownsObjectUrl && blob ? URL.createObjectURL(blob) : imgSrc;
    if (options?.onFallbackPreview) {
      options.onFallbackPreview({
        previewUrl,
        originalSrc: imgSrc,
        filename: safeName,
        file,
        ownsObjectUrl,
        reason,
        hint,
      });
      onNotify(bannerMsg);
      return 'fallback-modal';
    }
    // No modal callback supplied: open image in new tab as last resort
    triggerAnchorDownload(previewUrl, safeName, true);
    if (ownsObjectUrl) {
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    }
    onNotify(bannerMsg);
    return 'fallback-modal';
  };

  // 2. Mobile (iOS / Android) flow: prioritize native Web Share API to save directly to Gallery/Photos
  if (env.isMobile) {
    if (file && canShareImageFile(file)) {
      const shareOutcome = await shareImageFile(file, safeName);
      if (shareOutcome === 'shared') {
        onNotify(
          'Đã mở bảng chia sẻ — chọn "Lưu hình ảnh" để lưu vào thư viện ảnh.',
        );
        return 'shared';
      }
      if (shareOutcome === 'cancelled') {
        onNotify('Đã hủy lưu ảnh.');
        return 'cancelled';
      }
      // Share was blocked (e.g. iframe policy or expired gesture after remote fetch) -> open fallback modal
      return openFallbackModal(
        hadAsyncFetch ? 'share-gesture' : 'mobile-save',
        'Chạm nút "Chia sẻ / Lưu ảnh" bên dưới hoặc chạm giữ trực tiếp vào ảnh để lưu vào thư viện điện thoại.',
        'Đã mở khung lưu ảnh — bấm "Chia sẻ / Lưu ảnh" hoặc chạm giữ ảnh để lưu.',
      );
    }

    // Android (outside iframe & WebView) with a valid Blob can use direct blob download
    if (
      env.isAndroid &&
      !env.isIOS &&
      !env.isInIframe &&
      !env.isWebView &&
      blob
    ) {
      const objUrl = URL.createObjectURL(blob);
      triggerAnchorDownload(objUrl, safeName, false);
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      onNotify(`Đang tải ảnh về điện thoại: ${safeName}`);
      return 'downloaded';
    }

    // iOS Safari, mobile iframe, WebView, or CORS-blocked remote image -> show crisp save modal for 1-tap share or long-press save
    const hint = !blob && isHttpUrl
      ? 'Ảnh từ nguồn ngoài không thể tải ngầm do CORS. Hãy chạm giữ vào ảnh phía trên để lưu vào thư viện, hoặc bấm "Mở tab mới".'
      : 'Chạm giữ trực tiếp vào ảnh phía trên rồi chọn "Lưu vào Ảnh / Tải hình ảnh xuống" để lưu vào điện thoại.';
    return openFallbackModal(
      !blob && isHttpUrl
        ? 'cors-blocked'
        : env.isInIframe
          ? 'iframe-fallback'
          : 'mobile-save',
      hint,
      'Chạm giữ vào ảnh để lưu vào thư viện điện thoại (hoặc mở ở tab mới).',
    );
  }

  // 3. Desktop flow: normal direct file download whenever Blob is available
  if (blob) {
    const objUrl = URL.createObjectURL(blob);
    triggerAnchorDownload(objUrl, safeName, false);
    setTimeout(() => URL.revokeObjectURL(objUrl), 15_000);
    onNotify(`Đã tải ảnh về máy: ${safeName}`);
    return 'downloaded';
  }

  // Desktop fallback when remote URL blocks CORS fetch: show preview modal with Open in New Tab & Right-Click Save
  return openFallbackModal(
    'cors-blocked',
    'Nguồn ảnh hạn chế tải tự động (CORS). Bạn có thể nhấp chuột phải vào ảnh chọn "Lưu hình ảnh thành..." hoặc bấm "Mở tab mới".',
    'Nguồn ảnh giới hạn tải trực tiếp — đã mở khung xem ảnh để bạn lưu về máy.',
  );
}

