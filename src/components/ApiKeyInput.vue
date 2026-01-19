<template>
  <div class="badge" style="gap: 10px">
    <span>API key</span>
    <input
      class="control"
      :type="show ? 'text' : 'password'"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value.trim())"
      placeholder="Paste your key"
      style="width: 220px; padding: 8px 10px"
    />
    <button type="button" class="btnGhost" @click="show = !show">
      {{ show ? "Hide" : "Show" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{ modelValue: string }>();
defineEmits<{ (e: "update:modelValue", value: string): void }>();

const show = ref(false);
</script>

