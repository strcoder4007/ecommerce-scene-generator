<template>
  <div class="card result">
    <FieldLabel
      label="Generated result"
      info="Your generated ecommerce scene will appear here. For best results, start with Auto settings."
    />

    <div v-if="isGenerating" class="resultPlaceholder loaderPlaceholder">
      <div class="loader">
        <div class="loaderHeader">
          <Spinner />
          <div>
            <div class="loaderTitle">{{ generationSteps[generationStepIndex] }}</div>
            <div class="loaderSubtitle">Elapsed {{ formatDurationMs(generationElapsedMs) }}</div>
          </div>
        </div>

        <div class="loaderSteps" aria-label="Generation progress">
          <div
            v-for="(label, idx) in generationSteps"
            :key="label"
            :class="
              idx < generationStepIndex
                ? 'loaderStep loaderStepDone'
                : idx === generationStepIndex
                  ? 'loaderStep loaderStepActive'
                  : 'loaderStep'
            "
          >
            <div class="loaderDot" aria-hidden="true" />
            <div class="loaderStepText">{{ label }}</div>
          </div>
        </div>

        <div class="loaderHint muted">Keep this tab open while we generate your image.</div>
      </div>
    </div>

    <template v-else-if="runtime.resultDataUrl">
      <div class="resultActions">
        <div class="resultActionsRight">
          <div v-if="runtime.resultTimingsMs" class="badge" title="Time spent generating this image">
            <span>Thinking</span>
            <code>{{ formatDurationMs(computedTimings.textLlmMs) }}</code>
            <span>Image gen</span>
            <code>{{ formatDurationMs(computedTimings.imageGenMs) }}</code>
            <span>Total</span>
            <code>{{ formatDurationMs(computedTimings.totalMs) }}</code>
          </div>
        </div>
      </div>
      <div class="resultImageZoom" @pointermove="onResultImagePointerMove" @pointerleave="onResultImagePointerLeave">
        <img class="resultImage" :src="runtime.resultDataUrl" alt="Generated look" draggable="false" />
      </div>
      <div class="resultImageButtons">
        <a
          class="btn btnGhost iconButton"
          style="width: 130px"
          :href="runtime.resultDataUrl"
          :download="`look-${Date.now()}.${mimeToExtension(runtime.resultMimeType)}`"
          aria-label="Download generated image"
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
          @click="$emit('open-image', runtime.resultDataUrl, 'Generated look', 'Generated look')"
          aria-label="Open generated image"
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
      </div>
    </template>

    <div v-else class="resultPlaceholder resultEmpty">
      <div>
        <div class="resultEmptyTitle">Ready when you are</div>
        <div class="muted">Upload garment photos, then click “Generate look”.</div>
      </div>
    </div>

    <div class="divider" style="margin: 18px 0" />

    <FieldLabel
      label="Multiple Angles"
      info="Generate natural ecommerce poses for side and back views, matching the same garment + scene as the main result."
    />

    <div v-if="!runtime.resultDataUrl" class="muted">Generate the main image first to unlock multiple angles.</div>

    <div v-else>
      <div class="actions" style="justify-content: space-between">
        <button
          type="button"
          class="btnSecondary"
          @click="$emit('generate-angles')"
          :disabled="isGenerating || runtime.angles.generating"
        >
          {{ runtime.angles.generating ? "Generating..." : "Generate Multiple Angles" }}
        </button>
        <button
          v-if="runtime.angles.sideDataUrl && runtime.angles.backDataUrl"
          type="button"
          class="btnPrimary"
          @click="$emit('download-all')"
        >
          Download all images
        </button>
      </div>

      <div v-if="runtime.angles.timingsMs" class="muted" style="margin-top: 10px">
        Side: {{ formatDurationMs(runtime.angles.timingsMs.side) }} · Back:
        {{ formatDurationMs(runtime.angles.timingsMs.back) }} · Total:
        {{ formatDurationMs(runtime.angles.timingsMs.total) }}
      </div>

      <div v-if="runtime.angles.error" class="error">{{ runtime.angles.error }}</div>

      <div v-if="runtime.angles.sideDataUrl || runtime.angles.backDataUrl" class="anglesGrid">
        <div class="angleTile">
          <div class="angleTileHeader">
            <div class="angleTileTitle">Side view</div>
            <div v-if="runtime.angles.sideDataUrl" class="angleTileActions">
              <button
                type="button"
                class="btnGhost iconButton"
                @click="$emit('open-image', runtime.angles.sideDataUrl, 'Side view', 'Generated side view')"
                aria-label="Open side view"
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
              <a
                class="btn btnGhost iconButton"
                :href="runtime.angles.sideDataUrl"
                :download="`look-side-${Date.now()}.${mimeToExtension(runtime.angles.sideMimeType)}`"
                aria-label="Download side view"
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
                </svg>
              </a>
            </div>
          </div>
          <div v-if="runtime.angles.sideDataUrl" style="margin-top: 10px">
            <img :src="runtime.angles.sideDataUrl" alt="Generated side view" draggable="false" />
          </div>
          <div v-else class="muted" style="margin-top: 10px">Not generated yet.</div>
        </div>

        <div class="angleTile">
          <div class="angleTileHeader">
            <div class="angleTileTitle">Back view</div>
            <div v-if="runtime.angles.backDataUrl" class="angleTileActions">
              <button
                type="button"
                class="btnGhost iconButton"
                @click="$emit('open-image', runtime.angles.backDataUrl, 'Back view', 'Generated back view')"
                aria-label="Open back view"
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
              <a
                class="btn btnGhost iconButton"
                :href="runtime.angles.backDataUrl"
                :download="`look-back-${Date.now()}.${mimeToExtension(runtime.angles.backMimeType)}`"
                aria-label="Download back view"
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
                </svg>
              </a>
            </div>
          </div>
          <div v-if="runtime.angles.backDataUrl" style="margin-top: 10px">
            <img :src="runtime.angles.backDataUrl" alt="Generated back view" draggable="false" />
          </div>
          <div v-else class="muted" style="margin-top: 10px">Not generated yet.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FieldLabel from "./FieldLabel.vue";
import Spinner from "./Spinner.vue";

type Timings = { textLlmMs: number; imageGenMs: number; totalMs: number };

type AnglesRuntime = {
  generating: boolean;
  error: string | null;
  sideDataUrl: string | null;
  sideMimeType: string | null;
  backDataUrl: string | null;
  backMimeType: string | null;
  timingsMs: { side: number; back: number; total: number } | null;
};

type RuntimeLite = {
  resultDataUrl: string | null;
  resultMimeType: string | null;
  resultTimingsMs: Record<string, number> | null;
  angles: AnglesRuntime;
};

defineProps<{
  isGenerating: boolean;
  generationStepIndex: number;
  generationElapsedMs: number;
  generationSteps: readonly string[];
  runtime: RuntimeLite;
  computedTimings: Timings;
  formatDurationMs: (ms: number | null | undefined) => string;
  mimeToExtension: (mimeType: string | null) => string;
  onResultImagePointerMove: (event: PointerEvent) => void;
  onResultImagePointerLeave: (event: PointerEvent) => void;
}>();

defineEmits<{
  (e: "open-image", src: string, title: string, alt?: string): void;
  (e: "generate-angles"): void;
  (e: "download-all"): void;
}>();
</script>

