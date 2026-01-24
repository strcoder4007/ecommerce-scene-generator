<template>
  <div class="savedImagesPane">
    <div class="savedImagesHeader">
      <div>
        <div class="title" style="font-size: 18px; margin: 0">Your saved exports</div>
      </div>
      <div class="badge" title="Total saved images">
        <span>Total</span>
        <code>{{ images.length }}</code>
      </div>
    </div>

    <div class="savedImagesSections">
      <section v-for="section in sections" :key="section.key" class="savedImagesSection">
        <div class="savedImagesSectionHeader">
          <div>
            <div class="savedImagesSectionTitle">{{ section.title }}</div>
            <div class="savedImagesSectionMeta">{{ section.description }}</div>
          </div>
          <div class="badge" :title="section.badgeTitle">
            <span>Items</span>
            <code>{{ section.images.length }}</code>
          </div>
        </div>

        <div v-if="!section.images.length" class="savedImagesSectionEmpty">
          <div class="muted">{{ section.empty }}</div>
        </div>

        <div v-else class="savedImagesGrid compactGrid" role="list" :aria-label="section.ariaLabel">
          <div v-for="image in section.images" :key="image.id" class="savedImageCard" role="listitem">
            <div class="savedImagePreviewContainer">
              <button
                type="button"
                class="savedImagePreview"
                @click="$emit('open-image', image.url, image.title, image.title)"
                :aria-label="`Open ${image.title}`"
              >
                <img :src="image.url" :alt="image.title" draggable="false" />
              </button>
              <div class="savedImageOverlay">
                <button
                  type="button"
                  class="btn btnGhost iconButton overlayButton"
                  @click="$emit('open-image', image.url, image.title, image.title)"
                  aria-label="Maximize image"
                  title="Maximize"
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
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
                <a
                  class="btn btnGhost iconButton overlayButton"
                  :href="image.url"
                  :download="image.fileName || `saved-${image.id}.${mimeToExtension(image.mimeType)}`"
                  aria-label="Download saved image"
                  title="Download"
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
                <button
                  type="button"
                  class="btn btnGhost iconButton overlayButton danger"
                  @click.stop="$emit('delete-image', image.id)"
                  aria-label="Delete image"
                  title="Delete"
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
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="savedImageMeta">
              <div class="savedImageTitle" :title="image.title">{{ image.title }}</div>
              <div class="savedImageSub">
                {{ formatTimestamp(image.createdAt) }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

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

defineEmits<{
  (e: "open-image", src: string, title: string, alt?: string): void;
  (e: "delete-image", id: string): void;
}>();

const props = defineProps<{
  images: SavedImageView[];
  formatTimestamp: (value: number) => string;
  mimeToExtension: (mimeType: string | null) => string;
}>();

const printsImages = computed(() => props.images.filter((image) => image.kind === "prints"));
const generatedImages = computed(() => props.images.filter((image) => image.kind !== "prints" && !image.kind?.startsWith("asset-")));

const sections = computed(() => [
  {
    key: "prints",
    title: "Added Prints",
    description: "Printed garments saved from the Add Prints workflow.",
    empty: "No saved printed garments yet.",
    badgeTitle: "Saved Add Prints images",
    ariaLabel: "Saved images from Add Prints page",
    images: printsImages.value,
  },
  {
    key: "generate",
    title: "Generated Images",
    description: "Main looks and multi-angle exports saved from generation.",
    empty: "No saved generated looks yet.",
    badgeTitle: "Saved Generate Image exports",
    ariaLabel: "Saved images from Generate Image page",
    images: generatedImages.value,
  },
]);

function formatKind(kind: string): string {
  return (kind || "").replace(/_/g, " ").trim();
}
</script>
