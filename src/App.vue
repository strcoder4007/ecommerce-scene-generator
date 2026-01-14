<template>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title titleLarge">Fashion image Gen</h1>
        <p class="subtitle">
          Upload a garment image → auto-pick (or invent) model/background → generate a photorealistic look.
        </p>
      </div>
      <div class="badge" style="gap: 10px">
        <span>Gemini API key</span>
        <input
          class="control"
          :type="showApiKey ? 'text' : 'password'"
          v-model.trim="geminiApiKey"
          placeholder="Paste your key"
          style="width: 220px; padding: 8px 10px"
        />
        <button type="button" class="btnGhost" @click="showApiKey = !showApiKey">
          {{ showApiKey ? "Hide" : "Show" }}
        </button>
      </div>
    </div>

    <div class="tabRow">
      <div class="tabGroup" role="tablist" aria-label="Sections">
        <button
          type="button"
          @click="activeTab = 'generate'"
          :class="`tabButton ${activeTab === 'generate' ? 'tabButtonActive' : ''}`"
          role="tab"
          :aria-selected="activeTab === 'generate'"
        >
          Generate
        </button>
        <button
          type="button"
          @click="activeTab = 'assets'"
          :class="`tabButton ${activeTab === 'assets' ? 'tabButtonActive' : ''}`"
          role="tab"
          :aria-selected="activeTab === 'assets'"
        >
          Assets
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'generate'" class="grid">
      <div class="card">
        <form @submit.prevent="onGenerateLook">
          <div>
            <FieldLabel
              htmlFor="garmentPhoto"
              label="Garment photo"
              info="Upload the garment image you want to place on a model. The generator will preserve the garment silhouette and create a photorealistic ecommerce scene around it."
            />
            <input
              id="garmentPhoto"
              ref="garmentFileInputRef"
              type="file"
              accept="image/*"
              @change="onGarmentFileChange"
            />
          </div>

          <div style="height: 12px" />

          <div class="sectionTitle">Creative Direction</div>

          <div>
            <FieldLabel
              label="Occasion (optional)"
              info="Sets the vibe for styling and scene (lighting, accessories, background mood). Pick a preset and optionally add extra detail (e.g., “sunset beach”, “nightclub”, “wedding guest”)."
            />
            <PillRadioGroup
              name="occasion"
              :model-value="occasionPreset"
              @update:model-value="occasionPreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'beachwear', label: 'Beachwear' },
                { value: 'party wear', label: 'Party wear' },
                { value: 'evening', label: 'Evening' },
                { value: 'casual', label: 'Casual' },
                { value: 'workwear', label: 'Workwear' },
                { value: 'wedding guest', label: 'Wedding' },
                { value: 'athleisure', label: 'Athleisure' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 10px" />
            <input
              class="control"
              type="text"
              v-model="occasionDetails"
              placeholder="Optional: add details or type a custom occasion"
            />
          </div>

          <div style="height: 12px" />

          <div class="row">
            <div>
              <FieldLabel
                label="Color scheme (optional)"
                info="The overall color palette you want the model + background to lean into. This helps the generator choose complementary lighting and scene colors (e.g., “pastel”, “neutral”, “red & white”, “monochrome”)."
              />
              <input
                class="control"
                type="text"
                v-model="colorScheme"
                placeholder="e.g. red & white, pastel, neutral, monochrome"
              />
            </div>
            <div>
              <FieldLabel
                label="Accessories (optional)"
                info="Optional add-ons to make the scene feel complete (e.g., sunglasses, tote bag, heels). Keep it realistic and not too many items."
              />
              <input
                class="control"
                type="text"
                v-model="accessories"
                placeholder="comma separated, e.g. straw hat, sandals"
              />
            </div>
          </div>

          <div style="height: 12px" />

          <div>
            <FieldLabel
              label="Style keywords (optional)"
              info="A few words describing the aesthetic. This influences pose, lighting, props, and overall styling (e.g., minimal, luxury, streetwear). Choose a direction and optionally add extra keywords."
            />
            <PillRadioGroup
              name="styleKeywords"
              :model-value="stylePreset"
              @update:model-value="stylePreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'streetwear', label: 'Streetwear' },
                { value: 'luxe', label: 'Luxury' },
                { value: 'boho', label: 'Boho' },
                { value: 'vintage', label: 'Vintage' },
                { value: 'sporty', label: 'Sporty' },
                { value: 'romantic', label: 'Romantic' },
                { value: 'edgy', label: 'Edgy' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 10px" />
            <input
              class="control"
              type="text"
              v-model="styleKeywordsDetails"
              placeholder="Optional: add keywords (comma separated)"
            />
          </div>

          <div style="height: 12px" />

          <div class="divider" />

          <div style="height: 12px" />

          <div class="sectionTitle">Background</div>

          <div>
            <FieldLabel
              label="Background theme (optional)"
              info="Describes the environment you want (e.g., studio, beach, rooftop, garden). Pick a preset and optionally add extra detail. If you select an uploaded background thumbnail below, that image will be used as the scene reference."
            />
            <PillRadioGroup
              name="backgroundTheme"
              :model-value="backgroundThemePreset"
              @update:model-value="backgroundThemePreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'studio', label: 'Studio' },
                { value: 'beach', label: 'Beach' },
                { value: 'city street', label: 'City' },
                { value: 'garden', label: 'Garden' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'luxury', label: 'Luxury' },
                { value: 'nightclub', label: 'Nightlife' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 10px" />
            <input
              class="control"
              type="text"
              v-model="backgroundThemeDetails"
              placeholder="Optional: add details (lighting, location, props)"
            />
          </div>

          <div style="height: 12px" />

          <div>
            <FieldLabel
              label="Background image (optional)"
              info="If you have added backgrounds in the Assets tab, click a thumbnail to force a specific scene. Leave on Auto to let the generator invent a matching background."
            />
            <div v-if="backgrounds.length" class="thumbStrip">
              <button
                type="button"
                :class="`thumb ${!selectedBackgroundId ? 'thumbSelected' : ''}`"
                @click="selectedBackgroundId = ''"
                :aria-pressed="!selectedBackgroundId"
                title="Auto background"
              >
                <div class="thumbPlaceholder">Auto</div>
                <div class="thumbTitle">Auto</div>
                <div class="thumbSubtitle">Invent / pick best</div>
              </button>
              <button
                v-for="b in backgrounds"
                :key="b.id"
                type="button"
                :class="`thumb ${selectedBackgroundId === b.id ? 'thumbSelected' : ''}`"
                @click="selectedBackgroundId = b.id"
                :aria-pressed="selectedBackgroundId === b.id"
                :title="b.title"
              >
                <img :src="b.image_url" :alt="b.title" loading="lazy" />
                <div class="thumbTitle">{{ b.title }}</div>
                <div class="thumbSubtitle">{{ b.theme || "Background" }}</div>
              </button>
            </div>
            <div v-else class="muted">No backgrounds detected — the generator will invent one.</div>
          </div>

          <div style="height: 12px" />

          <div class="divider" />

          <div style="height: 12px" />

          <div class="sectionTitle">Model</div>

          <div>
            <FieldLabel
              label="Model (optional)"
              info="Use this to bias the generated model (ethnicity / vibe) when you are not selecting a specific model image. Pick a preset and/or add your own description."
            />
            <PillRadioGroup
              name="modelPreference"
              :model-value="modelPreset"
              @update:model-value="modelPreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'South Asian', label: 'South Asian' },
                { value: 'East Asian', label: 'East Asian' },
                { value: 'Black', label: 'Black' },
                { value: 'White / European', label: 'White / European' },
                { value: 'Middle Eastern', label: 'Middle Eastern' },
                { value: 'Latina', label: 'Latina' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 10px" />
            <input
              class="control"
              type="text"
              v-model="modelDetails"
              placeholder="Optional: add model description (ethnicity, vibe, etc.)"
            />
          </div>

          <div style="height: 12px" />

          <div>
            <FieldLabel
              label="Model image (optional)"
              info="If you have added model references in the Assets tab, click a thumbnail to use that exact identity/face/pose. Leave Auto to generate a suitable model."
            />
            <div v-if="models.length" class="thumbStrip">
              <button
                type="button"
                :class="`thumb ${!selectedModelId ? 'thumbSelected' : ''}`"
                @click="selectedModelId = ''"
                :aria-pressed="!selectedModelId"
                title="Auto model"
              >
                <div class="thumbPlaceholder">Auto</div>
                <div class="thumbTitle">Auto</div>
                <div class="thumbSubtitle">Invent / pick best</div>
              </button>
              <button
                v-for="m in models"
                :key="m.id"
                type="button"
                :class="`thumb ${selectedModelId === m.id ? 'thumbSelected' : ''}`"
                @click="selectedModelId = m.id"
                :aria-pressed="selectedModelId === m.id"
                :title="m.title"
              >
                <img :src="m.image_url" :alt="m.title" loading="lazy" />
                <div class="thumbTitle">{{ m.title }}</div>
                <div class="thumbSubtitle">{{ m.ethnicity || "Model" }}</div>
              </button>
            </div>
            <div v-else class="muted">No models detected — the generator will invent one.</div>
          </div>

          <div style="height: 12px" />

          <div class="row">
            <div>
              <FieldLabel
                label="Model styling notes (optional)"
                info="Extra guidance for hair/makeup/jewelry and overall styling. Use short, clear notes like “natural makeup, minimal jewelry, hair up”."
              />
              <input
                class="control"
                type="text"
                v-model="modelStylingNotes"
                placeholder="e.g. minimal jewelry, natural makeup, hair up"
              />
            </div>
            <div>
              <FieldLabel
                label="Debug (optional)"
                info="When enabled, the UI shows internal prompt/plan details to help iterate on results."
              />
              <select class="control" v-model="includeDebugStr">
                <option value="no">Off</option>
                <option value="yes">On (show prompts)</option>
              </select>
            </div>
          </div>

          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="isGenerating">
              {{ isGenerating ? "Generating..." : "Generate look" }}
            </button>
            <button type="button" class="btnSecondary" @click="refreshAssets" :disabled="isGenerating">
              Refresh assets
            </button>
          </div>

          <div v-if="assetsError" class="error">{{ assetsError }}</div>
          <div v-if="generateError" class="error">{{ generateError }}</div>

          <div v-if="garmentPreviewUrl" class="preview">
            <div>
              <label>Garment preview</label>
              <img :src="garmentPreviewUrl" alt="Garment preview" />
            </div>
            <div>
              <label>Selection preview</label>
              <div class="muted">
                {{ selectedBackgroundId ? "Using selected background." : "Auto background." }}
                {{ " " }}
                {{ selectedModelId ? "Using selected model." : "Auto model." }}
              </div>
            </div>
          </div>

          <div v-if="chosenSummary" style="margin-top: 12px">
            <label>Chosen plan</label>
            <pre class="muted" style="white-space: pre-wrap">{{ JSON.stringify(chosenSummary, null, 2) }}</pre>
          </div>

          <div v-if="debugSummary" style="margin-top: 12px">
            <label>Debug</label>
            <pre class="muted" style="white-space: pre-wrap">{{ JSON.stringify(debugSummary, null, 2) }}</pre>
          </div>
        </form>
      </div>

      <div class="card result">
        <FieldLabel
          label="Generated result"
          info="Your generated ecommerce scene will appear here. For best results, start with Auto settings and only lock in a background/model when you need consistency."
        />

        <div v-if="isGenerating" class="resultPlaceholder loaderPlaceholder">
          <div class="loader">
            <div class="loaderHeader">
              <Spinner />
              <div>
                <div class="loaderTitle">{{ GENERATION_STEPS[generationStepIndex] }}</div>
                <div class="loaderSubtitle">Elapsed {{ formatDurationMs(generationElapsedMs) }}</div>
              </div>
            </div>

            <div class="loaderSteps" aria-label="Generation progress">
              <div
                v-for="(label, idx) in GENERATION_STEPS"
                :key="label"
                :class="idx < generationStepIndex ? 'loaderStep loaderStepDone' : idx === generationStepIndex ? 'loaderStep loaderStepActive' : 'loaderStep'"
              >
                <div class="loaderDot" aria-hidden="true" />
                <div class="loaderStepText">{{ label }}</div>
              </div>
            </div>

            <div class="loaderHint muted">Keep this tab open while we generate your image.</div>
          </div>
        </div>

        <template v-else-if="resultDataUrl">
          <div class="resultActions">
            <div class="resultActionsLeft">
              <a
                class="btn btnSecondary"
                :href="resultDataUrl"
                :download="`look-${Date.now()}.${mimeToExtension(resultMimeType)}`"
              >
                Download
              </a>
              <button type="button" class="btnGhost" @click="clearResult">Clear</button>
            </div>
            <div class="resultActionsRight">
              <div v-if="resultTimingsMs" class="badge" title="Time spent generating this image">
                <span>Text LLM</span>
                <code>{{ formatDurationMs(computedTimings.textLlmMs) }}</code>
                <span>Image gen</span>
                <code>{{ formatDurationMs(computedTimings.imageGenMs) }}</code>
                <span>Total</span>
                <code>{{ formatDurationMs(computedTimings.totalMs) }}</code>
              </div>
              <div class="muted">Tip: use “Debug” to inspect prompts.</div>
            </div>
          </div>
          <img :src="resultDataUrl" alt="Generated look" />
        </template>

        <div v-else class="resultPlaceholder resultEmpty">
          <div>
            <div class="resultEmptyTitle">Ready when you are</div>
            <div class="muted">Upload a garment photo, then click “Generate look”.</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="grid">
      <div class="card">
        <h2 class="title" style="font-size: 16px; margin-top: 0">Upload background</h2>
        <form @submit.prevent="uploadBackground">
          <div>
            <FieldLabel
              label="Image"
              info="Upload a background reference image (e.g., studio wall, beach, garden). Stored locally in your browser and selectable from the Generate tab."
            />
            <input ref="bgFileInputRef" type="file" accept="image/*" @change="onBgFileChange" />
          </div>
          <div style="height: 12px" />
          <div class="row">
            <div>
              <FieldLabel label="Title (optional)" info="A short name to recognize this background." />
              <input class="control" v-model="bgTitle" type="text" />
            </div>
            <div>
              <FieldLabel
                label="Theme (recommended)"
                info="A theme tag (e.g., beach, party, studio). The generator can use this when auto-planning a look."
              />
              <input class="control" v-model="bgTheme" type="text" placeholder="beach, party, forest..." />
            </div>
          </div>
          <div style="height: 12px" />
          <div>
            <FieldLabel label="Tags (optional)" info="Extra tags to help categorize assets. Use commas." />
            <input class="control" v-model="bgTags" type="text" placeholder="comma separated" />
          </div>
          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="bgUploading">
              {{ bgUploading ? "Uploading..." : "Upload background" }}
            </button>
          </div>
          <div v-if="bgUploadError" class="error">{{ bgUploadError }}</div>
        </form>
      </div>

      <div class="card">
        <h2 class="title" style="font-size: 16px; margin-top: 0">Upload model</h2>
        <form @submit.prevent="uploadModel">
          <div>
            <FieldLabel
              label="Image"
              info="Upload a model reference image to keep the same identity/face/pose across generations. Stored locally in your browser."
            />
            <input ref="modelFileInputRef" type="file" accept="image/*" @change="onModelFileChange" />
          </div>
          <div style="height: 12px" />
          <div class="row">
            <div>
              <FieldLabel label="Title (optional)" info="A short name to recognize this model." />
              <input class="control" v-model="modelTitle" type="text" />
            </div>
            <div>
              <FieldLabel
                label="Ethnicity (recommended)"
                info="Helps the generator auto-pick diversity when no explicit model is selected."
              />
              <input class="control" v-model="modelAssetEthnicity" type="text" placeholder="Indian, Russian..." />
            </div>
          </div>
          <div style="height: 12px" />
          <div>
            <FieldLabel label="Tags (optional)" info="Extra tags to help categorize assets. Use commas." />
            <input class="control" v-model="modelTags" type="text" placeholder="comma separated" />
          </div>
          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="modelUploading">
              {{ modelUploading ? "Uploading..." : "Upload model" }}
            </button>
          </div>
          <div v-if="modelUploadError" class="error">{{ modelUploadError }}</div>
        </form>
      </div>

      <div class="card" style="grid-column: 1 / -1">
        <div class="actions" style="justify-content: space-between">
          <div>
            <h2 class="title" style="font-size: 16px; margin: 0">Current assets</h2>
            <div class="muted">Backgrounds: {{ backgrounds.length }} · Models: {{ models.length }}</div>
          </div>
          <button type="button" class="btnSecondary" @click="refreshAssets">Refresh</button>
        </div>

        <div v-if="assetsError" class="error">{{ assetsError }}</div>

        <div style="height: 12px" />

        <div class="grid">
          <div>
            <label>Backgrounds</label>
            <div class="preview">
              <img v-for="b in backgrounds" :key="b.id" :src="b.image_url" :alt="b.title" :title="b.title" />
            </div>
          </div>
          <div>
            <label>Models</label>
            <div class="preview">
              <img v-for="m in models" :key="m.id" :src="m.image_url" :alt="m.title" :title="m.title" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import FieldLabel from "./components/FieldLabel.vue";
import PillRadioGroup from "./components/PillRadioGroup.vue";
import Spinner from "./components/Spinner.vue";

import { base64ToBytes, dataUrlToInlineImage, fileToInlineImage, generateImage } from "./lib/gemini";
import {
  fileToDataUrl,
  listAssets,
  nowIso,
  parseTags as parseLocalTags,
  randomId,
  upsertAsset,
  type LocalAsset,
} from "./lib/localAssets";
import {
  applyFreeformOverrides,
  buildCompositePrompt,
  buildGarmentReferencePrompt,
  chooseBackground,
  chooseModel,
  computeTimingsMs,
  generateFinalPrompt,
  planLookFromGarment,
  type AssetMeta,
  type LookPlan,
} from "./lib/pipeline";

const GENERATION_STEPS = [
  "Getting all the configurations",
  "Text LLM call",
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

const activeTab = ref<"generate" | "assets">("generate");

const geminiApiKey = ref(localStorage.getItem("gemini_api_key") || "");
const showApiKey = ref(false);
watch(
  geminiApiKey,
  (value) => {
    const trimmed = (value || "").trim();
    localStorage.setItem("gemini_api_key", trimmed);
  },
  { flush: "post" },
);

const garmentFileInputRef = ref<HTMLInputElement | null>(null);

const garmentPhoto = ref<File | null>(null);
const garmentPreviewUrl = ref<string | null>(null);
watch(
  garmentPhoto,
  (file) => {
    if (garmentPreviewUrl.value) URL.revokeObjectURL(garmentPreviewUrl.value);
    garmentPreviewUrl.value = file ? URL.createObjectURL(file) : null;
  },
  { flush: "post" },
);
onBeforeUnmount(() => {
  if (garmentPreviewUrl.value) URL.revokeObjectURL(garmentPreviewUrl.value);
});

function onGarmentFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  garmentPhoto.value = input?.files?.[0] ?? null;
}

const selectedBackgroundId = ref("");
const selectedModelId = ref("");

const occasionPreset = ref("");
const occasionDetails = ref("");
const colorScheme = ref("");
const backgroundThemePreset = ref("");
const backgroundThemeDetails = ref("");
const modelPreset = ref("");
const modelDetails = ref("");
const modelStylingNotes = ref("");
const stylePreset = ref("");
const styleKeywordsDetails = ref("");
const accessories = ref("");

const includeDebugStr = ref<"no" | "yes">("no");
const includeDebug = computed(() => includeDebugStr.value === "yes");

const isGenerating = ref(false);
const generateError = ref<string | null>(null);
const chosenSummary = ref<any>(null);
const debugSummary = ref<any>(null);
const resultDataUrl = ref<string | null>(null);
const resultMimeType = ref<string | null>(null);
const resultTimingsMs = ref<Record<string, number> | null>(null);

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

function clearResult() {
  resultDataUrl.value = null;
  resultMimeType.value = null;
  chosenSummary.value = null;
  debugSummary.value = null;
  resultTimingsMs.value = null;
  generateError.value = null;
}

const computedTimings = computed(() => computeTimingsMs(resultTimingsMs.value || {}));

// Local assets (IndexedDB)
const backgrounds = ref<LocalAsset[]>([]);
const models = ref<LocalAsset[]>([]);
const assetsError = ref<string | null>(null);

async function refreshAssets() {
  assetsError.value = null;
  try {
    const [bg, md] = await Promise.all([listAssets("background"), listAssets("model")]);
    backgrounds.value = bg;
    models.value = md;
  } catch (err: any) {
    assetsError.value = err?.message || String(err);
  }
}

onMounted(() => {
  void refreshAssets();
});

function assetMetaFromLocal(a: LocalAsset): AssetMeta {
  return {
    id: a.id,
    title: a.title,
    theme: a.theme ?? null,
    ethnicity: a.ethnicity ?? null,
    tags: a.tags || [],
  };
}

function getSelectedBackground(desiredTheme: string): LocalAsset | null {
  if (selectedBackgroundId.value) {
    return backgrounds.value.find((b) => b.id === selectedBackgroundId.value) || null;
  }
  if (!backgrounds.value.length) return null;
  const chosen = chooseBackground(backgrounds.value.map(assetMetaFromLocal), desiredTheme);
  return chosen ? backgrounds.value.find((b) => b.id === chosen.id) || null : null;
}

function getSelectedModel(planEthnicity: string): LocalAsset | null {
  if (selectedModelId.value) {
    return models.value.find((m) => m.id === selectedModelId.value) || null;
  }
  if (!models.value.length) return null;
  const chosen = chooseModel(models.value.map(assetMetaFromLocal), planEthnicity);
  return chosen ? models.value.find((m) => m.id === chosen.id) || null : null;
}

// Derived inputs
const occasionFinal = computed(() =>
  occasionPreset.value === "custom"
    ? occasionDetails.value.trim()
    : combinePresetAndCustom({ presetText: occasionPreset.value, customText: occasionDetails.value, joiner: ", " }),
);

const stylePresetKeywords: Record<string, string> = {
  minimal: "minimal, clean, modern",
  streetwear: "streetwear, edgy, urban",
  luxe: "luxury, premium, editorial",
  boho: "boho, relaxed, earthy",
  vintage: "vintage, retro",
  sporty: "sporty, athleisure",
  romantic: "romantic, feminine",
  edgy: "edgy, bold, high-contrast",
};

const stylePresetText = computed(() =>
  stylePreset.value && stylePreset.value !== "custom" ? stylePresetKeywords[stylePreset.value] ?? stylePreset.value : "",
);

const styleKeywordsFinal = computed(() =>
  stylePreset.value === "custom"
    ? styleKeywordsDetails.value.trim()
    : combinePresetAndCustom({ presetText: stylePresetText.value, customText: styleKeywordsDetails.value, joiner: ", " }),
);

const backgroundThemeFinal = computed(() =>
  backgroundThemePreset.value === "custom"
    ? backgroundThemeDetails.value.trim()
    : combinePresetAndCustom({ presetText: backgroundThemePreset.value, customText: backgroundThemeDetails.value, joiner: ", " }),
);

const modelEthnicityFinal = computed(() =>
  modelPreset.value === "custom"
    ? modelDetails.value.trim()
    : combinePresetAndCustom({ presetText: modelPreset.value, customText: modelDetails.value, joiner: ", " }),
);

async function onGenerateLook() {
  generateError.value = null;
  chosenSummary.value = null;
  debugSummary.value = null;
  resultDataUrl.value = null;
  resultMimeType.value = null;
  resultTimingsMs.value = null;

  if (!geminiApiKey.value.trim()) {
    generateError.value = "Please paste your Gemini API key (BYO key).";
    return;
  }
  if (!garmentPhoto.value) {
    generateError.value = "Please select a garment photo.";
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

    const garmentInline = await fileToInlineImage(garmentPhoto.value);

    const availableThemes = Array.from(
      new Set(backgrounds.value.map((b) => (b.theme || "").trim()).filter(Boolean)),
    ).sort();
    const availableEthnicities = Array.from(
      new Set(models.value.map((m) => (m.ethnicity || "").trim()).filter(Boolean)),
    ).sort();

    generationStepIndex.value = 1;

    const userOverrides = {
      occasion: occasionFinal.value || null,
      color_scheme: colorScheme.value.trim() || null,
      background_theme: backgroundThemeFinal.value || null,
      model_ethnicity: modelEthnicityFinal.value || null,
      model_styling_notes: modelStylingNotes.value.trim() || null,
    };

    let plan: LookPlan;
    const tPlan0 = performance.now();
    try {
      const planRes = await planLookFromGarment({
        apiKey: geminiApiKey.value,
        model: "gemini-1.5-flash",
        garmentImage: garmentInline,
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
        accessories: [],
        negative_prompt:
          "blurry, low quality, incorrect garment, altered design, wrong print, extra limbs, deformed hands, text overlay, watermark",
        model_ethnicity: ov.model_ethnicity || "",
        model_styling_notes: ov.model_styling_notes || "",
      };
    }
    timings.plan = Math.round(performance.now() - tPlan0);

    plan = applyFreeformOverrides(plan, {
      styleKeywords: styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : undefined,
      accessories: accessories.value.trim() ? parseLocalTags(accessories.value) : undefined,
    });

    const chosenBg = getSelectedBackground(plan.background_theme);
    const chosenModel = getSelectedModel(plan.model_ethnicity);

    const tFinalPrompt0 = performance.now();
    const finalPromptRes = await generateFinalPrompt({
      apiKey: geminiApiKey.value,
      model: "gemini-1.5-flash",
      plan,
      background: chosenBg ? assetMetaFromLocal(chosenBg) : null,
      chosenModel: chosenModel ? assetMetaFromLocal(chosenModel) : null,
      hasBackgroundReference: Boolean(chosenBg),
      hasModelReference: Boolean(chosenModel),
      timeoutMs: 120_000,
    });
    timings.final_prompt = Math.round(performance.now() - tFinalPrompt0);
    debug.final_prompt = finalPromptRes.prompt;

    generationStepIndex.value = 2;

    const garmentRefPrompt = buildGarmentReferencePrompt();
    const tGarment0 = performance.now();
    const garmentRef = await generateImage({
      apiKey: geminiApiKey.value,
      model: "gemini-3-pro-image-preview",
      promptText: garmentRefPrompt,
      images: [garmentInline],
      timeoutMs: 180_000,
    });
    timings.garment_reference = Math.round(performance.now() - tGarment0);

    const garmentRefBytes = base64ToBytes(garmentRef.imageBase64);

    const compositeImages: Array<{ mimeType: string; data: Uint8Array }> = [
      { mimeType: garmentRef.mimeType, data: garmentRefBytes },
    ];
    let hasModelRef = false;
    let hasBgRef = false;
    if (chosenModel) {
      compositeImages.push(dataUrlToInlineImage(chosenModel.image_url));
      hasModelRef = true;
    }
    if (chosenBg) {
      compositeImages.push(dataUrlToInlineImage(chosenBg.image_url));
      hasBgRef = true;
    }

    const compositePrompt = buildCompositePrompt({
      plan,
      finalPrompt: finalPromptRes.prompt,
      hasModelReference: hasModelRef,
      hasBackgroundReference: hasBgRef,
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
      timeoutMs: 180_000,
    });
    timings.composite = Math.round(performance.now() - tComposite0);

    resultMimeType.value = composite.mimeType;
    resultDataUrl.value = `data:${composite.mimeType};base64,${composite.imageBase64}`;

    resultTimingsMs.value = {
      ...timings,
      api_total: Object.values(timings).reduce((a, b) => a + b, 0),
    };

    chosenSummary.value = {
      occasion: plan.occasion,
      color_scheme: plan.color_scheme,
      print_style: plan.print_style,
      style_keywords: plan.style_keywords,
      accessories: plan.accessories,
      background_theme: plan.background_theme,
      model_ethnicity: plan.model_ethnicity,
      background: {
        id: chosenBg?.id ?? null,
        title: chosenBg?.title ?? null,
        theme: chosenBg?.theme ?? null,
      },
      model: {
        id: chosenModel?.id ?? null,
        title: chosenModel?.title ?? null,
        ethnicity: chosenModel?.ethnicity ?? null,
      },
    };

    debugSummary.value = includeDebug.value
      ? {
          timings_ms: resultTimingsMs.value,
          plan_error: planError,
          ...debug,
        }
      : null;
  } catch (err: any) {
    generateError.value = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}

// Assets tab state
const bgFileInputRef = ref<HTMLInputElement | null>(null);
const modelFileInputRef = ref<HTMLInputElement | null>(null);

const bgFile = ref<File | null>(null);
const bgTitle = ref("");
const bgTheme = ref("");
const bgTags = ref("");
const bgUploadError = ref<string | null>(null);
const bgUploading = ref(false);

const modelFile = ref<File | null>(null);
const modelTitle = ref("");
const modelAssetEthnicity = ref("");
const modelTags = ref("");
const modelUploadError = ref<string | null>(null);
const modelUploading = ref(false);

function onBgFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  bgFile.value = input?.files?.[0] ?? null;
}

function onModelFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  modelFile.value = input?.files?.[0] ?? null;
}

async function uploadBackground() {
  bgUploadError.value = null;
  if (!bgFile.value) {
    bgUploadError.value = "Select an image.";
    return;
  }
  bgUploading.value = true;
  try {
    const dataUrl = await fileToDataUrl(bgFile.value);
    const asset: LocalAsset = {
      id: randomId(),
      title: (bgTitle.value.trim() || bgTheme.value.trim() || "Background").trim(),
      theme: bgTheme.value.trim() || null,
      ethnicity: null,
      tags: parseLocalTags(bgTags.value),
      image_url: dataUrl,
      mime_type: (bgFile.value.type || "image/*").split(";")[0].trim(),
      created_at: nowIso(),
    };
    await upsertAsset("background", asset);
    bgFile.value = null;
    if (bgFileInputRef.value) bgFileInputRef.value.value = "";
    bgTitle.value = "";
    bgTheme.value = "";
    bgTags.value = "";
    await refreshAssets();
  } catch (err: any) {
    bgUploadError.value = err?.message || String(err);
  } finally {
    bgUploading.value = false;
  }
}

async function uploadModel() {
  modelUploadError.value = null;
  if (!modelFile.value) {
    modelUploadError.value = "Select an image.";
    return;
  }
  modelUploading.value = true;
  try {
    const dataUrl = await fileToDataUrl(modelFile.value);
    const asset: LocalAsset = {
      id: randomId(),
      title: (modelTitle.value.trim() || modelAssetEthnicity.value.trim() || "Model").trim(),
      theme: null,
      ethnicity: modelAssetEthnicity.value.trim() || null,
      tags: parseLocalTags(modelTags.value),
      image_url: dataUrl,
      mime_type: (modelFile.value.type || "image/*").split(";")[0].trim(),
      created_at: nowIso(),
    };
    await upsertAsset("model", asset);
    modelFile.value = null;
    if (modelFileInputRef.value) modelFileInputRef.value.value = "";
    modelTitle.value = "";
    modelAssetEthnicity.value = "";
    modelTags.value = "";
    await refreshAssets();
  } catch (err: any) {
    modelUploadError.value = err?.message || String(err);
  } finally {
    modelUploading.value = false;
  }
}
</script>
