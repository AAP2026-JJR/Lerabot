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
type Tab = 'trading' | 'apis' | 'avanzada' | 'historial'
const tab = ref<Tab>('trading')
const tabs:{id:Tab;name:string}[]=[{id:'trading',name:'Preferencias de trading'},{id:'apis',name:'Exchanges (API Keys)'},{id:'avanzada',name:'Configuración avanzada'},{id:'historial',name:'Historial de cambios'}]
const busqueda = ref('')
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
const filtradas = computed(() => disponible.value.filter(s=>s.includes(busqueda.value.toUpperCase().trim())))
const actual = computed(() => mercados.value[mercado.value])
const symbol = computed(() => actual.value.symbols[moneda.value])
const riskLabel = computed(() => riesgos.find(r=>r.value === risk.value)?.title || 'Moderado')
const totalActivas = computed(() => Object.values(actual.value.symbols).filter(x=>x.enabled).length)
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
function toggleSymbol(key:string,checked:boolean){if(!actual.value.symbols[key])actual.value.symbols[key]=crearSimbolo();actual.value.symbols[key]!.enabled=checked}
function cambiarTodos(checked:boolean){for(const s of disponible.value.slice(0,100)){const key=draftKey(s);toggleSymbol(key,checked)}}
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
  for(let page=1;page<=6;page++){
    const data=await consultarMercado(page,50)
    for(const x of data.monedas||[]){const s=String(x.simbolo||'').trim().toUpperCase();if(/^[A-Z0-9]{2,15}$/.test(s))catalog.add(s)}
    if(!data.monedas||data.monedas.length<50)break
    if(page===6)catalogoParcial.value=true
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
function restaurar(){void consultar()}
onMounted(()=>{cargarVisual();void consultar();void cargarCatalogo()})
</script>

<template>
 <main class="mx-auto max-w-7xl space-y-5 text-[#102c37]">
  <header class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-widest text-emerald-700">LERABOT · ÁREA PERSONAL</p><h1 class="mt-1 text-3xl font-extrabold">Mi perfil</h1><p class="mt-1 text-sm text-slate-500">Preferencias por suscriptor, consultadas desde DynamoDB.</p></div><span class="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">SUBSCRIBER · {{sesion?.subscriberId||'—'}}</span></header>
  <div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Modo desarrollo: acceso por correo, sin autenticación ni privacidad real. No utilizar datos financieros ni API keys reales. Los cambios en `tradingPreferences` podrían ser consumidos por estrategias externas.</div>
  <section class="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"><div><p class="text-xs text-slate-500">Correo</p><p class="mt-1 break-all font-semibold">{{sesion?.email||'—'}}</p></div><div><p class="text-xs text-slate-500">Rol</p><p class="mt-1 font-semibold">{{sesion?.rol||'—'}}</p></div><div><p class="text-xs text-slate-500">Suscriptor</p><p class="mt-1 font-semibold">{{sesion?.subscriberId||'—'}}</p></div><div><p class="text-xs text-slate-500">Último cambio en AWS</p><p class="mt-1 text-sm font-medium">{{formatearFecha(version)}}</p><button class="mt-1 text-xs text-emerald-700 underline" :disabled="cargando" @click="consultar">Actualizar desde AWS</button></div></section>
  <nav class="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-4" aria-label="Secciones del perfil"><button v-for="t in tabs" :key="t.id" class="rounded-xl px-3 py-3 text-sm font-semibold" :class="tab===t.id?'bg-emerald-50 text-emerald-800':'text-slate-600 hover:bg-slate-50'" @click="tab=t.id">{{t.name}}</button></nav>
  <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{{error}}</p><p v-if="aviso" role="status" class="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{{aviso}}</p>
  <template v-if="tab==='trading'">
   <div class="grid gap-5 lg:grid-cols-2">
    <div class="space-y-5">
     <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-xl font-bold">Perfil de riesgo</h2><p class="mb-4 mt-1 text-sm text-slate-500">Perfil general del suscriptor. Cada moneda puede tener su propio perfil.</p><div class="grid gap-3 sm:grid-cols-3"><button v-for="r in riesgos" :key="r.value" class="rounded-xl border p-3 text-left" :class="risk===r.value?'border-emerald-500 bg-emerald-50':'border-slate-200'" @click="risk=r.value"><strong class="block">{{r.title}} <span v-if="risk===r.value">✓</span></strong><span class="text-xs text-slate-500">{{r.hint}}</span></button></div></section>
     <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-xl font-bold">Configuración de estrategia</h2><p class="mt-1 text-sm text-slate-500">Mercado → Monedas → Par → Temporalidad → Revisar y guardar</p><div class="my-5 grid grid-cols-5 gap-1 text-center text-xs"><button v-for="(name,i) in ['Mercado','Monedas','Par','Tiempo','Guardar']" :key="name" @click="step=i+1"><span class="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full" :class="step===i+1?'bg-emerald-600 text-white':'bg-slate-100'">{{i+1}}</span>{{name}}</button></div>
      <div v-if="step===1" class="space-y-3"><p class="font-semibold">1. Selecciona el mercado</p><div class="grid grid-cols-2 gap-3"><button v-for="m in opcionesMercado" :key="m" class="rounded-xl border p-4 text-left font-bold" :class="mercado===m?'border-emerald-500 bg-emerald-50':'border-slate-200'" @click="mercado=m">{{m==='spot'?'Spot':'Futures'}} <span v-if="mercado===m">✓</span></button></div><label class="flex items-center gap-2 text-sm"><input v-model="actual.enabled" type="checkbox" class="accent-emerald-600"/> Habilitar {{mercado.toUpperCase()}} en configuración</label><p class="text-xs text-amber-700">Deshabilitar un mercado mantiene sus monedas guardadas, pero desactiva ese mercado en el JSON.</p></div>
      <div v-if="step===2" class="space-y-3"><p class="font-semibold">2. Elige la moneda</p><input v-model="busqueda" placeholder="Buscar BTC, ETH, SOL..." class="w-full rounded-xl border p-3"/><div class="max-h-48 overflow-y-auto"><button v-for="s in filtradas.slice(0,100)" :key="s" class="m-1 rounded-lg border px-3 py-2 text-sm" :class="moneda.startsWith(s)&&moneda===draftKey(s)?'border-emerald-500 bg-emerald-50':''" @click="cambiarMoneda(s)">{{s}}</button></div><p class="text-xs text-slate-500">{{disponible.length}} activos en el catálogo. {{catalogoParcial?'Catálogo parcial o no disponible.':''}}</p></div>
      <div v-if="step===3" class="space-y-3"><p class="font-semibold">3. Par y exchange de {{moneda}}</p><label class="block text-sm">Par<select v-model="par" class="mt-1 w-full rounded-xl border p-3"><option>USDT</option><option>USDC</option></select></label><label class="flex items-center gap-2"><input :checked="symbol?.enabled||false" type="checkbox" @change="toggleSymbol(moneda,($event.target as HTMLInputElement).checked)"/> Habilitar {{moneda}}</label><p class="text-sm">Exchange vinculado a esta moneda</p><div class="flex flex-wrap gap-2"><label v-for="e in exchanges" :key="e" class="rounded-lg border px-3 py-2 text-sm"><input type="checkbox" :checked="symbol?.exchanges.includes(e)||false" @change="toggleExchange(e)"/> {{e}}</label></div><p class="text-xs text-amber-700">Los pares USDC se pueden configurar, pero pueden no existir en el exchange seleccionado.</p></div>
      <div v-if="step===4" class="space-y-3"><p class="font-semibold">4. Temporalidades y riesgo para {{moneda}}</p><p class="text-xs text-slate-500">Sin temporalidades explícitas, se aplica el comportamiento heredado del sistema. Los overrides previos permanecen intactos.</p><div class="flex flex-wrap gap-2"><label v-for="t in timeframes" :key="t.value" class="rounded-lg border px-3 py-2"><input type="checkbox" :checked="symbol?.timeframes.includes(t.value)||false" @change="toggleTimeframe(t.value)"/> {{t.label}}</label></div><label class="block text-sm">Riesgo específico<select class="mt-1 block w-full rounded-xl border p-3" :value="symbol?.profile||risk" @change="ensureSymbol().profile=($event.target as HTMLSelectElement).value as Riesgo"><option v-for="r in riesgos" :key="r.value" :value="r.value">{{r.title}}</option></select></label></div>
      <div v-if="step===5" class="space-y-3"><p class="font-semibold">5. Revisar configuración</p><p class="rounded-xl bg-slate-50 p-3 text-sm">{{resumen}}</p><p class="text-xs text-slate-600">Los cambios se enviarán a DynamoDB únicamente al pulsar «Guardar configuración».</p></div>
      <div class="mt-5 flex items-center justify-between"><button class="rounded-xl border px-4 py-2 text-sm" :disabled="step===1" @click="step=Math.max(1,step-1)">Anterior</button><button class="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white" :disabled="step===5" @click="step=Math.min(5,step+1)">Siguiente →</button></div>
     </section>
    </div>
    <div class="space-y-5">
     <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-xl font-bold">Resumen de tu configuración</h2><p class="mt-1 text-sm text-slate-500">Preferencias en edición (el guardado se realiza al final).</p><dl class="mt-4 divide-y text-sm"><div v-for="item in [{a:'Mercado',b:mercado.toUpperCase()+(actual.enabled?' · activo':' · apagado')},{a:'Monedas habilitadas',b:String(totalActivas)},{a:'Par',b:par},{a:'Moneda seleccionada',b:moneda},{a:'Temporalidades',b:symbol?.timeframes.join(', ')||'Heredadas'},{a:'Exchanges',b:symbol?.exchanges.join(', ')||'Sin configurar'},{a:'Riesgo de la moneda',b:symbol?.profile||riskLabel}]" :key="item.a" class="flex justify-between gap-2 py-2"><dt>{{item.a}}</dt><dd class="text-right font-semibold text-emerald-700">{{item.b}}</dd></div></dl></section>
     <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-lg font-bold">Monedas habilitadas ({{totalActivas}})</h2><p class="text-xs text-slate-500">Vista {{mercado.toUpperCase()}}/{{par}}. Los símbolos nuevos empiezan deshabilitados.</p></div><div class="flex gap-2"><button class="rounded-lg border px-3 py-2 text-xs" @click="cambiarTodos(true)">Todas</button><button class="rounded-lg border px-3 py-2 text-xs" @click="cambiarTodos(false)">Ninguna</button></div></div><input v-model="busqueda" class="mt-3 w-full rounded-lg border p-2 text-sm" placeholder="Buscar moneda"/><div class="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"><label v-for="s in filtradas.slice(0,100)" :key="s" class="flex items-center justify-between gap-2 rounded-xl border p-2 text-xs" :class="actual.symbols[draftKey(s)]?.enabled?'border-emerald-200 bg-emerald-50':'border-slate-200'"><span>{{s}}</span><input type="checkbox" class="accent-emerald-600" :checked="actual.symbols[draftKey(s)]?.enabled||false" @change="toggleSymbol(draftKey(s),($event.target as HTMLInputElement).checked)"/></label></div><p v-if="catalogoParcial" class="mt-2 text-xs text-amber-800">El catálogo puede estar incompleto; se incluyen siempre monedas previamente configuradas.</p><p v-if="cargandoCatalogo" class="mt-2 text-xs">Consultando Mercado…</p></section>
    </div>
   </div>
   <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div class="text-sm text-emerald-900"><strong>Ciclo de configuración:</strong> Mercado → Monedas → Par → Temporalidad → Riesgo → Exchange → Guardar.<p class="text-xs">{{cambios?'Tienes cambios pendientes':'Sin cambios pendientes'}}. Actualización por versión para evitar sobrescritura accidental.</p></div><div class="flex gap-2"><button class="rounded-xl border bg-white px-4 py-3 text-sm" @click="restaurar">Restaurar desde AWS</button><button class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40" :disabled="!cambios||guardando||cargando||!version" @click="guardar">{{guardando?'Guardando…':'Guardar configuración'}}</button></div></div>
  </template>
  <section v-else-if="tab==='apis'" class="rounded-2xl border bg-white p-6 shadow-sm"><h2 class="text-xl font-bold">Exchanges · API Keys</h2><p class="mt-2 text-sm text-slate-600">Conexiones reales pendientes. La configuración de credenciales demostrativas se presenta en «Exchanges». No introducir secretos reales; no se almacenan ni se envían.</p><button class="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-white" @click="$router.push('/exchanges')">Ir a Exchanges</button></section>
  <section v-else-if="tab==='avanzada'" class="rounded-2xl border bg-white p-6 shadow-sm"><h2 class="text-xl font-bold">Configuración avanzada</h2><p class="mt-2 text-sm text-slate-600">Los `overrides` existentes (balancePercent, leverage y temporalidades) se conservan cuando guardas cambios. La nueva lista `timeframes` solo configura los periodos explícitos y no reescribe esos overrides.</p><pre class="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">{{JSON.stringify(mercados[mercado].symbols[moneda]?.overrides||{},null,2)}}</pre></section>
  <section v-else class="rounded-2xl border bg-white p-6 shadow-sm"><h2 class="text-xl font-bold">Historial de cambios</h2><p class="mt-2 text-sm">Última modificación de perfil (DynamoDB): <strong>{{formatearFecha(version)}}</strong>.</p><p class="mt-2 text-sm text-slate-600">La tabla actual no ofrece una bitácora de cambios por campo. Para disponer de un historial verificable hace falta implementar auditoría de escrituras en el backend.</p></section>
 </main>
</template>
