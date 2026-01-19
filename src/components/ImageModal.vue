<template>
  <div
    v-if="open"
    class="modalOverlay"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @click.self="$emit('close')"
  >
    <div class="modalCard imageModalCard">
      <div class="imageModalHeader">
        <div class="modalTitle">{{ title }}</div>
        <button type="button" class="btnGhost iconButton" @click="$emit('close')" aria-label="Close image">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="imageModalBody">
        <img :src="src" :alt="alt || title" draggable="false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; src: string; title: string; alt?: string }>();
defineEmits<{ (e: "close"): void }>();
</script>

