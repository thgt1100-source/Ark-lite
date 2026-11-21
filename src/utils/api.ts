import type {
  ArkState,
  CharacterPortrait,
  CharacterStateSnapshot,
  CompanionNpc,
  CompanionProfile,
  DramaLevel,
  MemoryEntry,
  MemoryEntryCategory,
  StoryImageConfig,
  Turn,
  WorldGenreId,
  WorldSetupNpcDraft,
} from '../types/ark';
import {
  buildAllowedRosterKeys,
  computeAgeFromBirthday,
  extractSpeakerPrefixFromLine,
  findExactProperNameInText,
  findKnownCelebritiesInText,
  isCharacterExplicitlyAbsent,
  isEnglishHeadingOrMetaPhrase,
  isEnglishTitleCaseHeadingLine,
  isMcPresentInTurn,
  lookupKnownCelebrityProfile,
  normalizeCharacterKey,
  resolveLocalVividNpcProfile,
  sanitizeCharacterName,
} from './characterUtils';
import {
  isEnglishThinkingBlock,
  isEnglishThinkingHeadingLine,
  repairTruncatedJson,
  sanitizeCompletedStoryResponse,
  splitNarrativeAndMeta,
} from './saveParser';
import { DEFAULT_SAFETY, getActiveCompanionFromState } from './storage';
import {
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from './storyClock';
import { formatCultivationContextBlock } from './cultivation';
import {
  applyImageStyleVariables,
  DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  getAllImageStyles,
  HAS_ANY_IMAGE_TEMPLATE_VAR_RE,
  IMAGE_CAMERA_ANGLES,
  IMAGE_GENERATION_MODE_LABELS,
  IMAGE_GRID_MODE_LABELS,
  IMAGE_PROMPT_TEMPLATE_VARIABLES,
  IMAGE_STYLE_VARIABLES,
  interpolateImagePromptTemplate,
  normalizeStoryImageStyleId,
  resolveCameraAngle,
  resolveStoryImageStyle,
  STORY_IMAGE_STYLES,
} from './imageStyles';

export {
  applyImageStyleVariables,
  DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  getAllImageStyles,
  HAS_ANY_IMAGE_TEMPLATE_VAR_RE,
  IMAGE_CAMERA_ANGLES,
  IMAGE_GENERATION_MODE_LABELS,
  IMAGE_GRID_MODE_LABELS,
  IMAGE_PROMPT_TEMPLATE_VARIABLES,
  IMAGE_STYLE_VARIABLES,
  interpolateImagePromptTemplate,
  normalizeCharacterKey,
  normalizeStoryImageStyleId,
  resolveCameraAngle,
  resolveStoryImageStyle,
  STORY_IMAGE_STYLES,
};

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContentPart[];
}

export function buildEndpointCandidates(
  baseUrl: string,
  model: string,
  isStream: boolean,
  isGemini: boolean,
): string[] {
  const clean = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return [];
  if (isGemini) {
    if (/:(generateContent|streamGenerateContent)/i.test(clean)) {
      return [clean];
    }
    const m = encodeURIComponent(model || 'gemini-2.5-pro');
    const action = isStream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const withoutV1 = clean.replace(/\/v1(beta)?$/i, '');
    return Array.from(
      new Set([
        `${withoutV1}/v1beta/models/${m}:${action}`,
        `${withoutV1}/models/${m}:${action}`,
      ]),
    );
  }
  if (/\/chat\/completions$/i.test(clean)) return [clean];
  if (/\/v1$/i.test(clean)) return [`${clean}/chat/completions`];
  return [`${clean}/v1/chat/completions`, `${clean}/chat/completions`];
}

export function buildMessagesPayload(
  state: ArkState,
  turnIndex: number,
): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const activeComp = getActiveCompanionFromState(state);

  if (activeComp) {
    const npcLines =
      Array.isArray(activeComp.npcs) && activeComp.npcs.length
        ? activeComp.npcs
            .map((n) => {
              const effectiveAge =
                n.age?.trim() ||
                computeAgeFromBirthday(n.birthday, state.memory?.storyClock);
              const details = [
                effectiveAge ? `Tuổi: ${effectiveAge}` : '',
                n.birthday?.trim() ? `Ngày sinh: ${n.birthday.trim()}` : '',
                n.fashionStyle?.trim()
                  ? `Style ăn mặc: ${n.fashionStyle.trim()}`
                  : '',
                n.personality?.trim() ? `Tính cách: ${n.personality.trim()}` : '',
                n.appearance?.trim() ? `Ngoại hình: ${n.appearance.trim()}` : '',
                n.relationships?.trim() ? `Quan hệ: ${n.relationships.trim()}` : '',
                n.signature?.trim() ? `Điểm nhấn: ${n.signature.trim()}` : '',
              ].filter(Boolean);
              const body = details.length
                ? details.join(' | ')
                : (n.desc || '').trim();
              return `- ${n.name || 'NPC'}${n.role ? ` (${n.role})` : ''}${body ? `: ${body}` : ''}`;
            })
            .join('\n')
        : '';
    const mc = activeComp.mc || ({} as CompanionProfile['mc']);
    const roleLabels: Record<string, string> = {
      transmigrator: 'Người xuyên không / Chuyển sinh',
      powerhouse: 'Đại năng / Cường giả thế giới',
      custom: 'Nhân vật chính tự tạo',
    };
    const mcRoleText = (mc.roleType && roleLabels[mc.roleType]) || mc.roleType || '';
    const mcSummary = [
      mc.name ? `Tên: ${mc.name}` : '',
      mc.pronoun ? `Xưng hô: ${mc.pronoun}` : '',
      mcRoleText ? `Dạng vai trò: ${mcRoleText}` : '',
      mc.originRole ? `Thân phận/Lai lịch: ${mc.originRole}` : '',
      mc.canonMcName ? `Nhân vật chính nguyên tác song song: ${mc.canonMcName}` : '',
      mc.canonMcRelation ? `Liên hệ NV chính gốc: ${mc.canonMcRelation}` : '',
      mc.gender ? `Giới tính: ${mc.gender}` : '',
      mc.age ? `Tuổi: ${mc.age}` : '',
      mc.personality ? `Tính cách: ${mc.personality}` : '',
      mc.appearance ? `Ngoại hình: ${mc.appearance}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const compSummary = [
      '[HỒ SƠ ĐỒNG NHÂN ĐANG ÁP DỤNG]',
      activeComp.name ? `Tên bản đồng nhân / thế giới: ${activeComp.name}` : '',
      activeComp.sourceQuery
        ? `Tác phẩm gốc / Thể loại: ${activeComp.sourceQuery}`
        : '',
      mcSummary ? `Nhân vật chính (người chơi tự tạo) -> ${mcSummary}` : '',
      mc.canonMcName || mc.canonMcRelation
        ? `Thiết lập nhân vật gốc: Nhân vật chính nguyên tác${
            mc.canonMcName ? ` (${mc.canonMcName})` : ''
          } vẫn tồn tại trong thế giới, đồng thời tôn trọng nhân vật chính tự tạo của người chơi.`
        : '',
      activeComp.worldSetting ? `Bối cảnh & Thế giới: ${activeComp.worldSetting}` : '',
      activeComp.worldRules ? `Quy tắc thế giới: ${activeComp.worldRules}` : '',
      npcLines ? `Danh sách NPC đồng nhân:\n${npcLines}` : '',
      activeComp.sourceContent
        ? `Tư liệu tác phẩm gốc:\n${activeComp.sourceContent.slice(0, 2400)}`
        : '',
      activeComp.note ? `Ghi chú bổ sung: ${activeComp.note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (compSummary.trim() !== '[HỒ SƠ ĐỒNG NHÂN ĐANG ÁP DỤNG]') {
      msgs.push({ role: 'system', content: compSummary });
    }
  }

  // Inject World Setup & Protagonist Presence rules when initialized
  const wInfo = state.world;
  const pInfo = state.player;
  const dramaLabels: Record<DramaLevel, string> = {
    chill: 'Nhẹ nhàng / Đời thường (ưu tiên đối thoại tự nhiên, nhịp chậm rãi, không tạo drama gượng ép)',
    balanced: 'Cân bằng (kết hợp tương tác tự nhiên và các điểm nhấn cao trào hợp lý)',
    intense: 'Kịch tính / Căng thẳng (nhiều nút thắt, áp lực, bí mật và lựa chọn đánh đổi)',
  };
  const hasRichWorldOrPlayer = Boolean(
    wInfo?.genreLabel ||
      wInfo?.setting ||
      wInfo?.rules ||
      wInfo?.atmosphere ||
      wInfo?.dramaLevel ||
      wInfo?.openingScenario ||
      pInfo?.role ||
      pInfo?.description ||
      pInfo?.absentAtStart,
  );
  if (hasRichWorldOrPlayer) {
    const worldSetupLines = [
      '[THIẾT LẬP THẾ GIỚI & NHÂN VẬT KHỞI ĐẦU]',
      wInfo?.name ? `Tên thế giới / phiên chơi: ${wInfo.name}` : '',
      wInfo?.genreLabel ? `Thể loại / Kiểu thế giới: ${wInfo.genreLabel}` : '',
      wInfo?.atmosphere ? `Không khí & tông màu: ${wInfo.atmosphere}` : '',
      wInfo?.dramaLevel
        ? `Mức độ kịch tính: ${dramaLabels[wInfo.dramaLevel] || wInfo.dramaLevel}`
        : '',
      wInfo?.setting ? `Bối cảnh chính: ${wInfo.setting}` : '',
      wInfo?.rules ? `Luật lệ & chuẩn mực vận hành: ${wInfo.rules}` : '',
      pInfo?.absentAtStart
        ? 'QUY TẮC NHÂN VẬT CHÍNH: Nhân vật chính KHÔNG có mặt / KHÔNG tham gia ngay từ đầu. Hãy tập trung hoàn toàn vào dàn NPC và bối cảnh thế giới; tuyệt đối không tự ý kéo nhân vật chính vào cảnh cho đến khi người chơi chủ động đưa vào.'
        : [
            pInfo?.name ? `Nhân vật chính: ${pInfo.name}` : '',
            pInfo?.pronoun ? `Xưng hô: ${pInfo.pronoun}` : '',
            pInfo?.role ? `Vai trò / Vị trí ban đầu: ${pInfo.role}` : '',
            pInfo?.description ? `Mô tả nhân vật chính: ${pInfo.description}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
      wInfo?.openingScenario && state.turns.length <= 1
        ? `Tình huống mở đầu: ${wInfo.openingScenario}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (worldSetupLines.trim() !== '[THIẾT LẬP THẾ GIỚI & NHÂN VẬT KHỞI ĐẦU]') {
      msgs.push({ role: 'system', content: worldSetupLines });
    }
  }

  // Inject Story Timeline & Clock Tracker context (always independent of real system wall-clock)
  const memCfg = state.memory;
  const storyClock = normalizeStoryClock(memCfg?.storyClock);
  if (storyClock.enabled) {
    const fmt = formatStoryClock(storyClock);
    const deltaNote =
      storyClock.lastDeltaMinutes && storyClock.lastDeltaMinutes > 0
        ? `Diễn biến lượt gần nhất vừa trôi ${formatDeltaMinutesVi(storyClock.lastDeltaMinutes)}${storyClock.lastAdvanceReason ? ` (${storyClock.lastAdvanceReason})` : ''}.`
        : '';
    const clockPrompt = [
      '[ĐỒNG HỒ & DÒNG THỜI GIAN TRUYỆN HIỆN TẠI]',
      `Mốc thời gian hiện hành trong truyện: ${fmt.fullLabel}.`,
      fmt.eraLabel
        ? `Niên đại / Lịch bối cảnh: ${fmt.eraLabel} (giữ nhất quán cách gọi niên đại/giờ canh của thế giới này song song với đồng hồ liên tục).`
        : '',
      deltaNote,
      'Quy tắc thời gian bắt buộc:',
      '- Tuyệt đối bám sát mốc ngày/tháng/năm/thứ/giờ/buổi trong truyện ở trên; KHÔNG BAO GIỜ tự ý lấy ngày giờ thực tế của máy tính hay hệ thống.',
      '- Duy trì dòng thời gian trôi liên tục, hợp lý theo từng hành động, cuộc trò chuyện, cuộc gọi, di chuyển hoặc bước nhảy thời gian mà người chơi nêu ra; không để giờ đứng im vô lý qua nhiều lượt hội thoại dài, cũng không nhảy cóc bất hợp lý.',
      '- Nếu cảnh kéo dài qua 23:59 sang rạng sáng/hôm sau, tự động sang ngày và thứ kế tiếp đúng lịch chuẩn.',
    ]
      .filter(Boolean)
      .join('\n');
    msgs.push({ role: 'system', content: clockPrompt });
  }

  // Inject Cultivation / Martial Arts Profile, Techniques & Inventory ONLY when enabled (Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp)
  if (memCfg?.cultivation?.enabled) {
    const activeMcName = (
      state.player?.name ||
      activeComp?.mc?.name ||
      ''
    ).trim();
    const cultBlock = formatCultivationContextBlock(
      memCfg.cultivation,
      activeMcName,
    );
    if (cultBlock) {
      msgs.push({ role: 'system', content: cultBlock });
    }
  }

  // Inject AI Memory & State Manager context (Rolling Summary, Lorebook Memories, Character States)
  if (memCfg?.enabled) {
    const blocks: string[] = [];

    const rsText = (memCfg.rollingSummary?.content || '').trim();
    if (rsText && turnIndex > 0) {
      const upTo = Math.min(
        turnIndex,
        memCfg.rollingSummary.summarizedUpToTurn || 0,
      );
      blocks.push(
        `[TÓM TẮT MẠCH TRUYỆN TRƯỚC ĐÓ${upTo > 0 ? ` (Lượt 1–${upTo})` : ''}]\n${rsText}`,
      );
    }

    if (Array.isArray(memCfg.entries) && memCfg.entries.length > 0) {
      const catLabels: Record<MemoryEntryCategory, string> = {
        event: 'Sự kiện',
        relationship: 'Quan hệ',
        timeline: 'Mốc thời gian',
        detail: 'Chi tiết',
      };
      const pinned = memCfg.entries.filter((e) => e.pinned);
      const recentUnpinned = memCfg.entries
        .filter((e) => !e.pinned)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, Math.max(0, 16 - pinned.length));
      const selected = [...pinned, ...recentUnpinned];
      if (selected.length) {
        const memLines = selected.map((e) => {
          const tag = catLabels[e.category] || 'Ký ức';
          const pageTag =
            typeof e.turnIndex === 'number' ? ` · Trang ${e.turnIndex + 1}` : '';
          const pinMark = e.pinned ? ' [Ghim]' : '';
          return `- (${tag}${pageTag}${pinMark}) ${e.title}: ${e.content}`;
        });
        blocks.push(`[SỔ TAY KÝ ỨC & LOREBOOK]\n${memLines.join('\n')}`);
      }
    }

    if (
      Array.isArray(memCfg.characterStates) &&
      memCfg.characterStates.length > 0
    ) {
      const sortedStates = [...memCfg.characterStates].sort((a, b) => {
        if (a.isMc !== b.isMc) return a.isMc ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      const stateLines = sortedStates.slice(0, 12).map((s) => {
        const roleTag = s.isMc ? 'NV chính' : 'NPC';
        const parts = [
          s.location ? `Vị trí: ${s.location}` : '',
          s.mood ? `Tâm trạng: ${s.mood}` : '',
          s.status ? `Trạng thái: ${s.status}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        return `- ${s.name} (${roleTag}): ${parts || 'Chưa rõ'}`;
      });
      blocks.push(
        `[TRẠNG THÁI HIỆN TẠI CỦA NHÂN VẬT]\n${stateLines.join('\n')}`,
      );
    }

    if (blocks.length) {
      msgs.push({ role: 'system', content: blocks.join('\n\n') });
    }
  }

  for (const m of state.tawaPreset.modules) {
    if (!m || !m.enabled) continue;
    if (m.content === 'Chat History') {
      const start = Math.max(0, turnIndex - (state.context.historyTurns || 12));
      for (let i = start; i < turnIndex; i++) {
        const past = state.turns[i];
        if (!past) continue;
        if (past.user) msgs.push({ role: 'user', content: past.user });
        if (past.assistant) msgs.push({ role: 'assistant', content: past.assistant });
      }
    } else if (m.content && m.content.trim()) {
      msgs.push({ role: 'system', content: m.content.trim() });
    }
  }

  const pacingLines = [
    '[YÊU CẦU ĐỘ DÀI & DIỄN BIẾN]',
    `Mục tiêu độ dài hồi đáp: ${state.context?.targetLength || '900 - 1800 từ'}.`,
    'Hãy viết đầy đủ, chậm rãi, giàu chi tiết hành động, đối thoại, biểu cảm, không gian và nội tâm nhân vật. Không tóm tắt ngắn gọn hay cắt cụt diễn biến.',
    state.context?.entitiesNote
      ? `Ghi chú thực thể & bối cảnh: ${state.context.entitiesNote}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  if (pacingLines) {
    msgs.push({ role: 'system', content: pacingLines });
  }

  const cur = state.turns[turnIndex];
  let visionHint = '';
  if (cur.imageData) {
    const cleanCaption = (cur.imageCaption || '').trim();
    const recentBefore = state.turns.slice(Math.max(0, turnIndex - 2), turnIndex);
    const activeSceneChars = resolveActiveSceneCharacters({
      currentUserText: [cur.user || '', cleanCaption].filter(Boolean).join('\n'),
      currentAiText: recentBefore[recentBefore.length - 1]?.assistant || '',
      recentTurns: recentBefore,
      mcName: activeComp?.mc?.name || state.player?.name || '',
      mcPronoun: activeComp?.mc?.pronoun || state.player?.pronoun || '',
      mcAbsentAtStart: Boolean(state.player?.absentAtStart),
      npcs: activeComp?.npcs || [],
      portraits: state.portraitBank?.portraits || [],
      characterStates: state.memory?.characterStates || [],
    });
    const presentNames = activeSceneChars.presentNames.slice(0, 6);
    const clockFmtForImg = storyClock.enabled ? formatStoryClock(storyClock) : null;
    const captionLine = cleanCaption
      ? `Chi tiết / Chú thích ảnh: ${cleanCaption}`
      : 'Chi tiết / Chú thích ảnh: (Không có chú thích riêng — hãy trực tiếp quan sát kỹ mọi chi tiết cụ thể trong ảnh như chủ thể/nhân vật, trang phục, kiểu dáng, phụ kiện, giày/đồ vật, biểu cảm, góc chụp, ánh sáng và không gian để phản ứng chi tiết, không nhận xét chung chung).';
    const charsLine = presentNames.length
      ? `Nhân vật đang có mặt trong cảnh: ${presentNames.join(', ')}.`
      : '';
    const timeLine = clockFmtForImg
      ? `Mốc thời gian truyện hiện hành: ${clockFmtForImg.fullLabel}.`
      : '';
    const reactLine = presentNames.length
      ? `Yêu cầu tương tác: Hãy để ${presentNames.join(', ')} trực tiếp nhìn thấy bức ảnh và phản ứng tự nhiên bằng ánh mắt, biểu cảm, cử chỉ và lời thoại sát đúng chi tiết trong ảnh, đúng bối cảnh và đúng thời điểm hiện tại.`
      : 'Yêu cầu tương tác: Hãy để các nhân vật đang có mặt trực tiếp quan sát chi tiết nổi bật trên ảnh và phản ứng tự nhiên, cụ thể, khớp với bối cảnh và thời điểm hiện tại.';
    visionHint = `\n[NGỮ CẢNH ẢNH ĐÍNH KÈM TRONG LƯỢT GỌI]\n${[
      captionLine,
      charsLine,
      timeLine,
      reactLine,
    ]
      .filter(Boolean)
      .join('\n')}`;
  }

  const baseUserText = (cur.user || '').trim();
  const userText = cur.imageData
    ? `${baseUserText || 'Người chơi vừa gửi kèm một bức ảnh trong cảnh hiện tại.'}${visionHint}`
    : cur.user || '';
  if (cur.imageData) {
    msgs.push({
      role: 'user',
      content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: cur.imageData } },
      ],
    });
  } else {
    msgs.push({ role: 'user', content: userText });
  }

  if (state.tawaPreset.prefillEnabled && state.tawaPreset.prefill) {
    msgs.push({ role: 'assistant', content: state.tawaPreset.prefill });
  }
  return msgs;
}

export function normalizeMessagesForRequest(
  state: ArkState,
  rawMessages: ChatMessage[],
  includePrefill: boolean,
): ChatMessage[] {
  const cleaned: ChatMessage[] = [];
  for (const m of rawMessages) {
    if (!m) continue;
    if (typeof m.content === 'string') {
      const txt = m.content.trim();
      if (!txt) continue;
      if (m.role === 'system' && (txt === 'Chat History' || txt === '</chathistory>')) {
        continue;
      }
      cleaned.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content) && m.content.length) {
      cleaned.push({ role: m.role, content: m.content });
    }
  }

  const merged: ChatMessage[] = [];
  for (const item of cleaned) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.role === item.role &&
      typeof prev.content === 'string' &&
      typeof item.content === 'string'
    ) {
      prev.content = `${prev.content}\n\n${item.content}`;
    } else {
      merged.push({ ...item });
    }
  }

  if (
    includePrefill &&
    state.tawaPreset.prefillEnabled &&
    state.tawaPreset.prefill?.trim()
  ) {
    const last = merged[merged.length - 1];
    if (!last || last.role !== 'assistant') {
      merged.push({ role: 'assistant', content: state.tawaPreset.prefill.trim() });
    }
  }
  if (!includePrefill && merged.length && merged[merged.length - 1].role === 'assistant') {
    merged.pop();
  }
  return merged;
}

export async function executeModelTurn(options: {
  state: ArkState;
  turnIndex: number;
  signal: AbortSignal;
  onChunk: (accumulated: string) => void;
  onLog: (line: string) => void;
}): Promise<{
  ok: boolean;
  text: string;
  rawText?: string;
  statusLabel: string;
  aborted?: boolean;
}> {
  const { state, turnIndex, signal, onChunk, onLog } = options;
  const baseUrl = (state.config.proxyUrl || '').trim();
  const model = (state.config.model || '').trim() || 'gemini-2.5-pro';
  const apiKey = (state.config.proxyKey || '').trim();
  const targetTurn = state.turns[turnIndex];

  if (!targetTurn) {
    return { ok: false, text: '', statusLabel: 'Không tìm thấy lượt' };
  }

  if (!baseUrl) {
    const localReply = `[Chế độ bản xem trước cục bộ] Chưa cấu hình Proxy URL nên hệ thống ghi nhận lượt của ${
      state.player.pronoun || 'nhân vật'
    }:\n\n"${
      targetTurn.user || 'Đã gửi ảnh đính kèm'
    }"\n\nHãy vào mục Cấu hình để nhập Proxy URL nếu muốn gọi mô hình trực tuyến, hoặc bấm Sửa để chỉnh nội dung trực tiếp.`;
    return { ok: true, text: localReply, statusLabel: 'Bản xem trước cục bộ' };
  }

  const proto = state.config.apiProtocol || 'openai';
  const isGemini =
    proto === 'gemini' ||
    (proto === 'auto' &&
      (/generativelanguage\.googleapis\.com/i.test(baseUrl) ||
        /:(generateContent|streamGenerateContent)/i.test(baseUrl)));

  const endpoints = buildEndpointCandidates(baseUrl, model, state.streamEnabled, isGemini);
  const rawMessages = buildMessagesPayload(state, turnIndex);
  const hasPrefill = Boolean(
    state.tawaPreset?.prefillEnabled && state.tawaPreset?.prefill?.trim(),
  );
  const hasGeminiSafety = Boolean(isGemini || /gemini/i.test(model));

  const attemptVariants: Array<{
    msgs: ChatMessage[];
    withSafety: boolean;
    label: string;
  }> = [];

  if (hasPrefill || hasGeminiSafety) {
    attemptVariants.push({
      msgs: normalizeMessagesForRequest(state, rawMessages, true),
      withSafety: hasGeminiSafety,
      label: 'chuẩn',
    });
  }
  attemptVariants.push({
    msgs: normalizeMessagesForRequest(state, rawMessages, false),
    withSafety: false,
    label: 'tương thích',
  });

  let lastErr = '';
  for (const url of endpoints) {
    for (const variant of attemptVariants) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
          headers['x-goog-api-key'] = apiKey;
        }

        const messages = variant.msgs;
        const sysPrompts = messages
          .filter((m) => m.role === 'system')
          .map((m) => (typeof m.content === 'string' ? m.content : ''))
          .filter(Boolean);
        const nonSys = messages.filter((m) => m.role !== 'system');
        const targetMaxTokens = 65536;

        const body = isGemini
          ? {
              ...(sysPrompts.length
                ? { systemInstruction: { parts: [{ text: sysPrompts.join('\n\n') }] } }
                : {}),
              contents: nonSys.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: Array.isArray(m.content)
                  ? m.content.map((c) =>
                      c.type === 'image_url'
                        ? (() => {
                            const rawUrl = c.image_url.url || '';
                            const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i.exec(rawUrl);
                            return {
                              inlineData: {
                                mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
                                data: rawUrl.split(',')[1] || '',
                              },
                            };
                          })()
                        : { text: c.text || '' },
                    )
                  : [
                      {
                        text:
                          typeof m.content === 'string'
                            ? m.content
                            : JSON.stringify(m.content),
                      },
                    ],
              })),
              generationConfig: { maxOutputTokens: targetMaxTokens },
              ...(variant.withSafety
                ? { safetySettings: state.config.safetySettings || DEFAULT_SAFETY }
                : {}),
            }
          : {
              model,
              messages,
              max_tokens: targetMaxTokens,
              stream: Boolean(state.streamEnabled),
              ...(variant.withSafety && /gemini/i.test(model)
                ? { safetySettings: state.config.safetySettings || DEFAULT_SAFETY }
                : {}),
            };

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          lastErr = `HTTP ${res.status} [${variant.label}] tại ${url}${
            errTxt ? `: ${errTxt.slice(0, 320)}` : ''
          }`;
          onLog(lastErr);
          continue;
        }

        if (state.streamEnabled && res.body && typeof res.body.getReader === 'function') {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let reasoningAcc = '';
          let contentAcc = '';

          const composeStreamedRaw = () => {
            if (reasoningAcc.trim()) {
              if (contentAcc) {
                return `<thinking>\n${reasoningAcc.trim()}\n</thinking>\n\n${contentAcc}`;
              }
              return `<thinking>\n${reasoningAcc}`;
            }
            return contentAcc;
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              const payloadStr = trimmed.startsWith('data:')
                ? trimmed.slice(5).trim()
                : trimmed;
              try {
                const json = JSON.parse(payloadStr);
                const delta = json?.choices?.[0]?.delta;
                let contentPiece = '';
                let reasoningPiece = '';

                if (delta && typeof delta === 'object') {
                  if (typeof delta.content === 'string') {
                    contentPiece = delta.content;
                  }
                  const rawReasoning =
                    delta.reasoning_content ?? delta.reasoning ?? delta.thought;
                  if (typeof rawReasoning === 'string') {
                    reasoningPiece = rawReasoning;
                  }
                } else if (Array.isArray(json?.candidates?.[0]?.content?.parts)) {
                  for (const part of json.candidates[0].content.parts as Array<{
                    text?: string;
                    thought?: boolean;
                  }>) {
                    if (typeof part?.text !== 'string' || !part.text) continue;
                    if (part.thought) {
                      reasoningPiece += part.text;
                    } else {
                      contentPiece += part.text;
                    }
                  }
                } else {
                  const fallback =
                    json?.delta ?? json?.content ?? json?.text ?? '';
                  if (typeof fallback === 'string') {
                    contentPiece = fallback;
                  }
                }

                if (reasoningPiece) {
                  reasoningAcc += reasoningPiece;
                }
                if (contentPiece) {
                  contentAcc += contentPiece;
                }
                if (reasoningPiece || contentPiece) {
                  onChunk(composeStreamedRaw());
                }
              } catch {
                if (!trimmed.startsWith('{')) {
                  contentAcc += payloadStr;
                  onChunk(composeStreamedRaw());
                }
              }
            }
          }
          const rawCombined = composeStreamedRaw();
          if (!rawCombined.trim()) {
            lastErr = `Stream hoàn tất nhưng không có nội dung văn bản từ ${url}`;
            continue;
          }
          const cleanedStory = sanitizeCompletedStoryResponse(
            contentAcc.trim() ? contentAcc : rawCombined,
          );
          return {
            ok: true,
            text: cleanedStory,
            rawText: rawCombined,
            statusLabel: 'Hoàn tất',
          };
        } else {
          const data = await res.json();
          let reasoningOut = '';
          let contentOut = '';

          const msgObj = data?.choices?.[0]?.message;
          if (msgObj && typeof msgObj === 'object') {
            if (typeof msgObj.content === 'string') {
              contentOut = msgObj.content;
            }
            const rawReasoning =
              msgObj.reasoning_content ?? msgObj.reasoning ?? msgObj.thought;
            if (typeof rawReasoning === 'string') {
              reasoningOut = rawReasoning;
            }
          } else if (Array.isArray(data?.candidates?.[0]?.content?.parts)) {
            for (const part of data.candidates[0].content.parts as Array<{
              text?: string;
              thought?: boolean;
            }>) {
              if (typeof part?.text !== 'string' || !part.text) continue;
              if (part.thought) {
                reasoningOut += part.text;
              } else {
                contentOut += part.text;
              }
            }
          } else {
            const fallback = data?.content ?? data?.text ?? '';
            contentOut =
              typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
          }

          const rawCombined = reasoningOut.trim()
            ? contentOut.trim()
              ? `<thinking>\n${reasoningOut.trim()}\n</thinking>\n\n${contentOut}`
              : `<thinking>\n${reasoningOut.trim()}\n</thinking>`
            : contentOut;

          if (!rawCombined.trim()) {
            lastErr = `Phản hồi rỗng từ ${url}`;
            continue;
          }
          const cleanedStory = sanitizeCompletedStoryResponse(
            contentOut.trim() ? contentOut : rawCombined,
          );
          return {
            ok: true,
            text: cleanedStory,
            rawText: rawCombined,
            statusLabel: 'Hoàn tất',
          };
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, text: '', statusLabel: 'Đã dừng', aborted: true };
        }
        lastErr = `${err instanceof Error ? err.message : String(err)} (${url})`;
        onLog(`Lỗi: ${lastErr}`);
      }
    }
  }

  return {
    ok: false,
    text: `[Không thể gọi AI] ${lastErr || 'Không kết nối được proxy.'}`,
    statusLabel: 'Lỗi gọi AI',
  };
}

export async function callAiJsonOrText(
  state: ArkState,
  promptText: string,
  options?: {
    systemPrompt?: string;
    signal?: AbortSignal;
    onLog?: (line: string) => void;
    maxTokens?: number;
  },
): Promise<string | null> {
  const baseUrl = (state.config.proxyUrl || '').trim();
  const model = (state.config.model || '').trim() || 'gemini-2.5-pro';
  const apiKey = (state.config.proxyKey || '').trim();
  if (!baseUrl) return null;

  const proto = state.config.apiProtocol || 'openai';
  const isGemini =
    proto === 'gemini' ||
    (proto === 'auto' &&
      (/generativelanguage\.googleapis\.com/i.test(baseUrl) ||
        /:(generateContent|streamGenerateContent)/i.test(baseUrl)));
  const endpoints = buildEndpointCandidates(baseUrl, model, false, isGemini);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-goog-api-key'] = apiKey;
  }

  const sysPrompt = options?.systemPrompt?.trim() || '';
  const maxTokens = options?.maxTokens || 4096;

  for (const url of endpoints) {
    try {
      const body = isGemini
        ? {
            ...(sysPrompt
              ? { systemInstruction: { parts: [{ text: sysPrompt }] } }
              : {}),
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: { maxOutputTokens: maxTokens },
            safetySettings: state.config.safetySettings || DEFAULT_SAFETY,
          }
        : {
            model,
            messages: [
              ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
              { role: 'user', content: promptText },
            ],
            max_tokens: maxTokens,
            stream: false,
            ...(/gemini/i.test(model)
              ? { safetySettings: state.config.safetySettings || DEFAULT_SAFETY }
              : {}),
          };
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        options?.onLog?.(
          `[AI Memory] HTTP ${res.status} tại ${url}${errTxt ? `: ${errTxt.slice(0, 180)}` : ''}`,
        );
        continue;
      }
      const data = await res.json();
      const out =
        data?.choices?.[0]?.message?.content ??
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.content ??
        data?.text ??
        '';
      if (typeof out === 'string' && out.trim()) return out.trim();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      options?.onLog?.(
        `[AI Memory] Lỗi kết nối ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return null;
}

function parseAiJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let cleaned = String(raw)
    .replace(/<(thinking|thought|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0) {
    cleaned =
      lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : cleaned.slice(firstBrace);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    try {
      const repaired = repairTruncatedJson(cleaned);
      const parsed = JSON.parse(repaired);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

export async function runAiMemorySync(options: {
  state: ArkState;
  turnIndex: number;
  mode: 'memory' | 'state' | 'both';
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  memories?: Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>[];
  states?: Omit<CharacterStateSnapshot, 'id' | 'updatedAt'>[];
  clockUpdate?: {
    elapsedMinutes?: number;
    explicitTime?: string;
    note?: string;
  };
  error?: string;
}> {
  const { state, turnIndex, mode, signal, onLog } = options;
  if (!(state.config.proxyUrl || '').trim()) {
    return {
      ok: false,
      error:
        'Chưa cấu hình Proxy URL. Hãy vào tab Cấu hình để nhập Proxy API trước khi dùng AI Quản lý & Ghi nhớ.',
    };
  }

  const safeIdx = Math.min(Math.max(0, turnIndex), state.turns.length - 1);
  const targetTurn = state.turns[safeIdx];
  if (!targetTurn) {
    return { ok: false, error: 'Chưa có lượt truyện nào để trích xuất.' };
  }

  const cleanUser = stripStoryPlanningAndMeta(targetTurn.user || '');
  const cleanAi = stripStoryPlanningAndMeta(targetTurn.assistant || '');
  if (!cleanUser && !cleanAi) {
    return { ok: false, error: 'Trang truyện hiện tại chưa có nội dung diễn biến.' };
  }

  const activeComp = getActiveCompanionFromState(state);
  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const mcName = rawMcName || 'Nhân vật chính';
  const mcPresent = isMcPresentInTurn(
    cleanAi,
    cleanUser,
    rawMcName,
    activeComp?.mc?.pronoun,
  );
  const mcKey = normalizeCharacterKey(rawMcName);
  const knownNpcs = (activeComp?.npcs || [])
    .map((n) => n.name)
    .filter(Boolean)
    .slice(0, 15);

  const existingMemoryTitles = (state.memory?.entries || [])
    .slice(0, 20)
    .map((e) => `- ${e.title}: ${e.content.slice(0, 80)}`)
    .join('\n');

  const existingStatesText = (state.memory?.characterStates || [])
    .slice(0, 12)
    .map(
      (s) =>
        `- ${s.name}${s.isMc ? ' (NV chính)' : ''}: Vị trí=${s.location || '?'} | Tâm trạng=${s.mood || '?'} | Trạng thái=${s.status || '?'}`,
    )
    .join('\n');

  // Include brief previous turn context for continuity when available
  const prevTurn = safeIdx > 0 ? state.turns[safeIdx - 1] : null;
  const prevSceneSnippet = prevTurn
    ? trimToCleanSentence(
        stripStoryPlanningAndMeta(prevTurn.assistant || prevTurn.user || ''),
        360,
      )
    : '';

  const wantMemories = mode === 'memory' || mode === 'both';
  const wantStates = mode === 'state' || mode === 'both';

  const activeClock = normalizeStoryClock(state.memory?.storyClock);
  const activeClockLabel = formatStoryClock(activeClock).fullLabel;

  const schemaHint =
    mode === 'both'
      ? `{"memories":[{"title":"Tiêu đề ngắn","content":"Nội dung cô đọng 1-2 câu","category":"event|relationship|timeline|detail"}],"states":[{"name":"Tên nhân vật","isMc":false,"location":"Vị trí hiện tại","mood":"Tâm trạng hiện tại","status":"Trạng thái/diễn biến mới nhất"}],"clockUpdate":{"elapsedMinutes":10,"explicitTime":"","note":"lý do ngắn"}}`
      : mode === 'memory'
        ? `{"memories":[{"title":"Tiêu đề ngắn","content":"Nội dung cô đọng 1-2 câu","category":"event|relationship|timeline|detail"}],"clockUpdate":{"elapsedMinutes":10,"explicitTime":"","note":"lý do ngắn"}}`
        : `{"states":[{"name":"Tên nhân vật","isMc":false,"location":"Vị trí hiện tại","mood":"Tâm trạng hiện tại","status":"Trạng thái/diễn biến mới nhất"}],"clockUpdate":{"elapsedMinutes":10,"explicitTime":"","note":"lý do ngắn"}}`;

  const systemPrompt =
    'Bạn là trợ lý quản lý ký ức, trạng thái & dòng thời gian cho truyện nhập vai tiếng Việt. Chỉ trả về DUY NHẤT một đối tượng JSON hợp lệ (không giải thích thêm, không thẻ <thinking>). Tuyệt đối tôn trọng đúng những nhân vật thực sự xuất hiện trong cảnh; không bao giờ bịa đặt sự có mặt của Nhân vật chính khi Nhân vật chính vắng mặt hoặc không được nhắc tới.';

  const promptParts = [
    `Phân tích TRANG ${safeIdx + 1} dưới đây bằng tiếng Việt tự nhiên, chính xác.`,
    `Mốc thời gian trong truyện hiện hành (tham chiếu): ${activeClockLabel}.`,
    mcPresent
      ? `Nhân vật chính (MC): ${mcName} (có xuất hiện trong trang này).`
      : `LƯU Ý QUAN TRỌNG VỀ NHÂN VẬT CHÍNH: Nhân vật chính${rawMcName ? ` (${rawMcName})` : ''} KHÔNG XUẤT HIỆN / VẮNG MẶT ở trang này. TUYỆT ĐỐI KHÔNG đưa Nhân vật chính vào mảng "states", KHÔNG bịa đặt vị trí hay hành động của Nhân vật chính tại hiện trường, và KHÔNG gán ghép diễn biến của các NPC với Nhân vật chính.`,
    knownNpcs.length ? `NPC đã biết: ${knownNpcs.join(', ')}.` : '',
    prevSceneSnippet ? `Bối cảnh trang trước (tham khảo): ${prevSceneSnippet}` : '',
    existingMemoryTitles && wantMemories
      ? `Ký ức đã lưu trước đó (tránh lặp lại y hệt, chỉ thêm chi tiết mới hoặc thay đổi mới):\n${existingMemoryTitles}`
      : '',
    existingStatesText && wantStates
      ? `Trạng thái nhân vật gần nhất:\n${existingStatesText}`
      : '',
    `--- NỘI DUNG TRANG ${safeIdx + 1} ---`,
    cleanUser ? `[Lượt gọi]: ${trimToCleanSentence(cleanUser, 700)}` : '',
    cleanAi ? `[Diễn biến truyện]: ${trimToCleanSentence(cleanAi, 2600)}` : '',
    '--- YÊU CẦU ---',
    wantMemories
      ? '- "memories": Trích xuất 1–4 mục ký ức THỰC SỰ ĐÁNG NHỚ trong trang này (sự kiện quan trọng = "event", thay đổi quan hệ = "relationship", mốc thời gian/địa điểm mới = "timeline", vật phẩm/lời hứa/bí mật = "detail"). Chỉ ghi nhận đúng sự kiện thực tế xảy ra, không bịa sự tham gia của nhân vật vắng mặt. Nếu trang không có gì mới đáng ghi, trả mảng rỗng [].'
      : '',
    wantStates
      ? mcPresent
        ? '- "states": Chỉ cập nhật trạng thái của Nhân vật chính (đặt isMc: true) nếu thực sự có mặt trong trang này, cùng các NPC thực sự xuất hiện/hành động trong trang này (đặt isMc: false). Mỗi trường location, mood, status viết ngắn gọn, bám sát diễn biến.'
        : '- "states": CHỈ cập nhật trạng thái các NPC thực sự xuất hiện/hành động trong trang này (đặt isMc: false). KHÔNG đưa Nhân vật chính vào danh sách này vì Nhân vật chính không có mặt.'
      : '',
    '- "clockUpdate": Ước lượng số phút thực tế đã trôi qua trong trang này ("elapsedMinutes": số nguyên >= 2 cho hội thoại/hành động liên tục, hoặc lớn hơn nếu có nhảy thời gian rõ ràng), điền "explicitTime" dạng "HH:mm" CHỈ KHI trong truyện nêu rõ giờ mới, và "note" ngắn gọn 3–6 từ.',
    `Trả về đúng định dạng JSON:\n${schemaHint}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  onLog?.(`[AI Memory] Đang trích xuất (${mode}) cho Trang ${safeIdx + 1}...`);
  const rawOut = await callAiJsonOrText(state, promptParts, {
    systemPrompt,
    signal,
    onLog,
    maxTokens: 2048,
  });

  if (!rawOut) {
    return {
      ok: false,
      error:
        'Không nhận được phản hồi từ Proxy API. Kiểm tra lại kết nối và cấu hình Proxy.',
    };
  }

  const parsed = parseAiJsonObject(rawOut);
  if (!parsed) {
    return {
      ok: false,
      error: 'Phản hồi AI không đúng định dạng JSON hợp lệ để trích xuất.',
    };
  }

  const validCats = new Set<MemoryEntryCategory>([
    'event',
    'relationship',
    'timeline',
    'detail',
  ]);

  const memories: Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>[] = [];
  if (wantMemories && Array.isArray(parsed.memories)) {
    for (const item of parsed.memories) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const title = String(r.title || '').trim();
      const content = String(r.content || '').trim();
      if (!title && !content) continue;
      const rawCat = String(r.category || 'event').toLowerCase() as MemoryEntryCategory;
      memories.push({
        title: title || content.slice(0, 48),
        content: content || title,
        category: validCats.has(rawCat) ? rawCat : 'event',
        turnIndex: safeIdx,
      });
    }
  }

  const states: Omit<CharacterStateSnapshot, 'id' | 'updatedAt'>[] = [];
  if (wantStates && Array.isArray(parsed.states)) {
    for (const item of parsed.states) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const name = String(r.name || '').trim();
      if (!name) continue;
      const itemKey = normalizeCharacterKey(name);
      const isItemMc =
        Boolean(r.isMc) ||
        (Boolean(mcKey) && itemKey === mcKey) ||
        itemKey === 'nhan vat chinh' ||
        itemKey === 'nvc' ||
        itemKey === 'mc';
      // Hard guard: never leak MC into State Tracker when MC is absent in this turn
      if (!mcPresent && isItemMc) continue;
      states.push({
        name,
        isMc: isItemMc,
        location: String(r.location || '').trim(),
        mood: String(r.mood || '').trim(),
        status: String(r.status || '').trim(),
        lastTurnIndex: safeIdx,
      });
    }
  }

  let clockUpdate:
    | { elapsedMinutes?: number; explicitTime?: string; note?: string }
    | undefined;
  if (parsed.clockUpdate && typeof parsed.clockUpdate === 'object') {
    const cu = parsed.clockUpdate as Record<string, unknown>;
    const elapsedRaw = Number(cu.elapsedMinutes);
    const explicitTime =
      typeof cu.explicitTime === 'string' ? cu.explicitTime.trim() : '';
    const note = typeof cu.note === 'string' ? cu.note.trim() : '';
    if (
      (Number.isFinite(elapsedRaw) && elapsedRaw >= 1) ||
      /^([01]?\d|2[0-3]):([0-5]\d)$/.test(explicitTime)
    ) {
      clockUpdate = {
        ...(Number.isFinite(elapsedRaw) && elapsedRaw >= 1
          ? { elapsedMinutes: Math.round(elapsedRaw) }
          : {}),
        ...(explicitTime ? { explicitTime } : {}),
        ...(note ? { note } : {}),
      };
    }
  }

  onLog?.(
    `[AI Memory] Hoàn tất Trang ${safeIdx + 1}: ${memories.length} ký ức, ${states.length} trạng thái.`,
  );
  return { ok: true, memories, states, clockUpdate };
}

export async function runRollingSummaryUpdate(options: {
  state: ArkState;
  forceAllOlder?: boolean;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  content?: string;
  summarizedUpToTurn?: number;
  error?: string;
}> {
  const { state, forceAllOlder = false, signal, onLog } = options;
  if (!(state.config.proxyUrl || '').trim()) {
    return {
      ok: false,
      error:
        'Chưa cấu hình Proxy URL. Hãy vào tab Cấu hình để nhập Proxy API trước khi tóm tắt ngữ cảnh.',
    };
  }

  const historyWindow = Math.max(1, state.context?.historyTurns || 12);
  const cutoff = Math.max(0, state.turns.length - historyWindow);
  if (cutoff <= 0) {
    return {
      ok: false,
      error: `Số lượt hiện tại (${state.turns.length}) chưa vượt ngưỡng cửa sổ lịch sử (${historyWindow} lượt).`,
    };
  }

  const existingUpTo = forceAllOlder
    ? 0
    : Math.min(state.memory?.rollingSummary?.summarizedUpToTurn || 0, cutoff);
  const existingSummary = forceAllOlder
    ? ''
    : (state.memory?.rollingSummary?.content || '').trim();

  if (!forceAllOlder && existingUpTo >= cutoff && existingSummary) {
    return {
      ok: true,
      content: existingSummary,
      summarizedUpToTurn: cutoff,
    };
  }

  const turnsToFold: string[] = [];
  for (let i = existingUpTo; i < cutoff; i++) {
    const t = state.turns[i];
    if (!t) continue;
    const u = trimToCleanSentence(stripStoryPlanningAndMeta(t.user || ''), 240);
    const a = trimToCleanSentence(
      stripStoryPlanningAndMeta(t.assistant || ''),
      520,
    );
    if (!u && !a) continue;
    turnsToFold.push(
      `[Trang ${i + 1}]${u ? `\nNgười chơi: ${u}` : ''}${a ? `\nDiễn biến: ${a}` : ''}`,
    );
  }

  if (!turnsToFold.length) {
    return {
      ok: false,
      error: 'Không có nội dung mới ở các lượt cũ cần tóm tắt.',
    };
  }

  const systemPrompt =
    'Bạn là biên tập viên tóm tắt cốt truyện tiếng Việt cho truyện nhập vai dài kỳ. Chỉ trả về văn bản tóm tắt cô đọng, rõ mạch thời gian, giữ nguyên tên nhân vật, mối quan hệ, bí mật và nút thắt chưa giải quyết. Không viết lời mở đầu hay thẻ <thinking>.';

  const promptText = [
    existingSummary
      ? `--- TÓM TẮT HIỆN CÓ (Trang 1–${existingUpTo}) ---\n${existingSummary}`
      : '',
    `--- CÁC LƯỢT CŨ CẦN GỘP THÊM (Trang ${existingUpTo + 1}–${cutoff}) ---\n${turnsToFold.join('\n\n')}`,
    '--- YÊU CẦU ---',
    'Hãy gộp và viết lại thành 1 bản tóm tắt mạch truyện liền mạch bằng tiếng Việt (khoảng 180–380 từ, chia gạch đầu dòng ngắn gọn theo tiến trình nếu cần). Giữ lại mọi sự kiện bước ngoặt, thay đổi quan hệ, địa điểm, vật phẩm và nút thắt đang mở; bỏ miêu tả rườm rà.',
  ]
    .filter(Boolean)
    .join('\n\n');

  onLog?.(
    `[Rolling Summary] Đang tóm tắt các lượt cũ (Trang ${existingUpTo + 1}–${cutoff})...`,
  );
  const rawOut = await callAiJsonOrText(state, promptText, {
    systemPrompt,
    signal,
    onLog,
    maxTokens: 2048,
  });

  if (!rawOut) {
    return {
      ok: false,
      error:
        'Không nhận được phản hồi từ Proxy API khi tạo bản tóm tắt ngữ cảnh.',
    };
  }

  const cleaned = rawOut
    .replace(/<(thinking|thought|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();

  if (!cleaned) {
    return { ok: false, error: 'Bản tóm tắt trả về bị rỗng.' };
  }

  onLog?.(`[Rolling Summary] Đã tổng hợp xong tới hết Trang ${cutoff}.`);
  return {
    ok: true,
    content: cleaned,
    summarizedUpToTurn: cutoff,
  };
}

// Seedream 5 Pro helpers
export function buildSeedreamEndpoints(rawUrl: string): string[] {
  const clean = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return [];
  if (/\/images\/generations$/i.test(clean)) return [clean];
  if (/\/v1$/i.test(clean)) return [`${clean}/images/generations`];
  return [`${clean}/v1/images/generations`, `${clean}/images/generations`, clean];
}

export function buildSeedreamModelEndpoints(rawUrl: string): string[] {
  const clean = (rawUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1\/images\/generations$/i, '')
    .replace(/\/images\/generations$/i, '')
    .replace(/\/v1$/i, '');
  if (!clean) return [];
  return [`${clean}/v1/models`, `${clean}/models`];
}

export function extractImageFromSeedreamResponse(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const rec = json as Record<string, unknown>;
  const first = Array.isArray(rec.data)
    ? rec.data[0]
    : Array.isArray(rec.images)
      ? rec.images[0]
      : Array.isArray(rec.output)
        ? rec.output[0]
        : rec;

  if (typeof first === 'string') {
    if (first.startsWith('data:image/') || /^https?:\/\//i.test(first)) return first;
    if (first.length > 100) return `data:image/png;base64,${first}`;
  }
  if (first && typeof first === 'object') {
    const f = first as Record<string, unknown>;
    if (typeof f.url === 'string' && f.url) return f.url;
    if (typeof f.image_url === 'string' && f.image_url) return f.image_url;
    if (typeof f.b64_json === 'string' && f.b64_json) {
      return f.b64_json.startsWith('data:')
        ? f.b64_json
        : `data:image/png;base64,${f.b64_json}`;
    }
    if (typeof f.base64 === 'string' && f.base64) {
      return f.base64.startsWith('data:')
        ? f.base64
        : `data:image/png;base64,${f.base64}`;
    }
  }
  return '';
}

export function formatSeedreamFetchError(url: string, err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const isHttpsToHttp =
    typeof location !== 'undefined' &&
    /^https:/i.test(location.protocol) &&
    /^http:/i.test(url);
  const hints: string[] = [];
  if (isHttpsToHttp) hints.push('Mixed Content (trang HTTPS gọi endpoint HTTP)');
  hints.push(
    'có thể do chặn CORS từ trình duyệt, sai tên miền/DNS, hoặc server từ chối kết nối',
  );
  return `Lỗi gọi ${url}: ${rawMsg} (${hints.join('; ')}).`;
}

const META_BLOCK_TAG_RE =
  /<(thinking|thought|reasoning|analysis|plan|outline|meta|system|ooc|scratchpad|state_update|world_state|memory|summary|incrementalSummary|tableEdit|finish|status|draft|cot|preset)\b[^>]*>[\s\S]*?<\/\1>/gi;

const ORPHAN_CLOSE_THINKING_RE =
  /<\/(?:thinking|thought|reasoning|analysis|plan|outline|scratchpad|cot|preset)\s*>/gi;

const ORPHAN_OPEN_THINKING_RE =
  /<(?:thinking|thought|reasoning|analysis|plan|outline|scratchpad|cot|preset)\b[^>]*>/i;

const CONTAINS_META_NOISE_RE =
  /(?:\bword\s*count\b|\bwords?\s+per\s+paragraph\b|\bplan\s+for\s+(?:the\s+)?stage\b|\bstage\s*\d+\s*[:\-–—(]|\bgoal\s*:|\bgoals\s*:|\bsystem\s*boot\b|\bresource\s*loading\b|\btarget\s*(?:length|word\s*count|words)\b|\b(?:scene|plot|action|stage|writing|paragraph)\s*plan\b|\bcharacter\s*(?:check|voice|consistency|roster)\s*:|\b(?:continuity|self|nsfw|tone|pacing)\s*[- ]?check\b|\b(?:pacing|tone|pov|checklist|constraints?|outline|drafting|reasoning|thinking|thought\s*process|ooc)\s*:|\bbeat\s*\d+\s*:|\b(?:defining\s+the\s+setting|expanding\s+the\s+guest\s+list|crafting\s+the\s+narrative(?:\s+flow)?|analy[sz]ing\s+the\s+aftermath|establishing\s+the\s+(?:scene|setting|atmosphere|tone)|developing\s+the\s+(?:dialogue|scene|plot)|building\s+the\s+(?:tension|scene)|planning\s+the\s+(?:response|scene|narrative)|structuring\s+the\s+(?:response|scene|narrative))\b|\b(?:mục\s*tiêu|số\s*từ|độ\s*dài\s*mục\s*tiêu|kế\s*hoạch\s*(?:cảnh|giai\s*đoạn|viết)|dàn\s*ý|ghi\s*chú\s*hệ\s*thống)\s*:|\[(?:system|ooc|plan|goal|stage|word\s*count|kết\s*thúc|yêu\s*cầu|chế\s*độ\s*bản\s*xem\s*trước|hồ\s*sơ|ảnh\s*đính\s*kèm)[^\]]*\])/i;

const COT_BOLD_OR_SECTION_HEADING_RE =
  /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s*)?(?:\*\*|__)?\s*(?:defining|expanding|crafting|analyzing|analysing|establishing|developing|building|structuring|planning|outlining|reviewing|checking|confirming|verifying|validating|framing|balancing|pacing|refining|introducing|incorporating|exploring|managing|navigating|handling|considering|evaluating|designing|writing|drafting|setting|mapping|tracking|focusing|maintaining|ensuring|assessing|determining|identifying|selecting|orchestrating|weaving|shaping|tuning|adjusting|aligning|synthesizing|brainstorming|finalizing|wrapping|addressing|continuing|deepening|escalating|heightening|concluding|resolving|capturing|portraying|depicting|applying|following|respecting|adhering|preparing|initiating|executing|polishing|formatting|updating|reconciling|integrating|grounding|anchoring|elevating|amplifying|intensifying|layering|immersing|rendering|composing|generating|delivering|completing|finishing|transitioning|shifting)\b[^*\n.!?]{2,95}(?:\*\*|__)?\s*:?\s*$/i;

const ENGLISH_COT_FIRST_PERSON_RE =
  /(?:^\s*(?:I['’]m|I['’]ve|I['’]ll|I['’]d|I\s+(?:need|want|will|should|have|am|plan|intend|decided|aim|think|notice|see|can)\b|Let['’]s\b|My\s+(?:goal|plan|focus|aim|approach)\b|The\s+(?:goal|plan|scene|setting|guest\s+list|narrative|aftermath|user|prompt)\b|Now\s+(?:I['’]ll|I['’]m|let['’]s|for\s+the)\b|First,|Next,|Finally,|Okay,|Alright,|So,|Here['’]s\s+(?:the|my)\b)|\b(?:I['’]m\s+(?:going\s+to|setting|aiming|planning|crafting|expanding|focusing|keeping|making|trying|writing|bringing|having|putting|introducing|weaving|shifting)|I['’]ve\s+(?:set|expanded|added|included|established|crafted|decided|planned|kept|built|chosen|selected)|I['’]ll\s+(?:start|begin|focus|keep|have|make|introduce|weave|describe|show|move|transition|end|close|write)|the\s+user['’]s\s+(?:prompt|request|input|character)|narrative\s+flow|guest\s+list|word\s+count|words?\s+per\s+paragraph|plan\s+for\s+stage)\b)/i;

const META_HEADER_LINE_RE =
  /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s*)?(?:\*\*|__)?\s*(?:(?:plan\s+for\s+(?:the\s+)?stage|word\s*count|words?\s+per\s+paragraph|target\s*word\s*count|system\s*boot|resource\s*loading|scene\s*plan|plot\s*plan|action\s*plan|stage\s*plan|writing\s*plan|defining\s+the\s+setting|expanding\s+the\s+guest\s+list|crafting\s+the\s+narrative(?:\s+flow)?|analy[sz]ing\s+the\s+aftermath)\b.*|(?:goal|goals|objective|target|length|stage\s*\d+|phase\s*\d+|step\s*\d+|part\s*\d+|pacing|tone|pov|perspective|checklist|constraint|constraints|rule|rules|instruction|instructions|reasoning|thinking|thought\s*process|analysis|outline|beat\s*\d*|beats|drafting|execution|review|self-check|verification|ooc|note\s*to\s*self|meta|summary|status|mục\s*tiêu|số\s*từ|độ\s*dài|kế\s*hoạch|giai\s*đoạn\s*\d+|kiểm\s*tra|ghi\s*chú\s*hệ\s*thống|tóm\s*tắt\s*diễn\s*biến)\b(?:\*\*|__)?(?:\s*[:\-–—.\]]|$|\s+\d))/i;

const INLINE_META_NOISE_RE =
  /(?:\(|\[)\s*(?:word\s*count|target\s*word\s*count|words?\s+per\s+paragraph|approx\.?\s*\d+\s*words?|~\s*\d+\s*(?:words?|từ)|số\s*từ|stage\s*\d+|ooc|plan\s+for\s+stage[^)\]]*)\s*(?::[^)\]]*)?(?:\)|\])/gi;

const VIET_DIACRITIC_RE =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

function trimToCleanSentence(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastPunct = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('! '),
    sliced.lastIndexOf('? '),
    sliced.lastIndexOf('… '),
    sliced.lastIndexOf('."'),
    sliced.lastIndexOf('.”'),
  );
  if (lastPunct >= Math.floor(maxLen * 0.55)) {
    return sliced.slice(0, lastPunct + 1).trim();
  }
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.7)
    ? sliced.slice(0, lastSpace)
    : sliced
  ).trim();
}

export function stripStoryPlanningAndMeta(raw: string): string {
  let txt = String(raw || '');
  if (!txt.trim()) return '';

  // 1. Strip paired reasoning/system XML tags BEFORE splitNarrativeAndMeta removes </thinking>
  txt = txt.replace(META_BLOCK_TAG_RE, '\n');

  // 2. If an orphan closing </thinking> / </plan> remains (e.g. from prefill-started thinking),
  // drop everything up to and including the last orphan closing tag when narrative follows it.
  let lastCloseEnd = -1;
  let closeMatch: RegExpExecArray | null;
  ORPHAN_CLOSE_THINKING_RE.lastIndex = 0;
  while ((closeMatch = ORPHAN_CLOSE_THINKING_RE.exec(txt)) !== null) {
    lastCloseEnd = closeMatch.index + closeMatch[0].length;
  }
  if (lastCloseEnd >= 0) {
    const afterClose = txt.slice(lastCloseEnd).trim();
    if (afterClose) {
      txt = afterClose;
    }
  }

  // 3. Handle unclosed <thinking>/<plan> opening tag by keeping only non-meta narrative after it
  const openMatch = ORPHAN_OPEN_THINKING_RE.exec(txt);
  if (openMatch) {
    const beforeOpen = txt.slice(0, openMatch.index).trim();
    const afterOpen = txt.slice(openMatch.index + openMatch[0].length);
    const afterParas = afterOpen.split(/\n{2,}/);
    const proseIdx = afterParas.findIndex(
      (p) =>
        p.trim() &&
        !CONTAINS_META_NOISE_RE.test(p) &&
        !META_HEADER_LINE_RE.test(p.trim()) &&
        !COT_BOLD_OR_SECTION_HEADING_RE.test(p.trim()) &&
        VIET_DIACRITIC_RE.test(p),
    );
    const recoveredAfter =
      proseIdx >= 0 ? afterParas.slice(proseIdx).join('\n\n').trim() : '';
    txt = [beforeOpen, recoveredAfter].filter(Boolean).join('\n\n');
  }

  // 4. Cut post-story meta blocks ([KẾT THÚC PHẦN TRUYỆN], <tableEdit>, #0 Thông tin Hiện tại...)
  txt = splitNarrativeAndMeta(txt, false).mainText;
  txt = txt
    .replace(META_BLOCK_TAG_RE, '\n')
    .replace(
      /<\/?(?:thinking|thought|reasoning|analysis|plan|outline|meta|system|ooc|scratchpad|chathistory|response|story|narrative|draft|cot|preset)[^>]*>/gi,
      '',
    )
    .replace(INLINE_META_NOISE_RE, ' ');

  // 5. Filter paragraph-by-paragraph and line-by-line (handles English CoT even when Vietnamese character names like "Uyển Nhi" appear inside)
  const rawParagraphs = txt.split(/\n{2,}/);
  const hasVietnameseProse = rawParagraphs.some(
    (p) =>
      VIET_DIACRITIC_RE.test(p) &&
      !CONTAINS_META_NOISE_RE.test(p) &&
      !META_HEADER_LINE_RE.test(p.trim()) &&
      !COT_BOLD_OR_SECTION_HEADING_RE.test(p.trim()) &&
      !isEnglishThinkingHeadingLine(p.trim()) &&
      !isEnglishThinkingBlock(p, false),
  );

  const keptParagraphs: string[] = [];

  for (const para of rawParagraphs) {
    // Drop English CoT/thinking/planning paragraphs even if they quote Vietnamese proper names (e.g. **Defining Uyển Nhi's Presence**)
    if (
      isEnglishThinkingBlock(para, hasVietnameseProse) ||
      (hasVietnameseProse &&
        !VIET_DIACRITIC_RE.test(para) &&
        (COT_BOLD_OR_SECTION_HEADING_RE.test(para.trim()) ||
          isEnglishTitleCaseHeadingLine(para.trim()) ||
          ENGLISH_COT_FIRST_PERSON_RE.test(para) ||
          CONTAINS_META_NOISE_RE.test(para) ||
          META_HEADER_LINE_RE.test(para.trim())))
    ) {
      continue;
    }

    const rawLines = para.split(/\r?\n/);
    const keptLines: string[] = [];
    let inPlanBlock = false;
    let droppedMetaInPara = 0;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed || /^[-*_]{3,}$/.test(trimmed)) {
        inPlanBlock = false;
        continue;
      }

      if (
        META_HEADER_LINE_RE.test(trimmed) ||
        COT_BOLD_OR_SECTION_HEADING_RE.test(trimmed) ||
        isEnglishThinkingHeadingLine(trimmed) ||
        isEnglishTitleCaseHeadingLine(trimmed) ||
        CONTAINS_META_NOISE_RE.test(trimmed)
      ) {
        inPlanBlock = true;
        droppedMetaInPara += 1;
        continue;
      }

      if (inPlanBlock) {
        const looksLikePlanSubLine =
          /^(?:[-*+•]\s+|\d+[.)]\s+|stage\s*\d+|beat\s*\d+|step\s*\d+|part\s*\d+)/i.test(
            trimmed,
          ) ||
          /^[A-Za-z][A-Za-z\s/&'-]{1,32}:\s*/.test(trimmed) ||
          isEnglishThinkingBlock(trimmed, hasVietnameseProse) ||
          (hasVietnameseProse && !VIET_DIACRITIC_RE.test(trimmed));
        if (looksLikePlanSubLine) {
          droppedMetaInPara += 1;
          continue;
        }
        inPlanBlock = false;
      }

      // Skip English-only or English-CoT lines (including lines referencing Vietnamese names) when the story itself is in Vietnamese
      if (
        isEnglishThinkingBlock(trimmed, hasVietnameseProse) ||
        (hasVietnameseProse &&
          !VIET_DIACRITIC_RE.test(trimmed) &&
          (/^(?:[-*+•]\s+|\d+[.)]\s+)/.test(trimmed) ||
            /^[A-Za-z][A-Za-z\s/&'-]{1,32}:\s*/.test(trimmed) ||
            ENGLISH_COT_FIRST_PERSON_RE.test(trimmed) ||
            /\b(?:paragraph|paragraphs|dialogue|narration|narrator|character|scene|stage|focus on|describe|transition|maintain|ensure|keep|avoid|establish|introduce|highlight|guest list|narrative flow|aftermath)\b/i.test(
              trimmed,
            )))
      ) {
        droppedMetaInPara += 1;
        continue;
      }

      const cleanedLine = trimmed
        .replace(/[*_`~#>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanedLine) {
        keptLines.push(cleanedLine);
      }
    }

    // If a paragraph was predominantly planning/outline notes with English fragments left over, skip it
    if (
      keptLines.length &&
      !(
        droppedMetaInPara > 0 &&
        hasVietnameseProse &&
        !VIET_DIACRITIC_RE.test(keptLines.join(' '))
      )
    ) {
      // Preserve newline boundaries so words from different lines never fuse together
      keptParagraphs.push(keptLines.join('\n'));
    }
  }

  // 6. Final sentence-level safety scrub so zero planning/CoT phrases can ever leak through
  const joined = keptParagraphs.join('\n').trim();
  const safeLines = joined
    .split(/\n+/)
    .map((line) => {
      const safeSentences = line
        .split(/(?<=[.!?…])\s+/)
        .map((s) => s.trim())
        .filter((s) => {
          if (!s) return false;
          if (CONTAINS_META_NOISE_RE.test(s)) return false;
          if (
            hasVietnameseProse &&
            !VIET_DIACRITIC_RE.test(s) &&
            ENGLISH_COT_FIRST_PERSON_RE.test(s)
          ) {
            return false;
          }
          return true;
        });
      return safeSentences.join(' ').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  return safeLines.join('\n').trim();
}

export function extractCleanStoryScene(
  rawAssistant: string,
  rawUser: string,
): string {
  const narrative = stripStoryPlanningAndMeta(rawAssistant);
  if (narrative) {
    return trimToCleanSentence(narrative, 500);
  }
  const userFallback = stripStoryPlanningAndMeta(rawUser);
  return userFallback ? trimToCleanSentence(userFallback, 320) : '';
}

const NON_PERSON_ACRONYMS = new Set([
  'VIP',
  'CEO',
  'CFO',
  'CTO',
  'COO',
  'DJ',
  'MC',
  'PR',
  'HR',
  'IT',
  'AI',
  'UI',
  'UX',
  'VR',
  'AR',
  'OK',
  'DM',
  'IG',
  'FB',
  'TV',
  'LED',
  'LCD',
  'ID',
  'SMS',
  'GPS',
  'USB',
  'PDF',
  'URL',
  'API',
  'HTTP',
  'HTML',
  'JSON',
  'ATM',
  'BMW',
  'SUV',
  'DNA',
  'LA',
  'NY',
  'NYC',
  'UK',
  'US',
  'USA',
  'VN',
  'EU',
  'UN',
  'FBI',
  'CIA',
  'SWAT',
  'NBA',
  'NFL',
  'UFC',
  'WWE',
  'BBQ',
  'KTV',
  'OOC',
  'POV',
  'NPC',
  'HP',
  'MP',
  'XP',
  'RPG',
  'FPS',
  'SFX',
  'BGM',
  'HUD',
  'AM',
  'PM',
  'BC',
  'AD',
  'LV',
  'YSL',
  'CDG',
  'NYC',
  'VIP',
]);

const LEADING_NON_NAME_WORDS = new Set([
  'trong',
  'ngoai',
  'tren',
  'duoi',
  'giua',
  'ben',
  'sau',
  'truoc',
  'khi',
  'luc',
  'vua',
  'dang',
  'da',
  'se',
  'roi',
  'nhung',
  'tuy',
  'neu',
  'vi',
  'boi',
  'nen',
  'con',
  'cung',
  'van',
  'lai',
  'chot',
  'bong',
  'ngay',
  'chi',
  'tham',
  'khong',
  'chua',
  'dung',
  'hay',
  'mot',
  'hai',
  'ba',
  'bon',
  'nam',
  'moi',
  'nhung',
  'cac',
  'tung',
  'ca',
  'toan',
  'day',
  'do',
  'kia',
  'noi',
  'cho',
  'voi',
  'cua',
  'tu',
  'den',
  've',
  'cho',
  'theo',
  'nhu',
  'tai',
  'o',
  'anh',
  'chi',
  'em',
  'cau',
  'co',
  'ong',
  'ba',
  'toi',
  'ta',
  'minh',
  'ho',
  'chung',
  'nguoi',
  'nang',
  'han',
  'ga',
  'nho',
  'be',
  'rapper',
  'ca',
  'sieu',
  'dien',
  'nghe',
  'bac',
  'giao',
  'su',
  'tieu',
  'thieu',
  'cong',
  'nhin',
  'thay',
  'gap',
  'hoi',
  'dap',
  'noi',
  'cuoi',
  'buoc',
  'quay',
  'ngoi',
  'dung',
  'cam',
  'nang',
  'dua',
  'goi',
  'the',
  'and',
  'with',
  'from',
  'near',
  'next',
  'while',
  'when',
  'then',
  'after',
  'before',
  'where',
  'here',
  'there',
  'this',
  'that',
  'these',
  'those',
]);

const NON_PERSON_PHRASES = new Set([
  'los angeles',
  'new york',
  'new york city',
  'beverly hills',
  'hollywood hills',
  'las vegas',
  'san francisco',
  'hong kong',
  'south korea',
  'united states',
  'united kingdom',
  'viet nam',
  'sai gon',
  'ha noi',
  'da nang',
  'thuong hai',
  'bac kinh',
  'rolls royce',
  'louis vuitton',
  'chrome hearts',
  'saint laurent',
  'bottega veneta',
  'ralph lauren',
  'dom perignon',
  'audemars piguet',
  'patek philippe',
  'richard mille',
  'mercedes benz',
  'aston martin',
  'range rover',
  'balenciaga',
  'met gala',
  'fashion week',
  'after party',
  'vip lounge',
  'rooftop bar',
  'word count',
  'plan for',
  'system boot',
  'resource loading',
]);

const normalizeNameKey = normalizeCharacterKey;

export function extractPresentCharactersFromScene(
  cleanSceneText: string,
  state: ArkState,
): string[] {
  const text = String(cleanSceneText || '').trim();
  if (!text) return [];

  const textNorm = normalizeNameKey(text);
  const found: Array<{ name: string; pos: number }> = [];

  const activeComp = getActiveCompanionFromState(state);
  const allowedKnownKeys = buildAllowedRosterKeys(activeComp, state.player?.name);

  const registerName = (rawName: string, pos: number) => {
    const cleaned = sanitizeCharacterName(rawName, allowedKnownKeys);
    if (!cleaned) return;
    const key = normalizeNameKey(cleaned);
    if (!key || NON_PERSON_PHRASES.has(key)) return;
    if (NON_PERSON_ACRONYMS.has(cleaned)) return;
    if (LEADING_NON_NAME_WORDS.has(key)) return;
    found.push({ name: cleaned, pos });
  };

  // 1. Known roster characters (active companion NPCs, canon candidates, MC, player)
  const mcNamesNorm = new Set(
    [activeComp?.mc?.name || '', state.player?.name || '']
      .map((s) => normalizeNameKey(s))
      .filter((s) => s.length >= 2),
  );
  const knownNames = [
    ...(activeComp?.npcs || []).map((n) => n.name),
    ...(activeComp?.canonCandidates || []).map((c) => c.name),
    activeComp?.mc?.name || '',
    activeComp?.mc?.canonMcName || '',
    state.player?.name || '',
  ]
    .map((s) => String(s || '').trim())
    .filter((s) => s.length >= 2);

  for (const kn of knownNames) {
    const knNorm = normalizeNameKey(kn);
    if (!knNorm) continue;
    const idx = textNorm.indexOf(knNorm);
    if (idx >= 0) {
      // Skip character if explicitly stated as absent in the scene (e.g. MC not in the US / not at the party)
      if (isCharacterExplicitlyAbsent(text, kn, mcNamesNorm.has(knNorm))) {
        continue;
      }
      registerName(kn, idx);
    }
  }

  // Scan line-by-line so proper names NEVER bridge across newline boundaries
  const lines = text.split(/\n+/);
  let lineOffset = 0;

  // 2. Multi-word proper names (e.g., Central Cee, Zac Bia, Jennie Kim, Kendall Jenner, Kim Kardashian, Finneas O'Connell, Charli XCX, Lâm Tuyết)
  // Note: NO `.` inside word body so "Jennie. I'm" can NEVER fuse across a sentence period!
  const multiWordRe =
    /(?<![\p{L}\p{N}])((?:(?:O|D|L|Mc)['’])?[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}\p{Lu}-]*(?:-[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}-]+)?(?:\s+(?:(?:van|von|de|del|la|le|da|di|du)\s+)?(?:(?:O|D|L|Mc)['’])?[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}\p{Lu}-]*(?:['’]s)?){1,3})(?![\p{L}\p{N}])/gu;

  // 3. Stage/hyphenated names & all-caps short names (e.g., MGK, SZA, A$AP Rocky, G-Dragon, J-Hope)
  const stageRe =
    /(?<![\p{L}\p{N}])([A-Z]\$[A-Z]{2,}(?:\s+[A-Z][\p{Ll}]+)?|[A-Z]{1,2}-[A-Z][\p{Ll}]+|[A-Z]{2,5})(?![\p{L}\p{N}])/gu;

  // 4. Single capitalized proper name right after a Vietnamese personal title/role
  const titledSingleRe =
    /\b(?:anh|chị|cô|cậu|ông|bà|em|nàng|hắn|gã|rapper|ca\s+sĩ|siêu\s+mẫu|người\s+mẫu|diễn\s+viên|DJ)\s+([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}-]{2,})(?![\p{L}\p{N}])/gu;

  for (const line of lines) {
    let m: RegExpExecArray | null;

    multiWordRe.lastIndex = 0;
    while ((m = multiWordRe.exec(line)) !== null) {
      const words = m[1].split(/\s+/);
      // Trim leading Vietnamese/English stop-words or honorifics (e.g. "Cùng Kendall Jenner" -> "Kendall Jenner")
      while (
        words.length > 1 &&
        LEADING_NON_NAME_WORDS.has(normalizeNameKey(words[0]))
      ) {
        words.shift();
      }
      if (words.length >= 2) {
        const candidate = words.join(' ');
        if (
          words.every(
            (w) =>
              w.length >= 2 ||
              /^[A-Z]\.?$/.test(w) ||
              /^(?:de|la|le|da|di|du|van|von)$/i.test(w),
          )
        ) {
          registerName(candidate, lineOffset + m.index);
        }
      }
    }

    stageRe.lastIndex = 0;
    while ((m = stageRe.exec(line)) !== null) {
      const token = m[1];
      if (!NON_PERSON_ACRONYMS.has(token)) {
        registerName(token, lineOffset + m.index);
      }
    }

    titledSingleRe.lastIndex = 0;
    while ((m = titledSingleRe.exec(line)) !== null) {
      const single = m[1];
      const singleNorm = normalizeNameKey(single);
      if (!LEADING_NON_NAME_WORDS.has(singleNorm)) {
        registerName(single, lineOffset + m.index);
      }
    }

    lineOffset += line.length + 1;
  }

  // Deduplicate by normalized key & drop single-word shadows of fuller names (e.g. drop "Jennie" if "Jennie Kim" exists)
  found.sort((a, b) => a.pos - b.pos);
  const unique: Array<{ name: string; key: string; pos: number }> = [];
  const seenKeys = new Set<string>();
  for (const item of found) {
    const key = normalizeNameKey(item.name);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    unique.push({ name: item.name, key, pos: item.pos });
  }

  const finalNames = unique
    .filter((item) => {
      const isSingle = !item.key.includes(' ');
      if (!isSingle) return true;
      return !unique.some(
        (other) =>
          other.key !== item.key &&
          other.key.includes(' ') &&
          other.key.split(' ').includes(item.key),
      );
    })
    .map((item) => item.name)
    .slice(0, 10);

  return finalNames;
}

export interface StoryImagePromptContextResult {
  variables: Record<string, string>;
  subjectLabel: string;
  presentCharacters: string[];
  newCharacters: string[];
  defaultPartsPrompt: string;
}

export function buildStoryImagePromptContext(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  overrideStoryText?: string;
}): StoryImagePromptContextResult {
  const { state, turn, storyImageConfig, overrideStoryText } = options;
  const activeComp = getActiveCompanionFromState(state);
  const npcs = Array.isArray(activeComp?.npcs) ? activeComp.npcs : [];
  const portraits = Array.isArray(state.portraitBank?.portraits)
    ? state.portraitBank.portraits
    : [];
  const charStates = Array.isArray(state.memory?.characterStates)
    ? state.memory.characterStates
    : [];

  const targetTurn =
    turn ||
    (state.turns.length
      ? state.turns[Math.min(state.currentPage, state.turns.length - 1)] ||
        state.turns[state.turns.length - 1]
      : undefined);

  const fullCleanAssistant = targetTurn
    ? stripStoryPlanningAndMeta(targetTurn.assistant || '')
    : '';
  const fullCleanUser = targetTurn
    ? stripStoryPlanningAndMeta(targetTurn.user || '')
    : '';
  const fullCleanTurn = fullCleanAssistant || fullCleanUser;
  const sceneText = fullCleanAssistant
    ? trimToCleanSentence(fullCleanAssistant, 520)
    : fullCleanUser
      ? trimToCleanSentence(fullCleanUser, 340)
      : '';

  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const mcKeyForFilter = normalizeNameKey(rawMcName);
  const mcPresentInScene = isMcPresentInTurn(
    fullCleanAssistant,
    fullCleanUser,
    rawMcName,
    activeComp?.mc?.pronoun,
  );

  const rawPresentCharacters = extractPresentCharactersFromScene(
    [fullCleanAssistant, fullCleanUser].filter(Boolean).join('\n'),
    state,
  );
  const presentCharacters = mcPresentInScene
    ? rawPresentCharacters
    : rawPresentCharacters.filter((c) => {
        const k = normalizeNameKey(c);
        return (
          !(mcKeyForFilter && k === mcKeyForFilter) &&
          k !== 'nhan vat chinh' &&
          k !== 'nvc'
        );
      });

  const extraCustom = (storyImageConfig.customSubject || '').trim();
  const styleObj = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    storyImageConfig.customStyles,
  );

  // Build rich full profile lines for on-scene characters
  const onSceneFullLines: string[] = [];
  for (const name of presentCharacters) {
    const key = normalizeNameKey(name);
    const isMc = Boolean(mcKeyForFilter && key === mcKeyForFilter);
    const matchedNpc = npcs.find((n) => normalizeNameKey(n.name || '') === key);
    const matchedPortrait = portraits.find(
      (p) => normalizeNameKey(p.name || '') === key,
    );
    const matchedState = charStates.find(
      (cs) => normalizeNameKey(cs.name || '') === key,
    );

    if (isMc && activeComp?.mc) {
      const mc = activeComp.mc;
      const details = [
        mc.gender || '',
        mc.age ? `${mc.age} tuổi` : '',
        mc.appearance ? trimToCleanSentence(mc.appearance, 150) : '',
        matchedPortrait?.fashionStyle
          ? `Trang phục: ${trimToCleanSentence(matchedPortrait.fashionStyle, 110)}`
          : '',
        matchedState?.mood ? `Tâm trạng: ${matchedState.mood}` : '',
      ].filter(Boolean);
      onSceneFullLines.push(
        `- ${name} (Nhân vật chính)${details.length ? `: ${details.join(' · ')}` : ''}`,
      );
    } else if (matchedNpc || matchedPortrait || matchedState) {
      const role = matchedNpc?.role || matchedPortrait?.role || '';
      const appearance =
        matchedPortrait?.appearance?.trim() ||
        matchedNpc?.appearance?.trim() ||
        matchedNpc?.desc?.trim() ||
        '';
      const fashion = matchedPortrait?.fashionStyle?.trim() || '';
      const mood = matchedState?.mood?.trim() || '';
      const details = [
        appearance ? trimToCleanSentence(appearance, 150) : '',
        fashion ? `Trang phục: ${trimToCleanSentence(fashion, 110)}` : '',
        mood ? `Thần thái: ${mood}` : '',
      ].filter(Boolean);
      onSceneFullLines.push(
        `- ${name}${role ? ` (${role})` : ''}${details.length ? `: ${details.join(' · ')}` : ''}`,
      );
    } else {
      onSceneFullLines.push(`- ${name}`);
    }
  }

  // Detect new characters (present in scene without portrait image or not seen in prior turns)
  const priorTurnsText = state.turns
    .filter((t) => !targetTurn || t.id !== targetTurn.id)
    .slice(-12)
    .map((t) => `${t.user || ''} ${t.assistant || ''}`)
    .join('\n')
    .toLowerCase();
  const newCharacters = presentCharacters.filter((name) => {
    const key = normalizeNameKey(name);
    const portrait = portraits.find(
      (p) => normalizeNameKey(p.name || '') === key,
    );
    const hasPortraitImg = Boolean(portrait?.imageData?.trim());
    const seenBefore = priorTurnsText.includes(name.toLowerCase());
    return !hasPortraitImg || !seenBefore;
  });

  // Current time from Story Clock
  const clockText = state.memory?.storyClock
    ? formatStoryClock(normalizeStoryClock(state.memory.storyClock)).fullLabel
    : 'Chưa xác định thời gian';

  // Current location from active character states or world setting
  const presentKeys = new Set(presentCharacters.map((c) => normalizeNameKey(c)));
  const activeStateLoc =
    charStates.find(
      (cs) => presentKeys.has(normalizeNameKey(cs.name || '')) && cs.location?.trim(),
    )?.location?.trim() ||
    charStates.find((cs) => cs.location?.trim())?.location?.trim() ||
    '';
  const currentLocation =
    activeStateLoc ||
    (state.world?.name?.trim()
      ? state.world.name.trim()
      : activeComp?.worldSetting?.trim()
        ? trimToCleanSentence(activeComp.worldSetting.trim(), 110)
        : 'Chưa xác định địa điểm');

  const parts: string[] = [];
  let subjectLabel = 'Cảnh truyện';

  if (storyImageConfig.targetMode === 'npc') {
    const selectedNpc =
      npcs.find((n) => n.id === storyImageConfig.selectedNpcId) || npcs[0];
    if (selectedNpc) {
      subjectLabel = `NPC: ${selectedNpc.name || 'NPC'}`;
      const visualBody =
        selectedNpc.appearance?.trim() || selectedNpc.desc?.trim() || '';
      const vibeHint = [
        selectedNpc.personality?.trim()
          ? trimToCleanSentence(selectedNpc.personality.trim(), 90)
          : '',
        selectedNpc.signature?.trim()
          ? trimToCleanSentence(selectedNpc.signature.trim(), 80)
          : '',
      ]
        .filter(Boolean)
        .join('; ');
      const npcInfo = [
        selectedNpc.name || 'NPC',
        selectedNpc.role ? `(${selectedNpc.role})` : '',
        visualBody ? `— ${trimToCleanSentence(visualBody, 180)}` : '',
        vibeHint ? `| Thần thái: ${vibeHint}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      parts.push(`Nhân vật chính trong khung hình: ${npcInfo}.`);
      const selKey = normalizeNameKey(selectedNpc.name || '');
      const others = presentCharacters.filter(
        (c) => normalizeNameKey(c) !== selKey,
      );
      if (others.length) {
        parts.push(`Nhân vật cùng có mặt: ${others.join(', ')}.`);
      }
    } else {
      subjectLabel = 'NPC trong cảnh';
      if (presentCharacters.length) {
        parts.push(`Nhân vật trong cảnh: ${presentCharacters.join(', ')}.`);
      }
    }
    if (sceneText) {
      parts.push(`Diễn biến & bối cảnh: ${sceneText}`);
    }
    if (extraCustom) {
      parts.push(`Chi tiết bổ sung: ${extraCustom}.`);
    }
  } else if (storyImageConfig.targetMode === 'mc') {
    const mc = activeComp?.mc;
    const mcName = mc?.name || state.player?.name || 'Nhân vật chính';
    subjectLabel = `NV chính: ${mcName}`;
    const mcTraits = [
      mc?.gender ? mc.gender : '',
      mc?.age ? `${mc.age} tuổi` : '',
      mc?.appearance ? trimToCleanSentence(mc.appearance, 150) : '',
    ]
      .filter(Boolean)
      .join(', ');
    parts.push(
      `Nhân vật chính trong khung hình: ${mcName}${mcTraits ? ` (${mcTraits})` : ''}.`,
    );
    const mcKey = normalizeNameKey(mcName);
    const others = presentCharacters.filter(
      (c) => normalizeNameKey(c) !== mcKey,
    );
    if (others.length) {
      parts.push(`Nhân vật cùng có mặt: ${others.join(', ')}.`);
    }
    if (sceneText) {
      parts.push(`Diễn biến & bối cảnh: ${sceneText}`);
    }
    if (extraCustom) {
      parts.push(`Chi tiết bổ sung: ${extraCustom}.`);
    }
  } else if (storyImageConfig.targetMode === 'custom') {
    subjectLabel = extraCustom
      ? `Tùy chọn: ${extraCustom.slice(0, 32)}${extraCustom.length > 32 ? '…' : ''}`
      : 'Tùy chọn';
    if (extraCustom) {
      parts.push(extraCustom);
    } else {
      if (presentCharacters.length) {
        parts.push(`Nhân vật trong cảnh: ${presentCharacters.join(', ')}.`);
      }
      if (sceneText) {
        parts.push(`Diễn biến & bối cảnh: ${sceneText}`);
      }
    }
  } else {
    subjectLabel = 'Cảnh truyện';
    if (presentCharacters.length) {
      parts.push(`Nhân vật trong cảnh: ${presentCharacters.join(', ')}.`);
    }
    if (sceneText) {
      parts.push(`Diễn biến & bối cảnh: ${sceneText}`);
    } else if (fullCleanTurn) {
      parts.push(trimToCleanSentence(fullCleanTurn, 420));
    }
    if (extraCustom) {
      parts.push(`Chi tiết bổ sung: ${extraCustom}.`);
    }
  }

  const resolvedStoryText =
    (overrideStoryText || '').trim() ||
    (storyImageConfig.targetMode === 'custom' && extraCustom
      ? extraCustom
      : [sceneText || fullCleanTurn, extraCustom ? `Chi tiết bổ sung: ${extraCustom}` : '']
          .filter(Boolean)
          .join('\n')) ||
    'Khung cảnh mở đầu câu chuyện.';

  const imgCount = Math.max(1, Math.min(4, Number(storyImageConfig.imageCount) || 1));
  const gridKey = storyImageConfig.imageGridMode || 'single';
  const genKey = storyImageConfig.imageGenerationMode || 'scene';

  const variables: Record<string, string> = {
    '${story_text}': resolvedStoryText,
    '${onscene_characters_full}': onSceneFullLines.length
      ? onSceneFullLines.join('\n')
      : 'Chưa xác định nhân vật cụ thể trong khung hình.',
    '${current_time}': clockText,
    '${current_location}': currentLocation,
    '${entry_decision_new_characters}': newCharacters.length
      ? newCharacters.join(', ')
      : 'Không có nhân vật mới cần tạo thiết kế riêng.',
    '${image_count}': String(imgCount),
    '${image_grid_mode}':
      IMAGE_GRID_MODE_LABELS[gridKey] || IMAGE_GRID_MODE_LABELS.single,
    '${image_generation_mode}':
      IMAGE_GENERATION_MODE_LABELS[genKey] || IMAGE_GENERATION_MODE_LABELS.scene,
    '${image_style_name}': styleObj.label,
    '${image_style_description}': styleObj.description,
    '${image_style_prompt_guide}': styleObj.promptGuide,
  };

  return {
    variables,
    subjectLabel,
    presentCharacters,
    newCharacters,
    defaultPartsPrompt:
      parts.filter(Boolean).join('\n').trim() || 'Khung cảnh mở đầu câu chuyện.',
  };
}

export function previewStoryImagePrompt(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  draftTemplate?: string;
  overrideStoryText?: string;
}): {
  beforeInjection: string;
  afterInjection: string;
  variables: Record<string, string>;
  subjectLabel: string;
} {
  const { state, turn, storyImageConfig, draftTemplate, overrideStoryText } =
    options;
  const ctx = buildStoryImagePromptContext({
    state,
    turn,
    storyImageConfig,
    overrideStoryText,
  });
  const activeStyle = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    storyImageConfig.customStyles,
  );
  const rawTemplate = (
    draftTemplate !== undefined
      ? draftTemplate
      : storyImageConfig.promptTemplate || ''
  ).trim();
  const beforeInjection = rawTemplate || DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE;
  const afterInjection = interpolateImagePromptTemplate(
    beforeInjection,
    ctx.variables,
    {
      style: activeStyle,
      cameraAngle: storyImageConfig.cameraAngle,
    },
  );
  return {
    beforeInjection,
    afterInjection,
    variables: ctx.variables,
    subjectLabel: ctx.subjectLabel,
  };
}

export function buildStoryImagePrompt(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
}): { prompt: string; subjectLabel: string } {
  const { state, turn, storyImageConfig } = options;
  const ctx = buildStoryImagePromptContext({ state, turn, storyImageConfig });
  const styleObj = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    storyImageConfig.customStyles,
  );

  // If user saved a custom prompt template, always render through it
  const customTemplate = (storyImageConfig.promptTemplate || '').trim();
  if (customTemplate) {
    const rendered = interpolateImagePromptTemplate(
      customTemplate,
      ctx.variables,
      {
        style: styleObj,
        cameraAngle: storyImageConfig.cameraAngle,
      },
    );
    return {
      prompt: rendered,
      subjectLabel: ctx.subjectLabel,
    };
  }

  // Otherwise keep compact scene-focused default prompt while still interpolating any template variables in customSubject
  let basePrompt = ctx.defaultPartsPrompt;
  if (HAS_ANY_IMAGE_TEMPLATE_VAR_RE.test(basePrompt)) {
    basePrompt = interpolateImagePromptTemplate(basePrompt, ctx.variables, {
      style: styleObj,
      cameraAngle: storyImageConfig.cameraAngle,
    });
    return {
      prompt: basePrompt,
      subjectLabel: ctx.subjectLabel,
    };
  }

  const finalPrompt = applyImageStyleVariables(
    basePrompt,
    styleObj,
    storyImageConfig.customStyles,
    storyImageConfig.cameraAngle,
  );
  return {
    prompt: finalPrompt,
    subjectLabel: ctx.subjectLabel,
  };
}

export async function generateStoryImage(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  prompt: string;
  subjectLabel: string;
  error?: string;
  aborted?: boolean;
}> {
  const { state, turn, storyImageConfig, signal, onLog } = options;
  const { prompt, subjectLabel } = buildStoryImagePrompt({
    state,
    turn,
    storyImageConfig,
  });

  const endpointRaw = (
    state.config.seedreamUrl ||
    state.config.proxyUrl ||
    ''
  ).trim();
  const apiKey = (
    state.config.seedreamApiKey ||
    state.config.proxyKey ||
    ''
  ).trim();
  const sdModel = (state.config.seedreamModel || '').trim() || 'seedream-5.0-pro';
  const sdSize =
    (storyImageConfig.size || state.config.seedreamSize || '').trim() ||
    '1024x1024';

  if (!endpointRaw) {
    return {
      ok: false,
      prompt,
      subjectLabel,
      error:
        'Chưa cấu hình Seedream 5 Pro Endpoint. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
    };
  }

  const endpoints = buildSeedreamEndpoints(endpointRaw);
  onLog?.(`Đang sinh ảnh truyện [${subjectLabel}] với model ${sdModel}...`);

  let lastErr = '';
  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['x-api-key'] = apiKey;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model: sdModel,
          prompt,
          size: sdSize,
          n: 1,
          response_format: 'url',
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        lastErr = `HTTP ${res.status} tại ${url}${
          errTxt ? `: ${errTxt.slice(0, 200)}` : ''
        }`;
        onLog?.(lastErr);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('image/')) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
        onLog?.(`Sinh ảnh truyện thành công từ ${url}`);
        return { ok: true, imageUrl: dataUrl, prompt, subjectLabel };
      }
      const json = await res.json();
      const imgSrc = extractImageFromSeedreamResponse(json);
      if (!imgSrc) {
        lastErr = `Phản hồi không chứa url/base64 ảnh hợp lệ từ ${url}`;
        onLog?.(lastErr);
        continue;
      }
      onLog?.(`Sinh ảnh truyện thành công từ ${url}`);
      return { ok: true, imageUrl: imgSrc, prompt, subjectLabel };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, prompt, subjectLabel, aborted: true };
      }
      lastErr = formatSeedreamFetchError(url, err);
      onLog?.(lastErr);
    }
  }

  return {
    ok: false,
    prompt,
    subjectLabel,
    error:
      lastErr ||
      'Không thể sinh ảnh từ Seedream 5 Pro. Hãy kiểm tra Endpoint và API Key trong Cấu hình.',
  };
}

export interface DetectedPortraitCandidate {
  name: string;
  isMc: boolean;
  role: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  appearance: string;
  personality?: string;
  relationships?: string;
  signature?: string;
  npcId?: string;
  contextSnippet: string;
}

function extractMentionSentence(cleanText: string, charName: string): string {
  const normTarget = normalizeCharacterKey(charName);
  if (!normTarget || !cleanText) return '';
  const sentences = cleanText
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of sentences) {
    if (normalizeCharacterKey(s).includes(normTarget)) {
      return trimToCleanSentence(s, 220);
    }
  }
  return trimToCleanSentence(cleanText, 220);
}

export function detectCharactersInTurnForPortraits(
  turn: Turn | undefined,
  state: ArkState,
): DetectedPortraitCandidate[] {
  if (!turn) return [];

  // Strictly strip all thinking/planning/outline/meta noise before scanning
  const cleanAssistant = stripStoryPlanningAndMeta(turn.assistant || '');
  const cleanUser = stripStoryPlanningAndMeta(turn.user || '');
  const combinedClean = [cleanAssistant, cleanUser].filter(Boolean).join('\n');
  if (!combinedClean.trim()) return [];

  const activeComp = getActiveCompanionFromState(state);
  const allowedKnownKeys = buildAllowedRosterKeys(activeComp, state.player?.name);
  const existingPortraits = state.portraitBank?.portraits || [];
  const npcs = activeComp?.npcs || [];
  const mcName = (activeComp?.mc?.name || state.player?.name || '').trim();
  const mcKey = normalizeCharacterKey(mcName);
  const mcPresent = isMcPresentInTurn(
    cleanAssistant,
    cleanUser,
    mcName,
    activeComp?.mc?.pronoun,
  );

  // Scan primarily on actual story prose (cleanAssistant), falling back to cleanUser only if assistant is empty
  const proseForDetection = cleanAssistant || cleanUser;
  const proseNorm = normalizeCharacterKey(proseForDetection);
  const extractedNames = extractPresentCharactersFromScene(
    proseForDetection,
    state,
  );

  const orderedNames: string[] = [];
  const seenKeys = new Set<string>();

  const pushName = (rawName: string) => {
    const cleaned = sanitizeCharacterName(rawName, allowedKnownKeys);
    if (!cleaned) return;
    const key = normalizeCharacterKey(cleaned);
    if (!key || cleaned.length < 2 || seenKeys.has(key)) return;
    // Never include MC when MC is absent or unmentioned in the turn
    if (!mcPresent && ((mcKey && key === mcKey) || key === 'nhan vat chinh' || key === 'nvc')) {
      return;
    }
    if (isCharacterExplicitlyAbsent(combinedClean, cleaned, false)) return;
    seenKeys.add(key);
    orderedNames.push(cleaned);
  };

  // Match valid existing portrait bank characters first if mentioned in actual story prose
  for (const p of existingPortraits) {
    if (p.isMc && !mcPresent) continue;
    const validName = p.isMc
      ? p.name.trim()
      : sanitizeCharacterName(p.name, allowedKnownKeys);
    if (!validName) continue;
    const k = normalizeCharacterKey(validName);
    if (k && k.length >= 2 && proseNorm.includes(k)) {
      pushName(validName);
    }
  }

  // Then all valid names detected from clean scene prose
  for (const name of extractedNames) {
    pushName(name);
  }

  const results: DetectedPortraitCandidate[] = [];
  for (const name of orderedNames) {
    const key = normalizeCharacterKey(name);
    const matchedPortrait = existingPortraits.find(
      (p) => normalizeCharacterKey(p.name) === key,
    );
    const matchedNpc = npcs.find(
      (n) => normalizeCharacterKey(n.name) === key,
    );
    const isMc =
      Boolean(matchedPortrait?.isMc) || (Boolean(mcKey) && key === mcKey);

    if (isMc && !mcPresent) continue;

    const localResolved = resolveLocalVividNpcProfile({
      name: matchedPortrait?.name || matchedNpc?.name || name,
      isMc,
      comp: activeComp,
      cleanStoryText: proseForDetection,
      storyClock: state.memory?.storyClock,
    });
    const celeb = lookupKnownCelebrityProfile(name);

    const role =
      matchedPortrait?.role ||
      matchedNpc?.role ||
      localResolved.role ||
      celeb?.role ||
      (isMc ? 'Nhân vật chính' : 'NPC trong truyện');

    // Respect manual edits if already set; otherwise use resolved vivid profile
    const age = matchedPortrait?.profileManual
      ? matchedPortrait.age
      : matchedPortrait?.age?.trim() || localResolved.age;
    const birthday = matchedPortrait?.profileManual
      ? matchedPortrait.birthday
      : matchedPortrait?.birthday?.trim() || localResolved.birthday;
    const fashionStyle = matchedPortrait?.profileManual
      ? matchedPortrait.fashionStyle
      : matchedPortrait?.fashionStyle?.trim() || localResolved.fashionStyle;
    const appearance = matchedPortrait?.appearanceManual
      ? matchedPortrait.appearance
      : matchedPortrait?.appearance?.trim() || localResolved.appearance;
    const personality = matchedPortrait?.profileManual
      ? matchedPortrait.personality
      : matchedPortrait?.personality?.trim() || localResolved.personality;
    const relationships = matchedPortrait?.profileManual
      ? matchedPortrait.relationships
      : matchedPortrait?.relationships?.trim() || localResolved.relationships;
    const signature = matchedPortrait?.profileManual
      ? matchedPortrait.signature
      : matchedPortrait?.signature?.trim() || localResolved.signature;

    results.push({
      name: matchedPortrait?.name || matchedNpc?.name || celeb?.canonicalName || name,
      isMc,
      role,
      ...(age ? { age } : {}),
      ...(birthday ? { birthday } : {}),
      ...(fashionStyle ? { fashionStyle } : {}),
      appearance,
      ...(personality ? { personality } : {}),
      ...(relationships ? { relationships } : {}),
      ...(signature ? { signature } : {}),
      npcId: matchedPortrait?.npcId || matchedNpc?.id,
      contextSnippet: extractMentionSentence(proseForDetection, name),
    });
  }

  return results;
}

export function buildCharacterPortraitPrompt(options: {
  character: Pick<
    CharacterPortrait,
    | 'name'
    | 'role'
    | 'age'
    | 'birthday'
    | 'fashionStyle'
    | 'appearance'
    | 'personality'
    | 'signature'
    | 'isMc'
  >;
  state: ArkState;
  sceneContext?: string;
}): string {
  const { character, state, sceneContext } = options;
  const activeComp = getActiveCompanionFromState(state);
  const styleObj = resolveStoryImageStyle(
    state.storyImage?.stylePreset,
    state.storyImage?.customStyles,
  );

  const parts: string[] = [];
  const rolePart = character.role ? ` (${character.role})` : '';
  parts.push(`Chân dung nhân vật: ${character.name}${rolePart}.`);

  const rawAge = (character.age || '').trim();
  const effectiveAge = rawAge
    ? /^\d+$/.test(rawAge)
      ? `${rawAge} tuổi`
      : rawAge
    : computeAgeFromBirthday(character.birthday, state.memory?.storyClock);
  if (effectiveAge) {
    parts.push(`Độ tuổi hiển thị (gương mặt & vóc dáng đúng tuổi): ${effectiveAge}.`);
  }

  const appearanceClean = (character.appearance || '').trim();
  if (appearanceClean) {
    parts.push(`Ngoại hình: ${trimToCleanSentence(appearanceClean, 250)}.`);
  }

  const fashionClean = (character.fashionStyle || '').trim();
  if (fashionClean) {
    parts.push(`Style ăn mặc & phụ kiện đặc trưng: ${trimToCleanSentence(fashionClean, 230)}.`);
  }

  const vibeBits = [
    character.personality?.trim()
      ? trimToCleanSentence(character.personality.trim(), 120)
      : '',
    character.signature?.trim()
      ? trimToCleanSentence(character.signature.trim(), 110)
      : '',
  ].filter(Boolean);
  if (vibeBits.length) {
    parts.push(`Khí chất & điểm nhấn biểu cảm: ${vibeBits.join(' · ')}.`);
  }

  const cleanContext = sceneContext
    ? trimToCleanSentence(stripStoryPlanningAndMeta(sceneContext), 220)
    : '';
  if (cleanContext) {
    parts.push(`Bối cảnh & trang phục trong cảnh: ${cleanContext}`);
  } else if (activeComp?.worldSetting?.trim()) {
    parts.push(
      `Bối cảnh thế giới: ${trimToCleanSentence(activeComp.worldSetting, 160)}.`,
    );
  }

  const combinedOutfitText = `${fashionClean} ${appearanceClean} ${cleanContext}`;
  const explicitlyMentionsSuit =
    /\b(?:vest|com\s*lê|comple|suit|tuxedo|blazer|âu\s*phục)\b/i.test(
      combinedOutfitText,
    );
  if (!explicitlyMentionsSuit) {
    parts.push(
      'Bám sát đúng độ tuổi, style ăn mặc và phụ kiện theo hồ sơ / bối cảnh thực tế; tuyệt đối không tự ý mặc vest, com lê hay âu phục công sở rập khuôn.',
    );
  } else {
    parts.push(
      'Tập trung rõ gương mặt đúng độ tuổi, trang phục đúng style hồ sơ và thần thái đặc trưng của nhân vật.',
    );
  }

  const basePortraitPrompt = parts.join('\n').trim();
  return applyImageStyleVariables(
    basePortraitPrompt,
    styleObj,
    state.storyImage?.customStyles,
    state.storyImage?.cameraAngle,
  );
}

export async function generateCharacterPortraitImage(options: {
  state: ArkState;
  character: Pick<
    CharacterPortrait,
    | 'name'
    | 'role'
    | 'age'
    | 'birthday'
    | 'fashionStyle'
    | 'appearance'
    | 'personality'
    | 'signature'
    | 'isMc'
  >;
  sceneContext?: string;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  prompt: string;
  error?: string;
  aborted?: boolean;
}> {
  const { state, character, sceneContext, signal, onLog } = options;
  const prompt = buildCharacterPortraitPrompt({
    character,
    state,
    sceneContext,
  });

  const endpointRaw = (
    state.config.seedreamUrl ||
    state.config.proxyUrl ||
    ''
  ).trim();
  const apiKey = (
    state.config.seedreamApiKey ||
    state.config.proxyKey ||
    ''
  ).trim();
  const sdModel = (state.config.seedreamModel || '').trim() || 'seedream-5.0-pro';
  const sdSize =
    (state.storyImage?.size || state.config.seedreamSize || '').trim() ||
    '896x1152';

  if (!endpointRaw) {
    return {
      ok: false,
      prompt,
      error:
        'Chưa cấu hình Seedream 5 Pro Endpoint. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
    };
  }

  const endpoints = buildSeedreamEndpoints(endpointRaw);
  onLog?.(`[Ảnh NV] Đang sinh chân dung "${character.name}" với ${sdModel}...`);

  let lastErr = '';
  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['x-api-key'] = apiKey;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model: sdModel,
          prompt,
          size: sdSize,
          n: 1,
          response_format: 'url',
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        lastErr = `HTTP ${res.status} tại ${url}${
          errTxt ? `: ${errTxt.slice(0, 200)}` : ''
        }`;
        onLog?.(`[Ảnh NV] ${lastErr}`);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('image/')) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
        onLog?.(`[Ảnh NV] Đã tạo chân dung "${character.name}" thành công.`);
        return { ok: true, imageUrl: dataUrl, prompt };
      }
      const json = await res.json();
      const imgSrc = extractImageFromSeedreamResponse(json);
      if (!imgSrc) {
        lastErr = `Phản hồi không chứa url/base64 ảnh hợp lệ từ ${url}`;
        onLog?.(`[Ảnh NV] ${lastErr}`);
        continue;
      }
      onLog?.(`[Ảnh NV] Đã tạo chân dung "${character.name}" thành công.`);
      return { ok: true, imageUrl: imgSrc, prompt };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, prompt, aborted: true };
      }
      lastErr = formatSeedreamFetchError(url, err);
      onLog?.(`[Ảnh NV] ${lastErr}`);
    }
  }

  return {
    ok: false,
    prompt,
    error:
      lastErr ||
      `Không thể sinh ảnh cho "${character.name}". Hãy kiểm tra cấu hình Seedream 5 Pro.`,
  };
}

export interface AppearanceEnrichmentTarget {
  id: string;
  name: string;
  isMc: boolean;
  role: string;
  currentAge?: string;
  currentBirthday?: string;
  currentFashionStyle?: string;
  currentAppearance?: string;
  currentPersonality?: string;
  currentRelationships?: string;
  currentSignature?: string;
  sceneContext?: string;
}

export interface VividNpcProfileEnrichment {
  role?: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  personality?: string;
  appearance?: string;
  relationships?: string;
  signature?: string;
}

export async function enrichVividNpcProfilesWithAi(options: {
  state: ArkState;
  targets: AppearanceEnrichmentTarget[];
  cleanStoryText?: string;
  cleanUserText?: string;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  results: Record<string, VividNpcProfileEnrichment>;
  error?: string;
}> {
  const { state, targets, cleanStoryText, cleanUserText, onLog } = options;
  if (!targets.length) return { ok: true, results: {} };

  if (!(state.config?.proxyUrl || '').trim()) {
    return {
      ok: false,
      results: {},
      error: 'Chưa cấu hình Proxy API để làm sinh động hồ sơ nhân vật bằng AI.',
    };
  }

  const activeComp = getActiveCompanionFromState(state);
  const limitedTargets = targets.slice(0, 10);

  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const cleanExcerpt = cleanStoryText
    ? trimToCleanSentence(stripStoryPlanningAndMeta(cleanStoryText), 2000)
    : '';
  const cleanUser = cleanUserText
    ? stripStoryPlanningAndMeta(cleanUserText)
    : '';
  const mcPresent = isMcPresentInTurn(
    cleanExcerpt,
    cleanUser,
    rawMcName,
    activeComp?.mc?.pronoun,
  );

  const storyClock = normalizeStoryClock(state.memory?.storyClock);
  const formattedClock = formatStoryClock(storyClock);

  const rosterContextLines = limitedTargets.map((t, idx) => {
    const bits = [
      `${idx + 1}. ${t.name} (${t.isMc ? 'Nhân vật chính' : t.role || 'NPC'})`,
    ];
    if (t.currentAge?.trim()) {
      bits.push(`Tuổi hiện có: ${t.currentAge.trim().slice(0, 40)}`);
    }
    if (t.currentBirthday?.trim()) {
      bits.push(`Ngày sinh hiện có: ${t.currentBirthday.trim().slice(0, 40)}`);
    }
    if (t.currentFashionStyle?.trim()) {
      bits.push(`Style ăn mặc hiện có: ${t.currentFashionStyle.trim().slice(0, 150)}`);
    }
    if (t.currentPersonality?.trim()) {
      bits.push(`Tính cách hiện có: ${t.currentPersonality.trim().slice(0, 140)}`);
    }
    if (t.currentAppearance?.trim()) {
      bits.push(`Ngoại hình hiện có: ${t.currentAppearance.trim().slice(0, 160)}`);
    }
    if (t.currentRelationships?.trim()) {
      bits.push(`Quan hệ hiện có: ${t.currentRelationships.trim().slice(0, 140)}`);
    }
    if (t.currentSignature?.trim()) {
      bits.push(`Điểm nhấn hiện có: ${t.currentSignature.trim().slice(0, 120)}`);
    }
    if (t.sceneContext?.trim()) {
      bits.push(`Đoạn xuất hiện: ${t.sceneContext.trim().slice(0, 220)}`);
    }
    return bits.join(' — ');
  });

  const worldHint = activeComp?.worldSetting
    ? trimToCleanSentence(activeComp.worldSetting, 240)
    : state.world?.name || '';

  const prompt = [
    'Bạn là biên tập viên hồ sơ nhân vật cho truyện nhập vai tiếng Việt và trợ lý thiết kế chân dung Seedream 5 Pro.',
    'Hãy làm sinh động hồ sơ cho từng nhân vật dưới đây bằng TIẾNG VIỆT tự nhiên, giàu cá tính, gọn gàng và cụ thể (không viết khuôn mẫu sáo rỗng).',
    '',
    'Với MỖI nhân vật, trả về đầy đủ 8 trường súc tích:',
    '- "role": Vai trò / Nghề nghiệp & vị thế cụ thể (ngắn gọn).',
    `- "age": Tuổi tác khớp với mốc thời gian truyện hiện tại (${formattedClock.dateStr}, năm ${storyClock.year}) và hồ sơ nguyên tác/đời thực (VD: "28 tuổi" hoặc "khoảng 25 tuổi").`,
    '- "birthday": Ngày sinh chuẩn theo nhân vật/người nổi tiếng (VD: "04/06/1998") hoặc ngày tháng năm sinh/mốc sinh hợp lý với bối cảnh truyện.',
    '- "fashionStyle": Style ăn mặc đặc trưng & trang phục phù hợp thực tế (bám sát nghề nghiệp, vòng xã giao, bối cảnh truyện và gu thẩm mỹ thật; mô tả rõ kiểu áo quần, chất liệu, phụ kiện để Seedream vẽ chuẩn).',
    '- "personality": Tính cách & khí chất đặc trưng (cách nói chuyện, thói quen/phản ứng khi gặp tình huống bất ngờ hoặc căng thẳng, 1–2 câu rõ nét).',
    '- "appearance": Ngoại hình (vóc dáng, chiều cao, kiểu tóc, màu da/mắt, nét mặt/thần thái đúng độ tuổi; giàu chi tiết thị giác cho Seedream, 1–2 câu).',
    '- "relationships": Mối quan hệ & thái độ thực tế với các nhân vật liên quan (thân thiết, dè chừng, nể trọng, trêu chọc, đồng minh...).',
    '- "signature": Điểm nhấn riêng / Câu cửa miệng / Thói quen hoặc chi tiết đáng nhớ từ diễn biến truyện.',
    '',
    'NGUYÊN TẮC BẮT BUỘC:',
    '1. Ưu tiên bám sát diễn biến thực tế trong truyện (hành động, lời thoại, trang phục, chi tiết vừa xảy ra) kết hợp hồ sơ Đồng nhân hiện có.',
    '2. Nếu là người nổi tiếng hoặc nhân vật nguyên tác quen thuộc (VD: Central Cee, MGK, Zac Bia, Kendall Jenner, Kim Kardashian, Kris Jenner, Jennie Kim, Leonardo DiCaprio, Finneas O\'Connell, Charli XCX...), hãy dùng đúng ngày sinh thật, tính chính xác tuổi theo năm hiện tại của truyện, và lồng ghép chính xác ngoại hình, gu ăn mặc thật cùng khí chất đời thực.',
    '3. TUYỆT ĐỐI CHỐNG LỐI MÒN "ĐIỀM TĨNH / CÓ ĐỊA VỊ = MẶC VEST / COM LÊ": Không bao giờ tự mặc định nhân vật trầm ổn, điềm tĩnh hay giàu có là mặc vest/com lê công sở! Style ăn mặc PHẢI phản ánh đúng nghề nghiệp/vai trò (rapper, ca sĩ, nghệ sĩ, doanh nhân trẻ, người mẫu, vận động viên, người đời thường...), vòng xã giao (thời trang, âm nhạc, nightlife, đường phố, giới tinh hoa hiện đại...) và trang phục họ thực sự mặc trong truyện. Ví dụ: rapper/nghệ sĩ điềm tĩnh có thể mặc streetwear London, tracksuit, puffer/bomber/hoodie/tanktop, đồ thiết kế cao cấp, dây chuyền bạc, đồng hồ, phụ kiện cá tính phù hợp cảnh.',
    mcPresent
      ? `4. Nhân vật chính (${rawMcName || 'NV chính'}) có xuất hiện trong đoạn truyện này — chỉ đề cập tương tác với NV chính nếu thực sự có diễn ra.`
      : `4. TUYỆT ĐỐI KHÔNG ÉP NHÂN VẬT CHÍNH VÀO HỒ SƠ: Nhân vật chính${rawMcName ? ` (${rawMcName})` : ''} KHÔNG CÓ MẶT / KHÔNG ĐƯỢC NHẮC TỚI trong bối cảnh truyện hiện tại. Không bịa ra mối quan hệ hay tương tác giữa các NPC này với Nhân vật chính! Ở mục "relationships", hãy mô tả thái độ/quan hệ của họ với các NPC khác hoặc vòng kết nối riêng của họ trong bối cảnh truyện.`,
    '5. Không viết câu trống rỗng như "Chưa có mô tả".',
    '',
    `Mốc thời gian hiện tại trong truyện: ${formattedClock.fullLabel} (Năm ${storyClock.year}).`,
    worldHint ? `Bối cảnh thế giới: ${worldHint}` : '',
    cleanExcerpt ? `Diễn biến truyện thực tế gần đây:\n"""\n${cleanExcerpt}\n"""` : '',
    `Danh sách nhân vật cần làm sinh động hồ sơ:\n${rosterContextLines.join('\n')}`,
    '',
    'Trả về DUY NHẤT JSON hợp lệ theo mẫu (không kèm giải thích hay markdown):',
    '{"items":[{"name":"Tên nhân vật","role":"Vai trò / Nghề nghiệp & vị thế","age":"Tuổi tác đúng mốc truyện","birthday":"DD/MM/YYYY hoặc mốc sinh","fashionStyle":"Gu thời trang & trang phục thực tế đúng nghề nghiệp/bối cảnh","personality":"Tính cách & khí chất đặc trưng","appearance":"Ngoại hình đúng tuổi giàu chi tiết thị giác","relationships":"Mối quan hệ & thái độ thực tế","signature":"Điểm nhấn / Thói quen / Chi tiết đáng nhớ"}]}',
  ]
    .filter(Boolean)
    .join('\n');

  onLog?.(
    `[Hồ sơ NPC] Đang làm sinh động hồ sơ bằng AI cho ${limitedTargets.length} nhân vật...`,
  );

  try {
    const raw = await callAiJsonOrText(state, prompt, {
      maxTokens: 3200,
      onLog,
    });
    if (!raw || !raw.trim()) {
      return {
        ok: false,
        results: {},
        error: 'AI không trả về dữ liệu hồ sơ nhân vật.',
      };
    }

    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    const jsonSlice =
      firstBrace >= 0 && lastBrace > firstBrace
        ? stripped.slice(firstBrace, lastBrace + 1)
        : stripped;

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
    } catch {
      const repaired = repairTruncatedJson(jsonSlice);
      if (repaired) {
        parsed = JSON.parse(repaired) as Record<string, unknown>;
      }
    }

    const rawItems = Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed?.appearances)
        ? parsed.appearances
        : Array.isArray(parsed)
          ? (parsed as unknown[])
          : [];

    const cleanField = (val: unknown, maxLen: number): string => {
      const s = String(val || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!s || /^chưa\s+có/i.test(s) || /^không\s+rõ/i.test(s)) return '';
      return trimToCleanSentence(s, maxLen);
    };

    const results: Record<string, VividNpcProfileEnrichment> = {};
    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const name = String(rec.name || '').trim();
      if (!name) continue;
      const role = cleanField(rec.role, 80);
      const birthday = cleanField(rec.birthday, 40);
      const rawAge = cleanField(rec.age, 40);
      const age = rawAge || computeAgeFromBirthday(birthday, storyClock);
      const fashionStyle = cleanField(rec.fashionStyle, 240);
      const personality = cleanField(rec.personality, 260);
      const appearance = cleanField(rec.appearance, 300);
      const relationships = cleanField(rec.relationships, 240);
      const signature = cleanField(rec.signature, 220);
      if (
        !appearance &&
        !personality &&
        !relationships &&
        !signature &&
        !age &&
        !birthday &&
        !fashionStyle
      ) {
        continue;
      }
      const key = normalizeCharacterKey(name);
      if (key) {
        results[key] = {
          ...(role ? { role } : {}),
          ...(age ? { age } : {}),
          ...(birthday ? { birthday } : {}),
          ...(fashionStyle ? { fashionStyle } : {}),
          ...(personality ? { personality } : {}),
          ...(appearance ? { appearance } : {}),
          ...(relationships ? { relationships } : {}),
          ...(signature ? { signature } : {}),
        };
      }
    }

    onLog?.(
      `[Hồ sơ NPC] Đã làm sinh động thành công ${Object.keys(results).length}/${limitedTargets.length} hồ sơ nhân vật.`,
    );
    return { ok: true, results };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog?.(`[Hồ sơ NPC] Lỗi tổng hợp AI: ${msg}`);
    return { ok: false, results: {}, error: msg };
  }
}

export async function enrichCharacterAppearancesWithAi(options: {
  state: ArkState;
  targets: AppearanceEnrichmentTarget[];
  cleanStoryText?: string;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  results: Record<string, { appearance: string; role?: string }>;
  error?: string;
}> {
  const res = await enrichVividNpcProfilesWithAi(options);
  const mapped: Record<string, { appearance: string; role?: string }> = {};
  for (const [k, v] of Object.entries(res.results)) {
    if (v.appearance) {
      mapped[k] = {
        appearance: v.appearance,
        ...(v.role ? { role: v.role } : {}),
      };
    }
  }
  return { ok: res.ok, results: mapped, error: res.error };
}

// Wikipedia & Fanfic Deep Lookup helpers
function normalizeSearchText(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreWikiHit(
  hit: { title?: string; snippet?: string },
  query: string,
): number {
  const rawTitle = String(hit?.title || '').toLowerCase().trim();
  const rawSnippet = String(hit?.snippet || '')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();
  const title = normalizeSearchText(rawTitle);
  const snippet = normalizeSearchText(rawSnippet);
  const cleanQ = normalizeSearchText(query);

  const qTokens = cleanQ
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (!cleanQ || !title || !qTokens.length) return -200;

  const genericTokens = new Set([
    'tien',
    'tu',
    'truyen',
    'tieu',
    'thuyet',
    'novel',
    'web',
    'book',
    'phim',
    'dong',
    'nhan',
    'the',
    'gioi',
    'dai',
    'chi',
    'ky',
    'luc',
  ]);

  const queryWantsPerson =
    /\b(dien vien|ca si|nhac si|rapper|hoa hau|nguoi mau|nhan vat lich su|nha van|tac gia|actor|singer|model|author)\b/i.test(
      cleanQ,
    );
  const queryWantsWork =
    /\b(tieu thuyet|truyen|tien hiep|huyen huyen|kiem hiep|anime|manga|manhua|phim|game|tro choi|novel|xianxia|wuxia)\b/i.test(
      cleanQ,
    );

  const nonGenericTokens = qTokens.filter((t) => !genericTokens.has(t));
  const keyTokens = nonGenericTokens.length ? nonGenericTokens : qTokens;

  let matchedKeyCount = 0;
  let score = 0;

  if (title === cleanQ) {
    score += 80;
  } else if (title.includes(cleanQ) && cleanQ.length >= 4) {
    score += 45;
  }

  for (const tok of qTokens) {
    if (title.includes(tok)) {
      score += genericTokens.has(tok) ? 4 : 18;
    } else if (snippet.includes(tok)) {
      score += genericTokens.has(tok) ? 1 : 4;
    }
  }

  for (const kTok of keyTokens) {
    if (title.includes(kTok) || snippet.includes(kTok)) {
      matchedKeyCount += 1;
    }
  }

  const requiredKeyMatches =
    keyTokens.length >= 2 ? Math.ceil(keyTokens.length * 0.6) : 1;
  if (matchedKeyCount < requiredKeyMatches) {
    return -150;
  }

  const titleHasKey = keyTokens.some((kTok) => title.includes(kTok));
  if (!titleHasKey && keyTokens.length >= 2) {
    score -= 50;
  }

  const personOrOffTopicRegex =
    /\b(ca si|nhac si|rapper|dien vien|hoa hau|nguoi mau|beauty queen|singer|actor|actress|model|album|bai hat|single|rap|kpop|vpop|bong da|cau thu|chinh tri|hoang de|nha su|thien su|phat hoang|tinh|huyen|xa|quoc gia|dan toc)\b/i;

  if (!queryWantsPerson && personOrOffTopicRegex.test(`${title} ${snippet}`)) {
    const hasExplicitWorkWordInTitle =
      /\b(tieu thuyet|truyen|tien hiep|huyen huyen|kiem hiep|phim|game|tro choi|novel|series|film)\b/i.test(
        title,
      );
    if (!hasExplicitWorkWordInTitle) {
      score -= 90;
    }
  }

  if (
    /\b(tieu thuyet|truyen|tien hiep|huyen huyen|kiem hiep|novel|web novel|xianxia|wuxia|anime|manga|manhua)\b/i.test(
      `${title} ${snippet}`,
    )
  ) {
    score += queryWantsWork ? 25 : 15;
  }

  return score;
}

export async function fetchWebSourcesForWork(query: string): Promise<string> {
  const cleanQuery = String(query || '').trim();
  const collected: string[] = [];
  const searchVariants = [cleanQuery];
  if (!/tiểu thuyết|truyện|tiên hiệp|huyền huyễn|kiếm hiệp/i.test(cleanQuery)) {
    searchVariants.push(`${cleanQuery} tiểu thuyết`);
  }

  const wikiDomains = ['vi.wikipedia.org', 'en.wikipedia.org'];
  for (const host of wikiDomains) {
    for (const qStr of searchVariants) {
      try {
        const sUrl = `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          qStr,
        )}&utf8=1&format=json&origin=*`;
        const sRes = await fetch(sUrl);
        if (!sRes.ok) continue;
        const sJson = await sRes.json();
        const rawHits = Array.isArray(sJson?.query?.search)
          ? sJson.query.search
          : [];
        const ranked = rawHits
          .map((h: { title?: string; snippet?: string }) => ({
            h,
            score: scoreWikiHit(h, cleanQuery),
          }))
          .filter((item: { score: number }) => item.score >= 22)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
          .slice(0, 2);

        for (const item of ranked) {
          const h = item.h;
          if (!h?.title) continue;
          const marker = `[Nguồn Wikipedia (${host}) - ${h.title}]`;
          if (collected.some((c) => c.startsWith(marker))) continue;
          const sumUrl = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(
            h.title,
          )}`;
          const pRes = await fetch(sumUrl);
          if (pRes.ok) {
            const pJson = await pRes.json();
            if (pJson?.extract) {
              collected.push(`${marker}\n${pJson.extract}`);
            }
          }
        }
        if (collected.length >= 2) break;
      } catch {
        // Continue to next source
      }
    }
  }

  return collected.join('\n\n').trim();
}

export async function runTimedLookupWithProgress(
  state: ArkState,
  query: string,
  onProgress?: (elapsedSec: number, tick: number) => void,
): Promise<string> {
  const deadlineMs = 240000;
  const startTs = Date.now();
  let tick = 0;

  const progressTimer = setInterval(() => {
    tick += 1;
    const elapsedSec = Math.round((Date.now() - startTs) / 1000);
    onProgress?.(elapsedSec, tick);
  }, 2500);

  try {
    const wikiPromise = fetchWebSourcesForWork(query);
    const aiPromise = (state.config?.proxyUrl || '').trim()
      ? callAiJsonOrText(
          state,
          `Bạn là chuyên gia tra cứu & phân tích tác phẩm gốc cho tiểu thuyết đồng nhân. Hãy tra cứu kỹ và trình bày chi tiết bằng tiếng Việt về tác phẩm / chủ đề: "${query}".\n` +
            'Chỉ tập trung đúng vào tác phẩm/chủ đề được hỏi (tuyệt đối không lôi người nổi tiếng, ca sĩ, diễn viên hay nhân vật lịch sử không liên quan).\n' +
            'Hãy nêu rõ:\n1. Tổng quan tác phẩm gốc & tác giả/bối cảnh\n2. Hệ thống thiết lập, quy tắc & sức mạnh/luật lệ\n3. Các nhân vật chủ chốt & mối quan hệ\n4. Ý tưởng/hướng khai thác đồng nhân bám sát nguyên tác.',
        )
      : Promise.resolve(null);

    const raceWithTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);

    const [wikiText, aiText] = await Promise.all([
      raceWithTimeout(wikiPromise, Math.min(20000, deadlineMs)),
      raceWithTimeout(aiPromise, deadlineMs),
    ]);

    const parts: string[] = [];
    if (wikiText) parts.push(wikiText);
    if (aiText) parts.push(`[Nguồn phân tích AI chuyên sâu]\n${aiText}`);
    return parts.join('\n\n').trim();
  } finally {
    clearInterval(progressTimer);
  }
}

export interface AiGeneratedWorldSetup {
  worldName: string;
  genre: WorldGenreId;
  setting: string;
  rules: string;
  atmosphere: string;
  dramaLevel: DramaLevel;
  startClock: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    eraLabel: string;
  };
  mc: {
    name: string;
    pronoun: string;
    role: string;
    description: string;
    absentAtStart: boolean;
  };
  npcs: WorldSetupNpcDraft[];
  openingScenario: string;
}

const VALID_WORLD_GENRES = new Set<WorldGenreId>([
  'slice_of_life',
  'showbiz',
  'ancient',
  'xianxia',
  'xuanhuan',
  'apocalypse',
  'urban',
  'fantasy',
  'scifi',
]);

const VALID_DRAMA_LEVELS = new Set<DramaLevel>(['chill', 'balanced', 'intense']);

export async function generateWorldSetupWithAi(options: {
  state: ArkState;
  idea: string;
  preferredGenre?: WorldGenreId;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{ ok: boolean; data?: AiGeneratedWorldSetup; error?: string }> {
  const { state, idea, preferredGenre, signal, onLog } = options;
  const cleanIdea = (idea || '').trim();
  if (!cleanIdea) {
    return { ok: false, error: 'Hãy nhập một ý tưởng ngắn trước khi bấm AI dựng thế giới.' };
  }
  if (!(state.config?.proxyUrl || '').trim()) {
    return {
      ok: false,
      error: 'Chưa cấu hình Proxy URL. Vào mục Cấu hình để thiết lập Proxy hoặc bấm "Điền mẫu nhanh".',
    };
  }

  const genreHintMap: Record<WorldGenreId, string> = {
    slice_of_life: 'Đời thường (slice_of_life)',
    showbiz: 'Giải trí & Showbiz (showbiz)',
    ancient: 'Cổ đại (ancient)',
    xianxia: 'Tiên Hiệp — tu tiên, cảnh giới, linh khí, tông môn, linh thú, đan dược/pháp bảo (xianxia)',
    xuanhuan: 'Huyền Huyễn — huyền khí/hồn lực/huyết mạch, gia tộc, bí cảnh, dị thú/thần thú, đa tầng (xuanhuan)',
    apocalypse: 'Mạt Thế — sinh tồn hậu tận thế, căn cứ/khu trú ẩn, khan hiếm tài nguyên, biến dị, phe phái (apocalypse)',
    urban: 'Hiện đại / Đô thị (urban)',
    fantasy: 'Kỳ ảo / Giả tưởng (fantasy)',
    scifi: 'Khoa học viễn tưởng (scifi)',
  };

  const systemPrompt =
    'Bạn là kiến trúc sư thế giới (Worldbuilder) cho ứng dụng truyện nhập vai tiếng Việt. ' +
    'Nhiệm vụ của bạn là nhận một ý tưởng ngắn và dựng nên một hồ sơ thế giới sinh động, giàu không khí, nhân vật có cá tính rõ nét và tình huống mở màn cuốn hút. ' +
    'Chỉ trả về ĐÚNG MỘT đối tượng JSON hợp lệ bằng tiếng Việt, không viết lời giải thích hay markdown thừa bên ngoài JSON.';

  const promptText =
    `Ý tưởng người dùng: "${cleanIdea}"\n` +
    (preferredGenre
      ? `Thể loại gợi ý đang chọn: ${genreHintMap[preferredGenre]} (nếu ý tưởng rõ ràng thuộc thể loại khác, hãy chọn mã genre sát với ý tưởng hơn).\n`
      : '') +
    '\nHãy trả về JSON đúng cấu trúc sau:\n' +
    '{\n' +
    '  "worldName": "Tên thế giới / phiên chơi gợi cảm hứng, ngắn gọn",\n' +
    '  "genre": "slice_of_life | showbiz | ancient | xianxia | xuanhuan | apocalypse | urban | fantasy | scifi",\n' +
    '  "setting": "Mô tả bối cảnh chính giàu hình ảnh, không gian và bối cảnh xã hội (3-5 câu)",\n' +
    '  "rules": "Luật lệ, chuẩn mực vận hành thế giới (ngành nghề, lễ giáo, cảnh giới tu tiên, huyền khí/huyết mạch, quy luật sinh tồn mạt thế, ma pháp, công nghệ - 2-4 câu)",\n' +
    '  "atmosphere": "Không khí, ánh sáng và tông màu chủ đạo (1-2 câu ngắn)",\n' +
    '  "dramaLevel": "chill | balanced | intense",\n' +
    '  "startClock": {\n' +
    '    "year": 2025,\n' +
    '    "month": 6,\n' +
    '    "day": 15,\n' +
    '    "hour": 20,\n' +
    '    "minute": 30,\n' +
    '    "eraLabel": "Để rỗng nếu là hiện đại/đời thường/showbiz; nếu là cổ đại/tiên hiệp/huyền huyễn/mạt thế/kỳ ảo/viễn tưởng thì điền niên đại, kỷ nguyên hoặc ngày thứ mấy sau tận thế (VD: Thái Huyền Lịch năm 3420 · Giờ Mão | Kỷ nguyên Thương Khung năm 2790 | Ngày thứ 142 sau Đại Biến)"\n' +
    '  },\n' +
    '  "mc": {\n' +
    '    "name": "Tên nhân vật chính phù hợp bối cảnh",\n' +
    '    "pronoun": "tôi | anh | cô | ta | mình",\n' +
    '    "role": "Vai trò / vị trí ban đầu của nhân vật chính",\n' +
    '    "description": "Mô tả ngắn gọn tính cách & ngoại hình (1-2 câu)",\n' +
    '    "absentAtStart": false\n' +
    '  },\n' +
    '  "npcs": [\n' +
    '    {\n' +
    '      "name": "Tên nhân vật riêng thật tự nhiên, sát bối cảnh",\n' +
    '      "role": "Vai trò / nghề nghiệp",\n' +
    '      "personality": "Tính cách, cách nói chuyện & khí chất ngắn gọn",\n' +
    '      "appearance": "Ngoại hình & phong cách ăn mặc đặc trưng",\n' +
    '      "initialLocation": "Vị trí ban đầu trong cảnh mở màn",\n' +
    '      "initialMood": "Tâm trạng ban đầu (1-3 từ)"\n' +
    '    }\n' +
    '  ],\n' +
    '  "openingScenario": "Tình huống mở màn giàu không khí (2-4 câu) sẵn sàng để bắt đầu lượt truyện đầu tiên"\n' +
    '}\n\n' +
    'Yêu cầu quan trọng:\n' +
    '- Tạo 3 NPC khởi đầu có cá tính tương phản, sinh động, sát đúng ý tưởng (nếu ý tưởng là showbiz/người thật thì có thể dùng nhân vật phù hợp bối cảnh).\n' +
    '- Nếu ý tưởng yêu cầu không có nhân vật chính hoặc chỉ quan sát dàn NPC, đặt "absentAtStart": true.\n' +
    '- Mốc startClock phải có year/month/day/hour/minute hợp lệ (year 1..9999, month 1..12, day 1..28, hour 0..23, minute 0..59) và hợp thể loại.';

  try {
    const raw = await callAiJsonOrText(state, promptText, {
      systemPrompt,
      signal,
      onLog,
      maxTokens: 3200,
    });
    if (signal?.aborted) {
      return { ok: false, error: 'Đã hủy yêu cầu AI dựng thế giới.' };
    }
    if (!raw || !raw.trim()) {
      return {
        ok: false,
        error: 'Proxy API không trả về nội dung. Kiểm tra lại kết nối hoặc model.',
      };
    }

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const firstBrace = cleaned.indexOf('{');
    const jsonSlice = firstBrace >= 0 ? cleaned.slice(firstBrace) : cleaned;

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
    } catch {
      try {
        const repaired = repairTruncatedJson(jsonSlice);
        parsed = JSON.parse(repaired) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        ok: false,
        error: 'AI trả về định dạng chưa chuẩn JSON. Hãy thử bấm "AI dựng thế giới" lại.',
      };
    }

    const rawGenre = String(parsed.genre || preferredGenre || 'slice_of_life').trim() as WorldGenreId;
    const genre: WorldGenreId = VALID_WORLD_GENRES.has(rawGenre)
      ? rawGenre
      : preferredGenre || 'slice_of_life';

    const rawDrama = String(parsed.dramaLevel || 'balanced').trim() as DramaLevel;
    const dramaLevel: DramaLevel = VALID_DRAMA_LEVELS.has(rawDrama)
      ? rawDrama
      : 'balanced';

    const clk =
      parsed.startClock && typeof parsed.startClock === 'object'
        ? (parsed.startClock as Record<string, unknown>)
        : {};
    const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.trunc(n)));
    };
    const defaultYearByGenre: Record<WorldGenreId, number> = {
      slice_of_life: 2025,
      showbiz: 2025,
      ancient: 724,
      xianxia: 3420,
      xuanhuan: 2790,
      apocalypse: 2031,
      urban: 2025,
      fantasy: 1482,
      scifi: 2184,
    };
    const defaultYear = defaultYearByGenre[genre] ?? 2025;
    const year = clampInt(clk.year, 1, 9999, defaultYear);
    const month = clampInt(clk.month, 1, 12, 6);
    const day = clampInt(clk.day, 1, 28, 15);
    const hour = clampInt(clk.hour, 0, 23, 20);
    const minute = clampInt(clk.minute, 0, 59, 0);
    const eraLabel = typeof clk.eraLabel === 'string' ? clk.eraLabel.trim() : '';

    const mcRaw =
      parsed.mc && typeof parsed.mc === 'object'
        ? (parsed.mc as Record<string, unknown>)
        : {};

    const nowTs = Date.now();
    const rawNpcs = Array.isArray(parsed.npcs) ? parsed.npcs : [];
    const npcs: WorldSetupNpcDraft[] = rawNpcs
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx) => {
        const cleanName = sanitizeCharacterName(String(item.name || '')) || String(item.name || '').trim();
        return {
          id: `setup_npc_${nowTs}_${idx}`,
          name: cleanName,
          role: String(item.role || 'NPC').trim(),
          personality: String(item.personality || '').trim(),
          appearance: String(item.appearance || '').trim(),
          initialLocation: String(item.initialLocation || '').trim(),
          initialMood: String(item.initialMood || '').trim(),
        };
      })
      .filter((n) => n.name.length >= 2)
      .slice(0, 6);

    return {
      ok: true,
      data: {
        worldName: String(parsed.worldName || cleanIdea.slice(0, 48)).trim(),
        genre,
        setting: String(parsed.setting || '').trim(),
        rules: String(parsed.rules || '').trim(),
        atmosphere: String(parsed.atmosphere || '').trim(),
        dramaLevel,
        startClock: { year, month, day, hour, minute, eraLabel },
        mc: {
          name: String(mcRaw.name || '').trim(),
          pronoun: String(mcRaw.pronoun || '').trim(),
          role: String(mcRaw.role || '').trim(),
          description: String(mcRaw.description || '').trim(),
          absentAtStart: Boolean(mcRaw.absentAtStart),
        },
        npcs,
        openingScenario: String(parsed.openingScenario || '').trim(),
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Đã hủy yêu cầu AI dựng thế giới.' };
    }
    return {
      ok: false,
      error: `Lỗi khi gọi AI dựng thế giới: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

const GENERIC_CHARACTER_PLACEHOLDERS = new Set([
  'nhan vat',
  'nhan vat chinh',
  'nv chinh',
  'nvc',
  'mc',
  'npc',
  'nguoi choi',
  'player',
  'character',
  'protagonist',
  'doi phuong',
  'nguoi doi dien',
  'ai do',
  'vo danh',
  'chua ro',
  'user',
  'assistant',
  'system',
  'narrator',
  'nguoi ke chuyen',
  'ban',
  'khach moi',
  'moi nguoi',
  'dong nhan',
]);

const VALID_PERSONAL_PRONOUNS = new Set([
  'toi',
  'anh',
  'co',
  'em',
  'minh',
  'ta',
  'cau',
  'to',
  'chang',
  'nang',
  'han',
  'y',
  'co ay',
  'anh ay',
]);

export function isGenericCharacterPlaceholder(raw?: string): boolean {
  const key = normalizeCharacterKey(raw || '');
  if (!key || key.length < 2) return true;
  if (GENERIC_CHARACTER_PLACEHOLDERS.has(key)) return true;
  if (/^(?:nhan vat|nguoi choi|doi phuong|npc|mc)\b/.test(key)) return true;
  return false;
}

function resolveValidPersonalPronoun(raw?: string): string | null {
  const clean = (raw || '').trim();
  const key = normalizeCharacterKey(clean);
  if (!key || isGenericCharacterPlaceholder(clean)) return null;
  if (VALID_PERSONAL_PRONOUNS.has(key)) return clean;
  return null;
}

export interface ActiveSceneCharactersResult {
  presentNames: string[];
  actorName: string | null;
  targetName: string | null;
  secondaryTargetName: string | null;
  validPronoun: string | null;
  mcPresent: boolean;
}

function escapeNameRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findNameOccurrenceInText(
  text: string,
  term: string,
): { lastIndex: number; count: number; matchedDisplay: string } {
  const clean = term.trim();
  if (!clean || clean.length < 2 || !text) {
    return { lastIndex: -1, count: 0, matchedDisplay: clean };
  }
  const isSingleWord = !/\s/.test(clean);
  const re = new RegExp(
    `(?<!\\p{L})${escapeNameRegex(clean)}(?!\\p{L})`,
    'giu',
  );
  let m: RegExpExecArray | null;
  let lastIndex = -1;
  let count = 0;
  let matchedDisplay = clean;
  while ((m = re.exec(text)) !== null) {
    if (isSingleWord && !/^[\p{Lu}]/u.test(m[0])) continue;
    count += 1;
    lastIndex = m.index;
    matchedDisplay = m[0].trim();
  }
  return { lastIndex, count, matchedDisplay };
}

const VIET_PROPER_SURNAME_SET = new Set([
  'nguyen',
  'tran',
  'le',
  'pham',
  'hoang',
  'huynh',
  'phan',
  'vu',
  'vo',
  'dang',
  'bui',
  'do',
  'ho',
  'ngo',
  'duong',
  'ly',
  'truong',
  'dinh',
  'lam',
  'dao',
  'doan',
  'vuong',
  'trinh',
  'cao',
  'thai',
  'luong',
  'ta',
  'mai',
  'chu',
  'la',
  'kieu',
  'phung',
  'bach',
  'han',
  'luc',
  'ton',
  'to',
  'mac',
]);

const NON_PERSON_PROPER_PHRASES = new Set([
  'beverly hills',
  'los angeles',
  'new york',
  'south korea',
  'viet nam',
  'ha noi',
  'sai gon',
  'saint laurent',
  'louis vuitton',
  'chrome hearts',
  'bottega veneta',
  'ralph lauren',
  'calvin klein',
  'tom ford',
  'van cleef',
  'rolls royce',
  'aston martin',
  'range rover',
  'mercedes benz',
  'chateau marmont',
  'soho house',
  'met gala',
  'fashion week',
  'paris fashion',
  'red carpet',
  'black pink',
  'the weeknd',
  'sunset boulevard',
  'rodeo drive',
  'hollywood hills',
  'santa monica',
  'malibu beach',
  'west hollywood',
  'central park',
  'times square',
  'gangnam gu',
  'cheongdam dong',
  'hannam dong',
]);

function extractInlineProperNamesFromProse(text: string): Array<{
  displayName: string;
  lastIndex: number;
  count: number;
  isVietPersonPattern: boolean;
}> {
  if (!text || text.length < 8) return [];
  const hits = new Map<
    string,
    {
      displayName: string;
      lastIndex: number;
      count: number;
      isVietPersonPattern: boolean;
    }
  >();
  // Match 2-3 capitalized words (Vietnamese / Western proper names)
  const multiWordRe =
    /(?<!\p{L})([\p{Lu}][\p{Ll}'’]{1,14}(?:\s+[\p{Lu}][\p{Ll}'’]{1,14}){1,2})(?!\p{L})/gu;
  const nonNameStartWords = new Set([
    'khong',
    'nhung',
    'trong',
    'giua',
    'duoi',
    'tren',
    'sau',
    'truoc',
    'khi',
    'luc',
    'ngay',
    'thang',
    'nam',
    'thu',
    'buoi',
    'dem',
    'sang',
    'trua',
    'chieu',
    'toi',
    'trang',
    'luot',
    'phong',
    'khach',
    'nha',
    'quan',
    'duong',
    'pho',
    'thanh',
    'bieu',
    'los',
    'new',
    'beverly',
    'hollywood',
    'london',
    'seoul',
    'paris',
    'tokyo',
    'saint',
    'louis',
    'chanel',
    'dior',
    'bottega',
    'gucci',
    'prada',
    'balenciaga',
    'hermes',
    'cartier',
    'tiffany',
    'vogue',
    'the',
    'mot',
    'hai',
    'ba',
    'roi',
    'van',
    'nhu',
    'hay',
    'neu',
    'mac',
    'chac',
    'co',
    'anh',
    'em',
    'nguoi',
    'tieng',
    'giong',
    'chateau',
    'hotel',
    'studio',
    'club',
    'bar',
    'villa',
    'penthouse',
    'sunset',
    'rodeo',
    'santa',
    'west',
    'east',
    'north',
    'south',
    'central',
    'grand',
    'royal',
    'golden',
    'silver',
    'white',
    'black',
    'red',
    'blue',
  ]);

  const textHasVietnamese = VIET_DIACRITIC_RE.test(text);
  const lines = text.split(/\r?\n/);
  let lineOffset = 0;

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    const curOffset = lineOffset;
    lineOffset += rawLine.length + 1;

    if (!trimmedLine || trimmedLine.length < 4) continue;
    // Skip markdown headings, standalone bold headings, bullet outlines, and English Title Case heading lines
    if (
      trimmedLine.startsWith('#') ||
      trimmedLine.startsWith('>') ||
      /^(?:\*\*|__)[^*\n]+(?:\*\*|__)\s*:?$/.test(trimmedLine) ||
      META_HEADER_LINE_RE.test(trimmedLine) ||
      COT_BOLD_OR_SECTION_HEADING_RE.test(trimmedLine) ||
      isEnglishTitleCaseHeadingLine(trimmedLine)
    ) {
      continue;
    }
    // In Vietnamese stories, ignore pure-English non-dialogue lines when discovering unknown inline names
    // (known Western celebrities & roster characters are already matched by Steps 1 & 2)
    if (
      textHasVietnamese &&
      !VIET_DIACRITIC_RE.test(trimmedLine) &&
      !/["“”«»]/.test(trimmedLine)
    ) {
      continue;
    }

    multiWordRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = multiWordRe.exec(rawLine)) !== null) {
      const rawCandidate = m[1].trim();
      const key = normalizeCharacterKey(rawCandidate);
      if (!key || isGenericCharacterPlaceholder(rawCandidate)) continue;
      if (NON_PERSON_PROPER_PHRASES.has(key)) continue;
      if (isEnglishHeadingOrMetaPhrase(rawCandidate)) continue;
      const keyParts = key.split(' ').filter(Boolean);
      const firstWord = keyParts[0] || '';
      if (nonNameStartWords.has(firstWord)) continue;
      const sanitized = sanitizeCharacterName(rawCandidate);
      if (
        !sanitized ||
        isGenericCharacterPlaceholder(sanitized) ||
        isEnglishHeadingOrMetaPhrase(sanitized)
      ) {
        continue;
      }
      const normSanitized = normalizeCharacterKey(sanitized);
      if (NON_PERSON_PROPER_PHRASES.has(normSanitized)) continue;
      const isVietPersonPattern =
        keyParts.length >= 2 &&
        keyParts.length <= 3 &&
        VIET_PROPER_SURNAME_SET.has(firstWord);
      const absIdx = curOffset + m.index;
      const prev = hits.get(normSanitized);
      if (prev) {
        prev.count += 1;
        prev.lastIndex = Math.max(prev.lastIndex, absIdx);
        prev.isVietPersonPattern =
          prev.isVietPersonPattern || isVietPersonPattern;
      } else {
        hits.set(normSanitized, {
          displayName: sanitized,
          lastIndex: absIdx,
          count: 1,
          isVietPersonPattern,
        });
      }
    }
  }

  return Array.from(hits.values()).filter((h) => h.count >= 1);
}

const LOCATION_STOP_WORDS = new Set([
  'tai',
  'trong',
  'ngoai',
  'ben',
  'gan',
  'canh',
  'khu',
  'noi',
  'cho',
  'cua',
  'phong',
  'nha',
  'tang',
  'goc',
  'the',
  'and',
  'with',
  'near',
]);

function extractLocationTokens(rawLoc?: string): string[] {
  const norm = normalizeCharacterKey(rawLoc || '');
  if (!norm) return [];
  return norm
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !LOCATION_STOP_WORDS.has(w));
}

function hasConflictingSceneLocation(
  candidateLoc: string | undefined,
  anchorLocations: string[],
): boolean {
  if (!candidateLoc || !anchorLocations.length) return false;
  const candTokens = extractLocationTokens(candidateLoc);
  if (!candTokens.length) return false;
  const candSet = new Set(candTokens);

  let comparedCount = 0;
  for (const anchor of anchorLocations) {
    const anchorTokens = extractLocationTokens(anchor);
    if (!anchorTokens.length) continue;
    comparedCount += 1;
    if (anchorTokens.some((t) => candSet.has(t))) {
      return false;
    }
  }
  return comparedCount > 0;
}

export function resolveActiveSceneCharacters(options: {
  currentUserText?: string;
  currentAiText?: string;
  recentTurns?: Turn[];
  mcName?: string;
  mcPronoun?: string;
  mcAbsentAtStart?: boolean;
  npcs?: CompanionNpc[];
  portraits?: CharacterPortrait[];
  characterStates?: CharacterStateSnapshot[];
}): ActiveSceneCharactersResult {
  const {
    currentUserText = '',
    currentAiText = '',
    recentTurns = [],
    mcName = '',
    mcPronoun = '',
    mcAbsentAtStart = false,
    npcs = [],
    portraits = [],
    characterStates = [],
  } = options;

  const cleanUser = stripStoryPlanningAndMeta(currentUserText);
  const cleanAi = stripStoryPlanningAndMeta(currentAiText);
  const currentCombined = `${cleanUser}\n${cleanAi}`.trim();
  const tailAi = cleanAi.slice(-1400);
  const recentSlice = recentTurns.slice(-2);
  const immediatePrevTurn = recentSlice.length
    ? recentSlice[recentSlice.length - 1]
    : null;
  const immediatePrevText = immediatePrevTurn
    ? [
        stripStoryPlanningAndMeta(immediatePrevTurn.user || ''),
        stripStoryPlanningAndMeta(immediatePrevTurn.assistant || ''),
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const recentText = recentSlice
    .map((t) =>
      [
        stripStoryPlanningAndMeta(t.user || ''),
        stripStoryPlanningAndMeta(t.assistant || ''),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n\n');

  const hasStoryContent = currentCombined.length > 0 || recentText.length > 0;

  const realMcName = !isGenericCharacterPlaceholder(mcName)
    ? mcName.trim()
    : null;
  const mcKey = realMcName ? normalizeCharacterKey(realMcName) : '';
  const validPronoun = resolveValidPersonalPronoun(mcPronoun);

  const resolveCanonicalGroupKey = (rawName: string): string => {
    const celeb = lookupKnownCelebrityProfile(rawName);
    if (celeb) return normalizeCharacterKey(celeb.canonicalName);
    return normalizeCharacterKey(rawName);
  };

  // Map known character locations from current save's characterStates for cross-location filtering
  const locationByGroupKey = new Map<string, string>();
  for (const s of characterStates || []) {
    if (!s.name?.trim() || !s.location?.trim()) continue;
    const gKey = resolveCanonicalGroupKey(s.name.trim());
    if (gKey && !locationByGroupKey.has(gKey)) {
      locationByGroupKey.set(gKey, s.location.trim());
    }
  }

  interface CharEntry {
    canonicalKey: string;
    displayName: string;
    score: number;
    lastAiPos: number;
    inUser: boolean;
    firstUserPos: number;
    inCurrent: boolean;
    inImmediatePrev: boolean;
    inRecent: boolean;
    isMc: boolean;
    location?: string;
  }

  const entries = new Map<string, CharEntry>();

  const upsertEntry = (
    rawDisplay: string,
    opts: {
      scoreDelta?: number;
      lastAiPos?: number;
      inUser?: boolean;
      firstUserPos?: number;
      inCurrent?: boolean;
      inImmediatePrev?: boolean;
      inRecent?: boolean;
      isMc?: boolean;
      preferDisplay?: boolean;
    },
  ) => {
    const clean = rawDisplay.trim();
    if (
      !clean ||
      isGenericCharacterPlaceholder(clean) ||
      isEnglishHeadingOrMetaPhrase(clean)
    ) {
      return;
    }
    const groupKey = resolveCanonicalGroupKey(clean);
    if (!groupKey) return;

    // Merge short/full name variants (e.g. first name <-> full name)
    let targetKey = groupKey;
    if (!entries.has(targetKey)) {
      for (const existingKey of entries.keys()) {
        if (
          existingKey.startsWith(`${groupKey} `) ||
          groupKey.startsWith(`${existingKey} `)
        ) {
          targetKey = existingKey;
          break;
        }
      }
    }

    const existing = entries.get(targetKey);
    const loc = locationByGroupKey.get(targetKey) || locationByGroupKey.get(groupKey);
    if (existing) {
      existing.score = Math.max(existing.score, opts.scoreDelta ?? 0);
      if (typeof opts.lastAiPos === 'number' && opts.lastAiPos > existing.lastAiPos) {
        existing.lastAiPos = opts.lastAiPos;
      }
      if (opts.inUser) existing.inUser = true;
      if (
        typeof opts.firstUserPos === 'number' &&
        opts.firstUserPos >= 0 &&
        (existing.firstUserPos < 0 || opts.firstUserPos < existing.firstUserPos)
      ) {
        existing.firstUserPos = opts.firstUserPos;
      }
      if (opts.inCurrent) existing.inCurrent = true;
      if (opts.inImmediatePrev) existing.inImmediatePrev = true;
      if (opts.inRecent) existing.inRecent = true;
      if (opts.isMc) existing.isMc = true;
      if (!existing.location && loc) existing.location = loc;
      if (opts.preferDisplay && clean.length >= 2) {
        existing.displayName = clean;
      }
    } else {
      entries.set(targetKey, {
        canonicalKey: targetKey,
        displayName: clean,
        score: opts.scoreDelta ?? 0,
        lastAiPos: opts.lastAiPos ?? -1,
        inUser: Boolean(opts.inUser),
        firstUserPos:
          typeof opts.firstUserPos === 'number' ? opts.firstUserPos : -1,
        inCurrent: Boolean(opts.inCurrent),
        inImmediatePrev: Boolean(opts.inImmediatePrev),
        inRecent: Boolean(opts.inRecent),
        isMc: Boolean(opts.isMc),
        location: loc,
      });
    }
  };

  // 1. Scan current save's roster names strictly against current & recent prose using diacritic-exact matching
  const rosterPool: Array<{ name: string; isMc: boolean; baseScore: number }> = [];
  const isCleanRosterName = (raw?: string) => {
    const t = (raw || '').trim();
    return Boolean(
      t &&
        !isGenericCharacterPlaceholder(t) &&
        !isEnglishHeadingOrMetaPhrase(t),
    );
  };
  if (realMcName && isCleanRosterName(realMcName) && !(mcAbsentAtStart && !hasStoryContent)) {
    rosterPool.push({ name: realMcName, isMc: true, baseScore: 35 });
  }
  for (const s of characterStates || []) {
    if (isCleanRosterName(s.name)) {
      rosterPool.push({ name: s.name.trim(), isMc: Boolean(s.isMc), baseScore: 45 });
    }
  }
  for (const n of npcs || []) {
    if (isCleanRosterName(n.name)) {
      rosterPool.push({ name: n.name.trim(), isMc: false, baseScore: 30 });
    }
  }
  for (const p of portraits || []) {
    if (isCleanRosterName(p.name)) {
      rosterPool.push({ name: p.name.trim(), isMc: Boolean(p.isMc), baseScore: 28 });
    }
  }

  for (const item of rosterPool) {
    const isMcItem =
      item.isMc || (Boolean(mcKey) && normalizeCharacterKey(item.name) === mcKey);

    if (
      currentCombined &&
      isCharacterExplicitlyAbsent(currentCombined, item.name, isMcItem)
    ) {
      // Explicitly stated as absent / at another location in current scene -> exclude
      continue;
    }

    const tailHit = findExactProperNameInText(tailAi, item.name, {
      allowHonorificShortName: true,
    });
    const aiHit = findExactProperNameInText(cleanAi, item.name, {
      allowHonorificShortName: true,
    });
    const userHit = findExactProperNameInText(cleanUser, item.name, {
      allowHonorificShortName: true,
    });

    const totalCurrentCount = aiHit.count + userHit.count;
    const prevHit =
      totalCurrentCount === 0 && immediatePrevText
        ? findExactProperNameInText(immediatePrevText, item.name, {
            allowHonorificShortName: true,
          })
        : { count: 0, firstIndex: -1, lastIndex: -1, matchedDisplay: item.name };
    const recentHit =
      totalCurrentCount === 0 && prevHit.count === 0 && recentText
        ? findExactProperNameInText(recentText, item.name, {
            allowHonorificShortName: true,
          })
        : { count: 0, firstIndex: -1, lastIndex: -1, matchedDisplay: item.name };

    const inCurrent = totalCurrentCount > 0;
    const inImmediatePrev = prevHit.count > 0;
    const inRecent = inImmediatePrev || recentHit.count > 0;

    // CRITICAL ISOLATION: When the story already has content, NEVER add roster entries
    // that did not actually appear in the current turn or recent 1-2 turns.
    // This completely prevents characters from other saves or other locations/storylines from leaking.
    if (hasStoryContent && !inCurrent && !inRecent) {
      continue;
    }

    const matchedDisplay =
      aiHit.count > 0
        ? aiHit.matchedDisplay
        : userHit.count > 0
          ? userHit.matchedDisplay
          : prevHit.count > 0
            ? prevHit.matchedDisplay
            : recentHit.count > 0
              ? recentHit.matchedDisplay
              : item.name;

    const score =
      tailHit.count > 0
        ? 400 + tailHit.lastIndex / 20 + Math.min(totalCurrentCount * 10, 60)
        : totalCurrentCount > 0
          ? 260 + aiHit.lastIndex / 30 + Math.min(totalCurrentCount * 10, 50)
          : inImmediatePrev
            ? 165 + Math.min(prevHit.count * 8, 30)
            : inRecent
              ? 135 + Math.min(recentHit.count * 8, 25)
              : item.baseScore;

    upsertEntry(matchedDisplay, {
      scoreDelta: score,
      lastAiPos: aiHit.lastIndex,
      inUser: userHit.count > 0,
      firstUserPos: userHit.firstIndex,
      inCurrent,
      inImmediatePrev,
      inRecent,
      isMc: isMcItem,
      preferDisplay: inCurrent,
    });
  }

  // 2. Detect known celebrities directly in current & recent prose
  for (const hit of findKnownCelebritiesInText(currentCombined)) {
    if (isCharacterExplicitlyAbsent(currentCombined, hit.displayName)) continue;
    const tailHit = findNameOccurrenceInText(tailAi, hit.displayName);
    const userHit = findNameOccurrenceInText(cleanUser, hit.displayName);
    const aiHit = findNameOccurrenceInText(cleanAi, hit.displayName);
    const firstUserPos = userHit.count
      ? cleanUser.toLowerCase().indexOf(hit.displayName.toLowerCase())
      : -1;
    upsertEntry(hit.displayName, {
      scoreDelta:
        tailHit.count > 0
          ? 410 + tailHit.lastIndex / 20 + Math.min(hit.count * 10, 60)
          : 280 + hit.lastIndex / 30 + Math.min(hit.count * 10, 50),
      lastAiPos: aiHit.lastIndex,
      inUser: userHit.count > 0,
      firstUserPos,
      inCurrent: true,
      preferDisplay: true,
    });
  }
  if (immediatePrevText) {
    for (const hit of findKnownCelebritiesInText(immediatePrevText)) {
      if (
        currentCombined &&
        isCharacterExplicitlyAbsent(currentCombined, hit.displayName)
      ) {
        continue;
      }
      upsertEntry(hit.displayName, {
        scoreDelta: 170 + Math.min(hit.count * 8, 30),
        inImmediatePrev: true,
        inRecent: true,
      });
    }
  }
  if (recentText) {
    for (const hit of findKnownCelebritiesInText(recentText)) {
      if (
        currentCombined &&
        isCharacterExplicitlyAbsent(currentCombined, hit.displayName)
      ) {
        continue;
      }
      upsertEntry(hit.displayName, {
        scoreDelta: 140 + Math.min(hit.count * 8, 25),
        inRecent: true,
      });
    }
  }

  // 3. Detect explicit speaker prefixes in current turn
  const knownKeys = new Set<string>(Array.from(entries.keys()));
  for (const line of currentCombined.split(/\r?\n/)) {
    const sp = extractSpeakerPrefixFromLine(line, knownKeys);
    if (!sp || isGenericCharacterPlaceholder(sp.displayName)) continue;
    if (isCharacterExplicitlyAbsent(currentCombined, sp.displayName)) continue;
    const aiPos = cleanAi.lastIndexOf(sp.displayName);
    const userPos = cleanUser.indexOf(sp.displayName);
    upsertEntry(sp.displayName, {
      scoreDelta: 380 + (aiPos >= 0 ? aiPos / 25 : 0),
      lastAiPos: aiPos,
      inUser: userPos >= 0,
      firstUserPos: userPos,
      inCurrent: true,
      preferDisplay: true,
    });
  }

  // 4. Detect multi-word proper names directly in current turn prose
  for (const hit of extractInlineProperNamesFromProse(currentCombined)) {
    if (isCharacterExplicitlyAbsent(currentCombined, hit.displayName)) continue;
    const aiHit = findNameOccurrenceInText(cleanAi, hit.displayName);
    const userHit = findNameOccurrenceInText(cleanUser, hit.displayName);
    const tailHit = findNameOccurrenceInText(tailAi, hit.displayName);
    const firstUserPos = userHit.count
      ? cleanUser.toLowerCase().indexOf(hit.displayName.toLowerCase())
      : -1;
    if (
      hit.count >= 2 ||
      userHit.count > 0 ||
      (hit.isVietPersonPattern && (tailHit.count > 0 || aiHit.count >= 1)) ||
      entries.has(resolveCanonicalGroupKey(hit.displayName))
    ) {
      upsertEntry(hit.displayName, {
        scoreDelta:
          tailHit.count > 0
            ? 390 + tailHit.lastIndex / 20 + Math.min(hit.count * 10, 50)
            : 250 + hit.lastIndex / 30 + Math.min(hit.count * 8, 40),
        lastAiPos: aiHit.lastIndex,
        inUser: userHit.count > 0,
        firstUserPos,
        inCurrent: true,
      });
    }
  }

  // Also capture multi-word Vietnamese proper names from the immediately preceding turn
  // (only if current page has no or 1 detected character)
  if (immediatePrevText) {
    for (const hit of extractInlineProperNamesFromProse(immediatePrevText)) {
      if (
        currentCombined &&
        isCharacterExplicitlyAbsent(currentCombined, hit.displayName)
      ) {
        continue;
      }
      if (hit.count >= 2 || hit.isVietPersonPattern) {
        upsertEntry(hit.displayName, {
          scoreDelta: 155 + Math.min(hit.count * 8, 25),
          inImmediatePrev: true,
          inRecent: true,
        });
      }
    }
  }

  const ranked = Array.from(entries.values()).sort(
    (a, b) =>
      Number(b.inCurrent) - Number(a.inCurrent) ||
      Number(b.inImmediatePrev) - Number(a.inImmediatePrev) ||
      Number(b.inRecent) - Number(a.inRecent) ||
      b.score - a.score ||
      b.lastAiPos - a.lastAiPos,
  );

  const presentInCurrent = ranked.filter((r) => r.inCurrent);
  const presentInRecent = ranked.filter((r) => !r.inCurrent && r.inRecent);

  // Build strict activeList grounded ONLY in the current scene (or recent turn if transitional)
  let activeList: CharEntry[] = [];
  if (presentInCurrent.length > 0) {
    const anchorLocations = presentInCurrent
      .map((r) => r.location || '')
      .filter(Boolean);
    activeList = [...presentInCurrent];
    // Only if a single character is named on the current page, optionally include
    // a companion from the immediately preceding turn if they share the same location
    if (activeList.length === 1) {
      const prevCompanion = presentInRecent.find(
        (r) =>
          r.inImmediatePrev &&
          !hasConflictingSceneLocation(r.location, anchorLocations),
      );
      if (prevCompanion) {
        activeList.push(prevCompanion);
      }
    }
  } else if (presentInRecent.length > 0) {
    activeList = [...presentInRecent];
  } else if (!hasStoryContent) {
    // Blank 0-turn session before Turn 1: use current save's starting roster
    activeList = [...ranked];
  } else {
    // Story content exists, yet no concrete character name was detected in current/recent turns:
    // strictly keep activeList empty so suggestions use natural pronouns/contextual phrasing
    // instead of injecting unrelated characters from another scene or save.
    activeList = [];
  }

  const presentNames = activeList.map((r) => r.displayName);

  const mcPresent = currentCombined
    ? realMcName
      ? isMcPresentInTurn(cleanAi, cleanUser, realMcName, validPronoun || '')
      : Boolean(validPronoun) &&
        isMcPresentInTurn(cleanAi, cleanUser, '', validPronoun || '')
    : !mcAbsentAtStart;

  const mcGroupKey = realMcName ? resolveCanonicalGroupKey(realMcName) : '';
  const mcEntryInActive = mcGroupKey
    ? activeList.find((r) => r.canonicalKey === mcGroupKey)
    : undefined;

  let actorName: string | null = null;
  let targetName: string | null = null;
  let secondaryTargetName: string | null = null;

  if (realMcName && mcPresent && (mcEntryInActive || !hasStoryContent)) {
    // Only use MC's real name when MC is genuinely present in this scene/turn (or at 0-turn start)
    actorName = mcEntryInActive?.displayName || realMcName;
    const others = activeList.filter((r) => r.canonicalKey !== mcGroupKey);
    targetName = others[0]?.displayName || null;
    secondaryTargetName = others[1]?.displayName || null;
  } else if (mcPresent && validPronoun && !mcEntryInActive && activeList.length >= 1) {
    // Pure first-person POV where MC is present via pronoun without realMcName appearing in prose:
    // keep actorName null so natural pronoun is used instead of a potentially mismatched MC name.
    actorName = null;
    targetName = activeList[0].displayName;
    secondaryTargetName = activeList[1]?.displayName || null;
  } else if (activeList.length >= 2) {
    // Pair the two most prominent active characters in the current scene
    const topTwo = activeList.slice(0, 2);
    const userLed = [...topTwo]
      .filter((c) => c.inUser && c.firstUserPos >= 0)
      .sort((a, b) => a.firstUserPos - b.firstUserPos);
    if (userLed.length === 1) {
      actorName = userLed[0].displayName;
      targetName =
        topTwo.find((c) => c.canonicalKey !== userLed[0].canonicalKey)
          ?.displayName || null;
    } else {
      const byLastAi = [...topTwo].sort((a, b) => b.lastAiPos - a.lastAiPos);
      targetName = byLastAi[0].displayName;
      actorName = byLastAi[1].displayName;
    }
    secondaryTargetName = activeList[2]?.displayName || null;
  } else if (activeList.length === 1) {
    // Only 1 active character detected in the scene: never pull unrelated characters from elsewhere
    targetName = activeList[0].displayName;
    actorName = null;
  } else {
    // No concrete character detected: leave both null so contextual pronouns/phrasing are used
    actorName = null;
    targetName = null;
  }

  return {
    presentNames,
    actorName,
    targetName,
    secondaryTargetName,
    validPronoun,
    mcPresent,
  };
}

export type TurnSuggestionCategory =
  | 'continue'
  | 'tease'
  | 'probe'
  | 'move'
  | 'bold'
  | 'rest';

export interface TurnSuggestionItem {
  id: string;
  category: TurnSuggestionCategory;
  label: string;
  text: string;
  source: 'local' | 'ai';
}

export const TURN_SUGGESTION_CATEGORY_LABELS: Record<
  TurnSuggestionCategory,
  string
> = {
  continue: 'Tiếp nhịp',
  tease: 'Đổi hướng',
  probe: 'Dò hỏi',
  move: 'Chuyển cảnh',
  bold: 'Táo bạo',
  rest: 'Chuyển buổi',
};

const VALID_SUGGESTION_CATEGORIES: TurnSuggestionCategory[] = [
  'continue',
  'tease',
  'probe',
  'move',
  'bold',
  'rest',
];

function extractTailExcerpt(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const start = Math.max(0, clean.length - maxLen);
  const sliced = clean.slice(start);
  const firstSentenceBreak = sliced.search(/[.!?…]\s+/);
  if (firstSentenceBreak >= 0 && firstSentenceBreak < Math.floor(maxLen * 0.35)) {
    return sliced.slice(firstSentenceBreak + 2).trim();
  }
  const firstSpace = sliced.indexOf(' ');
  return (firstSpace >= 0 && firstSpace < 30 ? sliced.slice(firstSpace + 1) : sliced).trim();
}

function normalizeSuggestionCategory(
  raw: unknown,
  fallbackIndex: number,
): TurnSuggestionCategory {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  if (
    VALID_SUGGESTION_CATEGORIES.includes(key as TurnSuggestionCategory)
  ) {
    return key as TurnSuggestionCategory;
  }
  if (/tiep|tiếp|nhịp|nhip|scene|flow/.test(key)) return 'continue';
  if (/treu|trêu|đổi|doi|hài|hai|flirt|banter|joke/.test(key)) return 'tease';
  if (/do|dò|hỏi|hoi|thăm|tham|ask|question|probe/.test(key)) return 'probe';
  if (/chuyen|chuyển|di chuyển|không gian|vị trí|move|place|location/.test(key)) {
    return 'move';
  }
  if (/tao|táo|bạo|bao|bất ngờ|bat ngo|bold|action|surprise/.test(key)) {
    return 'bold';
  }
  if (/nghi|nghỉ|buổi|buoi|thời gian|time|sleep|rest|skip/.test(key)) {
    return 'rest';
  }
  return VALID_SUGGESTION_CATEGORIES[
    fallbackIndex % VALID_SUGGESTION_CATEGORIES.length
  ];
}

function cleanSuggestionSentence(raw: string): string {
  let s = String(raw || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/^\s*(?:[-*•–—]+|\d+[.)\]])\s*/, '')
    .replace(/^["'“”«»`]+|["'“”«»`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 220) {
    s = trimToCleanSentence(s, 200);
  }
  return s;
}

function parseAiSuggestionsFromRaw(
  raw: string,
  existingKeys: Set<string>,
): TurnSuggestionItem[] {
  if (!raw || !raw.trim()) return [];
  let cleaned = String(raw)
    .replace(META_BLOCK_TAG_RE, '\n')
    .trim();

  // Drop any orphan closing </thinking> prefix produced when user prefill starts <thinking>
  let lastCloseEnd = -1;
  let closeMatch: RegExpExecArray | null;
  ORPHAN_CLOSE_THINKING_RE.lastIndex = 0;
  while ((closeMatch = ORPHAN_CLOSE_THINKING_RE.exec(cleaned)) !== null) {
    lastCloseEnd = closeMatch.index + closeMatch[0].length;
  }
  if (lastCloseEnd >= 0) {
    const afterClose = cleaned.slice(lastCloseEnd).trim();
    if (afterClose) cleaned = afterClose;
  }

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const rawItems: Array<{ category?: unknown; text: string }> = [];

  // 1. Try JSON object {"suggestions": [...]}
  const objParsed = parseAiJsonObject(cleaned);
  if (objParsed) {
    const arr =
      (Array.isArray(objParsed.suggestions) && objParsed.suggestions) ||
      (Array.isArray(objParsed.items) && objParsed.items) ||
      (Array.isArray(objParsed.options) && objParsed.options) ||
      (Array.isArray(objParsed.choices) && objParsed.choices) ||
      null;
    if (arr) {
      for (const entry of arr) {
        if (typeof entry === 'string') {
          rawItems.push({ text: entry });
        } else if (entry && typeof entry === 'object') {
          const rec = entry as Record<string, unknown>;
          const txt = String(
            rec.text || rec.content || rec.prompt || rec.action || rec.suggestion || '',
          ).trim();
          if (txt) {
            rawItems.push({
              category: rec.category || rec.type || rec.tag || rec.label,
              text: txt,
            });
          }
        }
      }
    }
  }

  // 2. Try bare JSON array [...]
  if (!rawItems.length) {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket >= 0) {
      const slice =
        lastBracket > firstBracket
          ? cleaned.slice(firstBracket, lastBracket + 1)
          : cleaned.slice(firstBracket);
      let arrParsed: unknown = null;
      try {
        arrParsed = JSON.parse(slice);
      } catch {
        try {
          arrParsed = JSON.parse(repairTruncatedJson(slice));
        } catch {
          arrParsed = null;
        }
      }
      if (Array.isArray(arrParsed)) {
        for (const entry of arrParsed) {
          if (typeof entry === 'string') {
            rawItems.push({ text: entry });
          } else if (entry && typeof entry === 'object') {
            const rec = entry as Record<string, unknown>;
            const txt = String(
              rec.text || rec.content || rec.prompt || rec.action || rec.suggestion || '',
            ).trim();
            if (txt) {
              rawItems.push({
                category: rec.category || rec.type || rec.tag || rec.label,
                text: txt,
              });
            }
          }
        }
      }
    }
  }

  // 3. Fallback line-by-line extraction if model returned a numbered/bulleted list
  if (!rawItems.length) {
    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 16 && !/^[{}\[\]]+$/.test(l));
    for (const line of lines) {
      if (CONTAINS_META_NOISE_RE.test(line)) continue;
      const labelled = /^(?:[-*•]|\d+[.)])\s*(?:\[([^\]]+)\]|([^:]{2,22}):)\s*(.+)$/.exec(
        line,
      );
      if (labelled) {
        rawItems.push({
          category: labelled[1] || labelled[2],
          text: labelled[3],
        });
      } else if (/^(?:[-*•]|\d+[.)])\s+(.+)$/.test(line)) {
        rawItems.push({ text: line });
      }
    }
  }

  const nowTs = Date.now();
  const seen = new Set<string>(existingKeys);
  const results: TurnSuggestionItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const cleanText = cleanSuggestionSentence(rawItems[i].text);
    if (!cleanText || cleanText.length < 12) continue;
    const key = normalizeCharacterKey(cleanText);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const category = normalizeSuggestionCategory(
      rawItems[i].category,
      results.length,
    );
    results.push({
      id: `ai_sug_${nowTs}_${results.length}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      label: TURN_SUGGESTION_CATEGORY_LABELS[category],
      text: cleanText,
      source: 'ai',
    });
    if (results.length >= 6) break;
  }

  return results;
}

export async function generateTurnSuggestionsWithAi(options: {
  state: ArkState;
  turnIndex?: number;
  existingSuggestions?: string[];
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  suggestions?: TurnSuggestionItem[];
  error?: string;
  aborted?: boolean;
}> {
  const { state, existingSuggestions = [], signal, onLog } = options;
  const baseUrl = (state.config?.proxyUrl || '').trim();
  const model = (state.config?.model || '').trim() || 'gemini-2.5-pro';
  const apiKey = (state.config?.proxyKey || '').trim();

  if (!baseUrl) {
    return {
      ok: false,
      error:
        'Chưa cấu hình Proxy URL. Hãy vào mục Cấu hình để thiết lập Proxy trước khi bấm AI gợi ý.',
    };
  }

  const turns = state.turns || [];
  const latestIdx =
    turns.length > 0
      ? typeof options.turnIndex === 'number' &&
        options.turnIndex >= 0 &&
        options.turnIndex < turns.length
        ? options.turnIndex
        : turns.length - 1
      : -1;
  const latestTurn = latestIdx >= 0 ? turns[latestIdx] : null;
  const prevTurn = latestIdx > 0 ? turns[latestIdx - 1] : null;

  const cleanLatestUser = latestTurn
    ? stripStoryPlanningAndMeta(latestTurn.user || '')
    : '';
  const cleanLatestAi = latestTurn
    ? stripStoryPlanningAndMeta(latestTurn.assistant || '')
    : '';
  const cleanPrevAi = prevTurn
    ? stripStoryPlanningAndMeta(prevTurn.assistant || '')
    : '';

  const activeComp = getActiveCompanionFromState(state);
  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const rawMcPronoun = (
    activeComp?.mc?.pronoun ||
    state.player?.pronoun ||
    ''
  ).trim();
  const sceneChars = resolveActiveSceneCharacters({
    currentUserText: cleanLatestUser,
    currentAiText: cleanLatestAi,
    recentTurns: turns.slice(Math.max(0, latestIdx - 2), Math.max(0, latestIdx)),
    mcName: rawMcName,
    mcPronoun: rawMcPronoun,
    mcAbsentAtStart: Boolean(state.player?.absentAtStart),
    npcs: activeComp?.npcs || [],
    portraits: state.portraitBank?.portraits || [],
    characterStates: state.memory?.characterStates || [],
  });
  const mcPresent = sceneChars.mcPresent;
  const mcPronoun = sceneChars.validPronoun || 'tôi';

  const storyClock = normalizeStoryClock(state.memory?.storyClock);
  const clockFmt = formatStoryClock(storyClock);

  const presentKeySet = new Set(
    sceneChars.presentNames.map((n) => {
      const celeb = lookupKnownCelebrityProfile(n);
      return normalizeCharacterKey(celeb ? celeb.canonicalName : n);
    }),
  );
  const matchesPresentScene = (name?: string): boolean => {
    const clean = (name || '').trim();
    if (!clean) return false;
    const celeb = lookupKnownCelebrityProfile(clean);
    const key = normalizeCharacterKey(celeb ? celeb.canonicalName : clean);
    if (!key) return false;
    if (presentKeySet.has(key)) return true;
    for (const pk of presentKeySet) {
      if (pk.startsWith(`${key} `) || key.startsWith(`${pk} `)) return true;
    }
    return false;
  };

  // When an active story scene exists, strictly restrict NPC/state metadata to characters present in the scene
  // so characters from other locations, storylines, or saves can never leak into AI suggestions.
  const hasActiveSceneText = Boolean(cleanLatestUser || cleanLatestAi);
  const filteredNpcs = hasActiveSceneText
    ? (activeComp?.npcs || []).filter((n) => matchesPresentScene(n.name))
    : activeComp?.npcs || [];
  const npcNames = filteredNpcs
    .map((n) => (n.role ? `${n.name} (${n.role})` : n.name))
    .filter(Boolean)
    .slice(0, 8);

  const filteredStates = hasActiveSceneText
    ? (state.memory?.characterStates || []).filter((s) =>
        matchesPresentScene(s.name),
      )
    : (state.memory?.characterStates || []).slice(0, 6);
  const stateLines = filteredStates
    .slice(0, 6)
    .map((s) => {
      const parts = [
        s.location ? `Vị trí: ${s.location}` : '',
        s.mood ? `Tâm trạng: ${s.mood}` : '',
        s.status ? `Trạng thái: ${s.status}` : '',
      ].filter(Boolean);
      return `- ${s.name}${s.isMc ? ' (NV chính)' : ''}${parts.length ? `: ${parts.join(' | ')}` : ''}`;
    })
    .join('\n');

  const recentMemories = (state.memory?.entries || [])
    .slice(0, 6)
    .map((m) => `- ${m.title}: ${m.content.slice(0, 90)}`)
    .join('\n');

  const existingList = existingSuggestions
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const hasPrefill = Boolean(
    state.tawaPreset?.prefillEnabled && state.tawaPreset?.prefill?.trim(),
  );

  const systemPrompt =
    'Bạn là trợ lý gợi ý lượt đi cho ứng dụng truyện nhập vai tiếng Việt Ark Lite. ' +
    'Nhiệm vụ: dựa sát vào diễn biến lượt truyện mới nhất, các nhân vật THỰC SỰ đang có mặt trong cảnh và mốc thời gian truyện hiện hành để đề xuất ĐÚNG 6 gợi ý lượt đi tự nhiên, trực tiếp dùng được làm lượt gọi tiếp theo của người chơi. ' +
    'CHỈ gọi đúng tên thật của các nhân vật thực sự đang xuất hiện trong cảnh hiện tại; TUYỆT ĐỐI KHÔNG tự ý đưa tên nhân vật đang ở địa điểm/mạch truyện khác hoặc không có mặt trong cảnh, và KHÔNG viết chung chung là "Nhân vật" hay "Người chơi". Nếu cảnh không nêu rõ tên riêng, hãy dùng đại từ/cách gọi tự nhiên theo ngữ cảnh. ' +
    'Mỗi gợi ý dài khoảng 10–22 từ tiếng Việt tự nhiên, không đánh số đầu dòng, không giải thích dài dòng. ' +
    'Chỉ trả về DUY NHẤT một đối tượng JSON hợp lệ có dạng {"suggestions":[{"category":"continue|tease|probe|move|bold|rest","text":"..."}]}.' +
    (hasPrefill
      ? ' Nếu có sẵn thẻ <thinking> mở đầu từ prefill, hãy đóng </thinking> thật ngắn gọn rồi xuất ngay JSON hợp lệ phía sau.'
      : '');

  const verifiedMcActor =
    !isGenericCharacterPlaceholder(rawMcName) &&
    (!hasActiveSceneText || matchesPresentScene(rawMcName))
      ? rawMcName
      : sceneChars.actorName || mcPronoun;

  const promptParts = [
    state.world?.name || activeComp?.name
      ? `Thế giới / Phiên truyện: ${state.world?.name || activeComp?.name}${state.world?.genreLabel ? ` (${state.world.genreLabel})` : ''}.`
      : '',
    state.world?.atmosphere ? `Không khí bối cảnh: ${state.world.atmosphere}.` : '',
    storyClock.enabled
      ? `Đồng hồ truyện hiện tại: ${clockFmt.fullLabel}.`
      : '',
    sceneChars.presentNames.length
      ? `Nhân vật đang có mặt trực tiếp trong cảnh: ${sceneChars.presentNames.slice(0, 6).join(', ')} (Chỉ dùng tên các nhân vật này trong gợi ý, tuyệt đối không thêm nhân vật không xuất hiện trong cảnh).`
      : 'Lưu ý: Chưa phát hiện tên riêng cụ thể trong đoạn cảnh này; hãy bám sát đúng văn bản lượt truyện và dùng đại từ/cách gọi tự nhiên theo ngữ cảnh, không bịa thêm tên nhân vật ngoài cảnh.',
    mcPresent
      ? `Chủ thể lượt gọi: ${verifiedMcActor}.`
      : sceneChars.presentNames.length
        ? `Lưu ý: Nhân vật chính không xuất hiện trực tiếp trong cảnh này; hãy viết gợi ý gọi thẳng tên các nhân vật đang có mặt (${sceneChars.presentNames.slice(0, 4).join(', ')}).`
        : 'Lưu ý: Hãy bám đúng góc nhìn và bối cảnh của lượt truyện gần nhất bằng cách gọi tự nhiên.',
    npcNames.length ? `Vai trò nhân vật đang có mặt: ${npcNames.join(', ')}.` : '',
    stateLines ? `Trạng thái các nhân vật đang có mặt:\n${stateLines}` : '',
    !hasActiveSceneText && recentMemories
      ? `Ký ức đáng chú ý:\n${recentMemories}`
      : '',
    cleanPrevAi
      ? `Đoạn cuối lượt trước (tham khảo):\n${extractTailExcerpt(cleanPrevAi, 420)}`
      : '',
    latestTurn
      ? [
          `--- LƯỢT TRUYỆN MỚI NHẤT (Trang ${latestIdx + 1}) ---`,
          cleanLatestUser
            ? `[Lượt gọi gần nhất]: ${trimToCleanSentence(cleanLatestUser, 420)}`
            : '',
          cleanLatestAi
            ? `[Diễn biến mới nhất]: ${extractTailExcerpt(cleanLatestAi, 2100)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : state.world?.openingScenario
        ? `Tình huống mở màn: ${state.world.openingScenario}`
        : 'Phiên truyện mới bắt đầu, chưa có lượt nào.',
    existingList.length
      ? `Các gợi ý đã có (HÃY TẠO 6 Ý MỚI KHÁC BIỆT, KHÔNG LẶP LẠI):\n${existingList.map((s) => `- ${s}`).join('\n')}`
      : '',
    '--- YÊU CẦU ĐẦU RA ---',
    'Trả về ĐÚNG 6 gợi ý phủ đủ 6 hướng khác nhau theo đúng thứ tự category:',
    '1. "continue": Tiếp tục nhịp cảnh/đối thoại hiện tại một cách tự nhiên.',
    '2. "tease": Đổi hướng trò chuyện nhẹ nhàng, trêu chọc hoặc tạo tiếng cười.',
    '3. "probe": Dò hỏi, thăm dò suy nghĩ, cảm xúc thật hoặc bí mật của nhân vật đang có mặt.',
    '4. "move": Đề nghị di chuyển, đổi không gian hoặc vị trí hợp bối cảnh hiện tại.',
    '5. "bold": Hành động bất ngờ, chủ động hoặc táo bạo làm thay đổi nhịp cảnh.',
    '6. "rest": Nghỉ ngơi, lắng lại hoặc chuyển mượt sang mốc giờ/buổi tiếp theo khớp với đồng hồ truyện.',
    'Mỗi trường "text" dài khoảng 10–22 từ, tự nhiên như lời/hành động người chơi gõ vào ô Lượt gọi mới.',
    'Định dạng JSON bắt buộc:\n{"suggestions":[{"category":"continue","text":"..."},{"category":"tease","text":"..."},{"category":"probe","text":"..."},{"category":"move","text":"..."},{"category":"bold","text":"..."},{"category":"rest","text":"..."}]}',
  ]
    .filter(Boolean)
    .join('\n\n');

  const proto = state.config.apiProtocol || 'openai';
  const isGemini =
    proto === 'gemini' ||
    (proto === 'auto' &&
      (/generativelanguage\.googleapis\.com/i.test(baseUrl) ||
        /:(generateContent|streamGenerateContent)/i.test(baseUrl)));

  const endpoints = buildEndpointCandidates(baseUrl, model, false, isGemini);
  const hasGeminiSafety = Boolean(isGemini || /gemini/i.test(model));
  const rawMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: promptParts },
  ];

  const attemptVariants: Array<{
    msgs: ChatMessage[];
    withSafety: boolean;
    label: string;
  }> = [];

  if (hasPrefill || hasGeminiSafety) {
    attemptVariants.push({
      msgs: normalizeMessagesForRequest(state, rawMessages, hasPrefill),
      withSafety: hasGeminiSafety,
      label: 'chuẩn',
    });
  }
  attemptVariants.push({
    msgs: normalizeMessagesForRequest(state, rawMessages, false),
    withSafety: false,
    label: 'tương thích',
  });

  const existingKeys = new Set(
    existingList.map((s) => normalizeCharacterKey(s)).filter(Boolean),
  );

  onLog?.(`[AI Gợi ý] Đang sinh 6 gợi ý lượt đi từ ${model}...`);
  let lastErr = '';

  for (const url of endpoints) {
    for (const variant of attemptVariants) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
          headers['x-goog-api-key'] = apiKey;
        }

        const messages = variant.msgs;
        const sysPrompts = messages
          .filter((m) => m.role === 'system')
          .map((m) => (typeof m.content === 'string' ? m.content : ''))
          .filter(Boolean);
        const nonSys = messages.filter((m) => m.role !== 'system');
        const targetMaxTokens = 1400;

        const body = isGemini
          ? {
              ...(sysPrompts.length
                ? {
                    systemInstruction: {
                      parts: [{ text: sysPrompts.join('\n\n') }],
                    },
                  }
                : {}),
              contents: nonSys.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [
                  {
                    text:
                      typeof m.content === 'string'
                        ? m.content
                        : JSON.stringify(m.content),
                  },
                ],
              })),
              generationConfig: { maxOutputTokens: targetMaxTokens },
              ...(variant.withSafety
                ? {
                    safetySettings:
                      state.config.safetySettings || DEFAULT_SAFETY,
                  }
                : {}),
            }
          : {
              model,
              messages,
              max_tokens: targetMaxTokens,
              stream: false,
              ...(variant.withSafety && /gemini/i.test(model)
                ? {
                    safetySettings:
                      state.config.safetySettings || DEFAULT_SAFETY,
                  }
                : {}),
            };

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          lastErr = `HTTP ${res.status} [${variant.label}] tại ${url}${
            errTxt ? `: ${errTxt.slice(0, 220)}` : ''
          }`;
          onLog?.(`[AI Gợi ý] ${lastErr}`);
          continue;
        }

        const data = await res.json();
        const rawOut =
          data?.choices?.[0]?.message?.content ??
          data?.candidates?.[0]?.content?.parts?.[0]?.text ??
          data?.content ??
          data?.text ??
          '';

        const textOut =
          typeof rawOut === 'string' ? rawOut.trim() : '';
        if (!textOut) {
          lastErr = `Phản hồi rỗng [${variant.label}] từ ${url}`;
          onLog?.(`[AI Gợi ý] ${lastErr}`);
          continue;
        }

        let parsed = parseAiSuggestionsFromRaw(textOut, existingKeys);
        if (parsed.length < 6 && existingKeys.size > 0) {
          const fallbackAll = parseAiSuggestionsFromRaw(textOut, new Set());
          const seenBatch = new Set(
            parsed.map((item) => normalizeCharacterKey(item.text)),
          );
          for (const item of fallbackAll) {
            const key = normalizeCharacterKey(item.text);
            if (!key || seenBatch.has(key)) continue;
            seenBatch.add(key);
            parsed.push(item);
            if (parsed.length >= 6) break;
          }
        }
        if (parsed.length > 0) {
          onLog?.(
            `[AI Gợi ý] Hoàn tất: nhận ${parsed.length} gợi ý từ ${model}.`,
          );
          return { ok: true, suggestions: parsed.slice(0, 6) };
        }

        lastErr = `Không đọc được danh sách gợi ý [${variant.label}] từ phản hồi AI.`;
        onLog?.(`[AI Gợi ý] ${lastErr}`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, aborted: true, error: 'Đã hủy yêu cầu AI gợi ý.' };
        }
        lastErr = `${err instanceof Error ? err.message : String(err)} (${url})`;
        onLog?.(`[AI Gợi ý] Lỗi: ${lastErr}`);
      }
    }
  }

  return {
    ok: false,
    error:
      lastErr ||
      'Không thể gọi Proxy API để tạo gợi ý. Hãy kiểm tra lại Proxy URL, API Key và Model.',
  };
}

