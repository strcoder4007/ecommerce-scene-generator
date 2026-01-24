<template>
  <form class="storyboardForm" @submit.prevent="$emit('submit')">
    <fieldset class="formFieldset" :disabled="isGenerating">
      <div class="storyboardCards">
        <div class="parameterSection">
          <div class="sectionTitle" style="margin-top: 0">Garment photos</div>
          <div>
            <FieldLabel
              htmlFor="garmentPhoto"
              label="Photos"
              info="Upload 1–4 photos of the SAME garment (front/side/back). The generator will preserve the garment silhouette and create a photorealistic ecommerce scene around it."
            />
            <input
              id="garmentPhoto"
              type="file"
              accept="image/*"
              multiple
              @change="onGarmentFileChange"
            />
          </div>

          <div v-if="runtime.garmentDataUrls.length" style="margin-top: 12px">
            <label>Garment preview</label>
            <div class="preview previewGarments">
              <div
                v-for="(src, idx) in runtime.garmentDataUrls"
                :key="`${activeStoryboardId}-${idx}`"
                class="previewItem"
              >
                <img
                  :src="src"
                  :alt="`Garment angle ${idx + 1}`"
                  draggable="false"
                  @click="$emit('open-image', src, 'Garment angle')"
                />
                <button
                  type="button"
                  class="removePreviewButton"
                  @click="removeGarmentImage(idx)"
                  :aria-label="`Remove garment image ${idx + 1}`"
                  title="Remove image"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div v-if="runtime.garmentDataUrls.length < 3" class="muted" style="margin-top: 8px">
              Tip: upload 3–4 angles (front/side/back) for better accuracy.
            </div>
          </div>

          <div class="chooseFromPrints" style="margin-top: 16px;">
            <button
              type="button"
              class="toggle-assets-btn"
              @click="showSavedPrints = !showSavedPrints"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :style="{ transform: showSavedPrints ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span>Choose from Printed Garments</span>
            </button>
            <div v-if="showSavedPrints && savedPrints.length" style="margin-top: 12px;">
               <label>Saved Prints</label>
               <div class="preview previewGarments">
                <div
                  v-for="(print, idx) in savedPrints"
                  :key="print.id"
                  class="previewItem"
                  @click="addGarmentFromDataUrl(print.url, print.fileName || `print-${idx}.png`)"
                  title="Click to add as garment"
                >
                   <img :src="print.url" :alt="print.title" draggable="false" />
                </div>
               </div>
            </div>
             <div v-if="showSavedPrints && !savedPrints.length" class="muted" style="margin-top: 8px;">
              No saved prints found. Go to "Add Prints" to generate some.
            </div>
          </div>
        </div>

        <div class="parameterSection">
          <div class="sectionTitle" style="margin-top: 0">Creative Direction</div>

          <div>
            <FieldLabel
              label="Occasion"
              info="Sets the vibe for styling and scene (lighting, accessories, background mood). Pick a preset and optionally add extra detail (e.g., “sunset beach”, “nightclub”, “wedding guest”)."
            />
            <PillRadioGroup
              name="occasion"
              :model-value="config.occasionPreset"
              @update:model-value="config.occasionPreset = $event"
              :options="occasionPresetOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.occasionDetails"
              placeholder="Optional: add details or type a custom occasion"
            />
          </div>

          <div style="height: 40px" />

          <div class="row">
            <div>
              <FieldLabel
                label="Color scheme"
                info="The overall color palette you want the model + background to lean into. This helps the generator choose complementary lighting and scene colors (e.g., “pastel”, “neutral”, “red & white”, “monochrome”)."
              />
              <input
                class="control"
                type="text"
                v-model="config.colorScheme"
                placeholder="e.g. red & white, pastel, neutral, monochrome"
              />
            </div>
            <div>
              <FieldLabel
                label="Accessories"
                info="Optional add-ons to make the scene feel complete (e.g., sunglasses, tote bag, heels). Keep it realistic and not too many items."
              />
              <input
                class="control"
                type="text"
                v-model="config.accessories"
                placeholder="comma separated, e.g. straw hat, sandals"
              />
            </div>
          </div>

          <div style="height: 40px" />

          <div>
            <FieldLabel label="Footwear" info="Choose footwear and optionally add details. If you set both, they will be combined." />
            <PillRadioGroup
              name="footwear"
              :model-value="config.footwearPreset"
              @update:model-value="config.footwearPreset = $event"
              :options="footwearPresetOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.footwearDetails"
              placeholder="Optional: add details (e.g., white sneakers, nude heels, leather boots)"
            />
          </div>

          <div style="height: 40px" />

          <div>
            <FieldLabel
              label="Overall Style"
              info="Pick a modern ecommerce styling direction (e.g., quiet luxury, streetwear). You can also add extra keywords below."
            />
            <PillRadioGroup
              name="styleKeywords"
              :model-value="config.stylePreset"
              @update:model-value="config.stylePreset = $event"
              :options="stylePresetOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.styleKeywordsDetails"
              placeholder="Optional: add style keywords (comma separated)"
            />
          </div>
        </div>

        <div class="parameterSection">
          <div class="sectionTitle" style="margin-top: 0">Background</div>
          <div>
            <FieldLabel
              label="Background theme"
              info="Describes the environment you want (e.g., studio, beach, rooftop, garden). Pick a preset and optionally add extra detail."
            />
            <PillRadioGroup
              name="backgroundTheme"
              :model-value="config.backgroundThemePreset"
              @update:model-value="config.backgroundThemePreset = $event"
              :options="backgroundThemeOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.backgroundThemeDetails"
              placeholder="Optional: add details (lighting, location, props)"
            />
          </div>
          <div v-if="runtime.backgroundDataUrls.length" style="margin-top: 14px">
            <label>Background references</label>
            <div class="preview previewAssets">
              <div
                v-for="(src, idx) in runtime.backgroundDataUrls"
                :key="`${activeStoryboardId}-bg-ref-${idx}`"
                class="previewItem"
              >
                <img
                  :src="src"
                  :alt="`Background reference ${idx + 1}`"
                  draggable="false"
                  @click="$emit('open-image', src, 'Background reference', 'Background reference')"
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

          <div class="chooseFromAssets" style="margin-top: 16px;">
            <button
              type="button"
              class="toggle-assets-btn"
              @click="showSavedBackgrounds = !showSavedBackgrounds"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :style="{ transform: showSavedBackgrounds ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span>Choose from Uploaded Backgrounds</span>
            </button>
            <div v-if="showSavedBackgrounds && backgroundAssetImages.length" style="margin-top: 12px;">
               <label>Saved Backgrounds</label>
               <div class="preview previewAssets">
                <div
                  v-for="(asset, idx) in backgroundAssetImages"
                  :key="asset.id"
                  class="previewItem"
                  @click="addBackgroundFromDataUrl(asset.url, asset.fileName || `bg-asset-${idx}.png`)"
                  title="Click to add as background"
                >
                   <img :src="asset.url" :alt="asset.title" draggable="false" />
                </div>
               </div>
            </div>
             <div v-if="showSavedBackgrounds && !backgroundAssetImages.length" class="muted" style="margin-top: 8px;">
              No uploaded backgrounds found. Go to "Uploaded Assets" to add some.
            </div>
          </div>
        </div>

        <div class="parameterSection">
          <div class="sectionTitle" style="margin-top: 0">Model</div>
          <div>
            <FieldLabel
              label="Model"
              info="Use this to bias the generated model (ethnicity / vibe). Pick a preset and/or add your own description."
            />
            <PillRadioGroup
              name="modelPreference"
              :model-value="config.modelPreset"
              @update:model-value="config.modelPreset = $event"
              :options="modelEthnicityOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.modelDetails"
              placeholder="Optional: add model description (ethnicity, vibe, etc.)"
            />
          </div>

          <div style="height: 40px" />

          <div>
            <FieldLabel
              label="Model pose"
              info="Choose a natural ecommerce pose for the main image (standing, full-body). Pick a preset and optionally add details. If you set both, they will be combined."
            />
            <PillRadioGroup
              name="modelPose"
              :model-value="config.modelPosePreset"
              @update:model-value="config.modelPosePreset = $event"
              :options="modelPosePresetOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.modelPoseDetails"
              placeholder="Optional: add pose details (e.g., slight step, relaxed hands, 3/4 turn)"
            />
          </div>

          <div style="height: 40px" />

          <div>
            <FieldLabel
              label="Model styling notes"
              info="Pick a preset for hair/makeup/jewelry, and optionally add your own notes. If you set both, they will be combined."
            />
            <PillRadioGroup
              name="modelStyling"
              :model-value="config.modelStylingPreset"
              @update:model-value="config.modelStylingPreset = $event"
              :options="modelStylingPresetOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="config.modelStylingNotes"
              placeholder="Optional: add your own notes (hair/makeup/jewelry, vibe)"
            />
          </div>
          <div v-if="runtime.modelDataUrls.length" style="margin-top: 14px">
            <label>Model references</label>
            <div class="preview previewAssets">
              <div
                v-for="(src, idx) in runtime.modelDataUrls"
                :key="`${activeStoryboardId}-model-ref-${idx}`"
                class="previewItem"
              >
                <img
                  :src="src"
                  :alt="`Model reference ${idx + 1}`"
                  draggable="false"
                  @click="$emit('open-image', src, 'Model reference', 'Model reference')"
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

          <div class="chooseFromAssets" style="margin-top: 16px;">
            <button
              type="button"
              class="toggle-assets-btn"
              @click="showSavedModels = !showSavedModels"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :style="{ transform: showSavedModels ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span>Choose from Uploaded Models</span>
            </button>
            <div v-if="showSavedModels && modelAssetImages.length" style="margin-top: 12px;">
               <label>Saved Models</label>
               <div class="preview previewAssets">
                <div
                  v-for="(asset, idx) in modelAssetImages"
                  :key="asset.id"
                  class="previewItem"
                  @click="addModelFromDataUrl(asset.url, asset.fileName || `model-asset-${idx}.png`)"
                  title="Click to add as model"
                >
                   <img :src="asset.url" :alt="asset.title" draggable="false" />
                </div>
               </div>
            </div>
             <div v-if="showSavedModels && !modelAssetImages.length" class="muted" style="margin-top: 8px;">
              No uploaded models found. Go to "Uploaded Assets" to add some.
            </div>
          </div>
        </div>

        <div class="">
          <div class="sectionTitle" style="margin-top: 0">Generate</div>
          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="isGenerating">
              {{ isGenerating ? "Generating..." : "Generate look" }}
            </button>
            <button
              type="button"
              class="btnGhost"
              :aria-pressed="config.includeDebugStr === 'yes'"
              :disabled="isGenerating"
              @click="config.includeDebugStr = config.includeDebugStr === 'yes' ? 'no' : 'yes'"
              title="Show/hide the internal prompts used for generation."
            >
              {{ config.includeDebugStr === "yes" ? "Debug off" : "Debug" }}
            </button>
          </div>

          <div v-if="runtime.generateError" class="error">{{ runtime.generateError }}</div>

          <div v-if="runtime.chosenSummary" style="margin-top: 12px">
            <label>Chosen plan</label>
            <pre class="muted" style="white-space: pre-wrap">{{ JSON.stringify(runtime.chosenSummary, null, 2) }}</pre>
          </div>

          <div v-if="runtime.debugSummary && config.includeDebugStr === 'yes'" style="margin-top: 12px">
            <label>Prompts</label>
            <div v-if="runtime.debugSummary.final_prompt" style="margin-top: 10px">
              <div class="muted" style="margin-bottom: 6px">Text prompt (LLM output)</div>
              <pre class="muted" style="white-space: pre-wrap">{{ runtime.debugSummary.final_prompt }}</pre>
            </div>
            <div v-if="runtime.debugSummary.composite_prompt" style="margin-top: 10px">
              <div class="muted" style="margin-bottom: 6px">Image prompt (composite)</div>
              <pre class="muted" style="white-space: pre-wrap">{{ runtime.debugSummary.composite_prompt }}</pre>
            </div>
            <div v-if="runtime.debugSummary.negative_prompt" style="margin-top: 10px">
              <div class="muted" style="margin-bottom: 6px">Avoid</div>
              <pre class="muted" style="white-space: pre-wrap">{{ runtime.debugSummary.negative_prompt }}</pre>
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import FieldLabel from "./FieldLabel.vue";
import PillRadioGroup from "./PillRadioGroup.vue";
import type { StoryboardConfig } from "../lib/storyboards";
import {
  backgroundThemeOptions,
  footwearPresetOptions,
  modelEthnicityOptions,
  modelPosePresetOptions,
  modelStylingPresetOptions,
  occasionPresetOptions,
  stylePresetOptions,
} from "../lib/presets";

type RuntimeLite = {
  garmentDataUrls: string[];
  garmentFileNames: string[];
  backgroundDataUrls: string[];
  modelDataUrls: string[];
  generateError: string | null;
  chosenSummary: any;
  debugSummary: any;
};

type SavedPrint = {
  id: string;
  url: string;
  title: string;
  fileName?: string;
};

defineProps<{
  config: StoryboardConfig;
  runtime: RuntimeLite;
  activeStoryboardId: string;
  isGenerating: boolean;
  onGarmentFileChange: (e: Event) => void;
  removeGarmentImage: (idx: number) => void;
  removeBackgroundImage: (idx: number) => void;
  removeModelImage: (idx: number) => void;
  savedPrints: SavedPrint[];
  backgroundAssetImages: SavedPrint[];
  modelAssetImages: SavedPrint[];
  addGarmentFromDataUrl: (url: string, fileName: string) => void;
  addBackgroundFromDataUrl: (url: string, fileName: string) => void;
  addModelFromDataUrl: (url: string, fileName: string) => void;
}>();

defineEmits<{
  (e: "submit"): void;
  (e: "open-image", src: string, title: string, alt?: string): void;
}>();

const showSavedPrints = ref(false);
const showSavedBackgrounds = ref(false);
const showSavedModels = ref(false);
</script>

<style scoped>
.toggle-assets-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  padding: 0;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.toggle-assets-btn:hover {
  opacity: 1;
  text-decoration: none;
}

.toggle-assets-btn svg {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}
</style>