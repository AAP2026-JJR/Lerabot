<script setup lang="ts">
withDefaults(defineProps<{ mensaje?: string }>(), { mensaje: 'Cargando información...' })
</script>
<template>
  <div class="flex items-center justify-center gap-3 rounded-2xl border border-[#e3ebe8] bg-white p-8 text-sm text-slate-500" role="status" aria-live="polite">
    <span class="h-5 w-5 animate-spin rounded-full border-2 border-[#cce7df] border-t-[#00856a]" aria-hidden="true" />
    <span>{{ mensaje }}</span>
  </div>
</template>