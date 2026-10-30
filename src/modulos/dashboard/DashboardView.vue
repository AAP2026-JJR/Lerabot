<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listarOperaciones } from '../operaciones/servicio'
import type { OperacionSpot } from '../operaciones/tipos'
import { observarCotizaciones, cotizacionesVivas, cotizacionActual, estadoCotizaciones } from '../mercado/cotizacionesVivas'
import { sesionDemo } from '../login/sesionDemo'

const sesion = sesionDemo()
const esAdmin = sesion?.rol === 'ADMIN'
const pestaña = ref<'finanzas' | 'usuarios'>('finanzas')
const filas = ref<OperacionSpot[]>([])
const cargando = ref(false)
const error = ref('')
const ahora = ref(Date.now())
let temporizador: ReturnType<typeof setInterval> | undefined
let soltar: (() => void) | undefined
const usd = (n: number | null) => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const porcentaje = (n: number | null) => n === null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const idSuscriptor = (o: OperacionSpot) => /^SUB#([^#]+)/i.exec(o.PK)?.[1]?.toLowerCase() ?? ''
const seleccionadas = computed(() => esAdmin ? filas.value : filas.value.filter(o => idSuscriptor(o) === (sesion?.subscriberId ?? '').toLowerCase()))
const compras = computed(() => seleccionadas.value.filter(o => String(o.side).toUpperCase() === 'BUY'))
const precioVivo = (simbolo: string) => { void cotizacionesVivas.value; void ahora.value; return cotizacionActual(simbolo) }
const conPrecio = computed(() => compras.value.map(o => {
  const cantidad = Number(o.quantity), entrada = Number(o.buyPrice)
  const costo = Number.isFinite(cantidad) && cantidad > 0 && Number.isFinite(entrada) && entrada > 0 ? cantidad * entrada : null
  const valorPrecio = precioVivo(String(o.symbol ?? '').toUpperCase())
  const actual = costo !== null && valorPrecio ? cantidad * valorPrecio.precio : null
  const tp = [1,2,3].map(i => ({precio:Number(o[`tp${i}Price`]),cantidad:Number(o[`tp${i}Quantity`])})).filter(t=>Number.isFinite(t.precio)&&t.precio>0&&Number.isFinite(t.cantidad)&&t.cantidad>0)
  const totalCantidad = tp.reduce((s,t)=>s+t.cantidad,0)
  const potencial = costo !== null && tp.length && totalCantidad<=cantidad+1e-8 ? tp.reduce((s,t)=>s+(t.precio-entrada)*t.cantidad,0) : null
  return { o, costo, actual, pnl: actual !== null && costo !== null ? actual-costo : null, potencial, precio: valorPrecio?.precio ?? null, actualizado: valorPrecio?.actualizado ?? null }
}))
const capital = computed(() => conPrecio.value.reduce((s,x)=>s+(x.costo??0),0))
const valoracionCompleta = computed(() => conPrecio.value.length > 0 && conPrecio.value.every(x=>x.actual!==null))
const valorActual = computed(() => valoracionCompleta.value ? conPrecio.value.reduce((s,x)=>s+(x.actual??0),0) : null)
const pnl = computed(() => valorActual.value === null ? null : valorActual.value - capital.value)
const roi = computed(() => pnl.value===null || capital.value<=0 ? null : 100*pnl.value/capital.value)
const tpCompleto = computed(() => conPrecio.value.length>0 && conPrecio.value.every(x=>x.potencial!==null))
const potencial = computed(() => tpCompleto.value ? conPrecio.value.reduce((s,x)=>s+(x.potencial??0),0) : null)
const porActivo = computed(() => Object.entries(conPrecio.value.reduce<Record<string,number>>((m,x)=>{const s=String(x.o.symbol??'').toUpperCase();m[s]=(m[s]??0)+(x.costo??0);return m},{})).sort((a,b)=>b[1]-a[1]))
const porSuscriptor = computed(() => Object.entries(filas.value.reduce<Record<string,number>>((m,o)=>{const id=idSuscriptor(o);if(id)m[id]=(m[id]??0)+1;return m},{})).sort((a,b)=>b[1]-a[1]))
const maxCapital = computed(() => Math.max(...porActivo.value.map(x=>x[1]),1))
async function cargar() {
  cargando.value = true; error.value = ''
  try {
    const acumuladas: OperacionSpot[]=[]
    let cursor=''
    for(let n=0;n<20;n++) {
      const r=await listarOperaciones({limite:'100',...(cursor?{cursor}:{})})
      acumuladas.push(...(r.operaciones??[]))
      if(!r.siguienteCursor)break
      cursor=r.siguienteCursor
      if(n===19)error.value='Se alcanzó el límite de 2 000 registros; cifras parciales.'
    }
    filas.value=acumuladas
    soltar?.()
    const simbolos=[...new Set(compras.value.map(o=>String(o.symbol??'').toUpperCase()))]
    soltar=observarCotizaciones(simbolos)
  } catch(e) { error.value = e instanceof Error ? e.message : 'No se pudieron cargar las operaciones.' }
  finally { cargando.value=false }
}
onMounted(()=>{void cargar();temporizador=setInterval(()=>{ahora.value=Date.now()},5000)})
onUnmounted(()=>{soltar?.();if(temporizador)clearInterval(temporizador)})
</script>
<template>
  <div class="space-y-4 text-[#102c37] sm:space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div class="mb-1 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-emerald-700"><span class="h-2 w-2 rounded-full bg-emerald-500"/> LERABOT · Centro financiero</div><h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Tu panorama financiero</h2><p class="text-sm text-slate-500">Resultados estimados a partir de operaciones registradas y cotizaciones recientes.</p></div>
      <button class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#008b69] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006f56] disabled:opacity-50" :disabled="cargando" @click="cargar"><span aria-hidden="true">↻</span>{{cargando?'Actualizando…':'Actualizar operaciones'}}</button>
    </div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div v-if="esAdmin" class="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" role="tablist" aria-label="Secciones del dashboard"><button role="tab" :aria-selected="pestaña==='finanzas'" class="flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition sm:flex-none" :class="pestaña==='finanzas'?'bg-emerald-600 text-white shadow':'text-slate-600 hover:bg-slate-50'" @click="pestaña='finanzas'">◈ Finanzas</button><button role="tab" :aria-selected="pestaña==='usuarios'" class="flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition sm:flex-none" :class="pestaña==='usuarios'?'bg-violet-700 text-white shadow':'text-slate-600 hover:bg-slate-50'" @click="pestaña='usuarios'">♙ Usuarios</button></div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span class="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">{{estadoCotizaciones==='en-vivo'?'● Precios en vivo':'○ '+estadoCotizaciones}}</span><span class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">Binance Spot · referencia</span></div>
    </div>
    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{{error}}</div>
    <template v-if="pestaña==='finanzas' || !esAdmin">
      <p class="text-xs font-medium text-slate-500">{{esAdmin?'Vista global':'Mi portafolio'}} · {{compras.length}} compras registradas · {{valoracionCompleta?'Cotizaciones disponibles':'Esperando precios recientes'}}</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <article class="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"><div class="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-emerald-50"/><div class="relative"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Capital invertido</p><span class="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">▣</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums">{{usd(capital)}}</p><p class="mt-2 text-xs text-slate-500">Compras registradas · USD</p></div></article>
        <article class="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5"><div class="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-sky-50"/><div class="relative"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Valor de posiciones</p><span class="rounded-lg bg-sky-50 px-2 py-1 text-sky-700">◉</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums">{{usd(valorActual)}}</p><p class="mt-2 text-xs text-slate-500">Valuación estimada al precio actual</p></div></article>
        <article class="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5" :class="pnl===null?'border-slate-200':pnl<0?'border-rose-200':'border-emerald-200'"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">PnL no realizado</p><span class="rounded-lg px-2 py-1" :class="pnl===null?'bg-slate-50 text-slate-500':pnl<0?'bg-rose-50 text-rose-600':'bg-emerald-50 text-emerald-700'">{{pnl!==null&&pnl<0?'↘':'↗'}}</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums" :class="pnl===null?'text-slate-600':pnl<0?'text-rose-600':'text-emerald-600'">{{usd(pnl)}}</p><p class="mt-2 text-xs text-slate-500">Ganancia o pérdida estimada</p></article>
        <article class="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5" :class="roi===null?'border-slate-200':roi<0?'border-rose-200':'border-emerald-200'"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">ROI no realizado</p><span class="rounded-lg px-2 py-1" :class="roi===null?'bg-slate-50 text-slate-500':roi<0?'bg-rose-50 text-rose-600':'bg-emerald-50 text-emerald-700'">%</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums" :class="roi===null?'text-slate-600':roi<0?'text-rose-600':'text-emerald-600'">{{porcentaje(roi)}}</p><p class="mt-2 text-xs text-slate-500">Rentabilidad sobre capital de compra</p></article>
      </div>
      <div class="grid gap-3 xl:grid-cols-5">
        <section class="rounded-2xl border border-[#e3ebe8] bg-white p-4 shadow-sm sm:p-5 xl:col-span-3"><div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-bold">Distribución de inversión</h3><p class="mt-1 text-xs text-slate-500">Capital por moneda, según compras en DynamoDB</p></div><span class="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{{porActivo.length}} activos</span></div><div v-for="[nombre,importe] in porActivo" :key="nombre" class="mt-5"><div class="mb-2 flex items-center justify-between gap-2 text-sm"><span class="font-semibold text-slate-800">{{nombre}}</span><span class="font-semibold tabular-nums">{{usd(importe)}} <span class="ml-1 text-xs font-normal text-slate-400">{{capital? (100*importe/capital).toFixed(1):'0.0'}}%</span></span></div><div class="h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-500" :style="{width:(100*importe/maxCapital)+'%'}"/></div></div><p v-if="!porActivo.length" class="mt-8 text-sm text-slate-500">Todavía no hay compras registradas.</p></section>
        <section class="relative overflow-hidden rounded-2xl border border-[#c5e9dd] bg-gradient-to-br from-[#073a32] via-[#075747] to-[#008b69] p-5 text-white shadow-sm xl:col-span-2"><div class="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10"/><div class="relative"><div class="flex justify-between gap-2"><div><h3 class="font-bold">Objetivos Take Profit</h3><p class="mt-1 text-xs text-white/70">Proyección bruta si se ejecutan los TP</p></div><span class="rounded-lg bg-white/10 px-3 py-2 text-lg">◎</span></div><p class="mt-8 break-words text-3xl font-extrabold tabular-nums sm:text-4xl">{{usd(potencial)}}</p><p class="mt-3 text-xs leading-relaxed text-emerald-100">{{potencial===null?'Faltan objetivos TP válidos en algunas compras.':'Suma de ganancias potenciales de los objetivos registrados.'}}</p><div class="mt-5 border-t border-white/20 pt-3 text-xs text-white/75">Los TP colocados no son ganancias realizadas.</div></div></section>
      </div>
      <section class="overflow-hidden rounded-2xl border border-[#e3ebe8] bg-white shadow-sm"><div class="flex flex-wrap items-start justify-between gap-2 px-4 pb-3 pt-4 sm:px-5 sm:pt-5"><div><h3 class="font-bold">Rendimiento por operación</h3><p class="mt-1 text-xs text-slate-500">Cotización de referencia · precio de compra histórico</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{{conPrecio.length}} compras</span></div><div class="overflow-x-auto"><table class="w-full min-w-[690px] text-left text-sm"><thead class="bg-[#f4f8f7] text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th class="p-3 sm:pl-5">Activo</th><th class="p-3">Invertido</th><th class="p-3">Precio actual</th><th class="p-3">Valor actual</th><th class="p-3">PnL</th><th class="p-3">ROI</th></tr></thead><tbody><tr v-for="x in conPrecio" :key="x.o.PK+x.o.SK" class="border-t border-slate-100 hover:bg-slate-50/70"><td class="p-3 font-semibold text-emerald-800 sm:pl-5">{{x.o.symbol}}</td><td class="p-3 tabular-nums">{{usd(x.costo)}}</td><td class="p-3 tabular-nums">{{usd(x.precio)}}</td><td class="p-3 tabular-nums">{{usd(x.actual)}}</td><td class="p-3 font-semibold tabular-nums" :class="x.pnl===null?'text-slate-400':x.pnl<0?'text-rose-600':'text-emerald-600'">{{usd(x.pnl)}}</td><td class="p-3 font-semibold tabular-nums" :class="x.pnl===null?'text-slate-400':x.pnl<0?'text-rose-600':'text-emerald-600'">{{porcentaje(x.pnl!==null&&x.costo?100*x.pnl/x.costo:null)}}</td></tr><tr v-if="!conPrecio.length"><td colspan="6" class="p-5 text-slate-500">No hay operaciones para mostrar.</td></tr></tbody></table></div></section>
    </template>
    <template v-else-if="esAdmin">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2"><article class="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Suscriptores con operaciones</p><span class="rounded-lg bg-violet-50 px-2 py-1 text-violet-600">♙</span></div><p class="mt-3 text-3xl font-extrabold text-violet-700">{{porSuscriptor.length}}</p><p class="mt-2 text-xs text-slate-500">No incluye perfiles sin movimientos.</p></article><article class="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Operaciones registradas</p><span class="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-600">↗</span></div><p class="mt-3 text-3xl font-extrabold text-emerald-700">{{filas.length}}</p><p class="mt-2 text-xs text-slate-500">Total devuelto por la API de Operaciones.</p></article></div>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-4 shadow-sm sm:p-5"><h3 class="font-bold">Actividad por suscriptor</h3><p class="mt-1 text-xs text-slate-500">Distribución real de operaciones encontradas</p><div v-for="[id,total] in porSuscriptor" :key="id" class="mt-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><div class="min-w-0"><span class="block truncate text-sm font-semibold">{{id}}</span><div class="mt-2 h-2 w-36 max-w-full overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-violet-500" :style="{width:(100*total/Math.max(filas.length,1))+'%'}"/></div></div><span class="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">{{total}} operaciones</span></div><p v-if="!porSuscriptor.length" class="mt-5 text-sm text-slate-500">Sin movimientos registrados.</p></section>
    </template>
    <p class="pb-1 text-xs leading-relaxed text-slate-500">Valores estimados, no balances verificados. No incluyen comisiones ni confirman ejecución de TP. El filtrado visual no equivale a autorización de acceso.</p>
  </div>
</template>
