<script setup lang="ts">
type Estado = 'conectado' | 'desconectado' | 'sincronizando' | 'error'
withDefaults(defineProps<{ estado: Estado }>(), { estado: 'desconectado' })
const etiquetas: Record<Estado, string> = { conectado: 'Conectado', desconectado: 'Desconectado', sincronizando: 'Sincronizando', error: 'Error de conexión' }
const clases: Record<Estado, string> = { conectado: 'bg-emerald-50 text-emerald-700', desconectado: 'bg-slate-100 text-slate-600', sincronizando: 'bg-blue-50 text-blue-700', error: 'bg-red-50 text-red-700' }
</script>
<template>
  <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" :class="clases[estado]">
    <span class="h-1.5 w-1.5 rounded-full bg-current" :class="estado === 'sincronizando' ? 'animate-pulse' : ''" />{{ etiquetas[estado] }}
  </span>
</template>