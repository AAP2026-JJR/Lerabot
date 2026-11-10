<script setup lang="ts">
import { computed } from 'vue'
type Tendencia = 'positiva' | 'negativa' | 'neutra'
const props = withDefaults(defineProps<{ titulo: string; valor: string; detalle?: string; tendencia?: Tendencia }>(), { detalle: '', tendencia: 'neutra' })
const estilo = computed(() => props.tendencia === 'positiva' ? 'text-[#16a34a]' : props.tendencia === 'negativa' ? 'text-[#dc2626]' : 'text-slate-500')
</script>
<template>
  <article class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
    <p class="text-sm text-slate-500">{{ titulo }}</p>
    <p class="mt-3 text-2xl font-bold tabular-nums text-[#102c37]">{{ valor }}</p>
    <p v-if="detalle" class="mt-2 text-xs" :class="estilo">{{ detalle }}</p>
  </article>
</template>