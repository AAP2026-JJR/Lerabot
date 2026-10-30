<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { listarOperaciones, detalleOperacion, preciosDeMercado } from './servicio'
import type { OperacionSpot } from './tipos'
import { observarCotizaciones, cotizacionActual, cotizacionesVivas, estadoCotizaciones } from '../mercado/cotizacionesVivas'
const filas=ref<OperacionSpot[]>([]), precios=ref<Record<string,{precio:number;cambio24h:number|null}>>({})
const cargando=ref(false), error=ref(''), avisoPrecios=ref(''), siguienteCursor=ref(''), cursor=ref(''), historico=ref<string[]>([])
let dejarPrecios: (() => void) | undefined
const tamanioPagina=ref(10)
const suscriptor=ref(''), estado=ref(''), exchange=ref(''), simbolo=ref(''), buscar=ref(''), desde=ref(''), hasta=ref('')
const actual=ref<OperacionSpot|null>(null), modalJson=ref(false), verJson=ref(false), cargandoDetalle=ref(false)
const divisa=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n):'—'
const num=(v:unknown,dec=5)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:dec}):'—'
const fecha=(v:unknown)=>typeof v==='string'&&v?new Date(v).toLocaleString('es-PE'):'—'
const sub=(o:OperacionSpot)=>/^SUB#([^#]+)/.exec(o.PK)?.[1]||'—'
const orden=(o:OperacionSpot)=>String(o.side||'').toUpperCase()==='BUY'?'Compra':String(o.side||'').toUpperCase()==='SELL'?'Venta':'Otro'
const montousd=(o:OperacionSpot)=>Number(o.buyPrice||0)*Number(o.quantity||0)
const precio=(o:OperacionSpot)=>{ void cotizacionesVivas.value; return cotizacionActual(String(o.symbol||''))?.precio ?? precios.value[String(o.symbol||'').toUpperCase()]?.precio }
const diferencial=(o:OperacionSpot)=>{const p=precio(o), entrada=o.buyPrice;return typeof p==='number'&&typeof entrada==='number'&&entrada>0?(p/entrada-1)*100:null}
// Valoraciones referenciales. Sin precio valido no se calcula ni se inventa PnL.
const valorActual=(o:OperacionSpot):number|null=>{const p=precio(o),q=Number(o.quantity);return typeof p==='number'&&Number.isFinite(p)&&p>=0&&Number.isFinite(q)&&q>0?p*q:null}
const pnlNoRealizado=(o:OperacionSpot):number|null=>{const valor=valorActual(o),base=Number(o.buyPrice)*Number(o.quantity);return valor===null||!Number.isFinite(base)||base<=0?null:valor-base}
const roiNoRealizado=(o:OperacionSpot):number|null=>{const pnl=pnlNoRealizado(o),base=Number(o.buyPrice)*Number(o.quantity);return pnl===null||!Number.isFinite(base)||base<=0?null:100*pnl/base}
const esCompra=(o:OperacionSpot)=>String(o.side||'').toUpperCase()==='BUY'
const visibles=computed(()=>filas.value.filter(o=>{
  const x=String(o.symbol||'').toUpperCase(),texto=[o.operationId,o.signalId,o.buyOrderId,o.symbol,sub(o),o.status].join(' ').toLowerCase()
  return (!suscriptor.value||sub(o)===suscriptor.value)&&(!estado.value||o.status===estado.value)&&(!exchange.value||o.exchangeId===exchange.value)&&(!simbolo.value||x===simbolo.value)&&(!buscar.value||texto.includes(buscar.value.toLowerCase()))&&(!desde.value||String(o.createdAt||'').slice(0,10)>=desde.value)&&(!hasta.value||String(o.createdAt||'').slice(0,10)<=hasta.value)
}))
const opciones=(campo:'suscriptor'|'estado'|'exchange'|'simbolo')=>Array.from(new Set(filas.value.map(o=>campo==='suscriptor'?sub(o):campo==='estado'?String(o.status||''):campo==='exchange'?String(o.exchangeId||''):String(o.symbol||'').toUpperCase()))).filter(Boolean).sort()
const simbolosMercado=computed(()=>Array.from(new Set(filas.value.map(o=>String(o.symbol||'').toUpperCase()))))
async function cargar(reset=false) {
  if(reset){cursor.value='';historico.value=[];siguienteCursor.value=''}
  cargando.value=true;error.value=''
  try {const r=await listarOperaciones({limite:String(tamanioPagina.value),cursor:cursor.value});filas.value=r.operaciones||[];siguienteCursor.value=r.siguienteCursor||''}
  catch(e){error.value=e instanceof Error?e.message:'No se pudieron cargar operaciones';filas.value=[]}
  finally{cargando.value=false}
  dejarPrecios?.()
  dejarPrecios = filas.value.length ? observarCotizaciones(simbolosMercado.value) : undefined
  if(filas.value.length) {try {precios.value=await preciosDeMercado(simbolosMercado.value);avisoPrecios.value=''}catch {avisoPrecios.value='Sin respaldo CoinGecko; esperando cotizaciones en vivo'}}
}
async function actualizar(){await cargar(true)}
async function seleccionar(o:OperacionSpot){
  actual.value=o; modalJson.value=true; verJson.value=false; cargandoDetalle.value=true
  try { const r=await detalleOperacion(o.PK,o.SK)
    if(actual.value?.PK===o.PK && actual.value?.SK===o.SK && r.operacion) actual.value=r.operacion
  } catch { /* conservamos datos de la lista */ }
  finally { cargandoDetalle.value=false }
}
function cerrarDetalle(){modalJson.value=false;verJson.value=false}
function tecla(e:KeyboardEvent){if(e.key==='Escape'&&modalJson.value)cerrarDetalle()}

function siguiente(){if(!siguienteCursor.value)return;historico.value.push(cursor.value);cursor.value=siguienteCursor.value;void cargar()}
function anterior(){cursor.value=historico.value.pop()||'';void cargar()}
function limpiar(){suscriptor.value='';estado.value='';exchange.value='';simbolo.value='';buscar.value='';desde.value='';hasta.value=''}
watch(tamanioPagina,()=>{void cargar(true)})
const jsonActual=computed(()=>JSON.stringify(actual.value,null,2))
function copiarJson(){void navigator.clipboard?.writeText(jsonActual.value)}
const tp=(o:OperacionSpot)=>[1,2,3].map(i=>({i,precio:Number(o[`tp${i}Price`]),cantidad:Number(o[`tp${i}Quantity`]),id:o[`tp${i}OrderId`]})).filter(x=>Number.isFinite(x.precio)&&x.precio>0&&Number.isFinite(x.cantidad)&&x.cantidad>0)
// Proyeccion bruta de cada Take Profit. Es un escenario hipotetico, NO una venta confirmada.
const gananciaTp=(o:OperacionSpot,i:number):number|null=>{
  if (!esCompra(o)) return null
  const t=tp(o).find(x=>x.i===i)
  const entrada=Number(o.buyPrice)
  if(!t||!Number.isFinite(entrada)||entrada<=0||!Number.isFinite(t.precio)||!Number.isFinite(t.cantidad)||t.cantidad<=0) return null
  return (t.precio-entrada)*t.cantidad
}
const totalTp=(o:OperacionSpot):number|null=>{
  if(!esCompra(o))return null
  const metas=tp(o)
  if(!metas.length)return null
  const compra=Number(o.quantity)
  const totalCantidad=metas.reduce((s,t)=>s+t.cantidad,0)
  // Si el plan reparte mas que la compra, no sumar una proyeccion inconsistente.
  if(!Number.isFinite(compra)||compra<=0||totalCantidad>compra+1e-8)return null
  const valores=metas.map(t=>gananciaTp(o,t.i))
  return valores.every(v=>v!==null)?valores.reduce<number>((s,v)=>s+(v??0),0):null
}
watch(actual,(v)=>{if(!v)cerrarDetalle()})
onMounted(()=>{window.addEventListener('keydown',tecla);void actualizar()})
onUnmounted(()=>{dejarPrecios?.();window.removeEventListener('keydown',tecla)})
</script>
<template>
  <div class="space-y-4 text-[#102c37]">
    <header><h2 class="text-2xl font-bold">Operaciones</h2><p class="text-sm text-slate-500">Compras Spot y órdenes registradas por suscriptor en DynamoDB. Precios Binance Spot en vivo (respaldo CoinGecko).</p></header>
    <p class="text-xs text-slate-500">Cotizaciones WebSocket: {{ estadoCotizaciones }} · Referencia Binance Spot, no necesariamente igual al exchange de ejecución.</p>
    <div v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error }} <button class="ml-3 underline" @click="actualizar">Reintentar</button></div>
    <section class="rounded-2xl border border-[#e0e9e6] bg-white p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">Filtros de búsqueda</h3><p class="text-xs text-slate-500">Selección inmediata · Se aplican a los registros cargados</p></div><div class="flex items-center gap-2"><button type="button" :disabled="cargando" class="inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-60" @click="actualizar"><span aria-hidden="true">↻</span>{{ cargando ? 'Actualizando...' : 'Actualizar' }}</button><button type="button" class="inline-flex h-9 min-w-[90px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400" @click="limpiar">Limpiar</button></div></div>
      <div class="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-7">
        <label class="text-xs text-slate-500">Suscriptor<select v-model="suscriptor" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">Todos</option><option v-for="v in opciones('suscriptor')" :key="v">{{v}}</option></select></label>
        <label class="text-xs text-slate-500">Estado<select v-model="estado" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">Todos</option><option v-for="v in opciones('estado')" :key="v">{{v}}</option></select></label>
        <label class="text-xs text-slate-500">Exchange<select v-model="exchange" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">Todos</option><option v-for="v in opciones('exchange')" :key="v">{{v}}</option></select></label>
        <label class="text-xs text-slate-500">Símbolo<select v-model="simbolo" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="">Todos</option><option v-for="v in opciones('simbolo')" :key="v">{{v}}</option></select></label>
        <label class="text-xs text-slate-500">Desde<input v-model="desde" type="date" class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"/></label>
        <label class="text-xs text-slate-500">Hasta<input v-model="hasta" type="date" class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"/></label>
        <label class="text-xs text-slate-500">Buscar<input v-model="buscar" placeholder="ID, símbolo, suscriptor..." class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"/></label>
      </div>
    </section>
    <div class="min-w-0">
      <section class="min-w-0 overflow-hidden rounded-2xl border border-[#e0e9e6] bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h3 class="font-semibold">Historial de operaciones</h3><p class="text-xs text-slate-500">{{visibles.length}} visibles · {{filas.length}} cargadas · seleccionar fila para detalle · tabla con desplazamiento interno</p></div><span v-if="cargando" class="text-xs text-slate-500">Cargando...</span></div>
                <div class="h-[420px] overflow-auto overscroll-contain" role="region" aria-label="Tabla de operaciones, desplazar horizontalmente para ver más columnas" tabindex="0">
          <table class="w-[1880px] min-w-full table-fixed text-left text-xs">
            <colgroup>
              <col style="width:112px"/><col style="width:98px"/><col style="width:194px"/><col style="width:100px"/><col style="width:77px"/><col style="width:84px"/><col style="width:112px"/><col style="width:125px"/><col style="width:115px"/><col style="width:130px"/><col style="width:134px"/><col style="width:96px"/><col style="width:121px"/><col style="width:121px"/><col style="width:135px"/><col style="width:126px"/>
            </colgroup>
            <thead class="sticky top-0 z-20 bg-[#f1f6f5] text-slate-600"><tr>
              <th scope="col" class="sticky left-0 z-30 border-r border-emerald-100 bg-[#e8f5f0] px-2 py-3 font-bold text-emerald-900">Activo</th>
              <th scope="col" class="sticky left-[112px] z-30 border-r border-emerald-100 bg-[#e8f5f0] px-2 py-3 font-semibold">Suscriptor</th>
              <th v-for="c in ['Fecha','Exchange','Tipo','Cantidad','P. compra','Invertido USD','P. mercado','Valor actual USD','PnL no realizado','ROI %','TP1 potencial','TP2 potencial','TP total potencial','Estado']" :key="c" scope="col" class="whitespace-nowrap px-2 py-3" :class="c==='P. mercado'?'border-x border-amber-200 bg-amber-100 font-bold text-amber-900':c==='PnL no realizado'||c==='ROI %'?'font-bold text-slate-800':''">{{c}}</th>
            </tr></thead>
            <tbody>
              <tr v-for="o in visibles" :key="o.PK+'|'+o.SK" class="group cursor-pointer border-t border-slate-100 hover:bg-emerald-50" tabindex="0" @click="seleccionar(o)" @keydown.enter.prevent="seleccionar(o)" @keydown.space.prevent="seleccionar(o)">
                <td class="sticky left-0 z-10 truncate border-r border-emerald-100 bg-white px-2 py-3 font-bold text-emerald-800 group-hover:bg-emerald-50" :title="o.symbol">{{o.symbol||'—'}}</td>
                <td class="sticky left-[112px] z-10 truncate border-r border-emerald-100 bg-white px-2 py-3 font-semibold text-slate-700 group-hover:bg-emerald-50">{{sub(o)}}</td>
                <td class="whitespace-nowrap px-2 py-3" :title="fecha(o.createdAt)">{{fecha(o.createdAt)}}</td>
                <td class="truncate px-2 py-3" :title="o.exchangeId||''">{{o.exchangeId||'—'}}</td>
                <td class="px-2 py-3">{{orden(o)}}</td>
                <td class="whitespace-nowrap px-2 py-3 tabular-nums">{{num(o.quantity)}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right tabular-nums">{{divisa(o.buyPrice)}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">{{divisa(montousd(o))}}</td>
                <td class="whitespace-nowrap border-x border-amber-100 bg-amber-50/70 px-2 py-3 text-right font-semibold text-amber-900 tabular-nums">{{divisa(precio(o))}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">{{esCompra(o)?divisa(valorActual(o)):'—'}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right font-bold tabular-nums" :class="pnlNoRealizado(o)===null||!esCompra(o)?'text-slate-400':(pnlNoRealizado(o)??0)<0?'text-red-700':'text-emerald-700'">{{esCompra(o)?divisa(pnlNoRealizado(o)):'—'}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right font-bold tabular-nums" :class="roiNoRealizado(o)===null||!esCompra(o)?'text-slate-400':(roiNoRealizado(o)??0)<0?'text-red-700':'text-emerald-700'">{{esCompra(o)&&roiNoRealizado(o)!==null?num(roiNoRealizado(o),2)+'%':'—'}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums" :class="gananciaTp(o,1)===null?'text-slate-400':(gananciaTp(o,1)??0)<0?'text-red-700':'text-emerald-700'">{{divisa(gananciaTp(o,1))}}</td>
                <td class="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums" :class="gananciaTp(o,2)===null?'text-slate-400':(gananciaTp(o,2)??0)<0?'text-red-700':'text-emerald-700'">{{divisa(gananciaTp(o,2))}}</td>
                <td class="whitespace-nowrap bg-emerald-50/50 px-2 py-3 text-right font-bold tabular-nums" :class="totalTp(o)===null?'text-slate-400':(totalTp(o)??0)<0?'text-red-700':'text-emerald-800'">{{divisa(totalTp(o))}}</td>
                <td class="px-2 py-3"><span class="inline-block max-w-full truncate rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800" :title="o.status">{{o.status||'—'}}</span></td>
              </tr>
              <tr v-if="!visibles.length"><td colspan="16" class="p-8 text-center text-slate-500">No hay operaciones que coincidan con los filtros.</td></tr>
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1"><span class="font-medium">{{visibles.length}} visibles · Página {{historico.length+1}}</span><span class="text-slate-400">{{avisoPrecios||'Mercado: precios indicativos'}}</span></div>
          <div class="flex items-center gap-2"><label for="lerabot-operaciones-tamanio" class="text-slate-500">Filas</label><select id="lerabot-operaciones-tamanio" v-model.number="tamanioPagina" :disabled="cargando" class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700" aria-label="Filas por página"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select><button type="button" :disabled="!historico.length||cargando" class="h-9 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" @click="anterior">← Anterior</button><span class="grid h-9 min-w-9 place-items-center rounded-lg bg-emerald-600 px-2 font-bold text-white">{{historico.length+1}}</span><button type="button" :disabled="!siguienteCursor||cargando" class="h-9 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" @click="siguiente">Siguiente →</button></div>
        </footer>
      </section>
    </div>
    <p class="text-xs text-amber-700">Solo lectura. Las ganancias TP son proyecciones brutas hipotéticas; no representan ventas ejecutadas, ganancias realizadas ni descuentan comisiones. Los filtros y los cálculos de la tabla actúan sobre la página cargada; no representan el saldo consolidado de los exchanges.</p>
    <div v-if="modalJson && actual" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-6" @click.self="cerrarDetalle">
      <section role="dialog" aria-modal="true" aria-label="Detalle de operación" class="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white p-5">
          <div class="space-y-1"><p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Detalle de operaci.n . Solo lectura</p><h3 class="text-xl font-bold">{{actual.symbol || 'Operación'}} <span class="text-sm font-normal text-slate-500">· {{sub(actual)}} · {{actual.exchangeId}}</span></h3><p class="text-xs text-slate-500">{{fecha(actual.createdAt)}} · {{actual.operationId}}</p></div>
          <div class="flex items-center gap-3"><span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{{actual.status || 'Sin estado'}}</span><button type="button" class="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100" aria-label="Cerrar detalle" @click="cerrarDetalle">✕</button></div>
        </header>
        <div class="flex gap-2 border-b border-slate-100 px-5 py-3"><button type="button" class="rounded-lg px-3 py-2 text-sm font-semibold" :class="!verJson?'bg-emerald-100 text-emerald-800':'text-slate-600 hover:bg-slate-100'" @click="verJson=false">Resumen y take profits</button><button type="button" class="rounded-lg px-3 py-2 text-sm font-semibold" :class="verJson?'bg-emerald-100 text-emerald-800':'text-slate-600 hover:bg-slate-100'" @click="verJson=true">JSON original</button><span v-if="cargandoDetalle" class="ml-auto self-center text-xs text-slate-500">Consultando detalle...</span></div>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <template v-if="!verJson">
            <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">Precio de entrada</p><p class="mt-1 text-base font-bold">{{divisa(actual.buyPrice)}}</p></div>
              <div class="rounded-xl border border-amber-200 bg-amber-50 p-3"><p class="text-xs font-semibold text-amber-800">Precio de Mercado</p><p class="mt-1 text-base font-bold text-amber-950">{{divisa(precio(actual))}}</p></div>
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">Cantidad</p><p class="mt-1 text-base font-bold">{{num(actual.quantity)}} {{actual.symbol?.replace('USDT','')}}</p></div>
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">Valor de compra</p><p class="mt-1 text-base font-bold">{{divisa(montousd(actual))}}</p></div>
            </div>
            <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">Valor actual estimado</p><p class="mt-1 font-bold">{{divisa(valorActual(actual))}}</p></div>
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">PnL no realizado</p><p class="mt-1 font-bold" :class="(pnlNoRealizado(actual)||0)<0?'text-red-700':'text-emerald-700'">{{divisa(pnlNoRealizado(actual))}}</p></div>
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">ROI no realizado</p><p class="mt-1 font-bold">{{roiNoRealizado(actual)===null?'—':num(roiNoRealizado(actual),2)+'%'}}</p></div>
              <div class="rounded-xl border border-slate-200 p-3"><p class="text-xs text-slate-500">Target / TP1</p><p class="mt-1 font-bold">{{tp(actual).length?divisa(tp(actual)[0]?.precio):'—'}}</p></div>
            </div>
            <div class="grid gap-5 lg:grid-cols-2">
              <div class="rounded-xl border border-slate-200 p-4"><h4 class="mb-3 font-semibold">Información registrada</h4><dl class="space-y-2 text-sm"><div v-for="[k,v] in [['Suscriptor',sub(actual)],['Exchange',actual.exchangeId],['Tipo',orden(actual)+' · '+(actual.tradeType||'—')],['Tipo de orden',actual.buyOrderType],['Orden de compra',actual.buyOrderId],['Señal',actual.signalId],['Operación',actual.operationId],['Variación indicativa',diferencial(actual)===null?'No disponible':num(diferencial(actual),2)+'%']]" :key="String(k)" class="flex justify-between gap-3 border-b border-slate-100 pb-2"><dt class="shrink-0 text-slate-500">{{k}}</dt><dd class="min-w-0 break-all text-right font-medium">{{v||'—'}}</dd></div></dl></div>
              <div class="rounded-xl border border-slate-200 p-4"><h4 class="mb-3 font-semibold">Órdenes Take Profit</h4><div v-if="tp(actual).length" class="space-y-2"><div v-for="t in tp(actual)" :key="t.i" class="rounded-lg border border-slate-100 bg-slate-50 p-3"><div class="flex items-center justify-between"><span class="font-semibold">TP{{t.i}}</span><span class="text-sm font-bold">{{divisa(t.precio)}}</span></div><p class="mt-1 text-xs text-slate-500">Cantidad: {{num(t.cantidad)}} · Orden: {{t.id||'—'}}</p><p class="mt-2 text-sm font-semibold" :class="(gananciaTp(actual,t.i)??0)<0?'text-red-700':'text-emerald-700'">Ganancia potencial bruta: {{divisa(gananciaTp(actual,t.i))}}</p></div><div v-if="totalTp(actual)!==null" class="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3"><span class="text-sm font-semibold text-emerald-900">Total potencial bruto (TP)</span><strong class="text-emerald-900">{{divisa(totalTp(actual))}}</strong></div></div><p v-else class="text-sm text-slate-500">No hay objetivos TP en este registro.</p><p class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Escenario hipotético: (precio TP - entrada) × cantidad TP. No incluye comisiones ni deslizamiento; una orden PLACED NO significa venta ejecutada.</p></div>
            </div>
            <p class="mt-4 text-xs text-slate-500">El precio de Mercado es una referencia actual; su diferencia respecto a la entrada no constituye PnL realizado.</p>
          </template>
          <template v-else><div class="mb-2 flex items-center justify-between"><p class="text-sm text-slate-600">Documento completo de DynamoDB</p><button type="button" class="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" @click="copiarJson">Copiar JSON</button></div><pre class="max-h-[58vh] overflow-auto rounded-xl bg-[#102934] p-4 text-xs leading-relaxed text-emerald-100">{{jsonActual}}</pre></template>
        </div>
        <footer class="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-xs text-slate-500"><span>Esc para cerrar · Datos obtenidos desde DynamoDB</span><button class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100" @click="cerrarDetalle">Cerrar</button></footer>
      </section>
    </div>
  </div>
</template>
