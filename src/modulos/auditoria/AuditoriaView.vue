<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listarEventos, leerEvento } from './servicio'
import type { EventoAuditoria } from './tipos'

const zona = 'America/Lima'
const diaLima = (fecha = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha)
  const dato = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${dato('year')}-${dato('month')}-${dato('day')}`
}
const hoy = diaLima()
const fechaInicio = ref(hoy)
const fechaFin = ref(hoy)
const periodo = ref<'hoy'|'ayer'|'rango'|'todos'>('hoy')
const selectorPeriodoAbierto = ref(false)
const fechaHoyActual = ref(hoy)
const estado = ref('')
const fuente = ref('')
const simbolo = ref('')
const mercado = ref('')
const eventos = ref<EventoAuditoria[]>([])
const cargando = ref(false)
const error = ref('')
const truncado = ref(false)
const ultimaActualizacion = ref<Date | null>(null)
const seleccion = ref<EventoAuditoria | null>(null)
const cargandoDetalle = ref(false)
const pagina = ref(1)
const porPagina = 25
const maxEventos = 1200
let activo = true
let temporizador: ReturnType<typeof setInterval> | undefined

const fechaLocal = (v: unknown) => {
  if (!v) return ''
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? '' : diaLima(d)
}
const fechaTexto = (v: unknown) => {
  if (!v) return '—'
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { timeZone: zona, dateStyle:'short', timeStyle:'medium' })
}
const estadoGrupo = (e: EventoAuditoria) => {
  const s = String(e.status ?? '').toUpperCase()
  if (s.includes('REJECT') || s.includes('FAIL') || s.includes('ERROR')) return 'RECHAZADA'
  if (s.includes('ROUTED') || s.includes('PASS_RULES')) return 'ENRUTADA'
  if (s === 'SUCCESS' || s.includes('EXECUTED') || s === 'COMPLETED') return 'EXITOSA'
  return 'OTROS'
}
const tipoEstado = (e: EventoAuditoria) => ({ RECHAZADA:'bg-red-50 text-red-700', ENRUTADA:'bg-amber-50 text-amber-700', EXITOSA:'bg-emerald-50 text-emerald-700', OTROS:'bg-slate-100 text-slate-600' })[estadoGrupo(e)]
const diaAnterior = (dia: string) => {
  const [anio, mes, fecha] = dia.split('-').map(Number)
  return new Date(Date.UTC(anio!, mes! - 1, fecha! - 1, 12)).toISOString().slice(0, 10)
}
const limitesPeriodo = computed(() => {
  if (periodo.value === 'todos') return { desde: '', hasta: '' }
  if (periodo.value === 'hoy') return { desde: fechaHoyActual.value, hasta: fechaHoyActual.value }
  if (periodo.value === 'ayer') {
    const ayer = diaAnterior(fechaHoyActual.value)
    return { desde: ayer, hasta: ayer }
  }
  return { desde: fechaInicio.value, hasta: fechaFin.value }
})
const periodoTexto = computed(() => {
  if (periodo.value === 'todos') return 'Todo el histórico consultado'
  const { desde, hasta } = limitesPeriodo.value
  const mostrar = (f: string) => f ? f.split('-').reverse().join('/') : 'Sin fecha'
  return desde === hasta ? mostrar(desde) : `${mostrar(desde)} – ${mostrar(hasta)}`
})
const enFecha = computed(() => eventos.value.filter(e => {
  const fecha = fechaLocal(e.createdAt)
  const { desde, hasta } = limitesPeriodo.value
  return Boolean(fecha) && (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
}))
function elegirPeriodo(p: 'hoy'|'ayer'|'rango'|'todos') {
  const actual = limitesPeriodo.value
  if (p === 'rango') { fechaInicio.value = actual.desde || fechaHoyActual.value; fechaFin.value = actual.hasta || fechaHoyActual.value }
  periodo.value = p
  if (p !== 'rango') selectorPeriodoAbierto.value = false
  pagina.value = 1
}
function aplicarRango() {
  if (!fechaInicio.value || !fechaFin.value || fechaInicio.value > fechaFin.value) return
  periodo.value = 'rango'
  selectorPeriodoAbierto.value = false
  pagina.value = 1
}
const resumen = computed(() => {
  const lista = enFecha.value
  const contar = (tipo: string) => lista.filter(e => estadoGrupo(e) === tipo).length
  return { total:lista.length, rechazadas:contar('RECHAZADA'), enrutadas:contar('ENRUTADA'), exitosas:contar('EXITOSA'), otros:contar('OTROS') }
})
const opciones = (campo: 'source'|'tradeType') => [...new Set(enFecha.value.map(e => String(e[campo] ?? '')).filter(Boolean))].sort()
const fuentes = computed(() => opciones('source'))
const mercados = computed(() => opciones('tradeType'))
const simbolos = computed(() => [...new Set(enFecha.value.map(e => String(e.symbol ?? '').replace(/\.P$/i,'')).filter(Boolean))].sort())
const visibles = computed(() => enFecha.value.filter(e => {
  if (estado.value && estadoGrupo(e) !== estado.value) return false
  if (fuente.value && String(e.source ?? '') !== fuente.value) return false
  if (mercado.value && String(e.tradeType ?? '') !== mercado.value) return false
  if (simbolo.value && String(e.symbol ?? '').replace(/\.P$/i,'') !== simbolo.value) return false
  return true
}))
const ordenados = computed(() => [...visibles.value].sort((a,b) => {
  const ta = Date.parse(String(a.createdAt ?? ''))
  const tb = Date.parse(String(b.createdAt ?? ''))
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
}))
const totalPaginas = computed(() => Math.max(1, Math.ceil(ordenados.value.length/porPagina)))
const paginaEventos = computed(() => ordenados.value.slice((pagina.value-1)*porPagina, pagina.value*porPagina))
const barras = computed(() => [
  {label:'Estado exitoso',n:resumen.value.exitosas,color:'#059669'},
  {label:'Enrutadas',n:resumen.value.enrutadas,color:'#d97706'},
  {label:'Rechazadas',n:resumen.value.rechazadas,color:'#dc2626'},
  {label:'Otros',n:resumen.value.otros,color:'#64748b'}
])
const percent = (n:number) => resumen.value.total ? Math.round(n*100/resumen.value.total) : 0
const ejecucion = (e: EventoAuditoria) => {
  if (e.executed === true || String(e.executed).toLowerCase() === 'true') return 'Ejecución indicada'
  if (e.executed === false || String(e.executed).toLowerCase() === 'false') return 'Sin ejecución'
  if (String(e.stage ?? '').toUpperCase().includes('EXECUTED')) return 'Etapa ejecutada'
  return 'No informada'
}
// Diagnostico operativo: usa datos registrados, nunca infiere una orden ejecutada por ROUTED.
const objetoSeguro = (dato: unknown): Record<string, unknown> => {
  if (dato && typeof dato === 'object' && !Array.isArray(dato)) return dato as Record<string, unknown>
  if (typeof dato === 'string') {
    try { const valor: unknown = JSON.parse(dato); if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown> } catch { /* detalle no JSON */ }
  }
  return {}
}
const texto = (v: unknown) => v === null || v === undefined ? '' : String(v).trim()
const diagnostico = computed(() => {
  const e = seleccion.value
  if (!e) return null
  const details = objetoSeguro(e.details)
  const payload = objetoSeguro(e.payload)
  const estado = texto(e.status).toUpperCase()
  const reasonCode = texto(e.reasonCode || details.reasonCode || payload.reasonCode || details.rejectReason || details.errorCode || payload.errorCode)
  const mensaje = texto(e.message || details.message || details.reason || payload.message || payload.reason)
  const etapa = texto(e.stage || details.stage || payload.stage || e.eventType)
  const ejec = e.executed === true || texto(e.executed).toLowerCase() === 'true'
  const noEjec = e.executed === false || texto(e.executed).toLowerCase() === 'false'
  let titulo = 'Evento recibido'
  let explicacion = 'Se registro un evento. Verifica los detalles para conocer su resultado.'
  let estilo = 'border-slate-200 bg-slate-50 text-slate-800'
  if (estado.includes('REJECT') || estado.includes('FAIL') || estado.includes('ERROR')) {
    titulo = 'Senal rechazada o fallida'
    explicacion = 'No supero una validacion o termino con error. Revisa el motivo registrado y la etapa.'
    estilo = 'border-red-200 bg-red-50 text-red-900'
  } else if (estado.includes('ROUTED') || estado.includes('PASS_RULES')) {
    titulo = 'Senal validada y enrutada'
    explicacion = 'Paso las reglas y fue enviada al ejecutor. No confirma que BingX u otro exchange haya ejecutado la orden.'
    estilo = 'border-amber-200 bg-amber-50 text-amber-900'
  } else if (estado === 'SUCCESS' || estado.includes('EXECUTED') || estado === 'COMPLETED') {
    titulo = 'Proceso reportado como exitoso'
    explicacion = 'El componente informo exito; verifica executed, tradesCount y la confirmacion del exchange antes de considerarlo una orden ejecutada.'
    estilo = 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }
  const confirmacion = ejec ? 'executed=true (declarado por el evento)' : noEjec ? 'executed=false (sin ejecucion reportada)' : 'No existe confirmacion de ejecucion en este evento'
  return { titulo, explicacion, estilo, reasonCode, mensaje, etapa, confirmacion }
})
const verJsonTecnico = ref(false)
const detalleJSON = computed(() => seleccion.value ? JSON.stringify(seleccion.value, null, 2) : '')
async function actualizar() {
  if (cargando.value) return
  cargando.value = true; error.value = ''; truncado.value = false
  try {
    const lista: EventoAuditoria[] = []
    const cursores = new Set<string>()
    let cursor = ''
    let siguiente = ''
    do {
      const r = await listarEventos({limite:'100', ...(cursor ? {cursor} : {})})
      lista.push(...(r.eventos ?? []))
      siguiente = r.siguienteCursor ?? ''
      if (siguiente && cursores.has(siguiente)) throw new Error('Paginación repetida por API')
      if (siguiente) cursores.add(siguiente)
      cursor = siguiente
    } while (siguiente && lista.length < maxEventos)
    truncado.value = Boolean(siguiente)
    // Scan de DynamoDB NO garantiza orden; se ordena después de obtener los registros.
    eventos.value = lista.sort((a,b) => (Date.parse(String(b.createdAt ?? '')) || 0) - (Date.parse(String(a.createdAt ?? '')) || 0))
    fechaHoyActual.value = diaLima()
    pagina.value = 1
    ultimaActualizacion.value = new Date()
  } catch(e) { error.value = e instanceof Error ? e.message : 'No se pudieron consultar los eventos' }
  finally { cargando.value = false }
}
function limpiar() { estado.value='';fuente.value='';simbolo.value='';mercado.value='';pagina.value=1 }
async function abrir(e: EventoAuditoria) {
  verJsonTecnico.value = false;
  seleccion.value = e; cargandoDetalle.value = true
  try { const r = await leerEvento(e.PK,e.SK); if (seleccion.value?.PK === e.PK && seleccion.value?.SK === e.SK) seleccion.value = r.evento }
  catch { /* mostrar el registro cargado */ }
  finally { cargandoDetalle.value = false }
}
function cerrarEscape(e:KeyboardEvent) { if (e.key === 'Escape') seleccion.value = null }
function exportar() {
  const campos=['createdAt','status','source','eventType','symbol','tradeType','side','timeframe','executed','tradesCount','reasonCode','stage','message','operationId']
  const csv=[campos.join(','),...ordenados.value.map(e=>campos.map(c=>'"'+String(e[c] ?? '').replace(/"/g,'""')+'"').join(','))].join('\r\n')
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download='lerabot-auditoria-'+(limitesPeriodo.value.desde || 'historico')+'.csv';a.click();setTimeout(() => URL.revokeObjectURL(url), 1000)
}
onMounted(() => { activo = true; void actualizar(); window.addEventListener('keydown',cerrarEscape); temporizador=setInterval(() => { if (activo && document.visibilityState==='visible' && !seleccion.value && pagina.value===1 && periodo.value==='hoy') { fechaHoyActual.value = diaLima(); void actualizar() } },30000) })
onUnmounted(() => { activo=false;if(temporizador)clearInterval(temporizador);window.removeEventListener('keydown',cerrarEscape) })
</script>

<template>
  <section class="space-y-3 text-[#17313d]">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><h2 class="text-2xl font-bold">Logs y Auditoría</h2><p class="text-sm text-slate-500">Seguimiento de validaciones y resultados del bot · Hora de Perú</p></div>
      <div class="flex items-center gap-3"><span class="text-xs text-slate-500">{{ ultimaActualizacion ? 'Actualizado: '+fechaTexto(ultimaActualizacion.toISOString()) : 'Sin actualizar' }}</span><button class="audit-primary" :disabled="cargando" @click="actualizar">{{cargando?'Consultando…':'↻ Actualizar'}}</button></div>
    </header>
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold text-slate-500">Período</span>
      <div class="relative">
        <button class="audit-secondary flex items-center gap-2" :aria-expanded="selectorPeriodoAbierto" @click="selectorPeriodoAbierto=!selectorPeriodoAbierto">
          <span>▦</span><span>{{ periodoTexto }}</span><span>▾</span>
        </button>
        <div v-if="selectorPeriodoAbierto" class="audit-date-popover space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <button class="audit-secondary" @click="elegirPeriodo('hoy')">Hoy</button>
            <button class="audit-secondary" @click="elegirPeriodo('ayer')">Ayer</button>
            <button class="audit-secondary col-span-2" @click="elegirPeriodo('todos')">Todo el histórico disponible</button>
          </div>
          <div class="border-t border-slate-100 pt-2">
            <p class="mb-2 text-xs font-bold">Rango personalizado</p>
            <div class="grid grid-cols-2 gap-2">
              <label class="audit-label">Desde<input v-model="fechaInicio" type="date" class="audit-input" /></label>
              <label class="audit-label">Hasta<input v-model="fechaFin" type="date" class="audit-input" /></label>
            </div>
            <p v-if="fechaInicio > fechaFin" class="mt-1 text-xs text-red-600">La fecha inicial no puede superar la final.</p>
            <button class="audit-primary mt-3 w-full" :disabled="!fechaInicio || !fechaFin || fechaInicio > fechaFin" @click="aplicarRango">Aplicar rango</button>
          </div>
        </div>
      </div>
      <span class="text-xs text-slate-500">{{ periodo==='hoy' ? 'Hoy · Perú · actualización cada 30 s' : 'Período aplicado a todos los registros consultados' }}</span>
      <span class="ml-auto text-xs text-slate-500">{{visibles.length}} visibles · {{ordenados.length}} filtrados</span>
    </div>
    <div class="grid grid-cols-2 gap-2 lg:grid-cols-5">
      <article class="audit-kpi"><span class="audit-kpi-label">Eventos</span><strong>{{resumen.total}}</strong><span>Período seleccionado</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Enrutadas</span><strong class="text-amber-600">{{resumen.enrutadas}}</strong><span>Envío, no ejecución confirmada</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Rechazadas</span><strong class="text-red-600">{{resumen.rechazadas}}</strong><span>Señales no aceptadas</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Éxito</span><strong class="text-emerald-600">{{resumen.exitosas}}</strong><span>Éxito del proceso; no confirma fill</span></article>
      <article class="audit-kpi col-span-2 lg:col-span-1"><span class="audit-kpi-label">Otros</span><strong>{{resumen.otros}}</strong><span>Estados adicionales</span></article>
    </div>
    <div v-if="truncado" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Se alcanzó el límite de {{maxEventos}} eventos consultados. Las cifras pueden ser parciales; para escala mayor hay que implementar un índice por fecha en DynamoDB.</div>
    <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{error}}</div>
    <div class="audit-panel p-3">
      <div class="mb-3 flex items-center justify-between"><h3 class="font-bold">Distribución por estado</h3><span class="text-xs text-slate-500">{{resumen.total}} eventos</span></div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div v-for="b in barras" :key="b.label"><div class="flex justify-between text-xs"><span>{{b.label}}</span><strong>{{b.n}} · {{percent(b.n)}}%</strong></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full transition-all" :style="{width:percent(b.n)+'%',background:b.color}"></div></div></div></div>
    </div>
    <div class="audit-panel p-3">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold">Filtros de eventos</h3><div class="flex gap-2"><button class="audit-secondary" @click="limpiar">Limpiar filtros</button><button class="audit-secondary" :disabled="!visibles.length" @click="exportar">↓ CSV</button></div></div>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><label class="audit-label">Estado<select v-model="estado" class="audit-input" @change="pagina=1"><option value="">Todos</option><option value="ENRUTADA">Enrutadas</option><option value="RECHAZADA">Rechazadas</option><option value="EXITOSA">Éxito</option><option value="OTROS">Otros</option></select></label><label class="audit-label">Fuente<select v-model="fuente" class="audit-input" @change="pagina=1"><option value="">Todas</option><option v-for="f in fuentes" :key="f">{{f}}</option></select></label><label class="audit-label">Símbolo<select v-model="simbolo" class="audit-input" @change="pagina=1"><option value="">Todos</option><option v-for="s in simbolos" :key="s">{{s}}</option></select></label><label class="audit-label">Mercado<select v-model="mercado" class="audit-input" @change="pagina=1"><option value="">Spot / Futures</option><option v-for="m in mercados" :key="m">{{m}}</option></select></label></div>
    </div>
    <div class="audit-panel overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 p-4"><div><h3 class="font-bold">Eventos del sistema</h3><p class="text-xs text-slate-500">Orden: fecha descendente · {{visibles.length}} registros del período · {{porPagina}} por página</p></div><span class="text-xs text-slate-500">{{pagina}} / {{totalPaginas}}</span></div>
      <div class="max-h-[560px] overflow-auto"><table class="min-w-[1000px] w-full text-left text-xs"><thead class="sticky top-0 z-10 bg-[#eff6f4] text-slate-600"><tr><th>Fecha (Perú)</th><th>Estado</th><th>Fuente</th><th>Señal / Acción</th><th>Símbolo</th><th>Mercado</th><th>Ejecución</th><th>Motivo / etapa</th><th></th></tr></thead><tbody><tr v-for="e in paginaEventos" :key="e.PK+'|'+e.SK" class="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/50" @click="abrir(e)"><td class="whitespace-nowrap">{{fechaTexto(e.createdAt)}}</td><td><span class="rounded-md px-2 py-1 font-semibold" :class="tipoEstado(e)">{{e.status ?? 'SIN ESTADO'}}</span></td><td>{{e.source||'—'}}</td><td>{{e.eventType||'—'}}<span class="block text-[11px] text-slate-500">{{e.side || '—'}} · {{e.timeframe ? e.timeframe+'m' : '—'}}</span></td><td class="font-semibold">{{e.symbol||'—'}}</td><td>{{e.tradeType||'—'}}</td><td>{{ejecucion(e)}}<span v-if="e.tradesCount!==undefined" class="block text-slate-500">{{e.tradesCount}} trades</span></td><td class="max-w-[220px] truncate" :title="String(e.message??'')">{{e.reasonCode || e.stage || e.message || '—'}}</td><td class="font-semibold text-emerald-700">Ver ↗</td></tr><tr v-if="!paginaEventos.length"><td colspan="9" class="py-10 text-center text-slate-500">{{cargando?'Consultando eventos…':'Sin eventos en la fecha o filtros seleccionados'}}</td></tr></tbody></table></div>
      <footer class="flex items-center justify-between gap-3 border-t border-slate-100 p-3"><span class="text-xs text-slate-500">El CSV incluye todos los eventos del período y filtros cargados</span><div class="flex gap-2"><button class="audit-secondary" :disabled="pagina<=1" @click="pagina--">Anterior</button><button class="audit-secondary" :disabled="pagina>=totalPaginas" @click="pagina++">Siguiente</button></div></footer>
    </div>
    <div v-if="seleccion" class="audit-backdrop" @click.self="seleccion=null">
      <section class="audit-modal" role="dialog" aria-modal="true" aria-label="Detalle de auditoría">
        <header class="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div><p class="text-xs font-bold uppercase tracking-wide text-emerald-700">Auditoría de trading</p><h3 class="text-lg font-bold">¿Qué ocurrió con esta señal?</h3><p class="break-all text-xs text-slate-500">{{ seleccion.eventId || seleccion.PK }}</p></div>
          <button class="audit-secondary" @click="seleccion=null">Cerrar</button>
        </header>
        <div class="audit-modal-body space-y-2 overflow-auto px-4 py-3">
          <div v-if="diagnostico" class="rounded-xl border p-3" :class="diagnostico.estilo">
            <h4 class="font-bold">{{ diagnostico.titulo }}</h4>
            <p class="mt-1 text-sm">{{ diagnostico.explicacion }}</p>
            <div class="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
              <p><strong>Estado AWS:</strong> {{ seleccion.status || 'No informado' }}</p>
              <p><strong>Ejecución:</strong> {{ diagnostico.confirmacion }}</p>
              <p v-if="diagnostico.etapa"><strong>Etapa:</strong> {{ diagnostico.etapa }}</p>
              <p v-if="seleccion.tradesCount !== undefined"><strong>Trades informados:</strong> {{ seleccion.tradesCount }} (no confirma fill)</p>
            </div>
          </div>
          <div v-if="diagnostico && (diagnostico.reasonCode || diagnostico.mensaje)" class="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <h4 class="font-bold text-slate-900">Motivo / respuesta del sistema</h4>
            <p v-if="diagnostico.reasonCode" class="mt-1 break-words text-sm"><strong>Código:</strong> {{ diagnostico.reasonCode }}</p>
            <p v-if="diagnostico.mensaje" class="mt-1 break-words text-sm"><strong>Detalle:</strong> {{ diagnostico.mensaje }}</p>
          </div>
          <div v-else class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Este evento no contiene un motivo explícito en los campos consultados. Abre el JSON para inspeccionar otras propiedades.</div>
          <div class="grid gap-1.5 sm:grid-cols-3">
            <div v-for="item in [{k:'Fecha',v:fechaTexto(seleccion.createdAt)},{k:'Símbolo',v:seleccion.symbol},{k:'Acción',v:seleccion.side},{k:'Tipo',v:seleccion.eventType},{k:'Mercado',v:seleccion.tradeType},{k:'Origen',v:seleccion.source},{k:'Exchange',v:seleccion.exchangeId},{k:'Timeframe',v:seleccion.timeframe},{k:'Operación',v:seleccion.operationId},{k:'Señal',v:seleccion.signalId}]" :key="item.k" class="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span class="text-slate-500">{{ item.k }}</span><p class="break-all font-semibold">{{ item.v ?? 'No informado' }}</p>
            </div>
          </div>
          <div class="rounded-xl border border-slate-200 p-2">
            <button class="audit-secondary w-full text-left" :aria-expanded="verJsonTecnico" @click="verJsonTecnico=!verJsonTecnico">{{ verJsonTecnico ? 'Ocultar detalle técnico JSON' : 'Ver detalle técnico JSON' }}</button>
            <pre v-if="verJsonTecnico" class="audit-json mt-3">{{ detalleJSON }}</pre>
            <p v-if="cargandoDetalle" class="mt-2 text-xs text-slate-500">Cargando información completa…</p>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.audit-panel,.audit-kpi{background:#fff;border:1px solid #e0eae7;border-radius:16px;box-shadow:0 3px 12px rgba(15,55,44,.035)}
.audit-kpi{display:flex;flex-direction:column;padding:12px;gap:2px;min-height:94px}.audit-kpi strong{font-size:27px;line-height:1.2}.audit-kpi>span:last-child{font-size:11px;color:#64748b}.audit-kpi-label{font-size:12px;color:#64748b}
.audit-tab,.audit-secondary,.audit-primary{padding:8px 13px;border-radius:10px;border:1px solid #d9e5e2;font-size:12px;font-weight:600;cursor:pointer;background:#fff}.audit-active{background:#059669;color:#fff;border-color:#059669}.audit-primary{background:#059669;color:white;border-color:#059669}.audit-secondary:disabled,.audit-primary:disabled{opacity:.5;cursor:not-allowed}
.audit-date-popover{position:absolute;top:calc(100% + 8px);left:0;z-index:30;width:min(350px,calc(100vw - 35px));padding:14px;border:1px solid #dbe8e3;border-radius:14px;background:#fff;box-shadow:0 12px 40px rgba(20,50,45,.17)}
.audit-label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#64748b}.audit-input{width:100%;min-width:0;height:38px;border:1px solid #d6e4df;border-radius:9px;padding:6px 9px;background:#fff;color:#123044}
th,.audit-panel td{padding:10px 12px}.audit-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(9,28,33,.57);padding:16px}.audit-modal{width:min(920px,100%);max-height:90dvh;overflow:hidden;border-radius:18px;background:white;display:flex;flex-direction:column}.audit-modal-body{flex:1;min-height:0}.audit-json{padding:14px;background:#0c2430;color:#b5f6d0;white-space:pre-wrap;overflow:auto;font-size:11px;max-height:330px;border-radius:10px;overflow-wrap:anywhere}
@media(max-width:640px){th,.audit-panel td{padding:10px 9px}}
</style>
