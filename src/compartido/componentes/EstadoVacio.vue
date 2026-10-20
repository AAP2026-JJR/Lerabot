<script setup lang="ts">
withDefaults(defineProps<{ titulo?: string; descripcion?: string }>(), { titulo: 'No hay datos disponibles', descripcion: 'Aquí aparecerá la información cuando esté disponible.' })
</script>
<template>
  <div class="flex flex-col items-center rounded-2xl border border-dashed border-[#d5e4df] bg-white px-6 py-12 text-center" role="status">
    <div class="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#e1f4ef] text-xl text-[#00856a]" aria-hidden="true">◇</div>
    <h3 class="font-semibold text-[#102c37]">{{ titulo }}</h3>
    <p class="mt-2 max-w-sm text-sm text-slate-500">{{ descripcion }}</p>
    <div v-if="$slots.accion" class="mt-5"><slot name="accion" /></div>
  </div>
</template>