<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePreferenciasStore } from '../../nucleo/estado/preferencias'
import TarjetaBase from '../../compartido/componentes/TarjetaBase.vue'
import EstadoVacio from '../../compartido/componentes/EstadoVacio.vue'
const preferencias = usePreferenciasStore()
const { monedaBase } = storeToRefs(preferencias)
</script>
<template><div class="space-y-6"><header><h2 class="text-2xl font-bold">Configuración</h2><p class="mt-1 text-sm text-slate-500">Preferencias locales de la interfaz; sin guardar datos en AWS.</p></header>
  <div class="grid gap-5 lg:grid-cols-2"><TarjetaBase titulo="Preferencias generales" descripcion="Moneda de referencia de la interfaz"><label for="moneda-base" class="mb-2 block text-sm font-medium">Moneda principal</label><select id="moneda-base" v-model="monedaBase" class="w-full rounded-lg border border-[#e3ebe8] bg-white px-3 py-2 text-sm"><option value="USD">USD — Dólar estadounidense</option><option value="PEN">PEN — Sol peruano</option></select><p class="mt-3 text-xs text-slate-500">Esta preferencia se guarda solo en memoria; aún no convierte importes ni persiste tras recargar.</p></TarjetaBase><TarjetaBase titulo="Apariencia" descripcion="Identidad visual de LERABOT"><div class="flex items-center gap-3"><span class="h-9 w-9 rounded-lg bg-[#00856a]"/><div><p class="font-semibold">Propuesta 4 · Verde turquesa</p><p class="text-xs text-slate-500">Tema claro actualmente seleccionado</p></div></div></TarjetaBase></div>
  <EstadoVacio titulo="Seguridad y conexiones próximas" descripcion="La administración de claves privadas y el perfil autenticado se implementarán con AWS Cognito y Secrets Manager en fases posteriores." /></div></template>
