<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { consultarMercado } from './servicio'
import type { PrecioMoneda } from './tipos'
import { observarCotizaciones, cotizacionesVivas, cotizacionActual, estadoCotizaciones } from './cotizacionesVivas'

const lista = ref<PrecioMoneda[]>([])
const buscar = ref('')
const pagina = ref(1)
const cargando = ref(false)
const error = ref('')
const actualizado = ref('')
const desactualizado = ref(false)
const fuente = ref('')
const ultimaConsulta = ref('')
let intervalo: ReturnType<typeof setInterval> | undefined
let alive = true
let dejarPrecios: (() => void) | undefined
const precioVivo = (moneda: PrecioMoneda) => { void cotizacionesVivas.value; return cotizacionActual(moneda.simbolo.toUpperCase() + "USDT") }
const formatoUsd = (valor: number | null) => valor === null ? '—' :
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: valor < 1 ? 8 : 2 }).format(valor)
const resultado = computed(() => lista.value.filter(m => `${m.nombre} ${m.simbolo}`.toLowerCase().includes(buscar.value.trim().toLowerCase())))
async function actualizar() {
  if (cargando.value) return
  cargando.value = true
  error.value = ''
  try {
    const datos = await consultarMercado(pagina.value, 50)
    if (!alive) return
    lista.value = datos.monedas
    dejarPrecios?.()
    dejarPrecios = observarCotizaciones(datos.monedas.map(m => m.simbolo.toUpperCase() + "USDT"))
    actualizado.value = datos.actualizadoEn
    desactualizado.value = datos.desactualizado
    fuente.value = datos.fuente
    ultimaConsulta.value = new Date().toISOString()
  } catch (e) {
    if (alive) error.value = e instanceof Error ? e.message : 'No fue posible consultar el mercado'
  } finally { if (alive) cargando.value = false }
}
function navegar(delta: number) {
  pagina.value = Math.max(1, Math.min(10, pagina.value + delta))
  buscar.value = ''
  void actualizar()
}
onMounted(() => {
  alive = true
  void actualizar()
  intervalo = setInterval(() => { if (!document.hidden) void actualizar() }, 300_000)
  document.addEventListener('visibilitychange', alVolverAVista)
})
function alVolverAVista() { if (!document.hidden) void actualizar() }
onUnmounted(() => {
  alive = false
  dejarPrecios?.()
  if (intervalo) clearInterval(intervalo)
  document.removeEventListener('visibilitychange', alVolverAVista)
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold text-[#102c37]">Mercado de criptomonedas</h2>
        <p class="mt-1 text-sm text-slate-500">Cotizaciones públicas en USD, independientes de tus cuentas conectadas.</p>
      </div>
      <button class="rounded-lg bg-[#00856a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="cargando" @click="actualizar">{{ cargando ? 'Actualizando…' : 'Actualizar ahora' }}</button>
    </header>
    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span>Fuente: {{ fuente || 'pendiente de conexión' }}</span>
      <span>· Precio: Binance Spot en vivo cuando esté disponible · Ranking: CoinGecko cada 5 min</span>
      <span>· WebSocket: {{ estadoCotizaciones }}</span>
      <span v-if="actualizado">· Datos: {{ new Date(actualizado).toLocaleString('es-PE') }}</span>
      <span v-if="ultimaConsulta">· Consultado: {{ new Date(ultimaConsulta).toLocaleTimeString('es-PE') }}</span>
      <span v-if="desactualizado" class="font-semibold text-amber-700">· Últimos datos disponibles (no actuales)</span>
    </div>
    <div v-if="error" role="alert" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{{ error }}. No se muestran precios ficticios.</div>
    <section class="rounded-2xl border border-[#e3ebe8] bg-white p-4 shadow-sm sm:p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label class="w-full max-w-sm text-sm text-slate-600">Buscar entre los resultados cargados
          <input v-model="buscar" type="search" placeholder="Bitcoin, ETH, SOL…" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#00856a]" />
        </label>
        <span class="text-xs text-slate-500">Página {{ pagina }} · 50 monedas por página</span>
      </div>
      <div class="max-w-full overflow-x-auto rounded-xl border border-[#e3ebe8]">
        <table class="w-full min-w-[650px] text-left text-sm">
          <thead class="bg-[#f6f9f8] text-slate-500"><tr><th class="p-3">#</th><th class="p-3">Moneda</th><th class="p-3 text-right">Precio USD</th><th class="p-3 text-right">24 h</th><th class="p-3 text-right">Capitalización</th></tr></thead>
          <tbody><tr v-for="moneda in resultado" :key="moneda.id" class="border-t border-slate-100">
            <td class="p-3 text-slate-500">{{ moneda.posicion ?? '—' }}</td>
            <td class="p-3"><strong>{{ moneda.nombre }}</strong><span class="ml-2 text-xs text-slate-500">{{ moneda.simbolo }}</span></td>
            <td class="p-3 text-right tabular-nums">{{ formatoUsd(precioVivo(moneda)?.precio ?? moneda.precioUsd) }}</td>
            <td class="p-3 text-right tabular-nums" :class="(precioVivo(moneda)?.cambio24h ?? moneda.cambio24h) === null ? 'text-slate-500' : (precioVivo(moneda)?.cambio24h ?? moneda.cambio24h)! >= 0 ? 'text-green-600' : 'text-red-600'">{{ (precioVivo(moneda)?.cambio24h ?? moneda.cambio24h) === null ? '—' : `${((precioVivo(moneda)?.cambio24h ?? moneda.cambio24h) as number).toFixed(2)}%` }}</td>
            <td class="p-3 text-right tabular-nums">{{ formatoUsd(moneda.capitalizacionUsd) }}</td>
          </tr></tbody>
        </table>
        <p v-if="!cargando && resultado.length === 0" class="p-6 text-center text-sm text-slate-500">{{ error ? 'Sin precios disponibles' : 'Sin resultados en esta página' }}</p>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button :disabled="pagina === 1 || cargando" class="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" @click="navegar(-1)">Anterior</button>
        <button :disabled="pagina === 10 || cargando || lista.length < 50" class="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" @click="navegar(1)">Siguiente</button>
      </div>
    </section>
    <p class="text-xs text-slate-500">Referencia de mercado, no ejecución ni recomendación de inversión. Precio agregado sujeto a actualización y disponibilidad del proveedor.</p>
  </div>
</template>