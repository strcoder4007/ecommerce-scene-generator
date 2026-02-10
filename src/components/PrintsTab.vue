<template>
  <div class="storyboardLibrary">
    <div class="">
      <div class="sectionTitle" style="margin-top: 0">Inputs</div>

      <div class="row" style="margin-top: 10px">
        <div class="card">
          <FieldLabel
            htmlFor="printBaseGarmentFront"
            label="White garment photos"
            info="Upload front, back, and side views of the same white garment."
          />
          <div style="display: grid; gap: 12px">
            <div>
              <FieldLabel
                htmlFor="printBaseGarmentFront"
                label="Front view (required)"
                info="The front view is required."
              />
              <input id="printBaseGarmentFront" type="file" accept="image/*" @change="onBaseGarmentFrontFileChange" />

              <div v-if="runtime.prints.baseGarmentFrontDataUrl" class="preview" style="grid-template-columns: 1fr">
                <div class="previewItem">
                  <img
                    :src="runtime.prints.baseGarmentFrontDataUrl"
                    alt="White garment photo — front"
                    draggable="false"
                    @click="$emit('open-image', runtime.prints.baseGarmentFrontDataUrl, 'White garment — front')"
                  />
                  <button
                    type="button"
                    class="removePreviewButton"
                    @click="removeBaseGarmentFront"
                    aria-label="Remove white garment front photo"
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
            <div>
              <FieldLabel
                htmlFor="printBaseGarmentBack"
                label="Back view (required)"
                info="The back view is required."
              />
              <input id="printBaseGarmentBack" type="file" accept="image/*" @change="onBaseGarmentBackFileChange" />

              <div v-if="runtime.prints.baseGarmentBackDataUrl" class="preview" style="grid-template-columns: 1fr">
                <div class="previewItem">
                  <img
                    :src="runtime.prints.baseGarmentBackDataUrl"
                    alt="White garment photo — back"
                    draggable="false"
                    @click="$emit('open-image', runtime.prints.baseGarmentBackDataUrl, 'White garment — back')"
                  />
                  <button
                    type="button"
                    class="removePreviewButton"
                    @click="removeBaseGarmentBack"
                    aria-label="Remove white garment back photo"
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

            <div>
              <FieldLabel
                htmlFor="printBaseGarmentSide"
                label="Side view (required)"
                info="The side view is required."
              />
              <input id="printBaseGarmentSide" type="file" accept="image/*" @change="onBaseGarmentSideFileChange" />

              <div v-if="runtime.prints.baseGarmentSideDataUrl" class="preview" style="grid-template-columns: 1fr">
                <div class="previewItem">
                  <img
                    :src="runtime.prints.baseGarmentSideDataUrl"
                    alt="White garment photo — side"
                    draggable="false"
                    @click="$emit('open-image', runtime.prints.baseGarmentSideDataUrl, 'White garment — side')"
                  />
                  <button
                    type="button"
                    class="removePreviewButton"
                    @click="removeBaseGarmentSide"
                    aria-label="Remove white garment side photo"
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

        <div class="prints-and-colors card">
          <div class="print-header">PRINTS</div><br>
          <div class="tabGroup" role="tablist" aria-label="Print input mode" style="margin-bottom: 10px">
            <button
              type="button"
              :class="config.printInputKind === 'image' ? 'tabButton tabButtonActive' : 'tabButton'"
              :aria-selected="config.printInputKind === 'image'"
              @click="config.printInputKind = 'image'"
            >
              Image
            </button>
            <button
              type="button"
              :class="config.printInputKind === 'color' ? 'tabButton tabButtonActive' : 'tabButton'"
              :aria-selected="config.printInputKind === 'color'"
              @click="config.printInputKind = 'color'"
            >
              Colors
            </button>
          </div>

          <br>
          <br>


          <template v-if="config.printInputKind === 'color'">
            <FieldLabel
              htmlFor="printColorHex"
              label="Color"
              info="Pick a solid color to apply to the garment fabric (hex). The print/design image (if uploaded) will be ignored in this mode."
            />

            <div style="display: flex; gap: 10px; align-items: center">
              <input
                id="printColorPicker"
                type="color"
                :value="colorPickerValue"
                @input="onColorPickerInput"
                aria-label="Pick a color"
                style="
                  width: 54px;
                  height: 44px;
                  padding: 0;
                  border-radius: 12px;
                  border: 1px solid var(--border);
                  background: var(--surface-solid);
                "
              />
              <input
                id="printColorHex"
                class="control"
                type="text"
                v-model="config.printColorHex"
                placeholder="#RRGGBB"
                @blur="normalizeColorHex"
              />
            </div>
            <div v-if="config.printColorHex.trim() && !isValidColorHex" class="muted" style="margin-top: 8px">
              Please enter a valid hex color (e.g. #FF3366).
            </div>
          </template>

          <template v-else>
            <FieldLabel
              htmlFor="printDesign"
              label=""
              info="Upload the artwork/print to apply (pattern image or a solid color swatch image)."
            />
            <input id="printDesign" type="file" accept="image/*" @change="onPrintDesignFileChange" />

                        <div v-if="runtime.prints.printDesignDataUrl" class="preview" style="grid-template-columns: 1fr">
                        <div class="previewItem">
                          <img
                            :src="runtime.prints.printDesignDataUrl"
                            alt="Print / design image"
                            draggable="false"
                            @click="$emit('open-image', runtime.prints.printDesignDataUrl, 'Print / design image')"
                          />
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
                      </div>          </template>
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
          :disabled="
            isBusy ||
            !runtime.prints.baseGarmentFrontDataUrl ||
            !runtime.prints.baseGarmentBackDataUrl ||
            !runtime.prints.baseGarmentSideDataUrl ||
            (config.printInputKind === 'color' ? !isValidColorHex : !runtime.prints.printDesignDataUrl)
          "
        >
          <template v-if="runtime.prints.generating">
            Generating... {{ timerText }}
          </template>
          <template v-else>
            Generate Printed Garment
          </template>
        </button>
      </div>

      <div v-if="runtime.prints.error" class="error">{{ runtime.prints.error }}</div>

      <div
        v-if="
          runtime.prints.outputFrontDataUrl ||
          runtime.prints.outputBackDataUrl ||
          runtime.prints.outputSideDataUrl
        "
        style="margin-top: 14px"
      >
        <div class="muted" style="margin-bottom: 8px">Result</div>
        <div class="preview">
          <div v-if="runtime.prints.outputFrontDataUrl" style="display: grid; gap: 6px; place-items: center">
            <div class="previewItem">
              <img
                :src="runtime.prints.outputFrontDataUrl"
                alt="Printed garment result — front"
                draggable="false"
                @click="$emit('open-image', runtime.prints.outputFrontDataUrl, 'Printed garment — front')"
              />
            </div>
            <div class="muted" style="font-size: 12px">Front</div>
          </div>
          <div v-if="runtime.prints.outputBackDataUrl" style="display: grid; gap: 6px; place-items: center">
            <div class="previewItem">
              <img
                :src="runtime.prints.outputBackDataUrl"
                alt="Printed garment result — back"
                draggable="false"
                @click="$emit('open-image', runtime.prints.outputBackDataUrl, 'Printed garment — back')"
              />
            </div>
            <div class="muted" style="font-size: 12px">Back</div>
          </div>
          <div v-if="runtime.prints.outputSideDataUrl" style="display: grid; gap: 6px; place-items: center">
            <div class="previewItem">
              <img
                :src="runtime.prints.outputSideDataUrl"
                alt="Printed garment result — side"
                draggable="false"
                @click="$emit('open-image', runtime.prints.outputSideDataUrl, 'Printed garment — side')"
              />
            </div>
            <div class="muted" style="font-size: 12px">Side</div>
          </div>
        </div>
        <div class="resultImageButtons">
          <a
            v-if="runtime.prints.outputFrontDataUrl"
            class="btn btnGhost iconButton"
            style="width: 170px"
            :href="runtime.prints.outputFrontDataUrl"
            :download="`printed-garment-front-${Date.now()}.${mimeToExtension(runtime.prints.outputFrontMimeType)}`"
            aria-label="Download printed garment front"
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
            </svg>&nbsp;&nbsp;Download front
          </a>
          <a
            v-if="runtime.prints.outputBackDataUrl"
            class="btn btnGhost iconButton"
            style="width: 170px"
            :href="runtime.prints.outputBackDataUrl"
            :download="`printed-garment-back-${Date.now()}.${mimeToExtension(runtime.prints.outputBackMimeType)}`"
            aria-label="Download printed garment back"
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
            </svg>&nbsp;&nbsp;Download back
          </a>
          <a
            v-if="runtime.prints.outputSideDataUrl"
            class="btn btnGhost iconButton"
            style="width: 170px"
            :href="runtime.prints.outputSideDataUrl"
            :download="`printed-garment-side-${Date.now()}.${mimeToExtension(runtime.prints.outputSideMimeType)}`"
            aria-label="Download printed garment side"
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
            </svg>&nbsp;&nbsp;Download side
          </a>
          <button
            type="button"
            class="btn btnGhost iconButton"
            style="width: 110px"
            @click="$emit('save')"
            :disabled="
              isBusy ||
              !runtime.prints.outputFrontDataUrl ||
              !runtime.prints.outputBackDataUrl ||
              !runtime.prints.outputSideDataUrl
            "
            aria-label="Save printed garments"
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
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>&nbsp;&nbsp;Save all
          </button>
          <button
            type="button"
            class="btnGhost iconButton"
            @click="openPrimaryPrintedImage"
            :disabled="!hasPrintedOutputs"
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
import { computed, ref } from "vue";
import FieldLabel from "./FieldLabel.vue";
import type { StoryboardConfig } from "../lib/storyboards";
import { normalizeHexColor } from "../lib/utils";

type PrintsRuntimeLite = {
  baseGarmentFrontDataUrl: string | null;
  baseGarmentBackDataUrl: string | null;
  baseGarmentSideDataUrl: string | null;
  printDesignDataUrl: string | null;
  outputFrontDataUrl: string | null;
  outputFrontMimeType: string | null;
  outputBackDataUrl: string | null;
  outputBackMimeType: string | null;
  outputSideDataUrl: string | null;
  outputSideMimeType: string | null;
  generating: boolean;
  error: string | null;
};

type RuntimeLite = { prints: PrintsRuntimeLite };

const props = defineProps<{
  storyboardTitle: string;
  config: StoryboardConfig;
  runtime: RuntimeLite;
  isBusy: boolean;
  mimeToExtension: (mimeType: string | null) => string;
  onBaseGarmentFrontFileChange: (e: Event) => void;
  onBaseGarmentBackFileChange: (e: Event) => void;
  onBaseGarmentSideFileChange: (e: Event) => void;
  onPrintDesignFileChange: (e: Event) => void;
  removeBaseGarmentFront: () => void;
  removeBaseGarmentBack: () => void;
  removeBaseGarmentSide: () => void;
  removePrintDesign: () => void;
  printElapsedMs?: number;
}>();

const emit = defineEmits<{
  (e: "generate"): void;
  (e: "retry", comment: string): void;
  (e: "go-generate"): void;
  (e: "open-image", src: string, title: string): void;
  (e: "save"): void;
}>();

const retryOpen = ref(false);
const retryComments = ref("");

const timerText = computed(() => {
  const ms = props.printElapsedMs || 0;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
});

const colorPickerValue = computed(() => normalizeHexColor(props.config.printColorHex) || "#000000");
const isValidColorHex = computed(() => Boolean(normalizeHexColor(props.config.printColorHex)));
const hasPrintedOutputs = computed(() =>
  Boolean(
    props.runtime.prints.outputFrontDataUrl ||
      props.runtime.prints.outputBackDataUrl ||
      props.runtime.prints.outputSideDataUrl,
  ),
);
const primaryPrintedOutput = computed(
  () =>
    props.runtime.prints.outputFrontDataUrl ||
    props.runtime.prints.outputBackDataUrl ||
    props.runtime.prints.outputSideDataUrl ||
    "",
);

function toggleRetry() {
  retryOpen.value = !retryOpen.value;
}

function onColorPickerInput(e: Event) {
  const el = e.target as HTMLInputElement | null;
  const value = (el?.value || "").trim();
  props.config.printColorHex = normalizeHexColor(value) || value;
}

function normalizeColorHex() {
  const normalized = normalizeHexColor(props.config.printColorHex);
  if (normalized) props.config.printColorHex = normalized;
}

function emitRetry() {
  emit("retry", retryComments.value);
  retryOpen.value = false;
}

function openPrimaryPrintedImage() {
  if (!primaryPrintedOutput.value) return;
  emit("open-image", primaryPrintedOutput.value, "Printed garment");
}
</script>
