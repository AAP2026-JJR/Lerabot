<script setup lang="ts">
defineProps<{ titulo: string }>()
const emit = defineEmits<{ abrirMenu: [] }>()
</script>
<template>
  <header class="sticky top-0 z-20 flex h-[72px] min-w-0 items-center justify-between border-b border-[#e3ebe8] bg-white px-4 sm:px-8">
    <div class="flex items-center gap-3">
      <button type="button" aria-label="Abrir menú" class="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 lg:hidden" @click="emit('abrirMenu')">☰</button>
      <div><h1 class="truncate text-base font-bold text-[#102c37] sm:text-xl">{{ titulo }}</h1><p class="hidden text-xs text-slate-500 sm:block">Tu portafolio cripto, más inteligente</p></div>
    </div>
    <div class="flex items-center gap-3"><span class="hidden rounded-lg bg-[#e1f4ef] px-3 py-2 text-xs font-semibold text-[#00856a] sm:inline">Vista demostrativa</span><span class="grid h-9 w-9 place-items-center rounded-full bg-[#00856a] text-sm font-bold text-white" aria-label="Usuario de ejemplo">U</span></div>
  </header>
</template>