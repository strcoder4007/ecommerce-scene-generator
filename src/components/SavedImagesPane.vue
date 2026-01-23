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

        <div v-else class="savedImagesGrid" role="list" :aria-label="section.ariaLabel">
          <div v-for="image in section.images" :key="image.id" class="savedImageCard" role="listitem">
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
}>();

const props = defineProps<{
  images: SavedImageView[];
  formatTimestamp: (value: number) => string;
  mimeToExtension: (mimeType: string | null) => string;
}>();

const printsImages = computed(() => props.images.filter((image) => image.kind === "prints"));
const generatedImages = computed(() => props.images.filter((image) => image.kind !== "prints"));

const sections = computed(() => [
  {
    key: "prints",
    title: "From Add Prints Page",
    description: "Printed garments saved from the Add Prints workflow.",
    empty: "No saved printed garments yet.",
    badgeTitle: "Saved Add Prints images",
    ariaLabel: "Saved images from Add Prints page",
    images: printsImages.value,
  },
  {
    key: "generate",
    title: "From Generate Image Page",
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
