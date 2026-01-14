import { nowIso, randomId } from "./localAssets";

export const STORYBOARDS_STORAGE_KEY = "esg_storyboards_v1";
export const ACTIVE_STORYBOARD_ID_KEY = "esg_active_storyboard_id_v1";

export type StoryboardConfig = {
  occasionPreset: string;
  occasionDetails: string;
  colorScheme: string;
  accessories: string;
  stylePreset: string;
  styleKeywordsDetails: string;
  backgroundThemePreset: string;
  backgroundThemeDetails: string;
  selectedBackgroundId: string;
  modelPreset: string;
  modelDetails: string;
  selectedModelId: string;
  modelStylingPreset: string;
  modelStylingNotes: string;
  includeDebugStr: "no" | "yes";
};

export type StoryboardRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  config: StoryboardConfig;
};

export function createDefaultStoryboardConfig(): StoryboardConfig {
  return {
    occasionPreset: "",
    occasionDetails: "",
    colorScheme: "",
    accessories: "",
    stylePreset: "",
    styleKeywordsDetails: "",
    backgroundThemePreset: "",
    backgroundThemeDetails: "",
    selectedBackgroundId: "",
    modelPreset: "White / European",
    modelDetails: "",
    selectedModelId: "",
    modelStylingPreset: "",
    modelStylingNotes: "",
    includeDebugStr: "no",
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeConfig(value: unknown): StoryboardConfig {
  const base = createDefaultStoryboardConfig();
  const raw = (value ?? {}) as Record<string, unknown>;
  const includeDebugStr = asString(raw.includeDebugStr);
  return {
    occasionPreset: asString(raw.occasionPreset) ?? base.occasionPreset,
    occasionDetails: asString(raw.occasionDetails) ?? base.occasionDetails,
    colorScheme: asString(raw.colorScheme) ?? base.colorScheme,
    accessories: asString(raw.accessories) ?? base.accessories,
    stylePreset: asString(raw.stylePreset) ?? base.stylePreset,
    styleKeywordsDetails: asString(raw.styleKeywordsDetails) ?? base.styleKeywordsDetails,
    backgroundThemePreset: asString(raw.backgroundThemePreset) ?? base.backgroundThemePreset,
    backgroundThemeDetails: asString(raw.backgroundThemeDetails) ?? base.backgroundThemeDetails,
    selectedBackgroundId: asString(raw.selectedBackgroundId) ?? base.selectedBackgroundId,
    modelPreset: asString(raw.modelPreset) ?? base.modelPreset,
    modelDetails: asString(raw.modelDetails) ?? base.modelDetails,
    selectedModelId: asString(raw.selectedModelId) ?? base.selectedModelId,
    modelStylingPreset: asString(raw.modelStylingPreset) ?? base.modelStylingPreset,
    modelStylingNotes: asString(raw.modelStylingNotes) ?? base.modelStylingNotes,
    includeDebugStr: includeDebugStr === "yes" ? "yes" : "no",
  };
}

function normalizeStoryboard(value: unknown): StoryboardRecord | null {
  const raw = (value ?? {}) as Record<string, unknown>;
  const id = asString(raw.id);
  if (!id) return null;

  const title = asString(raw.title) ?? "Untitled";
  const createdAt = asString(raw.createdAt) ?? nowIso();
  const updatedAt = asString(raw.updatedAt) ?? createdAt;
  const config = normalizeConfig(raw.config);
  return { id, title, createdAt, updatedAt, config };
}

export function createStoryboardRecord(opts?: {
  title?: string;
  config?: Partial<StoryboardConfig>;
}): StoryboardRecord {
  const createdAt = nowIso();
  return {
    id: randomId(),
    title: (opts?.title || "").trim() || "New storyboard",
    createdAt,
    updatedAt: createdAt,
    config: {
      ...createDefaultStoryboardConfig(),
      ...(opts?.config ?? {}),
    },
  };
}

export function loadStoryboardsFromLocalStorage(): StoryboardRecord[] {
  const raw = localStorage.getItem(STORYBOARDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoryboard).filter(Boolean) as StoryboardRecord[];
  } catch {
    return [];
  }
}

export function saveStoryboardsToLocalStorage(storyboards: StoryboardRecord[]): void {
  localStorage.setItem(STORYBOARDS_STORAGE_KEY, JSON.stringify(storyboards));
}

export function loadActiveStoryboardIdFromLocalStorage(): string | null {
  const id = localStorage.getItem(ACTIVE_STORYBOARD_ID_KEY);
  return (id || "").trim() || null;
}

export function saveActiveStoryboardIdToLocalStorage(id: string): void {
  localStorage.setItem(ACTIVE_STORYBOARD_ID_KEY, (id || "").trim());
}
