<template>
  <div class="labelRow">
    <label :for="htmlFor || undefined">{{ label }}</label>
  </div>
</template>

<script setup lang="ts">

defineProps<{ htmlFor?: string; label: string; info: string }>();
</script>

