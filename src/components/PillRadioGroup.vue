<template>
  <div class="pillGroup" role="radiogroup" :aria-label="name">
    <label v-for="opt in options" :key="opt.value" class="pill">
      <input
        type="radio"
        :name="name"
        :value="opt.value"
        :checked="modelValue === opt.value"
        @change="emit('update:modelValue', opt.value)"
      />
      <span>{{ opt.label }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
type PillOption = { value: string; label: string };

defineProps<{ name: string; modelValue: string; options: PillOption[] }>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();
</script>

