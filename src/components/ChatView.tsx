import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Maximize2,
  MessageSquare,
  PanelBottom,
  RefreshCw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Swords,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  ArkState,
  CompanionNpc,
  MemoryManagerConfig,
  PendingImage,
  PortraitBankConfig,
  StoryImageConfig,
  StoryImageTargetMode,
  Turn,
  ViewName,
} from '../types/ark';
import {
  resolveActiveSceneCharacters,
  stripStoryPlanningAndMeta,
  TURN_SUGGESTION_CATEGORY_LABELS,
  type TurnSuggestionCategory,
  type TurnSuggestionItem,
} from '../utils/api';
import {
  computeAgeFromBirthday,
  formatAgeBirthdayLabel,
  lookupKnownCelebrityProfile,
  normalizeCharacterKey,
} from '../utils/characterUtils';
import {
  parseStoryTurnStream,
  splitNarrativeAndMeta,
} from '../utils/saveParser';
import { extractMatchSnippet, matchesQuery } from '../utils/search';
import {
  addMinutesToClock,
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from '../utils/storyClock';
import {
  applyClockDeltaToCultivation,
  CULTIVATION_SYSTEM_META,
  TECHNIQUE_TIER_META,
} from '../utils/cultivation';
import { CharacterNameBadge } from './CharacterNameBadge';
import {
  CultivationPanel,
  type CultivationSubTab,
  type QuickCultivateResult,
} from './CultivationPanel';
import {
  ImagePickerModal,
  type ImagePickerTarget,
} from './ImagePickerModal';
import { ImagePromptTemplatePanel } from './ImagePromptTemplatePanel';
import { ImageStylePicker } from './ImageStylePicker';
import { MemoryManagerPanel, type MemorySubTab } from './MemoryManagerPanel';
import {
  PortraitBankPanel,
  type BgPortraitStatus,
} from './PortraitBankPanel';
import { ProseRenderer } from './ProseRenderer';

const STORY_IMAGE_SIZES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Mặc định Seedream' },
  { value: '1024x1024', label: 'Vuông 1:1 (1024x1024)' },
  { value: '1280x720', label: 'Ngang 16:9 (1280x720)' },
  { value: '720x1280', label: 'Dọc 9:16 (720x1280)' },
  { value: '896x1152', label: 'Chân dung 3:4 (896x1152)' },
];

function countWords(text: string): number {
  const clean = String(text || '').trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function extractTurnTimestamp(turn: Turn): number | null {
  if (
    typeof turn.createdAt === 'number' &&
    Number.isFinite(turn.createdAt) &&
    turn.createdAt > 1_000_000_000_000
  ) {
    return turn.createdAt;
  }
  const match = /(?:^|_)(\d{13})(?:$|_)/.exec(turn.id || '');
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 1_000_000_000_000) {
      return parsed;
    }
  }
  return null;
}

function formatDurationVi(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 giây';
  const totalSec = ms / 1000;
  if (totalSec < 60) {
    return totalSec < 10
      ? `${totalSec.toFixed(1).replace('.', ',')} giây`
      : `${Math.round(totalSec)} giây`;
  }
  const totalMin = Math.floor(totalSec / 60);
  const remSec = Math.round(totalSec % 60);
  if (totalMin < 60) {
    return remSec > 0 ? `${totalMin}p ${remSec}s` : `${totalMin} phút`;
  }
  const hours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  return remMin > 0 ? `${hours}g ${remMin}p` : `${hours} giờ`;
}

const SUGGESTION_CATEGORY_STYLES: Record<TurnSuggestionCategory, string> = {
  continue: 'bg-sky-500/14 text-sky-200 ring-sky-400/28',
  tease: 'bg-amber-500/14 text-amber-200 ring-amber-400/28',
  probe: 'bg-violet-500/14 text-violet-200 ring-violet-400/28',
  move: 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/28',
  bold: 'bg-rose-500/14 text-rose-200 ring-rose-400/28',
  rest: 'bg-indigo-500/14 text-indigo-200 ring-indigo-400/28',
};

function getClockTransitionPhrase(hour: number, eraLabel?: string): {
  periodShort: string;
  restVariants: string[];
  moveTimeHint: string;
} {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  const isAncient = Boolean(eraLabel && eraLabel.trim());
  if (h >= 4 && h <= 5) {
    return {
      periodShort: 'rạng sáng',
      moveTimeHint: 'đón làn gió rạng sáng',
      restVariants: [
        'Khép lại khoảnh khắc rạng sáng, nghỉ thêm một lát rồi chuyển sang buổi sáng hẳn',
        'Tranh thủ chợp mắt thêm chút nữa cho tới khi trời sáng rõ rồi mới bắt đầu ngày mới',
        'Tạm dừng câu chuyện lúc tảng sáng, hẹn gặp lại khi nắng buổi sáng lên cao hơn',
      ],
    };
  }
  if (h >= 6 && h <= 10) {
    return {
      periodShort: 'buổi sáng',
      moveTimeHint: 'tranh thủ không khí buổi sáng',
      restVariants: [
        'Thu xếp gọn phần việc buổi sáng rồi chuyển sang dùng bữa trưa thong thả cùng nhau',
        'Tạm khép lại nhịp buổi sáng, hẹn nghỉ chân khi nắng đứng bóng sang buổi trưa',
        'Để thời gian trôi nhẹ hết buổi sáng, chuyển cảnh sang khung giờ nghỉ trưa yên ả',
      ],
    };
  }
  if (h >= 11 && h <= 12) {
    return {
      periodShort: 'buổi trưa',
      moveTimeHint: 'tránh nắng giữa trưa',
      restVariants: [
        'Nghỉ trưa thư thả một lát rồi chuyển sang kế hoạch tiếp theo vào đầu buổi chiều',
        'Dùng xong bữa trưa, thả lỏng vài chục phút rồi mở tiếp diễn biến buổi chiều',
        'Tạm khép lại cảnh giữa trưa, hẹn nhau quay lại khi nắng chiều dịu xuống đôi chút',
      ],
    };
  }
  if (h >= 13 && h <= 17) {
    return {
      periodShort: 'buổi chiều',
      moveTimeHint: 'dạo nhẹ trong ánh chiều',
      restVariants: [
        'Tạm nghỉ ngơi hết buổi chiều, chờ hoàng hôn buông xuống rồi chuyển sang buổi tối',
        'Thu gọn câu chuyện buổi chiều, hẹn gặp lại vào lúc lên đèn đầu buổi tối',
        'Thả lỏng nghỉ chân một lúc để thời gian trôi dần sang khung cảnh chập tối ấm áp',
      ],
    };
  }
  if (h === 18) {
    return {
      periodShort: 'chập tối',
      moveTimeHint: 'lúc phố xá vừa lên đèn',
      restVariants: [
        'Khép lại khoảnh khắc chập tối, chỉnh trang nhẹ rồi chuyển sang buổi tối trọn vẹn',
        'Tạm dừng đôi phút lúc hoàng hôn tắt nắng, bắt đầu bữa tối và nhịp chuyện tối nay',
        'Để màn đêm phủ xuống hẳn rồi thong thả bước vào không khí riêng tư của buổi tối',
      ],
    };
  }
  if (h >= 19 && h <= 21) {
    return {
      periodShort: 'buổi tối',
      moveTimeHint: isAncient ? 'dưới ánh đèn đêm yên tĩnh' : 'trong không khí dịu mát buổi tối',
      restVariants: [
        'Thu xếp khép lại buổi tối nhẹ nhàng, nghỉ ngơi sớm hơn khi đêm bắt đầu về khuya',
        'Tạm dừng nhịp trò chuyện tối nay, thư giãn yên tĩnh rồi chuẩn bị sang đêm khuya',
        'Thả lỏng sau buổi tối bận rộn, nghỉ ngơi sớm để giữ sức cho sáng hôm sau',
      ],
    };
  }
  return {
    periodShort: 'đêm khuya',
    moveTimeHint: 'giữa màn đêm tĩnh lặng',
    restVariants: [
      'Đêm đã về khuya, chúc nhau ngủ ngon và nghỉ qua đêm để chuyển sang sáng hôm sau',
      'Khép lại ngày dài lúc đêm muộn, ngả lưng nghỉ ngơi tới khi nắng sớm hôm sau ghé tới',
      'Thấy đồng hồ đã sang khuya, nhẹ nhàng thu dọn đi ngủ và mở tiếp cảnh sáng hôm sau',
    ],
  };
}

function buildLocalTurnSuggestions(params: {
  currentTurn?: Turn;
  recentTurns?: Turn[];
  npcs: CompanionNpc[];
  portraitBank: PortraitBankConfig;
  memoryConfig: MemoryManagerConfig;
  mcName: string;
  mcPronoun: string;
  mcAbsentAtStart?: boolean;
  storyClock: ReturnType<typeof normalizeStoryClock>;
  clockFmt: ReturnType<typeof formatStoryClock>;
  variant: number;
}): {
  items: TurnSuggestionItem[];
  primaryNpc: string | null;
  presentNames: string[];
} {
  const {
    currentTurn,
    recentTurns = [],
    npcs,
    portraitBank,
    memoryConfig,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    storyClock,
    clockFmt,
    variant,
  } = params;

  const rawAi = currentTurn?.assistant || '';
  const cleanAi = rawAi ? stripStoryPlanningAndMeta(rawAi) : '';
  const cleanUser = currentTurn?.user || '';
  const tailText = cleanAi.slice(-1400);

  const sceneChars = resolveActiveSceneCharacters({
    currentUserText: cleanUser,
    currentAiText: rawAi,
    recentTurns,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    npcs,
    portraits: portraitBank?.portraits,
    characterStates: memoryConfig?.characterStates,
  });

  const presentNames = sceneChars.presentNames;
  const actorName = sceneChars.actorName;
  const targetName = sceneChars.targetName;
  const secondaryName = sceneChars.secondaryTargetName;
  const pronounCap = sceneChars.validPronoun
    ? sceneChars.validPronoun.charAt(0).toUpperCase() +
      sceneChars.validPronoun.slice(1)
    : null;

  // Subject performing the action: active on-scene actor name first, else valid personal pronoun if MC is in scene
  const subject = actorName || (sceneChars.mcPresent ? pronounCap : null);
  const primaryNpc = targetName || actorName || presentNames[0] || null;
  const altTarget =
    secondaryName && Math.abs(variant) % 2 === 1 ? secondaryName : targetName;
  const pairLabel =
    actorName && targetName
      ? `${actorName} và ${targetName}`
      : targetName && secondaryName
        ? `${targetName} và ${secondaryName}`
        : primaryNpc || '';

  // Detect lightweight scene cues from current page tail
  const hasQuestion =
    /[?？]["”»]?\s*$/.test(tailText.trim()) ||
    /["“«][^"”»]{3,}[?？]["”»]/.test(tailText.slice(-500));
  const isTense =
    /(?:cau mày|lạnh lùng|im lặng|căng thẳng|nghi ngờ|thở dài|tránh ánh mắt|do dự|giận)/i.test(
      tailText,
    );
  const isWarm =
    /(?:mỉm cười|cười khẽ|dịu dàng|ánh mắt ấm|ngại ngùng|đỏ mặt|ghé sát|nhẹ nhàng|thân mật)/i.test(
      tailText,
    );
  const isIndoorRoom =
    /(?:phòng ngủ|ghế sofa|ban công|căn hộ|biệt thự|giường|phòng khách|khách sạn|bếp)/i.test(
      tailText,
    );
  const isVenueOrDining =
    /(?:nhà hàng|quán|cà phê|rượu|ly |bàn ăn|tiệc|bar|lounge|sảnh|sân khấu|hậu trường|studio)/i.test(
      tailText,
    );
  const isAncientOrFantasy =
    Boolean(storyClock.eraLabel?.trim()) ||
    /(?:tông môn|linh khí|kiếm|điện hạ|công tử|tiểu thư|tửu lâu|ma pháp|căn cứ|sinh tồn)/i.test(
      tailText,
    );

  const primaryState = (targetName || actorName)
    ? (memoryConfig?.characterStates || []).find((s) => {
        const key = normalizeCharacterKey(s.name);
        return (
          (targetName && key === normalizeCharacterKey(targetName)) ||
          (actorName && key === normalizeCharacterKey(actorName))
        );
      })
    : undefined;
  const curLocation = primaryState?.location?.trim() || '';

  const clockInfo = getClockTransitionPhrase(
    storyClock.hour,
    storyClock.eraLabel,
  );
  const pick = <T,>(arr: T[], offset = 0): T =>
    arr[(Math.abs(variant) + offset) % arr.length];

  const lowercaseFirst = (s: string) =>
    s ? `${s.charAt(0).toLowerCase()}${s.slice(1)}` : s;

  if (!currentTurn || (!cleanAi.trim() && !cleanUser.trim())) {
    const openingItems: Array<{
      category: TurnSuggestionCategory;
      text: string;
    }> =
      subject && targetName
        ? [
            {
              category: 'continue',
              text: `${subject} quan sát không gian xung quanh lúc ${clockFmt.timeStr} rồi chủ động mở lời chào ${targetName}.`,
            },
            {
              category: 'tease',
              text: `${subject} mỉm cười trêu nhẹ ${targetName} một câu mở đầu để bầu không khí bớt khách sáo.`,
            },
            {
              category: 'probe',
              text: `${subject} giữ ánh nhìn điềm tĩnh, khéo léo hỏi thăm ${targetName} về kế hoạch trong ${clockInfo.periodShort} hôm nay.`,
            },
            {
              category: 'move',
              text: `${subject} đề nghị cùng ${targetName} chuyển sang một góc yên tĩnh hơn ${clockInfo.moveTimeHint} để dễ trò chuyện.`,
            },
            {
              category: 'bold',
              text: `${subject} bất ngờ đưa ra một đề nghị táo bạo ngay từ đầu khiến ${targetName} thoáng sững người đầy thích thú.`,
            },
            {
              category: 'rest',
              text: `${subject} mỉm cười nhìn ${targetName}, ${lowercaseFirst(pick(clockInfo.restVariants, 0))}.`,
            },
          ]
        : primaryNpc
          ? [
              {
                category: 'continue',
                text: `Mở màn cảnh ${clockInfo.periodShort} lúc ${clockFmt.timeStr} xoay quanh cuộc trò chuyện tự nhiên của ${pairLabel || primaryNpc}.`,
              },
              {
                category: 'tease',
                text: `${primaryNpc} buông một câu đùa tinh nghịch khiến không khí xung quanh trở nên rộn ràng và tự nhiên hơn.`,
              },
              {
                category: 'probe',
                text: `${primaryNpc} bất chợt nhớ ra một điều băn khoăn và cất lời dò hỏi người đang ở bên cạnh.`,
              },
              {
                category: 'move',
                text: `${primaryNpc} chuyển từ vị trí hiện tại sang một góc không gian thoáng đãng hơn vào lúc ${clockFmt.timeStr}.`,
              },
              {
                category: 'bold',
                text: `Tạo ngay một tình huống nhỏ bất ngờ cắt ngang nhịp cảnh khiến ${primaryNpc} phải lập tức ứng biến.`,
              },
              {
                category: 'rest',
                text: `${pick(clockInfo.restVariants, 0)} cùng nhịp lắng nhẹ của ${primaryNpc}.`,
              },
            ]
          : [
              {
                category: 'continue',
                text: `Mở màn cảnh ${clockInfo.periodShort} lúc ${clockFmt.timeStr} với nhịp đối thoại tự nhiên và giàu chi tiết đời thường.`,
              },
              {
                category: 'tease',
                text: `Khởi đầu bằng một câu trêu nhẹ duyên dáng để bầu không khí trong cảnh lập tức trở nên cởi mở.`,
              },
              {
                category: 'probe',
                text: `Đặt một câu hỏi khéo léo về kế hoạch trong ${clockInfo.periodShort} hôm nay để gợi mở câu chuyện.`,
              },
              {
                category: 'move',
                text: `Chuyển khung cảnh sang một góc không gian thoáng đãng và riêng tư hơn vào lúc ${clockFmt.timeStr}.`,
              },
              {
                category: 'bold',
                text: `Đưa vào ngay một đề nghị bất ngờ từ đầu cảnh để tạo điểm nhấn thu hút.`,
              },
              {
                category: 'rest',
                text: `${pick(clockInfo.restVariants, 0)}.`,
              },
            ];

    return {
      primaryNpc,
      presentNames,
      items: openingItems.map((it, idx) => ({
        id: `local_open_${variant}_${idx}`,
        category: it.category,
        label: TURN_SUGGESTION_CATEGORY_LABELS[it.category],
        text: it.text,
        source: 'local',
      })),
    };
  }

  // Build 6 rich contextual suggestions grounded in real scene characters
  let continueOptions: string[];
  let teaseOptions: string[];
  let probeOptions: string[];
  let moveOptions: string[];
  let boldOptions: string[];
  let restOptions: string[];

  if (subject && targetName) {
    // Two or more concrete on-scene participants detected dynamically from the current scene
    const interactTarget = altTarget || targetName;
    continueOptions = hasQuestion
      ? [
          `${subject} nhìn thẳng vào ${targetName}, mỉm cười đáp lại câu hỏi vừa rồi một cách tự nhiên và chân thành.`,
          `${subject} thoáng suy nghĩ vài giây trước lời ${targetName} vừa hỏi, rồi chậm rãi trả lời thật thẳng thắn.`,
          `${subject} khẽ gật đầu đáp lời ${targetName}, nhân tiện nối tiếp mạch chuyện đang còn dang dở giữa cả hai.`,
        ]
      : isTense
        ? [
            `${subject} giữ giọng bình tĩnh, nhẹ nhàng lên tiếng xoa dịu khoảng lặng đang căng thẳng trước mặt ${targetName}.`,
            `${subject} không né tránh ánh nhìn của ${targetName}, chủ động nói rõ suy nghĩ để giữ mạch đối thoại tiếp diễn.`,
            `${subject} hít nhẹ một hơi, đáp lại phản ứng của ${targetName} bằng thái độ điềm đạm nhưng dứt khoát.`,
          ]
        : isWarm
          ? [
              `${subject} mỉm cười hưởng ứng nhịp trò chuyện ấm áp cùng ${interactTarget}, tiện tay tiếp lời một cách tự nhiên.`,
              `${subject} thả lỏng lắng nghe ${targetName}, đáp lại bằng giọng nói nhẹ nhàng để giữ trọn bầu không khí dễ chịu.`,
              `${subject} khẽ nghiêng người về phía ${interactTarget}, hào hứng nối tiếp chủ đề đang nói dở.`,
            ]
          : [
              `${subject} tiếp lời ${targetName} thật tự nhiên, vừa phản hồi diễn biến vừa rồi vừa quan sát sắc mặt đối phương.`,
              `${subject} khẽ gật đầu đồng tình với ${interactTarget}, nói thêm vài câu để đẩy nhịp cảnh hiện tại trôi mượt hơn.`,
              `${subject} chậm rãi đáp lại ${targetName} rồi tiếp tục việc đang làm dở trong không khí ${clockInfo.periodShort}.`,
            ];

    teaseOptions = [
      `${subject} bật cười khẽ, cố tình đổi giọng trêu chọc ${interactTarget} một câu dí dỏm để không khí nhẹ nhõm hơn.`,
      `${subject} nhướn mày nhìn ${targetName}, lái câu chuyện sang một chủ đề vui vẻ bất ngờ kèm lời chọc ghẹo khéo léo.`,
      `${subject} giả vờ nghiêm mặt vài giây rồi phì cười trêu ${interactTarget}, chờ xem phản ứng thú vị ngay sau đó.`,
    ];

    probeOptions = [
      `${subject} hạ giọng nhìn kỹ biểu cảm của ${interactTarget}, khéo léo dò hỏi điều còn ngập ngừng chưa nói ra.`,
      `${subject} giả vờ hỏi bâng quơ về một chi tiết nhỏ vừa lướt qua để thăm dò thái độ thật sự của ${targetName}.`,
      `${subject} nghiêng đầu hỏi thẳng ${interactTarget} xem lúc này trong lòng đang thực sự nghĩ gì.`,
    ];

    moveOptions = isAncientOrFantasy
      ? [
          `${subject} rủ ${targetName} rời khỏi chỗ hiện tại, tản bộ ra hành lang thoáng gió ${clockInfo.moveTimeHint}.`,
          `${subject} đề nghị cùng ${targetName} đổi sang sảnh trà hoặc khoảng sân yên tĩnh hơn để tiện bàn chuyện riêng.`,
          `${subject} đứng dậy ra hiệu cho ${targetName} cùng đi tới khu vực kế bên xem xét tình hình xung quanh.`,
        ]
      : isIndoorRoom
        ? [
            `${subject} đứng dậy rủ ${targetName} bước ra ban công hoặc góc cửa sổ hóng gió ${clockInfo.moveTimeHint}.`,
            `${subject} đề nghị rời khỏi góc đang ngồi, sang phòng khách pha chút đồ uống rồi nói chuyện tiếp cùng ${targetName}.`,
            `${subject} rủ ${targetName} thay đổi không khí, ra ngoài dạo một vòng ngắn lúc ${clockFmt.timeStr} rồi quay về.`,
          ]
        : isVenueOrDining
          ? [
              `${subject} khẽ ra hiệu rủ ${targetName} tách khỏi đám đông, chuyển sang một góc khuất yên tĩnh hơn để nói chuyện riêng.`,
              `${subject} đề nghị rời khỏi nơi ồn ào hiện tại, cùng ${targetName} ra ngoài hít thở không khí ${clockInfo.periodShort}.`,
              `${subject} rủ ${targetName} thanh toán rồi chuyển sang điểm hẹn kế tiếp yên ả hơn trong khung giờ ${clockFmt.timeStr}.`,
            ]
          : [
              `${subject} đề nghị cùng ${targetName} rời khỏi ${curLocation || 'vị trí hiện tại'}, chuyển sang không gian thoáng đãng và riêng tư hơn.`,
              `${subject} bước chậm lại, rủ ${targetName} ghé qua một góc yên tĩnh gần đây ${clockInfo.moveTimeHint} để tiện trò chuyện.`,
              `${subject} gợi ý đổi bối cảnh ngay lúc ${clockFmt.timeStr}, cùng ${targetName} di chuyển sang điểm dừng tiếp theo.`,
            ];

    boldOptions = [
      `${subject} chủ động tiến lại gần ${targetName} hơn một bước, nhìn thẳng vào mắt và nói ra điều táo bạo nhất.`,
      `${subject} bất ngờ cắt ngang nhịp cũ bằng một cử chỉ dứt khoát khiến ${targetName} không kịp chuẩn bị tâm lý.`,
      `${subject} đưa ra một lời thách thức hoặc đề nghị bất ngờ ngay tại chỗ để xem ${targetName} sẽ phản ứng thế nào.`,
    ];

    restOptions = clockInfo.restVariants.map(
      (line) =>
        `${subject} mỉm cười nhìn ${targetName}, ${lowercaseFirst(line)}.`,
    );
  } else if (primaryNpc) {
    // Only 1 concrete on-scene character detected — write naturally around that character without inventing another name
    continueOptions = hasQuestion
      ? [
          `${primaryNpc} khẽ nghiêng đầu, mỉm cười đáp lại câu hỏi vừa rồi một cách tự nhiên và chân thành.`,
          `${primaryNpc} thoáng suy nghĩ vài giây rồi chậm rãi trả lời thẳng thắn, giữ trọn mạch chuyện đang dang dở.`,
          `Tiếp tục giữ nhịp cảnh hiện tại, để ${primaryNpc} đối đáp tự nhiên theo cảm xúc vừa gợi mở.`,
        ]
      : [
          `${primaryNpc} tiếp tục giữ nhịp trò chuyện tự nhiên, vừa phản hồi diễn biến vừa rồi vừa để lộ chút cảm xúc thật.`,
          `Khai thác sâu hơn phản ứng và cử chỉ tinh tế của ${primaryNpc} ngay sau diễn biến vừa xảy ra trong cảnh.`,
          `Để cuộc trò chuyện quanh ${primaryNpc} trôi tiếp mượt mà trong không khí ${clockInfo.periodShort}.`,
        ];

    teaseOptions = [
      `${primaryNpc} bật cười khẽ, bất ngờ buông một câu trêu chọc duyên dáng làm bầu không khí trong cảnh nhẹ nhõm hơn.`,
      `Đổi nhịp đối thoại sang hướng hài hước, để ${primaryNpc} tung hứng một câu đùa tinh nghịch đầy tự nhiên.`,
      `Một chi tiết nhỏ ngẫu nhiên khiến ${primaryNpc} thoáng phì cười, làm dịu đi mạch chuyện trước đó.`,
    ];

    probeOptions = [
      `${primaryNpc} hạ giọng dừng lại một nhịp, đặt một câu hỏi thăm dò đầy ẩn ý hướng về người đối diện.`,
      `Xoáy sâu vào ánh mắt và nội tâm của ${primaryNpc}, hé lộ một điều băn khoăn nhỏ chưa kịp nói ra.`,
      `${primaryNpc} nghiêng đầu hỏi bâng quơ về một chi tiết vừa lướt qua để thăm dò phản ứng thật sự.`,
    ];

    moveOptions = [
      `${primaryNpc} đứng dậy rời khỏi ${curLocation || 'vị trí hiện tại'}, chuyển sang một góc riêng tư hơn ${clockInfo.moveTimeHint}.`,
      `Để ${primaryNpc} bước sang khu vực kế bên lúc ${clockFmt.timeStr}, mở ra một khung cảnh thoáng đãng hơn.`,
      `${primaryNpc} đề nghị thay đổi không khí ngay lúc ${clockFmt.timeStr} để câu chuyện có thêm điểm nhấn mới.`,
    ];

    boldOptions = [
      `${primaryNpc} bất ngờ làm một cử chỉ dứt khoát trái với vẻ điềm tĩnh thường ngày, làm xoay chuyển bầu không khí.`,
      `Tạo một tình huống bất ngờ xuất hiện đúng lúc ${clockFmt.timeStr} khiến ${primaryNpc} phải đưa ra quyết định táo bạo.`,
      `Một tin nhắn hoặc lời đề nghị bất ngờ chen ngang ngay cao trào, đẩy ${primaryNpc} vào lựa chọn khó đoán.`,
    ];

    restOptions = clockInfo.restVariants.map(
      (line) => `${primaryNpc} mỉm cười nhẹ, ${lowercaseFirst(line)}.`,
    );
  } else {
    // No concrete character name found yet — stay contextual, never use generic "Nhân vật"
    const subjPrefix = subject ? `${subject} ` : '';
    continueOptions = [
      `${subjPrefix ? `${subjPrefix}tiếp lời` : 'Tiếp lời'} thật tự nhiên theo diễn biến vừa rồi, giữ mạch đối thoại trôi mượt và giàu cảm xúc.`,
      `${subjPrefix ? `${subjPrefix}khẽ gật đầu` : 'Khẽ gật đầu'} hưởng ứng không khí ${clockInfo.periodShort}, nói thêm vài câu để đẩy nhịp cảnh tiến tới.`,
      `${subjPrefix ? `${subjPrefix}quan sát kỹ` : 'Quan sát kỹ'} sắc mặt người đối diện rồi chậm rãi đáp lại thật chân thành.`,
    ];

    teaseOptions = [
      `${subjPrefix ? `${subjPrefix}bật cười khẽ` : 'Bật cười khẽ'}, đổi giọng trêu chọc một câu dí dỏm để không khí trong cảnh nhẹ nhõm hơn.`,
      `${subjPrefix ? `${subjPrefix}lái câu chuyện` : 'Lái câu chuyện'} sang một chủ đề vui vẻ bất ngờ kèm lời chọc ghẹo khéo léo.`,
      `${subjPrefix ? `${subjPrefix}giả vờ nghiêm mặt` : 'Giả vờ nghiêm mặt'} vài giây rồi phì cười trêu ghẹo để xem phản ứng ngay sau đó.`,
    ];

    probeOptions = [
      `${subjPrefix ? `${subjPrefix}hạ giọng` : 'Hạ giọng'} khéo léo dò hỏi điều người đối diện vẫn còn ngập ngừng chưa nói ra.`,
      `${subjPrefix ? `${subjPrefix}hỏi bâng quơ` : 'Hỏi bâng quơ'} về một chi tiết nhỏ vừa lướt qua để thăm dò thái độ thật sự.`,
      `${subjPrefix ? `${subjPrefix}nghiêng đầu hỏi thẳng` : 'Nghiêng đầu hỏi thẳng'} xem lúc này trong lòng đối phương đang thực sự nghĩ gì.`,
    ];

    moveOptions = [
      `${subjPrefix ? `${subjPrefix}đề nghị rời khỏi` : 'Đề nghị rời khỏi'} ${curLocation || 'vị trí hiện tại'}, chuyển sang không gian thoáng đãng hơn ${clockInfo.moveTimeHint}.`,
      `${subjPrefix ? `${subjPrefix}bước chậm lại` : 'Bước chậm lại'}, rủ chuyển sang một góc yên tĩnh gần đây lúc ${clockFmt.timeStr} để tiện trò chuyện.`,
      `${subjPrefix ? `${subjPrefix}gợi ý đổi bối cảnh` : 'Gợi ý đổi bối cảnh'} ngay lúc ${clockFmt.timeStr}, di chuyển sang điểm dừng tiếp theo.`,
    ];

    boldOptions = [
      `${subjPrefix ? `${subjPrefix}chủ động tiến lại gần hơn` : 'Chủ động tiến lại gần hơn'} một bước, nhìn thẳng và nói ra điều táo bạo nhất.`,
      `${subjPrefix ? `${subjPrefix}bất ngờ cắt ngang` : 'Bất ngờ cắt ngang'} nhịp cũ bằng một cử chỉ dứt khoát làm xoay chuyển bầu không khí.`,
      `${subjPrefix ? `${subjPrefix}đưa ra một đề nghị bất ngờ` : 'Đưa ra một đề nghị bất ngờ'} ngay tại chỗ để đẩy tình huống lên cao trào.`,
    ];

    restOptions = clockInfo.restVariants.map((line) => `${line}.`);
  }

  const built: Array<{ category: TurnSuggestionCategory; text: string }> = [
    { category: 'continue', text: pick(continueOptions, 0) },
    { category: 'tease', text: pick(teaseOptions, 1) },
    { category: 'probe', text: pick(probeOptions, 2) },
    { category: 'move', text: pick(moveOptions, 0) },
    { category: 'bold', text: pick(boldOptions, 1) },
    { category: 'rest', text: pick(restOptions, 2) },
  ];

  return {
    primaryNpc,
    presentNames,
    items: built.map((item, idx) => ({
      id: `local_${currentTurn.id || 'p'}_${variant}_${idx}`,
      category: item.category,
      label: TURN_SUGGESTION_CATEGORY_LABELS[item.category],
      text: item.text,
      source: 'local',
    })),
  };
}

interface ChatViewProps {
  appState: ArkState;
  turns: Turn[];
  currentPage: number;
  streamEnabled: boolean;
  showRawTags: boolean;
  showPostMeta: boolean;
  hideBottomNav: boolean;
  isGenerating: boolean;
  genStatus: { text: string; isErr: boolean };
  streamingTurnIndex: number | null;
  streamingTurnId?: string | null;
  streamingText: string;
  pendingImage: PendingImage | null;
  imageCaption: string;
  storyImageConfig: StoryImageConfig;
  memoryConfig: MemoryManagerConfig;
  portraitBank: PortraitBankConfig;
  generatingPortraitIds: string[];
  enrichingAppearanceIds: string[];
  isEnrichingAppearances: boolean;
  bgPortraitStatus: BgPortraitStatus | null;
  historyTurns: number;
  hasProxyConfigured: boolean;
  isSyncingMemory: boolean;
  isSyncingStates: boolean;
  isSummarizing: boolean;
  npcs: CompanionNpc[];
  activeCompanionName: string;
  mcName: string;
  mcPronoun: string;
  mcAbsentAtStart?: boolean;
  hasSeedreamConfigured: boolean;
  isGeneratingImage: boolean;
  generatingImageTurnIdx: number | null;
  generatingImageTurnId?: string | null;
  isGeneratingSuggestions: boolean;
  onRequestAiSuggestions: (
    existingSuggestions: string[],
  ) => Promise<{
    ok: boolean;
    suggestions?: TurnSuggestionItem[];
    error?: string;
    aborted?: boolean;
  }>;
  onCancelAiSuggestions: () => void;
  onImageCaptionChange: (val: string) => void;
  onNavigate: (view: ViewName) => void;
  onPageChange: (page: number) => void;
  onToggleStream: () => void;
  onStopGeneration: () => void;
  onRegenerateCurrent: () => void;
  onToggleRawTags: () => void;
  onTogglePostMeta: () => void;
  onToggleBottomNav: () => void;
  onUpdateStoryImageConfig: (patch: Partial<StoryImageConfig>) => void;
  onUpdateMemory: (
    updater: (prev: MemoryManagerConfig) => MemoryManagerConfig,
  ) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncPortraitsFromCompanion: () => void;
  onCleanJunkPortraits: () => void;
  onAutoFillAppearances: () => void;
  onRefreshPortraitAppearance: (portraitId: string, force?: boolean) => void;
  onGeneratePortrait: (portraitId: string) => void;
  onScanCurrentPagePortraits: (turnIndex: number) => void;
  onCancelBgPortraits: () => void;
  onDismissBgPortraitStatus: () => void;
  onExtractMemories: (turnIndex: number) => void;
  onExtractStates: (turnIndex: number) => void;
  onRunRollingSummary: (forceAllOlder?: boolean) => void;
  onGenerateStoryImage: (turnIndex: number) => void;
  onCancelStoryImage: () => void;
  onClearTurnStoryImage: (turnIndex: number) => void;
  onUpdateTurn: (index: number, patch: Partial<Turn>) => void;
  onDeleteTurn: (index: number) => void;
  onPickImage: () => void;
  onSelectPendingImage: (img: PendingImage, suggestedCaption?: string) => void;
  onClearPendingImage: () => void;
  onSendTurn: (userText: string) => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
}

export function ChatView({
  appState,
  turns,
  currentPage,
  streamEnabled,
  showRawTags,
  showPostMeta,
  hideBottomNav,
  isGenerating,
  genStatus,
  streamingTurnIndex,
  streamingTurnId,
  streamingText,
  pendingImage,
  imageCaption,
  storyImageConfig,
  memoryConfig,
  portraitBank,
  generatingPortraitIds,
  enrichingAppearanceIds,
  isEnrichingAppearances,
  bgPortraitStatus,
  historyTurns,
  hasProxyConfigured,
  isSyncingMemory,
  isSyncingStates,
  isSummarizing,
  npcs,
  activeCompanionName,
  mcName,
  mcPronoun,
  mcAbsentAtStart,
  hasSeedreamConfigured,
  isGeneratingImage,
  generatingImageTurnIdx,
  generatingImageTurnId,
  isGeneratingSuggestions,
  onRequestAiSuggestions,
  onCancelAiSuggestions,
  onImageCaptionChange,
  onNavigate,
  onPageChange,
  onToggleStream,
  onStopGeneration,
  onRegenerateCurrent,
  onToggleRawTags,
  onTogglePostMeta,
  onToggleBottomNav,
  onUpdateStoryImageConfig,
  onUpdateMemory,
  onUpdatePortraitBank,
  onSyncPortraitsFromCompanion,
  onCleanJunkPortraits,
  onAutoFillAppearances,
  onRefreshPortraitAppearance,
  onGeneratePortrait,
  onScanCurrentPagePortraits,
  onCancelBgPortraits,
  onDismissBgPortraitStatus,
  onExtractMemories,
  onExtractStates,
  onRunRollingSummary,
  onGenerateStoryImage,
  onCancelStoryImage,
  onClearTurnStoryImage,
  onUpdateTurn,
  onDeleteTurn,
  onPickImage,
  onSelectPendingImage,
  onClearPendingImage,
  onSendTurn,
  onDownloadImage,
  onNotify,
}: ChatViewProps) {
  const [newTurnText, setNewTurnText] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [localSuggestionVariant, setLocalSuggestionVariant] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<TurnSuggestionItem[]>([]);
  const [aiSuggestionMode, setAiSuggestionMode] = useState<'append' | 'replace'>(
    'append',
  );
  const [aiSuggestionError, setAiSuggestionError] = useState<string | null>(
    null,
  );
  const [storyQuery, setStoryQuery] = useState('');
  const [editingUserIdx, setEditingUserIdx] = useState<number | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState('');
  const [editingAiIdx, setEditingAiIdx] = useState<number | null>(null);
  const [editingAiDraft, setEditingAiDraft] = useState('');
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] =
    useState<ImagePickerTarget | null>(null);
  const [activeUtility, setActiveUtility] = useState<
    'none' | 'search' | 'memory' | 'cultivation' | 'image' | 'portraits' | 'stats'
  >('none');
  const [memoryInitialTab, setMemoryInitialTab] =
    useState<MemorySubTab>('lorebook');
  const [cultivationInitialTab, setCultivationInitialTab] =
    useState<CultivationSubTab>('realm');
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    label: string;
  } | null>(null);
  const [quickCharacterName, setQuickCharacterName] = useState<string | null>(
    null,
  );

  const utilityMenuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const newTurnInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!utilityMenuOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        utilityMenuRef.current &&
        !utilityMenuRef.current.contains(e.target as Node)
      ) {
        setUtilityMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUtilityMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [utilityMenuOpen]);

  useEffect(() => {
    if (activeUtility === 'search') {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [activeUtility]);

  const toggleUtilityPanel = (
    panel: 'search' | 'memory' | 'cultivation' | 'image' | 'portraits' | 'stats',
  ) => {
    setActiveUtility((prev) => (prev === panel ? 'none' : panel));
    setUtilityMenuOpen(false);
  };

  const totalPages = Math.max(1, turns.length);
  const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const currentTurn = turns[safePage];
  const currentTurnId = currentTurn?.id || '';

  // Compute full-story totals ONLY when turns or showRawTags change (never on page flip) for snappy mobile paging
  const storyStatsBase = useMemo(() => {
    let userWords = 0;
    let aiWords = 0;
    let repliedTurns = 0;
    let imageCount = 0;
    const measuredDurations: number[] = [];
    const timestamps: number[] = [];

    turns.forEach((t) => {
      const uW = countWords(t.user || '');
      const cleanedAi = splitNarrativeAndMeta(
        t.assistant || '',
        showRawTags,
      ).mainText;
      const aW = countWords(cleanedAi);
      userWords += uW;
      aiWords += aW;
      if (aW > 0) repliedTurns += 1;
      if (t.imageData) imageCount += 1;
      if (t.storyImageData) imageCount += 1;
      if (
        typeof t.durationMs === 'number' &&
        Number.isFinite(t.durationMs) &&
        t.durationMs > 0
      ) {
        measuredDurations.push(t.durationMs);
      }
      const ts = extractTurnTimestamp(t);
      if (ts !== null) {
        timestamps.push(ts);
      }
    });

    const totalWords = userWords + aiWords;
    const turnCount = turns.length;
    const avgWordsPerTurn =
      turnCount > 0 ? Math.round(totalWords / turnCount) : 0;
    const totalReadingMinutes = Math.max(
      totalWords > 0 ? 1 : 0,
      Math.round(totalWords / 220),
    );

    let avgTimeDisplay = '—';
    let avgTimeHint = 'Chưa có lượt truyện';

    if (turnCount > 0) {
      if (measuredDurations.length > 0) {
        const avgMs =
          measuredDurations.reduce((sum, d) => sum + d, 0) /
          measuredDurations.length;
        avgTimeDisplay = formatDurationVi(avgMs);
        avgTimeHint = `Đo thực tế (${measuredDurations.length} lượt gọi AI)`;
      } else {
        const gaps: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          const diff = timestamps[i] - timestamps[i - 1];
          if (diff > 1000 && diff <= 2 * 60 * 60 * 1000) {
            gaps.push(diff);
          }
        }
        if (gaps.length > 0) {
          const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
          avgTimeDisplay = formatDurationVi(avgGap);
          avgTimeHint = `Theo mốc thời gian (${gaps.length} khoảng lượt)`;
        } else if (totalWords > 0) {
          const estMsPerTurn = (totalWords / turnCount / 220) * 60 * 1000;
          avgTimeDisplay = `~${formatDurationVi(estMsPerTurn)}`;
          avgTimeHint = 'Ước tính nhịp đọc (~220 từ/phút)';
        } else {
          avgTimeDisplay = '0 giây';
          avgTimeHint = 'Chưa có dữ liệu thời gian';
        }
      }
    }

    return {
      totalWords,
      userWords,
      aiWords,
      turnCount,
      repliedTurns,
      imageCount,
      avgWordsPerTurn,
      totalReadingMinutes,
      avgTimeDisplay,
      avgTimeHint,
    };
  }, [turns, showRawTags]);

  const currentPageWords = useMemo(() => {
    if (!currentTurn) return 0;
    const uW = countWords(currentTurn.user || '');
    const aW = countWords(
      splitNarrativeAndMeta(currentTurn.assistant || '', showRawTags).mainText,
    );
    return uW + aW;
  }, [currentTurn, showRawTags]);

  const storyStats = useMemo(
    () => ({
      ...storyStatsBase,
      currentPageWords,
    }),
    [storyStatsBase, currentPageWords],
  );

  const activeSelectedNpc = useMemo(() => {
    if (!npcs.length) return null;
    return (
      npcs.find((n) => n.id === storyImageConfig.selectedNpcId) || npcs[0]
    );
  }, [npcs, storyImageConfig.selectedNpcId]);

  const activeTargetSummary = useMemo(() => {
    if (storyImageConfig.targetMode === 'npc') {
      return activeSelectedNpc
        ? `NPC: ${activeSelectedNpc.name || 'NPC'}`
        : 'Chọn NPC';
    }
    if (storyImageConfig.targetMode === 'mc') {
      return `NV chính${mcName ? `: ${mcName}` : ''}`;
    }
    if (storyImageConfig.targetMode === 'custom') {
      const c = storyImageConfig.customSubject.trim();
      return c
        ? `Tùy chọn: ${c.slice(0, 24)}${c.length > 24 ? '…' : ''}`
        : 'Tùy chọn mô tả';
    }
    return 'Cảnh truyện';
  }, [
    activeSelectedNpc,
    mcName,
    storyImageConfig.customSubject,
    storyImageConfig.targetMode,
  ]);

  const isGeneratingCurrentPageImage =
    isGeneratingImage &&
    (generatingImageTurnId
      ? Boolean(currentTurnId) && generatingImageTurnId === currentTurnId
      : generatingImageTurnIdx === safePage);

  const trimmedQuery = storyQuery.trim();
  const storyMatches = useMemo(() => {
    if (!trimmedQuery) return [];
    const results: Array<{
      turnIndex: number;
      sourceLabel: string;
      snippet: string;
    }> = [];
    turns.forEach((t, idx) => {
      const parsed = splitNarrativeAndMeta(t.assistant || '', showRawTags);
      const userMatched = matchesQuery(t.user || '', trimmedQuery);
      const aiMatched = matchesQuery(parsed.mainText || '', trimmedQuery);
      const capMatched = matchesQuery(t.imageCaption || '', trimmedQuery);

      if (userMatched || aiMatched || capMatched) {
        const sourceLabel =
          aiMatched && userMatched
            ? 'Lượt gọi & Trả lời'
            : aiMatched
              ? 'Lượt trả lời'
              : userMatched
                ? 'Lượt gọi'
                : 'Chú thích ảnh';
        const snippetSource = aiMatched
          ? parsed.mainText
          : userMatched
            ? t.user
            : t.imageCaption || '';
        results.push({
          turnIndex: idx,
          sourceLabel,
          snippet: extractMatchSnippet(snippetSource, trimmedQuery, 42),
        });
      }
    });
    return results;
  }, [turns, trimmedQuery, showRawTags]);

  const currentMatchPos = storyMatches.findIndex(
    (m) => m.turnIndex === safePage,
  );

  const jumpToMatch = (dir: -1 | 1) => {
    if (!storyMatches.length) return;
    setEditingUserIdx(null);
    setEditingAiIdx(null);
    if (currentMatchPos === -1) {
      const target =
        dir === 1
          ? storyMatches.find((m) => m.turnIndex > safePage) || storyMatches[0]
          : [...storyMatches].reverse().find((m) => m.turnIndex < safePage) ||
            storyMatches[storyMatches.length - 1];
      onPageChange(target.turnIndex);
    } else {
      const nextPos =
        (currentMatchPos + dir + storyMatches.length) % storyMatches.length;
      onPageChange(storyMatches[nextPos].turnIndex);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (safePage > 0) {
      setEditingUserIdx(null);
      setEditingAiIdx(null);
      onPageChange(safePage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (safePage < turns.length - 1) {
      setEditingUserIdx(null);
      setEditingAiIdx(null);
      onPageChange(safePage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = () => {
    const trimmed = newTurnText.trim();
    if (!trimmed && !pendingImage) {
      onSendTurn('');
      return;
    }
    onSendTurn(trimmed);
    setNewTurnText('');
  };

  const isStreamingCurrentPage =
    isGenerating &&
    (streamingTurnId
      ? Boolean(currentTurnId) && streamingTurnId === currentTurnId
      : streamingTurnIndex === safePage);

  const effectiveAssistantText = isStreamingCurrentPage
    ? streamingText
    : showRawTags && currentTurn?.rawAssistant
      ? currentTurn.rawAssistant
      : currentTurn?.assistant || '';

  const parsedAi = useMemo(
    () =>
      parseStoryTurnStream(
        effectiveAssistantText,
        showRawTags,
        isStreamingCurrentPage,
      ),
    [effectiveAssistantText, showRawTags, isStreamingCurrentPage],
  );

  // Track manual draft/preset expand state; auto-collapse the instant main story begins
  const [draftOpenOverride, setDraftOpenOverride] = useState<boolean | null>(
    null,
  );
  const prevHasMainStoryRef = useRef<boolean>(parsedAi.hasMainStory);
  const aiArticleRef = useRef<HTMLElement | null>(null);
  const draftPreviewRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef<boolean>(true);
  const lastScrollYRef = useRef<number>(0);

  // Reset all per-page transient UI states whenever active page or turn identity changes
  // so editing drafts, modals, or prompt previews can NEVER bleed across pages after switch/delete.
  useEffect(() => {
    setEditingUserIdx(null);
    setEditingUserDraft('');
    setEditingAiIdx(null);
    setEditingAiDraft('');
    setShowImagePrompt(false);
    setQuickCharacterName(null);
    setDraftOpenOverride(null);
    setAiSuggestions([]);
    setAiSuggestionError(null);
    prevHasMainStoryRef.current = false;
  }, [safePage, currentTurnId, streamingTurnIndex, streamingTurnId]);

  useEffect(() => {
    if (!prevHasMainStoryRef.current && parsedAi.hasMainStory && !showRawTags) {
      // Automatically collapse open preset/draft blocks as soon as main narrative begins
      setDraftOpenOverride(false);
    }
    prevHasMainStoryRef.current = parsedAi.hasMainStory;
  }, [parsedAi.hasMainStory, showRawTags]);

  // Passive scroll observer during streaming so auto-follow never fights manual reading
  useEffect(() => {
    if (!isStreamingCurrentPage) {
      autoFollowRef.current = true;
      return;
    }
    autoFollowRef.current = true;
    lastScrollYRef.current = window.scrollY;
    const handleScroll = () => {
      const el = aiArticleRef.current;
      if (!el) return;
      const curY = window.scrollY;
      const rect = el.getBoundingClientRect();
      const distancePastViewport = rect.bottom - window.innerHeight;
      if (curY < lastScrollYRef.current - 12 && distancePastViewport > 60) {
        autoFollowRef.current = false;
      } else if (distancePastViewport <= 120) {
        autoFollowRef.current = true;
      }
      lastScrollYRef.current = curY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isStreamingCurrentPage]);

  // Smooth rAF-driven scroll-follow while streaming
  useEffect(() => {
    if (!isStreamingCurrentPage) return;
    const rafId = requestAnimationFrame(() => {
      if (parsedAi.inDraftPhase && draftPreviewRef.current) {
        draftPreviewRef.current.scrollTop =
          draftPreviewRef.current.scrollHeight;
        return;
      }
      if (autoFollowRef.current && aiArticleRef.current) {
        const rect = aiArticleRef.current.getBoundingClientRect();
        const bottomGap = rect.bottom - (window.innerHeight - 96);
        if (bottomGap > 6 && bottomGap < 420) {
          const gentleStep = Math.min(
            bottomGap,
            Math.max(2, Math.ceil(bottomGap * 0.28)),
          );
          const nextTop = window.scrollY + gentleStep;
          lastScrollYRef.current = nextTop;
          window.scrollTo({
            top: nextTop,
            behavior: 'auto',
          });
        }
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [isStreamingCurrentPage, streamingText, parsedAi.inDraftPhase]);

  const isDraftExpanded =
    draftOpenOverride !== null
      ? draftOpenOverride
      : isStreamingCurrentPage && parsedAi.inDraftPhase;

  const cultivationProfile = memoryConfig.cultivation?.enabled
    ? memoryConfig.cultivation
    : undefined;

  const activeUtilityLabel =
    activeUtility === 'search'
      ? 'Tìm kiếm'
      : activeUtility === 'memory'
        ? 'Ký ức'
        : activeUtility === 'cultivation' && cultivationProfile
          ? 'Tu luyện'
          : activeUtility === 'image'
            ? 'Sinh ảnh'
            : activeUtility === 'portraits'
              ? 'Ảnh NV'
              : activeUtility === 'stats'
                ? 'Thống kê'
                : null;

  const portraitCountSummary = useMemo(() => {
    const list = portraitBank?.portraits || [];
    const withImg = list.filter((p) => Boolean(p.imageData)).length;
    const autoText = portraitBank?.autoGenerateOnAppear
      ? 'Tự sinh ngầm: Bật'
      : 'Tự sinh ngầm: Tắt';
    return `${withImg}/${list.length} có ảnh · ${autoText}`;
  }, [portraitBank]);

  const mcNameKey = useMemo(
    () => normalizeCharacterKey(mcName || ''),
    [mcName],
  );

  const knownCharacterKeys = useMemo(() => {
    const keys = new Set<string>();
    const add = (raw?: string) => {
      const k = normalizeCharacterKey(raw || '');
      if (k && k.length >= 2) keys.add(k);
    };
    add(mcName);
    for (const n of npcs || []) add(n.name);
    for (const p of portraitBank?.portraits || []) add(p.name);
    for (const s of memoryConfig?.characterStates || []) add(s.name);
    return keys;
  }, [mcName, memoryConfig?.characterStates, npcs, portraitBank?.portraits]);

  const quickCharacterInfo = useMemo(() => {
    if (!quickCharacterName) return null;
    const targetKey = normalizeCharacterKey(quickCharacterName);
    const celeb = lookupKnownCelebrityProfile(quickCharacterName);
    const celebKey = celeb ? normalizeCharacterKey(celeb.canonicalName) : '';
    const matchesName = (candidate?: string) => {
      const k = normalizeCharacterKey(candidate || '');
      if (!k) return false;
      return k === targetKey || (Boolean(celebKey) && k === celebKey);
    };

    const portrait = (portraitBank?.portraits || []).find((p) =>
      matchesName(p.name),
    );
    const npc = (npcs || []).find((n) => matchesName(n.name));
    const stateSnap = (memoryConfig?.characterStates || []).find((s) =>
      matchesName(s.name),
    );
    const isMc = Boolean(
      portrait?.isMc ||
        stateSnap?.isMc ||
        (mcNameKey && targetKey === mcNameKey),
    );

    const displayName =
      portrait?.name || npc?.name || stateSnap?.name || celeb?.canonicalName || quickCharacterName;
    const role =
      portrait?.role || npc?.role || celeb?.role || (isMc ? 'Nhân vật chính' : 'Nhân vật');
    const birthday =
      portrait?.birthday || npc?.birthday || celeb?.birthday || '';
    const age =
      portrait?.age ||
      npc?.age ||
      computeAgeFromBirthday(birthday, memoryConfig?.storyClock) ||
      '';
    const ageBirthLabel = formatAgeBirthdayLabel(age, birthday);
    const fashionStyle =
      portrait?.fashionStyle || npc?.fashionStyle || celeb?.fashionStyle || '';
    const appearance =
      portrait?.appearance || npc?.appearance || celeb?.appearance || npc?.desc || '';
    const personality =
      portrait?.personality || npc?.personality || celeb?.personality || '';
    const relationships =
      portrait?.relationships || npc?.relationships || celeb?.relationships || '';
    const signature =
      portrait?.signature || npc?.signature || celeb?.signature || '';

    return {
      displayName,
      isMc,
      role,
      age,
      birthday,
      ageBirthLabel,
      fashionStyle,
      appearance,
      personality,
      relationships,
      signature,
      portrait,
      stateSnap,
    };
  }, [
    mcNameKey,
    memoryConfig?.characterStates,
    memoryConfig?.storyClock,
    npcs,
    portraitBank?.portraits,
    quickCharacterName,
  ]);

  const storyClockState = useMemo(
    () => normalizeStoryClock(memoryConfig.storyClock),
    [memoryConfig.storyClock],
  );
  const formattedStoryClock = useMemo(
    () => formatStoryClock(storyClockState),
    [storyClockState],
  );

  const memorySummarySubtitle = useMemo(() => {
    const parts: string[] = [];
    if (storyClockState.enabled) {
      parts.push(formattedStoryClock.shortDateTime);
    }
    if (memoryConfig.entries.length > 0) {
      parts.push(`${memoryConfig.entries.length} ký ức`);
    }
    if (memoryConfig.characterStates.length > 0) {
      parts.push(`${memoryConfig.characterStates.length} trạng thái`);
    }
    if (memoryConfig.rollingSummary?.content?.trim()) {
      parts.push('Có tóm tắt');
    }
    if (!memoryConfig.enabled) {
      return parts.length > 0
        ? `Đang tắt tiêm · ${parts.join(' · ')}`
        : 'Đang tắt tiêm ngữ cảnh';
    }
    return parts.length > 0
      ? parts.join(' · ')
      : 'Đồng hồ, sổ tay, trạng thái & tóm tắt';
  }, [memoryConfig, storyClockState.enabled, formattedStoryClock.shortDateTime]);

  const latestTurnId = turns[turns.length - 1]?.id || '';
  const currentTurnSignature = `${turns.length}:${latestTurnId}:${safePage}:${currentTurn?.id || ''}:${(currentTurn?.assistant || '').slice(0, 64)}`;
  useEffect(() => {
    setAiSuggestions([]);
    setAiSuggestionError(null);
  }, [currentTurnSignature]);

  const recentTurnsForSuggestions = useMemo(
    () => turns.slice(Math.max(0, safePage - 2), safePage),
    [turns, safePage],
  );

  const localSuggestionBundle = useMemo(() => {
    if (!suggestionsOpen) {
      return {
        items: [] as TurnSuggestionItem[],
        primaryNpc: null as string | null,
        presentNames: [] as string[],
      };
    }
    return buildLocalTurnSuggestions({
      currentTurn,
      recentTurns: recentTurnsForSuggestions,
      npcs,
      portraitBank,
      memoryConfig,
      mcName,
      mcPronoun,
      mcAbsentAtStart,
      storyClock: storyClockState,
      clockFmt: formattedStoryClock,
      variant: localSuggestionVariant,
    });
  }, [
    suggestionsOpen,
    currentTurn,
    recentTurnsForSuggestions,
    npcs,
    portraitBank,
    memoryConfig,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    storyClockState,
    formattedStoryClock,
    localSuggestionVariant,
  ]);

  const displayedSuggestions = useMemo(() => {
    if (!suggestionsOpen) return [] as TurnSuggestionItem[];
    if (aiSuggestionMode === 'replace' && aiSuggestions.length > 0) {
      return aiSuggestions;
    }
    const seen = new Set<string>();
    const combined: TurnSuggestionItem[] = [];
    for (const item of [...aiSuggestions, ...localSuggestionBundle.items]) {
      const k = normalizeCharacterKey(item.text);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      combined.push(item);
    }
    return combined;
  }, [
    suggestionsOpen,
    aiSuggestionMode,
    aiSuggestions,
    localSuggestionBundle.items,
  ]);

  const handleTriggerAiSuggestions = async () => {
    setAiSuggestionError(null);
    const existingTexts =
      aiSuggestionMode === 'append'
        ? displayedSuggestions.map((s) => s.text)
        : [];
    const res = await onRequestAiSuggestions(existingTexts);
    if (res.aborted) return;
    if (!res.ok || !res.suggestions?.length) {
      setAiSuggestionError(
        res.error || 'Không thể tạo gợi ý từ AI lúc này.',
      );
      return;
    }
    const fresh = res.suggestions.slice(0, 6);
    setAiSuggestions((prev) => {
      if (aiSuggestionMode === 'replace') {
        return fresh;
      }
      const seen = new Set<string>();
      const merged: TurnSuggestionItem[] = [];
      for (const item of [...fresh, ...prev]) {
        const k = normalizeCharacterKey(item.text);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        merged.push(item);
      }
      return merged.slice(0, 24);
    });
  };

  const handleSelectSuggestionCard = (text: string) => {
    setNewTurnText(text);
    requestAnimationFrame(() => {
      const el = newTurnInputRef.current;
      if (el) {
        el.focus();
        const len = text.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  return (
    <section className="space-y-3.5">
      {/* Compact Core Reader Bar + Tiện ích Popover */}
      <div className="relative z-20 space-y-2.5 rounded-2xl bg-[#162032]/88 p-3.5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate('lobby')}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-300" />
              <span>Sảnh</span>
            </button>

            <button
              type="button"
              onClick={onToggleStream}
              className={`min-h-[38px] rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                streamEnabled
                  ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/28 hover:bg-emerald-500/22'
                  : 'bg-white/[0.055] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10]'
              }`}
            >
              Stream: {streamEnabled ? 'Bật' : 'Tắt'}
            </button>

            <button
              type="button"
              onClick={onStopGeneration}
              disabled={!isGenerating}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22 active:scale-[0.98] disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Dừng</span>
            </button>

            <button
              type="button"
              onClick={onRegenerateCurrent}
              disabled={isGenerating || !turns.length}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-amber-500/14 px-3 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/22 active:scale-[0.98] disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Làm lại</span>
            </button>

            <button
              type="button"
              onClick={onToggleRawTags}
              className={`min-h-[38px] rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                showRawTags
                  ? 'bg-sky-500/16 text-sky-100 ring-sky-400/32 hover:bg-sky-500/24'
                  : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              Thẻ thô: {showRawTags ? 'Hiện' : 'Ẩn'}
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {(isGenerating || genStatus.isErr) && genStatus.text && (
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  genStatus.isErr ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                {genStatus.text}
              </span>
            )}

            {/* Tiện ích Dropdown / Popover */}
            <div ref={utilityMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={utilityMenuOpen}
                onClick={() => setUtilityMenuOpen((v) => !v)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                  utilityMenuOpen || activeUtility !== 'none'
                    ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                    : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5 text-sky-300" />
                <span>
                  {activeUtilityLabel
                    ? `Tiện ích · ${activeUtilityLabel}`
                    : 'Tiện ích'}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${
                    utilityMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {utilityMenuOpen && (
                <div
                  role="menu"
                  aria-label="Menu tiện ích truyện"
                  className="absolute right-0 top-full z-40 mt-2 w-[min(324px,calc(100vw-2rem))] rounded-2xl bg-[#182438]/96 p-2 ring-1 ring-white/[0.10] shadow-[0_24px_56px_-12px_rgba(2,6,23,0.82)] backdrop-blur-xl"
                >
                  <div className="space-y-1">
                    {/* 1. Tìm kiếm */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => toggleUtilityPanel('search')}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                        activeUtility === 'search'
                          ? 'bg-sky-400/16 text-sky-100'
                          : 'text-slate-200 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Search className="h-4 w-4 shrink-0 text-sky-300" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">Tìm kiếm</div>
                          <div className="truncate text-[11px] text-slate-400">
                            {trimmedQuery
                              ? `"${trimmedQuery}" · ${storyMatches.length} trang`
                              : 'Tìm nhanh từ khóa trong truyện'}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {activeUtility === 'search' ? 'Thu gọn' : 'Mở'}
                      </span>
                    </button>

                    {/* 2. Ký ức / AI Ghi nhớ */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMemoryInitialTab('lorebook');
                        toggleUtilityPanel('memory');
                      }}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                        activeUtility === 'memory'
                          ? 'bg-violet-400/16 text-violet-100'
                          : 'text-slate-200 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Brain className="h-4 w-4 shrink-0 text-violet-300" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">
                            Ký ức / AI Ghi nhớ
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {memorySummarySubtitle}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {activeUtility === 'memory' ? 'Thu gọn' : 'Mở'}
                      </span>
                    </button>

                    {/* 2b. Hồ sơ Tu luyện / Võ học & Túi đồ (chỉ hiển thị với Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp) */}
                    {cultivationProfile && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCultivationInitialTab('realm');
                          toggleUtilityPanel('cultivation');
                        }}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                          activeUtility === 'cultivation'
                            ? 'bg-emerald-400/16 text-emerald-100'
                            : 'text-slate-200 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Swords className="h-4 w-4 shrink-0 text-emerald-300" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold">
                              Tu luyện &amp; Túi đồ
                            </div>
                            <div className="truncate text-[11px] text-slate-400 tabular-nums">
                              {cultivationProfile.realmName} ·{' '}
                              {cultivationProfile.readyToBreakthrough ||
                              cultivationProfile.exp >= cultivationProfile.maxExp
                                ? 'Sẵn sàng đột phá'
                                : `${cultivationProfile.exp}/${cultivationProfile.maxExp}`}{' '}
                              · {cultivationProfile.techniques.length} công pháp ·{' '}
                              {cultivationProfile.inventory.length} vật phẩm
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-400">
                          {activeUtility === 'cultivation' ? 'Thu gọn' : 'Mở'}
                        </span>
                      </button>
                    )}

                    {/* 3. Sinh ảnh trong truyện */}
                    <div
                      className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors ${
                        activeUtility === 'image'
                          ? 'bg-sky-400/16 text-sky-100'
                          : 'text-slate-200 hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          if (activeUtility === 'image') {
                            setActiveUtility('none');
                          } else {
                            if (!storyImageConfig.enabled) {
                              onUpdateStoryImageConfig({ enabled: true });
                            }
                            setActiveUtility('image');
                          }
                          setUtilityMenuOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <Sparkles className="h-4 w-4 shrink-0 text-sky-300" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">
                            Sinh ảnh trong truyện
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {storyImageConfig.enabled
                              ? activeTargetSummary
                              : 'Đang tắt · Seedream 5 Pro'}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextEnabled = !storyImageConfig.enabled;
                          onUpdateStoryImageConfig({ enabled: nextEnabled });
                          if (!nextEnabled && activeUtility === 'image') {
                            setActiveUtility('none');
                          }
                        }}
                        className={`min-h-[30px] shrink-0 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                          storyImageConfig.enabled
                            ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/30'
                            : 'bg-white/[0.06] text-slate-300 ring-white/[0.09]'
                        }`}
                      >
                        {storyImageConfig.enabled ? 'Bật' : 'Tắt'}
                      </button>
                    </div>

                    {/* 4. Thư viện Ảnh Nhân vật / NPC */}
                    <div
                      className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors ${
                        activeUtility === 'portraits'
                          ? 'bg-sky-400/16 text-sky-100'
                          : 'text-slate-200 hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => toggleUtilityPanel('portraits')}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <Users className="h-4 w-4 shrink-0 text-emerald-300" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">
                            Ảnh nhân vật / NPC
                          </div>
                          <div className="truncate text-[11px] text-slate-400 tabular-nums">
                            {portraitCountSummary}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePortraitBank((prev) => ({
                            ...prev,
                            autoGenerateOnAppear: !prev.autoGenerateOnAppear,
                          }))
                        }
                        title="Bật/Tắt tự sinh ảnh NPC chạy ngầm khi xuất hiện"
                        className={`min-h-[30px] shrink-0 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                          portraitBank?.autoGenerateOnAppear
                            ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/30'
                            : 'bg-white/[0.06] text-slate-300 ring-white/[0.09]'
                        }`}
                      >
                        {portraitBank?.autoGenerateOnAppear ? 'Tự động' : 'Thủ công'}
                      </button>
                    </div>

                    {/* 4b. Giao diện chọn ảnh nhanh (mở dạng modal/sheet) */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUtilityMenuOpen(false);
                        setImagePickerTarget({ mode: 'composer' });
                      }}
                      className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ImageIcon className="h-4 w-4 shrink-0 text-sky-300" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">Chọn ảnh</div>
                          <div className="truncate text-[11px] text-slate-400">
                            Ảnh NV/NPC, ảnh truyện &amp; đính kèm
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-sky-300">
                        Mở
                      </span>
                    </button>

                    {/* 5. Thống kê */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => toggleUtilityPanel('stats')}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                        activeUtility === 'stats'
                          ? 'bg-indigo-400/16 text-indigo-100'
                          : 'text-slate-200 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <BarChart3 className="h-4 w-4 shrink-0 text-indigo-300" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">Thống kê</div>
                          <div className="truncate text-[11px] text-slate-400 tabular-nums">
                            {storyStats.totalWords.toLocaleString('vi-VN')} từ ·{' '}
                            {storyStats.turnCount} lượt
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {activeUtility === 'stats' ? 'Thu gọn' : 'Mở'}
                      </span>
                    </button>

                    <div className="my-1 border-t border-white/[0.07]" />

                    {/* 5. Hậu kỳ */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onTogglePostMeta();
                        setUtilityMenuOpen(false);
                      }}
                      className="flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-1.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {showPostMeta ? (
                          <Eye className="h-4 w-4 shrink-0 text-emerald-300" />
                        ) : (
                          <EyeOff className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className="text-xs font-semibold">
                          Hậu kỳ (thẻ meta)
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${
                          showPostMeta ? 'text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        {showPostMeta ? 'Hiện' : 'Ẩn'}
                      </span>
                    </button>

                    {/* 6. Ẩn / Hiện thanh mục cấu hình dưới */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onToggleBottomNav();
                        setUtilityMenuOpen(false);
                      }}
                      className="flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-1.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PanelBottom
                          className={`h-4 w-4 shrink-0 ${
                            hideBottomNav ? 'text-amber-300' : 'text-slate-400'
                          }`}
                        />
                        <span className="text-xs font-semibold">
                          {hideBottomNav ? 'Hiện thanh mục dưới' : 'Ẩn thanh mục dưới'}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${
                          hideBottomNav ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        {hideBottomNav ? 'Đang ẩn' : 'Đang hiện'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean single-line Story Clock strip (zero-pill, opens Memory/Clock drawer on tap) */}
        {storyClockState.enabled && activeUtility !== 'memory' && (
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5 text-[11px] text-slate-300">
            <button
              type="button"
              onClick={() => {
                setMemoryInitialTab('states');
                setActiveUtility('memory');
              }}
              className="flex min-w-0 items-center gap-1.5 truncate text-left transition-colors hover:text-amber-200"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="font-semibold text-amber-200 tabular-nums shrink-0">
                {formattedStoryClock.timeStr}
              </span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="truncate tabular-nums text-slate-300">
                {formattedStoryClock.eraLabel
                  ? `${formattedStoryClock.eraLabel} · ${formattedStoryClock.dateStr}`
                  : `${formattedStoryClock.weekday}, ${formattedStoryClock.dateStr} · ${formattedStoryClock.period}`}
              </span>
              {storyClockState.lastDeltaMinutes &&
                storyClockState.lastDeltaMinutes > 0 && (
                  <span className="hidden text-slate-400 tabular-nums sm:inline shrink-0">
                    ({formatDeltaMinutesVi(storyClockState.lastDeltaMinutes)})
                  </span>
                )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMemoryInitialTab('states');
                setActiveUtility('memory');
              }}
              className="shrink-0 font-semibold text-slate-400 transition-colors hover:text-amber-200 whitespace-nowrap"
            >
              Chỉnh giờ
            </button>
          </div>
        )}

        {/* Clean single-line Cultivation & Bag strip (ONLY shown for Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp) */}
        {cultivationProfile && activeUtility !== 'cultivation' && (
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[11px] text-slate-300">
            <button
              type="button"
              onClick={() => {
                setCultivationInitialTab('realm');
                setActiveUtility('cultivation');
              }}
              className="flex min-w-0 items-center gap-1.5 truncate text-left transition-colors hover:text-emerald-200"
            >
              <Swords className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="font-semibold text-emerald-200 truncate">
                {cultivationProfile.realmName}
              </span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span
                className={`shrink-0 tabular-nums ${
                  cultivationProfile.readyToBreakthrough ||
                  cultivationProfile.exp >= cultivationProfile.maxExp
                    ? 'font-semibold text-amber-300'
                    : 'text-slate-300'
                }`}
              >
                {cultivationProfile.readyToBreakthrough ||
                cultivationProfile.exp >= cultivationProfile.maxExp
                  ? 'Sẵn sàng đột phá'
                  : `${cultivationProfile.exp}/${cultivationProfile.maxExp}`}
              </span>
              <span className="hidden text-slate-500 sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden shrink-0 tabular-nums text-slate-400 sm:inline">
                {cultivationProfile.techniques.length} công pháp ·{' '}
                {cultivationProfile.inventory.length} món
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  setCultivationInitialTab('realm');
                  setActiveUtility('cultivation');
                }}
                className="font-semibold text-emerald-300 transition-colors hover:text-emerald-200"
              >
                Hồ sơ
              </button>
              <button
                type="button"
                onClick={() => {
                  setCultivationInitialTab('inventory');
                  setActiveUtility('cultivation');
                }}
                className="font-semibold text-slate-400 transition-colors hover:text-amber-200"
              >
                Túi đồ
              </button>
            </div>
          </div>
        )}

        {/* Minimal 1-line active search reminder only when search query is active while drawer is closed */}
        {activeUtility !== 'search' && trimmedQuery && (
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[11px] text-slate-300">
            <button
              type="button"
              onClick={() => setActiveUtility('search')}
              className="flex min-w-0 items-center gap-1.5 truncate text-left hover:text-sky-300"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span className="truncate">
                Đang tìm &quot;{trimmedQuery}&quot; ({storyMatches.length}{' '}
                trang)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStoryQuery('')}
              className="shrink-0 font-semibold text-slate-400 hover:text-slate-100"
            >
              Xóa lọc
            </button>
          </div>
        )}

        {/* Lightweight 1-line Background Auto-Portrait Status (only when running or just completed/errored while drawer closed) */}
        {activeUtility !== 'portraits' && bgPortraitStatus && (
          <div
            className={`flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[11px] ${
              bgPortraitStatus.isErr
                ? 'text-rose-300'
                : bgPortraitStatus.active
                  ? 'text-sky-300'
                  : 'text-emerald-300'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveUtility('portraits')}
              className="flex min-w-0 items-center gap-1.5 truncate text-left hover:underline"
            >
              {bgPortraitStatus.active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{bgPortraitStatus.text}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              {bgPortraitStatus.active ? (
                <button
                  type="button"
                  onClick={onCancelBgPortraits}
                  className="font-semibold text-rose-300 hover:text-rose-200"
                >
                  Dừng
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveUtility('portraits')}
                    className="font-semibold text-sky-300 hover:text-sky-200"
                  >
                    Xem ảnh
                  </button>
                  <button
                    type="button"
                    aria-label="Ẩn thông báo ảnh ngầm"
                    onClick={onDismissBgPortraitStatus}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active Utility Drawer: Character / NPC Portrait Bank */}
        {activeUtility === 'portraits' && (
          <div className="border-t border-white/[0.07] pt-3">
            <PortraitBankPanel
              portraitBank={portraitBank}
              activeCompanionName={activeCompanionName}
              storyClock={memoryConfig.storyClock}
              hasSeedreamConfigured={hasSeedreamConfigured}
              generatingPortraitIds={generatingPortraitIds}
              enrichingAppearanceIds={enrichingAppearanceIds}
              isEnrichingAppearances={isEnrichingAppearances}
              bgPortraitStatus={bgPortraitStatus}
              currentPage={safePage}
              turnCount={turns.length}
              compact
              onClose={() => setActiveUtility('none')}
              onNavigate={onNavigate}
              onUpdatePortraitBank={onUpdatePortraitBank}
              onSyncFromCompanion={onSyncPortraitsFromCompanion}
              onCleanJunkPortraits={onCleanJunkPortraits}
              onAutoFillAppearances={onAutoFillAppearances}
              onRefreshPortraitAppearance={onRefreshPortraitAppearance}
              onGeneratePortrait={onGeneratePortrait}
              onScanCurrentPagePortraits={onScanCurrentPagePortraits}
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
          </div>
        )}

        {/* Active Utility Drawer: AI Memory & State Manager */}
        {activeUtility === 'memory' && (
          <div className="border-t border-white/[0.07] pt-3">
            <MemoryManagerPanel
              memory={memoryConfig}
              turnCount={turns.length}
              currentPage={safePage}
              historyTurns={historyTurns}
              hasProxyConfigured={hasProxyConfigured}
              isSyncingMemory={isSyncingMemory}
              isSyncingStates={isSyncingStates}
              isSummarizing={isSummarizing}
              initialTab={memoryInitialTab}
              compact
              onClose={() => setActiveUtility('none')}
              onNavigate={onNavigate}
              onJumpToPage={(pageIdx) => {
                if (pageIdx >= 0 && pageIdx < turns.length) {
                  onPageChange(pageIdx);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              onUpdateMemory={onUpdateMemory}
              onExtractMemories={onExtractMemories}
              onExtractStates={onExtractStates}
              onRunRollingSummary={onRunRollingSummary}
              onSelectCharacter={setQuickCharacterName}
            />
          </div>
        )}

        {/* Active Utility Drawer: Cultivation / Martial Arts & Inventory */}
        {activeUtility === 'cultivation' && cultivationProfile && (
          <div className="border-t border-white/[0.07] pt-3">
            <CultivationPanel
              profile={cultivationProfile}
              mcName={mcName}
              storyClock={memoryConfig.storyClock}
              currentTurnText={
                splitNarrativeAndMeta(currentTurn?.assistant || '', false)
                  .mainText
              }
              initialTab={cultivationInitialTab}
              onUpdateProfile={(updater) =>
                onUpdateMemory((prev) => ({
                  ...prev,
                  cultivation: updater(prev.cultivation || cultivationProfile),
                }))
              }
              onQuickCultivate={(
                durationMinutes: number,
                label: string,
              ): QuickCultivateResult | null => {
                const baseClock = normalizeStoryClock(memoryConfig.storyClock);
                const shifted = addMinutesToClock(baseClock, durationMinutes);
                const nextClock = {
                  ...shifted,
                  initialized: true,
                  lastDeltaMinutes: durationMinutes,
                  lastAdvanceReason: `Tu luyện nhanh (${label})`,
                  updatedAt: Date.now(),
                };
                const calc = applyClockDeltaToCultivation(
                  cultivationProfile,
                  durationMinutes,
                  {
                    sceneText:
                      'bế quan đả tọa tu luyện chuyên tâm vận công luyện võ diễn võ',
                    reason: `Tu luyện nhanh (${label})`,
                    forceActiveTraining: true,
                  },
                );
                if (!calc.nextProfile) return null;

                onUpdateMemory((prev) => {
                  const prevClock = normalizeStoryClock(prev.storyClock);
                  const advancedClock = {
                    ...addMinutesToClock(prevClock, durationMinutes),
                    initialized: true,
                    lastDeltaMinutes: durationMinutes,
                    lastAdvanceReason: `Tu luyện nhanh (${label})`,
                    updatedAt: Date.now(),
                  };
                  const updatedCult =
                    applyClockDeltaToCultivation(
                      prev.cultivation || cultivationProfile,
                      durationMinutes,
                      {
                        sceneText:
                          'bế quan đả tọa tu luyện chuyên tâm vận công luyện võ diễn võ',
                        reason: `Tu luyện nhanh (${label})`,
                        forceActiveTraining: true,
                      },
                    ).nextProfile || prev.cultivation;
                  return {
                    ...prev,
                    storyClock: advancedClock,
                    cultivation: updatedCult,
                  };
                });

                const beforeFmt = formatStoryClock(baseClock).shortDateTime;
                const afterFmt = formatStoryClock(nextClock).shortDateTime;
                const deltaLabel = formatDeltaMinutesVi(durationMinutes);
                const energyShort = cultivationProfile.energyLabel
                  .split('/')[0]
                  .trim();

                if (
                  calc.becameReadyToBreakthrough ||
                  calc.nextProfile.readyToBreakthrough
                ) {
                  onNotify?.(
                    `Tu luyện ${label} (+${calc.expGained} ${energyShort}, đồng hồ → ${afterFmt}) — Đã sẵn sàng đột phá cảnh giới!`,
                  );
                } else {
                  const extraParts: string[] = [];
                  if (calc.leveledTechniques.length > 0) {
                    extraParts.push(
                      `Thăng tầng: ${calc.leveledTechniques.join(', ')}`,
                    );
                  }
                  if (calc.leveledMoves.length > 0) {
                    extraParts.push(
                      `Chiêu thức: ${calc.leveledMoves.slice(0, 2).join(', ')}`,
                    );
                  }
                  onNotify?.(
                    `Tu luyện nhanh ${label}: +${calc.expGained} ${energyShort} (đồng hồ → ${afterFmt})${extraParts.length ? ` · ${extraParts.join(' · ')}` : ''}.`,
                  );
                }

                return {
                  expGained: calc.expGained,
                  leveledTechniques: calc.leveledTechniques,
                  leveledMoves: calc.leveledMoves,
                  becameReadyToBreakthrough: calc.becameReadyToBreakthrough,
                  readyToBreakthrough: Boolean(
                    calc.nextProfile.readyToBreakthrough ||
                      calc.nextProfile.exp >= calc.nextProfile.maxExp,
                  ),
                  clockBeforeLabel: beforeFmt,
                  clockAfterLabel: afterFmt,
                  deltaLabel,
                };
              }}
              onOpenClock={() => {
                setMemoryInitialTab('states');
                setActiveUtility('memory');
              }}
              onClose={() => setActiveUtility('none')}
              onNotify={onNotify}
            />
          </div>
        )}

        {/* Active Utility Drawer: Story Turn Statistics */}
        {activeUtility === 'stats' && (
          <div className="space-y-3 rounded-2xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-indigo-400/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 shrink-0 text-indigo-300" />
                <span className="text-xs font-bold text-slate-100">
                  Thống kê lượt truyện
                </span>
              </div>
              <button
                type="button"
                aria-label="Đóng bảng thống kê"
                onClick={() => setActiveUtility('none')}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl bg-[#162134]/90 p-3 ring-1 ring-inset ring-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <FileText className="h-3.5 w-3.5 text-sky-300" />
                  <span>Tổng số từ</span>
                </div>
                <div className="mt-1 text-lg font-bold text-slate-50 tabular-nums">
                  {storyStats.totalWords.toLocaleString('vi-VN')}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                  TB {storyStats.avgWordsPerTurn.toLocaleString('vi-VN')} từ/lượt
                  {storyStats.turnCount > 0 && (
                    <>
                      {' '}
                      · Trang {safePage + 1}:{' '}
                      {storyStats.currentPageWords.toLocaleString('vi-VN')}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#162134]/90 p-3 ring-1 ring-inset ring-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Số lượt đã tương tác</span>
                </div>
                <div className="mt-1 text-lg font-bold text-slate-50 tabular-nums">
                  {storyStats.turnCount.toLocaleString('vi-VN')}{' '}
                  <span className="text-xs font-semibold text-slate-400">
                    lượt
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                  {storyStats.repliedTurns}/{storyStats.turnCount} lượt có phản
                  hồi AI
                  {storyStats.imageCount > 0 && (
                    <> · {storyStats.imageCount} ảnh</>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#162134]/90 p-3 ring-1 ring-inset ring-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-amber-300" />
                  <span>Thời gian TB mỗi lượt</span>
                </div>
                <div className="mt-1 text-lg font-bold text-slate-50 tabular-nums">
                  {storyStats.avgTimeDisplay}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {storyStats.avgTimeHint}
                </div>
              </div>
            </div>

            {storyStats.turnCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5 text-[11px] text-slate-400 tabular-nums">
                <span>
                  Lượt gọi:{' '}
                  <strong className="font-semibold text-slate-200">
                    {storyStats.userWords.toLocaleString('vi-VN')}
                  </strong>{' '}
                  từ · Lượt trả lời:{' '}
                  <strong className="font-semibold text-slate-200">
                    {storyStats.aiWords.toLocaleString('vi-VN')}
                  </strong>{' '}
                  từ
                </span>
                <span>
                  Đọc toàn truyện:{' '}
                  <strong className="font-semibold text-slate-200">
                    ~{storyStats.totalReadingMinutes} phút
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Active Utility Drawer: In-Story Image Generation (Seedream 5 Pro) */}
        {activeUtility === 'image' && (
          <div className="space-y-3 rounded-2xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-sky-400/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <ImageIcon className="h-4 w-4 shrink-0 text-sky-300" />
                <span className="text-xs font-bold text-slate-100">
                  Sinh ảnh trong truyện
                </span>
                <span className="truncate text-[11px] font-medium text-sky-300">
                  · {activeTargetSummary}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStoryImageConfig({
                      enabled: !storyImageConfig.enabled,
                    })
                  }
                  className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                    storyImageConfig.enabled
                      ? 'bg-sky-500/16 text-sky-200 ring-sky-400/32'
                      : 'bg-white/[0.06] text-slate-300 ring-white/[0.09]'
                  }`}
                >
                  Sinh ảnh: {storyImageConfig.enabled ? 'Bật' : 'Tắt'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStoryImageConfig({
                      autoGenerate: !storyImageConfig.autoGenerate,
                    })
                  }
                  className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                    storyImageConfig.autoGenerate
                      ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/32'
                      : 'bg-white/[0.06] text-slate-300 ring-white/[0.09] hover:bg-white/[0.10]'
                  }`}
                >
                  Tự động: {storyImageConfig.autoGenerate ? 'Bật' : 'Tắt'}
                </button>
                <button
                  type="button"
                  aria-label="Thu gọn bảng sinh ảnh"
                  onClick={() => setActiveUtility('none')}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/[0.07] pt-3">
              {/* Target Mode Selector */}
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                  Đối tượng sinh ảnh
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(
                    [
                      {
                        id: 'scene',
                        label: 'Cảnh truyện',
                        icon: ImageIcon,
                      },
                      {
                        id: 'npc',
                        label: npcs.length
                          ? `Chọn NPC (${npcs.length})`
                          : 'Chọn NPC',
                        icon: Users,
                      },
                      {
                        id: 'mc',
                        label: 'Nhân vật chính',
                        icon: User,
                      },
                      {
                        id: 'custom',
                        label: 'Tùy chọn',
                        icon: SlidersHorizontal,
                      },
                    ] as Array<{
                      id: StoryImageTargetMode;
                      label: string;
                      icon: typeof ImageIcon;
                    }>
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = storyImageConfig.targetMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const patch: Partial<StoryImageConfig> = {
                            targetMode: opt.id,
                          };
                          if (
                            opt.id === 'npc' &&
                            !storyImageConfig.selectedNpcId &&
                            npcs.length
                          ) {
                            patch.selectedNpcId = npcs[0].id;
                          }
                          onUpdateStoryImageConfig(patch);
                        }}
                        className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ring-1 ring-inset transition-all ${
                          active
                            ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                            : 'bg-white/[0.045] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09]'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NPC Picker when mode === 'npc' */}
              {storyImageConfig.targetMode === 'npc' && (
                <div className="space-y-2 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-white/[0.07]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-400">
                      Chọn NPC từ hồ sơ{' '}
                      <span className="text-slate-200">
                        {activeCompanionName || 'Đồng nhân'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('companion')}
                      className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      Quản lý NPC →
                    </button>
                  </div>

                  {npcs.length === 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400">
                      <span>
                        Hồ sơ hiện tại chưa có NPC nào. Hãy thêm NPC trong mục
                        Đồng nhân hoặc chuyển sang Tùy chọn.
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onNavigate('companion')}
                          className="min-h-[30px] rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24"
                        >
                          Thêm NPC
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateStoryImageConfig({ targetMode: 'custom' })
                          }
                          className="min-h-[30px] rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09]"
                        >
                          Dùng Tùy chọn
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {npcs.map((npc) => {
                          const selected = activeSelectedNpc?.id === npc.id;
                          return (
                            <button
                              key={npc.id}
                              type="button"
                              onClick={() =>
                                onUpdateStoryImageConfig({
                                  selectedNpcId: npc.id,
                                })
                              }
                              className={`inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                                selected
                                  ? 'bg-emerald-500/18 text-emerald-100 ring-emerald-400/38'
                                  : 'bg-white/[0.05] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09]'
                              }`}
                            >
                              <span className="truncate">
                                {npc.name || 'NPC'}
                              </span>
                              {npc.role && (
                                <span className="truncate text-[10px] font-normal text-slate-400">
                                  ({npc.role})
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {activeSelectedNpc?.desc && (
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Mô tả NPC:
                          </span>{' '}
                          {activeSelectedNpc.desc}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Custom Subject / Extra Prompt Details */}
              <div>
                <label
                  htmlFor="storyImageCustomInput"
                  className="mb-1.5 block text-[11px] font-medium text-slate-400"
                >
                  {storyImageConfig.targetMode === 'custom'
                    ? 'Mô tả tùy chọn để sinh ảnh (nhân vật, hành động, khung cảnh...)'
                    : 'Chi tiết bổ sung (tùy chọn — góc máy, biểu cảm, trang phục, ánh sáng...)'}
                </label>
                <input
                  id="storyImageCustomInput"
                  type="text"
                  value={storyImageConfig.customSubject}
                  onChange={(e) =>
                    onUpdateStoryImageConfig({
                      customSubject: e.target.value,
                    })
                  }
                  placeholder={
                    storyImageConfig.targetMode === 'custom'
                      ? 'Ví dụ: Cô gái tóc bạc đứng dưới mưa đèn neon, ánh mắt bình thản...'
                      : 'Ví dụ: góc cận mặt, ánh hoàng hôn ấm áp, nụ cười nhẹ...'
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              {/* Art Style & Camera Angle Selector (15 presets + custom styles + comparison samples) */}
              <ImageStylePicker
                storyImageConfig={storyImageConfig}
                onUpdateStoryImageConfig={onUpdateStoryImageConfig}
                portraits={portraitBank?.portraits || []}
                compact
                onInsertVariable={(token) => {
                  const prev = storyImageConfig.customSubject || '';
                  onUpdateStoryImageConfig({
                    customSubject: prev.trim()
                      ? `${prev.trimEnd()} ${token}`
                      : token,
                  });
                }}
                onDownloadImage={onDownloadImage}
                onNotify={onNotify}
              />

              {/* Editable Prompt Template & Before/After Injection Preview */}
              <ImagePromptTemplatePanel
                appState={appState}
                currentTurn={currentTurn}
                storyImageConfig={storyImageConfig}
                onUpdateStoryImageConfig={onUpdateStoryImageConfig}
                onNotify={onNotify}
              />

              {/* Size Selector */}
              <div>
                <label
                  htmlFor="storyImageSizeSelect"
                  className="mb-1.5 block text-[11px] font-medium text-slate-400"
                >
                  Tỷ lệ / Kích thước
                </label>
                <select
                  id="storyImageSizeSelect"
                  value={storyImageConfig.size}
                  onChange={(e) =>
                    onUpdateStoryImageConfig({ size: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  {STORY_IMAGE_SIZES.map((sz) => (
                    <option key={sz.value || 'default'} value={sz.value}>
                      {sz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                {!hasSeedreamConfigured ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-200">
                    <span>Chưa có Seedream Endpoint.</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('config')}
                      className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-amber-500/16 px-2.5 font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/24"
                    >
                      <Settings className="h-3 w-3" />
                      <span>Mở Cấu hình</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Dùng Seedream 5 Pro đã cấu hình
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  {isGeneratingImage && (
                    <button
                      type="button"
                      onClick={onCancelStoryImage}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-rose-500/16 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/24"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      <span>Hủy ảnh</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isGeneratingImage || !currentTurn}
                    onClick={() => onGenerateStoryImage(safePage)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isGeneratingImage
                        ? 'Đang sinh ảnh...'
                        : currentTurn?.storyImageData
                          ? 'Vẽ lại trang này'
                          : 'Sinh ảnh trang này'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Utility Drawer: Quick Story Search */}
        {activeUtility === 'search' && (
          <div className="space-y-2.5 rounded-2xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-sky-400/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Search className="h-4 w-4 shrink-0 text-sky-300" />
                <span className="text-xs font-bold text-slate-100">
                  Tìm nhanh trong truyện
                </span>
              </div>
              <button
                type="button"
                aria-label="Đóng ô tìm kiếm"
                onClick={() => setActiveUtility('none')}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={storyQuery}
                  onChange={(e) => setStoryQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && storyMatches.length) {
                      e.preventDefault();
                      jumpToMatch(e.shiftKey ? -1 : 1);
                    }
                  }}
                  aria-label="Tìm nhanh trong nội dung truyện"
                  placeholder="Nhập từ khóa trong truyện (hỗ trợ không dấu)..."
                  className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
                {storyQuery && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => setStoryQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {trimmedQuery && (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="px-1.5 text-[11px] font-medium text-slate-300 tabular-nums whitespace-nowrap">
                    {storyMatches.length
                      ? currentMatchPos >= 0
                        ? `${currentMatchPos + 1} / ${storyMatches.length}`
                        : `${storyMatches.length} trang`
                      : '0 kết quả'}
                  </span>
                  <button
                    type="button"
                    disabled={!storyMatches.length}
                    aria-label="Kết quả trước"
                    onClick={() => jumpToMatch(-1)}
                    className="inline-flex h-9 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] disabled:opacity-35"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!storyMatches.length}
                    aria-label="Kết quả tiếp theo"
                    onClick={() => jumpToMatch(1)}
                    className="inline-flex h-9 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] disabled:opacity-35"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {trimmedQuery && (
              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                {!storyMatches.length ? (
                  <p className="text-xs text-slate-400">
                    Không tìm thấy &quot;{trimmedQuery}&quot; trong{' '}
                    {turns.length} trang truyện.
                  </p>
                ) : (
                  storyMatches.map((m) => {
                    const isCurrent = m.turnIndex === safePage;
                    return (
                      <button
                        key={m.turnIndex}
                        type="button"
                        onClick={() => {
                          setEditingUserIdx(null);
                          setEditingAiIdx(null);
                          onPageChange(m.turnIndex);
                        }}
                        className={`block w-full rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors ${
                          isCurrent
                            ? 'bg-sky-500/16 ring-sky-400/35'
                            : 'bg-[#0e1625]/75 ring-white/[0.06] hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-sky-300 tabular-nums">
                            Trang {m.turnIndex + 1}
                          </span>
                          <span className="text-slate-400">{m.sourceLabel}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">
                          {m.snippet}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Turn Content */}
      {!currentTurn ? (
        <div className="rounded-2xl bg-[#162032]/88 p-6 text-sm text-slate-300 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
          Chưa có lượt nào. Nhập file Save (.json) hoặc nhập lượt gọi mới bên dưới.
        </div>
      ) : (
        <div
          key={currentTurnId || `turn_${safePage}`}
          className="space-y-3.5"
        >
          {/* User Turn Box */}
          <article className="rounded-2xl bg-[#141e30]/86 p-4 sm:p-5 ring-1 ring-white/[0.07] shadow-[0_10px_28px_-18px_rgba(2,8,23,0.65)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span className="font-semibold text-slate-100">Lượt gọi</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Trang {safePage + 1}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (editingUserIdx === safePage) {
                      onUpdateTurn(safePage, { user: editingUserDraft });
                      setEditingUserIdx(null);
                    } else {
                      setEditingUserDraft(currentTurn.user || '');
                      setEditingUserIdx(safePage);
                    }
                  }}
                  className="min-h-[32px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
                >
                  {editingUserIdx === safePage ? 'Lưu' : 'Sửa'}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTurn(safePage)}
                  aria-label={`Xóa Trang ${safePage + 1}`}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-rose-500/12 px-2.5 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/24 transition-all hover:bg-rose-500/22 hover:text-rose-100 active:scale-[0.98] whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa trang</span>
                </button>
              </div>
            </div>

            {currentTurn.imageData && (
              <div className="mb-3.5 space-y-2">
                <img
                  src={currentTurn.imageData}
                  alt={currentTurn.imageCaption || 'Ảnh đính kèm'}
                  referrerPolicy="no-referrer"
                  className="max-h-64 w-auto max-w-full rounded-xl ring-1 ring-white/[0.10] object-contain"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onDownloadImage(
                        currentTurn.imageData || '',
                        `luot_${safePage + 1}.png`,
                      )
                    }
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Tải ảnh về máy</span>
                  </button>
                  {currentTurn.imageCaption && (
                    <span className="text-xs text-slate-400">
                      Chú thích: {currentTurn.imageCaption}
                    </span>
                  )}
                </div>
              </div>
            )}

            {editingUserIdx === safePage ? (
              <textarea
                value={editingUserDraft}
                onChange={(e) => setEditingUserDraft(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-sky-400/50 bg-[#0e1625]/90 p-3 text-sm leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            ) : (
              <ProseRenderer
                text={currentTurn.user || ''}
                highlightQuery={trimmedQuery}
                knownCharacterKeys={knownCharacterKeys}
                mcNameKey={mcNameKey}
                onCharacterClick={setQuickCharacterName}
              />
            )}
          </article>

          {/* AI Response Box */}
          <article
            ref={aiArticleRef}
            className="rounded-2xl bg-[#182336]/95 p-4 sm:p-6 ring-1 ring-sky-400/[0.16] shadow-[0_16px_38px_-18px_rgba(2,8,23,0.75)]"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                <span className="font-semibold text-sky-300">Lượt trả lời</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Trang {safePage + 1}</span>
                {currentTurn.storyClockSnapshot && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-200/90 tabular-nums">
                      {currentTurn.storyClockSnapshot}
                    </span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {storyImageConfig.enabled && (
                  <button
                    type="button"
                    disabled={isGeneratingImage || isStreamingCurrentPage}
                    onClick={() => onGenerateStoryImage(safePage)}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-sky-500/14 px-2.5 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 transition-colors hover:bg-sky-500/22 disabled:opacity-45 whitespace-nowrap"
                  >
                    {isGeneratingCurrentPageImage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isGeneratingCurrentPageImage
                        ? 'Đang vẽ...'
                        : currentTurn.storyImageData
                          ? 'Vẽ lại'
                          : 'Sinh ảnh'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isStreamingCurrentPage}
                  onClick={() => {
                    if (editingAiIdx === safePage) {
                      onUpdateTurn(safePage, { assistant: editingAiDraft });
                      setEditingAiIdx(null);
                    } else {
                      setEditingAiDraft(currentTurn.assistant || '');
                      setEditingAiIdx(safePage);
                    }
                  }}
                  className="min-h-[32px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white disabled:opacity-45 whitespace-nowrap"
                >
                  {editingAiIdx === safePage ? 'Lưu' : 'Sửa'}
                </button>
              </div>
            </div>

            {/* Generating Illustration Placeholder */}
            {isGeneratingCurrentPageImage && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-500/10 px-3.5 py-3 ring-1 ring-inset ring-sky-400/25">
                <div className="flex items-center gap-2.5 text-xs text-sky-100">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
                  <span>
                    Đang sinh ảnh minh họa ({activeTargetSummary})...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCancelStoryImage}
                  className="min-h-[30px] rounded-lg bg-rose-500/16 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
                >
                  Hủy
                </button>
              </div>
            )}

            {/* Generated Story Illustration */}
            {currentTurn.storyImageData && (
              <div className="mb-4 overflow-hidden rounded-2xl bg-[#101829] ring-1 ring-white/[0.09]">
                <div className="relative flex justify-center bg-[#0b111e]">
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        src: currentTurn.storyImageData || '',
                        label:
                          currentTurn.storyImageSubject ||
                          `Minh họa Trang ${safePage + 1}`,
                      })
                    }
                    className="group relative block w-full focus:outline-none"
                    aria-label="Phóng to ảnh minh họa"
                  >
                    <img
                      src={currentTurn.storyImageData}
                      alt={
                        currentTurn.storyImageSubject ||
                        `Ảnh minh họa trang ${safePage + 1}`
                      }
                      referrerPolicy="no-referrer"
                      className="mx-auto max-h-[420px] w-full object-contain"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-[#101828]/82 px-2.5 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-inset ring-white/[0.12] backdrop-blur-md opacity-90 transition-opacity group-hover:opacity-100">
                      <Maximize2 className="h-3 w-3" />
                      <span>Phóng to</span>
                    </span>
                  </button>
                </div>

                <div className="space-y-2 border-t border-white/[0.07] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-sky-300">
                      {currentTurn.storyImageSubject || 'Ảnh minh họa truyện'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {currentTurn.storyImagePrompt && (
                        <button
                          type="button"
                          onClick={() => setShowImagePrompt((v) => !v)}
                          className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
                        >
                          {showImagePrompt ? 'Ẩn prompt' : 'Xem prompt'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onDownloadImage(
                            currentTurn.storyImageData || '',
                            `minh_hoa_trang_${safePage + 1}.png`,
                          )
                        }
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
                      >
                        <Download className="h-3 w-3" />
                        <span>Tải</span>
                      </button>
                      {storyImageConfig.enabled && (
                        <button
                          type="button"
                          disabled={isGeneratingImage}
                          onClick={() => onGenerateStoryImage(safePage)}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/14 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 hover:bg-sky-500/22 disabled:opacity-45"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Vẽ lại</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onClearTurnStoryImage(safePage)}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-rose-500/14 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 hover:bg-rose-500/22"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                  {showImagePrompt && currentTurn.storyImagePrompt && (
                    <p className="rounded-xl bg-[#0c1322] p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                      {currentTurn.storyImagePrompt}
                    </p>
                  )}
                </div>
              </div>
            )}

            {editingAiIdx === safePage ? (
              <textarea
                value={editingAiDraft}
                onChange={(e) => setEditingAiDraft(e.target.value)}
                rows={9}
                className="w-full rounded-xl border border-sky-400/50 bg-[#0e1625]/90 p-3 text-sm leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            ) : (
              <>
                {/* Preset / Thinking / Draft Stage Panel */}
                {!showRawTags && parsedAi.draftText && (
                  <div
                    className={`mb-4 overflow-hidden rounded-xl ring-1 ring-inset transition-colors ${
                      isStreamingCurrentPage && parsedAi.inDraftPhase
                        ? 'bg-sky-500/[0.08] ring-sky-400/28'
                        : 'bg-[#111a2b]/85 ring-white/[0.07]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDraftOpenOverride(!isDraftExpanded)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-xs">
                        <Cpu
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isStreamingCurrentPage && parsedAi.inDraftPhase
                              ? 'text-sky-300'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate font-semibold text-slate-200">
                          {isStreamingCurrentPage && parsedAi.inDraftPhase
                            ? parsedAi.currentStepLabel ||
                              'Đang xử lý preset & dàn ý...'
                            : parsedAi.steps.length > 1
                              ? `Đã xử lý ${parsedAi.steps.length} bước preset / suy nghĩ`
                              : 'Khối suy nghĩ / preset đã thu gọn'}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400">
                        <span>{isDraftExpanded ? 'Thu gọn' : 'Xem nháp'}</span>
                        {isDraftExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>

                    {isDraftExpanded && (
                      <div className="space-y-2 border-t border-white/[0.07] px-3.5 py-3">
                        {parsedAi.steps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {parsedAi.steps.map((step, sIdx) => {
                              const isActiveStep =
                                isStreamingCurrentPage &&
                                parsedAi.inDraftPhase &&
                                sIdx === parsedAi.steps.length - 1;
                              return (
                                <span
                                  key={`${step.label}-${sIdx}`}
                                  className={`inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] ring-1 ring-inset ${
                                    isActiveStep
                                      ? 'bg-sky-500/16 font-semibold text-sky-200 ring-sky-400/32'
                                      : 'bg-white/[0.045] text-slate-300 ring-white/[0.07]'
                                  }`}
                                >
                                  {isActiveStep ? (
                                    <ChevronRight className="h-2.5 w-2.5 shrink-0 text-sky-300" />
                                  ) : (
                                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
                                  )}
                                  <span className="truncate">{step.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div
                          ref={draftPreviewRef}
                          className={`max-h-40 overflow-y-auto rounded-xl bg-[#0c1322] p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-slate-400 ring-1 ring-inset ring-white/[0.05] transition-opacity duration-700 ease-out ${
                            isStreamingCurrentPage && parsedAi.inDraftPhase
                              ? 'stream-text-breathing'
                              : 'opacity-100'
                          }`}
                        >
                          {parsedAi.draftText}
                          {isStreamingCurrentPage && parsedAi.inDraftPhase && (
                            <span
                              aria-hidden="true"
                              className="stream-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Calm static status strip when Raw Tags are shown during streaming draft phase */}
                {showRawTags &&
                  isStreamingCurrentPage &&
                  parsedAi.inDraftPhase &&
                  parsedAi.currentStepLabel && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-inset ring-sky-400/25">
                      <Cpu className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      <span className="truncate">
                        Đang xử lý: {parsedAi.currentStepLabel}
                      </span>
                    </div>
                  )}

                {/* Main Story Narrative */}
                {!showRawTags &&
                isStreamingCurrentPage &&
                !parsedAi.hasMainStory ? (
                  !parsedAi.draftText && (
                    <p className="stream-text-breathing py-1 text-sm text-slate-400">
                      Đang khởi tạo lượt truyện
                      <span
                        aria-hidden="true"
                        className="stream-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
                      />
                    </p>
                  )
                ) : (
                  <ProseRenderer
                    text={parsedAi.mainText}
                    highlightQuery={trimmedQuery}
                    isStreaming={
                      isStreamingCurrentPage &&
                      (showRawTags || parsedAi.hasMainStory)
                    }
                    knownCharacterKeys={knownCharacterKeys}
                    mcNameKey={mcNameKey}
                    onCharacterClick={setQuickCharacterName}
                    emptyPlaceholder={
                      isStreamingCurrentPage
                        ? 'Đang nhận nội dung'
                        : '(Chưa có nội dung)'
                    }
                  />
                )}

                {showPostMeta && parsedAi.metaText && (
                  <div className="mt-4 rounded-xl border border-dashed border-white/[0.12] bg-[#101828]/80 p-3 font-mono text-xs whitespace-pre-wrap text-slate-400">
                    {parsedAi.metaText}
                  </div>
                )}
              </>
            )}
          </article>
        </div>
      )}

      {/* Bottom Pagination Bar (One-Handed Thumb Zone, directly above New Turn Composer) */}
      <nav
        aria-label="Điều hướng trang truyện"
        className="rounded-2xl bg-[#162032]/88 p-3.5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safePage <= 0}
            aria-label="Trang trước"
            className="inline-flex min-h-[42px] items-center gap-1 rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Trang trước</span>
          </button>

          <span className="text-xs font-semibold text-slate-200 tabular-nums whitespace-nowrap">
            Trang {safePage + 1} / {totalPages}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={safePage >= turns.length - 1}
            aria-label="Trang sau"
            className="inline-flex min-h-[42px] items-center gap-1 rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            <span>Trang sau</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </nav>

      {/* New Turn Composer */}
      <div className="space-y-3 rounded-2xl bg-[#162032]/90 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_14px_34px_-16px_rgba(2,8,23,0.72)] backdrop-blur-md">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor="newTurnInput"
              className="text-xs font-semibold text-slate-300"
            >
              Lượt gọi mới
            </label>
            <button
              type="button"
              aria-expanded={suggestionsOpen}
              onClick={() => setSuggestionsOpen((v) => !v)}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                suggestionsOpen
                  ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                  : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
              <span>Gợi ý</span>
              {suggestionsOpen && displayedSuggestions.length > 0 && (
                <span className="text-[10px] font-medium text-sky-200/90 tabular-nums">
                  ({displayedSuggestions.length})
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-150 ${
                  suggestionsOpen ? 'rotate-180 text-sky-300' : 'text-slate-400'
                }`}
              />
            </button>
          </div>

          {suggestionsOpen && (
            <div className="mb-2.5 space-y-2 rounded-xl bg-[#101828]/92 p-2.5 ring-1 ring-inset ring-sky-400/20">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="truncate font-medium text-slate-300">
                    {localSuggestionBundle.presentNames.length > 0
                      ? `Bám cảnh · ${localSuggestionBundle.presentNames.slice(0, 3).join(', ')}`
                      : 'Gợi ý theo cảnh hiện tại'}
                  </span>
                  {storyClockState.enabled && (
                    <span className="shrink-0 text-[10px] text-amber-200/85 tabular-nums">
                      · {formattedStoryClock.timeStr} ({formattedStoryClock.period})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    title="Đổi nhanh 6 gợi ý động (không tốn API)"
                    onClick={() => {
                      setLocalSuggestionVariant((v) => v + 1);
                      if (aiSuggestionMode === 'replace' && aiSuggestions.length > 0) {
                        setAiSuggestions([]);
                      }
                    }}
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.05] px-2 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Đổi nhanh</span>
                  </button>

                  <button
                    type="button"
                    title="Chọn chế độ khi bấm AI gợi ý: Nối thêm vào danh sách hoặc Thay thế danh sách"
                    onClick={() =>
                      setAiSuggestionMode((m) =>
                        m === 'append' ? 'replace' : 'append',
                      )
                    }
                    className="inline-flex min-h-[28px] items-center rounded-lg bg-white/[0.05] px-2 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
                  >
                    {aiSuggestionMode === 'append' ? 'Nối thêm' : 'Thay thế'}
                  </button>

                  {isGeneratingSuggestions ? (
                    <button
                      type="button"
                      onClick={onCancelAiSuggestions}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-rose-500/16 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/24 whitespace-nowrap"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Hủy AI</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleTriggerAiSuggestions()}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/26 active:scale-[0.98] whitespace-nowrap"
                    >
                      <Sparkles className="h-3 w-3 text-sky-300" />
                      <span>AI gợi ý</span>
                    </button>
                  )}
                </div>
              </div>

              {aiSuggestionError && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-500/12 px-2.5 py-1.5 text-[11px] text-rose-200 ring-1 ring-inset ring-rose-400/25">
                  <span className="leading-snug">{aiSuggestionError}</span>
                  {!hasProxyConfigured && (
                    <button
                      type="button"
                      onClick={() => onNavigate('config')}
                      className="shrink-0 rounded-md bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-100 hover:bg-rose-500/30"
                    >
                      Mở Cấu hình
                    </button>
                  )}
                </div>
              )}

              <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
                {displayedSuggestions.map((item) => {
                  const isPicked =
                    newTurnText.trim().length > 0 &&
                    newTurnText.trim() === item.text.trim();
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSuggestionCard(item.text)}
                      className={`group flex flex-col items-start gap-1 rounded-xl p-2.5 text-left ring-1 ring-inset transition-all active:scale-[0.99] ${
                        isPicked
                          ? 'bg-sky-500/16 ring-sky-400/45'
                          : 'bg-[#152033]/88 ring-white/[0.07] hover:bg-[#1a2840] hover:ring-sky-400/30'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                            SUGGESTION_CATEGORY_STYLES[item.category]
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.source === 'ai' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-300">
                            <Sparkles className="h-2.5 w-2.5" />
                            <span>AI</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-200 group-hover:text-white">
                        {item.text}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            ref={newTurnInputRef}
            id="newTurnInput"
            value={newTurnText}
            onChange={(e) => setNewTurnText(e.target.value)}
            placeholder="Nhập hành động hoặc lời thoại..."
            rows={3}
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        {pendingImage && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#0e1625]/90 p-2.5 ring-1 ring-inset ring-sky-400/24">
            <img
              src={pendingImage.dataUrl}
              alt="Ảnh đính kèm"
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/[0.12]"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-slate-200">
                  {pendingImage.name}
                </span>
                <button
                  type="button"
                  onClick={onClearPendingImage}
                  aria-label="Bỏ ảnh đính kèm"
                  className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-rose-500/14 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-colors hover:bg-rose-500/24 whitespace-nowrap shrink-0"
                >
                  <X className="h-3 w-3" />
                  <span>Bỏ ảnh</span>
                </button>
              </div>
              <input
                id="imageCaptionInput"
                type="text"
                aria-label="Chú thích ảnh đính kèm"
                value={imageCaption}
                onChange={(e) => onImageCaptionChange(e.target.value)}
                placeholder="Chú thích ngắn để NPC chú ý chi tiết ảnh (tùy chọn)..."
                className="w-full rounded-lg border border-white/[0.09] bg-[#152033]/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPickImage}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
            >
              <ImagePlus className="h-4 w-4 text-sky-300" />
              <span>Gửi ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => setImagePickerTarget({ mode: 'composer' })}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-sky-500/14 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/28 transition-all hover:bg-sky-500/22 active:scale-[0.98] whitespace-nowrap"
            >
              <ImageIcon className="h-4 w-4 text-sky-300" />
              <span>Chọn ảnh</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleSubmit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-6 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(14,165,233,0.5)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] disabled:opacity-45 whitespace-nowrap"
          >
            <Send className="h-4 w-4" />
            <span>Gửi</span>
          </button>
        </div>
      </div>

      {/* Quick Character Profile & Portrait Modal (opened by tapping any blue CharacterNameBadge) */}
      {quickCharacterInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Hồ sơ nhanh của ${quickCharacterInfo.displayName}`}
          onClick={() => setQuickCharacterName(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#090f1b]/74 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-3xl bg-[#172235]/96 ring-1 ring-blue-400/25 shadow-[0_24px_60px_-14px_rgba(2,6,23,0.85)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CharacterNameBadge
                  name={quickCharacterInfo.displayName}
                  variant="list"
                  isMc={quickCharacterInfo.isMc}
                />
                <span className="truncate text-xs text-slate-400">
                  {quickCharacterInfo.isMc ? 'NV chính' : 'NPC'} ·{' '}
                  {quickCharacterInfo.role}
                  {quickCharacterInfo.ageBirthLabel
                    ? ` · ${quickCharacterInfo.ageBirthLabel}`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                aria-label="Đóng hồ sơ nhanh"
                onClick={() => setQuickCharacterName(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70dvh] space-y-3 overflow-y-auto p-4">
              <div className="flex items-start gap-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0e1625] ring-1 ring-white/[0.10]">
                  {quickCharacterInfo.portrait?.imageData ? (
                    <button
                      type="button"
                      onClick={() => {
                        const img = quickCharacterInfo.portrait?.imageData;
                        if (img) {
                          setLightboxImage({
                            src: img,
                            label: quickCharacterInfo.displayName,
                          });
                        }
                      }}
                      className="group relative block h-full w-full focus:outline-none"
                      aria-label={`Phóng to ảnh ${quickCharacterInfo.displayName}`}
                    >
                      <img
                        src={quickCharacterInfo.portrait.imageData}
                        alt={quickCharacterInfo.displayName}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-black/65 p-0.5 text-slate-100 backdrop-blur-sm">
                        <Maximize2 className="h-3 w-3" />
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                      <User className="h-5 w-5 text-blue-300/80" />
                      <span className="text-[10px] font-medium">Chưa có ảnh</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                  {quickCharacterInfo.stateSnap ? (
                    <div className="space-y-1 rounded-xl bg-[#101829]/85 p-2.5 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                      <div className="font-semibold text-blue-200">
                        Trạng thái hiện tại
                      </div>
                      {quickCharacterInfo.stateSnap.location && (
                        <div>
                          <span className="text-slate-400">Vị trí: </span>
                          {quickCharacterInfo.stateSnap.location}
                        </div>
                      )}
                      {quickCharacterInfo.stateSnap.mood && (
                        <div>
                          <span className="text-slate-400">Tâm trạng: </span>
                          {quickCharacterInfo.stateSnap.mood}
                        </div>
                      )}
                      {quickCharacterInfo.stateSnap.status && (
                        <div>
                          <span className="text-slate-400">Mới nhất: </span>
                          {quickCharacterInfo.stateSnap.status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-slate-300">
                      {quickCharacterInfo.appearance ||
                        'Chưa có mô tả chi tiết cho nhân vật này trong thư viện.'}
                    </p>
                  )}
                </div>
              </div>

              {(quickCharacterInfo.ageBirthLabel ||
                quickCharacterInfo.fashionStyle ||
                quickCharacterInfo.personality ||
                (quickCharacterInfo.stateSnap && quickCharacterInfo.appearance) ||
                quickCharacterInfo.relationships ||
                quickCharacterInfo.signature) && (
                <div className="space-y-1.5 rounded-xl bg-[#101829]/85 p-3 text-xs leading-relaxed ring-1 ring-inset ring-white/[0.06]">
                  {quickCharacterInfo.ageBirthLabel && (
                    <div>
                      <span className="font-semibold text-cyan-300">
                        Tuổi tác &amp; ngày sinh:{' '}
                      </span>
                      <span className="tabular-nums text-slate-200">
                        {quickCharacterInfo.ageBirthLabel}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.fashionStyle && (
                    <div>
                      <span className="font-semibold text-violet-300">
                        Style ăn mặc:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.fashionStyle}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.personality && (
                    <div>
                      <span className="font-semibold text-sky-300">
                        Tính cách &amp; khí chất:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.personality}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.stateSnap &&
                    quickCharacterInfo.appearance && (
                      <div>
                        <span className="font-semibold text-indigo-300">
                          Ngoại hình:{' '}
                        </span>
                        <span className="text-slate-200">
                          {quickCharacterInfo.appearance}
                        </span>
                      </div>
                    )}
                  {quickCharacterInfo.relationships && (
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Quan hệ &amp; thái độ:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.relationships}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.signature && (
                    <div>
                      <span className="font-semibold text-amber-300">
                        Điểm nhấn:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.signature}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {quickCharacterInfo.isMc && cultivationProfile && (
                <div className="space-y-2 rounded-xl bg-emerald-500/[0.07] p-3 text-xs leading-relaxed ring-1 ring-inset ring-emerald-400/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-200">
                      <Swords className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span>
                        {CULTIVATION_SYSTEM_META[cultivationProfile.systemKind].label}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-amber-200">
                      {cultivationProfile.realmName} · {cultivationProfile.exp}/
                      {cultivationProfile.maxExp}
                    </span>
                  </div>
                  {cultivationProfile.techniques.length > 0 && (
                    <div className="space-y-1 text-[11px] text-slate-300">
                      {cultivationProfile.techniques.slice(0, 3).map((tech) => (
                        <div
                          key={tech.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate font-medium text-slate-100">
                            {tech.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-400">
                            {TECHNIQUE_TIER_META[tech.tier].label} · T{tech.level} ·{' '}
                            {tech.mastery}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-1.5 text-[11px] text-slate-400">
                    <span className="tabular-nums">
                      {cultivationProfile.bagName}:{' '}
                      {cultivationProfile.inventory.length} vật phẩm
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCharacterName(null);
                        setCultivationInitialTab('realm');
                        setActiveUtility('cultivation');
                      }}
                      className="font-semibold text-emerald-300 hover:text-emerald-200"
                    >
                      Mở Hồ sơ &amp; Túi đồ →
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {quickCharacterInfo.isMc && cultivationProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCharacterName(null);
                      setCultivationInitialTab('realm');
                      setActiveUtility('cultivation');
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/16 px-3.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24 whitespace-nowrap"
                  >
                    <Swords className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Tu luyện &amp; Túi đồ</span>
                  </button>
                )}
                {quickCharacterInfo.portrait && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = quickCharacterInfo.portrait?.id;
                      const pname = quickCharacterInfo.displayName;
                      setQuickCharacterName(null);
                      if (pid) {
                        setImagePickerTarget({
                          mode: 'character',
                          portraitId: pid,
                          portraitName: pname,
                        });
                      }
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/14 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/28 hover:bg-sky-500/22 whitespace-nowrap"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-sky-300" />
                    <span>Chọn ảnh</span>
                  </button>
                )}
                {quickCharacterInfo.portrait &&
                  hasSeedreamConfigured &&
                  !generatingPortraitIds.includes(
                    quickCharacterInfo.portrait.id,
                  ) && (
                    <button
                      type="button"
                      onClick={() => {
                        const pid = quickCharacterInfo.portrait?.id;
                        if (pid) onGeneratePortrait(pid);
                        setQuickCharacterName(null);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        {quickCharacterInfo.portrait.imageData
                          ? 'Vẽ lại ảnh'
                          : 'Tạo ảnh NV'}
                      </span>
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    setQuickCharacterName(null);
                    setActiveUtility('portraits');
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11] whitespace-nowrap"
                >
                  <Users className="h-3.5 w-3.5 text-blue-300" />
                  <span>Mở Thư viện Ảnh NV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightweight On-Demand Image Picker Modal */}
      {imagePickerTarget && (
        <ImagePickerModal
          target={imagePickerTarget}
          portraits={portraitBank?.portraits || []}
          turns={turns}
          currentPage={safePage}
          pendingImage={pendingImage}
          onClose={() => setImagePickerTarget(null)}
          onAttachToComposer={onSelectPendingImage}
          onAssignToCurrentTurn={(src, subjectLabel) => {
            if (safePage >= 0 && safePage < turns.length) {
              onUpdateTurn(safePage, {
                storyImageData: src,
                storyImageSubject: subjectLabel,
              });
              onNotify?.(`Đã gán ảnh "${subjectLabel}" cho Trang ${safePage + 1}.`);
            }
          }}
          onAssignToCharacter={(portraitId, src) => {
            const targetChar = (portraitBank?.portraits || []).find(
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
            onNotify?.(
              `Đã gán ảnh chân dung cho ${targetChar?.name || 'nhân vật'}.`,
            );
          }}
          onPickFromDevice={onPickImage}
        />
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh minh họa toàn màn hình"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#080d17]/86 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-[#162032]/96 ring-1 ring-white/[0.10] shadow-[0_24px_60px_-14px_rgba(2,6,23,0.88)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
              <span className="truncate text-xs font-semibold text-slate-100">
                {lightboxImage.label}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onDownloadImage(
                      lightboxImage.src,
                      `minh_hoa_trang_${safePage + 1}.png`,
                    )
                  }
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải ảnh</span>
                </button>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setLightboxImage(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-[#0b111e] p-3">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.label}
                referrerPolicy="no-referrer"
                className="max-h-[76dvh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
