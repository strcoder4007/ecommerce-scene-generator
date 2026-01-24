<template>
  <div class="storyboardLibrary">
    <div class="storyboardLibraryHeader">
      <div>
        <div class="sectionTitle" style="margin: 0 0 6px">Storyboards</div>
        <div class="title" style="font-size: 18px; margin: 0">Pick an idea to continue</div>
        <div class="muted" style="margin-top: 6px">Storyboards are stored locally in this browser.</div>
      </div>
      <button type="button" class="btnSecondary" @click="$emit('create')" :disabled="isGenerating">
        New storyboard
      </button>
    </div>

    <div class="storyboardGallery" role="list" aria-label="Storyboards">
      <div v-for="sb in storyboards" :key="sb.id" class="storyboardCardWrapper" role="listitem">
        <div
          :class="[
            'storyboardCard',
            sb.id === activeId ? 'storyboardCardActive' : '',
            isGenerating ? 'storyboardCardDisabled' : '',
          ]"
          role="button"
          :tabindex="isGenerating ? -1 : 0"
          :aria-selected="sb.id === activeId ? 'true' : 'false'"
          :aria-disabled="isGenerating ? 'true' : 'false'"
          @click="handleOpen(sb.id)"
          @keydown.enter.prevent="handleOpen(sb.id)"
          @keydown.space.prevent="handleOpen(sb.id)"
        >
          <div class="storyboardCardPreview" aria-hidden="true">
            <template v-if="runtimeById[sb.id]?.resultDataUrl">
              <img :src="runtimeById[sb.id]?.resultDataUrl ?? undefined" alt="" draggable="false" />
            </template>
            <template v-else-if="sb.previewDataUrl">
              <img :src="sb.previewDataUrl" alt="" draggable="false" />
            </template>
            <template v-else-if="runtimeById[sb.id]?.garmentDataUrls?.length">
              <img :src="runtimeById[sb.id]?.garmentDataUrls?.[0] ?? undefined" alt="" draggable="false" />
            </template>
            <div v-else class="storyboardCardPreviewPlaceholder">No preview yet</div>
          </div>

          <div class="storyboardCardTop">
            <div class="storyboardCardTitle">{{ sb.title }}</div>
            <div class="storyboardCardMeta">{{ formatTimestamp(sb.updatedAt) }}</div>
          </div>
          <div class="storyboardCardSub">{{ subtitleFor(sb) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StoryboardRecord } from "../lib/storyboards";

type RuntimeLite = { resultDataUrl: string | null; garmentDataUrls: string[] };

const props = defineProps<{
  storyboards: StoryboardRecord[];
  activeId: string;
  runtimeById: Record<string, RuntimeLite | undefined>;
  isGenerating: boolean;
  subtitleFor: (sb: StoryboardRecord) => string;
  formatTimestamp: (iso: string) => string;
}>();

const emit = defineEmits<{
  (e: "create"): void;
  (e: "open", id: string): void;
}>();

function handleOpen(id: string) {
  if (props.isGenerating) return;
  emit("open", id);
}
</script>
