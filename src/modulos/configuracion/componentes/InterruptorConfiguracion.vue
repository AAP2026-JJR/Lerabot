<script setup lang="ts">
withDefaults(defineProps<{ modelValue: boolean; etiqueta: string; descripcion?: string; bloqueado?: boolean }>(), { descripcion: '', bloqueado: false })
const emit = defineEmits<{ 'update:modelValue': [valor: boolean] }>()
</script>
<template>
  <div class="flex min-w-0 items-center justify-between gap-4 border-b border-[#e3ebe8] py-4 last:border-0">
    <div class="min-w-0">
      <p class="text-sm font-semibold text-[#102c37]">{{ etiqueta }}</p>
      <p v-if="descripcion" class="mt-1 text-xs text-slate-500">{{ descripcion }}</p>
    </div>
    <button type="button" role="switch" :aria-label="etiqueta" :aria-checked="modelValue" :disabled="bloqueado"
      @click="emit('update:modelValue', !modelValue)"
      class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00856a] disabled:cursor-not-allowed disabled:opacity-50"
      :class="modelValue ? 'bg-[#00856a]' : 'bg-slate-300'">
      <span class="h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" :class="modelValue ? 'translate-x-[24px]' : 'translate-x-[3px]'" />
    </button>
  </div>
</template>
