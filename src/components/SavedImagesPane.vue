<template>
  <div class="savedImagesPane">
    <div class="savedImagesHeader">
      <div>
        <div class="sectionTitle" style="margin: 0 0 6px">Saved images</div>
        <div class="title" style="font-size: 18px; margin: 0">Your saved exports</div>
        <div class="muted" style="margin-top: 6px">Stored locally in this browser.</div>
      </div>
      <div class="badge" title="Total saved images">
        <span>Total</span>
        <code>{{ images.length }}</code>
      </div>
    </div>

    <div v-if="!images.length" class="resultEmpty">
      <div>
        <div class="resultEmptyTitle">No saved images yet</div>
        <div class="muted">Save generated looks to collect them here.</div>
      </div>
    </div>

    <div v-else class="savedImagesGrid" role="list" aria-label="Saved images">
      <div v-for="image in images" :key="image.id" class="savedImageCard" role="listitem">
        <button
          type="button"
          class="savedImagePreview"
          @click="$emit('open-image', image.url, image.title, image.title)"
          :aria-label="`Open ${image.title}`"
        >
          <img :src="image.url" :alt="image.title" draggable="false" />
        </button>

        <div class="savedImageMeta">
          <div class="savedImageTitle">{{ image.title }}</div>
          <div class="savedImageSub">
            {{ formatTimestamp(image.createdAt) }}
            <span v-if="image.storyboardTitle"> · {{ image.storyboardTitle }}</span>
            <span v-if="image.kind"> · {{ formatKind(image.kind) }}</span>
          </div>
        </div>

        <div class="savedImageActions">
          <a
            class="btn btnGhost iconButton"
            :href="image.url"
            :download="image.fileName || `saved-${image.id}.${mimeToExtension(image.mimeType)}`"
            aria-label="Download saved image"
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
    </div>
  </div>
</template>

<script setup lang="ts">
type SavedImageView = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  kind?: string;
  mimeType: string;
  fileName?: string;
  storyboardTitle?: string;
};

defineProps<{
  images: SavedImageView[];
  formatTimestamp: (value: number) => string;
  mimeToExtension: (mimeType: string | null) => string;
}>();

defineEmits<{
  (e: "open-image", src: string, title: string, alt?: string): void;
}>();

function formatKind(kind: string): string {
  return (kind || "").replace(/_/g, " ").trim();
}
</script>
