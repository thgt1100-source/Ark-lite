import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Edit3,
  Globe,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type {
  ArkState,
  CanonCandidate,
  CompanionProfile,
  DnSubTab,
  McRoleType,
  McSourceMode,
  PortraitBankConfig,
  ViewName,
} from '../types/ark';
import { callAiJsonOrText, runTimedLookupWithProgress } from '../utils/api';
import {
  computeAgeFromBirthday,
  formatAgeBirthdayLabel,
  lookupKnownCelebrityProfile,
} from '../utils/characterUtils';
import { matchesQuery } from '../utils/search';
import { getActiveCompanionFromState, triggerDownloadJson } from '../utils/storage';
import { CharacterNameBadge } from './CharacterNameBadge';
import {
  ImagePickerModal,
  type ImagePickerTarget,
} from './ImagePickerModal';
import {
  PortraitBankPanel,
  type BgPortraitStatus,
} from './PortraitBankPanel';

interface CompanionViewProps {
  state: ArkState;
  generatingPortraitIds: string[];
  enrichingAppearanceIds: string[];
  isEnrichingAppearances: boolean;
  enrichingNpcIds: string[];
  isEnrichingAllNpcs: boolean;
  bgPortraitStatus: BgPortraitStatus | null;
  onUpdateActiveCompanion: (
    updater: (cur: CompanionProfile) => CompanionProfile,
    syncPlayerWorld?: boolean,
  ) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncPortraitsFromCompanion: () => void;
  onCleanJunkPortraits: () => void;
  onAutoFillAppearances: () => void;
  onRefreshPortraitAppearance: (portraitId: string, force?: boolean) => void;
  onEnrichNpcProfile: (npcId: string, force?: boolean) => void;
  onEnrichAllNpcs: () => void;
  onGeneratePortrait: (portraitId: string) => void;
  onCancelBgPortraits: () => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onSelectCompanion: (id: string) => void;
  onCreateNewProfile: () => void;
  onDeleteProfile: (id: string) => void;
  onImportProfile: (profile: CompanionProfile) => void;
  onEnterCompanionWorld: () => void;
  onNavigate: (view: ViewName) => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
}

function upsertCanonNpcAndCandidate(
  cur: CompanionProfile,
  canonObj: Record<string, unknown>,
): CompanionProfile {
  const canonName = String(canonObj.name || '').trim();
  if (!canonName) return cur;

  const descParts = [
    canonObj.personality
      ? `Tính cách: ${String(canonObj.personality).trim()}`
      : '',
    canonObj.appearance
      ? `Ngoại hình: ${String(canonObj.appearance).trim()}`
      : '',
    canonObj.gender ? `Giới tính: ${String(canonObj.gender).trim()}` : '',
    canonObj.age ? `Tuổi: ${String(canonObj.age).trim()}` : '',
  ].filter(Boolean);

  const npcs = [...(cur.npcs || [])];
  const existingIdx = npcs.findIndex(
    (n) => (n.name || '').trim().toLowerCase() === canonName.toLowerCase(),
  );
  const npcEntry = {
    id:
      existingIdx >= 0
        ? npcs[existingIdx].id
        : `npc_canon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: canonName,
    role:
      existingIdx >= 0 && npcs[existingIdx].role
        ? npcs[existingIdx].role
        : 'Nhân vật chính nguyên tác',
    desc:
      descParts.join(' | ') ||
      (existingIdx >= 0
        ? npcs[existingIdx].desc
        : 'Nhân vật từ tác phẩm nguyên tác.'),
  };
  if (existingIdx >= 0) {
    npcs[existingIdx] = { ...npcs[existingIdx], ...npcEntry };
  } else {
    npcs.unshift(npcEntry);
  }

  const canonCandidates: CanonCandidate[] = [...(cur.canonCandidates || [])];
  const candItem: CanonCandidate = {
    name: canonName,
    pronoun: String(canonObj.pronoun || '').trim(),
    gender: String(canonObj.gender || 'Nam').trim(),
    age: String(canonObj.age || '').trim(),
    personality: String(canonObj.personality || '').trim(),
    appearance: String(canonObj.appearance || '').trim(),
    role: 'Nhân vật nguyên tác',
  };
  const candIdx = canonCandidates.findIndex(
    (c) => (c.name || '').trim().toLowerCase() === canonName.toLowerCase(),
  );
  if (candIdx >= 0) canonCandidates[candIdx] = candItem;
  else canonCandidates.unshift(candItem);

  return {
    ...cur,
    npcs,
    canonCandidates,
    mc: {
      ...cur.mc,
      canonMcName: cur.mc?.canonMcName || canonName,
    },
  };
}

function parseStructuredFanficFromText(
  rawText: string,
  cur: CompanionProfile,
): { ok: boolean; updated: CompanionProfile } {
  const cleanJsonStr = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, updated: cur };
  try {
    const obj = JSON.parse(jsonMatch[0]);
    let next: CompanionProfile = { ...cur };
    if (obj.worldTitle && !next.name) next.name = String(obj.worldTitle);
    if (obj.mc && typeof obj.mc === 'object') {
      next = upsertCanonNpcAndCandidate(next, obj.mc);
    }
    if (obj.worldSetting) next.worldSetting = String(obj.worldSetting);
    if (obj.worldRules) next.worldRules = String(obj.worldRules);
    if (Array.isArray(obj.npcs) && obj.npcs.length) {
      const canonSet = new Set(
        (next.canonCandidates || []).map((c) =>
          (c.name || '').trim().toLowerCase(),
        ),
      );
      const parsedNpcs = obj.npcs.map(
        (
          n: {
            name?: string;
            role?: string;
            desc?: string;
            personality?: string;
            appearance?: string;
            relationships?: string;
            signature?: string;
          },
          i: number,
        ) => ({
          id: `npc_${Date.now()}_${i}`,
          name: String(n.name || `NPC ${i + 1}`),
          role: String(n.role || 'Đồng nhân'),
          desc: String(n.desc || n.appearance || ''),
          ...(n.personality ? { personality: String(n.personality).trim() } : {}),
          ...(n.appearance ? { appearance: String(n.appearance).trim() } : {}),
          ...(n.relationships
            ? { relationships: String(n.relationships).trim() }
            : {}),
          ...(n.signature ? { signature: String(n.signature).trim() } : {}),
        }),
      );
      const existingCanon = (next.npcs || []).filter((n) =>
        canonSet.has((n.name || '').trim().toLowerCase()),
      );
      const merged = [...existingCanon];
      for (const pn of parsedNpcs) {
        if (
          !merged.some(
            (m) =>
              (m.name || '').trim().toLowerCase() ===
              (pn.name || '').trim().toLowerCase(),
          )
        ) {
          merged.push(pn);
        }
      }
      next.npcs = merged;
    }
    return { ok: true, updated: next };
  } catch {
    return { ok: false, updated: cur };
  }
}

export function CompanionView({
  state,
  generatingPortraitIds,
  enrichingAppearanceIds,
  isEnrichingAppearances,
  enrichingNpcIds,
  isEnrichingAllNpcs,
  bgPortraitStatus,
  onUpdateActiveCompanion,
  onUpdatePortraitBank,
  onSyncPortraitsFromCompanion,
  onCleanJunkPortraits,
  onAutoFillAppearances,
  onRefreshPortraitAppearance,
  onEnrichNpcProfile,
  onEnrichAllNpcs,
  onGeneratePortrait,
  onCancelBgPortraits,
  onDownloadImage,
  onSelectCompanion,
  onCreateNewProfile,
  onDeleteProfile,
  onImportProfile,
  onEnterCompanionWorld,
  onNavigate,
  onNotify,
}: CompanionViewProps) {
  const cur = getActiveCompanionFromState(state);
  const [subTab, setSubTab] = useState<DnSubTab>('mc');
  const [statusLogs, setStatusLogs] = useState<string[]>([
    'Sẵn sàng tra cứu nguồn trên mạng hoặc phân tích tác phẩm gốc...',
  ]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Add NPC draft inputs
  const [npcName, setNpcName] = useState('');
  const [npcRole, setNpcRole] = useState('');
  const [npcAge, setNpcAge] = useState('');
  const [npcBirthday, setNpcBirthday] = useState('');
  const [npcFashionStyle, setNpcFashionStyle] = useState('');
  const [npcPersonality, setNpcPersonality] = useState('');
  const [npcAppearance, setNpcAppearance] = useState('');
  const [npcRelationships, setNpcRelationships] = useState('');
  const [npcSignature, setNpcSignature] = useState('');
  const [npcSearch, setNpcSearch] = useState('');
  const [companionSearch, setCompanionSearch] = useState('');

  // Inline NPC editor state
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [editNpcName, setEditNpcName] = useState('');
  const [editNpcRole, setEditNpcRole] = useState('');
  const [editNpcAge, setEditNpcAge] = useState('');
  const [editNpcBirthday, setEditNpcBirthday] = useState('');
  const [editNpcFashionStyle, setEditNpcFashionStyle] = useState('');
  const [editNpcPersonality, setEditNpcPersonality] = useState('');
  const [editNpcAppearance, setEditNpcAppearance] = useState('');
  const [editNpcRelationships, setEditNpcRelationships] = useState('');
  const [editNpcSignature, setEditNpcSignature] = useState('');
  const [editNpcDesc, setEditNpcDesc] = useState('');
  const [imagePickerTarget, setImagePickerTarget] =
    useState<ImagePickerTarget | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);

  const filteredNpcs = useMemo(() => {
    const list = (cur.npcs || []).map((npc, originalIdx) => ({
      npc,
      originalIdx,
    }));
    if (!npcSearch.trim()) return list;
    return list.filter(({ npc }) =>
      matchesQuery(
        `${npc.name} ${npc.role} ${npc.age || ''} ${npc.birthday || ''} ${npc.fashionStyle || ''} ${npc.desc} ${npc.personality || ''} ${npc.appearance || ''} ${npc.relationships || ''} ${npc.signature || ''}`,
        npcSearch,
      ),
    );
  }, [cur.npcs, npcSearch]);

  const filteredCompanions = useMemo(() => {
    if (!companionSearch.trim()) return state.companions;
    return state.companions.filter((c) => {
      const npcNames = (c.npcs || []).map((n) => n.name).join(' ');
      return matchesQuery(
        `${c.name} ${c.sourceQuery} ${c.role} ${c.mc?.name || ''} ${c.worldSetting} ${c.worldRules} ${c.note} ${npcNames}`,
        companionSearch,
      );
    });
  }, [state.companions, companionSearch]);

  const appendLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setStatusLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  const hasSourceData = Boolean(cur.sourceContent?.trim());

  // Build canon candidate dropdown options
  const canonPool: Array<{ name: string; label: string }> = [];
  const seenCanon = new Set<string>();
  (cur.canonCandidates || []).forEach((c) => {
    const key = (c.name || '').trim().toLowerCase();
    if (key && !seenCanon.has(key)) {
      seenCanon.add(key);
      canonPool.push({ name: c.name, label: `${c.name} (Nguyên tác)` });
    }
  });
  (cur.npcs || []).forEach((n) => {
    const key = (n.name || '').trim().toLowerCase();
    if (key && !seenCanon.has(key)) {
      seenCanon.add(key);
      canonPool.push({
        name: n.name,
        label: `${n.name}${n.role ? ` — ${n.role}` : ''}`,
      });
    }
  });

  const handleLookupOriginalWork = async (overrideQuery?: string) => {
    const query = (
      overrideQuery ??
      (cur.sourceQuery || cur.name || '')
    ).trim();
    if (!query) {
      onNotify(
        'Hãy nhập Tên tác phẩm gốc / Từ khóa để AI lấy nguồn trên mạng.',
        'err',
      );
      return null;
    }

    setIsLookingUp(true);
    appendLog(
      `Bắt đầu tra cứu chuyên sâu (chế độ đối chiếu & lọc nhiễu chặt) cho: "${query}"...`,
    );

    try {
      let webText = await runTimedLookupWithProgress(
        state,
        query,
        (elapsedSec, tick) => {
          if (tick % 2 === 0) {
            appendLog(
              `Đang đối chiếu & kiểm tra nguồn cho "${query}" (${elapsedSec}s)...`,
            );
          }
        },
      );

      if (!webText) {
        webText =
          `Tác phẩm / Chủ đề: ${query}\n` +
          `- Bối cảnh: Thế giới mở rộng dựa trên nguyên tác "${query}", bám sát thiết lập gốc và lọc bỏ các kết quả lệch chủ đề.\n` +
          '- Quy tắc: Các nhân vật giữ bản sắc cốt lõi của nguyên tác, mọi thay đổi lớn đều tạo phản ứng dây chuyền lên bối cảnh và các phe phái liên quan.\n' +
          '- Nhân vật tiêu biểu: Có thể bổ sung các nhân vật cốt lõi của nguyên tác vào danh sách NPC đồng nhân để tương tác trực tiếp.';
        appendLog(
          `Chưa tìm thấy bài khớp chuẩn cao từ nguồn mở hoặc chưa cấu hình Proxy AI; đã tạo khung tư liệu sạch cho "${query}" (không chèn kết quả lạc đề) — bạn có thể dán thêm nội dung truyện gốc vào ô phía trên rồi bấm PHÂN TÍCH TÁC PHẨM.`,
        );
      } else {
        appendLog(`Đã hoàn tất tra cứu & lọc nguồn cho "${query}".`);
      }

      const mergedContent = cur.sourceContent?.trim()
        ? `${cur.sourceContent.trim()}\n\n${webText}`
        : webText;

      onUpdateActiveCompanion((c) => ({
        ...c,
        sourceContent: mergedContent,
      }));
      onNotify(`Đã lấy nguồn tác phẩm gốc (đã lọc nhiễu) cho: ${query}`);
      return mergedContent;
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleAnalyzeSourceWork = async (overrideSourceContent?: string) => {
    const sourceText = (
      overrideSourceContent ?? (cur.sourceContent || '')
    ).trim();
    const query = (cur.sourceQuery || cur.name || 'Thế giới đồng nhân').trim();
    if (!sourceText && !query) {
      onNotify(
        'Hãy nhập tên tác phẩm hoặc dán nội dung tác phẩm gốc trước khi phân tích.',
        'err',
      );
      return;
    }

    setIsAnalyzing(true);
    appendLog(
      'Đang phân tích tác phẩm để tách Thế giới, Quy tắc, Nhân vật nguyên tác -> NPC...',
    );

    try {
      const aiPrompt =
        'Hãy phân tích tác phẩm đồng nhân sau và trả về CHỈ MỘT JSON hợp lệ (không giải thích ngoài JSON) theo cấu trúc:\n' +
        '{"worldTitle":"...","mc":{"name":"...","pronoun":"...","gender":"...","age":"...","personality":"...","appearance":"..."},"worldSetting":"...","worldRules":"...","npcs":[{"name":"...","role":"...","desc":"..."}]}\n\n' +
        `Tên/Từ khóa: ${query}\nNội dung tác phẩm gốc:\n${(
          sourceText || query
        ).slice(0, 3500)}`;

      const aiOut = await callAiJsonOrText(state, aiPrompt);

      onUpdateActiveCompanion((latest) => {
        const withLatestSource = overrideSourceContent
          ? { ...latest, sourceContent: overrideSourceContent }
          : latest;

        if (aiOut) {
          const parsed = parseStructuredFanficFromText(aiOut, withLatestSource);
          if (parsed.ok) {
            appendLog(
              'AI đã phân tích xong cấu trúc Đồng nhân (nhân vật chính gốc đã đưa sang NPC).',
            );
            return parsed.updated;
          }
        }

        const titleBase =
          withLatestSource.sourceQuery || withLatestSource.name || 'Đồng Nhân';
        let fallback = upsertCanonNpcAndCandidate(withLatestSource, {
          name: `Nhân vật chính nguyên tác (${titleBase})`,
          pronoun: '',
          gender: 'Nam',
          age: '',
          personality: 'Nhân vật trung tâm của mạch truyện nguyên tác.',
          appearance: '',
        });

        fallback = {
          ...fallback,
          worldSetting:
            fallback.worldSetting ||
            `Thế giới đồng nhân xây dựng từ "${titleBase}".\n${
              sourceText
                ? sourceText.slice(0, 600)
                : 'Bối cảnh mở đầu với nhiều mạch truyện và phe phái tương tác.'
            }`,
          worldRules:
            fallback.worldRules ||
            `1. Bám sát logic & bối cảnh của "${titleBase}".\n` +
              '2. Mỗi hành động, năng lực hoặc lựa chọn đều tạo hệ quả rõ ràng trong thế giới.\n' +
              '3. Giữ nhất quán tính cách và xưng hô của nhân vật chính và NPC.',
          npcs: fallback.npcs.length
            ? fallback.npcs
            : [
                {
                  id: `npc_${Date.now()}_1`,
                  name: 'Nhân vật đồng hành chủ chốt',
                  role: 'Đồng minh / Dẫn dắt',
                  desc: `Am hiểu bối cảnh "${titleBase}", phản hồi trực tiếp theo hành động và quyết định của nhân vật chính.`,
                },
                {
                  id: `npc_${Date.now()}_2`,
                  name: 'Đối thủ / Biến số phe phái',
                  role: 'Thử thách / Xung đột',
                  desc: 'Đại diện cho các quy tắc, mâu thuẫn hoặc thế lực đối lập trong thế giới đồng nhân.',
                },
              ],
        };
        appendLog(
          'Đã phân tích tư liệu và chuyển nhân vật chính nguyên tác sang NPC, giữ nguyên NVC tự tạo.',
        );
        return fallback;
      }, true);

      onNotify(
        'Đã phân tích xong: NVC tự tạo được giữ nguyên, nhân vật gốc đã chuyển sang NPC.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickGenerate = async () => {
    let queryToUse = cur.sourceQuery || cur.name;
    if (!queryToUse) {
      queryToUse = 'Thế giới Đồng Nhân Giả Tưởng';
      onUpdateActiveCompanion((c) => ({
        ...c,
        sourceQuery: 'Thế giới Đồng Nhân Giả Tưởng',
        name: 'Đồng Nhân — Khởi Tạo Nhanh',
      }));
    }
    let nextContent = cur.sourceContent;
    if (!nextContent?.trim()) {
      const fetched = await handleLookupOriginalWork(queryToUse);
      if (fetched) nextContent = fetched;
    }
    await handleAnalyzeSourceWork(nextContent);
    onNotify('AI Khởi tạo nhanh đã hoàn tất đầy đủ hồ sơ Đồng nhân.');
  };

  const handleRoleTypeChange = (roleType: McRoleType) => {
    onUpdateActiveCompanion((c) => {
      let originRole = c.mc.originRole || '';
      let canonMcRelation = c.mc.canonMcRelation || '';
      if (roleType === 'transmigrator') {
        if (!originRole.trim()) {
          originRole =
            'Người xuyên không vào thế giới nguyên tác, mang theo hiểu biết và con đường phát triển riêng.';
        }
        if (!canonMcRelation.trim()) {
          canonMcRelation =
            'Nhân vật chính nguyên tác vẫn tồn tại song song trong thế giới; có thể gặp gỡ, đồng hành hoặc tạo biến số.';
        }
      } else if (roleType === 'powerhouse') {
        if (!originRole.trim()) {
          originRole =
            'Đại năng / Cường giả đứng đầu một phương trong thế giới, am hiểu quy tắc và bí mật sâu xa.';
        }
        if (!canonMcRelation.trim()) {
          canonMcRelation =
            'Nhân vật chính nguyên tác vẫn hiện diện trong thế giới; nhân vật chính tự tạo có thể là tiền bối, đối thủ hoặc biến số lớn.';
        }
      }
      return {
        ...c,
        mc: { ...c.mc, roleType, originRole, canonMcRelation },
      };
    });
  };

  const handlePickCanonAsMc = (selectedName: string) => {
    if (!selectedName) return;
    const fromCand = (cur.canonCandidates || []).find(
      (c) => c.name === selectedName,
    );
    const fromNpc = (cur.npcs || []).find((n) => n.name === selectedName);
    const src =
      fromCand ||
      (fromNpc
        ? {
            name: fromNpc.name,
            pronoun: cur.mc?.pronoun || 'ta',
            gender: cur.mc?.gender || 'Nam',
            age: cur.mc?.age || '',
            personality: fromNpc.desc || '',
            appearance: cur.mc?.appearance || '',
            role: fromNpc.role || 'Nhân vật nguyên tác',
          }
        : null);
    if (!src) return;

    onUpdateActiveCompanion((c) => ({
      ...c,
      mc: {
        ...c.mc,
        sourceMode: 'canon',
        roleType: 'custom',
        name: src.name,
        pronoun: src.pronoun || c.mc.pronoun || 'ta',
        gender: src.gender || c.mc.gender || 'Nam',
        age: src.age || c.mc.age || '',
        personality: src.personality || c.mc.personality || '',
        appearance: src.appearance || c.mc.appearance || '',
        originRole:
          c.mc.originRole ||
          `Chọn trực tiếp từ nguyên tác: ${src.name}${
            src.role ? ` (${src.role})` : ''
          }`,
      },
    }));
    onNotify(`Đã chọn nhân vật nguyên tác làm nhân vật chính: ${src.name}`);
  };

  const handleAddNpc = () => {
    const name = npcName.trim();
    const celeb = lookupKnownCelebrityProfile(name);
    const role = npcRole.trim() || celeb?.role || 'Nhân vật đồng nhân';
    const birthday = npcBirthday.trim() || celeb?.birthday || '';
    const age =
      npcAge.trim() ||
      computeAgeFromBirthday(birthday, state.memory?.storyClock);
    const fashionStyle = npcFashionStyle.trim() || celeb?.fashionStyle || '';
    const personality = npcPersonality.trim() || celeb?.personality || '';
    const appearance = npcAppearance.trim() || celeb?.appearance || '';
    const relationships = npcRelationships.trim() || celeb?.relationships || '';
    const signature = npcSignature.trim() || celeb?.signature || '';
    const hasManualInput = Boolean(
      npcAge.trim() ||
        npcBirthday.trim() ||
        npcFashionStyle.trim() ||
        npcPersonality.trim() ||
        npcAppearance.trim() ||
        npcRelationships.trim() ||
        npcSignature.trim(),
    );
    const summaryDesc = [
      appearance,
      fashionStyle ? `Style: ${fashionStyle}` : '',
      personality,
      relationships,
      signature,
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 260);
    if (!name && !summaryDesc) {
      onNotify('Hãy nhập tên hoặc mô tả NPC đồng nhân.', 'err');
      return;
    }
    const createdId = `npc_${Date.now()}`;
    onUpdateActiveCompanion((c) => ({
      ...c,
      npcs: [
        {
          id: createdId,
          name: celeb?.canonicalName || name || `NPC ${(c.npcs?.length || 0) + 1}`,
          role,
          ...(age ? { age } : {}),
          ...(birthday ? { birthday } : {}),
          ...(fashionStyle ? { fashionStyle } : {}),
          desc: summaryDesc,
          ...(personality ? { personality } : {}),
          ...(appearance ? { appearance } : {}),
          ...(relationships ? { relationships } : {}),
          ...(signature ? { signature } : {}),
          profileManual: hasManualInput,
        },
        ...(c.npcs || []),
      ],
    }));
    setNpcName('');
    setNpcRole('');
    setNpcAge('');
    setNpcBirthday('');
    setNpcFashionStyle('');
    setNpcPersonality('');
    setNpcAppearance('');
    setNpcRelationships('');
    setNpcSignature('');
    onNotify(`Đã thêm NPC đồng nhân: ${celeb?.canonicalName || name || 'NPC mới'}`);
  };

  const startEditNpc = (npc: CompanionProfile['npcs'][number]) => {
    setEditingNpcId(npc.id);
    setEditNpcName(npc.name || '');
    setEditNpcRole(npc.role || '');
    setEditNpcAge(npc.age || '');
    setEditNpcBirthday(npc.birthday || '');
    setEditNpcFashionStyle(npc.fashionStyle || '');
    setEditNpcPersonality(npc.personality || '');
    setEditNpcAppearance(npc.appearance || '');
    setEditNpcRelationships(npc.relationships || '');
    setEditNpcSignature(npc.signature || '');
    setEditNpcDesc(npc.desc || '');
  };

  const saveEditNpc = (npcId: string) => {
    const cleanName = editNpcName.trim();
    if (!cleanName) {
      onNotify('Tên NPC không được để trống.', 'err');
      return;
    }
    const cleanRole = editNpcRole.trim() || 'Nhân vật đồng nhân';
    const cleanAge = editNpcAge.trim();
    const cleanBirth = editNpcBirthday.trim();
    const cleanFashion = editNpcFashionStyle.trim();
    const cleanPers = editNpcPersonality.trim();
    const cleanApp = editNpcAppearance.trim();
    const cleanRel = editNpcRelationships.trim();
    const cleanSig = editNpcSignature.trim();
    const fallbackDesc =
      [
        cleanApp,
        cleanFashion ? `Style: ${cleanFashion}` : '',
        cleanPers,
        cleanRel,
        cleanSig,
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 260) || editNpcDesc.trim();
    const hasAnyVivid = Boolean(
      cleanAge ||
        cleanBirth ||
        cleanFashion ||
        cleanPers ||
        cleanApp ||
        cleanRel ||
        cleanSig,
    );

    onUpdateActiveCompanion((c) => ({
      ...c,
      npcs: (c.npcs || []).map((n) =>
        n.id === npcId
          ? {
              ...n,
              name: cleanName,
              role: cleanRole,
              age: cleanAge || undefined,
              birthday: cleanBirth || undefined,
              fashionStyle: cleanFashion || undefined,
              desc: fallbackDesc,
              personality: cleanPers || undefined,
              appearance: cleanApp || undefined,
              relationships: cleanRel || undefined,
              signature: cleanSig || undefined,
              profileManual: hasAnyVivid,
            }
          : n,
      ),
    }));
    setEditingNpcId(null);
    onNotify(`Đã cập nhật hồ sơ NPC: ${cleanName}`);
  };

  const handleExportFanfic = () => {
    const safeName = (cur.name || 'Dong_Nhan').replace(
      /[^a-zA-Z0-9_\-À-ɏḀ-ỿ]+/g,
      '_',
    );
    triggerDownloadJson(`ARK_DongNhan_${safeName}.json`, cur);
    onNotify(`Đã xuất file Đồng nhân (.json): ${cur.name || 'Đồng nhân'}`);
  };

  const handleImportFanficFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Cấu trúc JSON không hợp lệ');
      }
      const imported: CompanionProfile = {
        id: `comp_${Date.now()}`,
        name: String(parsed.name || 'Đồng nhân nhập từ file'),
        role: String(parsed.role || parsed.sourceQuery || 'Đồng nhân / AU'),
        sourceQuery: String(parsed.sourceQuery || ''),
        sourceContent: String(parsed.sourceContent || ''),
        mc: {
          sourceMode: parsed.mc?.sourceMode === 'canon' ? 'canon' : 'custom',
          name: String(parsed.mc?.name || ''),
          pronoun: String(parsed.mc?.pronoun || ''),
          roleType: parsed.mc?.roleType || 'transmigrator',
          canonMcName: String(parsed.mc?.canonMcName || ''),
          originRole: String(parsed.mc?.originRole || ''),
          canonMcRelation: String(parsed.mc?.canonMcRelation || ''),
          gender: String(parsed.mc?.gender || ''),
          age: String(parsed.mc?.age || ''),
          personality: String(parsed.mc?.personality || ''),
          appearance: String(parsed.mc?.appearance || ''),
        },
        worldSetting: String(parsed.worldSetting || ''),
        worldRules: String(parsed.worldRules || ''),
        npcs: Array.isArray(parsed.npcs) ? parsed.npcs : [],
        canonCandidates: Array.isArray(parsed.canonCandidates)
          ? parsed.canonCandidates
          : [],
        note: String(parsed.note || ''),
      };
      onImportProfile(imported);
    } catch (err) {
      onNotify(
        `Không thể nạp file Đồng nhân: ${
          err instanceof Error ? err.message : String(err)
        }`,
        'err',
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <section className="space-y-4">
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFanficFile}
      />

      {/* Source Research & Analysis Card */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label="Quay về sảnh"
              onClick={() => onNavigate('lobby')}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-50">
                Đồng Nhân
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Tra cứu tác phẩm gốc trên mạng, phân tích thế giới, quy tắc,
                nhân vật chính &amp; NPC.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLookingUp || isAnalyzing}
            onClick={() => handleLookupOriginalWork()}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>
              {isLookingUp ? 'Đang tra cứu...' : 'AI Tra Tác Phẩm Gốc'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Tên tác phẩm gốc / Từ khóa tra mạng
            </label>
            <input
              type="text"
              value={cur.sourceQuery || ''}
              onChange={(e) =>
                onUpdateActiveCompanion((c) => ({
                  ...c,
                  sourceQuery: e.target.value,
                  role: e.target.value || 'Đồng nhân / AU',
                }))
              }
              placeholder="Ví dụ: Harry Potter, Tây Du Ký, Ma Đạo Tổ Sư..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Tên bản Đồng Nhân / AU
            </label>
            <input
              type="text"
              value={cur.name || ''}
              onChange={(e) =>
                onUpdateActiveCompanion((c) => ({
                  ...c,
                  name: e.target.value,
                }))
              }
              placeholder="Ví dụ: Hogwarts Hiện Đại, AU Giang Hồ..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-300">
              Nội dung tác phẩm gốc
            </label>
            <span
              className={`text-xs font-medium ${
                isLookingUp
                  ? 'text-sky-300'
                  : hasSourceData
                    ? 'text-emerald-300'
                    : 'text-slate-400'
              }`}
            >
              {isLookingUp
                ? 'Đang tra chuyên sâu...'
                : hasSourceData
                  ? 'Đã có tư liệu'
                  : 'Chưa tra cứu'}
            </span>
          </div>
          <textarea
            value={cur.sourceContent || ''}
            onChange={(e) =>
              onUpdateActiveCompanion((c) => ({
                ...c,
                sourceContent: e.target.value,
              }))
            }
            rows={4}
            placeholder="Dán nội dung truyện, tóm tắt cốt truyện hoặc kết quả AI tra tác phẩm gốc trên mạng vào đây..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isAnalyzing || isLookingUp}
            onClick={() => handleAnalyzeSourceWork()}
            className="min-h-[38px] flex-1 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] disabled:opacity-45 whitespace-nowrap"
          >
            {isAnalyzing ? 'Đang phân tích...' : 'Phân tích tác phẩm'}
          </button>
          <button
            type="button"
            disabled={isLookingUp || isAnalyzing}
            onClick={() => handleLookupOriginalWork()}
            className="min-h-[38px] rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
          >
            Lấy nguồn trên mạng
          </button>
        </div>

        <div className="mt-3.5 max-h-28 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0c1422]/90 p-3 font-mono text-xs whitespace-pre-wrap break-words text-slate-300">
          {statusLogs.join('\n')}
        </div>
      </div>

      {/* Sub-tabs Studio Card */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div
          className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07] sm:grid-cols-4"
          role="tablist"
        >
          {(
            [
              { id: 'mc', label: 'Nhân vật chính' },
              { id: 'world', label: 'Thế giới & Quy tắc' },
              { id: 'npcs', label: `NPC (${cur.npcs?.length || 0})` },
              {
                id: 'portraits',
                label: `Ảnh NV (${(state.portraitBank?.portraits || []).filter((p) => Boolean(p.imageData)).length}/${state.portraitBank?.portraits?.length || 0})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={subTab === t.id}
              onClick={() => setSubTab(t.id)}
              className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-all whitespace-nowrap truncate ${
                subTab === t.id
                  ? 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/35 shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: MC */}
        {subTab === 'mc' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nguồn nhân vật chính
                </label>
                <select
                  value={cur.mc?.sourceMode === 'canon' ? 'canon' : 'custom'}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: {
                        ...c.mc,
                        sourceMode: e.target.value as McSourceMode,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="custom">
                    NVC tự tạo (giữ nguyên khi phân tích)
                  </option>
                  <option value="canon">Chọn nhân vật trong nguyên tác</option>
                </select>
              </div>

              {cur.mc?.sourceMode === 'canon' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Chọn nhân vật từ nguyên tác
                  </label>
                  <select
                    value=""
                    onChange={(e) => handlePickCanonAsMc(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  >
                    <option value="">-- Chọn nhân vật nguyên tác / NPC --</option>
                    {canonPool.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tên nhân vật chính
                </label>
                <input
                  type="text"
                  value={cur.mc?.name || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, name: e.target.value },
                    }))
                  }
                  placeholder="Để trống nếu muốn AI tự đặt tên nhân vật..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Xưng hô
                </label>
                <input
                  type="text"
                  value={cur.mc?.pronoun || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, pronoun: e.target.value },
                    }))
                  }
                  placeholder="Để trống nếu muốn AI tự quyết định xưng hô..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Dạng vai trò nhân vật chính
                </label>
                <select
                  value={cur.mc?.roleType || 'transmigrator'}
                  onChange={(e) =>
                    handleRoleTypeChange(e.target.value as McRoleType)
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="transmigrator">
                    Người xuyên không / Chuyển sinh
                  </option>
                  <option value="powerhouse">
                    Đại năng / Cường giả thế giới
                  </option>
                  <option value="custom">Tự tạo nhân vật chính</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nhân vật chính nguyên tác (vẫn có trong truyện)
                </label>
                <input
                  type="text"
                  value={cur.mc?.canonMcName || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, canonMcName: e.target.value },
                    }))
                  }
                  placeholder="VD: Hàn Lập, Harry Potter, Tôn Ngộ Không..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Thân phận xuyên không / Đại năng / Lai lịch
              </label>
              <textarea
                value={cur.mc?.originRole || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, originRole: e.target.value },
                  }))
                }
                rows={2}
                placeholder="Mô tả thân phận xuyên không, cơ duyên, hoặc cảnh giới/lai lịch đại năng..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Mối liên hệ với nhân vật chính nguyên tác
              </label>
              <textarea
                value={cur.mc?.canonMcRelation || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, canonMcRelation: e.target.value },
                  }))
                }
                rows={2}
                placeholder="Ví dụ: Nhân vật chính nguyên tác vẫn tồn tại song song; hai bên đồng hành, gặp gỡ hoặc tạo biến số..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Giới tính
                </label>
                <input
                  type="text"
                  value={cur.mc?.gender || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, gender: e.target.value },
                    }))
                  }
                  placeholder="Nam / Nữ / Khác..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tuổi
                </label>
                <input
                  type="text"
                  value={cur.mc?.age || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, age: e.target.value },
                    }))
                  }
                  placeholder="VD: 20"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Tính cách
              </label>
              <textarea
                value={cur.mc?.personality || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, personality: e.target.value },
                  }))
                }
                rows={3}
                placeholder="Mô tả tính cách nhân vật..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Ngoại hình
              </label>
              <textarea
                value={cur.mc?.appearance || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, appearance: e.target.value },
                  }))
                }
                rows={3}
                placeholder="Mô tả ngoại hình nhân vật..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>
        )}

        {/* TAB 2: WORLD & RULES */}
        {subTab === 'world' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Bối cảnh &amp; Không gian thế giới
              </label>
              <textarea
                value={cur.worldSetting || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    worldSetting: e.target.value,
                    note: [e.target.value, c.worldRules]
                      .filter(Boolean)
                      .join(' | ')
                      .slice(0, 240),
                  }))
                }
                rows={4}
                placeholder="Thời đại, địa điểm, phe phái, bối cảnh lịch sử hoặc giả tưởng..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Quy tắc thế giới &amp; Hệ thống sức mạnh / Luật lệ
              </label>
              <textarea
                value={cur.worldRules || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    worldRules: e.target.value,
                    note: [c.worldSetting, e.target.value]
                      .filter(Boolean)
                      .join(' | ')
                      .slice(0, 240),
                  }))
                }
                rows={4}
                placeholder="Quy tắc vận hành thế giới, giới hạn năng lực, cấm kỵ, điều kiện kích hoạt, luật nhân quả..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>
        )}

        {/* TAB 3: NPCs */}
        {subTab === 'npcs' && (
          <div className="space-y-3">
            <div className="space-y-2.5 rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.07]">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Tên NPC / Nhân vật đồng nhân
                  </label>
                  <input
                    type="text"
                    value={npcName}
                    onChange={(e) => setNpcName(e.target.value)}
                    placeholder="Ví dụ: Jennie Kim, Kendall Jenner, Central Cee..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Vai trò / Nghề nghiệp &amp; vị thế
                  </label>
                  <input
                    type="text"
                    value={npcRole}
                    onChange={(e) => setNpcRole(e.target.value)}
                    placeholder="Siêu mẫu, rapper UK, DJ Hollywood, sư phụ..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Tuổi tác
                  </label>
                  <input
                    type="text"
                    value={npcAge}
                    onChange={(e) => setNpcAge(e.target.value)}
                    placeholder="VD: 28 tuổi (tự tính theo mốc truyện nếu để trống)"
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Ngày sinh
                  </label>
                  <input
                    type="text"
                    value={npcBirthday}
                    onChange={(e) => setNpcBirthday(e.target.value)}
                    placeholder="VD: 04/06/1998 hoặc 16/01/1996"
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Style ăn mặc
                </label>
                <textarea
                  value={npcFashionStyle}
                  onChange={(e) => setNpcFashionStyle(e.target.value)}
                  rows={2}
                  placeholder="Gu ăn mặc đúng nghề nghiệp & bối cảnh (VD: streetwear London, tracksuit/puffer/hoodie, quiet luxury, đồ thiết kế cá tính... tránh rập khuôn vest)"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Tính cách &amp; khí chất đặc trưng
                  </label>
                  <textarea
                    value={npcPersonality}
                    onChange={(e) => setNpcPersonality(e.target.value)}
                    rows={2}
                    placeholder="Cách nói chuyện, thói quen, phản ứng khi gặp tình huống bất ngờ/căng thẳng..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Ngoại hình
                  </label>
                  <textarea
                    value={npcAppearance}
                    onChange={(e) => setNpcAppearance(e.target.value)}
                    rows={2}
                    placeholder="Vóc dáng, kiểu tóc, nét mặt, thần thái đúng độ tuổi..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Mối quan hệ &amp; thái độ
                  </label>
                  <input
                    type="text"
                    value={npcRelationships}
                    onChange={(e) => setNpcRelationships(e.target.value)}
                    placeholder="Thân thiết, dè chừng, nể trọng, đồng minh..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Điểm nhấn / Câu cửa miệng / Chi tiết ghi nhớ
                  </label>
                  <input
                    type="text"
                    value={npcSignature}
                    onChange={(e) => setNpcSignature(e.target.value)}
                    placeholder="Thói quen nhỏ, câu nói đặc trưng, chi tiết đáng nhớ..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleAddNpc}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm NPC</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateActiveCompanion((c) => c, true);
                    onNotify(`Đã lưu hồ sơ Đồng nhân: ${cur.name}`);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.98] whitespace-nowrap"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Lưu hồ sơ Đồng nhân</span>
                </button>
                {(cur.npcs || []).length > 0 && (
                  <button
                    type="button"
                    disabled={isEnrichingAllNpcs}
                    onClick={onEnrichAllNpcs}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-indigo-500/16 px-3 text-xs font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/30 transition-all hover:bg-indigo-500/24 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
                  >
                    {isEnrichingAllNpcs ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isEnrichingAllNpcs
                        ? 'Đang làm sinh động...'
                        : 'Làm sinh động tất cả NPC'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {(cur.npcs || []).length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={npcSearch}
                      onChange={(e) => setNpcSearch(e.target.value)}
                      aria-label="Tìm kiếm NPC đồng nhân"
                      placeholder="Tìm NPC theo tên, vai trò, tính cách, ngoại hình..."
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                    {npcSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm NPC"
                        onClick={() => setNpcSearch('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {npcSearch.trim() && (
                    <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {filteredNpcs.length} / {cur.npcs.length}
                    </span>
                  )}
                </div>
              )}

              {!(cur.npcs || []).length ? (
                <p className="rounded-xl bg-[#111b2c]/70 p-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                  Chưa có NPC đồng nhân nào. Bạn có thể bấm &quot;Thêm NPC&quot;
                  hoặc dùng AI Phân tích / AI Khởi tạo nhanh.
                </p>
              ) : !filteredNpcs.length ? (
                <p className="rounded-xl bg-[#111b2c]/70 p-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                  Không tìm thấy NPC nào khớp với &quot;{npcSearch.trim()}&quot;.
                </p>
              ) : (
                filteredNpcs.map(({ npc, originalIdx }) => {
                  const isEditingThis = editingNpcId === npc.id;
                  const isEnrichingThis = enrichingNpcIds.includes(npc.id);
                  const ageBirthLabel = formatAgeBirthdayLabel(
                    npc.age,
                    npc.birthday,
                  );
                  const hasStructured = Boolean(
                    npc.fashionStyle?.trim() ||
                      npc.personality?.trim() ||
                      npc.appearance?.trim() ||
                      npc.relationships?.trim() ||
                      npc.signature?.trim(),
                  );
                  return (
                    <div
                      key={npc.id || originalIdx}
                      className="rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.07]"
                    >
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={editNpcName}
                              onChange={(e) => setEditNpcName(e.target.value)}
                              placeholder="Tên NPC"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs font-semibold text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                            <input
                              type="text"
                              value={editNpcRole}
                              onChange={(e) => setEditNpcRole(e.target.value)}
                              placeholder="Vai trò / Nghề nghiệp & vị thế"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editNpcAge}
                              onChange={(e) => setEditNpcAge(e.target.value)}
                              placeholder="Tuổi (VD: 28 tuổi)"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                            <input
                              type="text"
                              value={editNpcBirthday}
                              onChange={(e) =>
                                setEditNpcBirthday(e.target.value)
                              }
                              placeholder="Ngày sinh (VD: 04/06/1998)"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                          </div>
                          <textarea
                            value={editNpcFashionStyle}
                            onChange={(e) =>
                              setEditNpcFashionStyle(e.target.value)
                            }
                            rows={2}
                            placeholder="Style ăn mặc theo nghề nghiệp & bối cảnh (tránh rập khuôn vest)..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <textarea
                            value={editNpcPersonality}
                            onChange={(e) =>
                              setEditNpcPersonality(e.target.value)
                            }
                            rows={2}
                            placeholder="Tính cách & khí chất đặc trưng..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <textarea
                            value={editNpcAppearance}
                            onChange={(e) =>
                              setEditNpcAppearance(e.target.value)
                            }
                            rows={2}
                            placeholder="Ngoại hình (vóc dáng, kiểu tóc, nét mặt, thần thái)..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <textarea
                            value={editNpcRelationships}
                            onChange={(e) =>
                              setEditNpcRelationships(e.target.value)
                            }
                            rows={2}
                            placeholder="Mối quan hệ & thái độ..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <input
                            type="text"
                            value={editNpcSignature}
                            onChange={(e) =>
                              setEditNpcSignature(e.target.value)
                            }
                            placeholder="Điểm nhấn / Câu cửa miệng / Chi tiết ghi nhớ..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => saveEditNpc(npc.id)}
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/16 px-2.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Lưu thay đổi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNpcId(null)}
                              className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
                              <CharacterNameBadge
                                name={npc.name || `NPC ${originalIdx + 1}`}
                                variant="list"
                              />
                              <span className="text-xs text-slate-400">
                                · {npc.role || 'Đồng nhân'}
                              </span>
                              {ageBirthLabel && (
                                <span className="text-xs tabular-nums text-cyan-200/90">
                                  · {ageBirthLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                disabled={isEnrichingThis}
                                onClick={() => onEnrichNpcProfile(npc.id, true)}
                                title="Làm sinh động hồ sơ, tuổi tác & style ăn mặc của NPC này bằng AI"
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-indigo-500/15 px-2.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/28 transition-all hover:bg-indigo-500/24 disabled:opacity-45 whitespace-nowrap"
                              >
                                {isEnrichingThis ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Wand2 className="h-3 w-3" />
                                )}
                                <span>
                                  {isEnrichingThis
                                    ? 'Đang làm...'
                                    : 'Làm sinh động'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditNpc(npc)}
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Sửa</span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa NPC ${npc.name}`}
                                onClick={() =>
                                  onUpdateActiveCompanion((c) => ({
                                    ...c,
                                    npcs: c.npcs.filter(
                                      (_, i) => i !== originalIdx,
                                    ),
                                  }))
                                }
                                className="inline-flex min-h-[30px] items-center justify-center rounded-lg bg-rose-500/14 px-2 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {hasStructured ? (
                            <div className="mt-2.5 space-y-1.5 text-xs leading-relaxed">
                              {npc.fashionStyle?.trim() && (
                                <div>
                                  <span className="font-semibold text-violet-300">
                                    Style ăn mặc:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.fashionStyle}
                                  </span>
                                </div>
                              )}
                              {npc.personality?.trim() && (
                                <div>
                                  <span className="font-semibold text-sky-300">
                                    Tính cách &amp; khí chất:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.personality}
                                  </span>
                                </div>
                              )}
                              {npc.appearance?.trim() && (
                                <div>
                                  <span className="font-semibold text-indigo-300">
                                    Ngoại hình:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.appearance}
                                  </span>
                                </div>
                              )}
                              {npc.relationships?.trim() && (
                                <div>
                                  <span className="font-semibold text-emerald-300">
                                    Quan hệ &amp; thái độ:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.relationships}
                                  </span>
                                </div>
                              )}
                              {npc.signature?.trim() && (
                                <div>
                                  <span className="font-semibold text-amber-300">
                                    Điểm nhấn:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.signature}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            npc.desc && (
                              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                                {npc.desc}
                              </p>
                            )
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHARACTER / NPC PORTRAIT BANK */}
        {subTab === 'portraits' && (
          <PortraitBankPanel
            portraitBank={state.portraitBank}
            activeCompanionName={cur.name || 'Đồng nhân'}
            storyClock={state.memory?.storyClock}
            hasSeedreamConfigured={Boolean(
              (state.config.seedreamUrl || state.config.proxyUrl || '').trim(),
            )}
            generatingPortraitIds={generatingPortraitIds}
            enrichingAppearanceIds={enrichingAppearanceIds}
            isEnrichingAppearances={isEnrichingAppearances}
            bgPortraitStatus={bgPortraitStatus}
            onNavigate={onNavigate}
            onUpdatePortraitBank={onUpdatePortraitBank}
            onSyncFromCompanion={onSyncPortraitsFromCompanion}
            onCleanJunkPortraits={onCleanJunkPortraits}
            onAutoFillAppearances={onAutoFillAppearances}
            onRefreshPortraitAppearance={onRefreshPortraitAppearance}
            onGeneratePortrait={onGeneratePortrait}
            onCancelBgPortraits={onCancelBgPortraits}
            onDownloadImage={onDownloadImage}
            onOpenImagePicker={(portraitId, portraitName) =>
              setImagePickerTarget({
                mode: 'character',
                portraitId,
                portraitName,
              })
            }
          />
        )}

        {/* 3-Button Dock Bar */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3.5">
          <button
            type="button"
            disabled={isLookingUp || isAnalyzing}
            onClick={handleQuickGenerate}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl bg-sky-500/16 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.985] disabled:opacity-45"
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Khởi tạo
            </span>
            <span className="text-[10px] font-medium text-sky-200/80">Nhanh</span>
          </button>

          <button
            type="button"
            onClick={handleExportFanfic}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.055] px-2 py-2 text-center text-[11px] font-bold tracking-wide text-slate-100 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] active:scale-[0.985]"
          >
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3" />
              File ĐN
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Xuất JSON
            </span>
          </button>

          <button
            type="button"
            onClick={onEnterCompanionWorld}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-white shadow-[0_8px_18px_-6px_rgba(16,185,129,0.45)] transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-[0.985]"
          >
            <span>Áp dụng &amp;</span>
            <span className="text-[10px] font-medium text-emerald-50/90">
              Vào truyện
            </span>
          </button>
        </div>
      </div>

      {/* Saved Fanfic Profiles List */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-50">
              Danh sách Thế giới Đồng nhân đã lưu
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Chọn nhanh, nạp file ĐN (.json) hoặc tạo thêm hồ sơ đồng nhân khác.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Nạp file ĐN</span>
            </button>
            <button
              type="button"
              onClick={onCreateNewProfile}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Hồ sơ mới</span>
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={companionSearch}
              onChange={(e) => setCompanionSearch(e.target.value)}
              aria-label="Tìm nhanh hồ sơ đồng nhân"
              placeholder="Tìm nhanh thế giới đồng nhân, tác phẩm gốc, NVC, NPC..."
              className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {companionSearch && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm hồ sơ đồng nhân"
                onClick={() => setCompanionSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {companionSearch.trim() && (
            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
              {filteredCompanions.length} / {state.companions.length}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {!filteredCompanions.length ? (
            <p className="rounded-xl bg-[#111b2c]/70 p-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
              Không tìm thấy hồ sơ đồng nhân nào khớp với &quot;
              {companionSearch.trim()}&quot;.
            </p>
          ) : (
            filteredCompanions.map((c, idx) => {
              const isAct = c.id === state.activeCompanionId;
              const npcCount = c.npcs?.length || 0;
              const metaLine = [
                c.mc?.name ? `NV chính: ${c.mc.name}` : '',
                npcCount ? `${npcCount} NPC` : '',
                c.worldSetting || c.note || '',
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={c.id}
                  className={`rounded-xl p-3.5 ring-1 ring-inset transition-colors ${
                    isAct
                      ? 'bg-sky-500/[0.09] ring-sky-400/35'
                      : 'bg-[#111b2c]/85 ring-white/[0.07]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-50">
                      {c.name || `Đồng nhân ${idx + 1}`}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isAct ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      {isAct
                        ? 'Đang chọn'
                        : c.sourceQuery || c.role || 'Đồng nhân'}
                    </span>
                  </div>
                  {metaLine && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {metaLine}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectCompanion(c.id)}
                      className={`min-h-[34px] rounded-xl px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                        isAct
                          ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28'
                          : 'bg-sky-500/16 text-sky-100 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24'
                      }`}
                    >
                      {isAct ? 'Đang dùng' : 'Chọn dùng'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProfile(c.id)}
                      className="min-h-[34px] rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22 whitespace-nowrap"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lightweight On-Demand Image Picker Modal */}
      {imagePickerTarget && (
        <ImagePickerModal
          target={imagePickerTarget}
          portraits={state.portraitBank?.portraits || []}
          turns={state.turns || []}
          currentPage={state.currentPage}
          onClose={() => setImagePickerTarget(null)}
          onAssignToCharacter={(portraitId, src) => {
            const targetChar = (state.portraitBank?.portraits || []).find(
              (p) => p.id === portraitId,
            );
            onUpdatePortraitBank((prev) => ({
              ...prev,
              portraits: (prev.portraits || []).map((p) =>
                p.id === portraitId
                  ? { ...p, imageData: src, updatedAt: Date.now() }
                  : p,
              ),
            }));
            onNotify(
              `Đã gán ảnh chân dung cho ${targetChar?.name || 'nhân vật'}.`,
            );
          }}
        />
      )}
    </section>
  );
}
