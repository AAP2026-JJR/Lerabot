<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { listarEventos } from './servicio'
import type { EventoAuditoria } from './tipos'

const zona = 'America/Lima'
const diaLima = (fecha = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)
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
// V5: agrupacion visual; los registros META y ROUTE siguen separados en DynamoDB.
type GrupoOperacion = { id: string; pk: string; principal: EventoAuditoria; rutas: EventoAuditoria[]; registros: EventoAuditoria[]; fecha: string; resultado: string; motivo: string; esperadas: number; completas: boolean }
const valor = (v: unknown) => v === undefined || v === null ? '' : String(v).trim()
const numero = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const esRuta = (e: EventoAuditoria) => String(e.SK || '').startsWith('ROUTE#')
const esMeta = (e: EventoAuditoria) => e.SK === 'META'
const ordenFecha = (e: EventoAuditoria) => Date.parse(String(e.createdAt || e.updatedAt || '')) || 0
const confirmado = (e: EventoAuditoria) => {
  const accion = valor(e.action).toUpperCase()
  const est = valor(e.status).toUpperCase()
  // El flag executed=true en META solo significa que se invoco el ejecutor.
  return /(^|_)(BUY|SELL|ORDER)_(EXECUTED|FILLED|CONFIRMED)$/.test(accion) ||
    ['BUY_CONFIRMED','SELL_CONFIRMED','FILLED','ORDER_FILLED','SPOT_BUY_EXECUTED','SPOT_SELL_EXECUTED'].includes(accion) ||
    ['BUY_CONFIRMED','SELL_CONFIRMED','FILLED'].includes(est)
}
const omitida = (e: EventoAuditoria) => valor(e.action).toUpperCase().startsWith('SKIPPED_') || valor(e.status).toUpperCase().startsWith('SKIPPED_')
const fallo = (e: EventoAuditoria) => /REJECT|FAIL|ERROR/.test(valor(e.status).toUpperCase()) || /REJECT|FAIL|ERROR/.test(valor(e.action).toUpperCase())
const razon = (e: EventoAuditoria) => valor(e.reasonCode) || valor(e.errorMessage) || valor(e.message) || valor(e.stage)
const identificador = (e: EventoAuditoria) => valor(e.operationId) || valor(e.signalId) || (valor(e.PK).startsWith('OP#') ? valor(e.PK).slice(3) : valor(e.PK))
const listaGrupos = computed<GrupoOperacion[]>(() => {
  const mapa = new Map<string, EventoAuditoria[]>()
  for (const e of eventos.value) {
    const id = identificador(e) || `${e.PK}|${e.SK}`
    if (!mapa.has(id)) mapa.set(id, [])
    mapa.get(id)!.push(e)
  }
  return [...mapa].map(([id, registros]) => {
    const principal = registros.find(esMeta) || registros.find(e => !esRuta(e)) || registros[0]!
    const rutas = registros.filter(esRuta).sort((x,y)=>ordenFecha(x)-ordenFecha(y))
    const esperadas = numero(principal.tradesTotal) || numero(principal.subscribersCount) || rutas.length
    const completas = rutas.length >= esperadas
    const exito = rutas.filter(confirmado).length
    const fallidas = rutas.filter(fallo).length
    const saltadas = rutas.filter(omitida).length
    const tecnicas = rutas.filter(e => ['SUCCESS','COMPLETED'].includes(valor(e.status).toUpperCase()) && !confirmado(e) && !omitida(e)).length
    const finales = rutas.filter(e => confirmado(e) || fallo(e) || omitida(e) || ['SUCCESS','COMPLETED'].includes(valor(e.status).toUpperCase())).length
    let resultado = 'OTROS'
    if (rutas.length) {
      if (finales < esperadas) resultado = fallidas || exito || saltadas ? 'PARCIAL' : 'ENRUTADA'
      else if (fallidas === rutas.length) resultado = 'FALLIDA'
      else if (exito === rutas.length) resultado = 'EJECUTADA'
      else if (saltadas === rutas.length) resultado = 'OMITIDA'
      else if (tecnicas === rutas.length) resultado = 'EXITO_TECNICO'
      else if (fallidas > 0 || saltadas > 0) resultado = 'PARCIAL'
      else resultado = 'EXITO_TECNICO'
    } else {
      const s = valor(principal.status).toUpperCase()
      if (/REJECT/.test(s)) resultado = 'RECHAZADA'
      else if (/FAIL|ERROR/.test(s)) resultado = 'FALLIDA'
      else if (/ROUTED|PASS_RULES/.test(s)) resultado = 'ENRUTADA'
      else if (confirmado(principal)) resultado = 'EJECUTADA'
      else if (omitida(principal)) resultado = 'OMITIDA'
      else if (s === 'SUCCESS' || s === 'COMPLETED') resultado = 'EXITO_TECNICO'
    }
    const rFallo = rutas.find(fallo)
    const motivo = rFallo ? razon(rFallo) : (rutas.find(omitida) ? razon(rutas.find(omitida)!) || valor(rutas.find(omitida)!.action) : razon(principal))
    const fecha = valor(principal.createdAt) || valor(registros[0]?.createdAt)
    return { id, pk: valor(principal.PK), principal, rutas, registros, fecha, resultado, motivo, esperadas, completas }
  }).sort((a,b)=> (Date.parse(b.fecha)||0)-(Date.parse(a.fecha)||0))
})
const enFechaOperaciones = computed(() => listaGrupos.value.filter(g => {
  const fecha = fechaLocal(g.fecha)
  const { desde, hasta } = limitesPeriodo.value
  return Boolean(fecha) && (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
}))
const resumen = computed(() => {
  const lista = enFechaOperaciones.value
  const cuenta = (s: string) => lista.filter(g => g.resultado === s).length
  return { total:lista.length, ejecutadas:cuenta('EJECUTADA'), enrutadas:cuenta('ENRUTADA'), rechazadas:cuenta('RECHAZADA')+cuenta('FALLIDA'), parciales:cuenta('PARCIAL'), omitidas:cuenta('OMITIDA'), otros:cuenta('OTROS')+cuenta('EXITO_TECNICO') }
})
const opciones = (campo: 'source'|'tradeType') => [...new Set(enFechaOperaciones.value.map(g => valor(g.principal[campo])).filter(Boolean))].sort()
const fuentes = computed(() => opciones('source'))
const mercados = computed(() => opciones('tradeType'))
const simbolos = computed(() => [...new Set(enFechaOperaciones.value.map(g => valor(g.principal.symbol).replace(/\.P$/i,'')).filter(Boolean))].sort())
const visibles = computed(() => enFechaOperaciones.value.filter(g => {
  const e = g.principal
  if (estado.value && g.resultado !== estado.value) return false
  if (fuente.value && valor(e.source) !== fuente.value) return false
  if (mercado.value && valor(e.tradeType) !== mercado.value) return false
  if (simbolo.value && valor(e.symbol).replace(/\.P$/i,'') !== simbolo.value) return false
  return true
}))
const ordenados = computed(() => visibles.value) // fecha descendente en listaGrupos
const totalPaginas = computed(() => Math.max(1, Math.ceil(ordenados.value.length/porPagina)))
const paginaEventos = computed(() => ordenados.value.slice((pagina.value-1)*porPagina, pagina.value*porPagina))
const barras = computed(() => [
  {label:'Ejecutadas (confirmadas)',n:resumen.value.ejecutadas,color:'#059669'},
  {label:'Enrutadas / pendientes',n:resumen.value.enrutadas,color:'#d97706'},
  {label:'Rechazadas / fallidas',n:resumen.value.rechazadas,color:'#dc2626'},
  {label:'Parciales',n:resumen.value.parciales,color:'#2563eb'},
  {label:'Omitidas',n:resumen.value.omitidas,color:'#64748b'},
  {label:'Otras / éxito técnico',n:resumen.value.otros,color:'#94a3b8'}
])
const percent = (n:number) => resumen.value.total ? Math.round(n*100/resumen.value.total) : 0
const claseEstado = (r: string) => {
  if (r==='FALLIDA' || r==='RECHAZADA') return 'bg-red-50 text-red-700'
  if (r==='EJECUTADA') return 'bg-emerald-50 text-emerald-700'
  if (r==='ENRUTADA') return 'bg-amber-50 text-amber-700'
  if (r==='PARCIAL') return 'bg-blue-50 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}
const nombreEstado = (r: string) => ({FALLIDA:'Fallida',RECHAZADA:'Rechazada',EJECUTADA:'Ejecutada',ENRUTADA:'Enrutada',PARCIAL:'Parcial',OMITIDA:'Omitida',EXITO_TECNICO:'Éxito técnico',OTROS:'Otros'} as Record<string,string>)[r] || r
const rutaNombre = (e: EventoAuditoria) => valor(e.subscriberId) || (valor(e.SK).split('#')[1] || 'Sin suscriptor')
const rutaExchange = (e: EventoAuditoria) => valor(e.exchangeId) || (valor(e.SK).split('#')[2] || 'Sin exchange')
const rutaEstado = (e: EventoAuditoria) => fallo(e)?'Fallida':confirmado(e)?'Ejecutada':omitida(e)?'Omitida':valor(e.status) || 'Pendiente'
const grupoAbierto = ref<GrupoOperacion | null>(null)
const pestaña = ref<'resumen'|'suscriptores'|'json'>('resumen')
const rutaAbierta = ref('')
const jsonElegido = ref('META')
const detalleJson = computed(() => {
  const g = grupoAbierto.value
  if (!g) return ''
  const e = jsonElegido.value === 'META' ? g.principal : g.rutas.find(x => x.SK===jsonElegido.value) || g.principal
  return JSON.stringify(e, null, 2)
})
const motivoPrincipal = computed(() => {
  const g = grupoAbierto.value
  if (!g) return ''
  const r = g.rutas.find(fallo)
  return r ? (razon(r) || 'Fallo sin motivo documentado') : (g.motivo || 'Sin motivo registrado')
})
// F9 V5.1: diagnostico consolidado por operacion (sin consultas adicionales).
const diagnosticoCabecera = computed(() => {
  const g = grupoAbierto.value
  if (!g) return { titulo: '', explicacion: '', codigo: '', detalle: '', afectados: 0, total: 0, otros: '' }
  const fallidas = g.rutas.filter(fallo)
  const origen = fallidas[0] || g.rutas.find(omitida) || g.principal
  const codigo = valor(origen.reasonCode) || (fallidas.length ? 'FALLO_SIN_CODIGO' : valor(origen.status) || 'SIN_CODIGO')
  const mensaje = valor(origen.errorMessage) || valor(origen.message)
  const normal = codigo.toUpperCase()
  let titulo = 'Resultado de la operación'
  let explicacion = 'Revisa el resultado individual de cada ruta para conocer el desenlace.'
  if (normal.includes('MIN_NOTIONAL_NOT_MET')) {
    titulo = 'Importe de la orden inferior al mínimo'
    explicacion = 'El validador de riesgo rechazó la orden porque el valor calculado de la posición no alcanzó el mínimo permitido. Revisa cantidad, precio y configuración del suscriptor.'
  } else if (normal.includes('TIMEFRAME_NOT_ENABLED')) {
    titulo = 'Temporalidad no habilitada'
    explicacion = 'La señal se rechazó porque su timeframe no está habilitado para ese mercado. Revisa la configuración de temporalidades del suscriptor.'
  } else if (normal.includes('SIGNAL_QUALITY_TOO_LOW') || normal.includes('QUALITY_TOO_LOW')) {
    titulo = 'Calidad de señal insuficiente'
    explicacion = 'La señal quedó por debajo del umbral mínimo de calidad configurado; no debe considerarse una orden ejecutada.'
  } else if (normal.includes('SKIPPED_')) {
    titulo = 'Ejecución omitida por una regla'
    explicacion = 'La ruta fue omitida de forma controlada; no existe evidencia de una orden nueva completada.'
  } else if (g.resultado === 'FALLIDA' || g.resultado === 'RECHAZADA') {
    titulo = 'La señal no terminó en una orden confirmada'
    explicacion = 'Se registró un rechazo o fallo. El motivo técnico se muestra a continuación cuando está disponible.'
  } else if (g.resultado === 'PARCIAL') {
    titulo = 'Resultado parcial o mixto'
    explicacion = 'No todas las rutas tienen el mismo resultado o faltan rutas por completar. Revisa el desglose por suscriptor.'
  } else if (g.resultado === 'ENRUTADA') {
    titulo = 'Señal enviada, orden aún no confirmada'
    explicacion = 'El enrutamiento fue exitoso, pero no consta una confirmación explícita de ejecución en el exchange.'
  } else if (g.resultado === 'EJECUTADA') {
    titulo = 'Acción de ejecución registrada'
    explicacion = 'Existen acciones de ejecución confirmada en las rutas. Revisa los identificadores y respuestas del exchange.'
  } else if (g.resultado === 'OMITIDA') {
    titulo = 'Operación omitida sin nueva orden'
    explicacion = 'Las rutas terminaron omitiendo la orden de forma controlada.'
  } else if (g.resultado === 'EXITO_TECNICO') {
    titulo = 'Proceso exitoso, ejecución no acreditada'
    explicacion = 'El estado técnico es exitoso, pero no demuestra por sí mismo que se haya llenado una orden.'
  }
  const codigos = [...new Set(fallidas.map(r => valor(r.reasonCode)).filter(Boolean))]
  return {
    titulo, explicacion, codigo,
    detalle: mensaje,
    afectados: fallidas.length,
    total: g.rutas.length,
    otros: codigos.length > 1 ? `Existen ${codigos.length} códigos de error diferentes; revisa cada suscriptor.` : ''
  }
})
function abrir(g: GrupoOperacion) {
  grupoAbierto.value = g
  pestaña.value = 'resumen'
  rutaAbierta.value = g.rutas[0]?.SK || ''
  jsonElegido.value = 'META'
}
function cerrarEscape(e: KeyboardEvent) { if (e.key==='Escape') grupoAbierto.value=null }
function limpiar() { estado.value='';fuente.value='';simbolo.value='';mercado.value='';pagina.value=1 }
function exportar() {
  const campos = ['fecha','operationId','estado','symbol','side','tradeType','fuente','rutas','rutasFallidas','rutasConfirmadas','rutasOmitidas','motivo']
  const filas = visibles.value.map(g=>[g.fecha,g.id,g.resultado,g.principal.symbol,g.principal.side,g.principal.tradeType,g.principal.source,g.rutas.length,g.rutas.filter(fallo).length,g.rutas.filter(confirmado).length,g.rutas.filter(omitida).length,g.motivo])
  const csv=[campos.join(','),...filas.map(f=>f.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(','))].join('\r\n')
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a'); a.href=url;a.download='lerabot-operaciones-auditoria-'+(limitesPeriodo.value.desde||'historico')+'.csv';a.click();URL.revokeObjectURL(url)
}
async function copiarJSON() {
  try { await navigator.clipboard.writeText(detalleJson.value) } catch { /* portapapeles no disponible */ }
}
watch([estado,fuente,simbolo,mercado],()=>{pagina.value=1})
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
    if (periodo.value === 'hoy') fechaHoyActual.value = diaLima()
    pagina.value = 1
    ultimaActualizacion.value = new Date()
  } catch(e) { error.value = e instanceof Error ? e.message : 'No se pudieron consultar los eventos' }
  finally { cargando.value = false }
}
onMounted(() => { activo = true; void actualizar(); window.addEventListener('keydown',cerrarEscape); temporizador=setInterval(() => { if (activo && document.visibilityState==='visible' && !grupoAbierto.value && pagina.value===1 && periodo.value==='hoy') { fechaHoyActual.value = diaLima(); void actualizar() } },30000) })
onUnmounted(() => { activo=false;if(temporizador)clearInterval(temporizador);window.removeEventListener('keydown',cerrarEscape) })
</script>

<template>
  <section class="space-y-3 text-[#17313d]">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><h2 class="text-2xl font-bold">Logs y Auditoría</h2><p class="text-sm text-slate-500">Operaciones agrupadas · una señal y sus suscriptores · hora de Perú</p></div>
      <div class="flex items-center gap-3"><span class="text-xs text-slate-500">{{ ultimaActualizacion ? 'Actualizado: '+fechaTexto(ultimaActualizacion.toISOString()) : 'Sin actualizar' }}</span><button class="audit-primary" :disabled="cargando" @click="actualizar">{{cargando?'Consultando…':'↻ Actualizar'}}</button></div>
    </header>
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold text-slate-500">Período</span>
      <div class="relative">
        <button class="audit-secondary flex items-center gap-2" :aria-expanded="selectorPeriodoAbierto" @click="selectorPeriodoAbierto=!selectorPeriodoAbierto"><span>▦</span><span>{{ periodoTexto }}</span><span>▾</span></button>
        <div v-if="selectorPeriodoAbierto" class="audit-date-popover space-y-3">
          <div class="grid grid-cols-2 gap-2"><button class="audit-secondary" @click="elegirPeriodo('hoy')">Hoy</button><button class="audit-secondary" @click="elegirPeriodo('ayer')">Ayer</button><button class="audit-secondary col-span-2" @click="elegirPeriodo('todos')">Todo el histórico disponible</button></div>
          <div class="border-t border-slate-100 pt-2"><p class="mb-2 text-xs font-bold">Rango personalizado</p><div class="grid grid-cols-2 gap-2"><label class="audit-label">Desde<input v-model="fechaInicio" type="date" class="audit-input" /></label><label class="audit-label">Hasta<input v-model="fechaFin" type="date" class="audit-input" /></label></div><p v-if="fechaInicio > fechaFin" class="mt-1 text-xs text-red-600">La fecha inicial no puede superar la final.</p><button class="audit-primary mt-3 w-full" :disabled="!fechaInicio || !fechaFin || fechaInicio > fechaFin" @click="aplicarRango">Aplicar rango</button></div>
        </div>
      </div>
      <span class="text-xs text-slate-500">{{ periodo==='hoy' ? 'Hoy · Perú · actualización cada 30 s' : 'Filtro sobre eventos consultados' }}</span>
      <span class="ml-auto text-xs text-slate-500">{{visibles.length}} operaciones visibles · {{eventos.length}} registros DynamoDB</span>
    </div>
    <div class="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
      <article class="audit-kpi"><span class="audit-kpi-label">Operaciones</span><strong>{{resumen.total}}</strong><span>Señales únicas</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Ejecutadas</span><strong class="text-emerald-600">{{resumen.ejecutadas}}</strong><span>Acción confirmada</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Enrutadas</span><strong class="text-amber-600">{{resumen.enrutadas}}</strong><span>Pendientes / no confirmadas</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Fallidas / rechazadas</span><strong class="text-red-600">{{resumen.rechazadas}}</strong><span>Sin éxito total</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Parciales</span><strong class="text-blue-600">{{resumen.parciales}}</strong><span>Resultados mixtos / incompletos</span></article>
      <article class="audit-kpi"><span class="audit-kpi-label">Omitidas / otras</span><strong>{{resumen.omitidas+resumen.otros}}</strong><span>Sin orden confirmada</span></article>
    </div>
    <div v-if="truncado" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Límite de {{maxEventos}} registros alcanzado. Pueden faltar operaciones, rutas o resultados; los KPIs son parciales. Para un histórico completo se requiere Query por fecha en el backend.</div>
    <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{error}}</div>
    <div class="audit-panel p-3"><div class="mb-3 flex items-center justify-between"><h3 class="font-bold">Distribución por resultado de operación</h3><span class="text-xs text-slate-500">{{resumen.total}} operaciones</span></div><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div v-for="b in barras" :key="b.label"><div class="flex justify-between text-xs"><span>{{b.label}}</span><strong>{{b.n}} · {{percent(b.n)}}%</strong></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full" :style="{width:percent(b.n)+'%',background:b.color}"></div></div></div></div></div>
    <div class="audit-panel p-3"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold">Filtros de operaciones</h3><div class="flex gap-2"><button class="audit-secondary" @click="limpiar">Limpiar filtros</button><button class="audit-secondary" :disabled="!visibles.length" @click="exportar">↓ CSV</button></div></div><div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><label class="audit-label">Estado<select v-model="estado" class="audit-input"><option value="">Todos</option><option value="EJECUTADA">Ejecutada</option><option value="ENRUTADA">Enrutada</option><option value="RECHAZADA">Rechazada</option><option value="FALLIDA">Fallida</option><option value="PARCIAL">Parcial</option><option value="OMITIDA">Omitida</option><option value="EXITO_TECNICO">Éxito técnico</option><option value="OTROS">Otros</option></select></label><label class="audit-label">Fuente<select v-model="fuente" class="audit-input"><option value="">Todas</option><option v-for="f in fuentes" :key="f">{{f}}</option></select></label><label class="audit-label">Símbolo<select v-model="simbolo" class="audit-input"><option value="">Todos</option><option v-for="s in simbolos" :key="s">{{s}}</option></select></label><label class="audit-label">Mercado<select v-model="mercado" class="audit-input"><option value="">Spot / Futures</option><option v-for="m in mercados" :key="m">{{m}}</option></select></label></div></div>
    <div class="audit-panel overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-2 p-4"><div><h3 class="font-bold">Operaciones del sistema</h3><p class="text-xs text-slate-500">Una fila por operación · más reciente primero · 25 por página</p></div><span class="text-xs text-slate-500">Página {{pagina}} / {{totalPaginas}}</span></div>
      <div class="max-h-[560px] overflow-auto"><table class="min-w-[960px] w-full text-left text-xs"><thead class="sticky top-0 z-10 bg-[#eff6f4] text-slate-600"><tr><th>Fecha (Perú)</th><th>Resultado</th><th>Símbolo / Acción</th><th>Mercado</th><th>Suscriptores</th><th>Diagnóstico</th><th></th></tr></thead><tbody><tr v-for="g in paginaEventos" :key="g.id" class="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/50" @click="abrir(g)"><td class="whitespace-nowrap">{{fechaTexto(g.fecha)}}</td><td><span class="rounded-md px-2 py-1 font-semibold" :class="claseEstado(g.resultado)">{{nombreEstado(g.resultado)}}</span></td><td class="font-semibold">{{g.principal.symbol || '—'}}<span class="block font-normal text-slate-500">{{g.principal.side || g.principal.eventType || '—'}}</span></td><td>{{g.principal.tradeType || '—'}}</td><td>{{g.rutas.length}} / {{g.esperadas}}<span class="block text-slate-500">rutas registradas / esperadas</span></td><td class="max-w-[280px] truncate" :title="g.motivo">{{g.motivo || 'Sin detalle de motivo'}}</td><td class="font-semibold text-emerald-700">Ver ↗</td></tr><tr v-if="!paginaEventos.length"><td colspan="7" class="py-10 text-center text-slate-500">{{cargando?'Consultando…':'No hay operaciones para estos filtros'}}</td></tr></tbody></table></div>
      <footer class="flex items-center justify-between gap-3 border-t border-slate-100 p-3"><span class="text-xs text-slate-500">CSV: una fila por operación (sin eliminar logs)</span><div class="flex gap-2"><button class="audit-secondary" :disabled="pagina<=1" @click="pagina--">Anterior</button><button class="audit-secondary" :disabled="pagina>=totalPaginas" @click="pagina++">Siguiente</button></div></footer>
    </div>
    <div v-if="grupoAbierto" class="audit-backdrop" @click.self="grupoAbierto=null">
      <section class="audit-modal" role="dialog" aria-modal="true" aria-label="Detalle técnico de operación">
        <header class="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div class="min-w-0"><p class="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Auditoría de trading / Detalle técnico</p><h3 class="text-lg font-bold">{{grupoAbierto.principal.symbol || 'Operación'}} · {{grupoAbierto.principal.side || grupoAbierto.principal.eventType || '—'}}</h3><p class="mt-1 break-all text-[11px] text-slate-500">{{grupoAbierto.id}}</p></div><div class="flex shrink-0 items-center gap-2"><span class="rounded-lg px-2 py-1 text-xs font-bold" :class="claseEstado(grupoAbierto.resultado)">{{nombreEstado(grupoAbierto.resultado)}}</span><button class="audit-secondary" @click="grupoAbierto=null">✕</button></div></header>
        <div class="audit-modal-body overflow-auto p-3 sm:p-4">
          <div class="mb-3 grid grid-cols-3 gap-2"><div class="audit-mini"><span>Rutas encontradas</span><strong>{{grupoAbierto.rutas.length}}</strong></div><div class="audit-mini"><span>Confirmadas</span><strong class="text-emerald-700">{{grupoAbierto.rutas.filter(confirmado).length}}</strong></div><div class="audit-mini"><span>Fallidas</span><strong class="text-red-700">{{grupoAbierto.rutas.filter(fallo).length}}</strong></div></div>
          <!-- F9 V5.1: resumen de motivo siempre visible, antes del desglose -->
          <div class="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-bold text-slate-800">Diagnóstico principal</p>
              <span v-if="diagnosticoCabecera.afectados" class="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{{diagnosticoCabecera.afectados}} de {{diagnosticoCabecera.total}} rutas fallidas</span>
            </div>
            <p class="mt-2 text-sm font-bold text-slate-900">{{diagnosticoCabecera.titulo}}</p>
            <p class="mt-1 text-sm leading-5 text-slate-700">{{diagnosticoCabecera.explicacion}}</p>
            <div v-if="diagnosticoCabecera.codigo" class="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Código / motivo técnico</p>
              <code class="mt-1 block break-all text-xs font-semibold text-rose-700">{{diagnosticoCabecera.codigo}}</code>
              <p v-if="diagnosticoCabecera.detalle" class="mt-1 break-words text-xs text-slate-700">{{diagnosticoCabecera.detalle}}</p>
            </div>
            <p v-if="diagnosticoCabecera.otros" class="mt-2 text-xs font-medium text-amber-700">{{diagnosticoCabecera.otros}}</p>
            <p v-if="!grupoAbierto.completas" class="mt-2 text-xs font-semibold text-amber-700">Rutas encontradas: {{grupoAbierto.rutas.length}} de {{grupoAbierto.esperadas}} esperadas. Resultado aún no completo.</p>
          </div>
          <div class="mb-3 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold"><button class="audit-pill" :class="pestaña==='resumen'?'audit-pill-active':''" @click="pestaña='resumen'">Resumen</button><button class="audit-pill" :class="pestaña==='suscriptores'?'audit-pill-active':''" @click="pestaña='suscriptores'">Suscriptores ({{grupoAbierto.rutas.length}})</button><button class="audit-pill" :class="pestaña==='json'?'audit-pill-active':''" @click="pestaña='json'">JSON</button></div>
          <div v-if="pestaña==='resumen'" class="space-y-3"><div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><div class="audit-info"><span>Fecha</span><strong>{{fechaTexto(grupoAbierto.fecha)}}</strong></div><div class="audit-info"><span>Mercado</span><strong>{{grupoAbierto.principal.tradeType||'—'}}</strong></div><div class="audit-info"><span>Fuente</span><strong>{{grupoAbierto.principal.source||'—'}}</strong></div><div class="audit-info"><span>Trades informados</span><strong>{{grupoAbierto.principal.tradesCount??'—'}}</strong></div><div class="audit-info"><span>Estado META</span><strong>{{grupoAbierto.principal.status||'—'}}</strong></div><div class="audit-info"><span>Resultado rutas</span><strong>{{grupoAbierto.rutas.filter(fallo).length}} fallidas · {{grupoAbierto.rutas.filter(omitida).length}} omitidas</strong></div></div><div><h4 class="mb-2 text-sm font-bold">Secuencia de la operación</h4><ol class="space-y-2"><li v-for="(e,i) in [...grupoAbierto.registros].sort((a,b)=>ordenFecha(a)-ordenFecha(b))" :key="e.PK+'|'+e.SK" class="flex gap-3 border-l-2 border-emerald-100 pl-3 text-xs"><span class="font-bold text-slate-400">{{i+1}}</span><div><strong>{{fechaTexto(e.createdAt)}} · {{esMeta(e)?'Señal principal':esRuta(e)?rutaNombre(e)+' · '+rutaExchange(e):'Evento'}}</strong><p class="mt-1 text-slate-500">{{e.action||e.status}} · {{razon(e)||'Sin mensaje'}}</p></div></li></ol></div><p class="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">El campo <code>executed=true</code> en META no confirma que el exchange haya llenado la orden. Se necesita evidencia explícita en la ruta.</p><button class="audit-secondary w-full" @click="pestaña='suscriptores'">Ver resultados por suscriptor →</button></div>
          <div v-else-if="pestaña==='suscriptores'" class="space-y-2"><p v-if="!grupoAbierto.rutas.length" class="text-sm text-slate-500">No hay rutas individuales en los registros consultados.</p><div v-for="r in grupoAbierto.rutas" :key="r.SK" class="rounded-xl border border-slate-200"><button class="flex w-full items-center justify-between gap-2 p-3 text-left" @click="rutaAbierta=rutaAbierta===r.SK?'':r.SK"><span class="text-sm font-bold">{{rutaNombre(r)}} · {{rutaExchange(r)}}</span><span class="rounded-md px-2 py-1 text-xs font-semibold" :class="claseEstado(fallo(r)?'FALLIDA':confirmado(r)?'EJECUTADA':omitida(r)?'OMITIDA':'OTROS')">{{rutaEstado(r)}} {{rutaAbierta===r.SK?'⌃':'⌄'}}</span></button><div v-if="rutaAbierta===r.SK" class="space-y-2 border-t border-slate-100 p-3 text-xs"><p><strong>Fecha:</strong> {{fechaTexto(r.createdAt)}}</p><p><strong>Acción:</strong> {{r.action||'No informada'}}</p><p><strong>Etapa:</strong> {{r.stage||'No informada'}}</p><p><strong>Código:</strong> {{r.reasonCode||'No informado'}}</p><p class="break-words"><strong>Respuesta:</strong> {{r.errorMessage||r.message||'Sin detalle'}}</p><p class="text-slate-500">{{confirmado(r)?'Existe una acción explícita de ejecución en el registro.': 'No hay una confirmación explícita de orden completada.'}}</p><button class="audit-secondary" @click="jsonElegido=r.SK;pestaña='json'">Ver JSON de {{rutaNombre(r)}} →</button></div></div></div>
          <div v-else class="space-y-2"><div class="flex flex-wrap items-center justify-between gap-2"><label class="text-xs font-semibold">Registro <select v-model="jsonElegido" class="audit-input mt-1"><option value="META">Principal (META / legado)</option><option v-for="r in grupoAbierto.rutas" :key="r.SK" :value="r.SK">{{rutaNombre(r)}} · {{rutaExchange(r)}}</option></select></label><button class="audit-secondary" @click="copiarJSON">Copiar JSON</button></div><pre class="audit-json">{{detalleJson}}</pre><p class="text-xs text-slate-500">JSON del registro recibido desde la API; no se consulta otra vez al cambiar de pestaña.</p></div>
        </div>
      </section>
    </div>
  </section>
</template>
<style scoped>
.audit-mini,.audit-info{border-radius:10px;background:#f6f9f8;padding:9px;display:flex;flex-direction:column;gap:3px;min-width:0}.audit-mini span,.audit-info span{font-size:11px;color:#64748b}.audit-mini strong{font-size:22px}.audit-info strong{font-size:12px;overflow-wrap:anywhere}.audit-pill{flex:1;padding:8px 5px;border-radius:9px}.audit-pill-active{background:#fff;box-shadow:0 1px 5px #0001;color:#047857}.audit-panel,.audit-kpi{background:#fff;border:1px solid #e0eae7;border-radius:16px;box-shadow:0 3px 12px rgba(15,55,44,.035)}
.audit-kpi{display:flex;flex-direction:column;padding:12px;gap:2px;min-height:94px}.audit-kpi strong{font-size:27px;line-height:1.2}.audit-kpi>span:last-child{font-size:11px;color:#64748b}.audit-kpi-label{font-size:12px;color:#64748b}
.audit-tab,.audit-secondary,.audit-primary{padding:8px 13px;border-radius:10px;border:1px solid #d9e5e2;font-size:12px;font-weight:600;cursor:pointer;background:#fff}.audit-active{background:#059669;color:#fff;border-color:#059669}.audit-primary{background:#059669;color:white;border-color:#059669}.audit-secondary:disabled,.audit-primary:disabled{opacity:.5;cursor:not-allowed}
.audit-date-popover{position:absolute;top:calc(100% + 8px);left:0;z-index:30;width:min(350px,calc(100vw - 35px));padding:14px;border:1px solid #dbe8e3;border-radius:14px;background:#fff;box-shadow:0 12px 40px rgba(20,50,45,.17)}
.audit-label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#64748b}.audit-input{width:100%;min-width:0;height:38px;border:1px solid #d6e4df;border-radius:9px;padding:6px 9px;background:#fff;color:#123044}
th,.audit-panel td{padding:10px 12px}.audit-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(9,28,33,.57);padding:16px}.audit-modal{width:min(920px,100%);max-height:90dvh;overflow:hidden;border-radius:18px;background:white;display:flex;flex-direction:column}.audit-modal-body{flex:1;min-height:0}.audit-json{padding:14px;background:#0c2430;color:#b5f6d0;white-space:pre-wrap;overflow:auto;font-size:11px;max-height:330px;border-radius:10px;overflow-wrap:anywhere}
@media(max-width:640px){th,.audit-panel td{padding:10px 9px}}
</style>
