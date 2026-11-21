import type {
  CharacterPortrait,
  ImageCameraAngleId,
  ImageCameraAnglePreset,
  ImageGenerationMode,
  ImageGridMode,
  StoryImageConfig,
  StoryImageStyle,
  StoryImageStylePreset,
} from '../types/ark';

export const IMAGE_STYLE_VARIABLES = [
  '${image_style_name}',
  '${image_style_description}',
  '${image_style_prompt_guide}',
] as const;

export type ImageStyleVariableToken = (typeof IMAGE_STYLE_VARIABLES)[number];

export const IMAGE_PROMPT_TEMPLATE_VARIABLES = [
  {
    token: '${story_text}',
    label: 'Nội dung truyện',
    group: 'context',
  },
  {
    token: '${onscene_characters_full}',
    label: 'NV có mặt (đầy đủ)',
    group: 'context',
  },
  {
    token: '${current_time}',
    label: 'Thời gian hiện tại',
    group: 'context',
  },
  {
    token: '${current_location}',
    label: 'Địa điểm hiện tại',
    group: 'context',
  },
  {
    token: '${entry_decision_new_characters}',
    label: 'NV mới xuất hiện',
    group: 'context',
  },
  {
    token: '${image_count}',
    label: 'Số lượng ảnh',
    group: 'mode',
  },
  {
    token: '${image_grid_mode}',
    label: 'Chế độ lưới khung',
    group: 'mode',
  },
  {
    token: '${image_generation_mode}',
    label: 'Chế độ sinh ảnh',
    group: 'mode',
  },
  {
    token: '${image_style_name}',
    label: 'Tên phong cách',
    group: 'style',
  },
  {
    token: '${image_style_description}',
    label: 'Mô tả phong cách',
    group: 'style',
  },
  {
    token: '${image_style_prompt_guide}',
    label: 'Chỉ dẫn chất liệu',
    group: 'style',
  },
] as const;

export type ImagePromptTemplateToken =
  (typeof IMAGE_PROMPT_TEMPLATE_VARIABLES)[number]['token'];

export const IMAGE_GRID_MODE_LABELS: Record<ImageGridMode, string> = {
  single: 'Ảnh đơn toàn khung (1 khung hình duy nhất)',
  grid_2: 'Lưới 2 khung liên tiếp (2-panel split)',
  grid_4: 'Lưới 4 khung kịch bản (2x2 storyboard grid)',
  character_sheet: 'Bảng nhiều góc nhìn (Multi-angle Character Sheet)',
};

export const IMAGE_GENERATION_MODE_LABELS: Record<ImageGenerationMode, string> =
  {
    scene: 'Minh họa cảnh truyện',
    portrait: 'Chân dung nhân vật',
    cinema_frame: 'Khung hình điện ảnh',
    illustration: 'Tranh minh họa nghệ thuật',
    custom: 'Tùy chỉnh tự do',
  };

export const IMAGE_CAMERA_ANGLES: ImageCameraAnglePreset[] = [
  {
    id: 'auto',
    label: 'Tự động theo cảnh',
    description: 'AI tự chọn bố cục góc máy phù hợp nhất với diễn biến hiện tại.',
    promptGuide: '',
  },
  {
    id: 'close_up',
    label: 'Cận cảnh (Close-up)',
    description:
      'Tập trung sát gương mặt, ánh mắt và biểu cảm tinh tế của nhân vật.',
    promptGuide:
      'intimate close-up framing, expressive facial focus, shallow depth of field, soft background bokeh',
  },
  {
    id: 'medium_shot',
    label: 'Trung cảnh (Medium Shot)',
    description:
      'Lấy từ thắt lưng trở lên, cân bằng giữa cử chỉ nhân vật và bối cảnh.',
    promptGuide:
      'balanced medium shot from waist up, natural body language and costume detail, cohesive foreground-background framing',
  },
  {
    id: 'wide_shot',
    label: 'Toàn cảnh (Wide Shot)',
    description:
      'Góc rộng thu trọn không gian, kiến trúc, thiên nhiên và tỷ lệ nhân vật.',
    promptGuide:
      'expansive wide establishing shot, grand environmental scale, atmospheric perspective, full-body character in context',
  },
  {
    id: 'low_angle',
    label: 'Góc thấp (Low Angle)',
    description:
      'Máy đặt thấp hất lên tạo cảm giác uy nghi, hùng vĩ hoặc áp đảo.',
    promptGuide:
      'dramatic low-angle hero camera looking upward, towering silhouettes, imposing cinematic presence',
  },
  {
    id: 'high_angle',
    label: 'Góc cao (High Angle)',
    description:
      'Nhìn từ trên cao xuống bao quát vị trí nhân vật và chiều sâu không gian.',
    promptGuide:
      'elevated high-angle aerial perspective looking down, spatial storytelling, sweeping depth',
  },
  {
    id: 'over_shoulder',
    label: 'Qua vai (Over-the-Shoulder)',
    description:
      'Khung hình đối thoại kịch tính đặt máy sau vai một nhân vật nhìn tới đối phương.',
    promptGuide:
      'cinematic over-the-shoulder shot, soft foreground shoulder frame, sharp focus on facing subject, narrative dialogue tension',
  },
  {
    id: 'dutch_angle',
    label: 'Góc nghiêng kịch tính (Dutch Angle)',
    description:
      'Đường chân trời nghiêng tạo cảm giác bất ổn, cao trào hoặc hành động mạnh.',
    promptGuide:
      'dynamic tilted Dutch angle composition, diagonal visual tension, high-stakes cinematic motion energy',
  },
];

export const STORY_IMAGE_STYLES: StoryImageStylePreset[] = [
  {
    id: 'live_action_cinema',
    label: 'Điện ảnh người thật',
    category: 'Điện ảnh',
    description:
      'Khung hình phim điện ảnh live-action chân thực như quay bằng ống kính anamorphic, ánh sáng tự nhiên có chiều sâu và chất da, trang phục thật.',
    promptGuide:
      'live-action cinematic film still, photorealistic human skin texture and natural pores, authentic fabric weave, 35mm anamorphic lens, shallow depth of field, naturalistic atmospheric lighting, subtle film grain, dramatic cinematic color grading, high dynamic range, no anime or cartoon look',
    promptHint: 'Phong cách điện ảnh người thật, ánh sáng phim 35mm chân thực',
  },
  {
    id: 'neo_guofeng_impasto',
    label: 'Bán hiện thực đắp màu điện ảnh Tân Quốc Phong',
    category: 'Hội họa',
    description:
      'Bán hiện thực kết hợp kỹ thuật đắp màu dày (impasto) giàu khối sáng tối với mỹ cảm Tân Quốc Phong hiện đại và bố cục điện ảnh.',
    promptGuide:
      'semi-realistic Neo-Guofeng cinematic impasto painting, expressive thick oil-like brushstrokes, sculptural volumetric light and shadow, refined East Asian facial features and modern-traditional costume aesthetics, rich jewel and ink-toned cinema palette, atmospheric haze, painterly depth with crisp focal rendering',
    promptHint: 'Bán hiện thực đắp màu điện ảnh Tân Quốc Phong',
  },
  {
    id: 'classic_impasto',
    label: 'Phong cách đắp màu cổ điển',
    category: 'Hội họa',
    description:
      'Tranh minh họa đắp màu truyền thống dày dặn, cọ vẽ có lực, sắc độ trầm ấm cổ điển và chuyển khối mượt mà giàu cảm xúc.',
    promptGuide:
      'classical impasto digital painting, rich layered pigment strokes, visible painterly brushwork, warm chiaroscuro studio lighting, timeless classical illustration composition, subtle canvas texture, soft atmospheric perspective, nuanced tonal harmony',
    promptHint: 'Phong cách đắp màu cổ điển giàu chất cọ',
  },
  {
    id: 'oil_painting',
    label: 'Phong cách sơn dầu',
    category: 'Hội họa',
    description:
      'Chất liệu sơn dầu trên toan vải mang hơi thở hội họa hàn lâm châu Âu, nổi bật ánh sáng tương phản, độ bóng sắc tố và vết cọ sống động.',
    promptGuide:
      'masterpiece classical oil painting on linen canvas, tactile oil paint strokes and glazing layers, Rembrandt-inspired dramatic lighting, deep rich shadows and luminous highlights, museum-grade fine art texture, authentic painterly edges and subtle craquelure',
    promptHint: 'Phong cách tranh sơn dầu cổ điển trên toan vải',
  },
  {
    id: 'anime_cg',
    label: 'Phong cách CG hoạt hình',
    category: 'CG / Anime',
    description:
      'Phong cách CG anime chất lượng cao với đường nét sắc sảo, màu sắc rực rỡ trong trẻo, hiệu ứng ánh sáng điện ảnh kiểu phim hoạt hình chiếu rạp.',
    promptGuide:
      'high-end theatrical anime CG illustration, crisp clean linework, luminous cel-and-soft shading blend, expressive anime eyes and flowing hair strands, radiant rim light, dramatic sky and particle glow, cinematic anime movie key visual quality',
    promptHint: 'Phong cách CG hoạt hình chiếu rạp sắc nét',
  },
  {
    id: 'refined_realistic_cg',
    label: 'CG hoạt hình chân thực, tinh gọn',
    category: 'CG / Anime',
    description:
      'Kết hợp tỷ lệ thanh thoát của hoạt hình với độ chân thực tinh gọn về ánh sáng, chất liệu và bố cục sạch sẽ, không rối chi tiết thừa.',
    promptGuide:
      'refined realistic anime CG rendering, sleek minimalist visual polish, believable subsurface scattering on skin, clean modern composition, crisp material separation for silk metal and glass, balanced cinematic lighting, uncluttered refined aesthetic',
    promptHint: 'CG hoạt hình chân thực, tinh gọn, sạch bố cục',
  },
  {
    id: 'rmji_high_cg',
    label: 'Phong cách CG cao cấp Phàm Nhân Tu Tiên',
    category: 'CG / 3D',
    description:
      'Phong cách 3D donghua cao cấp kiểu Phàm Nhân Tu Tiên: ngũ quan Á Đông chân thực, y phục tiên hiệp bay bổng, linh khí huyền ảo và ánh sáng sử thi.',
    promptGuide:
      'ultra-high-end Chinese 3D donghua CG style inspired by A Record of a Mortal’s Journey to Immortality (Phàm Nhân Tu Tiên), realistic East Asian 3D character sculpt, intricate embroidered xianxia robes and jade ornaments, physically based rendering with fine hair strands, swirling spiritual qi energy, misty mountain clouds, epic cinematic lighting, Unreal Engine 5 film quality',
    promptHint: 'Phong cách CG 3D cao cấp Phàm Nhân Tu Tiên',
  },
  {
    id: 'cinema_still_ukiyoe',
    label: 'Bản ảnh tĩnh điện ảnh đỉnh cao • Hiệu ứng Ukiyo-e',
    category: 'Điện ảnh',
    description:
      'Bố cục ảnh tĩnh điện ảnh đỉnh cao hòa quyện mỹ học tranh khắc gỗ Ukiyo-e: mảng sóng mây cách điệu, viền mực tinh tế và bảng màu khoáng sắc cổ.',
    promptGuide:
      'masterpiece cinematic film still fused with traditional Japanese Ukiyo-e woodblock print aesthetics, widescreen dramatic framing, stylized swirling clouds and water motifs, delicate ink outlines over rich mineral pigments (indigo, vermilion, ochre, gold leaf), subtle washi paper grain, poetic dramatic lighting',
    promptHint: 'Bản ảnh tĩnh điện ảnh đỉnh cao kết hợp hiệu ứng Ukiyo-e',
  },
  {
    id: 'cinema_still_vfx',
    label: 'Bản ảnh tĩnh điện ảnh đỉnh cao • Kỹ xảo chân thực',
    category: 'Điện ảnh',
    description:
      'Ảnh tĩnh bom tấn điện ảnh với kỹ xảo VFX siêu thực: ánh sáng thể tích, hạt lửa/linh lực, khói bụi vật lý chuẩn xác và tương phản kịch tính.',
    promptGuide:
      'blockbuster cinema still with photorealistic Hollywood-grade VFX, volumetric god rays, physically accurate sparks embers smoke and energy refraction, IMAX wide cinematic camera angle, ultra-sharp focal subject, realistic motion blur and lens optics, epic atmospheric scale',
    promptHint: 'Bản ảnh tĩnh điện ảnh đỉnh cao với kỹ xảo VFX chân thực',
  },
  {
    id: 'erliangjiu_manhua',
    label: 'Phong cách truyện tranh Nhị Lưỡng Tửu',
    category: 'Truyện tranh',
    description:
      'Nét vẽ manhua cổ phong đặc trưng kiểu Nhị Lưỡng Tửu: đường mực phóng khoáng sắc bén, tạo hình nhân vật tuấn mỹ lạnh lùng, ánh màu cổ trầm hút mắt.',
    promptGuide:
      'Chinese manhua art style inspired by Erliangjiu (Nhị Lưỡng Tửu), expressive sharp calligraphy ink lineart, charismatic angular character design with piercing gaze, moody antique ink-and-crimson color wash, dramatic flowing sleeves and hair motion, poetic wuxia-xianxia comic aesthetic',
    promptHint: 'Phong cách truyện tranh cổ phong Nhị Lưỡng Tửu',
  },
  {
    id: 'xianxia_exquisite',
    label: 'Minh họa tiên hiệp tinh xảo',
    category: 'Tiên hiệp',
    description:
      'Tranh minh họa tiên hiệp cầu kỳ đến từng hoa văn trâm ngọc, lụa mỏng xuyên sáng, kiếm khí và tiên cảnh mây mờ huyền mỹ.',
    promptGuide:
      'exquisite high-detail Chinese xianxia fantasy illustration, ornate flowing silk hanfu and celestial ribbons, finely crafted jade hairpins gold filigree and spirit sword details, ethereal glowing mist, luminous fairy-realm ambiance, painterly polished finish with jewel-like highlights',
    promptHint: 'Minh họa tiên hiệp tinh xảo, hoa văn cổ phong cầu kỳ',
  },
  {
    id: 'xianxia_ink_wash',
    label: 'Minh họa tiên hiệp thủy mặc vẽ tay tinh tế',
    category: 'Tiên hiệp',
    description:
      'Hội họa tiên hiệp thủy mặc vẽ tay trên giấy tuyên chỉ: nét bút lông thanh thoát, loang mực uyển chuyển, khoảng trống thi vị và điểm sắc thanh nhã.',
    promptGuide:
      'delicate hand-painted Chinese xianxia ink-wash (shuimo) illustration on Xuan rice paper, graceful gongbi-meets-xieyi brushwork, organic sumi ink bleeds and misty mountain silhouettes, restrained mineral watercolor accents of celadon teal vermilion and pale gold, poetic negative space, refined classical scroll aesthetic',
    promptHint: 'Minh họa tiên hiệp thủy mặc vẽ tay tinh tế',
  },
  {
    id: '3d_ukiyoe',
    label: 'Kết xuất 3D với hiệu ứng Ukiyo-e',
    category: 'CG / 3D',
    description:
      'Mô hình kết xuất 3D khối chiều sâu sống động phủ shader nghệ thuật Ukiyo-e: vân khắc gỗ, ánh sáng cách điệu và chất liệu chạm nổi độc đáo.',
    promptGuide:
      'stylized 3D octane-quality render with Ukiyo-e woodblock shader aesthetic, sculptural 3D depth and camera parallax paired with hand-carved woodgrain textures, stylized ink contours, layered mineral color planes, floating stylized clouds and waves, artistic NPR 3D craftsmanship',
    promptHint: 'Kết xuất 3D nghệ thuật với hiệu ứng khắc gỗ Ukiyo-e',
  },
  {
    id: 'xianxia_jade_flat',
    label: 'Tiên hiệp nét ngọc bản tô phẳng',
    category: 'Tiên hiệp',
    description:
      'Đường nét mảnh thanh như khắc ngọc kết hợp mảng màu phẳng tinh tế, tông thanh ngọc — trắng sứ — vàng nhạt nhẹ nhàng, trang nhã.',
    promptGuide:
      'xianxia jade-fine lineart flat-color illustration, ultra-clean delicate ink lines like carved jade, harmonious celadon jade ivory and muted gold flat color blocks, minimal soft gradient accents, crisp decorative silhouettes, serene refined oriental graphic elegance',
    promptHint: 'Tiên hiệp nét ngọc thanh mảnh bản tô phẳng tinh tế',
  },
  {
    id: 'character_sheet_multi',
    label: 'Bảng nhiều góc nhìn',
    category: 'Thiết kế NV',
    description:
      'Character Sheet chuyên nghiệp: bố cục nhiều góc nhìn trên cùng 1 khung hình (chính diện, góc nghiêng, 3/4, sau lưng & cận mặt) theo phong cách điện ảnh chân thực.',
    promptGuide:
      'professional photorealistic cinematic character sheet (multi-angle turnaround design sheet on a single clean studio frame): includes full-body front view, full-body side profile view, full-body three-quarter view, full-body back view, and high-detail close-up facial expression portrait arranged neatly in one cohesive composition; 100% consistent face, hairstyle, body proportions, costume details, and accessories across every angle; realistic cinema lighting, neutral dark studio backdrop, crisp sharp focus',
    promptHint:
      'Bảng nhiều góc nhìn (Character Sheet) trên 1 khung hình, phong cách điện ảnh chân thực',
  },
];

export const DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE = `Chế độ sinh ảnh: \${image_generation_mode} | Bố cục: \${image_grid_mode} | Số lượng: \${image_count}
Thời gian hiện tại: \${current_time}
Địa điểm hiện tại: \${current_location}
Nhân vật đang có mặt: \${onscene_characters_full}
Nhân vật mới xuất hiện: \${entry_decision_new_characters}

Diễn biến & khung cảnh:
\${story_text}

Phong cách vẽ tranh: \${image_style_name} — \${image_style_description}
Chỉ dẫn hình ảnh & chất liệu: \${image_style_prompt_guide}`;

export const DEFAULT_IMAGE_STYLE_BLOCK_TEMPLATE =
  'Phong cách vẽ tranh: ${image_style_name} — ${image_style_description}\nChỉ dẫn hình ảnh & chất liệu: ${image_style_prompt_guide}';

const LEGACY_IMAGE_STYLE_MAP: Record<string, StoryImageStyle> = {
  cinematic: 'live_action_cinema',
  realistic: 'live_action_cinema',
  anime: 'anime_cg',
  watercolor: 'xianxia_ink_wash',
  dark_fantasy: 'rmji_high_cg',
  custom: 'live_action_cinema',
};

export function getAllImageStyles(
  customStyles?: StoryImageStylePreset[],
): StoryImageStylePreset[] {
  const validCustoms = Array.isArray(customStyles)
    ? customStyles.filter(
        (s) => s && typeof s.id === 'string' && s.id.trim() && s.label?.trim(),
      )
    : [];
  return [...STORY_IMAGE_STYLES, ...validCustoms];
}

export function normalizeCustomImageStyles(
  raw: unknown,
): StoryImageStylePreset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(STORY_IMAGE_STYLES.map((s) => s.id));
  const out: StoryImageStylePreset[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id || '').trim();
    const label = String(rec.label || '').trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const description = String(rec.description || '').trim();
    const promptGuide = String(
      rec.promptGuide || rec.promptHint || description || label,
    ).trim();
    out.push({
      id,
      label,
      category: String(rec.category || 'Tùy chỉnh').trim() || 'Tùy chỉnh',
      description:
        description || `Phong cách tùy chỉnh "${label}" do người dùng lưu.`,
      promptGuide,
      promptHint: String(rec.promptHint || promptGuide).trim(),
      isCustom: true,
    });
  }
  return out;
}

export function normalizeSampleImagesMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || '').trim();
    const val = typeof v === 'string' ? v.trim() : '';
    if (!key || !val) continue;
    if (
      val.startsWith('portrait:') ||
      val.startsWith('data:image/') ||
      /^https?:\/\//i.test(val)
    ) {
      out[key] = val;
    }
  }
  return out;
}

export function normalizeCameraAngleId(raw: unknown): ImageCameraAngleId {
  const key = typeof raw === 'string' ? raw.trim() : '';
  const found = IMAGE_CAMERA_ANGLES.find((a) => a.id === key);
  return found ? found.id : 'auto';
}

export function resolveCameraAngle(
  angleId?: ImageCameraAngleId | string | null,
): ImageCameraAnglePreset {
  const normalized = normalizeCameraAngleId(angleId);
  return (
    IMAGE_CAMERA_ANGLES.find((a) => a.id === normalized) ||
    IMAGE_CAMERA_ANGLES[0]
  );
}

export function normalizeStoryImageStyleId(
  raw?: unknown,
  customStyles?: StoryImageStylePreset[],
): StoryImageStyle {
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) return STORY_IMAGE_STYLES[0].id;
  const all = getAllImageStyles(customStyles);
  const direct = all.find((s) => s.id === key);
  if (direct) return direct.id;
  const mapped = LEGACY_IMAGE_STYLE_MAP[key];
  if (mapped) return mapped;
  return STORY_IMAGE_STYLES[0].id;
}

export function resolveStoryImageStyle(
  styleOrId?: StoryImageStylePreset | StoryImageStyle | string | null,
  customStyles?: StoryImageStylePreset[],
): StoryImageStylePreset {
  if (styleOrId && typeof styleOrId === 'object' && 'promptGuide' in styleOrId) {
    return styleOrId;
  }
  const all = getAllImageStyles(customStyles);
  const normalizedId = normalizeStoryImageStyleId(styleOrId, customStyles);
  return all.find((s) => s.id === normalizedId) || STORY_IMAGE_STYLES[0];
}

export function getSampleImageKey(
  kind: 'style' | 'angle',
  id: string,
): string {
  return `${kind}:${id}`;
}

export function resolveSampleImageSrc(
  sampleValue: string | undefined,
  portraits?: CharacterPortrait[],
): {
  src: string;
  sourceLabel: string;
  isPortraitRef: boolean;
  isExternalUrl: boolean;
} | null {
  const val = (sampleValue || '').trim();
  if (!val) return null;
  if (val.startsWith('portrait:')) {
    const portraitId = val.slice('portrait:'.length).trim();
    const matched = (portraits || []).find((p) => p.id === portraitId);
    const img = (matched?.imageData || '').trim();
    if (!img) return null;
    return {
      src: img,
      sourceLabel: matched?.name
        ? `Thư viện NV: ${matched.name}`
        : 'Thư viện Ảnh NV/NPC',
      isPortraitRef: true,
      isExternalUrl: /^https?:\/\//i.test(img),
    };
  }
  const isHttp = /^https?:\/\//i.test(val);
  return {
    src: val,
    sourceLabel: val.startsWith('data:image/')
      ? 'Ảnh mẫu cục bộ (đã nén)'
      : isHttp
        ? 'Ảnh mẫu từ URL ngoài'
        : 'Ảnh mẫu',
    isPortraitRef: false,
    isExternalUrl: isHttp,
  };
}

export function validateImageSampleUrl(
  rawUrl: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Hãy nhập hoặc dán đường dẫn URL hình ảnh.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: 'URL không hợp lệ. Hãy nhập đường dẫn bắt đầu bằng https:// hoặc http://.',
    };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      error: 'Chỉ hỗ trợ đường dẫn hình ảnh https:// hoặc http://.',
    };
  }
  return { ok: true, url: parsed.toString() };
}

function verifyBrowserCanLoadImageUrl(
  url: string,
  timeoutMs = 10000,
): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => finish((img.naturalWidth || img.width || 0) > 0);
    img.onerror = () => finish(false);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    img.src = url;
  });
}

export type ImportSampleImageUrlResult =
  | {
      ok: true;
      value: string;
      mode: 'compressed' | 'url-fallback';
      approxKb?: number;
      note: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Imports a comparison sample image from an external HTTP(S) URL.
 * 1) Attempts CORS fetch + local Canvas compression so the image is cached
 *    stably and compactly inside ARK_LITE_AI_STUDIO_V1.
 * 2) If the remote server blocks CORS, verifies the browser can still display
 *    the image directly and saves the validated URL cleanly as fallback.
 */
export async function importSampleImageFromUrl(
  rawUrl: string,
): Promise<ImportSampleImageUrlResult> {
  const check = validateImageSampleUrl(rawUrl);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }
  const url = check.url;

  // Step 1: Try CORS fetch + compress into compact local thumbnail
  if (typeof fetch === 'function') {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId =
      controller && typeof setTimeout !== 'undefined'
        ? setTimeout(() => controller.abort(), 9000)
        : null;
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller?.signal,
      });
      if (res.ok) {
        const blob = await res.blob();
        const looksLikeImage =
          !blob.type ||
          blob.type.startsWith('image/') ||
          blob.type === 'application/octet-stream';
        if (looksLikeImage && blob.size > 0) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh.'));
            reader.readAsDataURL(blob);
          });
          if (dataUrl.startsWith('data:')) {
            const compressed = await compressSampleImageForStorage(dataUrl);
            return {
              ok: true,
              value: compressed.dataUrl,
              mode: 'compressed',
              approxKb: compressed.approxKb,
              note: `Đã tải & nén ảnh mẫu từ URL (~${compressed.approxKb} KB) vào bộ nhớ.`,
            };
          }
        }
      }
    } catch {
      // Likely CORS-blocked or network timeout; fall through to direct image load check
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  // Step 2: Verify the URL renders directly as a valid image (handles CORS-blocked hosts)
  const canRender = await verifyBrowserCanLoadImageUrl(url, 10000);
  if (canRender) {
    return {
      ok: true,
      value: url,
      mode: 'url-fallback',
      note: 'Máy chủ ảnh hạn chế CORS nên không nén cục bộ — đã lưu trực tiếp URL ảnh để hiển thị ổn định.',
    };
  }

  return {
    ok: false,
    error:
      'Không thể tải hình ảnh từ URL này. Hãy kiểm tra lại đường dẫn ảnh trực tiếp (.jpg, .png, .webp...) hoặc tải ảnh từ thiết bị.',
  };
}

/**
 * Compresses an uploaded image file or data URL into a compact thumbnail
 * (max 420px edge, WebP or JPEG) so comparison samples stay tiny inside
 * localStorage (`ARK_LITE_AI_STUDIO_V1`).
 */
export async function compressSampleImageForStorage(
  source: File | string,
  options?: { maxEdge?: number; quality?: number },
): Promise<{ dataUrl: string; approxKb: number }> {
  const maxEdge = options?.maxEdge ?? 420;
  const quality = options?.quality ?? 0.74;

  const rawDataUrl =
    typeof source === 'string'
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
          reader.readAsDataURL(source);
        });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      dataUrl: rawDataUrl,
      approxKb: Math.max(1, Math.round((rawDataUrl.length * 0.75) / 1024)),
    };
  }

  return await new Promise<{ dataUrl: string; approxKb: number }>(
    (resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const origW = img.naturalWidth || img.width || maxEdge;
          const origH = img.naturalHeight || img.height || maxEdge;
          const scale = Math.min(1, maxEdge / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * scale));
          const targetH = Math.max(1, Math.round(origH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              dataUrl: rawDataUrl,
              approxKb: Math.max(
                1,
                Math.round((rawDataUrl.length * 0.75) / 1024),
              ),
            });
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          let out = '';
          try {
            const webp = canvas.toDataURL('image/webp', quality);
            if (webp.startsWith('data:image/webp')) {
              out = webp;
            }
          } catch {
            out = '';
          }
          if (!out) {
            out = canvas.toDataURL('image/jpeg', quality);
          }
          // If still large (> 65 KB), do a second pass with tighter quality
          if (out.length * 0.75 > 65 * 1024) {
            const tighter = canvas.toDataURL(
              out.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
              0.56,
            );
            if (tighter.length < out.length) out = tighter;
          }
          resolve({
            dataUrl: out,
            approxKb: Math.max(1, Math.round((out.length * 0.75) / 1024)),
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () =>
        reject(new Error('Không thể giải mã tệp ảnh đã chọn.'));
      img.src = rawDataUrl;
    },
  );
}

export function buildCustomStylePreset(options: {
  name: string;
  description?: string;
  promptGuide?: string;
  baseStyle?: StoryImageStylePreset;
}): StoryImageStylePreset {
  const base = options.baseStyle || STORY_IMAGE_STYLES[0];
  const cleanName = options.name.trim();
  const resolveInline = (raw: string) =>
    raw
      .split('${image_style_name}')
      .join(base.label)
      .split('${image_style_description}')
      .join(base.description)
      .split('${image_style_prompt_guide}')
      .join(base.promptGuide)
      .trim();

  const resolvedDesc = resolveInline(options.description || '') || base.description;
  const resolvedGuide =
    resolveInline(options.promptGuide || '') ||
    `${base.promptGuide}, custom aesthetic emphasis: ${cleanName}`;

  const slug = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

  return {
    id: `custom_style_${slug || 'preset'}_${Date.now().toString(36)}`,
    label: cleanName,
    category: 'Tùy chỉnh',
    description: resolvedDesc,
    promptGuide: resolvedGuide,
    promptHint: resolvedGuide,
    isCustom: true,
  };
}

const HAS_STYLE_VAR_RE =
  /\$\{(?:image_style_name|image_style_description|image_style_prompt_guide)\}/;

export const HAS_ANY_IMAGE_TEMPLATE_VAR_RE =
  /\$\{(?:story_text|onscene_characters_full|current_time|current_location|entry_decision_new_characters|image_count|image_grid_mode|image_generation_mode|image_style_name|image_style_description|image_style_prompt_guide)\}/;

/**
 * Interpolates `${image_style_name}`, `${image_style_description}`, and
 * `${image_style_prompt_guide}` into an image prompt template.
 * If the template doesn't explicitly reference any of those placeholders,
 * automatically appends the resolved style block so every generated image
 * consistently reflects the chosen art style.
 */
export function applyImageStyleVariables(
  promptTemplate: string,
  styleOrId?: StoryImageStylePreset | StoryImageStyle | string | null,
  customStyles?: StoryImageStylePreset[],
  cameraAngleId?: ImageCameraAngleId | string | null,
): string {
  const style = resolveStoryImageStyle(styleOrId, customStyles);
  const angle = resolveCameraAngle(cameraAngleId);
  const raw = String(promptTemplate || '').trim();

  const replaceTokens = (text: string) =>
    text
      .split('${image_style_name}')
      .join(style.label)
      .split('${image_style_description}')
      .join(style.description)
      .split('${image_style_prompt_guide}')
      .join(style.promptGuide);

  const angleSuffix = angle.promptGuide
    ? `\nGóc máy: ${angle.label} (${angle.promptGuide})`
    : '';

  if (!raw) {
    return `${replaceTokens(DEFAULT_IMAGE_STYLE_BLOCK_TEMPLATE)}${angleSuffix}`.trim();
  }

  if (HAS_STYLE_VAR_RE.test(raw)) {
    return `${replaceTokens(raw).trim()}${angleSuffix}`.trim();
  }

  const resolvedBlock = replaceTokens(DEFAULT_IMAGE_STYLE_BLOCK_TEMPLATE);
  return `${raw}\n${resolvedBlock}${angleSuffix}`.trim();
}

export function interpolateImagePromptTemplate(
  template: string,
  variables: Record<string, string>,
  options?: {
    style?: StoryImageStylePreset;
    cameraAngle?: ImageCameraAngleId;
  },
): string {
  let out = String(template || '').trim();
  if (!out) out = DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE;

  for (const [token, value] of Object.entries(variables)) {
    out = out.split(token).join(value);
  }

  // Clean up redundant blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  // Append camera angle directive if user chose a specific angle
  const angle = resolveCameraAngle(options?.cameraAngle);
  if (angle.promptGuide && !out.includes(angle.promptGuide)) {
    out = `${out}\nGóc máy: ${angle.label} (${angle.promptGuide})`;
  }

  return out.trim();
}

export function normalizeStoryImageConfig(
  raw: unknown,
  fallback: StoryImageConfig,
): StoryImageConfig {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const rec = raw as Record<string, unknown>;
  const customStyles = normalizeCustomImageStyles(rec.customStyles);
  const sampleImages = normalizeSampleImagesMap(rec.sampleImages);
  const cameraAngle = normalizeCameraAngleId(rec.cameraAngle);
  const rawCount = Number(rec.imageCount);
  const imageCount =
    Number.isFinite(rawCount) && rawCount >= 1 && rawCount <= 4
      ? Math.floor(rawCount)
      : 1;
  const validGridModes: ImageGridMode[] = [
    'single',
    'grid_2',
    'grid_4',
    'character_sheet',
  ];
  const imageGridMode = validGridModes.includes(
    rec.imageGridMode as ImageGridMode,
  )
    ? (rec.imageGridMode as ImageGridMode)
    : 'single';
  const validGenModes: ImageGenerationMode[] = [
    'scene',
    'portrait',
    'cinema_frame',
    'illustration',
    'custom',
  ];
  const imageGenerationMode = validGenModes.includes(
    rec.imageGenerationMode as ImageGenerationMode,
  )
    ? (rec.imageGenerationMode as ImageGenerationMode)
    : 'scene';

  return {
    ...fallback,
    ...(rec as Partial<StoryImageConfig>),
    stylePreset: normalizeStoryImageStyleId(rec.stylePreset, customStyles),
    cameraAngle,
    customStyles,
    sampleImages,
    promptTemplate:
      typeof rec.promptTemplate === 'string' ? rec.promptTemplate : '',
    imageCount,
    imageGridMode,
    imageGenerationMode,
  };
}
