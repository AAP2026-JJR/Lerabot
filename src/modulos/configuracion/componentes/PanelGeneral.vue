<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePreferenciasStore } from '../../../nucleo/estado/preferencias'
import TarjetaBase from '../../../compartido/componentes/TarjetaBase.vue'
const preferencias = usePreferenciasStore()
const { monedaBase } = storeToRefs(preferencias)
</script>
<template>
  <div class="grid gap-5 lg:grid-cols-2">
    <TarjetaBase titulo="Preferencias generales" descripcion="Preferencias locales de interfaz">
      <label for="moneda-base" class="mb-2 block text-sm font-medium">Moneda principal</label>
      <select id="moneda-base" v-model="monedaBase" class="w-full rounded-lg border border-[#e3ebe8] bg-white px-3 py-2 text-sm">
        <option value="USD">USD — Dolar estadounidense</option>
        <option value="PEN">PEN — Sol peruano</option>
      </select>
      <p class="mt-3 text-xs text-slate-500">Esta preferencia se guarda solo en memoria. No convierte importes ni se persiste en AWS.</p>
    </TarjetaBase>
    <TarjetaBase titulo="Apariencia" descripcion="Identidad visual de LERABOT">
      <div class="flex items-center gap-3"><span class="h-10 w-10 rounded-xl bg-[#00856a]" aria-hidden="true"/><div><p class="font-semibold">Propuesta 4 · Verde turquesa</p><p class="text-xs text-slate-500">Tema claro · Sin cambios de apariencia disponibles</p></div></div>
    </TarjetaBase>
  </div>
</template>
