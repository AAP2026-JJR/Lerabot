<script setup lang="ts">
import { ref } from 'vue'
import TarjetaBase from '../../compartido/componentes/TarjetaBase.vue'
import TarjetaMetrica from '../../compartido/componentes/TarjetaMetrica.vue'
import EstadoConexion from '../../compartido/componentes/EstadoConexion.vue'
import EstadoVacio from '../../compartido/componentes/EstadoVacio.vue'
const filtro = ref('Todos')
const exchanges = [
  { nombre: 'Binance', sigla: 'B', saldo: '$8,420.32', activos: 6, estado: 'conectado' as const, clase: 'bg-amber-400 text-black' },
  { nombre: 'BingX', sigla: 'X', saldo: '$5,231.17', activos: 4, estado: 'conectado' as const, clase: 'bg-blue-600 text-white' },
  { nombre: 'Bybit', sigla: 'Y', saldo: '$3,402.56', activos: 5, estado: 'sincronizando' as const, clase: 'bg-slate-900 text-white' },
  { nombre: 'OKX', sigla: 'O', saldo: '—', activos: 0, estado: 'desconectado' as const, clase: 'bg-slate-800 text-white' }
]
</script>
<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-2xl font-bold text-[#102c37]">Mis exchanges</h2><p class="mt-1 text-sm text-slate-500">Resumen de conexiones y saldos por plataforma.</p></div><span class="rounded-lg bg-[#e1f4ef] px-3 py-2 text-xs font-medium text-[#00856a]">Vista demostrativa · Sin conexiones reales</span></header>
    <div class="grid gap-4 md:grid-cols-3"><TarjetaMetrica titulo="Plataformas de ejemplo" valor="4" detalle="Incluye una desconectada" /><TarjetaMetrica titulo="Saldo mostrado (demo)" valor="$17,054.05" detalle="Valores ficticios" /><TarjetaMetrica titulo="Sincronización real" valor="No disponible" detalle="Se habilitará en la integración" /></div>
    <TarjetaBase titulo="Plataformas" descripcion="Los estados y balances son ilustrativos; aún no se han registrado API Keys.">
      <div class="mb-4 flex flex-wrap gap-2"><button v-for="opcion in ['Todos', 'Conectados', 'Sin conectar']" :key="opcion" class="rounded-lg px-3 py-2 text-sm" :class="filtro === opcion ? 'bg-[#e1f4ef] font-semibold text-[#00856a]' : 'border border-slate-200 text-slate-600'" @click="filtro = opcion">{{ opcion }}</button></div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in exchanges.filter(e => filtro === 'Todos' || (filtro === 'Conectados' ? e.estado !== 'desconectado' : e.estado === 'desconectado'))" :key="item.nombre" class="rounded-xl border border-[#e3ebe8] p-4">
          <div class="mb-4 flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl font-bold" :class="item.clase">{{ item.sigla }}</span><div><h3 class="font-semibold">{{ item.nombre }}</h3><EstadoConexion :estado="item.estado" /></div></div>
          <p class="text-xs text-slate-500">Saldo ilustrativo</p><p class="mt-1 text-xl font-bold tabular-nums">{{ item.saldo }}</p><p class="mt-2 text-xs text-slate-500">{{ item.activos }} activos · Demo</p>
        </article>
      </div>
    </TarjetaBase>
    <EstadoVacio titulo="Integraciones reales pendientes" descripcion="La conexión segura con Binance, BingX y otros exchanges se desarrollará en fases posteriores." />
  </div>
</template>
