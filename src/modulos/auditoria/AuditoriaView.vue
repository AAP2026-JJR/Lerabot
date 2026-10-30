<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listarEventos, obtenerResumen, leerEvento } from './servicio'
import type { EventoAuditoria, ResumenAuditoria } from './tipos'

const eventos = ref<EventoAuditoria[]>([])
const resumen = ref<ResumenAuditoria | null>(null)
const cargando = ref(false)
const error = ref('')
const cursor = ref('')
const siguienteCursor = ref('')
const historico = ref<string[]>([])
const pagina = ref(1)
const estado = ref('')
const fuente = ref('')
const simbolo = ref('')
const tipo = ref('')
const texto = ref('')
const fechaDesde = ref('')
const fechaHasta = ref('')
const seleccion = ref<EventoAuditoria | null>(null)
const cargandoDetalle = ref(false)
const estados = computed(() => Object.keys(resumen.value?.porEstado ?? {}))
const fuentes = computed(() => Object.keys(resumen.value?.porFuente ?? {}))
const simbolos = computed(() => [...new Set(eventos.value.map(e => String(e.symbol ?? '').replace(/\.P$/i, '')).filter(Boolean))].sort())
const tipos = computed(() => [...new Set(eventos.value.map(e => String(e.tradeType ?? '')).filter(Boolean))].sort())
const total = computed(() => resumen.value?.total ?? 0)
const distribucion = computed(() => {
  const counts = resumen.value?.porEstado ?? {}
  return [
    { nombre: 'Enrutadas', codigo: 'PASS_RULES_ROUTED', valor: counts.PASS_RULES_ROUTED ?? 0, color: '#008b73' },
    { nombre: 'Rechazadas', codigo: 'REJECTED', valor: counts.REJECTED ?? 0, color: '#ef5656' },
    { nombre: 'SUCCESS', codigo: 'SUCCESS', valor: counts.SUCCESS ?? 0, color: '#f4b64d' },
    { nombre: 'Otros', codigo: 'OTROS', valor: Object.entries(counts).filter(([k]) => !['PASS_RULES_ROUTED','REJECTED','SUCCESS'].includes(k)).reduce((s,[,v]) => s+v,0), color: '#8ea4b4' }
  ]
})
const dona = computed(() => {
  if (!total.value) return 'conic-gradient(#e6efed 0 100%)'
  let acumulado = 0
  const partes = distribucion.value.map(d => {
    const comienzo = acumulado
    acumulado += d.valor / total.value * 100
    return `${d.color} ${comienzo}% ${acumulado}%`
  })
  return `conic-gradient(${partes.join(',')})`
})
const porFuente = computed(() => Object.entries(resumen.value?.porFuente ?? {}).sort((a,b) => b[1]-a[1]))
const porcentaje = (n: number) => total.value ? (n / total.value * 100).toFixed(1) + '%' : '0%'
const fecha = (valor: unknown) => { if (!valor) return '—'; const d = new Date(String(valor)); return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString('es-PE') }
const colorEstado = (valor: unknown) => { const s = String(valor || '').toUpperCase(); if (s.includes('REJECT') || s.includes('FAIL') || s.includes('ERROR')) return 'bg-red-50 text-red-700'; if (s.includes('SUCCESS')) return 'bg-emerald-50 text-emerald-700'; if (s.includes('ROUTED')) return 'bg-amber-50 text-amber-800'; return 'bg-slate-100 text-slate-700' }
const detalleTexto = computed(() => {
  if (!seleccion.value) return ''
  const dato = seleccion.value.details ?? seleccion.value.payload
  if (typeof dato === 'string') { try { return JSON.stringify(JSON.parse(dato), null, 2) } catch { return dato } }
  return JSON.stringify(dato ?? seleccion.value, null, 2)
})
const eventoCompleto = computed(() => seleccion.value ? JSON.stringify(seleccion.value, null, 2) : '')

// Diagnostico resumido de eventos; no confunde una senal enrutada con una orden ejecutada.
const diagnostico = computed(() => {
  const evento = seleccion.value
  if (!evento) return null
  const extra = (valor: unknown): Record<string, unknown> => {
    if (typeof valor === 'string') {
      try { const objeto: unknown = JSON.parse(valor); return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? objeto as Record<string, unknown> : {} } catch { return {} }
    }
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {}
  }
  const data = { ...extra(evento.payload), ...extra(evento.details), ...evento } as Record<string, unknown>
  const dato = (...claves: string[]) => {
    for (const clave of claves) {
      const valor = data[clave]
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') return String(valor)
    }
    return ''
  }
  const status = String(evento.status ?? '').toUpperCase()
  const rejected = /REJECT|FAIL|ERROR/.test(status)
  const routed = /ROUTED|PASS_RULES/.test(status)
  const success = /SUCCESS|EXECUTED|FILLED/.test(status)
  const executed = data.executed === true || String(data.executed).toLowerCase() === 'true'
  const trades = Number(data.tradesCount ?? 0)
  const evidencia = executed || (success && /EXECUTED|FILLED/.test(dato('eventType','stage').toUpperCase()))
  const titulo = rejected ? 'Senal rechazada por una validacion' : routed ? 'Senal aceptada y enviada al ejecutor' : success ? 'Evento finalizado correctamente' : 'Resultado registrado por el sistema'
  const explicacion = rejected ? 'La senal no supero una regla. Revisa el motivo y la etapa para saber que corregir.' : routed ? 'Supero la validacion y fue enrutada. Este estado por si solo NO confirma la compra o venta.' : success ? 'Se registro un resultado exitoso en esta etapa; confirma el estado de la orden antes de tratarlo como una venta o compra realizada.' : 'Consulta la etapa y el mensaje; este estado no determina por si solo si hubo operacion.'
  return {
    titulo, explicacion,
    color: rejected ? 'border-red-200 bg-red-50 text-red-800' : routed ? 'border-amber-200 bg-amber-50 text-amber-900' : success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-800',
    motivo: dato('reasonCode','rejectReason','reason','errorCode','message') || 'Sin motivo registrado',
    etapa: dato('stage','eventType') || 'No informada',
    regla: dato('rule','ruleName','validationRule') || 'No informada',
    timeframe: dato('timeframe','interval') || 'No informado',
    ejecucion: evidencia ? 'Indicador de ejecucion informado (validar confirmacion del exchange)' : trades > 0 ? 'Trades reportados: '+trades+' (confirmacion pendiente)' : 'No hay confirmacion de orden ejecutada'
  }
})

// Filtros inmediatos y combinables sobre los registros cargados.
// Sin depender del contrato de filtros del Scan actual de DynamoDB.
const eventosVisibles = computed(() => eventos.value.filter(e => {
  const normal = (v: unknown) => String(v ?? '').toLowerCase().trim()
  const status = normal(e.status)
  const elegido = normal(estado.value)
  if (elegido && status !== elegido) return false
  if (fuente.value && normal(e.source) !== normal(fuente.value)) return false
  if (simbolo.value && normal(e.symbol).replace(/\.p$/,'') !== normal(simbolo.value).replace(/\.p$/,'')) return false
  if (tipo.value && normal(e.tradeType) !== normal(tipo.value)) return false
  const needle = normal(texto.value)
  if (needle && ![e.eventId,e.operationId,e.signalId,e.message,e.stage,e.symbol,e.source,e.eventType,e.status].some(v => normal(v).includes(needle))) return false
  const t = e.createdAt ? new Date(String(e.createdAt)).getTime() : NaN
  if (fechaDesde.value && (Number.isNaN(t) || t < new Date(fechaDesde.value + 'T00:00:00').getTime())) return false
  if (fechaHasta.value && (Number.isNaN(t) || t > new Date(fechaHasta.value + 'T23:59:59.999').getTime())) return false
  return true
}))
const hayFiltros = computed(() => Boolean(estado.value || fuente.value || simbolo.value || tipo.value || texto.value || fechaDesde.value || fechaHasta.value))
async function cargar(reset = false) {
  if (reset) { cursor.value = ''; historico.value = []; siguienteCursor.value = ''; pagina.value = 1 }
  cargando.value = true; error.value = ''
  try {
    const respuesta = await listarEventos({ limite: '30', cursor: cursor.value })
    eventos.value = respuesta.eventos ?? []; siguienteCursor.value = respuesta.siguienteCursor ?? ''
  } catch (e) { error.value = e instanceof Error ? e.message : 'No fue posible cargar eventos'; eventos.value = [] }
  finally { cargando.value = false }
}
async function cargarResumen() { try { resumen.value = await obtenerResumen() } catch { resumen.value = null } }
async function actualizar() { await Promise.all([cargar(true), cargarResumen()]) }
async function seleccionar(evento: EventoAuditoria) {
  seleccion.value = evento
  cargandoDetalle.value = true
  try { const r = await leerEvento(evento.PK, evento.SK); if (seleccion.value?.PK === evento.PK && seleccion.value?.SK === evento.SK) seleccion.value = r.evento }
  catch { /* mostrar copia de la lista si el detalle no responde */ }
  finally { cargandoDetalle.value = false }
}
function cerrar() { seleccion.value = null }
function cerrarEscape(e: KeyboardEvent) { if (e.key === 'Escape') cerrar() }
function siguiente() { if (!siguienteCursor.value) return; historico.value.push(cursor.value); cursor.value = siguienteCursor.value; pagina.value++; void cargar() }
function anterior() { if (!historico.value.length) return; cursor.value = historico.value.pop() ?? ''; pagina.value = Math.max(1, pagina.value - 1); void cargar() }
function limpiar() { estado.value=''; fuente.value=''; simbolo.value=''; tipo.value=''; texto.value=''; fechaDesde.value=''; fechaHasta.value='' }
function exportar() {
  const cols = ['createdAt','status','source','eventType','symbol','tradeType','operationId','signalId','message']
  const csv = [cols.join(','), ...eventosVisibles.value.map(e => cols.map(k => '"'+String(e[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href=url; a.download='lerabot-auditoria-pagina.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function copiarJSON() { try { await navigator.clipboard.writeText(eventoCompleto.value) } catch { /* acceso a portapapeles puede estar deshabilitado */ } }
// Cambios en selects, búsqueda y fechas se aplican de inmediato por computed.
onMounted(() => { void actualizar(); window.addEventListener('keydown', cerrarEscape) })
onUnmounted(() => window.removeEventListener('keydown', cerrarEscape))
</script>

<template>
  <div class="audit-page space-y-3 text-[#153040]">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><h2 class="text-[26px] font-bold tracking-tight">Logs y Auditoría</h2><p class="text-sm text-slate-500">Monitoreo de señales, validaciones y eventos de ejecución registrados en DynamoDB.</p></div>
      <span class="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Enrutado ≠ orden ejecutada</span>
    </header>

    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <div class="audit-card kpi"><div class="kpi-icon bg-sky-50 text-sky-700">▤</div><div><div class="kpi-label">Total de eventos</div><div class="kpi-value">{{ resumen?.total ?? '—' }}</div><div class="kpi-caption">Registros consultados</div></div></div>
      <div class="audit-card kpi"><div class="kpi-icon bg-emerald-50 text-emerald-700">↗</div><div><div class="kpi-label">Señales enrutadas</div><div class="kpi-value">{{ resumen?.porEstado?.PASS_RULES_ROUTED ?? '—' }}</div><div class="kpi-caption">{{ porcentaje(resumen?.porEstado?.PASS_RULES_ROUTED ?? 0) }} · No certifica ejecución</div></div></div>
      <div class="audit-card kpi"><div class="kpi-icon bg-amber-50 text-amber-700">!</div><div><div class="kpi-label">Rechazadas</div><div class="kpi-value">{{ resumen?.porEstado?.REJECTED ?? '—' }}</div><div class="kpi-caption">{{ porcentaje(resumen?.porEstado?.REJECTED ?? 0) }} de los eventos</div></div></div>
      <div class="audit-card kpi"><div class="kpi-icon bg-teal-50 text-teal-700">✓</div><div><div class="kpi-label">Estado SUCCESS</div><div class="kpi-value">{{ resumen?.porEstado?.SUCCESS ?? '—' }}</div><div class="kpi-caption">Eventos con estado SUCCESS</div></div></div>
      <div class="audit-card kpi"><div class="kpi-icon bg-slate-100 text-slate-700">◷</div><div><div class="kpi-label">Último evento</div><div class="text-[13px] font-bold leading-tight mt-2">{{ fecha(resumen?.ultimoEvento) }}</div><div class="kpi-caption">Fecha del último registro</div></div></div>
    </div>
    <p v-if="resumen?.parcial" class="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Resumen parcial: {{ resumen.examinados }} registros examinados. Los indicadores no representan necesariamente todo el histórico.</p>

    <div class="grid gap-3 lg:grid-cols-2">
<section class="audit-card px-4 py-3"><h3 class="font-bold">Distribución de estados</h3><p class="text-xs text-slate-500">Según el resumen de DynamoDB</p><div class="mt-2 flex flex-wrap items-center justify-center gap-5"><div class="donut" :style="{background:dona}"><div class="donut-middle"><strong>{{total}}</strong><span>eventos</span></div></div><div class="min-w-[150px] flex-1 space-y-3"><div v-for="d in distribucion" :key="d.codigo" class="flex items-center gap-2 text-xs"><span class="h-2.5 w-2.5 rounded-full" :style="{background:d.color}"></span><span class="flex-1 text-slate-600">{{d.nombre}}</span><b>{{d.valor}}</b><span class="w-12 text-right text-slate-400">{{porcentaje(d.valor)}}</span></div></div></div></section>
<section class="audit-card px-4 py-3"><h3 class="font-bold">Eventos por fuente</h3><p class="text-xs text-slate-500">Origen registrado del evento</p><div class="mt-2 space-y-4"><div v-for="([nombre,cantidad],i) in porFuente" :key="nombre" class="space-y-1"><div class="flex justify-between gap-3 text-xs"><span class="truncate" :title="nombre">{{nombre}}</span><span class="font-semibold">{{cantidad}} · {{porcentaje(cantidad)}}</span></div><div class="h-2.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full" :style="{width:porcentaje(cantidad),background:i%2?'#72cbb3':'#008b73'}"></div></div></div><p v-if="!porFuente.length" class="text-sm text-slate-400">Sin datos todavía.</p></div></section>
</div>

    <section class="audit-card p-3 compact-filter-card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div><h3 class="font-bold text-sm">Filtros de busqueda</h3><p class="text-[11px] text-slate-500">Selecciona un filtro o escribe: resultados inmediatos</p></div>
        <div class="flex items-center gap-2"><span class="hidden sm:inline text-[11px] text-slate-400">{{ eventosVisibles.length }} visibles</span><button class="audit-btn" :disabled="cargando" @click="actualizar">↻ Actualizar</button><button class="audit-btn-primary" :disabled="!eventosVisibles.length" @click="exportar">↓ Exportar CSV</button></div>
      </div>
      <div class="audit-filters-row">
        <label class="audit-label">Estado<select v-model="estado" class="audit-input"><option value="">Todos</option><option v-for="v in estados" :key="v" :value="v">{{v}}</option></select></label>
        <label class="audit-label">Fuente<select v-model="fuente" class="audit-input"><option value="">Todas</option><option v-for="v in fuentes" :key="v" :value="v">{{v}}</option></select></label>
        <label class="audit-label">Simbolo<select v-model="simbolo" class="audit-input"><option value="">Todos</option><option v-for="v in simbolos" :key="v" :value="v">{{v}}</option></select></label>
        <label class="audit-label">Mercado<select v-model="tipo" class="audit-input"><option value="">Spot / Futures</option><option v-for="v in tipos" :key="v" :value="v">{{v}}</option></select></label>
        <label class="audit-label">Desde<input v-model="fechaDesde" type="date" class="audit-input"></label>
        <label class="audit-label">Hasta<input v-model="fechaHasta" type="date" class="audit-input"></label>
        <label class="audit-label">Buscar<input v-model="texto" class="audit-input" placeholder="ID, simbolo, motivo..."></label>
        <button class="audit-btn audit-clear" :disabled="!hayFiltros" @click="limpiar" title="Restablecer filtros">Limpiar</button>
      </div>
      <p class="mt-2 text-[10px] text-slate-400">Los filtros actuan sobre la pagina cargada; usa Siguiente para consultar mas registros.</p>
    </section>

    <p v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{error}}. Revisa la Lambda o la conectividad.</p>

    <div>
      <section class="audit-card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><div><h3 class="font-bold">Eventos del sistema</h3><p class="text-xs text-slate-500">{{ eventosVisibles.length }} visibles · Página {{ pagina }} · Selecciona una fila para ver el JSON</p></div><span v-if="cargando" class="text-xs text-teal-700">Actualizando…</span></div>
        <div class="audit-table-scroll overflow-auto"><table class="w-full min-w-[840px] text-left text-[12px]"><thead class="bg-[#f3f7f6] text-slate-500"><tr><th class="p-3">Fecha y hora</th><th class="p-3">Estado</th><th class="p-3">Fuente</th><th class="p-3">Evento</th><th class="p-3">Símbolo</th><th class="p-3">Mercado</th><th class="p-3">Mensaje</th><th class="p-3"></th></tr></thead><tbody><tr v-for="(e,i) in eventosVisibles" :key="e.PK+'-'+e.SK+'-'+i" class="cursor-pointer border-t border-[#edf2f0] transition hover:bg-[#f2faf7]" @click="seleccionar(e)"><td class="whitespace-nowrap p-3 text-slate-600">{{fecha(e.createdAt)}}</td><td class="p-3"><span class="rounded-lg px-2 py-1 text-[11px] font-semibold" :class="colorEstado(e.status)">{{e.status || 'SIN ESTADO'}}</span></td><td class="p-3">{{e.source || '—'}}</td><td class="p-3">{{e.eventType || '—'}}</td><td class="p-3 font-semibold">{{e.symbol || '—'}}</td><td class="p-3">{{e.tradeType || '—'}}</td><td class="max-w-[185px] truncate p-3 text-slate-500" :title="String(e.message??'')">{{e.message || e.stage || '—'}}</td><td class="p-3"><button class="font-semibold text-[#00856a]" @click.stop="seleccionar(e)">Ver ↗</button></td></tr><tr v-if="!eventosVisibles.length"><td colspan="8" class="p-10 text-center text-slate-500">{{cargando?'Cargando…':'No hay eventos para los filtros aplicados'}}</td></tr></tbody></table></div>
        <footer class="flex flex-wrap justify-between gap-2 border-t border-[#edf2f0] px-4 py-3"><p class="text-xs text-slate-500">Exportar CSV descarga solo los registros visibles de esta página.</p><div class="flex items-center gap-2"><button class="audit-btn" :disabled="!historico.length || cargando" @click="anterior">‹ Anterior</button><span class="text-xs text-slate-500">{{pagina}}</span><button class="audit-btn" :disabled="!siguienteCursor || cargando" @click="siguiente">Siguiente ›</button></div></footer>
      </section>

    </div>

    <div v-if="seleccion" class="modal-backdrop" @click.self="cerrar" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Detalle del evento" class="modal-dialog">
        <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5"><div><p class="text-xs font-semibold uppercase tracking-wide text-[#00856a]">Auditoría de Trading</p><h3 class="mt-1 text-xl font-bold">Detalle del evento</h3><p class="mt-1 break-all text-xs text-slate-500">{{seleccion.eventId || seleccion.PK}}</p></div><button class="audit-btn" aria-label="Cerrar detalle" @click="cerrar">✕</button></header>
        <div class="max-h-[75vh] overflow-y-auto p-6"><div class="flex flex-wrap gap-2"><span class="rounded-lg px-3 py-1 text-xs font-semibold" :class="colorEstado(seleccion.status)">{{seleccion.status || 'SIN ESTADO'}}</span><span class="rounded-lg bg-slate-100 px-3 py-1 text-xs">{{seleccion.source || 'Sin fuente'}}</span><span class="rounded-lg bg-slate-100 px-3 py-1 text-xs">{{seleccion.tradeType || 'Sin mercado'}}</span></div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="modal-field"><span>Fecha</span><b>{{fecha(seleccion.createdAt)}}</b></div><div class="modal-field"><span>Símbolo / Acción</span><b>{{seleccion.symbol || '—'}} · {{seleccion.side || '—'}}</b></div><div class="modal-field"><span>Tipo de evento</span><b>{{seleccion.eventType || '—'}}</b></div><div class="modal-field"><span>Trades registrados</span><b>{{seleccion.tradesCount ?? 'No informado'}}</b></div><div class="modal-field sm:col-span-2"><span>Operation ID</span><b class="break-all">{{seleccion.operationId || '—'}}</b></div><div class="modal-field sm:col-span-2"><span>Signal ID</span><b class="break-all">{{seleccion.signalId || '—'}}</b></div><div class="modal-field sm:col-span-2"><span>Mensaje / motivo</span><b>{{seleccion.message || 'No registrado'}}</b></div></div>
          <section v-if="diagnostico" class="mt-4 rounded-xl border p-4" :class="diagnostico.color" aria-label="Diagnostico rapido del evento">
            <h4 class="text-base font-bold">{{ diagnostico.titulo }}</h4>
            <p class="mt-1 text-sm">{{ diagnostico.explicacion }}</p>
            <div class="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div><span class="font-semibold">Motivo / codigo:</span> {{ diagnostico.motivo }}</div>
              <div><span class="font-semibold">Etapa:</span> {{ diagnostico.etapa }}</div>
              <div><span class="font-semibold">Regla:</span> {{ diagnostico.regla }}</div>
              <div><span class="font-semibold">Temporalidad:</span> {{ diagnostico.timeframe }}</div>
              <div class="sm:col-span-2"><span class="font-semibold">Ejecucion:</span> {{ diagnostico.ejecucion }}</div>
            </div>
          </section>
          <details class="mt-4 rounded-lg border border-slate-200 p-3 text-sm"><summary class="cursor-pointer font-bold text-slate-700">Ver JSON tecnico completo</summary><div class="mt-3 flex justify-end"><button class="audit-btn" @click="copiarJSON">Copiar JSON</button></div><pre class="json-box">{{eventoCompleto}}</pre><details class="mt-3 text-sm"><summary class="cursor-pointer font-medium text-slate-600">Ver detalles normalizados / payload</summary><pre class="json-box mt-2">{{detalleTexto}}</pre></details></details><p v-if="cargandoDetalle" class="mt-3 text-xs text-slate-500">Consultando detalles completos…</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.audit-page {font-family:inherit}
.audit-card {border:1px solid #e0eae7;background:#fff;border-radius:17px;box-shadow:0 3px 14px rgba(24,61,60,.035)}
.kpi {padding:11px 13px;display:flex;align-items:center;gap:10px;min-height:80px}
.kpi-icon {display:grid;place-items:center;width:35px;height:35px;flex-shrink:0;border-radius:50%;font-size:18px;font-weight:700}
.kpi-label {font-size:11px;color:#64748b}.kpi-value {font-size:23px;font-weight:750;line-height:1.5}.kpi-caption {font-size:10px;color:#718096;line-height:1.25}
.audit-filters-row {display:grid;grid-template-columns: minmax(100px,1fr) minmax(110px,1.1fr) minmax(95px,1fr) minmax(115px,1.1fr) minmax(115px,1.1fr) minmax(115px,1.1fr) minmax(175px,1.8fr) auto;align-items:end;gap:8px}
.audit-clear {height:36px;padding:7px 10px}
@media(max-width:1050px){.audit-filters-row {grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:720px){.audit-filters-row {grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:410px){.audit-filters-row {grid-template-columns:minmax(0,1fr)}}
.audit-label {display:flex;flex-direction:column;gap:5px;font-size:11px;color:#64748b}
.audit-input {min-width:0;width:100%;height:36px;padding:6px 8px;border:1px solid #d8e3e1;border-radius:9px;background:#fff;color:#153040;font-size:12px}
.audit-input:focus {outline:2px solid #94daca;outline-offset:1px}
.audit-btn,.audit-btn-primary {border:1px solid #cddcd9;border-radius:9px;padding:9px 13px;font-size:12px;font-weight:650;white-space:nowrap;cursor:pointer}
.audit-btn {color:#224458;background:#fff}.audit-btn-primary {color:white;background:#008b73;border-color:#008b73}
.audit-btn:disabled,.audit-btn-primary:disabled {opacity:.45;cursor:not-allowed}
.audit-tab {border:1px solid #e0eae7;background:white;border-radius:12px;padding:10px 17px;font-size:12px;font-weight:600;cursor:pointer}
.audit-tab-active {background:#dff5ee;border-color:#008b73;color:#007e67}
.donut {width:108px;height:108px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}
.donut-middle {width:77px;height:77px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column}
.donut-middle strong {font-size:21px}.donut-middle span {font-size:11px;color:#94a3b8}
.audit-table-scroll { max-height: min(58vh, 640px); scrollbar-gutter: stable; }
.audit-table-scroll thead {position:sticky;top:0;z-index:2;}
.modal-backdrop {position:fixed;z-index:1000;inset:0;background:rgba(14,35,43,.58);display:grid;place-items:center;padding:18px}
.modal-dialog {width:min(860px,100%);max-height:92vh;overflow:hidden;background:white;border-radius:20px;box-shadow:0 25px 90px rgba(0,0,0,.25)}
.modal-field {padding:11px 13px;background:#f6f9f8;border:1px solid #ebf0ef;border-radius:10px;font-size:12px;display:flex;flex-direction:column;gap:4px}.modal-field span {color:#64748b}.modal-field b {font-weight:600}
.json-box {margin-top:10px;max-height:320px;overflow:auto;padding:18px;background:#0c2230;color:#a9f4cf;border-radius:12px;font-size:11px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
</style>
