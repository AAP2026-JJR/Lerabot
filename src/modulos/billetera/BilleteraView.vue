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
</script>
<template>
 <main class="mx-auto max-w-[1450px] space-y-5 px-4 pb-12 sm:px-6">
  <header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-2xl font-bold">Mi billetera</h1><p class="text-sm text-slate-500">Cuentas y operaciones registradas</p></div><button class="rounded-lg border bg-white px-4 py-2" :disabled="busy" @click="load">{{busy?'Consultando…':'Actualizar'}}</button></header>
  <p v-if="session?.rol!=='SUBSCRIBER'" class="rounded-xl border bg-white p-5">Vista disponible para suscriptores.</p>
  <template v-else>
   <p v-if="error" role="alert" class="rounded-lg bg-rose-50 p-3 text-rose-700">{{error}}</p>
   <p v-if="partial" class="text-sm text-amber-700">Historial parcial. Puede haber operaciones fuera de los registros consultados.</p>
   <section class="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-lg font-bold">Mis cuentas</h2><p class="text-sm text-slate-500">Selecciona una para filtrar sus movimientos</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{{accounts.length}} cuentas</span></div><div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><button class="min-h-[115px] rounded-xl border p-4 text-left transition" :class="allSelected?'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200':'hover:border-emerald-300'" @click="selected='';asset='' "><strong class="block">Todas las cuentas</strong><span class="mt-1 block text-xs text-slate-500">{{owned.length}} operaciones consultadas</span><span class="mt-3 block font-bold">{{fmt(aggregate)}}</span></button><button v-for="a in accounts" :key="a.id" class="min-h-[115px] rounded-xl border p-4 text-left transition" :class="selected===a.id?'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200':'hover:border-emerald-300'" @click="selected=a.id;asset='' "><strong class="block break-words">{{a.exchange}} · {{a.name}}</strong><span class="mt-1 block text-xs text-slate-500">{{a.count}} operaciones</span><span class="mt-3 block font-bold">{{fmt(a.capital)}}</span></button></div></section>
   <section class="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-bold">{{selectedTitle}}</h2><p class="text-sm text-slate-500">Detalle de activos y compras históricas</p></div><span class="text-xs text-slate-500">{{current.length}} registros filtrados</span></div><div class="mt-5 grid gap-3 sm:grid-cols-3"><div class="rounded-xl border bg-slate-50 p-4"><p class="text-xs text-slate-500">Saldo inicial USDT</p><p class="mt-1 font-semibold">No disponible</p></div><div class="rounded-xl border bg-slate-50 p-4"><p class="text-xs text-slate-500">USDT libre</p><p class="mt-1 font-semibold">No disponible</p></div><div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p class="text-xs text-slate-500">Compras históricas registradas</p><p class="mt-1 text-xl font-bold">{{fmt(selectedCapital)}}</p></div></div><p class="mt-3 text-xs text-slate-500">Los importes reflejan compras registradas, no posiciones ni balances reales. No incluyen depósitos, retiros, ventas y comisiones conciliadas.</p><div class="mt-5 flex flex-wrap gap-2"><button class="rounded-full border px-3 py-1 text-sm" :class="asset===''?'border-emerald-500 bg-emerald-50':''" @click="asset=''">Todos los activos</button><button v-for="symbol in symbols" :key="symbol" class="rounded-full border px-3 py-1 text-sm" :class="asset===symbol?'border-emerald-500 bg-emerald-50':''" @click="asset=symbol">{{symbol}}</button></div><div class="mt-4 overflow-x-auto rounded-xl border"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">Fecha</th><th class="p-3">Cuenta</th><th class="p-3">Activo</th><th class="p-3">Tipo</th><th class="p-3 text-right">Cantidad</th><th class="p-3 text-right">Precio</th><th class="p-3 text-right">Importe histórico</th></tr></thead><tbody><tr v-for="(r,i) in view" :key="r.PK+'|'+r.SK+'|'+i" class="border-t"><td class="p-3">{{r.createdAt?new Date(r.createdAt).toLocaleDateString('es-PE'):'—'}}</td><td class="p-3">{{account(r)||exchange(r)||'—'}}</td><td class="p-3 font-semibold">{{r.symbol||'—'}}</td><td class="p-3">{{r.side||'—'}}</td><td class="p-3 text-right">{{num(r.quantity)}}</td><td class="p-3 text-right">{{fmt(Number(r.buyPrice))}}</td><td class="p-3 text-right">{{fmt(Number(r.buyPrice)*Number(r.quantity))}}</td></tr><tr v-if="!view.length"><td colspan="7" class="p-5 text-center text-slate-500">Sin operaciones para estos filtros.</td></tr></tbody></table></div><div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {{page}} de {{pages}} · {{current.length}} registros</span><div class="flex gap-2"><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="page<=1" @click="page--">Anterior</button><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="page>=pages" @click="page++">Siguiente</button></div></div></section>
  </template>
 </main>
</template>
