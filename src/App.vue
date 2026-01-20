<template>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title titleLarge">Fashion image Gen</h1>
      </div>
      <ApiKeyInput v-model="geminiApiKey" />
    </div>

    <div class="tabRow">
      <div class="tabGroup" role="tablist" aria-label="Main tabs">
        <button
          type="button"
          :class="activeTab === 'prints' ? 'tabButton tabButtonActive' : 'tabButton'"
          :aria-selected="activeTab === 'prints'"
          @click="activeTab = 'prints'"
        >
          Prints
        </button>
        <button
          type="button"
          :class="activeTab === 'generate' ? 'tabButton tabButtonActive' : 'tabButton'"
          :aria-selected="activeTab === 'generate'"
          @click="activeTab = 'generate'"
        >
          Generate
        </button>
      </div>
    </div>

    <template v-if="activeTab === 'prints'">
      <PrintsTab
        :storyboard-title="activeStoryboard.title"
        :config="activeConfig"
        :runtime="activeRuntime"
        :is-busy="isGenerating || activeRuntime.prints.generating"
        :mime-to-extension="mimeToExtension"
        :on-base-garment-file-change="onPrintBaseGarmentFileChange"
        :on-print-design-file-change="onPrintDesignFileChange"
        :remove-base-garment="removePrintBaseGarment"
        :remove-print-design="removePrintDesign"
        @generate="generatePrintedGarment"
        @retry="retryPrintedGarment"
        @go-generate="activeTab = 'generate'"
        @open-image="(src, title) => openImageModal(src, title, title)"
      />
    </template>

    <template v-else>
      <div>
        <StoryboardLibrary
          v-if="generateView === 'library'"
          :storyboards="storyboards"
          :active-id="activeStoryboardId"
          :runtime-by-id="storyboardRuntime"
          :is-generating="isGenerating"
          :subtitle-for="storyboardSubtitle"
          :format-timestamp="formatStoryboardTimestamp"
          @create="createNewStoryboard"
          @open="openStoryboard"
        />

        <div v-else class="card storyboardEditorCard">
          <StoryboardEditorHeader
            :title="activeStoryboard.title"
            :updated-at="activeStoryboard.updatedAt"
            :disabled="isGenerating"
            :can-delete="storyboards.length > 1"
            :format-timestamp="formatStoryboardTimestamp"
            @back="enterStoryboardLibrary"
            @duplicate="duplicateActiveStoryboard"
            @request-delete="requestDeleteActiveStoryboard"
            @update:title="(v) => (activeStoryboard.title = v)"
          />

          <div class="divider storyboardEditorDivider" aria-hidden="true"></div>

          <div class="storyboardEditorCardBody">
            <div class="grid storyBoard">
              <StoryboardFormCards
                :config="activeConfig"
                :runtime="activeRuntime"
                :active-storyboard-id="activeStoryboardId"
                :is-generating="isGenerating"
                :on-garment-file-change="onGarmentFileChange"
                :remove-garment-image="removeGarmentImage"
                @submit="onGenerateLook"
              />

              <StoryboardResultsPane
                :is-generating="isGenerating"
                :generation-step-index="generationStepIndex"
                :generation-elapsed-ms="generationElapsedMs"
                :generation-steps="GENERATION_STEPS"
                :runtime="activeRuntime"
                :computed-timings="computedTimings"
                :format-duration-ms="formatDurationMs"
                :mime-to-extension="mimeToExtension"
                :on-result-image-pointer-move="onResultImagePointerMove"
                :on-result-image-pointer-leave="onResultImagePointerLeave"
                @open-image="openImageModal"
                @retry="retryMainImage"
                @generate-angles="generateMultipleAngles"
                @download-all="downloadAllImages"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <ImageModal
      :open="Boolean(imageModal)"
      :src="imageModal?.src || ''"
      :title="imageModal?.title || ''"
      :alt="imageModal?.alt"
      @close="closeImageModal"
    />
    <DeleteStoryboardModal
      :open="deleteStoryboardModalOpen"
      :title="activeStoryboard.title"
      @close="closeDeleteStoryboardModal"
      @confirm="confirmDeleteActiveStoryboard"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import ApiKeyInput from "./components/ApiKeyInput.vue";
import DeleteStoryboardModal from "./components/DeleteStoryboardModal.vue";
import ImageModal from "./components/ImageModal.vue";
import StoryboardLibrary from "./components/StoryboardLibrary.vue";
import StoryboardEditorHeader from "./components/StoryboardEditorHeader.vue";
import StoryboardFormCards from "./components/StoryboardFormCards.vue";
import StoryboardResultsPane from "./components/StoryboardResultsPane.vue";
import PrintsTab from "./components/PrintsTab.vue";

import { base64ToBytes, dataUrlToInlineImage, generateImage } from "./lib/gemini";
import {
  footwearPresetKeywordsByValue,
  footwearPresetLabelByValue,
  modelStylingPresetLabelByValue,
  modelPosePresetLabelByValue,
  occasionPresetLabelByValue,
  stylePresetLabelByValue,
} from "./lib/presets";
import { fileToDataUrl, normalizeHexColor, nowIso, parseTags as parseLocalTags } from "./lib/utils";
import {
  createStoryboardRecord,
  loadActiveStoryboardIdFromLocalStorage,
  loadStoryboardsFromLocalStorage,
  saveActiveStoryboardIdToLocalStorage,
  saveStoryboardsToLocalStorage,
  type StoryboardRecord,
} from "./lib/storyboards";
import {
  applyFreeformOverrides,
  buildCompositePrompt,
  buildPrintApplicationPrompt,
  buildGarmentReferencePrompt,
  buildRetryCompositePrompt,
  buildMultiAnglePrompt,
  computeTimingsMs,
  generateFinalPrompt,
  planLookFromGarment,
  type LookPlan,
} from "./lib/pipeline";

const GENERATION_STEPS = [
  "Getting all the configurations",
  "Thinking",
  "Compositing a scene",
  "Generating image",
] as const;

function mimeToExtension(mimeType: string | null): string {
  const mt = (mimeType || "").toLowerCase().trim();
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("jpeg") || mt.includes("jpg")) return "jpg";
  return "png";
}

function formatDurationMs(ms: number | null | undefined): string {
  const safe = typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
  const seconds = safe / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds - wholeMinutes * 60);
  return `${wholeMinutes}m ${remainingSeconds}s`;
}

function combinePresetAndCustom(opts: { presetText: string; customText: string; joiner?: string }): string {
  const p = (opts.presetText || "").trim();
  const c = (opts.customText || "").trim();
  if (!p) return c;
  if (!c) return p;
  return `${p}${opts.joiner ?? ", "}${c}`;
}

function createColorSwatchDataUrl(hexColor: string): string {
  const canvas = document.createElement("canvas");
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support canvas color swatches.");
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, size, size);
  return canvas.toDataURL("image/png");
}

const generateView = ref<"library" | "editor">("library");

const ACTIVE_TAB_KEY = "esg_active_tab_v1";
const activeTab = ref<"prints" | "generate">(
  (localStorage.getItem(ACTIVE_TAB_KEY) as "prints" | "generate" | null) || "prints",
);
watch(
  activeTab,
  (value) => {
    localStorage.setItem(ACTIVE_TAB_KEY, value);
  },
  { flush: "post" },
);

const geminiApiKey = ref(localStorage.getItem("gemini_api_key") || "");
watch(
  geminiApiKey,
  (value) => {
    const trimmed = (value || "").trim();
    localStorage.setItem("gemini_api_key", trimmed);
  },
  { flush: "post" },
);

			type StoryboardAnglesRuntime = {
			  generating: boolean;
			  error: string | null;
			  sideDataUrl: string | null;
			  sideMimeType: string | null;
			  backDataUrl: string | null;
			  backMimeType: string | null;
			  timingsMs: { side: number; back: number; total: number } | null;
			};

			type StoryboardPrintsRuntime = {
			  baseGarmentDataUrl: string | null;
			  baseGarmentFileName: string | null;
			  printDesignDataUrl: string | null;
			  printDesignFileName: string | null;
			  outputDataUrl: string | null;
			  outputMimeType: string | null;
			  generating: boolean;
			  error: string | null;
			  timingsMs: number | null;
			};

			type StoryboardRuntime = {
			  garmentDataUrls: string[];
			  garmentFileNames: string[];
			  garmentRefDataUrl: string | null;
			  garmentRefMimeType: string | null;
			  lastPlan: LookPlan | null;
			  lastFinalPrompt: string | null;
			  prints: StoryboardPrintsRuntime;
			  angles: StoryboardAnglesRuntime;
			  generateError: string | null;
			  chosenSummary: any;
			  debugSummary: any;
			  resultDataUrl: string | null;
		  resultMimeType: string | null;
		  resultTimingsMs: Record<string, number> | null;
		};

			function createDefaultAnglesRuntime(): StoryboardAnglesRuntime {
			  return {
			    generating: false,
			    error: null,
			    sideDataUrl: null,
			    sideMimeType: null,
			    backDataUrl: null,
			    backMimeType: null,
			    timingsMs: null,
			  };
			}

			function createDefaultPrintsRuntime(): StoryboardPrintsRuntime {
			  return {
			    baseGarmentDataUrl: null,
			    baseGarmentFileName: null,
			    printDesignDataUrl: null,
			    printDesignFileName: null,
			    outputDataUrl: null,
			    outputMimeType: null,
			    generating: false,
			    error: null,
			    timingsMs: null,
			  };
			}

			function createDefaultRuntime(): StoryboardRuntime {
			  return {
			    garmentDataUrls: [],
			    garmentFileNames: [],
			    garmentRefDataUrl: null,
			    garmentRefMimeType: null,
			    lastPlan: null,
			    lastFinalPrompt: null,
			    prints: createDefaultPrintsRuntime(),
			    angles: createDefaultAnglesRuntime(),
			    generateError: null,
			    chosenSummary: null,
			    debugSummary: null,
			    resultDataUrl: null,
		    resultMimeType: null,
		    resultTimingsMs: null,
		  };
		}

const storyboards = ref<StoryboardRecord[]>([]);
const activeStoryboardId = ref("");

function loadInitialStoryboards(): { storyboards: StoryboardRecord[]; activeId: string } {
  const loaded = loadStoryboardsFromLocalStorage();
  const ensured = loaded.length ? loaded : [createStoryboardRecord({ title: "Storyboard 1" })];

  const savedActive = loadActiveStoryboardIdFromLocalStorage();
  const activeId =
    savedActive && ensured.some((sb) => sb.id === savedActive) ? savedActive : ensured[0]!.id;

  return { storyboards: ensured, activeId };
}

const initialStoryboards = loadInitialStoryboards();
storyboards.value = initialStoryboards.storyboards;
activeStoryboardId.value = initialStoryboards.activeId;

const storyboardRuntime = ref<Record<string, StoryboardRuntime>>(
  Object.fromEntries(storyboards.value.map((sb) => [sb.id, createDefaultRuntime()])),
);

const activeStoryboard = computed(() => {
  const found = storyboards.value.find((sb) => sb.id === activeStoryboardId.value);
  return found || storyboards.value[0]!;
});

const activeConfig = computed(() => activeStoryboard.value.config);
const activeRuntime = computed(() => storyboardRuntime.value[activeStoryboardId.value]!);

const deleteStoryboardModalOpen = ref(false);
type ImageModalState = { src: string; title: string; alt: string };
const imageModal = ref<ImageModalState | null>(null);

function openImageModal(src: string | null | undefined, title: string, alt?: string) {
  if (!src) return;
  imageModal.value = { src, title, alt: alt ?? title };
}

function closeImageModal() {
  imageModal.value = null;
}

function onGlobalKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && imageModal.value) closeImageModal();
}

function removeGarmentImage(index: number) {
  const runtime = activeRuntime.value;
  if (!runtime.garmentDataUrls.length) return;
  if (index < 0 || index >= runtime.garmentDataUrls.length) return;
  runtime.garmentDataUrls.splice(index, 1);
  runtime.garmentFileNames.splice(index, 1);
}

function safeClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

function formatStoryboardTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

	function storyboardSubtitle(sb: StoryboardRecord): string {
	  const cfg = sb.config;
	  const parts: string[] = [];

		  const occasionPresetLabel =
		    cfg.occasionPreset && cfg.occasionPreset !== "custom"
		      ? occasionPresetLabelByValue[cfg.occasionPreset] ?? cfg.occasionPreset
		      : "";
		  const occasion =
		    cfg.occasionPreset === "custom"
		      ? cfg.occasionDetails.trim()
		      : combinePresetAndCustom({ presetText: occasionPresetLabel, customText: cfg.occasionDetails, joiner: ", " });
		  if (occasion) parts.push(`Occasion: ${occasion}`);

	  const color = cfg.colorScheme.trim();
	  if (color) parts.push(`Colors: ${color}`);

	  const stylePresetText =
	    cfg.stylePreset && cfg.stylePreset !== "custom"
	      ? stylePresetLabelByValue[cfg.stylePreset] ?? cfg.stylePreset
	      : "";
	  const styleKeywords =
	    cfg.stylePreset === "custom"
	      ? cfg.styleKeywordsDetails.trim()
	      : combinePresetAndCustom({ presetText: stylePresetText, customText: cfg.styleKeywordsDetails, joiner: ", " });
	  if (styleKeywords) parts.push(`Style: ${styleKeywords}`);

	  const bgTheme =
	    cfg.backgroundThemePreset === "custom"
	      ? cfg.backgroundThemeDetails.trim()
	      : combinePresetAndCustom({
	          presetText: cfg.backgroundThemePreset,
	          customText: cfg.backgroundThemeDetails,
	          joiner: ", ",
	        });
	  if (bgTheme) parts.push(`BG: ${bgTheme}`);

		  const accessories = cfg.accessories.trim();
		  if (accessories) parts.push(`Accessories: ${accessories}`);

			  const footwearPresetLabel =
			    cfg.footwearPreset && cfg.footwearPreset !== "custom"
			      ? footwearPresetLabelByValue[cfg.footwearPreset] ?? cfg.footwearPreset
			      : "";
			  const footwear =
			    cfg.footwearPreset === "custom"
			      ? cfg.footwearDetails.trim()
			      : combinePresetAndCustom({
			          presetText: footwearPresetLabel,
			          customText: cfg.footwearDetails,
			          joiner: ", ",
			        });
			  if (footwear) parts.push(`Footwear: ${footwear}`);

	  const ethnicity =
	    cfg.modelPreset === "custom"
	      ? cfg.modelDetails.trim()
	      : combinePresetAndCustom({ presetText: cfg.modelPreset, customText: cfg.modelDetails, joiner: ", " });
	  if (ethnicity) parts.push(`Model: ${ethnicity}`);

    const modelPosePresetLabel =
      cfg.modelPosePreset && cfg.modelPosePreset !== "custom"
        ? modelPosePresetLabelByValue[cfg.modelPosePreset] ?? cfg.modelPosePreset
        : "";
    const modelPose =
      cfg.modelPosePreset === "custom"
        ? cfg.modelPoseDetails.trim()
        : combinePresetAndCustom({ presetText: modelPosePresetLabel, customText: cfg.modelPoseDetails, joiner: ", " });
    if (modelPose) parts.push(`Pose: ${modelPose}`);

		  const stylingPresetText =
		    cfg.modelStylingPreset && cfg.modelStylingPreset !== "custom"
		      ? modelStylingPresetLabelByValue[cfg.modelStylingPreset] ?? cfg.modelStylingPreset
		      : "";
	  const styling =
	    cfg.modelStylingPreset === "custom"
	      ? cfg.modelStylingNotes.trim()
	      : combinePresetAndCustom({
	          presetText: stylingPresetText,
	          customText: cfg.modelStylingNotes,
	          joiner: ", ",
	        });
	  if (styling) parts.push(`Styling: ${styling}`);

	  return parts.join("\n") || "No settings yet";
	}

	function openStoryboard(id: string) {
	  if (isGenerating.value) return;
	  if (!storyboards.value.some((sb) => sb.id === id)) return;
	  activeStoryboardId.value = id;
	  generateView.value = "editor";
	}

	function enterStoryboardLibrary() {
	  if (isGenerating.value) return;
	  generateView.value = "library";
	}

function uniqueTitle(base: string): string {
  const cleanedBase = (base || "").trim() || "Storyboard";
  const existing = new Set(storyboards.value.map((sb) => sb.title.trim().toLowerCase()).filter(Boolean));
  if (!existing.has(cleanedBase.toLowerCase())) return cleanedBase;

  let n = 2;
  while (existing.has(`${cleanedBase} ${n}`.toLowerCase())) n += 1;
  return `${cleanedBase} ${n}`;
}

	function createNewStoryboard() {
	  const sb = createStoryboardRecord({ title: uniqueTitle(`Storyboard ${storyboards.value.length + 1}`) });
	  storyboards.value.unshift(sb);
	  storyboardRuntime.value[sb.id] = createDefaultRuntime();
	  activeStoryboardId.value = sb.id;
	  generateView.value = "editor";
	}

		function duplicateActiveStoryboard() {
		  const src = activeStoryboard.value;
		  const dst = createStoryboardRecord({ title: uniqueTitle(`${src.title} (copy)`), config: { ...src.config } });
		  storyboards.value.unshift(dst);
			  storyboardRuntime.value[dst.id] = {
			    ...createDefaultRuntime(),
			    garmentDataUrls: [...activeRuntime.value.garmentDataUrls],
			    garmentFileNames: [...activeRuntime.value.garmentFileNames],
			    garmentRefDataUrl: activeRuntime.value.garmentRefDataUrl,
			    garmentRefMimeType: activeRuntime.value.garmentRefMimeType,
			    lastPlan: activeRuntime.value.lastPlan ? safeClone(activeRuntime.value.lastPlan) : null,
			    lastFinalPrompt: activeRuntime.value.lastFinalPrompt,
			    prints: safeClone(activeRuntime.value.prints),
			    angles: {
			      ...createDefaultAnglesRuntime(),
			      sideDataUrl: activeRuntime.value.angles.sideDataUrl,
			      sideMimeType: activeRuntime.value.angles.sideMimeType,
			      backDataUrl: activeRuntime.value.angles.backDataUrl,
		      backMimeType: activeRuntime.value.angles.backMimeType,
		      timingsMs: activeRuntime.value.angles.timingsMs ? { ...activeRuntime.value.angles.timingsMs } : null,
		    },
		    chosenSummary: safeClone(activeRuntime.value.chosenSummary),
		    debugSummary: safeClone(activeRuntime.value.debugSummary),
		    resultDataUrl: activeRuntime.value.resultDataUrl,
		    resultMimeType: activeRuntime.value.resultMimeType,
		    resultTimingsMs: activeRuntime.value.resultTimingsMs ? { ...activeRuntime.value.resultTimingsMs } : null,
		  };
		  activeStoryboardId.value = dst.id;
		}

function requestDeleteActiveStoryboard() {
  if (storyboards.value.length <= 1) return;
  deleteStoryboardModalOpen.value = true;
}

function closeDeleteStoryboardModal() {
  deleteStoryboardModalOpen.value = false;
}

function confirmDeleteActiveStoryboard() {
  const id = activeStoryboardId.value;
  if (!id) return;
  if (storyboards.value.length <= 1) {
    deleteStoryboardModalOpen.value = false;
    return;
  }

  const idx = storyboards.value.findIndex((sb) => sb.id === id);
  if (idx !== -1) storyboards.value.splice(idx, 1);
  delete storyboardRuntime.value[id];

  const next = storyboards.value[Math.max(0, idx - 1)] || storyboards.value[0];
  if (next) activeStoryboardId.value = next.id;

  deleteStoryboardModalOpen.value = false;
}

let storyboardSaveTimer: number | null = null;

function schedulePersistStoryboards() {
  if (storyboardSaveTimer) window.clearTimeout(storyboardSaveTimer);
  storyboardSaveTimer = window.setTimeout(() => {
    try {
      saveStoryboardsToLocalStorage(storyboards.value);
    } catch {
      // Ignore localStorage quota errors; storyboards will remain in memory.
    }
  }, 250);
}

watch(activeStoryboardId, (id) => saveActiveStoryboardIdToLocalStorage(id), { flush: "post" });
watch(storyboards, schedulePersistStoryboards, { deep: true, flush: "post" });

watch(
  () => [activeStoryboardId.value, activeStoryboard.value.title, activeStoryboard.value.config] as const,
  (next, prev) => {
    if (!prev) return;
    if (next[0] !== prev[0]) return;
    activeStoryboard.value.updatedAt = nowIso();
  },
  { deep: true, flush: "post" },
);

// Ensure persisted defaults exist for first-time users.
try {
  saveStoryboardsToLocalStorage(storyboards.value);
  saveActiveStoryboardIdToLocalStorage(activeStoryboardId.value);
} catch {
  // Ignore localStorage quota errors; storyboards will remain in memory.
}

async function onGarmentFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const files = Array.from(input?.files ?? []);
  const storyboardId = activeStoryboardId.value;
  const runtime = storyboardRuntime.value[storyboardId];
  if (!runtime) return;

  runtime.generateError = null;

  if (!files.length) {
    if (input) input.value = "";
    return;
  }

  const MAX = 4;
  const remaining = Math.max(0, MAX - runtime.garmentDataUrls.length);
  if (!remaining) {
    runtime.generateError = "You can upload up to 4 garment photos. Remove one to add more.";
    if (input) input.value = "";
    return;
  }

  const limited = files.slice(0, remaining);
  const dataUrls = await Promise.all(limited.map((f) => fileToDataUrl(f)));
  runtime.garmentFileNames.push(...limited.map((f) => f.name || "garment"));
  runtime.garmentDataUrls.push(...dataUrls);

  if (input) input.value = "";
}

async function onPrintBaseGarmentFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  if (!file) {
    if (input) input.value = "";
    return;
  }

  runtime.prints.baseGarmentFileName = file.name || "base-garment";
  runtime.prints.baseGarmentDataUrl = await fileToDataUrl(file);
  runtime.prints.outputDataUrl = null;
  runtime.prints.outputMimeType = null;
  runtime.prints.timingsMs = null;

  if (input) input.value = "";
}

async function onPrintDesignFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  if (!file) {
    if (input) input.value = "";
    return;
  }

  runtime.prints.printDesignFileName = file.name || "print-design";
  runtime.prints.printDesignDataUrl = await fileToDataUrl(file);
  runtime.prints.outputDataUrl = null;
  runtime.prints.outputMimeType = null;
  runtime.prints.timingsMs = null;

  if (input) input.value = "";
}

function removePrintBaseGarment() {
  const runtime = activeRuntime.value;
  runtime.prints.baseGarmentDataUrl = null;
  runtime.prints.baseGarmentFileName = null;
  runtime.prints.outputDataUrl = null;
  runtime.prints.outputMimeType = null;
  runtime.prints.timingsMs = null;
  runtime.prints.error = null;
}

function removePrintDesign() {
  const runtime = activeRuntime.value;
  runtime.prints.printDesignDataUrl = null;
  runtime.prints.printDesignFileName = null;
  runtime.prints.outputDataUrl = null;
  runtime.prints.outputMimeType = null;
  runtime.prints.timingsMs = null;
  runtime.prints.error = null;
}

async function generatePrintedGarment(retryComment?: string) {
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  const apiKey = geminiApiKey.value.trim();
  if (!apiKey) {
    runtime.prints.error = "Please paste your API key (BYO key).";
    return;
  }

  if (!runtime.prints.baseGarmentDataUrl) {
    runtime.prints.error = "Please upload a white garment photo.";
    return;
  }

  const printInputKind = activeConfig.value.printInputKind;
  const printColorHex =
    printInputKind === "color" ? normalizeHexColor(activeConfig.value.printColorHex || "") : null;

  if (printInputKind === "color") {
    if (!printColorHex) {
      runtime.prints.error = "Please enter a hex color (e.g. #FF3366).";
      return;
    }
  } else if (!runtime.prints.printDesignDataUrl) {
    runtime.prints.error = "Please upload a print/design image (or switch to Colors).";
    return;
  }

  runtime.prints.generating = true;
  runtime.prints.outputDataUrl = null;
  runtime.prints.outputMimeType = null;
  runtime.prints.timingsMs = null;

	  try {
	    const baseInline = dataUrlToInlineImage(runtime.prints.baseGarmentDataUrl);
	    const images =
	      printInputKind === "color"
	        ? [baseInline, dataUrlToInlineImage(createColorSwatchDataUrl(printColorHex!))]
	        : [baseInline, dataUrlToInlineImage(runtime.prints.printDesignDataUrl!)];

	    const prompt = buildPrintApplicationPrompt({
	      additionalPrompt: activeConfig.value.printAdditionalPrompt || "",
	      ...(printColorHex ? { colorHex: printColorHex } : {}),
      ...(typeof retryComment === "string" ? { retryComment } : {}),
    });

    const t0 = performance.now();
	    const out = await generateImage({
	      apiKey,
	      model: "gemini-3-pro-image-preview",
	      promptText: prompt,
	      images,
	      timeoutMs: 180_000,
	    });
    runtime.prints.timingsMs = Math.round(performance.now() - t0);

    runtime.prints.outputMimeType = out.mimeType;
    runtime.prints.outputDataUrl = `data:${out.mimeType};base64,${out.imageBase64}`;
  } catch (err: any) {
    runtime.prints.error = err?.message || String(err);
  } finally {
    runtime.prints.generating = false;
  }
}

async function retryPrintedGarment(retryComment: string) {
  return generatePrintedGarment(retryComment);
}

const isGenerating = ref(false);

const generationStepIndex = ref(0);
const generationElapsedMs = ref(0);
let generationInterval: number | null = null;

function startGenerationTimer() {
  if (generationInterval) window.clearInterval(generationInterval);
  const startedAt = performance.now();
  generationElapsedMs.value = 0;
  generationInterval = window.setInterval(() => {
    generationElapsedMs.value = performance.now() - startedAt;
  }, 100);
}

function stopGenerationTimer() {
  if (generationInterval) window.clearInterval(generationInterval);
  generationInterval = null;
}

onBeforeUnmount(() => {
  if (generationInterval) window.clearInterval(generationInterval);
  if (storyboardSaveTimer) window.clearTimeout(storyboardSaveTimer);
  window.removeEventListener("keydown", onGlobalKeyDown);
});

function clearResult() {
  const runtime = activeRuntime.value;
  runtime.resultDataUrl = null;
  runtime.resultMimeType = null;
  runtime.garmentRefDataUrl = null;
  runtime.garmentRefMimeType = null;
  runtime.lastPlan = null;
  runtime.lastFinalPrompt = null;
  runtime.angles = createDefaultAnglesRuntime();
  runtime.chosenSummary = null;
  runtime.debugSummary = null;
  runtime.resultTimingsMs = null;
  runtime.generateError = null;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadAllImages() {
  const runtime = activeRuntime.value;
  if (!runtime.resultDataUrl) return;
  if (!runtime.angles.sideDataUrl || !runtime.angles.backDataUrl) return;

  const ts = Date.now();
  triggerDownload(runtime.resultDataUrl, `look-main-${ts}.${mimeToExtension(runtime.resultMimeType)}`);
  triggerDownload(runtime.angles.sideDataUrl, `look-side-${ts}.${mimeToExtension(runtime.angles.sideMimeType)}`);
  triggerDownload(runtime.angles.backDataUrl, `look-back-${ts}.${mimeToExtension(runtime.angles.backMimeType)}`);
}

async function generateMultipleAngles() {
  const runtime = activeRuntime.value;
  if (isGenerating.value) return;
  if (runtime.angles.generating) return;

  runtime.angles.error = null;

  const apiKey = geminiApiKey.value.trim();
  if (!apiKey) {
    runtime.angles.error = "Please paste your API key (BYO key).";
    return;
  }
  if (!runtime.resultDataUrl) {
    runtime.angles.error = "Generate the main image first.";
    return;
  }
  if (!runtime.garmentRefDataUrl) {
    runtime.angles.error = "Missing garment reference. Please generate the main image again.";
    return;
  }
  if (!runtime.lastPlan) {
    runtime.angles.error = "Missing generation context. Please generate the main image again.";
    return;
  }

  runtime.angles.generating = true;
  runtime.angles.sideDataUrl = null;
  runtime.angles.sideMimeType = null;
  runtime.angles.backDataUrl = null;
  runtime.angles.backMimeType = null;
  runtime.angles.timingsMs = null;

  try {
    const garmentRefInline = dataUrlToInlineImage(runtime.garmentRefDataUrl);
    const garmentAnglesInline = runtime.garmentDataUrls.map((src) => dataUrlToInlineImage(src));
    const mainInline = dataUrlToInlineImage(runtime.resultDataUrl);

    const referenceImages = [garmentRefInline, ...garmentAnglesInline, mainInline];

    const promptBase = {
      plan: runtime.lastPlan,
      finalPrompt: runtime.lastFinalPrompt || "",
      garmentAngleCount: garmentAnglesInline.length,
      hasModelReference: false,
      hasBackgroundReference: false,
    } as const;

    const sidePrompt = buildMultiAnglePrompt({ ...promptBase, angle: "side" });
    const backPrompt = buildMultiAnglePrompt({ ...promptBase, angle: "back" });

    const t0 = performance.now();
    const [sideRes, backRes] = await Promise.all([
      (async () => {
        const t = performance.now();
	        const res = await generateImage({
	          apiKey,
	          model: "gemini-3-pro-image-preview",
	          promptText: sidePrompt,
	          images: referenceImages,
	          aspectRatio: "3:4",
	          width: 1080,
	          height: 1440,
	          timeoutMs: 180_000,
	        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
      (async () => {
        const t = performance.now();
	        const res = await generateImage({
	          apiKey,
	          model: "gemini-3-pro-image-preview",
	          promptText: backPrompt,
	          images: referenceImages,
	          aspectRatio: "3:4",
	          width: 1080,
	          height: 1440,
	          timeoutMs: 180_000,
	        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
    ]);

    runtime.angles.sideMimeType = sideRes.res.mimeType;
    runtime.angles.sideDataUrl = `data:${sideRes.res.mimeType};base64,${sideRes.res.imageBase64}`;
    runtime.angles.backMimeType = backRes.res.mimeType;
    runtime.angles.backDataUrl = `data:${backRes.res.mimeType};base64,${backRes.res.imageBase64}`;
    runtime.angles.timingsMs = {
      side: sideRes.ms,
      back: backRes.ms,
      total: Math.round(performance.now() - t0),
    };
  } catch (err: any) {
    runtime.angles.error = err?.message || String(err);
  } finally {
    runtime.angles.generating = false;
  }
}

function onResultImagePointerMove(event: PointerEvent) {
  if (event.pointerType && event.pointerType !== "mouse") return;
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const clampedX = Math.max(0, Math.min(100, x));
  const clampedY = Math.max(0, Math.min(100, y));
  el.style.setProperty("--zoom-x", `${clampedX.toFixed(2)}%`);
  el.style.setProperty("--zoom-y", `${clampedY.toFixed(2)}%`);
}

function onResultImagePointerLeave(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  el.style.setProperty("--zoom-x", "50%");
  el.style.setProperty("--zoom-y", "50%");
}

const computedTimings = computed(() => computeTimingsMs(activeRuntime.value.resultTimingsMs || {}));

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeyDown);
});

// Derived inputs
const occasionFinal = computed(() =>
  activeConfig.value.occasionPreset === "custom"
    ? activeConfig.value.occasionDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.occasionPreset,
        customText: activeConfig.value.occasionDetails,
        joiner: ", ",
      }),
);

const footwearFinal = computed(() =>
  activeConfig.value.footwearPreset === "custom"
    ? activeConfig.value.footwearDetails.trim()
    : combinePresetAndCustom({
        presetText:
          footwearPresetKeywordsByValue[activeConfig.value.footwearPreset] ?? activeConfig.value.footwearPreset,
        customText: activeConfig.value.footwearDetails,
        joiner: ", ",
      }),
);

const stylePresetText = computed(() =>
  activeConfig.value.stylePreset && activeConfig.value.stylePreset !== "custom"
    ? activeConfig.value.stylePreset
    : "",
);

const styleKeywordsFinal = computed(() =>
  activeConfig.value.stylePreset === "custom"
    ? activeConfig.value.styleKeywordsDetails.trim()
    : combinePresetAndCustom({
        presetText: stylePresetText.value,
        customText: activeConfig.value.styleKeywordsDetails,
        joiner: ", ",
      }),
);

const backgroundThemeFinal = computed(() =>
  activeConfig.value.backgroundThemePreset === "custom"
    ? activeConfig.value.backgroundThemeDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.backgroundThemePreset,
        customText: activeConfig.value.backgroundThemeDetails,
        joiner: ", ",
      }),
);

const modelEthnicityFinal = computed(() =>
  activeConfig.value.modelPreset === "custom"
    ? activeConfig.value.modelDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.modelPreset,
        customText: activeConfig.value.modelDetails,
        joiner: ", ",
      }),
);

const modelPoseFinal = computed(() =>
  activeConfig.value.modelPosePreset === "custom"
    ? activeConfig.value.modelPoseDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.modelPosePreset,
        customText: activeConfig.value.modelPoseDetails,
        joiner: ", ",
      }),
);

const modelStylingPresetText = computed(() =>
  activeConfig.value.modelStylingPreset && activeConfig.value.modelStylingPreset !== "custom"
    ? activeConfig.value.modelStylingPreset
    : "",
);

const modelStylingNotesFinal = computed(() =>
  activeConfig.value.modelStylingPreset === "custom"
    ? activeConfig.value.modelStylingNotes.trim()
    : combinePresetAndCustom({
        presetText: modelStylingPresetText.value,
        customText: activeConfig.value.modelStylingNotes,
        joiner: ", ",
      }),
);

async function onGenerateLook() {
  const runtime = activeRuntime.value;

  runtime.generateError = null;
  runtime.garmentRefDataUrl = null;
  runtime.garmentRefMimeType = null;
  runtime.lastPlan = null;
  runtime.lastFinalPrompt = null;
  runtime.angles = createDefaultAnglesRuntime();
  runtime.chosenSummary = null;
  runtime.debugSummary = null;
  runtime.resultDataUrl = null;
  runtime.resultMimeType = null;
  runtime.resultTimingsMs = null;

	  if (!geminiApiKey.value.trim()) {
	    runtime.generateError = "Please paste your API key (BYO key).";
	    return;
	  }
		    if (!runtime.garmentDataUrls.length) {
		      runtime.generateError = "Please select garment photos.";
		      return;
		    }

	  isGenerating.value = true;
	  generationStepIndex.value = 0;
	  startGenerationTimer();

  const timings: Record<string, number> = {};
  const debug: any = {};
  let planError: string | null = null;

  try {
    generationStepIndex.value = 0;

	    const garmentDataUrls = runtime.garmentDataUrls;
	    if (!garmentDataUrls.length) {
	      runtime.generateError = "Please select garment photos.";
	      return;
	    }
	    const garmentInlines = garmentDataUrls.map((src) => dataUrlToInlineImage(src));

    const availableThemes: string[] = [];
    const availableEthnicities: string[] = [];

    generationStepIndex.value = 1;

			    const userOverrides = {
			      occasion: occasionFinal.value || null,
			      color_scheme: activeConfig.value.colorScheme.trim() || null,
			      background_theme: backgroundThemeFinal.value || null,
			      footwear: footwearFinal.value || null,
			      model_ethnicity: modelEthnicityFinal.value || null,
            model_pose: modelPoseFinal.value || null,
			      model_styling_notes: modelStylingNotesFinal.value || null,
			    };

    let plan: LookPlan;
    const tPlan0 = performance.now();
    try {
	      const planRes = await planLookFromGarment({
	        apiKey: geminiApiKey.value,
	        model: "gemini-3-flash-preview",
	        garmentImages: garmentInlines,
	        availableBackgroundThemes: availableThemes,
	        availableModelEthnicities: availableEthnicities,
	        userOverrides,
	        timeoutMs: 120_000,
	      });
      plan = planRes.plan;
      debug.plan_raw_text = planRes.rawText;
      debug.plan_raw_json = planRes.rawJson;
    } catch (err: any) {
      planError = err?.message || String(err);
      const ov = userOverrides;
		      plan = {
		        occasion: ov.occasion || "casual",
		        color_scheme: ov.color_scheme || "neutral",
		        print_style: "as-is",
		        style_keywords: [],
		        background_theme: ov.background_theme || ov.occasion || "casual",
		        footwear: ov.footwear || "",
		        accessories: [],
		        negative_prompt:
		          "blurry, low quality, incorrect garment, altered design, wrong print, extra limbs, deformed hands, text overlay, watermark",
		        model_ethnicity: ov.model_ethnicity || "",
		        model_pose: ov.model_pose || "",
		        model_styling_notes: ov.model_styling_notes || "",
		      };
		    }
    timings.plan = Math.round(performance.now() - tPlan0);

	    plan = applyFreeformOverrides(plan, {
	      styleKeywords: styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : undefined,
	      accessories: activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : undefined,
	      footwear: footwearFinal.value || null,
	    });

	    runtime.lastPlan = safeClone(plan);

    const tFinalPrompt0 = performance.now();
    const finalPromptRes = await generateFinalPrompt({
      apiKey: geminiApiKey.value,
      model: "gemini-3-flash-preview",
      plan,
      background: null,
      chosenModel: null,
      hasBackgroundReference: false,
      hasModelReference: false,
      timeoutMs: 120_000,
    });
	    timings.final_prompt = Math.round(performance.now() - tFinalPrompt0);
	    debug.final_prompt = finalPromptRes.prompt;
	    runtime.lastFinalPrompt = finalPromptRes.prompt;

    generationStepIndex.value = 2;

	    const garmentRefPrompt = buildGarmentReferencePrompt();
	    const tGarment0 = performance.now();
		    const garmentRef = await generateImage({
		      apiKey: geminiApiKey.value,
		      model: "gemini-3-pro-image-preview",
		      promptText: garmentRefPrompt,
		      images: garmentInlines,
		      aspectRatio: "3:4",
		      width: 1080,
		      height: 1440,
		      timeoutMs: 180_000,
		    });
	    timings.garment_reference = Math.round(performance.now() - tGarment0);
	    runtime.garmentRefMimeType = garmentRef.mimeType;
	    runtime.garmentRefDataUrl = `data:${garmentRef.mimeType};base64,${garmentRef.imageBase64}`;

	    const garmentRefBytes = base64ToBytes(garmentRef.imageBase64);

    const compositeImages: Array<{ mimeType: string; data: Uint8Array }> = [
      { mimeType: garmentRef.mimeType, data: garmentRefBytes },
    ];

    const compositePrompt = buildCompositePrompt({
      plan,
      finalPrompt: finalPromptRes.prompt,
      hasModelReference: false,
      hasBackgroundReference: false,
    });
    debug.composite_prompt = compositePrompt;
    debug.negative_prompt = plan.negative_prompt;

    generationStepIndex.value = 3;
    const tComposite0 = performance.now();
	    const composite = await generateImage({
	      apiKey: geminiApiKey.value,
	      model: "gemini-3-pro-image-preview",
	      promptText: compositePrompt,
	      images: compositeImages,
	      aspectRatio: "3:4",
	      width: 1080,
	      height: 1440,
	      timeoutMs: 180_000,
	    });
    timings.composite = Math.round(performance.now() - tComposite0);

    runtime.resultMimeType = composite.mimeType;
    runtime.resultDataUrl = `data:${composite.mimeType};base64,${composite.imageBase64}`;

    runtime.resultTimingsMs = {
      ...timings,
      api_total: Object.values(timings).reduce((a, b) => a + b, 0),
    };

		    runtime.chosenSummary = {
		      occasion: plan.occasion,
		      color_scheme: plan.color_scheme,
		      print_style: plan.print_style,
		      style_keywords: plan.style_keywords,
		      footwear: plan.footwear,
		      accessories: plan.accessories,
		      background_theme: plan.background_theme,
		      model_ethnicity: plan.model_ethnicity,
		      model_pose: plan.model_pose,
		    };

	    runtime.debugSummary = {
	      timings_ms: runtime.resultTimingsMs,
	      plan_error: planError,
	      ...debug,
	    };
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}

async function retryMainImage(retryComment: string) {
  const runtime = activeRuntime.value;
  runtime.generateError = null;

  if (!geminiApiKey.value.trim()) {
    runtime.generateError = "Please paste your API key (BYO key).";
    return;
  }
  if (!runtime.resultDataUrl || !runtime.garmentRefDataUrl || !runtime.lastPlan || !runtime.lastFinalPrompt) {
    runtime.generateError = "Generate the main image first, then you can retry.";
    return;
  }

  isGenerating.value = true;
  generationStepIndex.value = 3;
  startGenerationTimer();

  const timings: Record<string, number> = {};
  const debug: any = { retry_comment: (retryComment || "").trim() };

  try {
    const basePlan = safeClone(runtime.lastPlan);
    let plan: LookPlan = basePlan;

    const occasionOverride = (occasionFinal.value || "").trim();
    if (occasionOverride) plan.occasion = occasionOverride;

    const colorOverride = activeConfig.value.colorScheme.trim();
    if (colorOverride) plan.color_scheme = colorOverride;

    const backgroundOverride = (backgroundThemeFinal.value || "").trim();
    if (backgroundOverride) plan.background_theme = backgroundOverride;

    const footwearOverride = (footwearFinal.value || "").trim();
    if (footwearOverride) plan.footwear = footwearOverride;

    const modelOverride = (modelEthnicityFinal.value || "").trim();
    if (modelOverride) plan.model_ethnicity = modelOverride;

    const poseOverride = (modelPoseFinal.value || "").trim();
    if (poseOverride) plan.model_pose = poseOverride;

    const stylingNotesOverride = (modelStylingNotesFinal.value || "").trim();
    if (stylingNotesOverride) plan.model_styling_notes = stylingNotesOverride;

    plan = applyFreeformOverrides(plan, {
      styleKeywords: styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : undefined,
      accessories: activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : undefined,
      footwear: footwearOverride || null,
    });

    runtime.lastPlan = safeClone(plan);

    const compositePrompt = buildRetryCompositePrompt({
      plan,
      finalPrompt: runtime.lastFinalPrompt || "",
      hasModelReference: false,
      hasBackgroundReference: false,
      retryComment,
    });
    debug.composite_prompt = compositePrompt;
    debug.final_prompt = runtime.lastFinalPrompt;
    debug.negative_prompt = plan.negative_prompt;

    generationStepIndex.value = 3;
    const t0 = performance.now();
    const garmentRefInline = dataUrlToInlineImage(runtime.garmentRefDataUrl);
    const composite = await generateImage({
      apiKey: geminiApiKey.value,
      model: "gemini-3-pro-image-preview",
      promptText: compositePrompt,
      images: [garmentRefInline],
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180_000,
    });
    timings.composite = Math.round(performance.now() - t0);

    runtime.resultMimeType = composite.mimeType;
    runtime.resultDataUrl = `data:${composite.mimeType};base64,${composite.imageBase64}`;

    runtime.angles = createDefaultAnglesRuntime();

    runtime.resultTimingsMs = {
      ...timings,
      api_total: Object.values(timings).reduce((a, b) => a + b, 0),
    };

    runtime.chosenSummary = {
      occasion: plan.occasion,
      color_scheme: plan.color_scheme,
      print_style: plan.print_style,
      style_keywords: plan.style_keywords,
      footwear: plan.footwear,
      accessories: plan.accessories,
      background_theme: plan.background_theme,
      model_ethnicity: plan.model_ethnicity,
      model_pose: plan.model_pose,
    };

    runtime.debugSummary = {
      timings_ms: runtime.resultTimingsMs,
      ...debug,
    };
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}
</script>
