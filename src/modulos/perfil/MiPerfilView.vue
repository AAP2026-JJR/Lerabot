<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { consultarMercado } from '../mercado/servicio'
import { sesionDemo } from '../login/sesionDemo'

type Market = 'spot' | 'futures'
type Risk = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
type AnyMap = Record<string, unknown>
type Rule = { enabled?: boolean; profile?: string; style?: string; accounts?: string[]; exchanges?: string[]; timeframes?: string[]; overrides?: AnyMap; [key:string]: unknown }
type MarketShape = { enabled?: boolean; symbols?: Record<string, unknown>; [key:string]: unknown }
type Profile = { subscriberId?: string; role?: string; riskProfileRequested?: string; tradingPreferences?: Record<string, unknown>; updatedAt?: string }
type Tab = 'trading' | 'monedas' | 'apis' | 'historial'
const session = sesionDemo()
const base = String(import.meta.env.VITE_PERFILES_API_URL || 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/, '')
const risks: Array<{id:Risk;label:string;description:string}> = [
  {id:'CONSERVATIVE',label:'Conservador',description:'Exposición reducida'},
  {id:'MODERATE',label:'Moderado',description:'Equilibrio de riesgo'},
  {id:'AGGRESSIVE',label:'Agresivo',description:'Mayor tolerancia'},
]
const timeframes = [{id:'5',name:'5m'},{id:'15',name:'15m'},{id:'60',name:'1h'},{id:'120',name:'2h'},{id:'240',name:'4h'},{id:'D',name:'1d'},{id:'W',name:'1w'}]
const tabs: Array<{id:Tab;name:string}> = [{id:'trading',name:'Preferencias de trading'},{id:'monedas',name:'Monedas habilitadas'},{id:'apis',name:'Exchanges (demo)'},{id:'historial',name:'Historial'}]
const marketOptions: Market[] = ['spot','futures']
const market=ref<Market>('spot')
const quote=ref<'USDT'|'USDC'>('USDT')
const step=ref(1)
const tab=ref<Tab>('trading')
const search=ref('')
const statusFilter=ref<'all'|'enabled'|'disabled'|'configured'>('all')
const page=ref(1)
const pageSize=30
const catalog=ref<string[]>(['BTC','ETH','SOL','XRP','BNB','ADA','AVAX','DOGE','DOT','LINK','LTC','TRX'])
const catalogBusy=ref(false)
const catalogMessage=ref('')
const symbol=ref('BTCUSDT')
const accountIndex=ref(0)
const accountChoice=ref('')
const generalRisk=ref<Risk>('MODERATE')
const savedRisk=ref<Risk>('MODERATE')
const tp=ref<Record<string, unknown>>({spot:{enabled:false,symbols:{}}, futures:{enabled:false,symbols:{}}})
const updatedAt=ref('')
const busy=ref(false)
const error=ref('')
const notice=ref('')
const draftEnabled=ref(false)
const draftRisk=ref<Risk>('MODERATE')
const draftStyle=ref('POSITION')
const draftTF=ref<string[]>([])
const draftExchanges=ref<string[]>([])
const modal=ref('')
const demoKey=ref('')
const demoSecret=ref('')
const currentMarket=computed<MarketShape>(() => asMap(tp.value[market.value]) as MarketShape)
const symbolMap=computed<Record<string,unknown>>(() => asMap(currentMarket.value.symbols))
const currentValue=computed(() => symbolMap.value[symbol.value])
const currentRules=computed<Rule[]>(() => Array.isArray(currentValue.value) ? currentValue.value.filter(isMap) as Rule[] : isMap(currentValue.value) ? [currentValue.value as Rule] : [])
const linkedAccounts=computed(()=> [...new Set(currentRules.value.flatMap(r => Array.isArray(r.accounts) ? r.accounts.filter((x): x is string => typeof x==='string') : []))])
const selectedRule=computed<Rule|undefined>(() => currentRules.value[accountIndex.value])
const isMulti=computed(()=>Array.isArray(currentValue.value))
const available=computed(()=>[...new Set([...catalog.value,...Object.keys(asMap(asMap(tp.value.spot).symbols)).map(baseSymbol),...Object.keys(asMap(asMap(tp.value.futures).symbols)).map(baseSymbol)])].filter(x=>/^[A-Z0-9]{2,15}$/.test(x)).sort())
const displayed=computed(()=>available.value.filter(x=>{
  const k=x+quote.value
  const v=symbolMap.value[k]
  const rows=Array.isArray(v)?v.filter(isMap):isMap(v)?[v]:[]
  const enabled=rows.some(r=>r.enabled===true)
  const matches=statusFilter.value==='all'||(statusFilter.value==='enabled'&&enabled)||(statusFilter.value==='disabled'&&!enabled)||(statusFilter.value==='configured'&&rows.length>0)
  return matches && x.includes(search.value.trim().toUpperCase())
}))
const totalPages=computed(()=>Math.max(1,Math.ceil(displayed.value.length/pageSize)))
const visibleCoins=computed(()=>displayed.value.slice((page.value-1)*pageSize,page.value*pageSize))
const enabledCoins=computed(()=>available.value.filter(x=>{
  const v=symbolMap.value[x+quote.value]
  return Array.isArray(v)?v.some(r=>isMap(r)&&r.enabled===true):isMap(v)&&v.enabled===true
}).length)
const formattedDate=computed(()=>updatedAt.value ? new Date(updatedAt.value).toLocaleString('es-PE') : 'Sin registro')
const draftChanges=ref(false)
const readableAccount=computed(()=>{
  const a=selectedRule.value?.accounts
  if(Array.isArray(a)&&a.length)return a.join(', ')
  return accountChoice.value || 'Regla general / sin cuenta asociada'
})
function isMap(v:unknown):v is AnyMap {return v!==null&&typeof v==='object'&&!Array.isArray(v)}
function asMap(v:unknown):AnyMap {return isMap(v)?v:{}}
function baseSymbol(v:string){return v.replace(/(USDT|USDC)$/,'')}
function risk(v:unknown): Risk {return v==='CONSERVATIVE'||v==='AGGRESSIVE'||v==='MODERATE'?v:'MODERATE'}
function stringList(v:unknown):string[]{return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]}
function syncDraft(){
  const rule=selectedRule.value
  draftEnabled.value=rule?.enabled===true
  draftRisk.value=risk(rule?.profile ?? generalRisk.value)
  draftStyle.value=typeof rule?.style==='string'?rule.style:'POSITION'
  draftTF.value=stringList(rule?.timeframes)
  draftExchanges.value=stringList(rule?.exchanges)
  accountChoice.value=Array.isArray(rule?.accounts)?rule.accounts.join(', '):''
  draftChanges.value=false
}
function chooseSymbol(s:string){symbol.value=s+quote.value;accountIndex.value=0;syncDraft();step.value=3;tab.value='trading'}
function setAccount(i:number){accountIndex.value=i;syncDraft();step.value=4}
function changeMarket(m:Market){market.value=m;accountIndex.value=0;syncDraft();step.value=1}
function setDraftTF(id:string){draftTF.value=draftTF.value.includes(id)?draftTF.value.filter(x=>x!==id):[...draftTF.value,id];draftChanges.value=true}
function toggleEx(id:string){draftExchanges.value=draftExchanges.value.includes(id)?draftExchanges.value.filter(x=>x!==id):[...draftExchanges.value,id];draftChanges.value=true}
function displayRule(x:unknown){const rules=Array.isArray(x)?x.filter(isMap):isMap(x)?[x]:[];return rules.length ? `${rules.filter(r=>r.enabled===true).length} activa(s) · ${rules.length} configuración(es)`:'Sin configurar'}
watch([search,statusFilter,quote,market],()=>{page.value=1})
watch([market,quote],()=>{symbol.value=baseSymbol(symbol.value)+quote.value;accountIndex.value=0;syncDraft()})
async function load(){
  if(!session || session.rol!=='SUBSCRIBER')return
  busy.value=true;error.value='';notice.value=''
  try{
    const response=await fetch(base+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile',email:session.email}),cache:'no-store'})
    const data=await response.json() as {ok?:boolean;exists?:boolean;profile?:Profile;error?:string}
    if(!response.ok||!data.exists||!data.profile)throw Error(data.error||'Perfil no encontrado')
    if(data.profile.subscriberId!==session.subscriberId)throw Error('El suscriptor devuelto no coincide con la sesión')
    tp.value=structuredCloneSafe(data.profile.tradingPreferences||{})
    generalRisk.value=risk(data.profile.riskProfileRequested);savedRisk.value=generalRisk.value
    updatedAt.value=data.profile.updatedAt||'';syncDraft()
  }catch(e){error.value=e instanceof Error?e.message:'Error consultando AWS'}finally{busy.value=false}
}
function structuredCloneSafe(data:Record<string,unknown>):Record<string,unknown>{return JSON.parse(JSON.stringify(data)) as Record<string,unknown>}
async function loadCatalog(){
  catalogBusy.value=true;catalogMessage.value=''
  const items=new Set(catalog.value)
  try{
    for(let i=1;i<=20;i++){
      const result=await consultarMercado(i,50)
      for(const row of result.monedas||[]){const name=String(row.simbolo||'').toUpperCase().trim();if(/^[A-Z0-9]{2,15}$/.test(name))items.add(name)}
      if(!result.monedas||result.monedas.length<50)break
    }
  }catch{catalogMessage.value='Catálogo parcial: se mantienen monedas almacenadas en AWS.'}
  catalog.value=[...items].sort();catalogBusy.value=false
}
async function moreCatalog(){
  catalogBusy.value=true;catalogMessage.value=''
  try{
    const endpoint=market.value==='spot'?'https://api.binance.com/api/v3/exchangeInfo':'https://fapi.binance.com/fapi/v1/exchangeInfo'
    const resp=await fetch(endpoint)
    if(!resp.ok)throw Error(`HTTP ${resp.status}`)
    const data=await resp.json() as {symbols?:Array<{baseAsset?:string;quoteAsset?:string;status?:string}>}
    const items=new Set(catalog.value)
    for(const row of data.symbols||[])if((row.quoteAsset==='USDT'||row.quoteAsset==='USDC')&&row.status==='TRADING'&&/^[A-Z0-9]{2,15}$/.test(row.baseAsset||''))items.add(row.baseAsset!)
    catalog.value=[...items].sort();catalogMessage.value=`Catálogo ampliado: ${catalog.value.length} monedas disponibles.`
  }catch(e){catalogMessage.value=`No fue posible ampliar el catálogo: ${e instanceof Error?e.message:'red no disponible'}`}
  finally{catalogBusy.value=false}
}
function review(){
  notice.value='F15 presenta la configuración por cuenta sin transformarla. El guardado por cuenta requiere una Lambda que preserve las listas y autorice al suscriptor.'
  step.value=5
}
function attemptSave(){
  notice.value='Guardado F15 protegido: no se enviaron cambios a DynamoDB. Se requiere adaptar el contrato de escritura a listas por cuenta y autenticar al usuario antes de habilitarlo.'
}
function openDemo(e:string){modal.value=e;demoKey.value='';demoSecret.value=''}
function closeDemo(){modal.value='';demoKey.value='';demoSecret.value=''}
onMounted(()=>{void load();void loadCatalog()})
</script>

<template>
 <main class="mx-auto w-full min-w-0 max-w-[1650px] space-y-4 px-3 pb-10 text-slate-900 sm:px-5 lg:px-7">
  <header class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-widest text-emerald-700">LedaBot · Área personal</p><h1 class="mt-1 text-3xl font-extrabold">Mi perfil</h1><p class="text-sm text-slate-500">Configuración por mercado, moneda y cuenta, consultada desde DynamoDB.</p></div><span class="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">SUBSCRIBER · {{session?.subscriberId||'—'}}</span></header>
  <section class="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><div><p class="text-xs text-slate-500">Correo</p><p class="break-all font-semibold">{{session?.email||'—'}}</p></div><div><p class="text-xs text-slate-500">Rol</p><p class="font-semibold">{{session?.rol||'—'}}</p></div><div><p class="text-xs text-slate-500">Suscriptor</p><p class="font-semibold">{{session?.subscriberId||'—'}}</p></div><div><p class="text-xs text-slate-500">Último cambio AWS</p><p>{{formattedDate}}</p><button class="text-sm font-semibold text-emerald-700 underline disabled:opacity-50" :disabled="busy" @click="load">Actualizar desde AWS</button></div></section>
  <nav class="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2 lg:grid-cols-4" aria-label="Secciones de Mi perfil"><button v-for="t in tabs" :key="t.id" class="rounded-xl px-2 py-3 text-sm font-medium" :class="tab===t.id?'bg-emerald-50 text-emerald-800':'text-slate-600 hover:bg-slate-50'" @click="tab=t.id">{{t.name}}</button></nav>
  <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{{error}}</p><p v-if="notice" role="status" class="rounded-xl bg-sky-50 p-4 text-sm text-sky-800">{{notice}}</p>
  <template v-if="tab==='trading'">
   <section class="rounded-2xl border bg-white p-5 shadow-sm"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-lg font-bold">Perfil de riesgo general</h2><p class="text-xs text-slate-500">Independiente de cada mercado, moneda o cuenta.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{{risks.find(r=>r.id===generalRisk)?.label}}</span></div><div class="grid gap-3 sm:grid-cols-3"><button v-for="r in risks" :key="r.id" class="rounded-xl border p-4 text-left" :class="generalRisk===r.id?'border-emerald-500 bg-emerald-50':'border-slate-200'" @click="generalRisk=r.id"><strong class="block">{{r.label}} {{generalRisk===r.id?'✓':''}}</strong><span class="text-xs text-slate-500">{{r.description}}</span></button></div><p v-if="generalRisk!==savedRisk" class="mt-3 text-xs text-amber-700">Riesgo general cambiado en pantalla; todavía no sincronizado.</p></section>
   <section class="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-lg font-bold">Configuración de estrategia</h2><p class="text-xs text-slate-500">Mercado → Moneda → Cuenta → Preferencias → Revisar</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold">{{market.toUpperCase()}} / {{quote}}</span></div>
    <div class="mt-5 grid grid-cols-5 gap-1 border-b pb-5 text-center text-xs"><button v-for="(name,i) in ['Mercado','Moneda','Cuenta','Preferencias','Revisar']" :key="name" class="rounded-lg px-1 py-3" :class="step===i+1?'bg-emerald-50 font-bold text-emerald-800':'text-slate-500'" @click="step=i+1">{{i+1}}. {{name}}</button></div>
    <div v-if="step===1" class="space-y-4 py-5"><h3 class="font-bold">1. Selecciona el mercado</h3><div class="grid gap-3 sm:grid-cols-2"><button v-for="m in marketOptions" :key="m" class="rounded-xl border p-5 text-left font-semibold" :class="market===m?'border-emerald-500 bg-emerald-50':''" @click="changeMarket(m)">{{m==='spot'?'Spot':'Futures'}} {{market===m?'✓':''}}</button></div><div class="rounded-xl bg-slate-50 p-3 text-sm">Estado en DynamoDB: <strong>{{currentMarket.enabled===true?'Habilitado':'Deshabilitado'}}</strong>. La habilitación se editará con el backend compatible con cuentas; el frontend no alterará el JSON todavía.</div></div>
    <div v-else-if="step===2" class="space-y-4 py-5"><h3 class="font-bold">2. Selecciona la moneda</h3><div class="flex flex-wrap gap-3"><label class="text-sm">Par <select v-model="quote" class="ml-2 rounded-lg border px-3 py-2"><option>USDT</option><option>USDC</option></select></label><input v-model="search" class="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Buscar BTC, ETH, SOL..." /></div><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><button v-for="s in visibleCoins" :key="s" class="rounded-xl border p-3 text-left hover:bg-emerald-50" @click="chooseSymbol(s)"><strong>{{s}}/{{quote}}</strong><span class="block text-xs text-slate-500">{{displayRule(symbolMap[s+quote])}}</span></button></div><div class="flex items-center justify-between text-sm"><span>Página {{page}} de {{totalPages}}</span><div class="flex gap-2"><button class="rounded-lg border px-3 py-2" :disabled="page===1" @click="page--">Anterior</button><button class="rounded-lg border px-3 py-2" :disabled="page>=totalPages" @click="page++">Siguiente</button></div></div></div>
    <div v-else-if="step===3" class="space-y-4 py-5"><h3 class="font-bold">3. Configuración por cuenta — {{symbol}}</h3><p class="text-sm text-slate-500">Una moneda puede contener varias reglas. Cada una se muestra por separado y ninguna se sobrescribe.</p><template v-if="currentRules.length"><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><button v-for="(rule,i) in currentRules" :key="i" class="rounded-xl border p-4 text-left" :class="accountIndex===i?'border-emerald-500 bg-emerald-50':''" @click="setAccount(i)"><strong>Configuración {{i+1}}</strong><span class="mt-1 block break-all text-xs text-slate-600">{{stringList(rule.accounts).join(', ')||'Sin cuenta específica'}}</span><span class="mt-2 block text-xs">{{rule.enabled?'Habilitada':'Deshabilitada'}} · {{rule.style||'Sin estilo'}}</span></button></div><p v-if="isMulti" class="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">DynamoDB contiene una lista de reglas para esta moneda. F15 preserva la lista completa.</p></template><p v-else class="rounded-xl border border-dashed p-4 text-sm text-slate-500">Esta moneda no tiene reglas guardadas. Podrás crear una configuración por cuenta cuando habilitemos el contrato seguro del backend.</p><p v-if="linkedAccounts.length" class="text-xs text-slate-500">Cuentas referenciadas: {{linkedAccounts.join(', ')}}. La lista completa de cuentas requiere un endpoint de consulta específico.</p></div>
    <div v-else-if="step===4" class="space-y-5 py-5"><h3 class="font-bold">4. Preferencias — {{symbol}} · {{readableAccount}}</h3><p class="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">Vista previa local. Los cambios no se envían a AWS hasta que la Lambda soporte edición granular por cuenta y autorización.</p><label class="flex items-center gap-2 text-sm"><input v-model="draftEnabled" type="checkbox" @change="draftChanges=true" /> Habilitar esta configuración</label><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm">Estilo<select v-model="draftStyle" class="mt-1 w-full rounded-lg border p-3" @change="draftChanges=true"><option>SCALP</option><option>SWING</option><option>POSITION</option></select></label><label class="text-sm">Riesgo por cuenta<select v-model="draftRisk" class="mt-1 w-full rounded-lg border p-3" @change="draftChanges=true"><option v-for="r in risks" :key="r.id" :value="r.id">{{r.label}}</option></select></label></div><div><strong class="text-sm">Temporalidades</strong><div class="mt-2 flex flex-wrap gap-2"><button v-for="tf in timeframes" :key="tf.id" class="rounded-lg border px-4 py-2 text-sm" :class="draftTF.includes(tf.id)?'border-emerald-400 bg-emerald-50':''" @click="setDraftTF(tf.id)">{{tf.name}}</button></div><p class="mt-2 text-xs text-slate-500">Sin selección = temporalidades heredadas, según configuración global.</p></div><div><strong class="text-sm">Exchanges</strong><div class="mt-2 flex flex-wrap gap-2"><button v-for="e in ['bingx','binance','bybit','okx']" :key="e" class="rounded-lg border px-4 py-2 text-sm" :class="draftExchanges.includes(e)?'border-emerald-400 bg-emerald-50':''" @click="toggleEx(e)">{{e}}</button></div></div><div v-if="selectedRule?.overrides" class="rounded-xl bg-slate-50 p-3 text-xs">Excepciones existentes: {{Object.keys(selectedRule.overrides).length}} campo(s). Se conservan íntegramente en AWS.</div></div>
    <div v-else class="space-y-4 py-5"><h3 class="font-bold">5. Revisión antes de guardar</h3><div class="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><strong>Mercado:</strong> {{market}}</p><p><strong>Moneda:</strong> {{symbol}}</p><p><strong>Cuenta(s):</strong> {{readableAccount}}</p><p><strong>Estado:</strong> {{draftEnabled?'Habilitada':'Deshabilitada'}}</p><p><strong>Estilo:</strong> {{draftStyle}}</p><p><strong>Riesgo:</strong> {{draftRisk}}</p><p><strong>Temporalidades:</strong> {{draftTF.join(', ')||'Heredadas'}}</p><p><strong>Exchanges:</strong> {{draftExchanges.join(', ')||'Sin asignar'}}</p></div><p v-if="draftChanges" class="rounded-lg bg-sky-50 p-3 text-xs">Tienes cambios visuales pendientes que todavía no se han enviado.</p><p class="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">El guardado se mantiene protegido: no cambiaremos reglas reales con la Lambda F12, que no admite listas por cuenta.</p></div>
    <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><button class="rounded-lg border px-4 py-2" :disabled="step===1" @click="step--">← Anterior</button><button v-if="step<5" class="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white" @click="step===4?review():step++">Siguiente →</button><button v-else class="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white" @click="attemptSave">Guardar configuración (próxima integración)</button></div>
   </section>
  </template>
  <section v-else-if="tab==='monedas'" class="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-bold">Monedas habilitadas</h2><p class="text-xs text-slate-500">Catálogo disponible + símbolos existentes en AWS. Las cuentas se mantienen independientes.</p></div><span class="rounded-full bg-emerald-50 px-3 py-1 text-sm">{{enabledCoins}} activas · {{available.length}} disponibles</span></div><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label class="text-xs">Mercado<select v-model="market" class="mt-1 w-full rounded-lg border p-3"><option value="spot">Spot</option><option value="futures">Futures</option></select></label><label class="text-xs">Par<select v-model="quote" class="mt-1 w-full rounded-lg border p-3"><option>USDT</option><option>USDC</option></select></label><label class="text-xs">Estado<select v-model="statusFilter" class="mt-1 w-full rounded-lg border p-3"><option value="all">Todas</option><option value="enabled">Habilitadas</option><option value="disabled">Deshabilitadas</option><option value="configured">Configuradas</option></select></label><label class="text-xs">Buscar<input v-model="search" class="mt-1 w-full rounded-lg border p-3" placeholder="BTC, SOL, ETH..." /></label></div><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-xs text-slate-500">{{displayed.length}} resultados · página {{page}} de {{totalPages}}</p><button class="rounded-lg border px-4 py-2 text-sm" :disabled="catalogBusy" @click="moreCatalog">Cargar más monedas</button></div><p v-if="catalogMessage" class="text-xs text-slate-600">{{catalogMessage}}</p><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><button v-for="s in visibleCoins" :key="s" class="rounded-xl border p-4 text-left hover:bg-emerald-50" @click="chooseSymbol(s)"><strong>{{s}}/{{quote}}</strong><span class="mt-1 block text-xs text-slate-500">{{displayRule(symbolMap[s+quote])}}</span><span class="mt-2 block text-xs text-emerald-700">Configurar →</span></button></div><div class="flex justify-end gap-2 border-t pt-4"><button class="rounded-lg border px-4 py-2" :disabled="page===1" @click="page--">Anterior</button><button class="rounded-lg border px-4 py-2" :disabled="page>=totalPages" @click="page++">Siguiente</button></div></section>
  <section v-else-if="tab==='apis'" class="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><h2 class="text-lg font-bold">Exchanges</h2><p class="text-sm text-slate-500">Conexiones demostrativas. No ingreses API keys ni secretos reales.</p><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><button v-for="ex in ['bingx','binance','bybit','okx']" :key="ex" class="rounded-xl border p-5 text-left hover:bg-emerald-50" @click="openDemo(ex)"><strong class="capitalize">{{ex}}</strong><span class="mt-2 block text-xs text-emerald-700">Configurar conexión (demo)</span></button></div><div v-if="modal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" @click.self="closeDemo"><div role="dialog" aria-modal="true" class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"><h3 class="text-lg font-bold">{{modal}} · conexión demostrativa</h3><p class="text-xs text-amber-800">No introducir claves reales. Los campos no se guardan ni transmiten.</p><label class="block text-sm">API_KEY (solo ficticia)<input v-model="demoKey" autocomplete="off" class="mt-1 w-full rounded-lg border p-3" /></label><label class="block text-sm">SECRET_KEY (solo ficticia)<input v-model="demoSecret" type="password" autocomplete="off" class="mt-1 w-full rounded-lg border p-3" /></label><button class="rounded-lg bg-emerald-600 px-4 py-2 text-white" @click="closeDemo">Cerrar sin guardar</button></div></div></section>
  <section v-else class="rounded-2xl border bg-white p-5 shadow-sm"><h2 class="text-lg font-bold">Historial de cambios</h2><p class="mt-2 text-sm">Última actualización de perfil: {{formattedDate}}</p><p class="mt-2 text-xs text-slate-500">DynamoDB devuelve updatedAt, pero todavía no dispone de auditoría detallada por moneda, cuenta o campo.</p></section>
 </main>
</template>
