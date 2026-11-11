<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listarOperaciones } from '../operaciones/servicio'
import type { OperacionSpot } from '../operaciones/tipos'
import OperacionesView from '../operaciones/OperacionesView.vue'
import { sesionDemo } from '../login/sesionDemo'

// Resumen historico desde registros: NO es balance disponible ni posiciones abiertas.
const sesion = sesionDemo()
const esAdmin = sesion?.rol === 'ADMIN'
const idPropio = sesion?.rol === 'SUBSCRIBER' ? sesion.subscriberId || '' : ''
const filas = ref<OperacionSpot[]>([])
const selector = ref('')
const cargando = ref(false)
const error = ref('')
const parcial = ref(false)
const configurando = ref('')
const apiKey = ref('')
const secretKey = ref('')
const mostrarSecreto = ref(false)
const avisoDemo = ref('')
const tab = ref<'resumen' | 'operaciones'>('resumen')
const moneda = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n)
const sub = (o: OperacionSpot) => /^SUB#([^#]+)/.exec(o.PK)?.[1] || ''
const exchange = (o: OperacionSpot) => String(o.exchangeId || '').trim().toLowerCase()
const usuarios = computed(() => Array.from(new Set(filas.value.map(sub).filter(Boolean))).sort())
const mias = computed(() => filas.value.filter(o => (!idPropio || sub(o).toLowerCase() === idPropio.toLowerCase()) && (!esAdmin || !selector.value || sub(o) === selector.value)))
const resumen = computed(() => {
  const mapa = new Map<string, {nombre:string,ordenes:number,simbolos:Set<string>,comprasUsd:number,ventasUsd:number}>()
  for (const o of mias.value) {
    const clave = exchange(o)
    if (!clave) continue
    if (!mapa.has(clave)) mapa.set(clave,{nombre:clave,ordenes:0,simbolos:new Set(),comprasUsd:0,ventasUsd:0})
    const r = mapa.get(clave)!
    r.ordenes++
    if (o.symbol) r.simbolos.add(String(o.symbol).toUpperCase())
    const precio = Number(o.buyPrice), cantidad = Number(o.quantity)
    if (Number.isFinite(precio) && precio>0 && Number.isFinite(cantidad) && cantidad>0) {
      if (String(o.side).toUpperCase()==='BUY') r.comprasUsd += precio*cantidad
      if (String(o.side).toUpperCase()==='SELL') r.ventasUsd += precio*cantidad // Puede ser precio de entrada, no ejecucion
    }
  }
  return [...mapa.values()].sort((a,b)=>b.ordenes-a.ordenes)
})
const totalCompras = computed(()=>resumen.value.reduce((a,x)=>a+x.comprasUsd,0))
async function cargar() {
  cargando.value=true;error.value='';parcial.value=false
  try {
    let cursor = '';const todos:OperacionSpot[]=[]
    // Limite defensivo: evita scans ilimitados. Indicar siempre truncamiento.
    for(let i=0;i<10;i++) {
      const r = await listarOperaciones({limite:'100', ...(cursor?{cursor}:{})})
      todos.push(...(r.operaciones||[]))
      if(r.parcial) parcial.value=true
      if(!r.siguienteCursor) {cursor='';break}
      cursor=r.siguienteCursor
    }
    if(cursor) parcial.value=true
    filas.value=todos
  } catch(e) {error.value=e instanceof Error?e.message:'No fue posible consultar las operaciones';filas.value=[]}
  finally {cargando.value=false}
}
function abrir(nombre:string) { configurando.value=nombre;apiKey.value='';secretKey.value='';avisoDemo.value='';mostrarSecreto.value=false }
function cerrar() {configurando.value='';apiKey.value='';secretKey.value='';mostrarSecreto.value=false}
function revisar() {avisoDemo.value='Formulario de demostracion validado. Las claves NO se guardaron ni enviaron. Para una conexion real se requiere almacenamiento cifrado en backend, autenticacion y permisos de solo lectura.';apiKey.value='';secretKey.value=''}
onMounted(()=>{void cargar()})
</script>
<template>
  <section class="space-y-5 text-[#102c37]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h1 class="text-2xl font-extrabold">Exchanges y operaciones</h1><p class="mt-1 text-sm text-slate-500">Plataformas identificadas a partir de las operaciones registradas en DynamoDB.</p></div>
      <button class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="cargando" @click="cargar">{{ cargando?'Consultando...':'↻ Actualizar registros' }}</button>
    </div>
    <p class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Los importes son compras historicas registradas, NO saldos disponibles, valorizacion actual, ni sincronizacion bancaria. Las operaciones pueden estar paginadas o incompletas.</p>
    <div v-if="esAdmin" class="rounded-xl border bg-white p-4"><label class="text-sm font-semibold" for="exchange-suscriptor">Vista administrativa · Suscriptor</label><select id="exchange-suscriptor" v-model="selector" class="mt-2 block w-full max-w-sm rounded-lg border p-2 text-sm"><option value="">Todos los suscriptores</option><option v-for="id in usuarios" :key="id" :value="id">{{ id }}</option></select><p class="mt-1 text-xs text-slate-500">Filtro del resumen cargado. La tabla de operaciones mantiene su propio filtro.</p></div>
    <div class="grid gap-3 sm:grid-cols-3">
      <article class="rounded-2xl border bg-white p-5"><p class="text-xs text-slate-500">Exchanges con operaciones</p><p class="text-2xl font-bold">{{ resumen.length }}</p></article>
      <article class="rounded-2xl border bg-white p-5"><p class="text-xs text-slate-500">Registros consultados</p><p class="text-2xl font-bold">{{ mias.length }}</p></article>
      <article class="rounded-2xl border bg-white p-5"><p class="text-xs text-slate-500">Compras historicas registradas</p><p class="text-2xl font-bold">{{ moneda(totalCompras) }}</p><p class="text-xs text-slate-500">No es balance disponible</p></article>
    </div>
    <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{{ error }}</p>
    <p v-if="parcial" role="status" class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Consulta parcial: el resumen solo considera los registros recibidos (maximo 1000). No equivale a un total historico garantizado.</p>
    <div class="flex gap-2 border-b pb-2"><button class="rounded-lg px-4 py-2 text-sm" :class="tab==='resumen'?'bg-emerald-600 text-white':'bg-white border'" @click="tab='resumen'">Mis exchanges</button><button class="rounded-lg px-4 py-2 text-sm" :class="tab==='operaciones'?'bg-emerald-600 text-white':'bg-white border'" @click="tab='operaciones'">Historial de operaciones</button></div>
    <div v-if="tab==='resumen'">
      <div v-if="!resumen.length" class="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">No hay exchanges con operaciones registradas para esta seleccion.</div>
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="r in resumen" :key="r.nombre" class="rounded-2xl border bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between"><div class="flex items-center gap-3"><div class="grid size-11 place-items-center rounded-xl bg-emerald-50 text-lg font-extrabold uppercase text-emerald-700">{{r.nombre.slice(0,1)}}</div><h2 class="text-lg font-bold capitalize">{{r.nombre}}</h2></div><span class="rounded-full bg-slate-100 px-2 py-1 text-[11px]">Sin API vinculada</span></div>
          <p class="mt-4 text-xs text-slate-500">Compras historicas</p><p class="text-2xl font-bold">{{ moneda(r.comprasUsd) }}</p>
          <p class="mt-2 text-xs text-slate-500">{{r.ordenes}} registros · {{r.simbolos.size}} pares distintos</p>
          <p class="mt-1 break-words text-xs text-slate-500">{{ [...r.simbolos].join(', ') }}</p>
          <button class="mt-4 w-full rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" @click="abrir(r.nombre)">Configurar conexion API</button>
        </article>
      </div>
    </div>
    <div v-else><OperacionesView /></div>
    <div v-if="configurando" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4" @click.self="cerrar">
      <section role="dialog" aria-modal="true" aria-label="Configuracion de exchange" class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div class="flex justify-between gap-3"><h2 class="text-xl font-bold">Configurar {{ configurando }}</h2><button aria-label="Cerrar" @click="cerrar">✕</button></div>
        <p class="mt-2 text-sm text-slate-600">Conexion futura para consulta de operaciones y balances. No se habilitan ordenes, retiros ni trading automatico.</p>
        <p class="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">DEMO: no introduzcas claves reales. Este formulario no las guarda ni envia. Una integracion real requiere un backend cifrado, autenticacion y claves de solo lectura, sin permiso de trading o retiro.</p>
        <form class="mt-4 space-y-3" @submit.prevent="revisar"><label class="block text-sm">API_KEY<input v-model="apiKey" type="password" autocomplete="off" placeholder="Solo valor ficticio de prueba" class="mt-1 w-full rounded-lg border p-3" /></label><label class="block text-sm">SECRET_KEY<div class="mt-1 flex gap-2"><input v-model="secretKey" :type="mostrarSecreto?'text':'password'" autocomplete="off" placeholder="Solo valor ficticio de prueba" class="min-w-0 flex-1 rounded-lg border p-3" /><button type="button" class="rounded-lg border px-3 text-xs" @click="mostrarSecreto=!mostrarSecreto">{{mostrarSecreto?'Ocultar':'Ver'}}</button></div></label><p v-if="avisoDemo" role="status" class="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{{ avisoDemo }}</p><div class="flex justify-end gap-2"><button type="button" class="rounded-lg border px-4 py-2" @click="cerrar">Cerrar</button><button type="submit" class="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Validar formulario (demo)</button></div></form>
      </section>
    </div>
  </section>
</template>
