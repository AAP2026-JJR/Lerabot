<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { listarOperaciones, preciosDeMercado, detalleOperacion } from '../operaciones/servicio'
import { cotizacionActual, observarCotizaciones, cotizacionesVivas } from '../mercado/cotizacionesVivas'
import { onUnmounted } from 'vue'
import type { OperacionSpot } from '../operaciones/tipos'
import { sesionDemo } from '../login/sesionDemo'
const sesion=sesionDemo()
const esAdmin=sesion?.rol==='ADMIN'
const propietario=sesion?.rol==='SUBSCRIBER'?String(sesion.subscriberId||'').toLowerCase():''
const rows=ref<OperacionSpot[]>([])
const selectedSub=ref('')
const opened=ref('__ALL__')
const page=ref(1)
const pageSize=ref(10)
const symbolFilter=ref('')
const search=ref('')
const updatedAt=ref<Date|null>(null)
const busy=ref(false)
const error=ref('')
const partial=ref(false)
const statusFilter=ref('')
const fromDate=ref('')
const toDate=ref('')
const prices=ref<Record<string,{precio:number;cambio24h:number|null}>>({})
const detail=ref<OperacionSpot|null>(null)
let stopPrices:(()=>void)|undefined
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n)
const subscription=(r:OperacionSpot)=>/^SUB#([^#]+)/i.exec(String(r.PK||''))?.[1]?.toLowerCase()||''
const exchangeId=(r:OperacionSpot)=>String(r.exchangeId||'').trim().toLowerCase()
const accountId=(r:OperacionSpot)=>String(r.accountId??r.account_id??'').trim()
const num=(n:unknown,d=6)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'—'
const price=(o:OperacionSpot):number|null=>{void cotizacionesVivas.value;return cotizacionActual(String(o.symbol||''))?.precio??prices.value[String(o.symbol||'').toUpperCase()]?.precio??null}
const investment=(o:OperacionSpot)=>Number(o.buyPrice)*Number(o.quantity)
const valuation=(o:OperacionSpot)=>{const p=price(o),q=Number(o.quantity);return p!==null&&Number.isFinite(q)&&q>0?p*q:null}
const pnl=(o:OperacionSpot)=>{const v=valuation(o),cost=investment(o);return v===null||!Number.isFinite(cost)||cost<=0?null:v-cost}
const roi=(o:OperacionSpot)=>{const result=pnl(o),cost=investment(o);return result===null||cost<=0?null:result/cost*100}
const tp=(o:OperacionSpot,n:number)=>{const v=Number(o[`tp${n}Price`]),q=Number(o[`tp${n}Quantity`]),purchase=Number(o.buyPrice);return Number.isFinite(v)&&v>0&&Number.isFinite(q)&&q>0&&Number.isFinite(purchase)&&purchase>0?(v-purchase)*q:null}
const tpTotal=(o:OperacionSpot)=>{const values=[1,2,3].map(i=>tp(o,i));const has=values.some(x=>x!==null);const qty=[1,2,3].reduce((s,i)=>s+(Number(o[`tp${i}Quantity`])||0),0);return has&&qty<=Number(o.quantity)+1e-8?values.reduce<number>((s,v)=>s+(v||0),0):null}
const date=(s:unknown)=>{const d=new Date(String(s||''));return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-PE')}
const users=computed(()=>[...new Set(rows.value.map(subscription).filter(Boolean))].sort())
const visibleRows=computed(()=>rows.value.filter(r=>(esAdmin?(!selectedSub.value||subscription(r)===selectedSub.value):subscription(r)===propietario)))
const accounts=computed(()=>{const ids=new Map<string,{key:string;name:string;exchange:string;account:string;count:number;capital:number}>();for(const r of visibleRows.value){const ex=exchangeId(r);if(!ex)continue;const acc=accountId(r)||'sin-cuenta';const key=ex+'|'+acc;if(!ids.has(key))ids.set(key,{key,name:ex+(acc==='sin-cuenta'?'':' · '+acc),exchange:ex,account:acc,count:0,capital:0});const entry=ids.get(key)!;entry.count++;if(String(r.side).toUpperCase()==='BUY'){const amount=Number(r.buyPrice)*Number(r.quantity);if(Number.isFinite(amount)&&amount>0)entry.capital+=amount}}return [...ids.values()].sort((a,b)=>b.count-a.count)})
const ALL='__ALL__'
const activeAccount=computed(()=>accounts.value.find(a=>a.key===opened.value))
const selectionName=computed(()=>opened.value===ALL?'Todas las cuentas':activeAccount.value?.name||'Cuenta')
const totalCapital=computed(()=>accounts.value.reduce((sum,a)=>sum+a.capital,0))
const relevantRows=computed(()=>visibleRows.value.filter(r=>opened.value===ALL || (exchangeId(r)+'|'+(accountId(r)||'sin-cuenta')===opened.value)))
const pricedRows=computed(()=>relevantRows.value.filter(r=>pnl(r)!==null))
const currentPnL=computed(()=>pricedRows.value.reduce((s,r)=>s+(pnl(r)||0),0))
const selectedCapital=computed(()=>opened.value===ALL?totalCapital.value:activeAccount.value?.capital||0)
const iconFor=(v:string)=>String(v||'?').slice(0,2).toUpperCase()
const lastUpdated=computed(()=>updatedAt.value?updatedAt.value.toLocaleTimeString('es-PE'):'Sin actualizar')
const token=(s:string)=>String(s||'').toUpperCase().replace(/(USDT|USDC|BUSD|BTC|ETH|EUR)$/,'')||String(s||'').toUpperCase()
const tokenStyle=(s:string)=>( {BTC:'bg-amber-100 text-amber-800 ring-amber-200',ETH:'bg-indigo-100 text-indigo-800 ring-indigo-200',SOL:'bg-violet-100 text-violet-800 ring-violet-200',XRP:'bg-sky-100 text-sky-800 ring-sky-200',BNB:'bg-yellow-100 text-yellow-800 ring-yellow-200',USDT:'bg-emerald-100 text-emerald-800 ring-emerald-200'} as Record<string,string>)[token(s)]||'bg-slate-100 text-slate-700 ring-slate-200'
const statusStyle=(s:unknown)=>{const v=String(s||'').toUpperCase();return ['OPEN','ACTIVE','PARTIALLY_FILLED'].includes(v)?'bg-sky-100 text-sky-800 ring-sky-200':(['TP1_HIT','PARTIAL','PARTIALLY_CLOSED'].includes(v)?'bg-amber-100 text-amber-800 ring-amber-200':(['FILLED','COMPLETED','TP2_HIT','TP3_HIT'].includes(v)?'bg-emerald-100 text-emerald-800 ring-emerald-200':(['FAILED','ERROR','REJECTED','STOP_LOSS','STOPPED','CANCELLED'].includes(v)?'bg-rose-100 text-rose-800 ring-rose-200':'bg-slate-100 text-slate-700 ring-slate-200')))}
const amountStyle=(n:number|null)=>n===null?'text-slate-400':n>0?'text-emerald-700 font-semibold':n<0?'text-rose-600 font-semibold':'text-slate-600'
const amount=(n:number|null)=>n===null?'—':money(n)
const pct=(n:number|null)=>n===null?'—':`${n.toFixed(2)}%`
const tpQty=(r:OperacionSpot,i:number)=>{const q=Number(r[`tp${i}Quantity`]);return Number.isFinite(q)&&q>0?q:null}
const tpRoi=(r:OperacionSpot,i:number)=>{const profit=tp(r,i),quantity=tpQty(r,i),buy=Number(r.buyPrice);const basis=quantity!==null?quantity*buy:null;return profit===null||basis===null||basis<=0?null:profit/basis*100}
const tpOverallRoi=(r:OperacionSpot)=>{const profit=tpTotal(r),quantities=[1,2,3].map(i=>tpQty(r,i)),sum=quantities.reduce<number>((total,q)=>total+(q||0),0),basis=sum*Number(r.buyPrice);return profit===null||basis<=0?null:profit/basis*100}

const filtered=computed(()=>relevantRows.value.filter(r=>{if(symbolFilter.value&&String(r.symbol||'')!==symbolFilter.value)return false;if(statusFilter.value&&String(r.status||'')!==statusFilter.value)return false;if(fromDate.value&&String(r.createdAt||'').slice(0,10)<fromDate.value)return false;if(toDate.value&&String(r.createdAt||'').slice(0,10)>toDate.value)return false;const q=search.value.toLowerCase().trim();return !q||[r.symbol,r.side,r.exchangeId,accountId(r),subscription(r),r.status].join(' ').toLowerCase().includes(q)}))
const symbols=computed(()=>[...new Set(relevantRows.value.map(r=>String(r.symbol||'')).filter(Boolean))].sort())
const statuses=computed(()=>[...new Set(relevantRows.value.map(r=>String(r.status||'')).filter(Boolean))].sort())
const pages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/pageSize.value)))
const currentRows=computed(()=>filtered.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
watch([opened,selectedSub,symbolFilter,statusFilter,fromDate,toDate,search,pageSize],()=>{page.value=1})
watch(accounts,(list)=>{if(opened.value!==ALL&&!list.some(x=>x.key===opened.value))opened.value=ALL})
function expand(key:string){opened.value=key;symbolFilter.value='';statusFilter.value='';fromDate.value='';toDate.value='';search.value='';page.value=1}
async function load(){busy.value=true;error.value='';partial.value=false;try{let cursor='';const items:OperacionSpot[]=[];for(let i=0;i<10;i++){const r=await listarOperaciones({limite:'100',...(cursor?{cursor}:{})});items.push(...(r.operaciones||[]));if(r.parcial)partial.value=true;cursor=r.siguienteCursor||'';if(!cursor)break;if(i===9)partial.value=true}rows.value=items;updatedAt.value=new Date();stopPrices?.();stopPrices=items.length?observarCotizaciones([...new Set(items.map(o=>String(o.symbol||'').toUpperCase()).filter(Boolean))]):undefined;try{prices.value=await preciosDeMercado([...new Set(items.map(o=>String(o.symbol||'').toUpperCase()).filter(Boolean))])}catch{prices.value={}}}catch(e){error.value=e instanceof Error?e.message:'No se pudieron consultar las operaciones'}finally{busy.value=false}}
async function openDetail(o:OperacionSpot){detail.value=o;try{const r=await detalleOperacion(o.PK,o.SK);if(r.operacion&&r.operacion.PK===o.PK&&r.operacion.SK===o.SK)detail.value=r.operacion}catch{/* conserva fila cargada */}}
onMounted(()=>{void load()})
onUnmounted(()=>{stopPrices?.()})
</script>
<template>
 <main class="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[1750px] flex-col gap-4 px-3 pb-8 pt-2 text-slate-900 sm:px-5 lg:pb-10">
  <div class="flex flex-wrap items-center justify-between gap-2">
   <div class="text-xs text-slate-500">Cuentas e historial de operaciones <span v-if="updatedAt" class="ml-2">· Actualizado: {{lastUpdated}}</span></div>
   <button class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50" :disabled="busy" @click="load"><span class="text-lg leading-none" :class="busy?'animate-spin':''" aria-hidden="true">↻</span>{{busy?'Actualizando…':'Actualizar'}}</button>
  </div>
  <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{{error}}</p>
  <div v-if="esAdmin" class="rounded-xl border bg-white p-3"><label class="text-sm">Suscriptor<select v-model="selectedSub" class="ml-3 rounded-lg border px-3 py-2"><option value="">Todos</option><option v-for="u in users" :key="u" :value="u">{{u}}</option></select></label></div>
  <p v-if="partial" class="text-xs text-amber-700">Historial parcial: las cifras solo incluyen registros recuperados de AWS.</p>
  <section class="flex flex-1 flex-col gap-4">
   <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    <button type="button" class="flex min-h-[132px] flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md" :class="opened===ALL?'border-emerald-500 ring-2 ring-emerald-100':'border-slate-200 hover:border-emerald-400'" :aria-pressed="opened===ALL" @click="expand(ALL)">
     <span class="flex items-start gap-3"><span class="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800" aria-hidden="true">◎</span><span><strong class="block">Todas las cuentas</strong><small class="mt-1 block text-slate-500">{{visibleRows.length}} registros · {{accounts.length}} cuentas</small></span></span>
     <span class="mt-3 flex items-end justify-between gap-2"><span><small class="block text-slate-500">Compras históricas</small><strong class="text-lg">{{money(totalCapital)}}</strong></span><span class="text-xs font-semibold text-emerald-700">{{opened===ALL?'Seleccionada ✓':'Ver historial →'}}</span></span>
    </button>
    <button v-for="a in accounts" :key="a.key" type="button" class="flex min-h-[132px] flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md" :class="opened===a.key?'border-emerald-500 ring-2 ring-emerald-100':'border-slate-200 hover:border-emerald-400'" :aria-pressed="opened===a.key" @click="expand(a.key)">
     <span class="flex items-start gap-3"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 font-bold uppercase text-emerald-800">{{iconFor(a.exchange)}}</span><span class="min-w-0"><strong class="block break-words capitalize">{{a.name}}</strong><small class="mt-1 block break-all text-slate-500">{{a.count}} registros · {{a.account==='sin-cuenta'?'Cuenta no identificada':a.account}}</small></span></span>
     <span class="mt-3 flex items-end justify-between gap-2"><span><small class="block text-slate-500">Compras históricas</small><strong class="text-lg">{{money(a.capital)}}</strong></span><span class="text-xs font-semibold text-emerald-700">{{opened===a.key?'Seleccionada ✓':'Ver historial →'}}</span></span>
    </button>
   </div>
   <article class="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/60 px-4 py-3 sm:px-5">
     <div><h2 class="text-base font-bold">Historial de operaciones</h2><p class="text-xs text-slate-500">{{selectionName}} · {{filtered.length}} registros</p></div>
     <div class="flex flex-wrap items-center gap-3 text-xs"><span>Invertido histórico: <strong>{{money(selectedCapital)}}</strong></span><span> PnL estimado: <strong :class="amountStyle(pricedRows.length?currentPnL:null)">{{pricedRows.length?money(currentPnL):'—'}}</strong></span><span v-if="pricedRows.length!==relevantRows.length" class="text-amber-700">{{pricedRows.length}}/{{relevantRows.length}} con precio</span></div>
    </div>
    <div class="flex flex-1 flex-col p-3 sm:p-4">
     <div class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <label class="text-xs">Símbolo<select v-model="symbolFilter" class="mt-1 block w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todos</option><option v-for="s in symbols" :key="s">{{s}}</option></select></label>
      <label class="text-xs">Estado<select v-model="statusFilter" class="mt-1 block w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todos</option><option v-for="s in statuses" :key="s">{{s}}</option></select></label>
      <label class="text-xs">Desde<input v-model="fromDate" type="date" class="mt-1 block w-full rounded-lg border px-2 py-2 text-sm"/></label>
      <label class="text-xs">Hasta<input v-model="toDate" type="date" class="mt-1 block w-full rounded-lg border px-2 py-2 text-sm"/></label>
      <label class="text-xs">Buscar<input v-model="search" class="mt-1 block w-full rounded-lg border px-2 py-2 text-sm" placeholder="Activo, cuenta, tipo…"/></label>
     </div>
     <div class="min-h-[280px] flex-1 overflow-auto rounded-xl border lg:min-h-[420px] lg:max-h-[calc(100dvh-390px)]">
      <table class="min-w-[1950px] w-full text-left text-xs">
       <thead class="sticky top-0 z-10 bg-slate-100"><tr><th v-for="h in ['Activo','Suscriptor','Fecha','Exchange / Cuenta','Tipo','Cantidad','P. compra','Invertido USD','P. mercado','Valor actual USD','PnL actual','ROI actual','PnL TP1','ROI TP1','PnL TP2','ROI TP2','PnL TP total','ROI TP total','Estado']" :key="h" class="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{{h}}</th></tr></thead>
       <tbody>
        <tr v-for="(r,i) in currentRows" :key="r.PK+'|'+r.SK+'|'+i" tabindex="0" class="cursor-pointer border-t hover:bg-emerald-50/60" @click="openDetail(r)" @keydown.enter.prevent="openDetail(r)">
         <td class="px-3 py-3"><span class="inline-flex items-center rounded-lg px-2 py-1 font-bold ring-1" :class="tokenStyle(String(r.symbol||''))">{{r.symbol||'—'}}</span></td>
         <td class="px-3 py-3">{{subscription(r)}}</td><td class="whitespace-nowrap px-3 py-3">{{date(r.createdAt||r.date)}}</td>
         <td class="px-3 py-3"><strong class="block capitalize">{{r.exchangeId||'—'}}</strong><small class="block text-[10px] text-slate-500">{{accountId(r)||'Sin cuenta'}}</small></td>
         <td class="px-3 py-3">{{r.side||'—'}}</td><td class="px-3 py-3">{{num(r.quantity)}}</td><td class="px-3 py-3">{{money(Number(r.buyPrice)||0)}}</td><td class="px-3 py-3">{{money(investment(r)||0)}}</td>
         <td class="bg-amber-50 px-3 py-3">{{amount(price(r))}}</td><td class="px-3 py-3">{{amount(valuation(r))}}</td>
         <td class="px-3 py-3" :class="amountStyle(pnl(r))">{{amount(pnl(r))}}</td><td class="px-3 py-3" :class="amountStyle(roi(r))">{{pct(roi(r))}}</td>
         <td class="px-3 py-3" :class="amountStyle(tp(r,1))">{{amount(tp(r,1))}}</td><td class="px-3 py-3" :class="amountStyle(tpRoi(r,1))">{{pct(tpRoi(r,1))}}</td>
         <td class="px-3 py-3" :class="amountStyle(tp(r,2))">{{amount(tp(r,2))}}</td><td class="px-3 py-3" :class="amountStyle(tpRoi(r,2))">{{pct(tpRoi(r,2))}}</td>
         <td class="px-3 py-3 font-medium" :class="amountStyle(tpTotal(r))">{{amount(tpTotal(r))}}</td><td class="px-3 py-3" :class="amountStyle(tpOverallRoi(r))">{{pct(tpOverallRoi(r))}}</td>
         <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1" :class="statusStyle(r.status)">{{r.status||'—'}}</span></td>
        </tr>
        <tr v-if="!currentRows.length"><td colspan="19" class="p-5 text-center text-slate-500">No hay operaciones para los filtros seleccionados.</td></tr>
       </tbody>
      </table>
     </div>
     <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs">
      <span>{{filtered.length}} registros · Página {{page}} de {{pages}}</span>
      <div class="flex flex-wrap items-center gap-2"><label class="flex items-center gap-2">Filas por página<select v-model.number="pageSize" class="rounded-lg border bg-white px-2 py-2 text-sm"><option :value="5">5</option><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select></label><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="page<=1" @click="page=Math.max(1,page-1)">← Anterior</button><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="page>=pages" @click="page=Math.min(pages,page+1)">Siguiente →</button></div>
     </div>
     <p class="mt-2 text-[11px] text-slate-500">Precios actuales de referencia; PnL y ROI sin comisiones. Los TP son proyecciones por cantidades asignadas, no ganancias ejecutadas. Los registros históricos no equivalen a saldos disponibles.</p>
    </div>
   </article>
  </section>
  <div v-if="detail" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" @click.self="detail=null"><section role="dialog" aria-modal="true" class="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6"><div class="flex justify-between"><h3 class="text-lg font-bold">Detalle de operación · {{detail.symbol}}</h3><button class="rounded-lg border px-3 py-1" @click="detail=null">Cerrar</button></div><pre class="mt-4 overflow-x-auto rounded-xl bg-slate-100 p-4 text-xs">{{JSON.stringify(detail,null,2)}}</pre></section></div>
 </main>
</template>
