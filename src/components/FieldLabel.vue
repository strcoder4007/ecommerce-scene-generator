<template>
  <div class="labelRow">
    <label :for="htmlFor || undefined">{{ label }}</label>
    <InfoButton :text="info" />
  </div>
</template>

<script setup lang="ts">
import InfoButton from "./InfoButton.vue";

defineProps<{ htmlFor?: string; label: string; info: string }>();
</script>

