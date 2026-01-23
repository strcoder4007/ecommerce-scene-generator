<template>
  <div class="appRoot">
    <div class="appShell">
      <aside class="sidebar">
        <div class="sidebarBrand">
          <div class="brandEyebrow">Studio</div>
          <div class="brandTitle">Fashion image Gen</div>
          <div class="brandSub">Ecommerce scene generator</div>
        </div>
        <nav class="sidebarNav" role="tablist" aria-label="Main sections">
          <button
            type="button"
            :class="activeTab === 'prints' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'prints'"
            @click="activeTab = 'prints'"
          >
            Prints
          </button>
          <button
            type="button"
            :class="activeTab === 'generate' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'generate'"
            @click="activeTab = 'generate'"
          >
            Generate
          </button>
          <button
            type="button"
            :class="activeTab === 'assets' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'assets'"
            @click="activeTab = 'assets'"
          >
            Assets
          </button>
        </nav>
      </aside>

      <main class="mainContent">
        <div class="container">
          <div class="header">
            <div>
              <h1 class="title titleLarge">{{ activeTabLabel }}</h1>
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

          <template v-else-if="activeTab === 'generate'">
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

          <template v-else>
            <div class="card assetsEmpty">
              <div class="resultEmpty">
                <div>
                  <div class="resultEmptyTitle">No assets yet</div>
                  <div class="muted">This space will hold brand assets, fabrics, and references.</div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>

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

import DeleteStoryboardModal from "./components/DeleteStoryboardModal.vue";
import ImageModal from "./components/ImageModal.vue";
import StoryboardLibrary from "./components/StoryboardLibrary.vue";
import StoryboardEditorHeader from "./components/StoryboardEditorHeader.vue";
import StoryboardFormCards from "./components/StoryboardFormCards.vue";
import StoryboardResultsPane from "./components/StoryboardResultsPane.vue";
import PrintsTab from "./components/PrintsTab.vue";

import { apiPost } from "./lib/api";
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
import { type LookPlan } from "./lib/pipeline";

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

function computeTimingsMs(timings: Record<string, number>): {
  textLlmMs: number;
  imageGenMs: number;
  totalMs: number;
} {
  const textLlmMs = (timings.plan ?? 0) + (timings.final_prompt ?? 0);
  const imageGenMs = (timings.garment_reference ?? 0) + (timings.composite ?? 0);
  const totalMs = textLlmMs + imageGenMs;
  return { textLlmMs, imageGenMs, totalMs };
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
type AppTab = "prints" | "generate" | "assets";
const storedTab = localStorage.getItem(ACTIVE_TAB_KEY) as AppTab | null;
const activeTab = ref<AppTab>(
  storedTab === "prints" || storedTab === "generate" || storedTab === "assets" ? storedTab : "prints",
);
const activeTabLabel = computed(() =>
  activeTab.value === "prints" ? "Prints" : activeTab.value === "assets" ? "Assets" : "Generate",
);
watch(
  activeTab,
  (value) => {
    localStorage.setItem(ACTIVE_TAB_KEY, value);
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
    const printDesignDataUrl =
      printInputKind === "color"
        ? createColorSwatchDataUrl(printColorHex!)
        : runtime.prints.printDesignDataUrl!;
    const res = await apiPost("/api/prints/generate", {
      baseGarmentDataUrl: runtime.prints.baseGarmentDataUrl,
      printDesignDataUrl,
      printColorHex: printColorHex || null,
      additionalPrompt: activeConfig.value.printAdditionalPrompt || "",
      ...(typeof retryComment === "string" ? { retryComment } : {}),
    });

    runtime.prints.outputMimeType = res?.output?.mimeType ?? null;
    runtime.prints.outputDataUrl = res?.output?.url ?? null;
    runtime.prints.timingsMs = typeof res?.timingsMs === "number" ? res.timingsMs : null;
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
    const res = await apiPost("/api/looks/angles", {
      garmentDataUrls: runtime.garmentDataUrls,
      garmentRefUrl: runtime.garmentRefDataUrl,
      mainImageUrl: runtime.resultDataUrl,
      plan: runtime.lastPlan,
      finalPrompt: runtime.lastFinalPrompt || "",
      hasModelReference: false,
      hasBackgroundReference: false,
    });

    runtime.angles.sideMimeType = res?.side?.mimeType ?? null;
    runtime.angles.sideDataUrl = res?.side?.url ?? null;
    runtime.angles.backMimeType = res?.back?.mimeType ?? null;
    runtime.angles.backDataUrl = res?.back?.url ?? null;
    runtime.angles.timingsMs = res?.timingsMs ?? null;
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

  if (!runtime.garmentDataUrls.length) {
    runtime.generateError = "Please select garment photos.";
    return;
  }

	  isGenerating.value = true;
	  generationStepIndex.value = 0;
	  startGenerationTimer();

  try {
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

    const res = await apiPost("/api/looks/generate", {
      garmentDataUrls: runtime.garmentDataUrls,
      overrides: userOverrides,
      styleKeywords: styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : [],
      accessories: activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : [],
      footwear: footwearFinal.value || null,
    });

    generationStepIndex.value = 3;

    runtime.lastPlan = res?.plan ? safeClone(res.plan) : null;
    runtime.lastFinalPrompt = res?.finalPrompt ?? null;
    runtime.garmentRefMimeType = res?.garmentRef?.mimeType ?? null;
    runtime.garmentRefDataUrl = res?.garmentRef?.url ?? null;
    runtime.resultMimeType = res?.result?.mimeType ?? null;
    runtime.resultDataUrl = res?.result?.url ?? null;
    runtime.resultTimingsMs = res?.timingsMs ?? null;
    runtime.chosenSummary = res?.chosenSummary ?? null;
    runtime.debugSummary = res?.debugSummary ?? null;
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

  if (!runtime.resultDataUrl || !runtime.garmentRefDataUrl || !runtime.lastPlan || !runtime.lastFinalPrompt) {
    runtime.generateError = "Generate the main image first, then you can retry.";
    return;
  }

  isGenerating.value = true;
  generationStepIndex.value = 3;
  startGenerationTimer();

  try {
    const overrides = {
      occasion: occasionFinal.value || null,
      color_scheme: activeConfig.value.colorScheme.trim() || null,
      background_theme: backgroundThemeFinal.value || null,
      footwear: footwearFinal.value || null,
      model_ethnicity: modelEthnicityFinal.value || null,
      model_pose: modelPoseFinal.value || null,
      model_styling_notes: modelStylingNotesFinal.value || null,
    };

    const res = await apiPost("/api/looks/retry", {
      plan: runtime.lastPlan,
      finalPrompt: runtime.lastFinalPrompt,
      retryComment,
      garmentRefUrl: runtime.garmentRefDataUrl,
      overrides,
      styleKeywords: styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : [],
      accessories: activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : [],
      footwear: footwearFinal.value || null,
    });

    runtime.lastPlan = res?.plan ? safeClone(res.plan) : runtime.lastPlan;
    runtime.resultMimeType = res?.result?.mimeType ?? null;
    runtime.resultDataUrl = res?.result?.url ?? null;
    runtime.angles = createDefaultAnglesRuntime();
    runtime.resultTimingsMs = res?.timingsMs ?? null;
    runtime.chosenSummary = res?.chosenSummary ?? null;
    runtime.debugSummary = res?.debugSummary ?? null;
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}
</script>
