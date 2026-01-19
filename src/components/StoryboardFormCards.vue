<template>
  <form class="storyboardForm" @submit.prevent="$emit('submit')">
    <fieldset class="formFieldset" :disabled="isGenerating">
      <div class="storyboardCards">
        <div class="card">
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
                <img :src="src" :alt="`Garment angle ${idx + 1}`" draggable="false" />
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
        </div>

        <div class="card">
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

        <div class="card">
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
        </div>

        <div class="card">
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
        </div>

        <div class="card">
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
import FieldLabel from "./FieldLabel.vue";
import PillRadioGroup from "./PillRadioGroup.vue";
import type { StoryboardConfig } from "../lib/storyboards";
import {
  backgroundThemeOptions,
  footwearPresetOptions,
  modelEthnicityOptions,
  modelStylingPresetOptions,
  occasionPresetOptions,
  stylePresetOptions,
} from "../lib/presets";

type RuntimeLite = {
  garmentDataUrls: string[];
  garmentFileNames: string[];
  generateError: string | null;
  chosenSummary: any;
  debugSummary: any;
};

defineProps<{
  config: StoryboardConfig;
  runtime: RuntimeLite;
  activeStoryboardId: string;
  isGenerating: boolean;
  onGarmentFileChange: (e: Event) => void;
  removeGarmentImage: (idx: number) => void;
}>();

defineEmits<{ (e: "submit"): void }>();
</script>

