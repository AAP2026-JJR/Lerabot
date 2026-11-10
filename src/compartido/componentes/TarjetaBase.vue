<script setup lang="ts">
withDefaults(defineProps<{ titulo?: string; descripcion?: string }>(), { titulo: '', descripcion: '' })
</script>
<template>
  <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
    <header v-if="titulo || descripcion || $slots.acciones" class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h3 v-if="titulo" class="font-semibold text-[#102c37]">{{ titulo }}</h3><p v-if="descripcion" class="mt-1 text-xs text-slate-500">{{ descripcion }}</p></div>
      <slot name="acciones" />
    </header>
    <slot />
  </section>
</template>