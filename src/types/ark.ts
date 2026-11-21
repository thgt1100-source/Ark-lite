export type ViewName =
  | 'lobby'
  | 'setup'
  | 'chat'
  | 'config'
  | 'companion'
  | 'preset'
  | 'context'
  | 'data';

export type WorldGenreId =
  | 'slice_of_life'
  | 'showbiz'
  | 'ancient'
  | 'xianxia'
  | 'xuanhuan'
  | 'apocalypse'
  | 'urban'
  | 'fantasy'
  | 'scifi';

export type DramaLevel = 'chill' | 'balanced' | 'intense';

export type WorldLaunchMode = 'ai_opening' | 'direct_chat';

export type ApiProtocol = 'openai' | 'auto' | 'gemini';
export type McSourceMode = 'custom' | 'canon';
export type McRoleType = 'transmigrator' | 'powerhouse' | 'custom';
export type DnSubTab = 'mc' | 'world' | 'npcs' | 'portraits';

export interface SafetySetting {
  category: string;
  threshold: string;
}

export type PresetGroupId =
  | 'style'
  | 'personal'
  | 'perspective'
  | 'intimacy'
  | 'appearance'
  | 'core';

export interface PresetModule {
  id: string;
  name: string;
  enabled: boolean;
  content: string;
  group?: PresetGroupId;
  isCustom?: boolean;
  isPersonalSlot?: boolean;
}

export type StoryImageTargetMode = 'scene' | 'npc' | 'mc' | 'custom';

export type BuiltInStoryImageStyle =
  | 'live_action_cinema'
  | 'neo_guofeng_impasto'
  | 'classic_impasto'
  | 'oil_painting'
  | 'anime_cg'
  | 'refined_realistic_cg'
  | 'rmji_high_cg'
  | 'cinema_still_ukiyoe'
  | 'cinema_still_vfx'
  | 'erliangjiu_manhua'
  | 'xianxia_exquisite'
  | 'xianxia_ink_wash'
  | '3d_ukiyoe'
  | 'xianxia_jade_flat'
  | 'character_sheet_multi'
  // Legacy IDs preserved for backward compatibility with older saves
  | 'cinematic'
  | 'anime'
  | 'watercolor'
  | 'realistic'
  | 'dark_fantasy'
  | 'custom';

export type StoryImageStyle = BuiltInStoryImageStyle | (string & {});

export type ImageCameraAngleId =
  | 'auto'
  | 'close_up'
  | 'medium_shot'
  | 'wide_shot'
  | 'low_angle'
  | 'high_angle'
  | 'over_shoulder'
  | 'dutch_angle';

export type ImageGridMode =
  | 'single'
  | 'grid_2'
  | 'grid_4'
  | 'character_sheet';

export type ImageGenerationMode =
  | 'scene'
  | 'portrait'
  | 'cinema_frame'
  | 'illustration'
  | 'custom';

export interface StoryImageStylePreset {
  id: StoryImageStyle;
  label: string;
  category: string;
  description: string;
  promptGuide: string;
  promptHint: string;
  isCustom?: boolean;
}

export interface ImageCameraAnglePreset {
  id: ImageCameraAngleId;
  label: string;
  description: string;
  promptGuide: string;
}

export interface StoryImageConfig {
  enabled: boolean;
  autoGenerate: boolean;
  targetMode: StoryImageTargetMode;
  selectedNpcId: string;
  customSubject: string;
  stylePreset: StoryImageStyle;
  size: string;
  cameraAngle?: ImageCameraAngleId;
  customStyles?: StoryImageStylePreset[];
  /**
   * Maps `style:<styleId>` or `angle:<angleId>` to either:
   * - `portrait:<portraitId>` (zero-overhead reference into PortraitBank)
   * - compressed data URL thumbnail (<= 420px WebP/JPEG)
   */
  sampleImages?: Record<string, string>;
  promptTemplate?: string;
  imageCount?: number;
  imageGridMode?: ImageGridMode;
  imageGenerationMode?: ImageGenerationMode;
}

export interface Turn {
  id: string;
  user: string;
  assistant: string;
  rawAssistant?: string;
  imageData?: string;
  imageCaption?: string;
  storyImageData?: string;
  storyImagePrompt?: string;
  storyImageSubject?: string;
  createdAt?: number;
  durationMs?: number;
  storyClockSnapshot?: string;
}

export interface PlayerInfo {
  name: string;
  pronoun: string;
  role?: string;
  description?: string;
  absentAtStart?: boolean;
}

export interface WorldInfo {
  name: string;
  genre?: WorldGenreId;
  genreLabel?: string;
  setting?: string;
  rules?: string;
  atmosphere?: string;
  dramaLevel?: DramaLevel;
  eraLabel?: string;
  openingScenario?: string;
}

export interface WorldSetupNpcDraft {
  id: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  initialLocation?: string;
  initialMood?: string;
}

export interface WorldSetupPayload {
  worldName: string;
  genre: WorldGenreId;
  genreLabel: string;
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
    autoAdvance: boolean;
  };
  mc: {
    name: string;
    pronoun: string;
    role: string;
    description: string;
    absentAtStart: boolean;
  };
  npcs: WorldSetupNpcDraft[];
  syncPortraitsAndStates: boolean;
  openingScenario: string;
  launchMode: WorldLaunchMode;
  enableMartialSystem?: boolean;
}

export type MemoryEntryCategory =
  | 'event'
  | 'relationship'
  | 'timeline'
  | 'detail';

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  category: MemoryEntryCategory;
  turnIndex?: number;
  pinned: boolean;
  updatedAt: number;
}

export interface CharacterStateSnapshot {
  id: string;
  name: string;
  isMc: boolean;
  location: string;
  mood: string;
  status: string;
  lastTurnIndex?: number;
  updatedAt: number;
}

export interface RollingSummaryData {
  content: string;
  summarizedUpToTurn: number;
  updatedAt: number;
}

export interface StoryClockState {
  enabled: boolean;
  autoAdvance: boolean;
  initialized: boolean;
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  eraLabel?: string;
  lastDeltaMinutes?: number;
  lastAdvanceReason?: string;
  lastTurnIndex?: number;
  updatedAt?: number;
}

export type CultivationSystemKind = 'xianxia' | 'xuanhuan' | 'wuxia';

export type TechniqueCategory = 'mental' | 'martial' | 'movement' | 'secret';

export type TechniqueTier =
  | 'pham'
  | 'linh'
  | 'huyen'
  | 'dia'
  | 'thien'
  | 'chiton';

export interface TechniqueMove {
  id: string;
  name: string;
  description?: string;
  level: number;
  maxLevel: number;
  mastery: number; // 0..100 (%)
}

export interface CultivationTechnique {
  id: string;
  name: string;
  category: TechniqueCategory;
  tier: TechniqueTier;
  level: number;
  maxLevel: number;
  mastery: number; // 0..100 (%)
  isActiveTraining: boolean;
  description?: string;
  moves?: TechniqueMove[];
}

export type InventoryItemQuality =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export type InventoryItemCategory =
  | 'consumable'
  | 'weapon'
  | 'material'
  | 'talisman'
  | 'misc';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  quality: InventoryItemQuality;
  category: InventoryItemCategory;
  description?: string;
}

export interface CultivationProfile {
  enabled: boolean;
  systemKind: CultivationSystemKind;
  realmIndex: number;
  realmName: string;
  energyLabel: string;
  exp: number;
  maxExp: number;
  readyToBreakthrough: boolean;
  autoProgressByClock: boolean;
  bagName: string;
  techniques: CultivationTechnique[];
  inventory: InventoryItem[];
  lastGainSummary?: string;
  lastUpdatedAt?: number;
}

export interface MemoryManagerConfig {
  enabled: boolean;
  autoMemory: boolean;
  autoStateTracker: boolean;
  autoRollingSummary: boolean;
  entries: MemoryEntry[];
  characterStates: CharacterStateSnapshot[];
  rollingSummary: RollingSummaryData;
  storyClock?: StoryClockState;
  cultivation?: CultivationProfile;
}

export interface CharacterPortrait {
  id: string;
  name: string;
  role: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  appearance: string;
  personality?: string;
  relationships?: string;
  signature?: string;
  appearanceManual?: boolean;
  profileManual?: boolean;
  isMc: boolean;
  npcId?: string;
  imageData?: string;
  prompt?: string;
  lastSeenTurnIndex?: number;
  autoGenerated?: boolean;
  updatedAt: number;
}

export interface PortraitBankConfig {
  autoGenerateOnAppear: boolean;
  maxAutoPerTurn: number;
  includeMcAuto: boolean;
  portraits: CharacterPortrait[];
}

export interface SaveSlot {
  id: string;
  name: string;
  savedAt: string;
  turns: Turn[];
  player: PlayerInfo;
  world: WorldInfo;
  memory?: MemoryManagerConfig;
  portraitBank?: PortraitBankConfig;
  tawaPreset?: TawaPreset;
}

export interface Checkpoint {
  savedAt: string;
  turns: Turn[];
  player: PlayerInfo;
  world: WorldInfo;
  memory?: MemoryManagerConfig;
  portraitBank?: PortraitBankConfig;
  context?: ContextConfig;
  activeCompanionId?: string;
  tawaPreset?: TawaPreset;
}

export interface CompanionNpc {
  id: string;
  name: string;
  role: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  desc: string;
  personality?: string;
  appearance?: string;
  relationships?: string;
  signature?: string;
  profileManual?: boolean;
}

export interface CanonCandidate {
  name: string;
  pronoun: string;
  gender: string;
  age: string;
  personality: string;
  appearance: string;
  role: string;
}

export interface CompanionMC {
  sourceMode?: McSourceMode;
  name: string;
  pronoun: string;
  roleType?: McRoleType;
  canonMcName?: string;
  originRole?: string;
  canonMcRelation?: string;
  gender: string;
  age: string;
  personality: string;
  appearance: string;
}

export interface CompanionProfile {
  id: string;
  name: string;
  role: string;
  sourceQuery: string;
  sourceContent: string;
  mc: CompanionMC;
  worldSetting: string;
  worldRules: string;
  npcs: CompanionNpc[];
  canonCandidates?: CanonCandidate[];
  note: string;
}

export interface AppConfig {
  proxyUrl: string;
  proxyKey: string;
  model: string;
  apiProtocol: ApiProtocol;
  seedreamUrl: string;
  seedreamApiKey?: string;
  seedreamModel: string;
  seedreamSize?: string;
  seedreamPrompt?: string;
  safetySettings: SafetySetting[];
}

export interface TawaPreset {
  modules: PresetModule[];
  prefillEnabled: boolean;
  prefill: string;
  exclusiveStyleMode?: boolean;
}

export interface ContextConfig {
  historyTurns: number;
  targetLength: string;
  entitiesNote: string;
}

export interface ArkState {
  activeView: ViewName;
  currentPage: number;
  streamEnabled: boolean;
  showRawTags: boolean;
  showPostMeta: boolean;
  hideBottomNav: boolean;
  lobbyBgDataUrl: string;
  storyImage: StoryImageConfig;
  memory: MemoryManagerConfig;
  portraitBank: PortraitBankConfig;
  player: PlayerInfo;
  world: WorldInfo;
  config: AppConfig;
  tawaPreset: TawaPreset;
  context: ContextConfig;
  turns: Turn[];
  slots: SaveSlot[];
  companions: CompanionProfile[];
  companionStories: Record<string, Turn[]>;
  companionMemories: Record<string, MemoryManagerConfig>;
  companionPortraits: Record<string, PortraitBankConfig>;
  activeCompanionId: string;
  activeStoryCompanionId?: string | null;
  checkpoint: Checkpoint | null;
}

export interface PendingImage {
  dataUrl: string;
  name: string;
}

export interface BannerMessage {
  text: string;
  type: 'info' | 'err';
}
