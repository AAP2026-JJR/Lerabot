<script setup lang="ts">
type Periodo = '7D' | '30D' | '90D' | '1A'
defineProps<{ modelValue: Periodo }>()
const emit = defineEmits<{ 'update:modelValue': [valor: Periodo] }>()
const periodos: Periodo[] = ['7D', '30D', '90D', '1A']
</script>
<template>
  <div class="inline-flex flex-wrap gap-1 rounded-xl border border-[#e3ebe8] bg-white p-1" role="group" aria-label="Seleccionar período">
    <button v-for="p in periodos" :key="p" type="button" :aria-pressed="modelValue === p" class="rounded-lg px-3 py-2 text-xs font-semibold transition-colors" :class="modelValue === p ? 'bg-[#e1f4ef] text-[#00856a]' : 'text-slate-500 hover:bg-slate-100'" @click="emit('update:modelValue', p)">{{ p }}</button>
  </div>
</template>