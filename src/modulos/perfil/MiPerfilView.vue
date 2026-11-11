<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { consultarMercado } from '../mercado/servicio'
import { sesionDemo } from '../login/sesionDemo'

type Mercado = 'spot' | 'futures'
type Riesgo = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
type ConfigSymbol = { enabled: boolean; profile: Riesgo; exchanges: string[]; timeframes: string[]; overrides?: Record<string, unknown> }
type ConfigMarket = { enabled: boolean; symbols: Record<string, ConfigSymbol> }
type Profile = { subscriberId?: string; riskProfileRequested?: string; tradingPreferences?: Record<string, unknown>; updatedAt?: string }
const sesion = sesionDemo()
const base = String(import.meta.env.VITE_PERFILES_API_URL || 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/, '')
const riesgos: { value: Riesgo; title: string; hint: string }[] = [
  {value:'CONSERVATIVE',title:'Conservador',hint:'Exposición reducida'},
  {value:'MODERATE',title:'Moderado',hint:'Equilibrio de riesgo'},
  {value:'AGGRESSIVE',title:'Agresivo',hint:'Mayor tolerancia'},
]
const timeframes = [{value:'5', label:'5m'}, {value:'15',label:'15m'}, {value:'60',label:'1h'}, {value:'120',label:'2h'}, {value:'240',label:'4h'}, {value:'D',label:'1d'}, {value:'W',label:'1w'}]
const exchanges = ['bingx','binance','bybit','okx']
const mercado = ref<Mercado>('spot')
const par = ref('USDT')
const step = ref(1)
type Tab = 'trading' | 'monedas' | 'apis' | 'historial'
const tab = ref<Tab>('trading')
const tabs:{id:Tab;name:string}[]=[{id:'trading',name:'Preferencias de trading'},{id:'apis',name:'Exchanges (API Keys)'},{id:'monedas',name:'Monedas habilitadas'},{id:'historial',name:'Historial de cambios'}]
const busqueda = ref('')
const filtroMonedas = ref<'todas' | 'activas' | 'inactivas' | 'configuradas'>('todas')
const paginaMonedas = ref(1)
const tamPagina = 36
const maxPaginasCatalogo = 30
const moneda = ref('BTCUSDT')
const opcionesMercado: Mercado[] = ['spot', 'futures']
const mercados = ref<Record<Mercado,ConfigMarket>>({spot:{enabled:false,symbols:{}},futures:{enabled:false,symbols:{}}})
const risk = ref<Riesgo>('MODERATE')
const originalRisk = ref<Riesgo>('MODERATE')
const originalConfig = ref('')
const version = ref('')
const cargando = ref(false)
const guardando = ref(false)
const cargandoCatalogo = ref(false)
const error = ref('')
const aviso = ref('')
const nombresCatalogo = ref<string[]>(['BTC','ETH','XRP','SOL','BNB','ADA','DOGE','AVAX','LINK','DOT','LTC','TRX'])
const catalogoParcial = ref(false)
const claveVisual = `lerabot_f12_visual_${sesion?.subscriberId || 'demo'}`
const draftKey = (v:string) => `${v.toUpperCase()}${par.value}`
const keySymbol = (v:string) => /^[A-Z0-9]{2,20}(USDT|USDC)$/.test(v)
const disponible = computed(() => Array.from(new Set([...nombresCatalogo.value, ...Object.keys(mercados.value.spot.symbols).map(s=>s.replace(/(USDT|USDC)$/,'')), ...Object.keys(mercados.value.futures.symbols).map(s=>s.replace(/(USDT|USDC)$/,''))])).filter(s => /^[A-Z0-9]{2,15}$/.test(s)).sort())
const filtradas = computed(() => disponible.value.filter(s => {
 const key = draftKey(s)
 const obj = actual.value.symbols[key]
 const okBusqueda = s.includes(busqueda.value.toUpperCase().trim())
 const okEstado = filtroMonedas.value === 'todas' ||
  (filtroMonedas.value === 'activas' && !!obj?.enabled) ||
  (filtroMonedas.value === 'inactivas' && !obj?.enabled) ||
  (filtroMonedas.value === 'configuradas' && !!obj)
 return okBusqueda && okEstado
}))
const totalPaginas = computed(() => Math.max(1,Math.ceil(filtradas.value.length/tamPagina)))
const monedasPagina = computed(() => filtradas.value.slice((paginaMonedas.value-1)*tamPagina, paginaMonedas.value*tamPagina))
const totalConfiguradas = computed(() => Object.keys(actual.value.symbols).filter(key=>key.endsWith(par.value)).length)
watch([busqueda, filtroMonedas, mercado, par], () => {paginaMonedas.value = 1})
const actual = computed(() => mercados.value[mercado.value])
const symbol = computed(() => actual.value.symbols[moneda.value])
const riskLabel = computed(() => riesgos.find(r=>r.value === risk.value)?.title || 'Moderado')
const totalActivas = computed(() => Object.entries(actual.value.symbols).filter(([key,x])=>key.endsWith(par.value) && x.enabled).length)
const cambios = computed(() => JSON.stringify(mercados.value)!==originalConfig.value || risk.value!==originalRisk.value)
const resumen = computed(() => `${mercado.value.toUpperCase()} · ${moneda.value} · ${symbol.value?.timeframes?.map(tf=>timeframes.find(x=>x.value===tf)?.label||tf).join(', ') || 'Hereda temporalidades'} · ${symbol.value?.exchanges?.join(', ')||'Sin exchange'} · ${symbol.value?.profile || risk.value}`)
function crearSimbolo(): ConfigSymbol {return {enabled:false,profile:risk.value,exchanges:[],timeframes:[]}}
function normalSymbol(value:unknown): ConfigSymbol {
  const p = (value && typeof value==='object' && !Array.isArray(value)) ? value as Record<string,unknown> : {}
  const rr = typeof p.profile==='string' && riesgos.some(r=>r.value===p.profile) ? p.profile as Riesgo : risk.value
  return {
    enabled:p.enabled===true,
    profile:rr,
    exchanges:Array.isArray(p.exchanges)?p.exchanges.filter((s):s is string=>typeof s==='string'&&exchanges.includes(s.toLowerCase())).map(s=>s.toLowerCase()):[],
    timeframes:Array.isArray(p.timeframes)?p.timeframes.filter((s):s is string=>typeof s==='string'&&timeframes.some(t=>t.value===s)):[],
    ...(p.overrides && typeof p.overrides==='object' && !Array.isArray(p.overrides)? {overrides:p.overrides as Record<string,unknown>}:{}),
  }
}
function normalMarket(value:unknown):ConfigMarket {
  const obj=(value&&typeof value==='object'&&!Array.isArray(value))?value as Record<string,unknown>:{}
  const symbols:Record<string,ConfigSymbol>={}
  if(obj.symbols && typeof obj.symbols==='object' && !Array.isArray(obj.symbols)) {
    for(const [k,v] of Object.entries(obj.symbols)) if(keySymbol(k)) symbols[k]=normalSymbol(v)
  }
  return {enabled:obj.enabled===true,symbols}
}
function cambiarMoneda(v:string) {moneda.value=draftKey(v);step.value=3}
function ensureSymbol(){if(!actual.value.symbols[moneda.value]) actual.value.symbols[moneda.value]=crearSimbolo();return actual.value.symbols[moneda.value]!}
function toggleSymbol(key:string,checked:boolean){if(!checked && !actual.value.symbols[key])return;if(!actual.value.symbols[key] && Object.keys(actual.value.symbols).length>=100){error.value='Límite de 100 símbolos configurados por mercado en la API F12. Deshabilitar no libera espacio; se requiere ampliar la Lambda para añadir más.';return}if(!actual.value.symbols[key])actual.value.symbols[key]=crearSimbolo();actual.value.symbols[key]!.enabled=checked}
function cambiarTodos(checked:boolean){
 const lista = filtradas.value
 if(!lista.length)return
 if(!confirm(`${checked?'Habilitar':'Deshabilitar'} ${lista.length} símbolos visibles por filtro en ${mercado.value.toUpperCase()}/${par.value}?`))return
 const existentes = Object.keys(actual.value.symbols).length
 const nuevos = lista.filter(s=>!actual.value.symbols[draftKey(s)]).length
 if(checked && existentes+nuevos>100){error.value='La Lambda F12 admite como máximo 100 símbolos configurados por mercado. Filtra una selección más pequeña.';return}
 for(const s of lista){toggleSymbol(draftKey(s),checked)}
}
function volverMoneda(s:string){cambiarMoneda(s); tab.value='trading'}
function toggleExchange(value:string) {const item=ensureSymbol();item.exchanges=item.exchanges.includes(value)?item.exchanges.filter(e=>e!==value):[...item.exchanges,value]}
function toggleTimeframe(value:string) {const item=ensureSymbol();item.timeframes=item.timeframes.includes(value)?item.timeframes.filter(e=>e!==value):[...item.timeframes,value]}
function formatearFecha(value:string) {if(!value)return 'Sin información';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('es-PE')}
function cargarVisual(){try{const x=JSON.parse(localStorage.getItem(claveVisual)||'{}') as {mercado?:Mercado;par?:string;moneda?:string};if(x.mercado==='spot'||x.mercado==='futures')mercado.value=x.mercado;if(x.par==='USDT'||x.par==='USDC')par.value=x.par;if(x.moneda&&keySymbol(x.moneda))moneda.value=x.moneda}catch{/* sin estado */}}
function guardarVisual(){try{localStorage.setItem(claveVisual,JSON.stringify({mercado:mercado.value,par:par.value,moneda:moneda.value}))}catch{/* navegador restringido */}}
watch([mercado,par],()=>{const pref=moneda.value.replace(/(USDT|USDC)$/,'');moneda.value=draftKey(pref);guardarVisual()})
watch(moneda,guardarVisual)
async function consultar(){if(!sesion || sesion.rol!=='SUBSCRIBER')return; cargando.value=true;error.value='';aviso.value=''
 try {
  const resp=await fetch(base+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:sesion.email,action:'profile'}),cache:'no-store'})
  const data=await resp.json() as {ok?:boolean;exists?:boolean;profile?:Profile;error?:string}
  if(!resp.ok||!data.exists||!data.profile)throw Error(data.error||'Perfil no disponible')
  if(data.profile.subscriberId!==sesion.subscriberId)throw Error('El ID del perfil no coincide con la sesión visual')
  const riskValue=data.profile.riskProfileRequested
  risk.value=riesgos.some(r=>r.value===riskValue)?riskValue as Riesgo:'MODERATE'
  originalRisk.value=risk.value
  const tp=data.profile.tradingPreferences||{}
  mercados.value={spot:normalMarket(tp.spot),futures:normalMarket(tp.futures)}
  originalConfig.value=JSON.stringify(mercados.value)
  version.value=data.profile.updatedAt||''
 }catch(e){error.value=e instanceof Error?e.message:'Error de lectura'}finally{cargando.value=false}}
async function cargarCatalogo(){cargandoCatalogo.value=true;catalogoParcial.value=false
 try{
  const catalog=new Set(nombresCatalogo.value)
  for(let page=1;page<=maxPaginasCatalogo;page++){
    const data=await consultarMercado(page,50)
    for(const x of data.monedas||[]){const s=String(x.simbolo||'').trim().toUpperCase();if(/^[A-Z0-9]{2,15}$/.test(s))catalog.add(s)}
    if(!data.monedas||data.monedas.length<50)break
    if(page===maxPaginasCatalogo)catalogoParcial.value=true
  }
  nombresCatalogo.value=[...catalog].sort()
 }catch{catalogoParcial.value=true}finally{cargandoCatalogo.value=false}
}
async function guardar(){if(!sesion||sesion.rol!=='SUBSCRIBER'||!sesion.subscriberId||guardando.value)return
  if(!confirm('Guardar cambios de preferencias en DynamoDB? Pueden afectar procesos que consuman este JSON.'))return
  guardando.value=true;error.value='';aviso.value=''
  try{
    const payload={action:'updateTradingConfig',email:sesion.email,subscriberId:sesion.subscriberId,expectedUpdatedAt:version.value,riskProfileRequested:risk.value,tradingPreferences:mercados.value}
    const r=await fetch(base+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const data=await r.json() as {ok?:boolean;error?:string;updatedAt?:string}
    if(!r.ok||!data.ok)throw Error(data.error || `No se guardó (HTTP ${r.status})`)
    version.value=data.updatedAt||version.value
    originalConfig.value=JSON.stringify(mercados.value)
    originalRisk.value=risk.value
    aviso.value='Configuración guardada en DynamoDB. Comprueba su efecto antes de usar estrategias reales.'
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo guardar'}finally{guardando.value=false}
}
function restaurar(){if(cambios.value && !confirm('Descartar los cambios sin guardar y recargar desde AWS?'))return;void consultar()}
onMounted(()=>{cargarVisual();void consultar();void cargarCatalogo()})
</script>

<template>
 <main class="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 px-2 pb-28 text-[#102c37] sm:px-4 lg:px-6">
  <header class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-widest text-emerald-700">LERABOT · ÁREA PERSONAL</p><h1 class="mt-1 text-3xl font-extrabold">Mi perfil</h1><p class="mt-1 text-sm text-slate-500">Preferencias por suscriptor, consultadas desde DynamoDB.</p></div><span class="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">SUBSCRIBER · {{sesion?.subscriberId||'—'}}</span></header>
  <div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Modo desarrollo: acceso por correo, sin autenticación ni privacidad real. No utilizar datos financieros ni API keys reales. Los cambios en `tradingPreferences` podrían ser consumidos por estrategias externas.</div>
  <section class="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"><div><p class="text-xs text-slate-500">Correo</p><p class="mt-1 break-all font-semibold">{{sesion?.email||'—'}}</p></div><div><p class="text-xs text-slate-500">Rol</p><p class="mt-1 font-semibold">{{sesion?.rol||'—'}}</p></div><div><p class="text-xs text-slate-500">Suscriptor</p><p class="mt-1 font-semibold">{{sesion?.subscriberId||'—'}}</p></div><div><p class="text-xs text-slate-500">Último cambio en AWS</p><p class="mt-1 text-sm font-medium">{{formatearFecha(version)}}</p><button class="mt-1 text-xs text-emerald-700 underline" :disabled="cargando" @click="consultar">Actualizar desde AWS</button></div></section>
  <nav class="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 lg:grid-cols-4" aria-label="Secciones del perfil"><button v-for="t in tabs" :key="t.id" class="rounded-xl px-2 py-3 text-xs font-semibold transition-colors sm:text-sm" :class="tab===t.id?'bg-emerald-50 text-emerald-800':'text-slate-600 hover:bg-slate-50'" @click="tab=t.id">{{t.name}}</button></nav>
  <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{{error}}</p><p v-if="aviso" role="status" class="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{{aviso}}</p>
  <template v-if="tab==='trading'">
   <section class="min-w-0">
    <div class="min-w-0">
     <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-lg font-bold">Configuración de estrategia</h2><p class="text-xs text-slate-500">Un flujo para cada mercado y cada moneda. Cambios pendientes hasta guardar.</p></div><span class="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{{mercado.toUpperCase()}} / {{par}}</span></div>
      <div class="mb-4 grid grid-cols-5 gap-1 border-b border-slate-100 pb-4 text-center text-[11px] sm:gap-2 sm:text-xs"><button v-for="(name,i) in ['Mercado','Monedas','Par y exchange','Tiempo y riesgo','Revisar']" :key="name" class="min-w-0 rounded-lg p-1" :class="step===i+1?'bg-emerald-50 text-emerald-800':'text-slate-500 hover:bg-slate-50'" @click="step=i+1"><span class="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full font-bold" :class="step===i+1?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600'">{{i+1}}</span><span class="block truncate">{{name}}</span></button></div>
      <div v-if="step===1" class="space-y-3"><h3 class="font-bold">1. Elige el mercado</h3><div class="grid gap-3 sm:grid-cols-2"><button v-for="m in opcionesMercado" :key="m" class="rounded-xl border p-4 text-left font-semibold" :class="mercado===m?'border-emerald-500 bg-emerald-50':'border-slate-200'" @click="mercado=m">{{m==='spot'?'Spot':'Futures'}} <span v-if="mercado===m">✓</span></button></div><label class="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><input v-model="actual.enabled" type="checkbox" class="accent-emerald-600"/> Habilitar mercado {{mercado.toUpperCase()}}</label><p class="text-xs text-amber-800">Al deshabilitar un mercado, sus símbolos guardados permanecen en el JSON.</p></div>
      <div v-else-if="step===2" class="space-y-3"><h3 class="font-bold">2. Selecciona una moneda</h3><div class="flex flex-wrap gap-2"><button class="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800" @click="tab='monedas'">Abrir catálogo completo ({{disponible.length}}) →</button><span class="self-center text-xs text-slate-500">{{totalActivas}} habilitadas · {{totalConfiguradas}} configuradas</span></div><label class="block text-sm">Moneda actual<select class="mt-1 w-full rounded-xl border p-3" :value="moneda.replace(/(USDT|USDC)$/,'')" @change="cambiarMoneda(($event.target as HTMLSelectElement).value)"><option v-for="s in disponible" :key="s" :value="s">{{s}}</option></select></label></div>
      <div v-else-if="step===3" class="space-y-3"><h3 class="font-bold">3. Par y exchange de {{moneda}}</h3><div class="grid gap-3 sm:grid-cols-2"><label class="block text-sm">Par<select v-model="par" class="mt-1 w-full rounded-xl border p-3"><option>USDT</option><option>USDC</option></select></label><label class="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" class="accent-emerald-600" :checked="symbol?.enabled||false" @change="toggleSymbol(moneda,($event.target as HTMLInputElement).checked)"/> Habilitar {{moneda}}</label></div><h4 class="text-sm font-semibold">Exchange vinculado</h4><div class="grid grid-cols-2 gap-2 sm:grid-cols-4"><label v-for="e in exchanges" :key="e" class="flex gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" class="accent-emerald-600" :checked="symbol?.exchanges.includes(e)||false" @change="toggleExchange(e)"/> {{e}}</label></div><p class="text-xs text-amber-700">La disponibilidad del par depende del exchange; esta pantalla no coloca órdenes.</p></div>
      <div v-else-if="step===4" class="space-y-3"><h3 class="font-bold">4. Temporalidad y riesgo para {{moneda}}</h3><div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7"><label v-for="t in timeframes" :key="t.value" class="flex justify-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" class="accent-emerald-600" :checked="symbol?.timeframes.includes(t.value)||false" @change="toggleTimeframe(t.value)"/> {{t.label}}</label></div><p class="text-xs text-slate-500">Sin periodos explícitos se conserva el comportamiento heredado; los overrides anteriores no se eliminan.</p><div class="space-y-2 rounded-xl bg-slate-50 p-3"><h4 class="text-sm font-bold">Riesgo global del suscriptor</h4><div class="grid gap-2 sm:grid-cols-3"><button v-for="r in riesgos" :key="r.value" class="rounded-lg border bg-white p-3 text-left text-sm" :class="risk===r.value?'border-emerald-500 bg-emerald-50':'border-slate-200'" @click="risk=r.value">{{r.title}} <span v-if="risk===r.value">✓</span></button></div></div><label class="block text-sm">Riesgo específico de moneda<select class="mt-1 w-full rounded-xl border p-3" :value="symbol?.profile||risk" @change="ensureSymbol().profile=($event.target as HTMLSelectElement).value as Riesgo"><option v-for="r in riesgos" :key="r.value" :value="r.value">{{r.title}}</option></select></label></div>
      <div v-else class="space-y-3"><h3 class="font-bold">5. Revisar antes de guardar</h3><p class="rounded-xl bg-slate-50 p-4 text-sm">{{resumen}}</p><div class="grid gap-2 text-sm sm:grid-cols-3"><span class="rounded-lg bg-slate-50 p-3">Mercado: <b>{{actual.enabled?'Activo':'Inactivo'}}</b></span><span class="rounded-lg bg-slate-50 p-3">Símbolos activos: <b>{{totalActivas}}</b></span><span class="rounded-lg bg-slate-50 p-3">Cambios: <b>{{cambios?'Pendientes':'Sin cambios'}}</b></span></div></div>
      <div class="mt-5 flex items-center justify-between gap-3"><button class="rounded-xl border px-4 py-2 text-sm disabled:opacity-40" :disabled="step===1" @click="step=Math.max(1,step-1)">← Anterior</button><button class="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-40" :disabled="step===5" @click="step=Math.min(5,step+1)">Siguiente →</button></div>
     </section>
    </div>
   </section>
  </template>
  <section v-else-if="tab==='monedas'" class="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
   <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-bold">Monedas habilitadas</h2><p class="mt-1 text-sm text-slate-500">Catálogo de Mercado + monedas ya guardadas. Selecciona, filtra y administra sin salir de Mi perfil.</p></div><div class="flex flex-wrap gap-2 text-xs"><span class="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">{{totalActivas}} activas</span><span class="rounded-full bg-slate-100 px-3 py-2">{{totalConfiguradas}} configuradas</span><span class="rounded-full bg-slate-100 px-3 py-2">{{disponible.length}} disponibles</span></div></div>
   <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label class="text-xs font-semibold">Mercado<select v-model="mercado" class="mt-1 w-full rounded-lg border p-3 text-sm"><option value="spot">Spot</option><option value="futures">Futures</option></select></label><label class="text-xs font-semibold">Par<select v-model="par" class="mt-1 w-full rounded-lg border p-3 text-sm"><option>USDT</option><option>USDC</option></select></label><label class="text-xs font-semibold">Estado<select v-model="filtroMonedas" class="mt-1 w-full rounded-lg border p-3 text-sm"><option value="todas">Todas</option><option value="activas">Habilitadas</option><option value="inactivas">Deshabilitadas</option><option value="configuradas">Ya configuradas</option></select></label><label class="text-xs font-semibold">Buscar<input v-model="busqueda" class="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="BTC, ETH, XRP…"/></label></div>
   <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-xs text-slate-500">{{filtradas.length}} resultados · página {{paginaMonedas}} de {{totalPaginas}} <span v-if="cargandoCatalogo">· Cargando catálogo…</span></p><div class="flex flex-wrap gap-2"><button class="rounded-lg border px-3 py-2 text-xs" @click="cambiarTodos(true)">Habilitar filtradas</button><button class="rounded-lg border px-3 py-2 text-xs" @click="cambiarTodos(false)">Deshabilitar filtradas</button></div></div>
   <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><div v-for="s in monedasPagina" :key="s" class="flex min-w-0 items-center justify-between gap-2 rounded-xl border p-3" :class="actual.symbols[draftKey(s)]?.enabled?'border-emerald-200 bg-emerald-50':'border-slate-200'"><div class="min-w-0"><p class="truncate text-sm font-bold">{{s}}<span class="font-normal text-slate-500">/{{par}}</span></p><p class="text-[11px] text-slate-500">{{actual.symbols[draftKey(s)]?.enabled?'Habilitada':actual.symbols[draftKey(s)]?'Configurada · apagada':'Sin configurar'}}</p></div><div class="flex shrink-0 items-center gap-2"><button class="rounded-md border bg-white px-2 py-1 text-xs text-emerald-800" :aria-label="'Editar '+s" @click="volverMoneda(s)">Editar</button><input type="checkbox" class="h-4 w-4 accent-emerald-600" :aria-label="'Habilitar '+s" :checked="actual.symbols[draftKey(s)]?.enabled||false" @change="toggleSymbol(draftKey(s),($event.target as HTMLInputElement).checked)"/></div></div></div>
   <p v-if="filtradas.length===0" class="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Sin monedas para este filtro. Prueba «Todas» o cambia el par.</p>
   <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p class="text-xs text-slate-500">Solo las monedas activas cuentan como habilitadas. El catálogo puede cambiar según el servicio Mercado.</p><div class="flex gap-2"><button class="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" :disabled="paginaMonedas<=1" @click="paginaMonedas=Math.max(1,paginaMonedas-1)">Anterior</button><button class="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" :disabled="paginaMonedas>=totalPaginas" @click="paginaMonedas=Math.min(totalPaginas,paginaMonedas+1)">Siguiente</button></div></div>
   <p v-if="catalogoParcial" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Mercado no devolvió el catálogo completo. Las monedas guardadas en DynamoDB se conservan en esta lista.</p>
  </section>
  <section v-else-if="tab==='apis'" class="rounded-2xl border bg-white p-6 shadow-sm"><h2 class="text-xl font-bold">Exchanges · API Keys</h2><p class="mt-2 text-sm text-slate-600">Conexiones reales pendientes. La configuración de credenciales demostrativas se presenta en «Exchanges». No introducir secretos reales; no se almacenan ni se envían.</p><button class="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-white" @click="$router.push('/exchanges')">Ir a Exchanges</button></section>
  <section v-else class="rounded-2xl border bg-white p-6 shadow-sm"><h2 class="text-xl font-bold">Historial de cambios</h2><p class="mt-2 text-sm">Última modificación de perfil (DynamoDB): <strong>{{formatearFecha(version)}}</strong>.</p><p class="mt-2 text-sm text-slate-600">La Lambda actual solo devuelve updatedAt; todavía no hay auditoría de cambios por moneda, usuario o campo. Esta sección es de consulta, no inventa eventos. Para historial real se requiere registrar eventos de escritura en el backend.</p></section>
  <div v-if="tab==='trading'||tab==='monedas'" class="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0 text-xs sm:text-sm"><strong class="text-emerald-800">{{cambios?'Cambios pendientes':'Configuración sin cambios'}}</strong><p class="mt-1 text-slate-500">{{mercado.toUpperCase()}} / {{par}} · {{totalActivas}} monedas habilitadas · Guarda para sincronizar con DynamoDB</p></div><div class="flex flex-wrap gap-2"><button class="rounded-xl border px-4 py-2 text-sm" @click="restaurar">Restaurar desde AWS</button><button class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40" :disabled="!cambios||guardando||cargando||!version" @click="guardar">{{guardando?'Guardando…':'Guardar configuración'}}</button></div></div>
 </main>
</template>
