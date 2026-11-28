<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { listarOperaciones } from '../operaciones/servicio'
import { sesionDemo } from '../login/sesionDemo'
import type { OperacionSpot } from '../operaciones/tipos'
const session=sesionDemo()
const subscriber=String(session?.subscriberId||'').toLowerCase()
const rows=ref<OperacionSpot[]>([])
const busy=ref(false)
const error=ref('')
const partial=ref(false)
const selected=ref('')
const asset=ref('')
const page=ref(1)
const size=10
const owner=(r:OperacionSpot)=>/^SUB#([^#]+)/i.exec(String(r.PK||''))?.[1]?.toLowerCase()||''
const account=(r:OperacionSpot)=>String(r.accountId??r.account_id??'').trim()
const exchange=(r:OperacionSpot)=>String(r.exchangeId||'').trim()
const fmt=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):'—'
const num=(n:unknown)=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{maximumFractionDigits:8}):'—'
const owned=computed(()=>rows.value.filter(r=>owner(r)===subscriber))
const accounts=computed(()=>{const m=new Map<string,{id:string;name:string;exchange:string;count:number;capital:number}>();for(const r of owned.value){const ex=exchange(r)||'Otro',a=account(r);const key=ex+'|'+(a||'Sin identificar');if(!m.has(key))m.set(key,{id:key,name:a||'Cuenta no identificada',exchange:ex,count:0,capital:0});const item=m.get(key)!;item.count++;if(String(r.side||'').toUpperCase()==='BUY'){const v=Number(r.buyPrice)*Number(r.quantity);if(Number.isFinite(v)&&v>0)item.capital+=v}}return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name))})
const active=computed(()=>accounts.value.find(a=>a.id===selected.value))
const allSelected=computed(()=>selected.value==='')
const aggregate=computed(()=>accounts.value.reduce((total,a)=>total+a.capital,0))
const selectedCapital=computed(()=>allSelected.value?aggregate.value:(active.value?.capital??0))
const selectedTitle=computed(()=>allSelected.value?'Todas las cuentas':active.value?`${active.value.exchange} · ${active.value.name}`:'Todas las cuentas')
const current=computed(()=>owned.value.filter(r=>{const key=(exchange(r)||'Otro')+'|'+(account(r)||'Sin identificar');return (!selected.value||key===selected.value)&&(!asset.value||String(r.symbol||'')===asset.value)}))
const symbols=computed(()=>[...new Set(owned.value.filter(r=>(!selected.value||(exchange(r)||'Otro')+'|'+(account(r)||'Sin identificar')===selected.value)).map(r=>String(r.symbol||'')).filter(Boolean))].sort())
const pages=computed(()=>Math.max(1,Math.ceil(current.value.length/size)))
const view=computed(()=>current.value.slice((page.value-1)*size,page.value*size))
watch([selected,asset],()=>{page.value=1})
async function load(){if(session?.rol!=='SUBSCRIBER')return;busy.value=true;error.value='';try{let cursor='';let exhausted=true;const out:OperacionSpot[]=[];for(let i=0;i<20;i++){const r=await listarOperaciones({limite:'100',...(cursor?{cursor}:{})});out.push(...(r.operaciones||[]));cursor=r.siguienteCursor||'';if(r.parcial)partial.value=true;if(!cursor)break;if(i===19)exhausted=false}partial.value=partial.value||!exhausted;rows.value=out;if(selected.value&&!accounts.value.some(a=>a.id===selected.value))selected.value=''}catch(e){error.value=e instanceof Error?e.message:'No se pudieron leer las operaciones'}finally{busy.value=false}}
onMounted(()=>{void load()})

// Navegación horizontal por cuentas: funciona por flechas, rueda de trackpad y arrastre con ratón.
const rail = ref<HTMLElement | null>(null)
let dragStartX = 0
let dragStartScroll = 0
let dragging = false
let dragged = false
function scrollAccounts(direction: -1 | 1) {
  rail.value?.scrollBy({ left: direction * Math.max(260, (rail.value?.clientWidth || 350) * 0.8), behavior: 'smooth' })
}
function pointerDown(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0 || !rail.value) return
  dragging = true
  dragged = false
  dragStartX = event.clientX
  dragStartScroll = rail.value.scrollLeft
}
function pointerMove(event: PointerEvent) {
  if (!dragging || !rail.value) return
  const distance = event.clientX - dragStartX
  if (Math.abs(distance) > 6) {
    dragged = true
    rail.value.scrollLeft = dragStartScroll - distance
    event.preventDefault()
  }
}
function pointerEnd() { dragging = false }
function selectAccount(id: string) {
  if (dragged) { dragged = false; return }
  selected.value = id
  asset.value = ''
}
const coin = (symbol: unknown) => String(symbol || '').toUpperCase().replace(/(USDT|USDC|BUSD|EUR|BTC)$/,'')
const coinStyle = (symbol: unknown) => ({
  BTC: 'bg-amber-100 text-amber-900 ring-amber-200',
  ETH: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  SOL: 'bg-violet-100 text-violet-800 ring-violet-200',
  XRP: 'bg-sky-100 text-sky-800 ring-sky-200',
  BNB: 'bg-yellow-100 text-yellow-900 ring-yellow-200',
  USDT: 'bg-emerald-100 text-emerald-800 ring-emerald-200'
} as Record<string,string>)[coin(symbol)] || 'bg-slate-100 text-slate-700 ring-slate-200'
const exchangeStyle = (name: string) => ({
  bingx: 'bg-sky-100 text-sky-900',
  binance: 'bg-amber-100 text-amber-900',
  tangem: 'bg-indigo-100 text-indigo-900'
} as Record<string,string>)[name.toLowerCase()] || 'bg-slate-100 text-slate-700'
const tradeStyle = (side: unknown) => String(side || '').toUpperCase() === 'BUY'
  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  : String(side || '').toUpperCase() === 'SELL'
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-slate-100 text-slate-600 ring-slate-200'
</script>
<template>
 <main class="mx-auto flex w-full max-w-[1720px] flex-col gap-3 px-1 pb-10 pt-0 text-slate-900 sm:px-2">
  <header class="flex flex-wrap items-center justify-between gap-3">
   <div class="flex flex-wrap items-center gap-2 text-sm text-slate-500"><span class="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">Fondos por cuenta</span><span>Historial de operaciones registradas</span></div>
   <button type="button" class="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-emerald-400 disabled:opacity-50" :disabled="busy" @click="load"><span aria-hidden="true" class="text-lg leading-none" :class="busy?'animate-spin':''">↻</span>{{busy?'Actualizando…':'Actualizar'}}</button>
  </header>
  <p v-if="session?.rol!=='SUBSCRIBER'" class="rounded-xl border bg-white p-5">Vista disponible para suscriptores.</p>
  <template v-else>
   <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{{error}}</p>
   <p v-if="partial" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">Historial parcial: puede haber operaciones fuera de los registros consultados.</p>
   <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
     <div><h2 class="text-lg font-bold">Mis cuentas</h2><p class="text-xs text-slate-500">Selecciona una cuenta o desliza horizontalmente para ver las demás</p></div>
     <div class="flex items-center gap-2"><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{{accounts.length}} cuentas</span><button type="button" aria-label="Desplazar cuentas a la izquierda" class="grid h-9 w-9 place-items-center rounded-xl border hover:bg-slate-50" @click="scrollAccounts(-1)">‹</button><button type="button" aria-label="Desplazar cuentas a la derecha" class="grid h-9 w-9 place-items-center rounded-xl border hover:bg-slate-50" @click="scrollAccounts(1)">›</button></div>
    </div>
    <div ref="rail" class="mt-4 flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 select-none" style="scrollbar-width:thin; cursor:grab; touch-action:pan-x" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @pointerleave="pointerEnd">
     <button type="button" :aria-pressed="allSelected" class="flex min-h-[138px] w-[245px] shrink-0 snap-start flex-col justify-between rounded-2xl border p-4 text-left transition sm:w-[270px]" :class="allSelected?'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200':'border-slate-200 bg-slate-50/50 hover:border-emerald-300'" @click="selectAccount('')">
      <span class="flex items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-xl font-bold text-emerald-800" aria-hidden="true">◎</span><span><strong class="block text-sm">Todas las cuentas</strong><small class="block text-xs text-slate-500">{{owned.length}} operaciones</small></span></span>
      <span><small class="block text-xs text-slate-500">Compras históricas</small><strong class="mt-1 block text-xl">{{fmt(aggregate)}}</strong></span>
     </button>
     <button v-for="a in accounts" :key="a.id" type="button" :aria-pressed="selected===a.id" class="flex min-h-[138px] w-[245px] shrink-0 snap-start flex-col justify-between rounded-2xl border bg-white p-4 text-left transition sm:w-[270px]" :class="selected===a.id?'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200':'border-slate-200 hover:border-emerald-300'" @click="selectAccount(a.id)">
      <span class="flex min-w-0 items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold uppercase" :class="exchangeStyle(a.exchange)">{{a.exchange.slice(0,2)}}</span><span class="min-w-0"><strong class="block truncate text-sm capitalize">{{a.exchange}}</strong><small class="block truncate text-xs text-slate-500" :title="a.name">{{a.name}}</small></span></span>
      <span><small class="block text-xs text-slate-500">{{a.count}} operaciones · Compras históricas</small><strong class="mt-1 block text-xl">{{fmt(a.capital)}}</strong></span>
     </button>
    </div>
    <p class="mt-1 text-right text-[11px] text-slate-400">Arrastra las tarjetas o utiliza ‹ › para recorrer las cuentas</p>
   </section>
   <section class="flex min-h-[480px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-bold">{{selectedTitle}}</h2><p class="text-xs text-slate-500">Detalle de activos y compras históricas registradas</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{{current.length}} registros filtrados</span></div>
    <div class="mt-4 grid gap-3 sm:grid-cols-3">
     <div class="rounded-xl border border-sky-100 bg-sky-50/50 p-4"><p class="text-xs text-slate-500">Saldo inicial USDT</p><p class="mt-1 text-lg font-semibold text-slate-700">No disponible</p></div>
     <div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4"><p class="text-xs text-slate-500">USDT libre</p><p class="mt-1 text-lg font-semibold text-slate-700">No disponible</p></div>
     <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p class="text-xs text-emerald-800">Compras históricas registradas</p><p class="mt-1 text-2xl font-bold text-emerald-800">{{fmt(selectedCapital)}}</p></div>
    </div>
    <p class="mt-3 text-xs text-slate-500">Estos importes son compras históricas, no saldos disponibles ni posiciones verificadas. No incluyen el flujo completo de depósitos, retiros, ventas y comisiones.</p>
    <div class="mt-4 flex flex-wrap items-center gap-2"><button type="button" class="rounded-full border px-3 py-1.5 text-xs font-semibold" :class="asset===''?'border-emerald-500 bg-emerald-50 text-emerald-800':'border-slate-200 text-slate-600'" @click="asset=''">Todos los activos</button><button v-for="symbol in symbols" :key="symbol" type="button" class="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1" :class="coinStyle(symbol)" :aria-pressed="asset===symbol" :style="asset===symbol?'outline:2px solid currentColor;outline-offset:2px':''" @click="asset=symbol">{{symbol}}</button></div>
    <div class="mt-4 min-h-[260px] flex-1 overflow-x-auto rounded-xl border border-slate-200"><table class="w-full min-w-[760px] text-left text-sm"><thead class="bg-slate-100 text-xs text-slate-600"><tr><th class="p-3">Fecha</th><th class="p-3">Cuenta</th><th class="p-3">Activo</th><th class="p-3">Tipo</th><th class="p-3 text-right">Cantidad</th><th class="p-3 text-right">Precio</th><th class="p-3 text-right">Importe histórico</th></tr></thead><tbody><tr v-for="(r,i) in view" :key="r.PK+'|'+r.SK+'|'+i" class="border-t border-slate-100 transition hover:bg-slate-50"><td class="whitespace-nowrap p-3">{{r.createdAt?new Date(r.createdAt).toLocaleDateString('es-PE'):'—'}}</td><td class="p-3 text-xs text-slate-600">{{account(r)||exchange(r)||'—'}}</td><td class="p-3"><span class="inline-flex rounded-lg px-2 py-1 text-xs font-bold ring-1" :class="coinStyle(r.symbol)">{{r.symbol||'—'}}</span></td><td class="p-3"><span class="rounded-full px-2 py-1 text-xs font-bold ring-1" :class="tradeStyle(r.side)">{{r.side||'—'}}</span></td><td class="p-3 text-right tabular-nums">{{num(r.quantity)}}</td><td class="p-3 text-right tabular-nums">{{fmt(Number(r.buyPrice))}}</td><td class="p-3 text-right font-semibold tabular-nums">{{fmt(Number(r.buyPrice)*Number(r.quantity))}}</td></tr><tr v-if="!view.length"><td colspan="7" class="p-5 text-center text-slate-500">Sin operaciones para estos filtros.</td></tr></tbody></table></div>
    <footer class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"><span>{{current.length}} registros · Página {{page}} de {{pages}}</span><div class="flex gap-2"><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="page<=1" @click="page--">← Anterior</button><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="page>=pages" @click="page++">Siguiente →</button></div></footer>
   </section>
  </template>
 </main>
</template>
