<script setup lang="ts">
import type { ParametroSistema } from '../tipos/configuracion'
import TarjetaBase from '../../../compartido/componentes/TarjetaBase.vue'
defineProps<{ titulo: string; descripcion: string; parametros: ParametroSistema[] }>()
</script>
<template>
  <TarjetaBase :titulo="titulo" :descripcion="descripcion">
    <div class="divide-y divide-[#e3ebe8]">
      <div v-for="p in parametros" :key="p.nombre" class="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
        <div class="max-w-xl"><p class="font-medium">{{ p.nombre }}</p><p class="mt-1 text-xs text-slate-500">{{ p.descripcion }}</p></div>
        <span class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{{ p.valor }}</span>
      </div>
    </div>
  </TarjetaBase>
</template>
