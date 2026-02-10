<template>
  <div class="appRoot">
    <div
      class="saveToast"
      :class="{ saveToastVisible: saveToast.visible }"
      role="status"
      aria-live="polite"
      :aria-hidden="!saveToast.visible"
    >
      {{ saveToast.message }}
    </div>
    <div class="appShell">
      <aside class="sidebar">
        <div class="sidebarBrand">
          <div class="brandEyebrow">AI Studio</div>
          <div class="brandTitle">Fashion Image Generator</div>
        </div>
        <nav class="sidebarNav" role="tablist" aria-label="Main sections">
          <button
            type="button"
            :class="activeTab === 'prints' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'prints'"
            @click="activeTab = 'prints'"
          >
            Add Prints
          </button>
          <button
            type="button"
            :class="activeTab === 'generate' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'generate'"
            @click="activeTab = 'generate'"
          >
            Generate Images
          </button>
          <button
            type="button"
            :class="activeTab === 'saved' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'saved'"
            @click="activeTab = 'saved'"
          >
            Saved images
          </button>
          <button
            type="button"
            :class="activeTab === 'assets' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'assets'"
            @click="activeTab = 'assets'"
          >
            Uploaded Assets
          </button>
          <button
            type="button"
            :class="activeTab === 'api' ? 'navButton navButtonActive' : 'navButton'"
            :aria-selected="activeTab === 'api'"
            @click="activeTab = 'api'"
          >
            API Key
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
              :on-base-garment-front-file-change="onPrintBaseGarmentFrontFileChange"
              :on-base-garment-back-file-change="onPrintBaseGarmentBackFileChange"
              :on-base-garment-side-file-change="onPrintBaseGarmentSideFileChange"
              :on-print-design-file-change="onPrintDesignFileChange"
              :remove-base-garment-front="removePrintBaseGarmentFront"
              :remove-base-garment-back="removePrintBaseGarmentBack"
              :remove-base-garment-side="removePrintBaseGarmentSide"
              :remove-print-design="removePrintDesign"
              :print-elapsed-ms="printGenerationElapsedMs"
              @generate="generatePrintedGarment"
              @retry="retryPrintedGarment"
              @save="savePrintedGarment"
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

              <div v-else class="storyboardEditorCard">
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
                      :remove-background-image="removeBackgroundImage"
                      :remove-model-image="removeModelImage"
                      :saved-prints="savedPrints"
                      :background-asset-images="backgroundAssetImages"
                      :model-asset-images="modelAssetImages"
                      :add-garment-from-data-url="addGarmentFromDataUrl"
                      :add-background-from-data-url="addBackgroundFromDataUrl"
                      :add-model-from-data-url="addModelFromDataUrl"
                      @submit="onGenerateLook"
                      @open-image="openImageModal"
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
                      @save-image="saveMainImage"
                      @retry="retryMainImage"
                      @generate-angles="generateMultipleAngles"
                      @download-all="downloadAllImages"
                      @save-all="saveAllImages"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'saved'">
            <SavedImagesPane
              :images="savedImages"
              :format-timestamp="formatSavedTimestamp"
              :mime-to-extension="mimeToExtension"
              @open-image="openImageModal"
              @delete-image="deleteImage"
            />
          </template>

          <template v-else-if="activeTab === 'api'">
            <div class="card">
              <div class="sectionTitle" style="margin-top: 0">API Key</div>
              <div class="title" style="font-size: 18px; margin: 0">Connect API</div>
              <div class="muted" style="margin-top: 6px">
                Paste your Gemini API key. It is stored locally in your browser and used for all generation requests.
              </div>
              <div style="margin-top: 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <ApiKeyInput v-model="apiKey" />
                <div class="badge" style="margin-left: auto;">
                  <span>Status</span>
                  <code>{{ apiKey ? "Configured" : "Missing" }}</code>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="card">
              <div class="sectionTitle" style="margin-top: 0">Uploaded assets</div>
              <div class="title" style="font-size: 18px; margin: 0">Backgrounds and models</div>
              <div class="muted" style="margin-top: 6px">
                Upload reference images for the active storyboard. The first background and first model are used during generation.
              </div>

              <div class="row" style="margin-top: 20px">
                <div>
                  <FieldLabel
                    htmlFor="assetsBackgroundPhoto"
                    label="Background references"
                    info="Upload 1–4 background images to lock a setting or mood."
                  />
                  <input
                    id="assetsBackgroundPhoto"
                    type="file"
                    accept="image/*"
                    multiple
                    @change="onBackgroundFileChange"
                  />

                  <div v-if="activeRuntime.backgroundDataUrls.length" style="margin-top: 12px">
                    <label>Background preview</label>
                    <div class="preview previewAssets">
                      <div
                        v-for="(src, idx) in activeRuntime.backgroundDataUrls"
                        :key="`${activeStoryboardId}-bg-asset-${idx}`"
                        class="previewItem"
                      >
                        <img
                          :src="src"
                          :alt="`Background reference ${idx + 1}`"
                          draggable="false"
                          @click="openImageModal(src, 'Background reference', 'Background reference')"
                        />
                        <button
                          type="button"
                          class="removePreviewButton"
                          @click="removeBackgroundImage(idx)"
                          :aria-label="`Remove background image ${idx + 1}`"
                          title="Remove image"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M18 6 6 18" />
                            <path d="M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel
                    htmlFor="assetsModelPhoto"
                    label="Model references"
                    info="Upload 1–4 model reference images to preserve identity and styling."
                  />
                  <input
                    id="assetsModelPhoto"
                    type="file"
                    accept="image/*"
                    multiple
                    @change="onModelFileChange"
                  />

                  <div v-if="activeRuntime.modelDataUrls.length" style="margin-top: 12px">
                    <label>Model preview</label>
                    <div class="preview previewAssets">
                      <div
                        v-for="(src, idx) in activeRuntime.modelDataUrls"
                        :key="`${activeStoryboardId}-model-asset-${idx}`"
                        class="previewItem"
                      >
                        <img
                          :src="src"
                          :alt="`Model reference ${idx + 1}`"
                          draggable="false"
                          @click="openImageModal(src, 'Model reference', 'Model reference')"
                        />
                        <button
                          type="button"
                          class="removePreviewButton"
                          @click="removeModelImage(idx)"
                          :aria-label="`Remove model image ${idx + 1}`"
                          title="Remove image"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M18 6 6 18" />
                            <path d="M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="divider" style="margin: 32px 0"></div>

              <div class="assetLibrary">
                <div class="title" style="font-size: 18px; margin: 0">Asset Library</div>
                <div class="muted" style="margin-top: 6px">
                  History of all background and model images you've uploaded.
                </div>

                <div v-if="!assetImages.length" class="savedImagesSectionEmpty" style="margin-top: 20px">
                  <div class="muted">No assets uploaded yet.</div>
                </div>

                <div v-else>
                  <div v-if="backgroundAssetImages.length" style="margin-top: 20px">
                    <div class="sectionTitle" style="margin: 0 0 12px">Backgrounds</div>
                    <div class="savedImagesGrid compactGrid">
                      <div v-for="image in backgroundAssetImages" :key="image.id" class="savedImageCard">
                        <div class="savedImagePreviewContainer">
                          <button
                            type="button"
                            class="savedImagePreview"
                            @click="openImageModal(image.url, image.title)"
                          >
                            <img :src="image.url" :alt="image.title" draggable="false" />
                          </button>
                          <div class="savedImageOverlay">
                            <button
                              type="button"
                              class="overlayButton"
                              @click="openImageModal(image.url, image.title)"
                              title="Maximize"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              class="overlayButton danger"
                              @click="deleteImage(image.id)"
                              title="Delete asset"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div class="savedImageMeta">
                          <div class="savedImageTitle">{{ image.title }}</div>
                          <div class="savedImageSub">{{ formatKind(image.kind) }}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="modelAssetImages.length" style="margin-top: 20px">
                    <div class="sectionTitle" style="margin: 0 0 12px">Models</div>
                    <div class="savedImagesGrid compactGrid">
                      <div v-for="image in modelAssetImages" :key="image.id" class="savedImageCard">
                        <div class="savedImagePreviewContainer">
                          <button
                            type="button"
                            class="savedImagePreview"
                            @click="openImageModal(image.url, image.title)"
                          >
                            <img :src="image.url" :alt="image.title" draggable="false" />
                          </button>
                          <div class="savedImageOverlay">
                            <button
                              type="button"
                              class="overlayButton"
                              @click="openImageModal(image.url, image.title)"
                              title="Maximize"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              class="overlayButton danger"
                              @click="deleteImage(image.id)"
                              title="Delete asset"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div class="savedImageMeta">
                          <div class="savedImageTitle">{{ image.title }}</div>
                          <div class="savedImageSub">{{ formatKind(image.kind) }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
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
import FieldLabel from "./components/FieldLabel.vue";
import ImageModal from "./components/ImageModal.vue";
import ApiKeyInput from "./components/ApiKeyInput.vue";
import StoryboardLibrary from "./components/StoryboardLibrary.vue";
import StoryboardEditorHeader from "./components/StoryboardEditorHeader.vue";
import StoryboardFormCards from "./components/StoryboardFormCards.vue";
import StoryboardResultsPane from "./components/StoryboardResultsPane.vue";
import PrintsTab from "./components/PrintsTab.vue";
import SavedImagesPane from "./components/SavedImagesPane.vue";

import { base64ToBytes, dataUrlToInlineImage, generateImage } from "./lib/gemini";
import {
  footwearPresetKeywordsByValue,
  footwearPresetLabelByValue,
  modelStylingPresetLabelByValue,
  modelPosePresetLabelByValue,
  occasionPresetLabelByValue,
  stylePresetLabelByValue,
} from "./lib/presets";
import { dataUrlToBlob, fileToDataUrl, normalizeHexColor, nowIso, parseTags as parseLocalTags } from "./lib/utils";
import { listSavedImages, saveImageRecord, type SavedImageRecord } from "./lib/indexeddb";
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
  buildGarmentReferencePrompt,
  buildMultiAnglePrompt,
  buildPrintApplicationPrompt,
  buildRetryCompositePrompt,
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

function combineBottomWear(preset: string, details: string, isCustom: boolean): string {
  const p = (preset || "").trim();
  const d = (details || "").trim();
  if (isCustom) return d;
  if (!p) return d;
  if (!d) return p;
  if (d.toLowerCase().includes(p.toLowerCase())) return d;
  return `${d} ${p}`.trim();
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
const API_KEY_STORAGE_KEY = "esg_api_key_v1";
type AppTab = "prints" | "generate" | "assets" | "saved" | "api";
const storedTab = localStorage.getItem(ACTIVE_TAB_KEY) as AppTab | null;
const activeTab = ref<AppTab>(
  storedTab === "prints" ||
    storedTab === "generate" ||
    storedTab === "assets" ||
    storedTab === "saved" ||
    storedTab === "api"
    ? storedTab
    : "prints",
);
const activeTabLabel = computed(() =>
  activeTab.value === "prints"
    ? "Add Prints"
    : activeTab.value === "assets"
      ? "Uploaded Assets"
      : activeTab.value === "saved"
        ? "Saved images"
        : activeTab.value === "api"
          ? "Add API Key"
          : "Generate Images",
);
watch(
  activeTab,
  (value) => {
    localStorage.setItem(ACTIVE_TAB_KEY, value);
  },
  { flush: "post" },
);

const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
const apiKey = ref(storedApiKey);
watch(
  apiKey,
  (value) => {
    const trimmed = (value || "").trim();
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
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
			  baseGarmentFrontDataUrl: string | null;
			  baseGarmentFrontFileName: string | null;
			  baseGarmentBackDataUrl: string | null;
			  baseGarmentBackFileName: string | null;
			  baseGarmentSideDataUrl: string | null;
			  baseGarmentSideFileName: string | null;
			  printDesignDataUrl: string | null;
			  printDesignFileName: string | null;
			  outputFrontDataUrl: string | null;
			  outputFrontMimeType: string | null;
			  outputBackDataUrl: string | null;
			  outputBackMimeType: string | null;
			  outputSideDataUrl: string | null;
			  outputSideMimeType: string | null;
			  generating: boolean;
			  error: string | null;
			  timingsMs: number | null;
			};

			type StoryboardRuntime = {
			  garmentDataUrls: string[];
			  garmentFileNames: string[];
			  backgroundDataUrls: string[];
			  backgroundFileNames: string[];
			  modelDataUrls: string[];
			  modelFileNames: string[];
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
			    baseGarmentFrontDataUrl: null,
			    baseGarmentFrontFileName: null,
			    baseGarmentBackDataUrl: null,
			    baseGarmentBackFileName: null,
			    baseGarmentSideDataUrl: null,
			    baseGarmentSideFileName: null,
			    printDesignDataUrl: null,
			    printDesignFileName: null,
			    outputFrontDataUrl: null,
			    outputFrontMimeType: null,
			    outputBackDataUrl: null,
			    outputBackMimeType: null,
			    outputSideDataUrl: null,
			    outputSideMimeType: null,
			    generating: false,
			    error: null,
			    timingsMs: null,
			  };
			}

			function createDefaultRuntime(): StoryboardRuntime {
			  return {
			    garmentDataUrls: [],
			    garmentFileNames: [],
			    backgroundDataUrls: [],
			    backgroundFileNames: [],
			    modelDataUrls: [],
			    modelFileNames: [],
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

type SavedImageView = SavedImageRecord & { url: string };
const savedImages = ref<SavedImageView[]>([]);

const saveToast = ref({ visible: false, message: "" });
let saveToastTimer: number | null = null;

function showSaveToast(message: string) {
  saveToast.value.message = message;
  saveToast.value.visible = true;
  if (saveToastTimer) window.clearTimeout(saveToastTimer);
  saveToastTimer = window.setTimeout(() => {
    saveToast.value.visible = false;
  }, 2200);
}

function toSavedImageView(record: SavedImageRecord): SavedImageView {
  return { ...record, url: URL.createObjectURL(record.blob) };
}

function setSavedImages(records: SavedImageRecord[]) {
  for (const img of savedImages.value) {
    URL.revokeObjectURL(img.url);
  }
  savedImages.value = records.map((record) => toSavedImageView(record));
}

async function loadSavedImages() {
  const records = await listSavedImages();
  setSavedImages(records);
}

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

function removeBackgroundImage(index: number) {
  const runtime = activeRuntime.value;
  if (!runtime.backgroundDataUrls.length) return;
  if (index < 0 || index >= runtime.backgroundDataUrls.length) return;
  runtime.backgroundDataUrls.splice(index, 1);
  runtime.backgroundFileNames.splice(index, 1);
}

function removeModelImage(index: number) {
  const runtime = activeRuntime.value;
  if (!runtime.modelDataUrls.length) return;
  if (index < 0 || index >= runtime.modelDataUrls.length) return;
  runtime.modelDataUrls.splice(index, 1);
  runtime.modelFileNames.splice(index, 1);
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

function formatSavedTimestamp(ms: number): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function requireApiKey(setError?: (message: string) => void): string | null {
  const key = (apiKey.value || "").trim();
  if (key) return key;
  if (setError) {
    setError("Add your API key in the API Key tab to generate images.");
  }
  return null;
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

		  const bottomWear =
		    combineBottomWear(cfg.bottomWearPreset, cfg.bottomWearDetails, cfg.bottomWearPreset === "custom");
		  if (bottomWear) parts.push(`Bottom wear: ${bottomWear}`);

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
			    backgroundDataUrls: [...activeRuntime.value.backgroundDataUrls],
			    backgroundFileNames: [...activeRuntime.value.backgroundFileNames],
			    modelDataUrls: [...activeRuntime.value.modelDataUrls],
			    modelFileNames: [...activeRuntime.value.modelFileNames],
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

function createThumbnail(dataUrl: string, width = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = width / img.width;
      canvas.width = width;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

const savedPrints = computed(() => savedImages.value.filter((img) => img.kind === "prints"));
const assetImages = computed(() => savedImages.value.filter((img) => img.kind?.startsWith("asset-")));
const backgroundAssetImages = computed(() => savedImages.value.filter((img) => img.kind === "asset-background"));
const modelAssetImages = computed(() => savedImages.value.filter((img) => img.kind === "asset-model"));

function formatKind(kind: string): string {
  if (kind === "asset-background") return "Background";
  if (kind === "asset-model") return "Model";
  return (kind || "").replace(/_/g, " ").trim();
}

import { deleteSavedImage } from "./lib/indexeddb";

async function deleteImage(id: string) {
  if (!confirm("Are you sure you want to delete this image?")) return;
  try {
    await deleteSavedImage(id);
    const idx = savedImages.value.findIndex(img => img.id === id);
    if (idx !== -1) {
      const img = savedImages.value[idx];
      URL.revokeObjectURL(img.url);
      savedImages.value.splice(idx, 1);
    }
  } catch (e) {
    console.error("Failed to delete image", e);
  }
}

async function addGarmentFromDataUrl(url: string, fileName: string) {
  const runtime = activeRuntime.value;
  if (!runtime) return;

  const MAX = 4;
  const remaining = Math.max(0, MAX - runtime.garmentDataUrls.length);
  if (!remaining) {
    runtime.generateError = "You can upload up to 4 garment photos. Remove one to add more.";
    return;
  }

  // If the url is a blob URL, we need to convert it to base64 for the runtime
  let dataUrl = url;
  if (url.startsWith("blob:")) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      dataUrl = await fileToDataUrl(new File([blob], fileName, { type: blob.type }));
    } catch (e) {
      console.error("Failed to convert blob to data url", e);
      return;
    }
  }

  runtime.garmentFileNames.push(fileName);
  runtime.garmentDataUrls.push(dataUrl);
  runtime.generateError = null;
}

async function addBackgroundFromDataUrl(url: string, fileName: string) {
  const runtime = activeRuntime.value;
  if (!runtime) return;

  const MAX = 4;
  const remaining = Math.max(0, MAX - runtime.backgroundDataUrls.length);
  if (!remaining) return;

  let dataUrl = url;
  if (url.startsWith("blob:")) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      dataUrl = await fileToDataUrl(new File([blob], fileName, { type: blob.type }));
    } catch (e) {
      console.error("Failed to convert blob to data url", e);
      return;
    }
  }

  runtime.backgroundFileNames.push(fileName);
  runtime.backgroundDataUrls.push(dataUrl);
}

async function addModelFromDataUrl(url: string, fileName: string) {
  const runtime = activeRuntime.value;
  if (!runtime) return;

  const MAX = 4;
  const remaining = Math.max(0, MAX - runtime.modelDataUrls.length);
  if (!remaining) return;

  let dataUrl = url;
  if (url.startsWith("blob:")) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      dataUrl = await fileToDataUrl(new File([blob], fileName, { type: blob.type }));
    } catch (e) {
      console.error("Failed to convert blob to data url", e);
      return;
    }
  }

  runtime.modelFileNames.push(fileName);
  runtime.modelDataUrls.push(dataUrl);
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

async function onBackgroundFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const files = Array.from(input?.files ?? []);
  const runtime = activeRuntime.value;

  if (!files.length) {
    if (input) input.value = "";
    return;
  }

  const MAX = 4;
  const remaining = Math.max(0, MAX - runtime.backgroundDataUrls.length);
  if (!remaining) {
    if (input) input.value = "";
    return;
  }

  const limited = files.slice(0, remaining);
  const dataUrls = await Promise.all(limited.map((f) => fileToDataUrl(f)));
  runtime.backgroundFileNames.push(...limited.map((f) => f.name || "background"));
  runtime.backgroundDataUrls.push(...dataUrls);

  // Save to DB
  for (let i = 0; i < limited.length; i++) {
    const file = limited[i];
    await saveImageRecord({
      title: file.name || "Uploaded Background",
      kind: "asset-background",
      mimeType: file.type,
      blob: file,
      createdAt: Date.now(),
    }).then(record => {
      savedImages.value.unshift(toSavedImageView(record));
    }).catch(console.error);
  }

  if (input) input.value = "";
}

async function onModelFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const files = Array.from(input?.files ?? []);
  const runtime = activeRuntime.value;

  if (!files.length) {
    if (input) input.value = "";
    return;
  }

  const MAX = 4;
  const remaining = Math.max(0, MAX - runtime.modelDataUrls.length);
  if (!remaining) {
    if (input) input.value = "";
    return;
  }

  const limited = files.slice(0, remaining);
  const dataUrls = await Promise.all(limited.map((f) => fileToDataUrl(f)));
  runtime.modelFileNames.push(...limited.map((f) => f.name || "model"));
  runtime.modelDataUrls.push(...dataUrls);

  // Save to DB
  for (let i = 0; i < limited.length; i++) {
    const file = limited[i];
    await saveImageRecord({
      title: file.name || "Uploaded Model",
      kind: "asset-model",
      mimeType: file.type,
      blob: file,
      createdAt: Date.now(),
    }).then(record => {
      savedImages.value.unshift(toSavedImageView(record));
    }).catch(console.error);
  }

  if (input) input.value = "";
}

function resetPrintOutputs() {
  const prints = activeRuntime.value.prints;
  prints.outputFrontDataUrl = null;
  prints.outputFrontMimeType = null;
  prints.outputBackDataUrl = null;
  prints.outputBackMimeType = null;
  prints.outputSideDataUrl = null;
  prints.outputSideMimeType = null;
  prints.timingsMs = null;
}

async function onPrintBaseGarmentFrontFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  if (!file) {
    if (input) input.value = "";
    return;
  }

  runtime.prints.baseGarmentFrontFileName = file.name || "base-garment-front";
  runtime.prints.baseGarmentFrontDataUrl = await fileToDataUrl(file);
  resetPrintOutputs();

  if (input) input.value = "";
}

async function onPrintBaseGarmentBackFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  if (!file) {
    if (input) input.value = "";
    return;
  }

  runtime.prints.baseGarmentBackFileName = file.name || "base-garment-back";
  runtime.prints.baseGarmentBackDataUrl = await fileToDataUrl(file);
  resetPrintOutputs();

  if (input) input.value = "";
}

async function onPrintBaseGarmentSideFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  if (!file) {
    if (input) input.value = "";
    return;
  }

  runtime.prints.baseGarmentSideFileName = file.name || "base-garment-side";
  runtime.prints.baseGarmentSideDataUrl = await fileToDataUrl(file);
  resetPrintOutputs();

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
  resetPrintOutputs();

  if (input) input.value = "";
}

function removePrintBaseGarmentFront() {
  const runtime = activeRuntime.value;
  runtime.prints.baseGarmentFrontDataUrl = null;
  runtime.prints.baseGarmentFrontFileName = null;
  resetPrintOutputs();
  runtime.prints.error = null;
}

function removePrintBaseGarmentBack() {
  const runtime = activeRuntime.value;
  runtime.prints.baseGarmentBackDataUrl = null;
  runtime.prints.baseGarmentBackFileName = null;
  resetPrintOutputs();
  runtime.prints.error = null;
}

function removePrintBaseGarmentSide() {
  const runtime = activeRuntime.value;
  runtime.prints.baseGarmentSideDataUrl = null;
  runtime.prints.baseGarmentSideFileName = null;
  resetPrintOutputs();
  runtime.prints.error = null;
}

function removePrintDesign() {
  const runtime = activeRuntime.value;
  runtime.prints.printDesignDataUrl = null;
  runtime.prints.printDesignFileName = null;
  resetPrintOutputs();
  runtime.prints.error = null;
}

const printGenerationElapsedMs = ref(0);
let printGenerationInterval: number | null = null;

function startPrintGenerationTimer() {
  if (printGenerationInterval) window.clearInterval(printGenerationInterval);
  const startedAt = performance.now();
  printGenerationElapsedMs.value = 0;
  printGenerationInterval = window.setInterval(() => {
    printGenerationElapsedMs.value = performance.now() - startedAt;
  }, 100);
}

function stopPrintGenerationTimer() {
  if (printGenerationInterval) window.clearInterval(printGenerationInterval);
  printGenerationInterval = null;
}

async function generatePrintedGarment(retryComment?: string) {
  const runtime = activeRuntime.value;
  runtime.prints.error = null;

  const apiKeyValue = requireApiKey((message) => {
    runtime.prints.error = message;
  });
  if (!apiKeyValue) return;

  if (!runtime.prints.baseGarmentFrontDataUrl) {
    runtime.prints.error = "Please upload a front view white garment photo.";
    return;
  }
  if (!runtime.prints.baseGarmentBackDataUrl) {
    runtime.prints.error = "Please upload a back view white garment photo.";
    return;
  }
  if (!runtime.prints.baseGarmentSideDataUrl) {
    runtime.prints.error = "Please upload a side view white garment photo.";
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
  resetPrintOutputs();
  startPrintGenerationTimer();

  try {
    const printDesignDataUrl =
      printInputKind === "color"
        ? createColorSwatchDataUrl(printColorHex!)
        : runtime.prints.printDesignDataUrl!;
    const printInline = dataUrlToInlineImage(printDesignDataUrl);
    const prompt = buildPrintApplicationPrompt({
      additionalPrompt: activeConfig.value.printAdditionalPrompt || "",
      ...(typeof retryComment === "string" ? { retryComment } : {}),
      ...(printColorHex ? { colorHex: printColorHex } : {}),
    });

    const baseFront = runtime.prints.baseGarmentFrontDataUrl;
    const baseBack = runtime.prints.baseGarmentBackDataUrl;
    const baseSide = runtime.prints.baseGarmentSideDataUrl;

    const t0 = performance.now();
    const frontOut = await generateImage({
      apiKey: apiKeyValue,
      model: "gemini-3-pro-image-preview",
      promptText: prompt,
      images: [dataUrlToInlineImage(baseFront), printInline],
      timeoutMs: 180000,
    });
    const backOut = await generateImage({
      apiKey: apiKeyValue,
      model: "gemini-3-pro-image-preview",
      promptText: prompt,
      images: [dataUrlToInlineImage(baseBack), printInline],
      timeoutMs: 180000,
    });
    const sideOut = await generateImage({
      apiKey: apiKeyValue,
      model: "gemini-3-pro-image-preview",
      promptText: prompt,
      images: [dataUrlToInlineImage(baseSide), printInline],
      timeoutMs: 180000,
    });
    const ms = Math.round(performance.now() - t0);

    runtime.prints.outputFrontMimeType = frontOut.mimeType;
    runtime.prints.outputFrontDataUrl = `data:${frontOut.mimeType};base64,${frontOut.imageBase64}`;
    runtime.prints.outputBackMimeType = backOut.mimeType;
    runtime.prints.outputBackDataUrl = `data:${backOut.mimeType};base64,${backOut.imageBase64}`;
    runtime.prints.outputSideMimeType = sideOut.mimeType;
    runtime.prints.outputSideDataUrl = `data:${sideOut.mimeType};base64,${sideOut.imageBase64}`;
    runtime.prints.timingsMs = ms;
  } catch (err: any) {
    runtime.prints.error = err?.message || String(err);
  } finally {
    runtime.prints.generating = false;
    stopPrintGenerationTimer();
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
  if (printGenerationInterval) window.clearInterval(printGenerationInterval);
  if (storyboardSaveTimer) window.clearTimeout(storyboardSaveTimer);
  if (saveToastTimer) window.clearTimeout(saveToastTimer);
  window.removeEventListener("keydown", onGlobalKeyDown);
  for (const img of savedImages.value) {
    URL.revokeObjectURL(img.url);
  }
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

async function saveImageToLibrary(opts: {
  dataUrl: string;
  mimeType: string | null;
  title: string;
  kind: string;
  fileName?: string;
  notify?: boolean;
}) {
  const parsed = dataUrlToBlob(opts.dataUrl);
  const record = await saveImageRecord({
    title: opts.title,
    kind: opts.kind,
    mimeType: opts.mimeType || parsed.mimeType,
    fileName: opts.fileName,
    storyboardId: activeStoryboardId.value,
    storyboardTitle: activeStoryboard.value.title,
    blob: parsed.blob,
  });
  savedImages.value = [toSavedImageView(record), ...savedImages.value];
  if (opts.notify !== false) {
    showSaveToast("Saved to library.");
  }
}

async function saveMainImage() {
  const runtime = activeRuntime.value;
  if (!runtime.resultDataUrl) {
    runtime.generateError = "Generate the main image first.";
    return;
  }
  try {
    const ts = Date.now();
    await saveImageToLibrary({
      dataUrl: runtime.resultDataUrl,
      mimeType: runtime.resultMimeType,
      title: `Look — ${activeStoryboard.value.title}`,
      kind: "main",
      fileName: `look-main-${ts}.${mimeToExtension(runtime.resultMimeType)}`,
    });
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  }
}

async function saveAllImages() {
  const runtime = activeRuntime.value;
  if (!runtime.resultDataUrl || !runtime.angles.sideDataUrl || !runtime.angles.backDataUrl) {
    runtime.angles.error = "Generate the main, side, and back images before saving.";
    return;
  }
  try {
    const ts = Date.now();
    await Promise.all([
      saveImageToLibrary({
        dataUrl: runtime.resultDataUrl,
        mimeType: runtime.resultMimeType,
        title: `Look — ${activeStoryboard.value.title}`,
        kind: "main",
        fileName: `look-main-${ts}.${mimeToExtension(runtime.resultMimeType)}`,
        notify: false,
      }),
      saveImageToLibrary({
        dataUrl: runtime.angles.sideDataUrl,
        mimeType: runtime.angles.sideMimeType,
        title: `Side view — ${activeStoryboard.value.title}`,
        kind: "side",
        fileName: `look-side-${ts}.${mimeToExtension(runtime.angles.sideMimeType)}`,
        notify: false,
      }),
      saveImageToLibrary({
        dataUrl: runtime.angles.backDataUrl,
        mimeType: runtime.angles.backMimeType,
        title: `Back view — ${activeStoryboard.value.title}`,
        kind: "back",
        fileName: `look-back-${ts}.${mimeToExtension(runtime.angles.backMimeType)}`,
        notify: false,
      }),
    ]);
    showSaveToast("Saved 3 images.");
  } catch (err: any) {
    runtime.angles.error = err?.message || String(err);
  }
}

async function savePrintedGarment() {
  const runtime = activeRuntime.value;
  if (!runtime.prints.outputFrontDataUrl || !runtime.prints.outputBackDataUrl || !runtime.prints.outputSideDataUrl) {
    runtime.prints.error = "Generate the printed garments first.";
    return;
  }
  try {
    const ts = Date.now();
    await Promise.all([
      saveImageToLibrary({
        dataUrl: runtime.prints.outputFrontDataUrl,
        mimeType: runtime.prints.outputFrontMimeType,
        title: `Printed garment (front) — ${activeStoryboard.value.title}`,
        kind: "prints",
        fileName: `printed-garment-front-${ts}.${mimeToExtension(runtime.prints.outputFrontMimeType)}`,
        notify: false,
      }),
      saveImageToLibrary({
        dataUrl: runtime.prints.outputBackDataUrl,
        mimeType: runtime.prints.outputBackMimeType,
        title: `Printed garment (back) — ${activeStoryboard.value.title}`,
        kind: "prints",
        fileName: `printed-garment-back-${ts}.${mimeToExtension(runtime.prints.outputBackMimeType)}`,
        notify: false,
      }),
      saveImageToLibrary({
        dataUrl: runtime.prints.outputSideDataUrl,
        mimeType: runtime.prints.outputSideMimeType,
        title: `Printed garment (side) — ${activeStoryboard.value.title}`,
        kind: "prints",
        fileName: `printed-garment-side-${ts}.${mimeToExtension(runtime.prints.outputSideMimeType)}`,
        notify: false,
      }),
    ]);
    showSaveToast("Saved 3 printed garments.");
  } catch (err: any) {
    runtime.prints.error = err?.message || String(err);
  }
}

async function generateMultipleAngles() {
  const runtime = activeRuntime.value;
  if (isGenerating.value) return;
  if (runtime.angles.generating) return;

  runtime.angles.error = null;

  const apiKeyValue = requireApiKey((message) => {
    runtime.angles.error = message;
  });
  if (!apiKeyValue) return;

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
    const mainInline = dataUrlToInlineImage(runtime.resultDataUrl);
    const garmentAnglesInline = runtime.garmentDataUrls.map((src) => dataUrlToInlineImage(src));
    const modelRefInline = runtime.modelDataUrls[0] ? dataUrlToInlineImage(runtime.modelDataUrls[0]) : null;
    const backgroundRefInline = runtime.backgroundDataUrls[0]
      ? dataUrlToInlineImage(runtime.backgroundDataUrls[0])
      : null;

    const referenceImages = [
      garmentRefInline,
      ...garmentAnglesInline,
      mainInline,
      ...(modelRefInline ? [modelRefInline] : []),
      ...(backgroundRefInline ? [backgroundRefInline] : []),
    ];
    const promptBase = {
      plan: runtime.lastPlan,
      finalPrompt: runtime.lastFinalPrompt || "",
      garmentAngleCount: garmentAnglesInline.length,
      hasModelReference: Boolean(modelRefInline),
      hasBackgroundReference: Boolean(backgroundRefInline),
    };

    const sidePrompt = buildMultiAnglePrompt({ ...promptBase, angle: "side" });
    const backPrompt = buildMultiAnglePrompt({ ...promptBase, angle: "back" });

    const t0 = performance.now();
    const [sideRes, backRes] = await Promise.all([
      (async () => {
        const t = performance.now();
        const res = await generateImage({
          apiKey: apiKeyValue,
          model: "gemini-3-pro-image-preview",
          promptText: sidePrompt,
          images: referenceImages,
          aspectRatio: "3:4",
          width: 1080,
          height: 1440,
          timeoutMs: 180000,
        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
      (async () => {
        const t = performance.now();
        const res = await generateImage({
          apiKey: apiKeyValue,
          model: "gemini-3-pro-image-preview",
          promptText: backPrompt,
          images: referenceImages,
          aspectRatio: "3:4",
          width: 1080,
          height: 1440,
          timeoutMs: 180000,
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
  loadSavedImages().catch((err) => {
    console.warn("Failed to load saved images.", err);
  });
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

const bottomWearFinal = computed(() =>
  combineBottomWear(
    activeConfig.value.bottomWearPreset,
    activeConfig.value.bottomWearDetails,
    activeConfig.value.bottomWearPreset === "custom",
  ),
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

  const apiKeyValue = requireApiKey((message) => {
    runtime.generateError = message;
  });
  if (!apiKeyValue) return;

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

    const baseStyleKeywords = styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : [];
    const bottomWear = bottomWearFinal.value.trim();
    const styleKeywords = bottomWear ? [...baseStyleKeywords, bottomWear] : baseStyleKeywords;
    const accessories = activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : [];
    const modelRefDataUrl = runtime.modelDataUrls[0] || null;
    const backgroundRefDataUrl = runtime.backgroundDataUrls[0] || null;
    const hasModelReference = Boolean(modelRefDataUrl);
    const hasBackgroundReference = Boolean(backgroundRefDataUrl);

    const garmentImages = runtime.garmentDataUrls.map((src) => dataUrlToInlineImage(src));
    const timings: Record<string, number> = {};
    const debug: Record<string, unknown> = {};
    let planError: string | null = null;

    let plan: LookPlan;
    const tPlan0 = performance.now();
    try {
      const planRes = await planLookFromGarment({
        apiKey: apiKeyValue,
        model: "gemini-3-flash-preview",
        garmentImages,
        availableBackgroundThemes: [],
        availableModelEthnicities: [],
        userOverrides,
        timeoutMs: 120000,
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
      styleKeywords: styleKeywords.length ? styleKeywords : undefined,
      accessories: accessories.length ? accessories : undefined,
      footwear: footwearFinal.value || null,
    });

    const tFinalPrompt0 = performance.now();
    const finalPromptRes = await generateFinalPrompt({
      apiKey: apiKeyValue,
      model: "gemini-3-flash-preview",
      plan,
      background: null,
      chosenModel: null,
      hasBackgroundReference,
      hasModelReference,
      timeoutMs: 120000,
    });
    timings.final_prompt = Math.round(performance.now() - tFinalPrompt0);
    debug.final_prompt = finalPromptRes.prompt;

    generationStepIndex.value = 2;

    const garmentRefPrompt = buildGarmentReferencePrompt();
    const tGarment0 = performance.now();
    const garmentRef = await generateImage({
      apiKey: apiKeyValue,
      model: "gemini-3-pro-image-preview",
      promptText: garmentRefPrompt,
      images: garmentImages,
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180000,
    });
    timings.garment_reference = Math.round(performance.now() - tGarment0);
    const garmentRefDataUrl = `data:${garmentRef.mimeType};base64,${garmentRef.imageBase64}`;

    generationStepIndex.value = 3;

    const compositePrompt = buildCompositePrompt({
      plan,
      finalPrompt: finalPromptRes.prompt,
      hasModelReference,
      hasBackgroundReference,
    });
    debug.composite_prompt = compositePrompt;
    debug.negative_prompt = plan.negative_prompt;

    const tComposite0 = performance.now();
    const compositeImages = [
      { mimeType: garmentRef.mimeType, data: base64ToBytes(garmentRef.imageBase64) },
      ...(modelRefDataUrl ? [dataUrlToInlineImage(modelRefDataUrl)] : []),
      ...(backgroundRefDataUrl ? [dataUrlToInlineImage(backgroundRefDataUrl)] : []),
    ];
    const composite = await generateImage({
      apiKey: apiKeyValue,
      model: "gemini-3-pro-image-preview",
      promptText: compositePrompt,
      images: compositeImages,
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180000,
    });
    timings.composite = Math.round(performance.now() - tComposite0);

    timings.api_total = Object.values(timings).reduce(
      (acc, v) => acc + (typeof v === "number" ? v : 0),
      0,
    );

    const chosenSummary = {
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

    runtime.lastPlan = safeClone(plan);
    runtime.lastFinalPrompt = finalPromptRes.prompt;
    runtime.garmentRefMimeType = garmentRef.mimeType;
    runtime.garmentRefDataUrl = garmentRefDataUrl;
    runtime.resultMimeType = composite.mimeType;
    runtime.resultDataUrl = `data:${composite.mimeType};base64,${composite.imageBase64}`;
    runtime.resultTimingsMs = timings;
    runtime.chosenSummary = chosenSummary;
    runtime.debugSummary = {
      timings_ms: timings,
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

  if (!runtime.resultDataUrl || !runtime.garmentRefDataUrl || !runtime.lastPlan || !runtime.lastFinalPrompt) {
    runtime.generateError = "Generate the main image first, then you can retry.";
    return;
  }

  const apiKeyValue = requireApiKey((message) => {
    runtime.generateError = message;
  });
  if (!apiKeyValue) return;

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

    let plan = { ...runtime.lastPlan };
    const ov = overrides || {};
    if ((ov.occasion || "").trim()) plan.occasion = ov.occasion!.trim();
    if ((ov.color_scheme || "").trim()) plan.color_scheme = ov.color_scheme!.trim();
    if ((ov.background_theme || "").trim()) plan.background_theme = ov.background_theme!.trim();
    if ((ov.footwear || "").trim()) plan.footwear = ov.footwear!.trim();
    if ((ov.model_ethnicity || "").trim()) plan.model_ethnicity = ov.model_ethnicity!.trim();
    if ((ov.model_pose || "").trim()) plan.model_pose = ov.model_pose!.trim();
    if ((ov.model_styling_notes || "").trim()) plan.model_styling_notes = ov.model_styling_notes!.trim();

    const baseStyleKeywords = styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : [];
    const bottomWear = bottomWearFinal.value.trim();
    const styleKeywords = bottomWear ? [...baseStyleKeywords, bottomWear] : baseStyleKeywords;
    const accessories = activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : [];
    plan = applyFreeformOverrides(plan, {
      styleKeywords: styleKeywords.length ? styleKeywords : undefined,
      accessories: accessories.length ? accessories : undefined,
      footwear: footwearFinal.value || null,
    });

    const modelRefDataUrl = runtime.modelDataUrls[0] || null;
    const backgroundRefDataUrl = runtime.backgroundDataUrls[0] || null;
    const hasModelReference = Boolean(modelRefDataUrl);
    const hasBackgroundReference = Boolean(backgroundRefDataUrl);

    const compositePrompt = buildRetryCompositePrompt({
      plan,
      finalPrompt: runtime.lastFinalPrompt,
      hasModelReference,
      hasBackgroundReference,
      retryComment: retryComment || "",
    });

    const t0 = performance.now();
    const garmentRefInline = dataUrlToInlineImage(runtime.garmentRefDataUrl);
    const compositeImages = [
      garmentRefInline,
      ...(modelRefDataUrl ? [dataUrlToInlineImage(modelRefDataUrl)] : []),
      ...(backgroundRefDataUrl ? [dataUrlToInlineImage(backgroundRefDataUrl)] : []),
    ];
    const composite = await generateImage({
      apiKey: apiKeyValue,
      model: "gemini-3-pro-image-preview",
      promptText: compositePrompt,
      images: compositeImages,
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180000,
    });
    const ms = Math.round(performance.now() - t0);

    const chosenSummary = {
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

    runtime.lastPlan = safeClone(plan);
    runtime.resultMimeType = composite.mimeType;
    runtime.resultDataUrl = `data:${composite.mimeType};base64,${composite.imageBase64}`;
    runtime.angles = createDefaultAnglesRuntime();
    runtime.resultTimingsMs = { composite: ms, api_total: ms };
    runtime.chosenSummary = chosenSummary;
    runtime.debugSummary = {
      timings_ms: { composite: ms, api_total: ms },
      retry_comment: retryComment || "",
      final_prompt: runtime.lastFinalPrompt,
      composite_prompt: compositePrompt,
      negative_prompt: plan.negative_prompt,
    };

    try {
      const thumb = await createThumbnail(runtime.resultDataUrl);
      activeStoryboard.value.previewDataUrl = thumb;
    } catch (e) {
      console.warn("Failed to create thumbnail", e);
    }
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}
</script>
