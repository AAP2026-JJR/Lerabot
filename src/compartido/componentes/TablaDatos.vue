<script setup lang="ts" generic="T extends Record<string, unknown>">
interface Columna { clave: string; titulo: string; alinear?: 'inicio' | 'derecha' }
withDefaults(defineProps<{ columnas: Columna[]; filas: T[]; claveFila: keyof T; etiquetaVacia?: string }>(), { etiquetaVacia: 'No hay registros para mostrar' })
</script>
<template>
  <div class="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-[#e3ebe8] bg-white">
    <table class="w-full min-w-[600px] text-left text-sm">
      <thead class="bg-[#f6f9f8] text-xs text-slate-500"><tr><th v-for="columna in columnas" :key="columna.clave" scope="col" class="px-4 py-3 font-semibold" :class="columna.alinear === 'derecha' ? 'text-right' : ''">{{ columna.titulo }}</th></tr></thead>
      <tbody class="divide-y divide-slate-100"><tr v-for="fila in filas" :key="String(fila[claveFila])" class="hover:bg-slate-50"><td v-for="columna in columnas" :key="columna.clave" class="px-4 py-3 text-[#102c37]" :class="columna.alinear === 'derecha' ? 'text-right tabular-nums' : ''"><slot :name="`celda-${columna.clave}`" :fila="fila" :valor="fila[columna.clave]">{{ fila[columna.clave] ?? '—' }}</slot></td></tr><tr v-if="filas.length === 0"><td :colspan="columnas.length" class="px-4 py-10 text-center text-slate-500">{{ etiquetaVacia }}</td></tr></tbody>
    </table>
  </div>
</template>