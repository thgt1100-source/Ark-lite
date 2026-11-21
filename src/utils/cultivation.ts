import type {
  CultivationProfile,
  CultivationSystemKind,
  CultivationTechnique,
  InventoryItem,
  InventoryItemCategory,
  InventoryItemQuality,
  TechniqueCategory,
  TechniqueMove,
  TechniqueTier,
  WorldGenreId,
} from '../types/ark';
import { formatDeltaMinutesVi } from './storyClock';

export interface RealmStage {
  name: string;
  maxExp: number;
}

export const CULTIVATION_SYSTEM_META: Record<
  CultivationSystemKind,
  {
    label: string;
    shortLabel: string;
    energyLabel: string;
    bagName: string;
    techniqueSectionLabel: string;
    categoryLabels: Record<TechniqueCategory, string>;
    realms: RealmStage[];
  }
> = {
  xianxia: {
    label: 'Tiên Hiệp',
    shortLabel: 'Tu Tiên',
    energyLabel: 'Tu vi / Linh lực',
    bagName: 'Túi trữ vật',
    techniqueSectionLabel: 'Công pháp & Pháp thuật',
    categoryLabels: {
      mental: 'Tâm pháp / Công pháp',
      martial: 'Kiếm quyết / Pháp thuật',
      movement: 'Thân pháp / Độn thuật',
      secret: 'Bí thuật',
    },
    realms: [
      { name: 'Luyện Khí Tầng 1', maxExp: 100 },
      { name: 'Luyện Khí Tầng 2', maxExp: 120 },
      { name: 'Luyện Khí Tầng 4', maxExp: 180 },
      { name: 'Luyện Khí Tầng 7', maxExp: 280 },
      { name: 'Luyện Khí Đại Viên Mãn', maxExp: 420 },
      { name: 'Trúc Cơ Sơ Kỳ', maxExp: 650 },
      { name: 'Trúc Cơ Trung Kỳ', maxExp: 950 },
      { name: 'Trúc Cơ Hậu Kỳ', maxExp: 1350 },
      { name: 'Kim Đan Sơ Kỳ', maxExp: 2000 },
      { name: 'Kim Đan Hậu Kỳ', maxExp: 3000 },
      { name: 'Nguyên Anh Sơ Kỳ', maxExp: 4500 },
      { name: 'Nguyên Anh Đại Viên Mãn', maxExp: 6800 },
      { name: 'Hóa Thần Kỳ', maxExp: 10000 },
      { name: 'Đại Thừa Kỳ', maxExp: 15000 },
      { name: 'Độ Kiếp Kỳ', maxExp: 24000 },
    ],
  },
  xuanhuan: {
    label: 'Huyền Huyễn',
    shortLabel: 'Huyền Khí',
    energyLabel: 'Huyền khí / Hồn lực',
    bagName: 'Nhẫn không gian',
    techniqueSectionLabel: 'Huyền công & Chiến kỹ',
    categoryLabels: {
      mental: 'Huyền công / Tâm pháp',
      martial: 'Chiến kỹ / Võ kỹ',
      movement: 'Thân pháp',
      secret: 'Huyết mạch / Bí kỹ',
    },
    realms: [
      { name: 'Luyện Thể Cảnh', maxExp: 100 },
      { name: 'Ngưng Huyền Nhất Trọng', maxExp: 130 },
      { name: 'Ngưng Huyền Ngũ Trọng', maxExp: 210 },
      { name: 'Ngưng Huyền Cửu Trọng', maxExp: 340 },
      { name: 'Huyền Sư Sơ Kỳ', maxExp: 550 },
      { name: 'Huyền Sư Đỉnh Phong', maxExp: 850 },
      { name: 'Đại Huyền Sư', maxExp: 1300 },
      { name: 'Huyền Linh Cảnh', maxExp: 1950 },
      { name: 'Huyền Vương Cảnh', maxExp: 2900 },
      { name: 'Huyền Hoàng Cảnh', maxExp: 4300 },
      { name: 'Huyền Tông Cảnh', maxExp: 6400 },
      { name: 'Huyền Tôn Cảnh', maxExp: 9500 },
      { name: 'Huyền Thánh Cảnh', maxExp: 14500 },
      { name: 'Huyền Đế Cảnh', maxExp: 22000 },
    ],
  },
  wuxia: {
    label: 'Kiếm Hiệp',
    shortLabel: 'Võ Học',
    energyLabel: 'Nội lực / Chân khí',
    bagName: 'Hành trang giang hồ',
    techniqueSectionLabel: 'Nội công & Võ công',
    categoryLabels: {
      mental: 'Nội công tâm pháp',
      martial: 'Kiếm pháp / Võ công',
      movement: 'Khinh công / Thân pháp',
      secret: 'Tuyệt học / Ám khí',
    },
    realms: [
      { name: 'Nhập Môn (Tam Lưu)', maxExp: 100 },
      { name: 'Nhị Lưu Võ Giả', maxExp: 140 },
      { name: 'Nhất Lưu Cao Thủ', maxExp: 240 },
      { name: 'Hậu Thiên Sơ Kỳ', maxExp: 400 },
      { name: 'Hậu Thiên Trung Kỳ', maxExp: 650 },
      { name: 'Hậu Thiên Đại Viên Mãn', maxExp: 1000 },
      { name: 'Tiên Thiên Sơ Kỳ', maxExp: 1550 },
      { name: 'Tiên Thiên Hậu Kỳ', maxExp: 2400 },
      { name: 'Tông Sư Sơ Kỳ', maxExp: 3600 },
      { name: 'Đại Tông Sư', maxExp: 5500 },
      { name: 'Tuyệt Thế Cao Thủ', maxExp: 8500 },
      { name: 'Thiên Nhân Hợp Nhất', maxExp: 13500 },
    ],
  },
};

export const TECHNIQUE_TIER_META: Record<
  TechniqueTier,
  { label: string; textClass: string; speedMultiplier: number }
> = {
  pham: { label: 'Phàm giai', textClass: 'text-slate-300', speedMultiplier: 1.0 },
  linh: { label: 'Linh giai', textClass: 'text-emerald-300', speedMultiplier: 1.15 },
  huyen: { label: 'Huyền giai', textClass: 'text-sky-300', speedMultiplier: 1.3 },
  dia: { label: 'Địa giai', textClass: 'text-violet-300', speedMultiplier: 1.48 },
  thien: { label: 'Thiên giai', textClass: 'text-amber-300', speedMultiplier: 1.68 },
  chiton: { label: 'Chí tôn', textClass: 'text-rose-300', speedMultiplier: 1.9 },
};

export const INVENTORY_QUALITY_META: Record<
  InventoryItemQuality,
  { label: string; textClass: string }
> = {
  common: { label: 'Phàm phẩm', textClass: 'text-slate-300' },
  uncommon: { label: 'Linh phẩm', textClass: 'text-emerald-300' },
  rare: { label: 'Địa phẩm', textClass: 'text-sky-300' },
  epic: { label: 'Thiên phẩm', textClass: 'text-violet-300' },
  legendary: { label: 'Cực phẩm', textClass: 'text-amber-300' },
};

export const INVENTORY_CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  consumable: 'Đan dược / Tiêu hao',
  weapon: 'Binh khí / Pháp bảo',
  material: 'Linh thạch / Tài nguyên',
  talisman: 'Phù lục / Bí kíp',
  misc: 'Vật phẩm khác',
};

const NON_CULTIVATION_GENRES = new Set<WorldGenreId>([
  'slice_of_life',
  'showbiz',
  'urban',
  'apocalypse',
  'scifi',
  'fantasy',
]);

/**
 * Determines whether a world/character belongs to Tiên Hiệp, Huyền Huyễn, or Kiếm Hiệp.
 * Returns null for Modern / Slice of Life / Showbiz / Urban / Sci-Fi / Apocalypse / plain Fantasy
 * so those genres retain their lightweight UI untouched.
 */
export function detectCultivationSystemKind(input: {
  genre?: WorldGenreId;
  genreLabel?: string;
  worldName?: string;
  setting?: string;
  rules?: string;
  mcRole?: string;
  mcDesc?: string;
  openingScenario?: string;
  enableMartialSystem?: boolean;
}): CultivationSystemKind | null {
  if (input.genre === 'xianxia') return 'xianxia';
  if (input.genre === 'xuanhuan') return 'xuanhuan';
  if (input.enableMartialSystem) return 'wuxia';
  if (input.genre && NON_CULTIVATION_GENRES.has(input.genre)) {
    return null;
  }

  const combined = [
    input.genreLabel,
    input.worldName,
    input.setting,
    input.rules,
    input.mcRole,
    input.mcDesc,
    input.openingScenario,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!combined) return null;

  if (
    /\b(?:tiên hiệp|tien hiep|tu tiên|tu tien|tu chân|tu chan|luyện khí|trúc cơ|kim đan|nguyên anh|linh thạch|linh khí|tông môn|túi trữ vật)\b/i.test(
      combined,
    )
  ) {
    return 'xianxia';
  }
  if (
    /\b(?:huyền huyễn|huyen huyen|huyền khí|huyen khi|huyết mạch|huyet mach|chiến hồn|chien hon|hồn lực|dị thú thượng cổ|đấu khí|vũ hồn)\b/i.test(
      combined,
    )
  ) {
    return 'xuanhuan';
  }
  if (
    /\b(?:kiếm hiệp|kiem hiep|võ hiệp|vo hiep|võ lâm|vo lam|giang hồ|giang ho|nội công|noi cong|kiếm pháp|kiem phap|chân khí|chan khi|khinh công|khinh cong|tông sư|hậu thiên|tiên thiên|kiếm khách|du hiệp|minh chủ)\b/i.test(
      combined,
    )
  ) {
    return 'wuxia';
  }

  return null;
}

function inferStartingRealmIndex(
  kind: CultivationSystemKind,
  hintText: string,
): number {
  const text = (hintText || '').toLowerCase();
  const realms = CULTIVATION_SYSTEM_META[kind].realms;

  // Check if user explicitly mentions a known realm name in MC role/description
  for (let i = realms.length - 1; i >= 0; i--) {
    const rName = realms[i].name.toLowerCase();
    const shortKey = rName.replace(/\s+(?:sơ kỳ|trung kỳ|hậu kỳ|tầng \d+|nhất trọng|ngũ trọng|cửu trọng|đỉnh phong|đại viên mãn)$/i, '');
    if (text.includes(rName)) return i;
    if (shortKey.length >= 6 && text.includes(shortKey)) return i;
  }

  if (/\b(?:đại năng|cường giả|trưởng lão|tông chủ|đại tông sư|tuyệt thế)\b/i.test(text)) {
    return Math.min(realms.length - 3, Math.max(5, Math.floor(realms.length * 0.55)));
  }
  if (/\b(?:nội môn|cao thủ|thiên kiêu|hộ pháp|chân truyền)\b/i.test(text)) {
    return Math.min(realms.length - 1, 3);
  }
  // Authentic starter stage (index 1: Luyện Khí Tầng 2 / Ngưng Huyền Nhất Trọng / Nhị Lưu Võ Giả)
  return 1;
}

export function bumpMoveMastery(
  move: TechniqueMove,
  delta: number,
): { nextMove: TechniqueMove; leveledUp: boolean } {
  if (delta <= 0) return { nextMove: move, leveledUp: false };
  if (move.level >= move.maxLevel && move.mastery >= 100) {
    return { nextMove: move, leveledUp: false };
  }
  let nextLevel = move.level;
  let nextMastery = Math.max(0, move.mastery + Math.round(delta));
  while (nextMastery >= 100 && nextLevel < move.maxLevel) {
    nextMastery -= 100;
    nextLevel += 1;
  }
  if (nextLevel >= move.maxLevel && nextMastery > 100) {
    nextMastery = 100;
  }
  return {
    nextMove: {
      ...move,
      level: nextLevel,
      mastery: nextMastery,
    },
    leveledUp: nextLevel > move.level,
  };
}

/**
 * Generates 4–5 authentic starter moves (chiêu thức) tailored to a technique's name,
 * category, and genre (Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp).
 */
export function generateSuggestedMovesForTechnique(params: {
  name: string;
  category: TechniqueCategory;
  systemKind: CultivationSystemKind;
  baseSeed?: number;
}): TechniqueMove[] {
  const { name, category, systemKind } = params;
  const seed = params.baseSeed ?? Date.now();
  const lower = (name || '').toLowerCase();

  type MoveTemplate = { name: string; description: string; mastery: number };
  let templates: MoveTemplate[];

  if (category === 'movement') {
    if (systemKind === 'xianxia') {
      templates = [
        {
          name: 'Lăng Không Tức Bộ',
          description: 'Dồn linh khí dưới huyệt Dũng Tuyền, lướt ngang ba trượng né chiêu trong chớp mắt.',
          mastery: 32,
        },
        {
          name: 'Thanh Ảnh Phân Thân',
          description: 'Di chuyển đổi hướng gấp lưu lại tàn ảnh đánh lạc hướng tầm mắt đối thủ.',
          mastery: 22,
        },
        {
          name: 'Đạp Phong Thượng Vân',
          description: 'Mượn luồng linh phong bật cao lên không trung, chiếm ưu thế tầm nhìn.',
          mastery: 16,
        },
        {
          name: 'Súc Địa Tiểu Độn',
          description: 'Thu ngắn khoảng cách áp sát hoặc thoát khỏi vòng vây pháp trận trong một nhịp thở.',
          mastery: 10,
        },
      ];
    } else if (systemKind === 'xuanhuan') {
      templates = [
        {
          name: 'Tật Ảnh Đột Kích',
          description: 'Bộc phát huyền khí ở chân lao thẳng cự ly ngắn, tạo lợi thế ra đòn trước.',
          mastery: 34,
        },
        {
          name: 'Ảo Ảnh Chiết Bộ',
          description: 'Đổi góc di chuyển đột ngột theo hình chữ chi, tránh né công kích diện rộng.',
          mastery: 24,
        },
        {
          name: 'Quỷ Mị Nhiễu Hậu',
          description: 'Lượn vòng ra sau điểm mù đối thủ trong hỗn chiến để mở góc phản kích.',
          mastery: 16,
        },
        {
          name: 'Huyền Phong Toàn Thoái',
          description: 'Mượn phản lực va chạm bật lùi an toàn, giữ thăng bằng và khoảng cách.',
          mastery: 12,
        },
      ];
    } else {
      templates = [
        {
          name: 'Khinh Yên Điểm Thủy',
          description: 'Nhấc chân nhẹ tựa khói sương, lướt qua mặt đất trơn hoặc mặt nước không để lại dấu.',
          mastery: 36,
        },
        {
          name: 'Yến Tử Xuyên Liêm',
          description: 'Nghiêng thân luồn lách gọn qua khe hẹp và lưới đao kiếm đang khép lại.',
          mastery: 26,
        },
        {
          name: 'Đạp Tuyết Vô Thanh',
          description: 'Điều tức giấu tiếng bước chân, áp sát hoặc rút lui trong đêm tối không gây động tĩnh.',
          mastery: 18,
        },
        {
          name: 'Thê Vân Túng Nguyệt',
          description: 'Mượn lực mũi chân bật nối hai nhịp trên không vượt tường cao mái ngói.',
          mastery: 12,
        },
      ];
    }
  } else if (category === 'mental') {
    if (systemKind === 'xianxia') {
      templates = [
        {
          name: 'Dẫn Khí Quy Điền',
          description: 'Hấp thu thiên địa linh khí qua cửu khiếu, lắng lọc tạp chất rồi quy tụ về đan điền.',
          mastery: 38,
        },
        {
          name: 'Tiểu Chu Thiên Tuần Hoàn',
          description: 'Vận chuyển linh lực một vòng kinh mạch chính, ổn định tâm thần và hồi phục tiêu hao.',
          mastery: 28,
        },
        {
          name: 'Linh Quang Hộ Thể',
          description: 'Ngưng tụ lớp linh lực mỏng quanh thân giảm nhẹ lực chấn động và tà khí xâm nhập.',
          mastery: 20,
        },
        {
          name: 'Ngưng Thần Tụ Linh',
          description: 'Thu liễm khí tức, tập trung thần thức để đẩy nhanh hiệu suất bế quan đột phá.',
          mastery: 14,
        },
      ];
    } else if (systemKind === 'xuanhuan') {
      templates = [
        {
          name: 'Huyền Khí Thôn Nạp',
          description: 'Hút huyền khí thiên địa và năng lượng tinh thạch vào kinh mạch, tôi luyện khí hải.',
          mastery: 35,
        },
        {
          name: 'Nhiệt Huyết Phần Kinh',
          description: 'Kích phát huyền khí lưu chuyển tốc độ cao, tạm thời tăng cường sức mạnh cơ bắp.',
          mastery: 24,
        },
        {
          name: 'Huyền Cương Hộ Giáp',
          description: 'Kết thành tầng huyền cương ngoài da chống đỡ trảm kích và xung kích cận chiến.',
          mastery: 18,
        },
        {
          name: 'Quy Nguyên Điều Tức',
          description: 'Bình ổn khí huyết loạn động sau giao chiến, hồi phục nhanh thể lực và huyền khí.',
          mastery: 12,
        },
      ];
    } else {
      templates = [
        {
          name: 'Điều Tức Quy Nguyên',
          description: 'Hít thở chậm sâu dẫn chân khí quy về đan điền, hồi phục nội lực và xua tan mệt mỏi.',
          mastery: 40,
        },
        {
          name: 'Hộ Tâm Chân Khí',
          description: 'Vận nội kình bảo vệ tâm mạch và lục phủ ngũ tạng trước chưởng lực đối phương.',
          mastery: 28,
        },
        {
          name: 'Khí Quán Bách Mạch',
          description: 'Đưa nội lực chạy dọc hai tay và binh khí, gia tăng độ sắc bén và lực đạo chiêu thức.',
          mastery: 20,
        },
        {
          name: 'Tĩnh Tâm Minh Cảnh',
          description: 'Giữ tâm trí trong sáng như mặt gương, nhìn rõ sơ hở và nhịp thở của đối thủ.',
          mastery: 14,
        },
      ];
    }
  } else if (category === 'secret') {
    templates = [
      {
        name: 'Bí Ẩn Liễm Tức',
        description: 'Ẩn giấu dao động tu vi/khí tức, khiến kẻ cùng cảnh giới khó lòng dò xét.',
        mastery: 30,
      },
      {
        name: 'Nhiên Khí Bộc Phát',
        description: 'Đốt cháy một phần chân khí để bùng nổ tốc độ và uy lực trong khoảnh khắc quyết định.',
        mastery: 22,
      },
      {
        name: 'Thần Niệm Trấn Nhiếp',
        description: 'Phóng thích uy áp tinh thần làm chững lại nhịp ra đòn của đối thủ yếu tâm cảnh hơn.',
        mastery: 16,
      },
      {
        name: 'Nghịch Chuyển Khí Huyết',
        description: 'Ép thông kinh mạch bị phong bế hoặc hóa giải một phần độc tính, thương thế cấp bách.',
        mastery: 10,
      },
    ];
  } else {
    // Martial / Pháp thuật — tailor by weapon/element keywords in name
    if (/kiếm|kiem|sword/i.test(lower)) {
      templates =
        systemKind === 'wuxia'
          ? [
              {
                name: 'Thanh Phong Phất Liễu',
                description: 'Vẩy cổ tay đưa mũi kiếm gạt nhẹ ngang tầm ngực, hóa giải thế công rồi chuyển thủ thành công.',
                mastery: 36,
              },
              {
                name: 'Tật Phong Xuyên Tâm',
                description: 'Bước chéo dồn kình đâm thẳng tốc độ cao vào sơ hở trước ngực đối thủ.',
                mastery: 28,
              },
              {
                name: 'Tùng Phong Trảm Nguyệt',
                description: 'Chém chếch từ vai phải xuống tạo vòng cung sắc gọn, ép đối phương phải lùi bước.',
                mastery: 22,
              },
              {
                name: 'Hồi Phong Lạc Nhạn',
                description: 'Xoay thân thu kiếm rồi phản kích hai nhịp liên hoàn khi đối thủ áp sát.',
                mastery: 15,
              },
              {
                name: 'Vạn Phong Quy Nhất',
                description: 'Tuyệt chiêu hội tụ toàn bộ nội lực vào một đường kiếm thẳng, uy lực sắc bén nhất bộ.',
                mastery: 8,
              },
            ]
          : [
              {
                name: 'Thanh Phong Dẫn Kiếm',
                description: 'Mượn linh phong gia tốc đường kiếm đầu, mũi kiếm nhẹ nhưng kình gió sắc lạnh.',
                mastery: 34,
              },
              {
                name: 'Lưu Vân Phân Quang',
                description: 'Vung kiếm hóa thành ba đạo kiếm ảnh liên hoàn bao phủ góc né của đối thủ.',
                mastery: 26,
              },
              {
                name: 'Tật Phong Trảm Lãng',
                description: 'Ngưng tụ linh khí thành kiếm khí hình trăng khuyết phóng ra tầm trung.',
                mastery: 18,
              },
              {
                name: 'Toàn Phong Kiếm Thuẫn',
                description: 'Quay kiếm vẽ vòng tròn tạo luồng gió xoáy đánh bật ám khí và pháp thuật nhỏ.',
                mastery: 14,
              },
              {
                name: 'Ngự Phong Phá Vân',
                description: 'Dồn toàn lực ngự kiếm lao thẳng từ trên cao xuống, xuyên phá phòng ngự đối phương.',
                mastery: 8,
              },
            ];
    } else if (/đao|dao|trảm|tram/i.test(lower)) {
      templates = [
        {
          name: 'Hoành Đao Đoạn Thủy',
          description: 'Quét ngang thân đao nặng nề, dùng thế cương mãnh đẩy lùi binh khí đối thủ.',
          mastery: 34,
        },
        {
          name: 'Liệt Phong Phách Sơn',
          description: 'Bật bước chém bổ từ trên cao xuống với khí kình xé gió áp đảo.',
          mastery: 26,
        },
        {
          name: 'Hồi Mã Phản Trảm',
          description: 'Giả vờ thu thế rồi xoay hông chém ngược bất ngờ vào sườn kẻ truy kích.',
          mastery: 18,
        },
        {
          name: 'Cuồng Phong Liên Trảm',
          description: 'Xuất ba đao nối tiếp không ngừng nghỉ, đao sau nặng và nhanh hơn đao trước.',
          mastery: 14,
        },
        {
          name: 'Đoạn Không Nhất Trảm',
          description: 'Tụ toàn bộ khí lực vào sống đao tung một nhát chém dứt khoát phá tan phòng tuyến.',
          mastery: 8,
        },
      ];
    } else if (/quyền|quyen|chưởng|chuong|chỉ|chi|trảo|trao/i.test(lower)) {
      templates = [
        {
          name: 'Khai Sơn Chính Chưởng',
          description: 'Đẩy thẳng lòng bàn tay kèm ám kình trầm ổn, đánh văng đối thủ cận chiến.',
          mastery: 35,
        },
        {
          name: 'Liên Hoàn Phá Phong',
          description: 'Ra quyền chưởng hai tay liên tiếp tạo áp lực dày đặc khiến địch khó trở tay.',
          mastery: 26,
        },
        {
          name: 'Tá Lực Đả Lực',
          description: 'Thuận theo hướng kình của đối thủ xoay cổ tay hóa giải rồi phản chấn ngược lại.',
          mastery: 18,
        },
        {
          name: 'Toái Thạch Chấn Kình',
          description: 'Dồn lực từ eo và vai phát kình cự ly gần, xuyên qua lớp hộ thể thông thường.',
          mastery: 12,
        },
        {
          name: 'Kinh Lôi Nhất Kích',
          description: 'Chiêu thức áp trục dồn trọn chân khí vào một đòn dứt điểm đầy uy thế.',
          mastery: 8,
        },
      ];
    } else if (/thương|thuong|côn|con|kích|kich/i.test(lower)) {
      templates = [
        {
          name: 'Độc Long Xuất Hải',
          description: 'Đâm thẳng mũi thương như giao long lao tới, tốc độ nhanh và tầm đánh xa.',
          mastery: 34,
        },
        {
          name: 'Hoành Tảo Thiên Quân',
          description: 'Vung ngang thân binh khí quét rộng nửa vòng tròn, đẩy lùi nhiều kẻ áp sát.',
          mastery: 26,
        },
        {
          name: 'Hồi Toàn Phá Thế',
          description: 'Xoay cán đánh chệch đòn bổ từ trên xuống rồi trượt mũi đâm phản công.',
          mastery: 18,
        },
        {
          name: 'Bạo Vũ Lê Hoa',
          description: 'Rung cổ tay đâm liên tiếp tạo màn hoa thương che kín tầm nhìn đối phương.',
          mastery: 12,
        },
        {
          name: 'Phá Giáp Xuyên Vân',
          description: 'Xoắn kình dọc thân binh khí đâm một kích toàn lực xuyên phá giáp trụ.',
          mastery: 8,
        },
      ];
    } else if (/hỏa|hoa|viêm|viem|lôi|loi|băng|bang|hàn|han|phù|trận/i.test(lower)) {
      templates = [
        {
          name: 'Ngưng Nguyên Sơ Kích',
          description: 'Tụ linh lực nguyên tố thành mũi xung kích phóng nhanh ở cự ly trung bình.',
          mastery: 34,
        },
        {
          name: 'Nguyên Tố Liên Hoàn',
          description: 'Phát liên tiếp ba đạo pháp quyết khống chế góc di chuyển của mục tiêu.',
          mastery: 24,
        },
        {
          name: 'Hộ Nguyên Kết Giới',
          description: 'Dựng màn chắn năng lượng trước mặt triệt tiêu một phần sát thương pháp thuật.',
          mastery: 18,
        },
        {
          name: 'Bạo Tán Chấn Ba',
          description: 'Kích nổ luồng năng lượng xung quanh thân đẩy lùi kẻ địch đang áp sát.',
          mastery: 12,
        },
        {
          name: 'Thiên Địa Phần Nguyên',
          description: 'Tụ lực toàn thân giáng xuống đòn nguyên tố cực mạnh mang uy áp áp đảo.',
          mastery: 6,
        },
      ];
    } else {
      templates = [
        {
          name: 'Khởi Thủ Thám Lộ',
          description: 'Chiêu mở đầu gọn gàng thăm dò phản ứng và khoảng cách của đối phương.',
          mastery: 34,
        },
        {
          name: 'Liên Kích Phá Phòng',
          description: 'Hai nhịp tiến công nối tiếp sắc bén nhằm phá vỡ thế thủ cân bằng.',
          mastery: 26,
        },
        {
          name: 'Hóa Kình Phản Chế',
          description: 'Nương theo lực đánh tới để gạt lệch rồi tung đòn phản kích chớp nhoáng.',
          mastery: 18,
        },
        {
          name: 'Tụ Khí Trọng Kích',
          description: 'Dồn chân khí vào một đòn đánh nặng tay gây chấn động mạnh lên mục tiêu.',
          mastery: 12,
        },
        {
          name: 'Tuyệt Thức Quy Nhất',
          description: 'Chiêu cuối hội tụ tinh hoa toàn bộ bí kíp, tung ra trong thời khắc định đoạt.',
          mastery: 8,
        },
      ];
    }
  }

  return templates.map((tpl, idx) => ({
    id: `mv_${seed}_${idx + 1}_${Math.random().toString(36).slice(2, 5)}`,
    name: tpl.name,
    description: tpl.description,
    level: 1,
    maxLevel: 5,
    mastery: tpl.mastery,
  }));
}

export function createStarterCultivationProfile(
  kind: CultivationSystemKind,
  hints?: {
    mcRole?: string;
    mcDesc?: string;
    worldName?: string;
  },
): CultivationProfile {
  const meta = CULTIVATION_SYSTEM_META[kind];
  const hintText = [hints?.mcRole, hints?.mcDesc, hints?.worldName]
    .filter(Boolean)
    .join(' ');
  const realmIndex = inferStartingRealmIndex(kind, hintText);
  const stage = meta.realms[realmIndex] || meta.realms[0];
  const initialExp = Math.round(stage.maxExp * 0.22);
  const now = Date.now();

  if (kind === 'xianxia') {
    return {
      enabled: true,
      systemKind: 'xianxia',
      realmIndex,
      realmName: stage.name,
      energyLabel: meta.energyLabel,
      exp: initialExp,
      maxExp: stage.maxExp,
      readyToBreakthrough: false,
      autoProgressByClock: true,
      bagName: meta.bagName,
      techniques: [
        {
          id: `tech_${now}_1`,
          name: 'Thanh Vân Dẫn Khí Quyết',
          category: 'mental',
          tier: 'linh',
          level: 2,
          maxLevel: 9,
          mastery: 35,
          isActiveTraining: true,
          description: 'Tâm pháp dẫn linh khí nhập thể, ôn hòa ổn định, tăng tốc độ tích tụ tu vi.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Thanh Vân Dẫn Khí Quyết',
            category: 'mental',
            systemKind: 'xianxia',
            baseSeed: now + 10,
          }),
        },
        {
          id: `tech_${now}_2`,
          name: 'Ngự Phong Kiếm Quyết',
          category: 'martial',
          tier: 'pham',
          level: 1,
          maxLevel: 9,
          mastery: 22,
          isActiveTraining: false,
          description: 'Kiếm quyết cơ bản của tông môn, xuất kiếm nhanh nhẹ theo luồng linh phong.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Ngự Phong Kiếm Quyết',
            category: 'martial',
            systemKind: 'xianxia',
            baseSeed: now + 20,
          }),
        },
        {
          id: `tech_${now}_3`,
          name: 'Linh Bộ Thân Pháp',
          category: 'movement',
          tier: 'pham',
          level: 1,
          maxLevel: 6,
          mastery: 18,
          isActiveTraining: false,
          description: 'Vận linh khí dưới lòng bàn chân để né tránh và di chuyển nhanh gọn.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Linh Bộ Thân Pháp',
            category: 'movement',
            systemKind: 'xianxia',
            baseSeed: now + 30,
          }),
        },
      ],
      inventory: [
        {
          id: `inv_${now}_1`,
          name: 'Hạ phẩm Linh thạch',
          quantity: 12,
          quality: 'uncommon',
          category: 'material',
          description: 'Linh thạch giao dịch phổ biến tại phường thị, có thể hấp thu phụ trợ tu luyện.',
        },
        {
          id: `inv_${now}_2`,
          name: 'Tụ Khí Đan',
          quantity: 3,
          quality: 'uncommon',
          category: 'consumable',
          description: 'Đan dược nhập môn giúp hội tụ linh khí, đẩy nhanh tốc độ tăng tu vi.',
        },
        {
          id: `inv_${now}_3`,
          name: 'Thanh Cương Linh Kiếm',
          quantity: 1,
          quality: 'common',
          category: 'weapon',
          description: 'Phi kiếm pháp khí sơ giai, dẫn linh khí ổn định.',
        },
        {
          id: `inv_${now}_4`,
          name: 'Hồi Xuân Phù',
          quantity: 2,
          quality: 'common',
          category: 'talisman',
          description: 'Phù lục trị thương nhanh cho vết thương ngoài da và hao tổn thể lực.',
        },
      ],
      lastUpdatedAt: now,
    };
  }

  if (kind === 'xuanhuan') {
    return {
      enabled: true,
      systemKind: 'xuanhuan',
      realmIndex,
      realmName: stage.name,
      energyLabel: meta.energyLabel,
      exp: initialExp,
      maxExp: stage.maxExp,
      readyToBreakthrough: false,
      autoProgressByClock: true,
      bagName: meta.bagName,
      techniques: [
        {
          id: `tech_${now}_1`,
          name: 'Huyền Viêm Quyết',
          category: 'mental',
          tier: 'linh',
          level: 1,
          maxLevel: 9,
          mastery: 30,
          isActiveTraining: true,
          description: 'Huyền công tôi luyện huyền khí thuần hậu mang hơi ấm liệt diễm.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Huyền Viêm Quyết',
            category: 'mental',
            systemKind: 'xuanhuan',
            baseSeed: now + 40,
          }),
        },
        {
          id: `tech_${now}_2`,
          name: 'Liệt Phong Trảm',
          category: 'martial',
          tier: 'pham',
          level: 1,
          maxLevel: 9,
          mastery: 25,
          isActiveTraining: false,
          description: 'Chiến kỹ dồn huyền khí vào lưỡi binh khí tung ra trảm kích xé gió.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Liệt Phong Trảm',
            category: 'martial',
            systemKind: 'xuanhuan',
            baseSeed: now + 50,
          }),
        },
        {
          id: `tech_${now}_3`,
          name: 'Tật Ảnh Bộ',
          category: 'movement',
          tier: 'pham',
          level: 1,
          maxLevel: 6,
          mastery: 20,
          isActiveTraining: false,
          description: 'Thân pháp bộc phát cự ly ngắn, phù hợp áp sát hoặc rút lui trong hỗn chiến.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Tật Ảnh Bộ',
            category: 'movement',
            systemKind: 'xuanhuan',
            baseSeed: now + 60,
          }),
        },
      ],
      inventory: [
        {
          id: `inv_${now}_1`,
          name: 'Huyền Tinh cấp 1',
          quantity: 8,
          quality: 'uncommon',
          category: 'material',
          description: 'Tinh thể tích tụ huyền khí, dùng trao đổi hoặc hấp thu trực tiếp.',
        },
        {
          id: `inv_${now}_2`,
          name: 'Hồi Huyền Đan',
          quantity: 3,
          quality: 'uncommon',
          category: 'consumable',
          description: 'Đan dược hồi phục nhanh huyền khí và ổn định kinh mạch sau chiến đấu.',
        },
        {
          id: `inv_${now}_3`,
          name: 'Hắc Thiết Chiến Đao',
          quantity: 1,
          quality: 'common',
          category: 'weapon',
          description: 'Chiến đao rèn từ hắc thiết tinh luyện, dẫn truyền huyền khí tốt.',
        },
        {
          id: `inv_${now}_4`,
          name: 'Tinh Hạch Dị Thú (Sơ cấp)',
          quantity: 1,
          quality: 'uncommon',
          category: 'material',
          description: 'Tinh hạch lấy từ dị thú ngoại vi, chứa năng lượng huyết mạch thô.',
        },
      ],
      lastUpdatedAt: now,
    };
  }

  // Wuxia (Kiếm Hiệp)
  return {
    enabled: true,
    systemKind: 'wuxia',
    realmIndex,
    realmName: stage.name,
    energyLabel: meta.energyLabel,
    exp: initialExp,
    maxExp: stage.maxExp,
    readyToBreakthrough: false,
    autoProgressByClock: true,
    bagName: meta.bagName,
    techniques: [
      {
        id: `tech_${now}_1`,
        name: 'Thái Thanh Nội Công Tâm Pháp',
        category: 'mental',
        tier: 'linh',
        level: 2,
        maxLevel: 9,
        mastery: 38,
        isActiveTraining: true,
        description: 'Nội công chính phái dưỡng khí điều tức, chân khí tinh thuần bền bỉ.',
        moves: generateSuggestedMovesForTechnique({
          name: 'Thái Thanh Nội Công Tâm Pháp',
          category: 'mental',
          systemKind: 'wuxia',
          baseSeed: now + 70,
        }),
      },
      {
        id: `tech_${now}_2`,
        name: 'Thanh Phong Thập Tam Kiếm',
        category: 'martial',
        tier: 'pham',
        level: 2,
        maxLevel: 9,
        mastery: 30,
        isActiveTraining: false,
        description: 'Mười ba thức kiếm pháp linh hoạt, chiêu thức liền mạch như gió thoảng.',
        moves: generateSuggestedMovesForTechnique({
          name: 'Thanh Phong Thập Tam Kiếm',
          category: 'martial',
          systemKind: 'wuxia',
          baseSeed: now + 80,
        }),
      },
      {
        id: `tech_${now}_3`,
        name: 'Đạp Tuyết Vô Ngân',
        category: 'movement',
        tier: 'pham',
        level: 1,
        maxLevel: 7,
        mastery: 22,
        isActiveTraining: false,
        description: 'Khinh công nhẹ nhàng, mượn lực mũi chân vượt mái ngói và địa hình hiểm.',
        moves: generateSuggestedMovesForTechnique({
          name: 'Đạp Tuyết Vô Ngân',
          category: 'movement',
          systemKind: 'wuxia',
          baseSeed: now + 90,
        }),
      },
    ],
    inventory: [
      {
        id: `inv_${now}_1`,
        name: 'Bạc vụn',
        quantity: 25,
        quality: 'common',
        category: 'misc',
        description: 'Lộ phí ăn nghỉ tại khách điếm và mua sắm vật dụng hành tẩu giang hồ.',
      },
      {
        id: `inv_${now}_2`,
        name: 'Kim Sang Dược',
        quantity: 3,
        quality: 'common',
        category: 'consumable',
        description: 'Thuốc bột cầm máu và trị vết đao kiếm ngoại thương hiệu quả.',
      },
      {
        id: `inv_${now}_3`,
        name: 'Thanh Phong Trường Kiếm',
        quantity: 1,
        quality: 'uncommon',
        category: 'weapon',
        description: 'Trường kiếm rèn tinh xảo, thân kiếm cân bằng, thuận tay xuất chiêu nhanh.',
      },
      {
        id: `inv_${now}_4`,
        name: 'Hồi Khí Hoàn',
        quantity: 2,
        quality: 'uncommon',
        category: 'consumable',
        description: 'Đan hoàn bổ sung chân khí và giảm mỏi mệt sau cuộc giao thủ dài.',
      },
    ],
    lastUpdatedAt: now,
  };
}

const VALID_SYSTEM_KINDS = new Set<CultivationSystemKind>([
  'xianxia',
  'xuanhuan',
  'wuxia',
]);
const VALID_TECH_CATEGORIES = new Set<TechniqueCategory>([
  'mental',
  'martial',
  'movement',
  'secret',
]);
const VALID_TECH_TIERS = new Set<TechniqueTier>([
  'pham',
  'linh',
  'huyen',
  'dia',
  'thien',
  'chiton',
]);
const VALID_INV_QUALITIES = new Set<InventoryItemQuality>([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]);
const VALID_INV_CATEGORIES = new Set<InventoryItemCategory>([
  'consumable',
  'weapon',
  'material',
  'talisman',
  'misc',
]);

export function normalizeCultivationProfile(
  raw: unknown,
): CultivationProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const systemKind: CultivationSystemKind = VALID_SYSTEM_KINDS.has(
    r.systemKind as CultivationSystemKind,
  )
    ? (r.systemKind as CultivationSystemKind)
    : 'xianxia';
  const meta = CULTIVATION_SYSTEM_META[systemKind];
  const realmIndex =
    typeof r.realmIndex === 'number' && Number.isFinite(r.realmIndex)
      ? Math.max(0, Math.min(meta.realms.length - 1, Math.trunc(r.realmIndex)))
      : 0;
  const fallbackStage = meta.realms[realmIndex] || meta.realms[0];
  const maxExp =
    typeof r.maxExp === 'number' && Number.isFinite(r.maxExp) && r.maxExp > 0
      ? Math.round(r.maxExp)
      : fallbackStage.maxExp;
  const exp =
    typeof r.exp === 'number' && Number.isFinite(r.exp) && r.exp >= 0
      ? Math.round(r.exp)
      : 0;

  const techniques: CultivationTechnique[] = Array.isArray(r.techniques)
    ? r.techniques
        .filter((t) => t && typeof t === 'object')
        .map((t, idx) => {
          const item = t as Record<string, unknown>;
          const maxLevel =
            typeof item.maxLevel === 'number' &&
            Number.isFinite(item.maxLevel) &&
            item.maxLevel >= 1
              ? Math.min(99, Math.trunc(item.maxLevel))
              : 9;
          const level =
            typeof item.level === 'number' && Number.isFinite(item.level)
              ? Math.max(1, Math.min(maxLevel, Math.trunc(item.level)))
              : 1;
          const mastery =
            typeof item.mastery === 'number' && Number.isFinite(item.mastery)
              ? Math.max(0, Math.min(100, Math.round(item.mastery)))
              : 0;
          const moves: TechniqueMove[] | undefined = Array.isArray(item.moves)
            ? item.moves
                .filter((mv) => mv && typeof mv === 'object')
                .map((mv, mvIdx) => {
                  const mRec = mv as Record<string, unknown>;
                  const mvMaxLv =
                    typeof mRec.maxLevel === 'number' &&
                    Number.isFinite(mRec.maxLevel) &&
                    mRec.maxLevel >= 1
                      ? Math.min(20, Math.trunc(mRec.maxLevel))
                      : 5;
                  const mvLv =
                    typeof mRec.level === 'number' && Number.isFinite(mRec.level)
                      ? Math.max(1, Math.min(mvMaxLv, Math.trunc(mRec.level)))
                      : 1;
                  const mvMastery =
                    typeof mRec.mastery === 'number' &&
                    Number.isFinite(mRec.mastery)
                      ? Math.max(0, Math.min(100, Math.round(mRec.mastery)))
                      : 0;
                  return {
                    id:
                      typeof mRec.id === 'string' && mRec.id
                        ? mRec.id
                        : `mv_${Date.now()}_${idx}_${mvIdx}`,
                    name: String(mRec.name || '').trim(),
                    level: mvLv,
                    maxLevel: mvMaxLv,
                    mastery: mvMastery,
                    ...(typeof mRec.description === 'string' &&
                    mRec.description.trim()
                      ? { description: mRec.description.trim() }
                      : {}),
                  };
                })
                .filter((mv) => mv.name)
            : undefined;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `tech_${Date.now()}_${idx}`,
            name: String(item.name || 'Công pháp').trim(),
            category: VALID_TECH_CATEGORIES.has(
              item.category as TechniqueCategory,
            )
              ? (item.category as TechniqueCategory)
              : 'martial',
            tier: VALID_TECH_TIERS.has(item.tier as TechniqueTier)
              ? (item.tier as TechniqueTier)
              : 'pham',
            level,
            maxLevel,
            mastery,
            isActiveTraining: Boolean(item.isActiveTraining),
            ...(typeof item.description === 'string' && item.description.trim()
              ? { description: item.description.trim() }
              : {}),
            ...(moves && moves.length > 0 ? { moves } : {}),
          };
        })
        .filter((t) => t.name)
    : [];

  const inventory: InventoryItem[] = Array.isArray(r.inventory)
    ? r.inventory
        .filter((i) => i && typeof i === 'object')
        .map((i, idx) => {
          const item = i as Record<string, unknown>;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `inv_${Date.now()}_${idx}`,
            name: String(item.name || 'Vật phẩm').trim(),
            quantity:
              typeof item.quantity === 'number' &&
              Number.isFinite(item.quantity)
                ? Math.max(1, Math.trunc(item.quantity))
                : 1,
            quality: VALID_INV_QUALITIES.has(
              item.quality as InventoryItemQuality,
            )
              ? (item.quality as InventoryItemQuality)
              : 'common',
            category: VALID_INV_CATEGORIES.has(
              item.category as InventoryItemCategory,
            )
              ? (item.category as InventoryItemCategory)
              : 'misc',
            ...(typeof item.description === 'string' && item.description.trim()
              ? { description: item.description.trim() }
              : {}),
          };
        })
        .filter((i) => i.name)
    : [];

  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    systemKind,
    realmIndex,
    realmName:
      typeof r.realmName === 'string' && r.realmName.trim()
        ? r.realmName.trim()
        : fallbackStage.name,
    energyLabel:
      typeof r.energyLabel === 'string' && r.energyLabel.trim()
        ? r.energyLabel.trim()
        : meta.energyLabel,
    exp,
    maxExp,
    readyToBreakthrough:
      typeof r.readyToBreakthrough === 'boolean'
        ? r.readyToBreakthrough || exp >= maxExp
        : exp >= maxExp,
    autoProgressByClock:
      typeof r.autoProgressByClock === 'boolean' ? r.autoProgressByClock : true,
    bagName:
      typeof r.bagName === 'string' && r.bagName.trim()
        ? r.bagName.trim()
        : meta.bagName,
    techniques,
    inventory,
    ...(typeof r.lastGainSummary === 'string' && r.lastGainSummary.trim()
      ? { lastGainSummary: r.lastGainSummary.trim() }
      : {}),
    ...(typeof r.lastUpdatedAt === 'number' && Number.isFinite(r.lastUpdatedAt)
      ? { lastUpdatedAt: r.lastUpdatedAt }
      : {}),
  };
}

export function getNextRealmStage(profile: CultivationProfile): RealmStage | null {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  if (profile.realmIndex + 1 < realms.length) {
    return realms[profile.realmIndex + 1];
  }
  return null;
}

/**
 * Automatically advances Realm EXP & Technique Mastery when Story Clock moves forward.
 * Supports continuous minutes/hours, overnight rest, multi-day time skips, and meditation/combat context.
 */
export function applyClockDeltaToCultivation(
  profile: CultivationProfile | undefined,
  deltaMinutes: number,
  options?: {
    sceneText?: string;
    reason?: string;
    forceActiveTraining?: boolean;
  },
): {
  nextProfile: CultivationProfile | undefined;
  expGained: number;
  leveledTechniques: string[];
  leveledMoves: string[];
  becameReadyToBreakthrough: boolean;
} {
  if (
    !profile ||
    !profile.enabled ||
    (!options?.forceActiveTraining && !profile.autoProgressByClock) ||
    !Number.isFinite(deltaMinutes) ||
    deltaMinutes <= 0
  ) {
    return {
      nextProfile: profile,
      expGained: 0,
      leveledTechniques: [],
      leveledMoves: [],
      becameReadyToBreakthrough: false,
    };
  }

  const mins = Math.max(1, Math.round(deltaMinutes));
  const sceneLower = (options?.sceneText || '').toLowerCase();

  // Detect active cultivation / martial training / combat context in the turn
  const isMeditating =
    Boolean(options?.forceActiveTraining) ||
    /(?:tu luyện|bế quan|đả tọa|vận công|hấp thu linh khí|tụ khí|thiền định|điều tức|luyện khí|luyện công|ngồi thiền)/i.test(
      sceneLower,
    );
  const isPracticingCombat =
    Boolean(options?.forceActiveTraining) ||
    /(?:luyện kiếm|luyện võ|diễn võ|giao thủ|tỷ thí|chiến đấu|xuất chiêu|đấu pháp|đánh nhau|chém|đâm|né tránh|khinh công|thân pháp)/i.test(
      sceneLower,
    );

  // Smooth diminishing-returns curve for effective training hours
  // 15m -> ~0.25h; 1h -> 1h; 8h -> ~5.8h; 24h -> ~12h; 7d -> ~34h; 30d -> ~65h
  const rawHours = mins / 60;
  const effectiveHours =
    rawHours <= 2
      ? rawHours
      : 2 + Math.pow(rawHours - 2, 0.68) * 1.45;

  // Active mental/primary technique multiplier
  const activeTechniques = profile.techniques.filter((t) => t.isActiveTraining);
  const bestActiveTierMult = activeTechniques.reduce((best, t) => {
    const mult = TECHNIQUE_TIER_META[t.tier]?.speedMultiplier || 1;
    return Math.max(best, mult);
  }, 1.0);

  const contextExpMult = options?.forceActiveTraining
    ? 2.0
    : isMeditating
      ? 1.85
      : isPracticingCombat
        ? 1.35
        : 1.0;
  // Scale modestly with maxExp so higher realms don't feel stuck forever while staying meaningful
  const realmPaceFactor = Math.max(1, Math.pow(profile.maxExp / 120, 0.52));
  const rawExpGain =
    effectiveHours * 8.5 * bestActiveTierMult * contextExpMult * realmPaceFactor;
  const expGained = Math.max(
    mins >= 5 ? 1 : 0,
    Math.min(Math.round(profile.maxExp * 0.95), Math.round(rawExpGain)),
  );

  // Cap overflow EXP at 135% of maxExp so the player hits "Sẵn sàng đột phá" cleanly
  const expCap = Math.round(profile.maxExp * 1.35);
  const nextExp = Math.min(expCap, profile.exp + expGained);
  const wasReady = profile.readyToBreakthrough || profile.exp >= profile.maxExp;
  const nextReady = nextExp >= profile.maxExp;
  const becameReadyToBreakthrough = !wasReady && nextReady;

  const leveledTechniques: string[] = [];
  const leveledMoves: string[] = [];
  const masteryHighlights: string[] = [];

  // Fallback: if no technique is marked isActiveTraining, passively grow the first mental technique (or first technique)
  const fallbackActiveId =
    activeTechniques.length === 0
      ? (
          profile.techniques.find((t) => t.category === 'mental') ||
          profile.techniques[0]
        )?.id
      : undefined;

  const nextTechniques = profile.techniques.map((tech) => {
    const nameLower = tech.name.toLowerCase();
    const mentionedInScene =
      nameLower.length >= 3 && sceneLower.includes(nameLower);
    const anyMoveMentioned = Boolean(
      tech.moves?.some(
        (mv) => mv.name.length >= 3 && sceneLower.includes(mv.name.toLowerCase()),
      ),
    );
    const isPrimary = tech.isActiveTraining || tech.id === fallbackActiveId;
    const categoryBoost =
      (isMeditating && tech.category === 'mental') ||
      (isPracticingCombat &&
        (tech.category === 'martial' || tech.category === 'movement')) ||
      mentionedInScene ||
      anyMoveMentioned;

    // Determine whether this technique earns mastery on this time tick
    if (!isPrimary && !categoryBoost && mins < 60) {
      return tech;
    }

    let gainBase = 0;
    if (isPrimary) {
      gainBase += effectiveHours * (isMeditating ? 5.6 : 3.0);
    }
    if (mentionedInScene || anyMoveMentioned) {
      gainBase += Math.max(3, effectiveHours * 3.6);
    } else if (categoryBoost) {
      gainBase += effectiveHours * 2.2;
    } else if (mins >= 240) {
      // Long time skips gently nurture non-active techniques slightly too
      gainBase += effectiveHours * 0.65;
    }

    const masteryGain = Math.max(
      isPrimary && mins >= 10 ? 1 : 0,
      Math.min(55, Math.round(gainBase)),
    );
    if (masteryGain <= 0) return tech;

    // Advance sub-moves (chiêu thức) inside this technique
    let nextMoves = tech.moves;
    if (tech.moves && tech.moves.length > 0) {
      nextMoves = tech.moves.map((mv, mvIdx) => {
        const mvMentioned =
          mv.name.length >= 3 && sceneLower.includes(mv.name.toLowerCase());
        // Moves in active training or practiced combat progress smoothly; specifically invoked moves surge
        if (!isPrimary && !mvMentioned && !categoryBoost && mins < 180) {
          return mv;
        }
        const positionWeight = mvIdx === 0 ? 1.15 : mvIdx === 1 ? 1.0 : 0.85;
        let mvGain = Math.round(masteryGain * 0.9 * positionWeight);
        if (mvMentioned) {
          mvGain += Math.max(5, Math.round(effectiveHours * 4));
        }
        if (mvGain <= 0 && (isPrimary || mvMentioned)) {
          mvGain = 1;
        }
        if (mvGain <= 0) return mv;

        const { nextMove, leveledUp } = bumpMoveMastery(mv, Math.min(60, mvGain));
        if (leveledUp) {
          leveledMoves.push(`${mv.name} (Cấp ${nextMove.level})`);
        }
        return nextMove;
      });
    }

    if (tech.level >= tech.maxLevel && tech.mastery >= 100) {
      return nextMoves !== tech.moves ? { ...tech, moves: nextMoves } : tech;
    }

    let nextLevel = tech.level;
    let nextMastery = tech.mastery + masteryGain;
    while (nextMastery >= 100 && nextLevel < tech.maxLevel) {
      nextMastery -= 100;
      nextLevel += 1;
    }
    if (nextLevel >= tech.maxLevel && nextMastery > 100) {
      nextMastery = 100;
    }

    if (nextLevel > tech.level) {
      leveledTechniques.push(`${tech.name} (Tầng ${nextLevel})`);
    } else if (masteryHighlights.length < 2) {
      masteryHighlights.push(`+${masteryGain}% ${tech.name}`);
    }

    return {
      ...tech,
      level: nextLevel,
      mastery: nextMastery,
      ...(nextMoves ? { moves: nextMoves } : {}),
    };
  });

  const summaryParts: string[] = [];
  if (expGained > 0) {
    summaryParts.push(`+${expGained} ${profile.energyLabel.split('/')[0].trim()}`);
  }
  if (leveledTechniques.length > 0) {
    summaryParts.push(`Thăng tầng: ${leveledTechniques.join(', ')}`);
  } else if (masteryHighlights.length > 0) {
    summaryParts.push(masteryHighlights.join(' · '));
  }
  if (leveledMoves.length > 0) {
    summaryParts.push(`Chiêu thức tiến cảnh: ${leveledMoves.slice(0, 2).join(', ')}`);
  }
  if (becameReadyToBreakthrough) {
    summaryParts.push('Đã đủ điều kiện đột phá!');
  }
  const timeTag = formatDeltaMinutesVi(mins);
  const lastGainSummary =
    summaryParts.length > 0
      ? `${summaryParts.join(' · ')} (${timeTag})`
      : profile.lastGainSummary;

  return {
    nextProfile: {
      ...profile,
      exp: nextExp,
      readyToBreakthrough: nextReady,
      techniques: nextTechniques,
      lastGainSummary,
      lastUpdatedAt: Date.now(),
    },
    expGained,
    leveledTechniques,
    leveledMoves,
    becameReadyToBreakthrough,
  };
}

export function performBreakthrough(
  profile: CultivationProfile,
): {
  nextProfile: CultivationProfile;
  nextRealmName: string;
  isMaxRealm: boolean;
} {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const nextIndex = Math.min(realms.length - 1, profile.realmIndex + 1);
  const isMaxRealm = nextIndex === profile.realmIndex;
  const nextStage = realms[nextIndex] || {
    name: `${profile.realmName} (Viên Mãn)`,
    maxExp: Math.round(profile.maxExp * 1.5),
  };

  if (isMaxRealm) {
    const nextMaxExp = Math.round(profile.maxExp * 1.5);
    const carryExp = Math.max(0, Math.round((profile.exp - profile.maxExp) * 0.5));
    return {
      nextProfile: {
        ...profile,
        exp: carryExp,
        maxExp: nextMaxExp,
        readyToBreakthrough: carryExp >= nextMaxExp,
        lastGainSummary: `Củng cố cảnh giới đỉnh phong ${profile.realmName}!`,
        lastUpdatedAt: Date.now(),
      },
      nextRealmName: profile.realmName,
      isMaxRealm: true,
    };
  }

  const overflow = Math.max(0, profile.exp - profile.maxExp);
  const carryExp = Math.min(
    Math.round(nextStage.maxExp * 0.4),
    Math.round(overflow * 0.5),
  );

  return {
    nextProfile: {
      ...profile,
      realmIndex: nextIndex,
      realmName: nextStage.name,
      exp: carryExp,
      maxExp: nextStage.maxExp,
      readyToBreakthrough: carryExp >= nextStage.maxExp,
      lastGainSummary: `Đột phá thành công lên ${nextStage.name}!`,
      lastUpdatedAt: Date.now(),
    },
    nextRealmName: nextStage.name,
    isMaxRealm: false,
  };
}

export function consumeInventoryItem(
  profile: CultivationProfile,
  itemId: string,
): {
  nextProfile: CultivationProfile;
  itemName: string;
  expBonus: number;
} {
  const target = profile.inventory.find((i) => i.id === itemId);
  if (!target) {
    return { nextProfile: profile, itemName: '', expBonus: 0 };
  }

  const nextInventory = profile.inventory
    .map((item) =>
      item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item,
    )
    .filter((item) => item.quantity > 0);

  // Small authentic EXP bonus when consuming cultivation/energy pills
  let expBonus = 0;
  if (
    target.category === 'consumable' &&
    /(?:đan|hoàn|linh dịch|linh quả|tụ khí|hồi khí|hồi huyền|tẩy tủy|trúc cơ)/i.test(
      `${target.name} ${target.description || ''}`,
    )
  ) {
    const qualityMult: Record<InventoryItemQuality, number> = {
      common: 0.12,
      uncommon: 0.22,
      rare: 0.36,
      epic: 0.55,
      legendary: 0.8,
    };
    expBonus = Math.max(
      12,
      Math.round(profile.maxExp * (qualityMult[target.quality] || 0.18)),
    );
  }

  const expCap = Math.round(profile.maxExp * 1.35);
  const nextExp = Math.min(expCap, profile.exp + expBonus);
  const nextReady = nextExp >= profile.maxExp;

  return {
    nextProfile: {
      ...profile,
      exp: nextExp,
      readyToBreakthrough: nextReady,
      inventory: nextInventory,
      lastGainSummary:
        expBonus > 0
          ? `Đã dùng ${target.name} (+${expBonus} ${profile.energyLabel.split('/')[0].trim()})`
          : `Đã sử dụng 1 ${target.name}`,
      lastUpdatedAt: Date.now(),
    },
    itemName: target.name,
    expBonus,
  };
}

export interface LootSuggestion {
  name: string;
  quantity: number;
  category: InventoryItemCategory;
  quality: InventoryItemQuality;
  description: string;
}

/**
 * Lightweight zero-API scanner to detect loot / items acquired in the current story turn
 * so the player can add them to their bag in 1 tap.
 */
export function scanTurnForLootSuggestions(
  turnText: string,
  profile: CultivationProfile,
): LootSuggestion[] {
  const text = (turnText || '').trim();
  if (!text) return [];

  const existingNames = new Set(
    profile.inventory.map((i) => i.name.trim().toLowerCase()),
  );
  const results: LootSuggestion[] = [];
  const seen = new Set<string>();

  const lootRe =
    /(?:nhặt được|thu được|nhận được|lấy được|tặng cho|trao cho|ban cho|rơi ra|mua được|tìm thấy|cất vào túi)\s+(?:(?:một|hai|ba|bốn|năm|vài|\d+)\s+)?(?:viên|thanh|cây|cuốn|quyển|lá|bình|lọ|khối|mảnh|túi|chiếc|hộp|gói|lượng)?\s*([\p{L}0-9][\p{L}0-9\s-]{2,34}?)(?=[.,;:!?\n]|(?:\s+(?:và|cùng|rồi|vào|từ|của|này|đó|kia|để|lên|xuống)\b))/giu;

  let m: RegExpExecArray | null;
  while ((m = lootRe.exec(text)) !== null) {
    const rawName = (m[1] || '').replace(/\s+/g, ' ').trim();
    if (!rawName || rawName.length < 3 || rawName.length > 36) continue;
    const lower = rawName.toLowerCase();
    // Filter out obvious non-item phrases
    if (
      /^(?:tin tức|câu trả lời|ánh mắt|nụ cười|sự chú ý|cảm giác|hơi thở|lời nói|thời gian|cơ hội)/i.test(
        lower,
      )
    ) {
      continue;
    }
    if (seen.has(lower)) continue;
    seen.add(lower);

    let category: InventoryItemCategory = 'misc';
    let quality: InventoryItemQuality = 'common';
    if (/(?:đan|hoàn|dược|thuốc|linh quả|dịch|trà|rượu)/i.test(lower)) {
      category = 'consumable';
      quality = 'uncommon';
    } else if (/(?:kiếm|đao|thương|cung|chùy|trượng|giáp|pháp bảo|binh khí|phi đao)/i.test(lower)) {
      category = 'weapon';
      quality = 'uncommon';
    } else if (/(?:linh thạch|huyền tinh|tinh hạch|linh thảo|dược thảo|ngọc|khoáng|bạc|vàng)/i.test(lower)) {
      category = 'material';
      quality = /thượng phẩm|cực phẩm/i.test(lower) ? 'rare' : 'uncommon';
    } else if (/(?:phù|bí kíp|công pháp|ngọc giản|tâm pháp|kiếm phổ|lệnh bài)/i.test(lower)) {
      category = 'talisman';
      quality = 'rare';
    }

    if (/thiên phẩm|thần|chí tôn/i.test(lower)) quality = 'epic';
    else if (/địa phẩm|trung phẩm/i.test(lower)) quality = 'rare';

    const titleCased =
      rawName.charAt(0).toLocaleUpperCase('vi-VN') + rawName.slice(1);
    results.push({
      name: titleCased,
      quantity: 1,
      category,
      quality,
      description: existingNames.has(lower)
        ? 'Cộng thêm số lượng vào vật phẩm đã có trong túi.'
        : 'Nhặt/thu được từ diễn biến trang truyện hiện tại.',
    });
    if (results.length >= 4) break;
  }

  return results;
}

/**
 * Formats the character's Cultivation / Martial Arts Profile, Techniques, and Inventory
 * for clean system-context injection into Proxy API calls (only for Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp).
 */
export function formatCultivationContextBlock(
  profile: CultivationProfile | undefined,
  mcName?: string,
): string {
  if (!profile || !profile.enabled) return '';

  const meta = CULTIVATION_SYSTEM_META[profile.systemKind];
  const nextRealm = getNextRealmStage(profile);
  const expPct = Math.min(
    100,
    Math.round((profile.exp / Math.max(1, profile.maxExp)) * 100),
  );
  const headerName = mcName?.trim()
    ? `NHÂN VẬT CHÍNH (${mcName.trim()})`
    : 'NHÂN VẬT CHÍNH';

  const lines: string[] = [
    `[HỒ SƠ ${meta.label.toUpperCase()} — THỰC LỰC, CÔNG PHÁP & ${profile.bagName.toUpperCase()} CỦA ${headerName}]`,
    `- Hệ thống: ${meta.label} | Cảnh giới hiện tại: ${profile.realmName}`,
    `- ${profile.energyLabel}: ${profile.exp}/${profile.maxExp} (${expPct}%)${
      profile.readyToBreakthrough
        ? ` [SẴN SÀNG ĐỘT PHÁ${nextRealm ? ` lên ${nextRealm.name}` : ''}]`
        : ''
    }`,
  ];

  if (profile.techniques.length > 0) {
    lines.push(`- ${meta.techniqueSectionLabel}:`);
    for (const t of profile.techniques.slice(0, 12)) {
      const catLabel = meta.categoryLabels[t.category] || 'Võ học';
      const tierLabel = TECHNIQUE_TIER_META[t.tier]?.label || 'Phàm giai';
      const activeTag = t.isActiveTraining ? ' [Đang chuyên tu]' : '';
      const descPart = t.description ? ` — ${t.description}` : '';
      lines.push(
        `  · ${t.name} (${catLabel} · ${tierLabel} · Tầng ${t.level}/${t.maxLevel} · Thuần thục ${t.mastery}%)${activeTag}${descPart}`,
      );
      if (t.moves && t.moves.length > 0) {
        const moveText = t.moves
          .slice(0, 6)
          .map(
            (mv) =>
              `${mv.name} (Cấp ${mv.level}/${mv.maxLevel} · ${mv.mastery}%${mv.description ? ` — ${mv.description}` : ''})`,
          )
          .join('; ');
        lines.push(`    + Chiêu thức: ${moveText}`);
      }
    }
  } else {
    lines.push(`- ${meta.techniqueSectionLabel}: Chưa ghi nhận công pháp cụ thể.`);
  }

  if (profile.inventory.length > 0) {
    lines.push(`- ${profile.bagName}:`);
    for (const item of profile.inventory.slice(0, 18)) {
      const qLabel = INVENTORY_QUALITY_META[item.quality]?.label || 'Phàm phẩm';
      const descPart = item.description ? ` — ${item.description}` : '';
      lines.push(`  · ${item.name} x${item.quantity} (${qLabel})${descPart}`);
    }
  } else {
    lines.push(`- ${profile.bagName}: Đang trống.`);
  }

  lines.push(
    'Quy tắc thực lực bắt buộc: Bám sát đúng cảnh giới, cấp tầng/độ thuần thục công pháp, đúng tên & đặc điểm từng chiêu thức trong bí kíp khi nhân vật xuất chiêu hoặc luyện tập, và đúng vật phẩm hiện có trong túi của nhân vật chính; không tự ý cho nhân vật vượt cảnh giới hoặc dùng đan dược/binh khí không có trong hành trang trừ khi diễn biến truyện miêu tả rõ quá trình thu được hoặc đột phá.',
  );

  return lines.join('\n');
}
