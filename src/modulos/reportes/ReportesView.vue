<script setup lang="ts">
import { ref } from 'vue'
import TarjetaMetrica from '../../compartido/componentes/TarjetaMetrica.vue'
import TarjetaBase from '../../compartido/componentes/TarjetaBase.vue'
import SelectorPeriodo from '../../compartido/componentes/SelectorPeriodo.vue'
const periodo = ref<'7D' | '30D' | '90D' | '1A'>('30D')
const activos = [{nombre:'BTC',valor:38},{nombre:'ETH',valor:26},{nombre:'SOL',valor:19},{nombre:'USDT',valor:17}]
</script>
<template><div class="space-y-6"><header class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-2xl font-bold">Reportes</h2><p class="mt-1 text-sm text-slate-500">Analítica y comparativas demostrativas.</p></div><SelectorPeriodo v-model="periodo" /></header>
  <div class="grid gap-4 md:grid-cols-3"><TarjetaMetrica titulo="Rendimiento (demo)" valor="+12.4%" tendencia="positiva" :detalle="`Período elegido: ${periodo}`" /><TarjetaMetrica titulo="P&L estimado (demo)" valor="+$2,063.18" detalle="Ficticio" /><TarjetaMetrica titulo="Exchanges en simulación" valor="3" /></div>
  <div class="grid gap-5 lg:grid-cols-2"><TarjetaBase titulo="Evolución ilustrativa" descripcion="No representa rendimiento real; cambia el filtro de período."><svg class="h-52 w-full" viewBox="0 0 500 180" preserveAspectRatio="none" role="img" aria-label="Curva de rentabilidad ficticia"><path d="M0 150 H500 M0 90 H500 M0 30 H500" stroke="#e3ebe8" stroke-dasharray="4 5"/><path d="M0 146 L50 132 L100 140 L150 102 L200 111 L250 82 L300 91 L350 57 L400 67 L450 30 L500 20" stroke="#00856a" stroke-width="3" fill="none" stroke-linecap="round"/></svg></TarjetaBase><TarjetaBase titulo="Distribución ilustrativa" descripcion="Porcentaje de ejemplo por activo"><div v-for="activo in activos" :key="activo.nombre" class="mb-5"><div class="mb-1 flex justify-between text-sm"><span>{{activo.nombre}}</span><span>{{activo.valor}}%</span></div><div class="h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-[#00856a]" :style="{width:activo.valor+'%'}" /></div></div></TarjetaBase></div>
  <p class="text-xs text-slate-500">Exportaciones, análisis por exchange y P&L histórico estarán disponibles al integrar fuentes reales y snapshots.</p></div></template>
