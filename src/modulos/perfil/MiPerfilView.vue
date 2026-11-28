<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue'
import {consultarMercado} from '../mercado/servicio'
import {sesionDemo} from '../login/sesionDemo'
type Market='spot'|'futures'
type Risk='CONSERVATIVE'|'MODERATE'|'AGGRESSIVE'
type Rule={enabled?:boolean;profile?:string;style?:string;accounts?:string[];[key:string]:unknown}
type Obj=Record<string,unknown>
type Profile={subscriberId?:string;tradingPreferences?:Obj;updatedAt?:string}
type Edit={market:Market;symbol:string;account:string;index:number;style:string;profile:Risk;enabled:boolean}
const session=sesionDemo()
const endpoint=String(import.meta.env.VITE_PERFILES_API_URL||'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/,'')
const market=ref<Market>('spot'),quote=ref<'USDT'|'USDC'>('USDT'),selectedSymbol=ref(''),selectedAccount=ref(''),selectedIndex=ref(0)
const config=ref<Obj>({spot:{enabled:false,symbols:{}},futures:{enabled:false,symbols:{}}})
const marketDraft=ref<Record<Market,boolean>>({spot:false,futures:false})
const edits=ref<Record<string,Edit>>({})
const newCoins=ref<{market:Market;symbol:string}[]>([])
const catalog=ref<string[]>(['BTC','ETH','SOL','XRP','ADA','BNB','AVAX','DOGE','DOT','LINK','LTC','TRX'])
const search=ref(''),catalogPage=ref(1),catalogOpen=ref(false),busy=ref(false),catalogBusy=ref(false),error=ref(''),notice=ref(''),updatedAt=ref(''),reviewOpen=ref(false)
const options=['POSITION','SCALP','SWING','INTRADAY','MACRO']
const risks:{id:Risk;name:string}[]=[{id:'CONSERVATIVE',name:'Conservador'},{id:'MODERATE',name:'Moderado'},{id:'AGGRESSIVE',name:'Agresivo'}]
function isObj(x:unknown):x is Obj{return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function ob(x:unknown):Obj{return isObj(x)?x:{}}
function risk(x:unknown):Risk{return x==='CONSERVATIVE'||x==='AGGRESSIVE'?x:'MODERATE'}
function rules(x:unknown):Rule[]{return Array.isArray(x)?x.filter(isObj) as Rule[]:isObj(x)?[x as Rule]:[]}
function safeId(x:string){return x.replace(/^acct_/,'').replace(/_trd$/,'').replace(/_/g,' ').replace(/\b(binance|bingx|spot|futures)\b/gi,x=>x.toUpperCase())}
const marketData=computed(()=>ob(config.value[market.value]))
const symbolData=computed(()=>ob(marketData.value.symbols))
const configured=computed(()=>Object.keys(symbolData.value).filter(s=>rules(symbolData.value[s]).length>0&&s.endsWith(quote.value)).sort())
const symbolRules=computed(()=>rules(symbolData.value[selectedSymbol.value]))
const accounts=computed(()=>[...new Set(symbolRules.value.flatMap(r=>Array.isArray(r.accounts)?r.accounts.filter((x):x is string=>typeof x==='string'):[]))].sort())
const accountRules=computed(()=>symbolRules.value.map((r,index)=>({rule:r,index})).filter(({rule})=>Array.isArray(rule.accounts)&&rule.accounts.includes(selectedAccount.value)))
const rule=computed(()=>symbolRules.value[selectedIndex.value])
const key=(m:Market,s:string,a:string,i:number)=>`${m}|${s}|${a}|${i}`
const editKey=computed(()=>key(market.value,selectedSymbol.value,selectedAccount.value,selectedIndex.value))
const edited=computed(()=>edits.value[editKey.value])
const styleValue=computed(()=>edited.value?.style??(typeof rule.value?.style==='string'?rule.value.style:'POSITION'))
const riskValue=computed(()=>edited.value?.profile??risk(rule.value?.profile))
const enabledValue=computed(()=>edited.value?.enabled??(rule.value?.enabled===true))
const catalogFiltered=computed(()=>catalog.value.map(s=>s+quote.value).filter(s=>!configured.value.includes(s)&&s.includes(search.value.trim().toUpperCase())))
const totalCatalogPages=computed(()=>Math.max(1,Math.ceil(catalogFiltered.value.length/24)))
const catalogVisible=computed(()=>catalogFiltered.value.slice((catalogPage.value-1)*24,catalogPage.value*24))
const changes=computed(()=>{
 const out:string[]=[]
 for(const coin of newCoins.value)out.push(`${coin.market.toUpperCase()} · ${coin.symbol}: añadir moneda (pendiente de configurar cuenta)`);
 for(const m of ['spot','futures'] as Market[]){if(marketDraft.value[m]!== (ob(config.value[m]).enabled===true))out.push(`${m.toUpperCase()}: ${marketDraft.value[m]?'habilitar':'deshabilitar'}`)}
 for(const value of Object.values(edits.value)){
  const rr=rules(ob(ob(config.value[value.market]).symbols)[value.symbol])[value.index]
  if(!rr)continue
  const prefix=`${value.market.toUpperCase()} · ${value.symbol} · ${safeId(value.account)}`
  if(value.style!==(typeof rr.style==='string'?rr.style:'POSITION'))out.push(`${prefix}: estilo ${String(rr.style||'POSITION')} → ${value.style}`)
  if(value.profile!==risk(rr.profile))out.push(`${prefix}: riesgo ${risk(rr.profile)} → ${value.profile}`)
  if(value.enabled!==(rr.enabled===true))out.push(`${prefix}: regla ${value.enabled?'habilitar':'deshabilitar'}`)
 }
 return out
})
const hasChanges=computed(()=>changes.value.length>0)
const saving=ref(false)
const saveError=ref('')
const canSaveAWS=computed(()=>newCoins.value.length===0&&changes.value.length>0)
function chooseMarket(m:Market){market.value=m;selectedSymbol.value='';selectedAccount.value='';selectedIndex.value=0;catalogOpen.value=false;selectDefaultSymbol()}
function selectDefaultSymbol(){const first=configured.value[0];if(first)chooseSymbol(first)}
function chooseSymbol(symbol:string){selectedSymbol.value=symbol;selectedAccount.value='';selectedIndex.value=0;const a=accounts.value[0];if(a)chooseAccount(a)}
function chooseAccount(account:string){selectedAccount.value=account;const first=accountRules.value[0];selectedIndex.value=first?first.index:0}
function chooseRule(index:number){selectedIndex.value=index}
function stage(field:'style'|'profile'|'enabled',val:string|boolean){if(!selectedAccount.value||!rule.value)return;const existing=edits.value[editKey.value]||{market:market.value,symbol:selectedSymbol.value,account:selectedAccount.value,index:selectedIndex.value,style:styleValue.value,profile:riskValue.value,enabled:enabledValue.value};edits.value[editKey.value]={...existing,[field]:val} as Edit}
watch(quote,()=>{catalogPage.value=1;selectedSymbol.value='';selectedAccount.value='';selectDefaultSymbol()})
watch(search,()=>{catalogPage.value=1})
async function load(){if(session?.rol!=='SUBSCRIBER')return;busy.value=true;error.value='';try{const r=await fetch(endpoint+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile',email:session.email}),cache:'no-store'});const payload=await r.json() as {ok?:boolean;exists?:boolean;profile?:Profile;error?:string};if(!r.ok||!payload.ok||!payload.exists||!payload.profile)throw Error(payload.error||'No se encontró el perfil');if(payload.profile.subscriberId!==session.subscriberId)throw Error('Perfil y sesión no coinciden');config.value=JSON.parse(JSON.stringify(payload.profile.tradingPreferences||{})) as Obj;updatedAt.value=payload.profile.updatedAt||'';marketDraft.value={spot:ob(config.value.spot).enabled===true,futures:ob(config.value.futures).enabled===true};edits.value={};newCoins.value=[];selectedSymbol.value='';selectedAccount.value='';selectDefaultSymbol();notice.value=''}catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar el perfil'}finally{busy.value=false}}
async function extendCatalog(){catalogBusy.value=true;try{const found=new Set(catalog.value);for(let i=1;i<=10;i++){const response=await consultarMercado(i,100);for(const row of response.monedas||[]){const ticker=String(row.simbolo||'').toUpperCase();if(/^[A-Z0-9]{2,15}$/.test(ticker))found.add(ticker)}if((response.monedas||[]).length<100)break}catalog.value=[...found].sort()}catch{notice.value='El catálogo externo no está disponible; puedes usar las monedas ya cargadas.'}finally{catalogBusy.value=false}}
function pickCoin(s:string){if(!newCoins.value.some(x=>x.market===market.value&&x.symbol===s))newCoins.value.push({market:market.value,symbol:s});selectedSymbol.value=s;selectedAccount.value='';catalogOpen.value=false;notice.value='La moneda nueva está seleccionada. La creación de reglas requiere autorización en el backend.'}
const localKey='ledabot_f19_3_draft_'+(session?.subscriberId||'demo')
async function saveAws(){
 if(!canSaveAWS.value){saveError.value='Para agregar una moneda nueva, primero se necesita asignarle una cuenta. No se ha guardado nada.';return}
 if(!session?.email||!session.subscriberId||!updatedAt.value){saveError.value='Falta la referencia del perfil en AWS.';return}
 saving.value=true;saveError.value=''
 try{
  const payload={action:'updateAccountStrategies',email:session.email,subscriberId:session.subscriberId,expectedUpdatedAt:updatedAt.value,
   markets:{spot:marketDraft.value.spot,futures:marketDraft.value.futures},
   edits:Object.values(edits.value).map(e=>({market:e.market,symbol:e.symbol,account:e.account,index:e.index,style:e.style,profile:e.profile,enabled:e.enabled}))}
  const response=await fetch(endpoint+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  const data=await response.json() as {ok?:boolean;error?:string}
  if(!response.ok||!data.ok)throw new Error(data.error||'No se guardaron los cambios')
  reviewOpen.value=false
  try{sessionStorage.removeItem(localKey)}catch{ /* optional storage */ }
  await load()
  notice.value='Cambios confirmados por AWS y perfil actualizado.'
 }catch(err){saveError.value=err instanceof Error?err.message:'No se pudo guardar. Verifica la Lambda y los permisos.'}
 finally{saving.value=false}
}
function saveDraft(){try{sessionStorage.setItem(localKey,JSON.stringify({updatedAt:updatedAt.value,marketDraft:marketDraft.value,edits:edits.value,newCoins:newCoins.value}));notice.value='Borrador guardado solo en esta sesión. No se modificó DynamoDB.';reviewOpen.value=false}catch{error.value='No se pudo guardar el borrador local'}}
function restoreDraft(){try{const raw=sessionStorage.getItem(localKey);if(!raw)return;const saved=JSON.parse(raw) as {updatedAt:string;marketDraft:Record<Market,boolean>;edits:Record<string,Edit>;newCoins?:{market:Market;symbol:string}[]};if(saved.updatedAt!==updatedAt.value){notice.value='El borrador anterior corresponde a otra versión de AWS y no se cargó.';return}marketDraft.value=saved.marketDraft;edits.value=saved.edits;newCoins.value=saved.newCoins||[];notice.value='Borrador local recuperado.'}catch{notice.value='No se pudo recuperar el borrador.'}}
onMounted(async()=>{await load();restoreDraft();void extendCatalog()})
</script>
<template>
 <main class="mx-auto w-full max-w-[1650px] space-y-4 px-4 pb-10 pt-1 text-slate-900 sm:px-6 lg:px-8">
  <header class="flex flex-wrap items-center justify-between gap-3"><div class="flex flex-wrap items-center gap-2 text-sm text-slate-500"><span class="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">Estrategias por cuenta</span><span>Spot y Futures · Configuración personalizada</span></div><button class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50" :disabled="busy" @click="load"><span aria-hidden="true" :class="busy?'inline-block animate-spin':'inline-block'">↻</span> {{busy?'Actualizando…':'Actualizar desde AWS'}}</button></header>
  <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{{error}}</p>
  <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7">
   <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-lg font-bold">Mis estrategias</h2><span class="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-500"><span class="font-semibold text-emerald-700">{{session?.subscriberId}}</span><span aria-hidden="true">·</span>{{updatedAt?new Date(updatedAt).toLocaleDateString('es-PE'):'Sin actualización'}}</span></div>
   <div class="mt-4 grid gap-3 sm:grid-cols-2"><div v-for="m in (['spot','futures'] as Market[])" :key="m" class="flex min-h-[88px] items-center justify-between gap-2 rounded-2xl border p-3 sm:p-4" :class="market===m?'border-emerald-500 bg-emerald-50':'border-slate-200'"><button class="flex flex-1 items-center gap-3 text-left" @click="chooseMarket(m)"><span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg font-extrabold shadow-sm">{{m==='spot'?'S':'F'}}</span><span><strong class="block">{{m.toUpperCase()}}</strong><small class="text-xs text-slate-500">{{market===m?'Seleccionado':'Ver configuración'}}</small></span></button><label class="flex items-center gap-1 rounded-lg border bg-white px-2 py-2 text-xs"><input type="checkbox" :checked="marketDraft[m]" @change="marketDraft[m]=($event.target as HTMLInputElement).checked"/> Habilitado</label></div></div>
   <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div><h3 class="font-bold">1. Monedas configuradas</h3><p class="text-xs text-slate-500">{{market.toUpperCase()}} · {{configured.length}} monedas para {{quote}}</p></div><div class="flex gap-2"><select v-model="quote" class="rounded-lg border px-3 py-2 text-sm"><option>USDT</option><option>USDC</option></select><button class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" @click="catalogOpen=!catalogOpen">{{catalogOpen?'Cerrar catálogo':'+ Agregar moneda'}}</button></div></div>
   <div class="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"><button v-for="s in configured" :key="s" class="group min-h-[98px] min-w-[185px] flex-1 snap-start rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md sm:min-w-[215px]" :class="selectedSymbol===s?'border-emerald-500 bg-emerald-50':'hover:border-emerald-300'" @click="chooseSymbol(s)"><span class="flex items-center gap-2"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black" :class="s.startsWith('BTC')?'bg-amber-100 text-amber-700':s.startsWith('ETH')?'bg-indigo-100 text-indigo-700':s.startsWith('SOL')?'bg-violet-100 text-violet-700':s.startsWith('XRP')?'bg-sky-100 text-sky-700':'bg-emerald-100 text-emerald-700'">{{s.slice(0,1)}}</span><strong class="text-sm">{{s.replace(/(USDT|USDC)$/,'')}}/{{quote}}</strong></span><span class="mt-2 block text-xs text-slate-500">{{rules(symbolData[s]).length}} configuración(es)</span><span v-if="selectedSymbol===s" class="mt-1 block text-xs font-semibold text-emerald-700">✓ Seleccionada</span></button><p v-if="!configured.length" class="text-sm text-slate-500">Sin monedas configuradas para este par.</p></div>
   <div v-if="catalogOpen" class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><div class="flex items-center justify-between gap-2"><strong>Catálogo de monedas</strong><button class="rounded-lg border px-3 py-1 text-xs" :disabled="catalogBusy" @click="extendCatalog">{{catalogBusy?'Cargando…':'Actualizar'}}</button></div><input v-model="search" placeholder="Buscar monedas" class="mt-3 w-full rounded-lg border bg-white p-3 text-sm"/><div class="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5"><button v-for="s in catalogVisible" :key="s" class="rounded-lg border bg-white p-2 text-left text-sm hover:border-emerald-500" @click="pickCoin(s)">+ {{s}}</button></div><div class="mt-3 flex justify-between text-xs"><span>Página {{catalogPage}} de {{totalCatalogPages}}</span><div class="flex gap-2"><button class="rounded border px-3 py-2 disabled:opacity-40" :disabled="catalogPage===1" @click="catalogPage--">Anterior</button><button class="rounded border px-3 py-2 disabled:opacity-40" :disabled="catalogPage>=totalCatalogPages" @click="catalogPage++">Siguiente</button></div></div></div>
   <section v-if="selectedSymbol" class="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"><div class="flex flex-wrap items-center justify-between"><div><h3 class="text-lg font-bold">2. Selecciona tu cuenta</h3><p class="text-xs text-slate-500">{{selectedSymbol}} · {{market.toUpperCase()}}</p></div><span class="text-xs text-slate-500">{{accounts.length}} cuenta(s)</span></div>
    <div class="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"><button v-for="a in accounts" :key="a" class="min-h-[112px] min-w-[205px] max-w-[290px] flex-1 snap-start rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md" :class="selectedAccount===a?'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200':'hover:border-emerald-300'" @click="chooseAccount(a)"><strong class="block break-words text-sm">{{safeId(a)}}</strong><span class="mt-1 block break-all text-[11px] text-slate-500">{{a}}</span><span v-if="selectedAccount===a" class="mt-2 block text-xs font-semibold text-emerald-700">✓ Seleccionada</span></button><p v-if="!accounts.length" class="text-sm text-slate-500">No hay cuentas asociadas a esta moneda.</p></div>
    <div v-if="selectedAccount&&accountRules.length" class="mt-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-bold">3. Configuración de la cuenta <span class="ml-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{{market.toUpperCase()}} · {{selectedSymbol}}</span></h3><p class="text-xs text-slate-500">{{safeId(selectedAccount)}}</p></div><div v-if="accountRules.length>1" class="flex gap-2"><button v-for="item in accountRules" :key="item.index" class="rounded-lg border px-3 py-2 text-xs" :class="selectedIndex===item.index?'border-emerald-500 bg-emerald-50':''" @click="chooseRule(item.index)">Estrategia {{item.index+1}}</button></div></div><div class="mt-3 grid gap-3 sm:grid-cols-2"><label class="text-sm font-semibold">Estilo<select :value="styleValue" class="mt-2 block w-full rounded-lg border p-3 font-normal" @change="stage('style',($event.target as HTMLSelectElement).value)"><option v-for="s in options" :key="s">{{s}}</option></select></label><label class="text-sm font-semibold">Riesgo<select :value="riskValue" class="mt-2 block w-full rounded-lg border p-3 font-normal" @change="stage('profile',($event.target as HTMLSelectElement).value)"><option v-for="r in risks" :key="r.id" :value="r.id">{{r.name}}</option></select></label><label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" :checked="enabledValue" @change="stage('enabled',($event.target as HTMLInputElement).checked)"/> Habilitar estrategia</label></div><p v-if="Array.isArray(rule?.accounts)&&rule.accounts.length>1" class="mt-4 text-xs text-amber-700">Esta estrategia comparte reglas con otras cuentas. Los cambios por cuenta se mantienen como borrador independiente.</p></div>
   </section>
   <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span class="inline-flex items-center gap-2 text-xs text-slate-500"><span class="h-2 w-2 rounded-full" :class="hasChanges?'bg-amber-500':'bg-emerald-500'"></span>{{hasChanges?`${changes.length} cambio(s) pendiente(s)`:'Sin cambios pendientes'}}</span><div class="flex gap-2"><button class="rounded-xl border px-4 py-2 text-sm" @click="reviewOpen=true">Revisar cambios</button><button class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" :disabled="!hasChanges" @click="reviewOpen=true">Guardar cambios</button></div></div>
   <p v-if="notice && (!notice.toLowerCase().includes('catálogo externo') || catalogOpen)" role="status" class="mt-3 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-800">{{notice}}</p>
  </section>
  <div v-if="reviewOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" @click.self="reviewOpen=false"><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><h2 id="dialog-title" class="text-xl font-bold">Resumen de cambios</h2><p class="mt-1 text-sm text-slate-500">Confirma las preferencias preparadas antes de persistirlas.</p><ul v-if="changes.length" class="mt-4 max-h-64 space-y-2 overflow-auto"><li v-for="(c,i) in changes" :key="i" class="rounded-lg border bg-slate-50 p-3 text-sm">{{c}}</li></ul><p v-else class="mt-4 text-sm text-slate-500">No hay cambios pendientes.</p><p class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">El guardado requiere la Lambda de edición granular habilitada en un entorno de pruebas. No se envían credenciales de exchange.</p><p v-if="saveError" role="alert" class="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{saveError}}</p><div class="mt-5 flex flex-wrap justify-end gap-2"><button class="rounded-lg border px-4 py-2" @click="reviewOpen=false">Seguir editando</button><button class="rounded-lg border px-4 py-2" :disabled="!hasChanges" @click="saveDraft">Guardar borrador</button><button class="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40" :disabled="!canSaveAWS||saving" @click="saveAws">{{saving?'Guardando…':'Confirmar y guardar AWS'}}</button></div></section></div>
 </main>
</template>
