<template>
  <button type="button" class="infoButton" :aria-label="text">
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 18.25C5.44467 18.25 1.75 14.5553 1.75 10C1.75 5.44467 5.44467 1.75 10 1.75C14.5553 1.75 18.25 5.44467 18.25 10C18.25 14.5553 14.5553 18.25 10 18.25Z"
        stroke="currentColor"
        stroke-width="1.6"
      />
      <path d="M10 8.7V14.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <path d="M10 6.35H10.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
    <span class="tooltip" role="tooltip">{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ text: string }>();
</script>

