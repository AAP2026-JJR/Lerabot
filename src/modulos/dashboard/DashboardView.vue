<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
// F16: todos los indicadores comparten exactamente el mismo subconjunto de operaciones.
const filtroExchange = ref('TODOS')
const filtroSuscriptor = ref('TODOS')
const railRef=ref<HTMLElement|null>(null)
const railShift=(direction:number)=>railRef.value?.scrollBy({left:direction*310,behavior:'smooth'})
const colorExchange=(name:string)=>name==='bingx'?'from-emerald-500 to-teal-600':name==='tangem'?'from-violet-500 to-indigo-600':'from-sky-500 to-cyan-600'
const colorMoneda=(name:string)=>name.startsWith('BTC')?'bg-amber-100 text-amber-800':name.startsWith('ETH')?'bg-indigo-100 text-indigo-700':name.startsWith('SOL')?'bg-violet-100 text-violet-700':name.startsWith('XRP')?'bg-sky-100 text-sky-800':name.startsWith('BNB')?'bg-yellow-100 text-yellow-800':'bg-emerald-100 text-emerald-800'

const nombreExchange = (o: OperacionSpot) => String(o.exchangeId ?? '').trim().toLowerCase() || 'sin exchange'
const universo = computed(() => esAdmin ? filas.value : filas.value.filter(o => idSuscriptor(o) === (sesion?.subscriberId ?? '').toLowerCase()))
const exchangesDisponibles = computed(() => [...new Set(universo.value.map(nombreExchange))].sort())
const suscriptoresDisponibles = computed(() => [...new Set(universo.value.map(idSuscriptor).filter(Boolean))].sort())
const tarjetasExchange=computed(()=>exchangesDisponibles.value.map(nombre=>{
 const todos=universo.value.filter(o=>nombreExchange(o)===nombre && (!esAdmin || filtroSuscriptor.value==='TODOS' || idSuscriptor(o)===filtroSuscriptor.value))
 const buys=todos.filter(o=>String(o.side||'').toUpperCase()==='BUY')
 const importe=buys.reduce((s,o)=>{const qty=Number(o.quantity),price=Number(o.buyPrice);return s+(Number.isFinite(qty)&&qty>0&&Number.isFinite(price)&&price>0?qty*price:0)},0)
 return {nombre,registros:todos.length,compras:buys.length,importe}
}).filter(x=>x.registros>0))
const totalesTarjetas=computed(()=>({registros:tarjetasExchange.value.reduce((s,x)=>s+x.registros,0),compras:tarjetasExchange.value.reduce((s,x)=>s+x.compras,0),importe:tarjetasExchange.value.reduce((s,x)=>s+x.importe,0)}))

const seleccionadas = computed(() => universo.value.filter(o =>
  (filtroExchange.value === 'TODOS' || nombreExchange(o) === filtroExchange.value) &&
  (!esAdmin || filtroSuscriptor.value === 'TODOS' || idSuscriptor(o) === filtroSuscriptor.value)
))
function limpiarFiltros() { filtroExchange.value = 'TODOS'; filtroSuscriptor.value = 'TODOS' }
watch(filtroSuscriptor,()=>{if(filtroExchange.value!=='TODOS'&&!tarjetasExchange.value.some(x=>x.nombre===filtroExchange.value))filtroExchange.value='TODOS'})


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
const cantidadExchanges=computed(()=>porExchange.value.length)
const cantidadActivos=computed(()=>porActivo.value.length)

// Estadísticas derivadas de COMPRAS observadas; no son balances reales de exchanges.
const porExchange = computed(() => {
  const grupos = new Map<string, { invertido:number; valor:number; completos:boolean; operaciones:number }>()
  for(const x of conPrecio.value){
    const k=nombreExchange(x.o)
    const g=grupos.get(k)??{invertido:0,valor:0,completos:true,operaciones:0}
    g.invertido += x.costo??0; g.operaciones++
    if(x.actual===null)g.completos=false
    else g.valor+=x.actual
    grupos.set(k,g)
  }
  return [...grupos].map(([nombre,g])=>({nombre,...g,pnl:g.completos?g.valor-g.invertido:null})).sort((a,b)=>b.invertido-a.invertido)
})
const pnlPorActivo = computed(() => {
  const map=new Map<string,{pnl:number;completo:boolean;invertido:number}>()
  for(const x of conPrecio.value){
    const nombre=String(x.o.symbol??'—').toUpperCase()
    const g=map.get(nombre)??{pnl:0,completo:true,invertido:0}
    if(x.pnl===null)g.completo=false
    else g.pnl+=x.pnl
    g.invertido+=x.costo??0
    map.set(nombre,g)
  }
  return [...map].map(([nombre,g])=>({nombre,pnl:g.completo?g.pnl:null, invertido:g.invertido})).sort((a,b)=>Math.abs(b.pnl??0)-Math.abs(a.pnl??0))
})
const maxPnlActivo = computed(()=>Math.max(1,...pnlPorActivo.value.map(x=>Math.abs(x.pnl??0))))
// Curva de aportes acumulados: NO representa rendimiento ni crecimiento de valor del portafolio.
const aportesDiarios = computed(() => {
  const porDia=new Map<string,number>()
  for(const x of conPrecio.value){
    if(x.costo===null)continue
    const raw=String(x.o.createdAt??'')
    const d=new Date(raw)
    if(!Number.isFinite(d.getTime()))continue
    const dia=d.toISOString().slice(0,10)
    porDia.set(dia,(porDia.get(dia)??0)+x.costo)
  }
  let acumulado=0
  return [...porDia].sort(([a],[b])=>a.localeCompare(b)).map(([dia,importe])=>({dia,importe,acumulado:acumulado+=importe}))
})
const curvaAportes = computed(() => {
  const data=aportesDiarios.value
  if(!data.length)return ''
  const max=Math.max(1,...data.map(x=>x.acumulado))
  return data.map((x,i)=>`${(data.length===1?300:24+552*i/(data.length-1)).toFixed(1)},${(175-135*x.acumulado/max).toFixed(1)}`).join(' ')
})

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
    const simbolos=[...new Set(universo.value.filter(o=>String(o.side).toUpperCase()==='BUY').map(o=>String(o.symbol??'').toUpperCase()))]
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
      <div><div class="mb-1 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-emerald-700"><span class="h-2 w-2 rounded-full bg-emerald-500"/> LedaBot · Centro financiero</div><h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Tu panorama financiero</h2><p class="text-sm text-slate-500">Resultados estimados a partir de operaciones registradas y cotizaciones recientes.</p></div>
      <button class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#008b69] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006f56] disabled:opacity-50" :disabled="cargando" @click="cargar"><span aria-hidden="true">↻</span>{{cargando?'Actualizando…':'Actualizar operaciones'}}</button>
    </div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div v-if="esAdmin" class="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" role="tablist" aria-label="Secciones del dashboard"><button role="tab" :aria-selected="pestaña==='finanzas'" class="flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition sm:flex-none" :class="pestaña==='finanzas'?'bg-emerald-600 text-white shadow':'text-slate-600 hover:bg-slate-50'" @click="pestaña='finanzas'">◈ Finanzas</button><button role="tab" :aria-selected="pestaña==='usuarios'" class="flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition sm:flex-none" :class="pestaña==='usuarios'?'bg-violet-700 text-white shadow':'text-slate-600 hover:bg-slate-50'" @click="pestaña='usuarios'">♙ Usuarios</button></div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span class="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">{{estadoCotizaciones==='en-vivo'?'● Precios en vivo':'○ '+estadoCotizaciones}}</span><span class="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">Binance Spot · referencia</span></div>
    </div>
    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{{error}}</div>
    <!-- F16: Filtro global por exchange y, para ADMIN, suscriptor. Afecta TODOS los KPI y gráficos. -->
    <section v-if="pestaña==='finanzas' || !esAdmin" class="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5" aria-label="Filtros globales del dashboard">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-bold">Explora tu portafolio</h3><p class="text-xs text-slate-500">Selecciona una plataforma. Todos los indicadores, gráficos y operaciones se actualizan juntos.</p></div><button class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" @click="limpiarFiltros">Limpiar filtros</button></div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label v-if="esAdmin" class="block text-xs font-semibold text-slate-600">Suscriptor
          <select v-model="filtroSuscriptor" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="TODOS">Todos los suscriptores</option><option v-for="id in suscriptoresDisponibles" :key="id" :value="id">{{id}}</option></select>
        </label>
        <div class="flex items-end"><div class="w-full rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">{{seleccionadas.length}} registros · {{compras.length}} compras seleccionadas</div></div>
      </div>
      <p v-if="!seleccionadas.length" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No hay operaciones para la selección actual. Los importes se recalculan sin inventar saldos.</p>
    </section>
    <section v-if="pestaña==='finanzas' || !esAdmin" aria-label="Seleccionar exchange" class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div class="mb-3 flex items-center justify-between gap-3"><div><h3 class="font-bold">Cuentas y plataformas</h3><p class="text-xs text-slate-500">Compras registradas por exchange; no son saldos disponibles</p></div><div class="flex gap-1"><button type="button" aria-label="Desplazar tarjetas a la izquierda" class="rounded-lg border px-2.5 py-2 text-slate-600 hover:bg-slate-50" @click="railShift(-1)">‹</button><button type="button" aria-label="Desplazar tarjetas a la derecha" class="rounded-lg border px-2.5 py-2 text-slate-600 hover:bg-slate-50" @click="railShift(1)">›</button></div></div>
      <div ref="railRef" class="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin]">
        <button type="button" :aria-pressed="filtroExchange==='TODOS'" class="min-w-[230px] max-w-[280px] flex-1 shrink-0 snap-start rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md" :class="filtroExchange==='TODOS'?'border-emerald-500 bg-emerald-50 shadow-sm':'border-slate-200 bg-white'" @click="filtroExchange='TODOS'">
          <div class="flex items-center gap-2"><span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-xl text-emerald-700">▦</span><span class="font-bold">Todas las plataformas</span></div><p class="mt-3 text-xs text-slate-500">{{totalesTarjetas.registros}} registros · {{totalesTarjetas.compras}} compras</p><p class="mt-1 text-xl font-extrabold tabular-nums">{{usd(totalesTarjetas.importe)}}</p><span class="mt-2 block text-[11px] text-slate-500">Capital registrado</span>
        </button>
        <button v-for="x in tarjetasExchange" :key="x.nombre" type="button" :aria-pressed="filtroExchange===x.nombre" class="min-w-[230px] max-w-[280px] flex-1 shrink-0 snap-start rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md" :class="filtroExchange===x.nombre?'border-emerald-500 bg-emerald-50 shadow-sm':'border-slate-200 bg-white'" @click="filtroExchange=x.nombre">
          <div class="flex items-center gap-2"><span class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br font-extrabold uppercase text-white" :class="colorExchange(x.nombre)">{{x.nombre.slice(0,2)}}</span><span class="font-bold capitalize">{{x.nombre}}</span></div><p class="mt-3 text-xs text-slate-500">{{x.registros}} registros · {{x.compras}} compras</p><p class="mt-1 text-xl font-extrabold tabular-nums">{{usd(x.importe)}}</p><span class="mt-2 block text-[11px] text-slate-500">Capital registrado</span>
        </button>
      </div>
    </section>
    <template v-if="pestaña==='finanzas' || !esAdmin">
      <p class="text-xs font-medium text-slate-500">{{esAdmin?'Vista administrativa filtrada':'Mi portafolio filtrado'}} · {{compras.length}} compras registradas · {{valoracionCompleta?'Cotizaciones disponibles':'Esperando precios recientes'}}</p>
      <div class="flex flex-wrap items-center gap-2 text-xs"><span class="rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700">◈ {{cantidadExchanges}} exchange(s) seleccionados</span><span class="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">◉ {{cantidadActivos}} activos</span><span class="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">▦ {{compras.length}} compras</span></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <article class="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"><div class="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-emerald-50"/><div class="relative"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Capital invertido</p><span class="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">▣</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums">{{usd(capital)}}</p><p class="mt-2 text-xs text-slate-500">Compras registradas · USD</p></div></article>
        <article class="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5"><div class="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-sky-50"/><div class="relative"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Valor de posiciones</p><span class="rounded-lg bg-sky-50 px-2 py-1 text-sky-700">◉</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums">{{usd(valorActual)}}</p><p class="mt-2 text-xs text-slate-500">Valuación estimada al precio actual</p></div></article>
        <article class="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5" :class="pnl===null?'border-slate-200':pnl<0?'border-rose-200':'border-emerald-200'"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">PnL no realizado</p><span class="rounded-lg px-2 py-1" :class="pnl===null?'bg-slate-50 text-slate-500':pnl<0?'bg-rose-50 text-rose-600':'bg-emerald-50 text-emerald-700'">{{pnl!==null&&pnl<0?'↘':'↗'}}</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums" :class="pnl===null?'text-slate-600':pnl<0?'text-rose-600':'text-emerald-600'">{{usd(pnl)}}</p><p class="mt-2 text-xs text-slate-500">Ganancia o pérdida estimada</p></article>
        <article class="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5" :class="roi===null?'border-slate-200':roi<0?'border-rose-200':'border-emerald-200'"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">ROI no realizado</p><span class="rounded-lg px-2 py-1" :class="roi===null?'bg-slate-50 text-slate-500':roi<0?'bg-rose-50 text-rose-600':'bg-emerald-50 text-emerald-700'">%</span></div><p class="mt-3 break-words text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold tracking-tight tabular-nums" :class="roi===null?'text-slate-600':roi<0?'text-rose-600':'text-emerald-600'">{{porcentaje(roi)}}</p><p class="mt-2 text-xs text-slate-500">Rentabilidad sobre capital de compra</p></article>
      </div>
      <div class="grid gap-3 xl:grid-cols-5">
        <section class="rounded-2xl border border-[#e3ebe8] bg-white p-4 shadow-sm sm:p-5 xl:col-span-3"><div class="flex flex-wrap items-start justify-between gap-2"><div><h3 class="font-bold">Distribución de inversión</h3><p class="mt-1 text-xs text-slate-500">Capital por moneda, según compras en DynamoDB</p></div><span class="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{{porActivo.length}} activos</span></div><div v-for="[nombre,importe] in porActivo" :key="nombre" class="mt-5"><div class="mb-2 flex items-center justify-between gap-2 text-sm"><span class="inline-flex rounded-lg px-2 py-1 text-xs font-bold" :class="colorMoneda(nombre)">{{nombre}}</span><span class="font-semibold tabular-nums">{{usd(importe)}} <span class="ml-1 text-xs font-normal text-slate-400">{{capital? (100*importe/capital).toFixed(1):'0.0'}}%</span></span></div><div class="h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-500" :style="{width:(100*importe/maxCapital)+'%'}"/></div></div><p v-if="!porActivo.length" class="mt-8 text-sm text-slate-500">Todavía no hay compras registradas.</p></section>
        <section class="relative overflow-hidden rounded-2xl border border-[#c5e9dd] bg-gradient-to-br from-[#073a32] via-[#075747] to-[#008b69] p-5 text-white shadow-sm xl:col-span-2"><div class="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10"/><div class="relative"><div class="flex justify-between gap-2"><div><h3 class="font-bold">Objetivos Take Profit</h3><p class="mt-1 text-xs text-white/70">Proyección bruta si se ejecutan los TP</p></div><span class="rounded-lg bg-white/10 px-3 py-2 text-lg">◎</span></div><p class="mt-8 break-words text-3xl font-extrabold tabular-nums sm:text-4xl">{{usd(potencial)}}</p><p class="mt-3 text-xs leading-relaxed text-emerald-100">{{potencial===null?'Faltan objetivos TP válidos en algunas compras.':'Suma de ganancias potenciales de los objetivos registrados.'}}</p><div class="mt-5 border-t border-white/20 pt-3 text-xs text-white/75">Los TP colocados no son ganancias realizadas.</div></div></section>
      </div>
      <!-- Gráficos F16: todos calculados de la selección global y sin datos de demostración. -->
      <div class="grid gap-3 xl:grid-cols-2">
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 class="font-bold">Inversión por exchange</h3>
          <p class="mt-1 text-xs text-slate-500">Distribución de compras registradas. No son saldos disponibles.</p>
          <div v-for="x in porExchange" :key="x.nombre" class="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div class="mb-1 flex flex-wrap justify-between gap-2 text-sm"><span class="font-semibold capitalize">{{x.nombre}} · {{x.operaciones}} compras</span><span class="tabular-nums">{{usd(x.invertido)}} · {{capital>0?(100*x.invertido/capital).toFixed(1):'0.0'}}%</span></div>
            <div class="h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-gradient-to-r from-sky-600 to-emerald-400" :style="{width:(capital>0?100*x.invertido/capital:0)+'%'}"/></div>
            <p class="mt-1 text-xs" :class="x.pnl===null?'text-slate-500':x.pnl<0?'text-rose-600':'text-emerald-700'">PnL estimado: {{usd(x.pnl)}}</p>
          </div>
          <p v-if="!porExchange.length" class="mt-4 text-sm text-slate-500">Sin compras para representar.</p>
        </section>
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 class="font-bold">Contribución al PnL por activo</h3>
          <p class="mt-1 text-xs text-slate-500">Resultado no realizado estimado con las cotizaciones disponibles.</p>
          <div v-for="x in pnlPorActivo" :key="x.nombre" class="mt-4">
            <div class="mb-1 flex items-center justify-between gap-2 text-sm"><span class="font-semibold">{{x.nombre}}</span><span class="font-semibold tabular-nums" :class="x.pnl===null?'text-slate-500':x.pnl<0?'text-rose-600':'text-emerald-700'">{{usd(x.pnl)}}</span></div>
            <div class="h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full" :class="x.pnl===null?'bg-slate-300':x.pnl<0?'bg-rose-400':'bg-emerald-500'" :style="{width:(x.pnl===null?0:100*Math.abs(x.pnl)/maxPnlActivo)+'%'}"/></div>
          </div>
          <p v-if="!pnlPorActivo.length" class="mt-4 text-sm text-slate-500">Sin operaciones valorables.</p>
        </section>
      </div>
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-bold">Evolución de aportes registrados</h3><p class="mt-1 text-xs text-slate-500">Capital acumulado por fecha de compra. No representa crecimiento de valor ni rentabilidad histórica.</p></div><span class="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{{usd(aportesDiarios.length?aportesDiarios[aportesDiarios.length-1]?.acumulado??0:0)}}</span></div>
        <div v-if="aportesDiarios.length > 1" class="mt-4">
          <svg viewBox="0 0 600 195" preserveAspectRatio="none" role="img" aria-label="Curva de capital acumulado según fechas de compras registradas" class="h-44 w-full overflow-visible">
            <line x1="24" y1="175" x2="580" y2="175" stroke="#cbd5e1" stroke-width="1.5"/>
            <line x1="24" y1="40" x2="580" y2="40" stroke="#e2e8f0" stroke-dasharray="4 5"/>
            <polyline :points="curvaAportes" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          </svg>
          <div class="flex justify-between gap-2 text-xs text-slate-500"><span>{{aportesDiarios[0]?.dia}}</span><span>{{aportesDiarios[aportesDiarios.length-1]?.dia}}</span></div>
        </div>
        <p v-else-if="aportesDiarios.length===1" class="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Todas las compras registradas corresponden al {{aportesDiarios[0]?.dia}}. Se necesita más de una fecha para mostrar una evolución temporal sin inventar crecimiento.</p><p v-else class="mt-4 text-sm text-slate-500">No hay compras con fecha válida para elaborar la curva.</p>
      </section>
      <section class="overflow-hidden rounded-2xl border border-[#e3ebe8] bg-white shadow-sm"><div class="flex flex-wrap items-start justify-between gap-2 px-4 pb-3 pt-4 sm:px-5 sm:pt-5"><div><h3 class="font-bold">Rendimiento por operación</h3><p class="mt-1 text-xs text-slate-500">Cotización de referencia · precio de compra histórico</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{{conPrecio.length}} compras</span></div><div class="overflow-x-auto"><table class="w-full min-w-[690px] text-left text-sm"><thead class="bg-[#f4f8f7] text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th class="p-3 sm:pl-5">Activo</th><th class="p-3">Invertido</th><th class="p-3">Precio actual</th><th class="p-3">Valor actual</th><th class="p-3">PnL</th><th class="p-3">ROI</th></tr></thead><tbody><tr v-for="x in conPrecio" :key="x.o.PK+x.o.SK" class="border-t border-slate-100 hover:bg-slate-50/70"><td class="p-3 font-semibold sm:pl-5"><span class="rounded-lg px-2 py-1 text-xs" :class="colorMoneda(String(x.o.symbol??'').toUpperCase())">{{x.o.symbol}}</span></td><td class="p-3 tabular-nums">{{usd(x.costo)}}</td><td class="p-3 tabular-nums">{{usd(x.precio)}}</td><td class="p-3 tabular-nums">{{usd(x.actual)}}</td><td class="p-3 font-semibold tabular-nums" :class="x.pnl===null?'text-slate-400':x.pnl<0?'text-rose-600':'text-emerald-600'">{{usd(x.pnl)}}</td><td class="p-3 font-semibold tabular-nums" :class="x.pnl===null?'text-slate-400':x.pnl<0?'text-rose-600':'text-emerald-600'">{{porcentaje(x.pnl!==null&&x.costo?100*x.pnl/x.costo:null)}}</td></tr><tr v-if="!conPrecio.length"><td colspan="6" class="p-5 text-slate-500">No hay operaciones para mostrar.</td></tr></tbody></table></div></section>
    </template>
    <template v-else-if="esAdmin">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2"><article class="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Suscriptores con operaciones</p><span class="rounded-lg bg-violet-50 px-2 py-1 text-violet-600">♙</span></div><p class="mt-3 text-3xl font-extrabold text-violet-700">{{porSuscriptor.length}}</p><p class="mt-2 text-xs text-slate-500">No incluye perfiles sin movimientos.</p></article><article class="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-500">Operaciones registradas</p><span class="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-600">↗</span></div><p class="mt-3 text-3xl font-extrabold text-emerald-700">{{filas.length}}</p><p class="mt-2 text-xs text-slate-500">Total devuelto por la API de Operaciones.</p></article></div>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-4 shadow-sm sm:p-5"><h3 class="font-bold">Actividad por suscriptor</h3><p class="mt-1 text-xs text-slate-500">Distribución real de operaciones encontradas</p><div v-for="[id,total] in porSuscriptor" :key="id" class="mt-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><div class="min-w-0"><span class="block truncate text-sm font-semibold">{{id}}</span><div class="mt-2 h-2 w-36 max-w-full overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-violet-500" :style="{width:(100*total/Math.max(filas.length,1))+'%'}"/></div></div><span class="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">{{total}} operaciones</span></div><p v-if="!porSuscriptor.length" class="mt-5 text-sm text-slate-500">Sin movimientos registrados.</p></section>
    </template>
    <p class="pb-1 text-xs leading-relaxed text-slate-500">KPI y gráficos aplican el filtro global. Valores estimados, no balances verificados. No incluyen comisiones ni confirman ejecución de TP. El filtrado visual no equivale a autorización de acceso.</p>
  </div>
</template>
