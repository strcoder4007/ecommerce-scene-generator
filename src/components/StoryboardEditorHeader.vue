<template>
  <div class="storyboardEditorCardHeader" aria-label="Storyboard manager">
    <div class="storyboardEditorHeaderTop">
      <button type="button" class="btnGhost storyboardBackButton" @click="$emit('back')" :disabled="disabled">
        ← Storyboards
      </button>
      <div class="badge" title="Saved locally in this browser">
        <span>Saved locally</span>
        <code>{{ formatTimestamp(updatedAt) }}</code>
      </div>
    </div>

    <div class="storyboardEditorHeaderMain">
      <div class="storyboardEditorHeaderName">
        <div class="sectionTitle" style="margin: 0 0 6px">Storyboard name</div>
        <input class="control" :value="title" @input="$emit('update:title', ($event.target as HTMLInputElement).value.trim())" :disabled="disabled" />
      </div>

      <div class="storyboardEditorHeaderActions">
        <button type="button" class="btnSecondary" @click="$emit('duplicate')" :disabled="disabled">
          Duplicate
        </button>
        <button type="button" class="btnDanger" @click="$emit('request-delete')" :disabled="disabled || !canDelete">
          Delete
        </button>
      </div>
    </div>

    <div v-if="!canDelete" class="muted" style="margin-top: -2px">Keep at least one storyboard.</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  updatedAt: string;
  disabled: boolean;
  canDelete: boolean;
  formatTimestamp: (iso: string) => string;
}>();

defineEmits<{
  (e: "back"): void;
  (e: "duplicate"): void;
  (e: "request-delete"): void;
  (e: "update:title", value: string): void;
}>();
</script>

