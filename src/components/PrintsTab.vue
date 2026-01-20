<template>
  <div class="storyboardLibrary">
    <div class="card">
      <div class="sectionTitle" style="margin-top: 0">Inputs</div>

      <div class="row" style="margin-top: 10px">
        <div>
          <FieldLabel
            htmlFor="printBaseGarment"
            label="White garment photo"
            info="Upload a photo of a white garment worn by a mannequin. This will be the base garment."
          />
          <input id="printBaseGarment" type="file" accept="image/*" @change="onBaseGarmentFileChange" />

          <div v-if="runtime.prints.baseGarmentDataUrl" class="preview" style="grid-template-columns: 1fr">
            <div class="previewItem">
              <img :src="runtime.prints.baseGarmentDataUrl" alt="White garment photo" draggable="false" />
              <button
                type="button"
                class="removePreviewButton"
                @click="removeBaseGarment"
                aria-label="Remove white garment photo"
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

        <div class="prints-and-colors">
          <FieldLabel
            htmlFor="printDesign"
            label="Print / design image"
            info="Upload the artwork/print to apply (pattern image or a solid color swatch image)."
          />
          <input id="printDesign" type="file" accept="image/*" @change="onPrintDesignFileChange" />

          <div v-if="runtime.prints.printDesignDataUrl" class="preview" style="grid-template-columns: 1fr">
            <div class="previewItem">
              <img :src="runtime.prints.printDesignDataUrl" alt="Print / design image" draggable="false" />
              <button
                type="button"
                class="removePreviewButton"
                @click="removePrintDesign"
                aria-label="Remove print/design image"
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

      <div style="height: 18px" />

      <div>
        <FieldLabel
          htmlFor="printAdditionalPrompt"
          label="Additional prompt"
          info="Optional notes for how the print should be applied (scale, placement, coverage, etc)."
        />
        <textarea
          id="printAdditionalPrompt"
          class="control"
          rows="4"
          v-model="config.printAdditionalPrompt"
          placeholder="Optional: e.g., all-over small repeating pattern; align with seams; keep neckline and cuffs clean; no distortion."
        />
      </div>

      <div class="actions" style="margin-top: 14px; justify-content: space-between">
        <button
          type="button"
          class="btnPrimary"
          @click="$emit('generate')"
          :disabled="isBusy || !runtime.prints.baseGarmentDataUrl || !runtime.prints.printDesignDataUrl"
        >
          {{ runtime.prints.generating ? "Generating..." : "Generate printed garment" }}
        </button>
      </div>

      <div v-if="runtime.prints.error" class="error">{{ runtime.prints.error }}</div>

      <div v-if="runtime.prints.outputDataUrl" style="margin-top: 14px">
        <div class="muted" style="margin-bottom: 8px">Result</div>
        <div class="preview" style="grid-template-columns: 1fr">
          <div class="previewItem">
            <img :src="runtime.prints.outputDataUrl" alt="Printed garment result" draggable="false" />
          </div>
        </div>
        <div class="resultImageButtons">
          <a
            class="btn btnGhost iconButton"
            style="width: 150px"
            :href="runtime.prints.outputDataUrl"
            :download="`printed-garment-${Date.now()}.${mimeToExtension(runtime.prints.outputMimeType)}`"
            aria-label="Download printed garment"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 3v10" />
              <path d="M8 11l4 4 4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>&nbsp;&nbsp;Download
          </a>
          <button
            type="button"
            class="btnGhost iconButton"
            @click="$emit('open-image', runtime.prints.outputDataUrl, 'Printed garment')"
            aria-label="Open printed garment"
            title="Open"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M10 10 5 5" />
              <path d="M5 8V5H8" />
              <path d="M14 10 19 5" />
              <path d="M16 5h3v3" />
              <path d="M10 14 5 19" />
              <path d="M5 16v3h3" />
              <path d="M14 14 19 19" />
              <path d="M16 19h3v-3" />
            </svg>
          </button>
          <button
            type="button"
            class="btnGhost iconButton"
            @click="toggleRetry"
            :aria-expanded="retryOpen"
            aria-label="Retry printed garment"
            title="Retry"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>

        <div v-if="retryOpen" style="margin-top: 14px">
          <FieldLabel
            htmlFor="printRetryComments"
            label="Retry Comments"
            info="Optional notes for what to improve on this retry."
          />
          <input
            id="printRetryComments"
            class="control"
            type="text"
            v-model="retryComments"
            placeholder="What improvements would you like?"
          />
          <div class="actions" style="margin-top: 12px; justify-content: flex-end">
            <button type="button" class="btnPrimary" @click="emitRetry" :disabled="isBusy">
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import FieldLabel from "./FieldLabel.vue";
import type { StoryboardConfig } from "../lib/storyboards";

type PrintsRuntimeLite = {
  baseGarmentDataUrl: string | null;
  printDesignDataUrl: string | null;
  outputDataUrl: string | null;
  outputMimeType: string | null;
  generating: boolean;
  error: string | null;
};

type RuntimeLite = { prints: PrintsRuntimeLite };

defineProps<{
  storyboardTitle: string;
  config: StoryboardConfig;
  runtime: RuntimeLite;
  isBusy: boolean;
  mimeToExtension: (mimeType: string | null) => string;
  onBaseGarmentFileChange: (e: Event) => void;
  onPrintDesignFileChange: (e: Event) => void;
  removeBaseGarment: () => void;
  removePrintDesign: () => void;
}>();

const emit = defineEmits<{
  (e: "generate"): void;
  (e: "retry", comment: string): void;
  (e: "go-generate"): void;
  (e: "open-image", src: string, title: string): void;
}>();

const retryOpen = ref(false);
const retryComments = ref("");

function toggleRetry() {
  retryOpen.value = !retryOpen.value;
}

function emitRetry() {
  emit("retry", retryComments.value);
  retryOpen.value = false;
}
</script>
