<template>
  <div
    v-if="open"
    class="modalOverlay"
    role="dialog"
    aria-modal="true"
    aria-label="Delete storyboard"
    @click.self="$emit('close')"
  >
    <div class="modalCard">
      <div class="modalTitle">Delete storyboard?</div>
      <div class="muted" style="margin-top: 6px">
        This removes <strong>{{ title }}</strong> from this browser.
      </div>
      <div class="actions" style="justify-content: flex-end; margin-top: 16px">
        <button type="button" class="btnSecondary" @click="$emit('close')">Cancel</button>
        <button type="button" class="btnDanger" @click="$emit('confirm')">Delete</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; title: string }>();
defineEmits<{ (e: "close"): void; (e: "confirm"): void }>();
</script>

