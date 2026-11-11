<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { sesionDemo } from '../login/sesionDemo'
type Riesgo = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
const sesion=sesionDemo()
const riesgo=ref<Riesgo>('MODERATE'), original=ref<Riesgo>('MODERATE')
const cargando=ref(false), guardando=ref(false), mensaje=ref(''), error=ref(''), confirmar=ref(false)
const opciones: {valor:Riesgo;nombre:string;texto:string}[]=[
 {valor:'CONSERVATIVE',nombre:'Conservador',texto:'Exposicion reducida'},
 {valor:'MODERATE',nombre:'Moderado',texto:'Equilibrio de riesgo'},
 {valor:'AGGRESSIVE',nombre:'Agresivo',texto:'Mayor tolerancia'}]
const riesgoNombre=computed(()=>opciones.find(o=>o.valor===riesgo.value)?.nombre||'Moderado')
type Mercado = 'SPOT' | 'FUTURES'
const mercado = ref<Mercado>('SPOT')
const par = ref('USDT')
const monedaFiltro = ref('TODAS')
const temporalidad = ref('1h')
const exchangeElegido = ref('BingX')
const avisoPreferencias = ref('')
const mercados = ['SPOT','FUTURES'] as const
const temporalidades = ['5m','15m','1h','4h','1d','1w']
const exchanges = ['BingX','Binance','Bybit','OKX']
const monedas = ['TODAS','BTC','ETH','XRP','SOL','BNB']
const clavePreferencias = `lerabot_preferencias_demo_${sesion?.subscriberId || 'sin-id'}`
function cargarPreferencias() {
  try {
    const p = JSON.parse(localStorage.getItem(clavePreferencias) || '{}') as Record<string, unknown>
    if (typeof p.mercado === 'string' && (mercados as readonly string[]).includes(p.mercado)) {
      mercado.value = p.mercado as Mercado
    }
    if (typeof p.par === 'string' && ['USDT', 'USDC'].includes(p.par)) {
      par.value = p.par
    }
    if (typeof p.monedaFiltro === 'string' && monedas.includes(p.monedaFiltro)) {
      monedaFiltro.value = p.monedaFiltro
    }
    if (typeof p.temporalidad === 'string' && temporalidades.includes(p.temporalidad)) {
      temporalidad.value = p.temporalidad
    }
    if (typeof p.exchangeElegido === 'string' && exchanges.includes(p.exchangeElegido)) {
      exchangeElegido.value = p.exchangeElegido
    }
  } catch {
    // Sin preferencias previas o almacenamiento no disponible.
  }
}
function guardarPreferencias() { try {localStorage.setItem(clavePreferencias,JSON.stringify({mercado:mercado.value,par:par.value,monedaFiltro:monedaFiltro.value,temporalidad:temporalidad.value,exchangeElegido:exchangeElegido.value}));avisoPreferencias.value='Preferencias de visualizacion guardadas solo en este navegador. No se envian a AWS ni habilitan trading.'}catch {avisoPreferencias.value='No se pudo usar el almacenamiento local.'} }
const base=(import.meta.env.VITE_PERFILES_API_URL||'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/,'')
async function consultar(){if(!sesion)return;cargando.value=true;error.value='';try{
 const r=await fetch(base+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:sesion.email,action:'profile'})})
 const data=await r.json() as {exists?:boolean;profile?:{subscriberId?:string|null;riskProfileRequested?:string};error?:string}
 if(!r.ok||!data.exists)throw Error(data.error||'Perfil no encontrado')
 if(sesion.rol==='SUBSCRIBER'&&data.profile?.subscriberId!==sesion.subscriberId)throw Error('El perfil no coincide con tu sesion de prueba')
 const raw=data.profile?.riskProfileRequested;const validado=opciones.find(x=>x.valor===raw)
 original.value=validado?.valor||'MODERATE';riesgo.value=original.value
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo leer el perfil'}finally{cargando.value=false}}
async function guardar(){if(!sesion||sesion.rol!=='SUBSCRIBER'||!sesion.subscriberId)return;confirmar.value=false;guardando.value=true;error.value='';mensaje.value='';try{
 const r=await fetch(base+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'updateRisk',email:sesion.email,subscriberId:sesion.subscriberId,riskProfileRequested:riesgo.value})})
 const data=await r.json() as {ok?:boolean;error?:string}
 if(!r.ok||!data.ok)throw Error(data.error||'No se guardo la preferencia')
 original.value=riesgo.value;mensaje.value='Preferencia guardada en DynamoDB. Spot y Futures siguen desactivados.'
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo guardar'}finally{guardando.value=false}}
onMounted(()=>{cargarPreferencias();void consultar()})
</script>
<template>
<main class="mx-auto max-w-5xl space-y-5 text-[#102c37]">
 <header><p class="text-xs font-bold uppercase tracking-widest text-emerald-700">LERABOT · Area personal</p><h1 class="mt-1 text-3xl font-extrabold">Mi perfil</h1><p class="mt-1 text-sm text-slate-500">Preferencias de prueba guardadas en DynamoDB. No activan operaciones.</p></header>
 <div class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Modo desarrollo: solo correo. No es autenticacion ni privacidad real. No utilizar con datos financieros personales en una API publica.</div>
 <section class="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
  <div><p class="text-xs text-slate-500">Correo</p><p class="mt-1 break-all font-semibold">{{sesion?.email||'—'}}</p></div>
  <div><p class="text-xs text-slate-500">Rol</p><p class="mt-1 font-semibold">{{sesion?.rol||'—'}}</p></div>
  <div><p class="text-xs text-slate-500">ID de suscriptor</p><p class="mt-1 font-semibold">{{sesion?.subscriberId||'—'}}</p></div>
 </section>
 <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div class="flex flex-wrap justify-between gap-2"><div><h2 class="text-xl font-bold">Perfil de riesgo</h2><p class="mt-1 text-sm text-slate-500">Selecciona una preferencia personal. Los parametros operativos aun no se activan.</p></div><button class="text-sm text-emerald-700 underline" :disabled="cargando" @click="consultar">Actualizar desde AWS</button></div>
  <div class="mt-4 grid gap-3 sm:grid-cols-3"><button v-for="o in opciones" :key="o.valor" type="button" :disabled="cargando||sesion?.rol!=='SUBSCRIBER'" class="rounded-xl border p-4 text-left transition" :class="riesgo===o.valor?'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500':'border-slate-200 hover:border-emerald-200'" @click="riesgo=o.valor"><p class="font-bold">{{o.nombre}} <span v-if="riesgo===o.valor" class="text-emerald-700">✓</span></p><p class="mt-1 text-xs text-slate-500">{{o.texto}}</p></button></div>
  <div class="mt-4 flex flex-wrap items-center gap-3"><button type="button" class="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="sesion?.rol!=='SUBSCRIBER'||riesgo===original||guardando||cargando" @click="confirmar=true">{{guardando?'Guardando...':'Guardar en DynamoDB'}}</button><p class="text-xs text-slate-500">Spot / Futures: no se modifican.</p></div>
  <p v-if="mensaje" role="status" class="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{{mensaje}}</p><p v-if="error" role="alert" class="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{error}}</p>
 </section>
 <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <h2 class="text-xl font-bold">Preferencias de seguimiento</h2>
  <p class="mt-1 text-sm text-slate-500">Configura que deseas visualizar. No son instrucciones de ejecucion de trades ni limites de riesgo operativos.</p>
  <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
   <label class="text-sm font-semibold">Mercado<select v-model="mercado" class="mt-1 w-full rounded-xl border p-3"><option v-for="v in mercados" :key="v" :value="v">{{ v }}</option></select></label>
   <label class="text-sm font-semibold">Par de cotizacion<select v-model="par" class="mt-1 w-full rounded-xl border p-3"><option>USDT</option><option>USDC</option></select></label>
   <label class="text-sm font-semibold">Criptomoneda<select v-model="monedaFiltro" class="mt-1 w-full rounded-xl border p-3"><option v-for="v in monedas" :key="v">{{v}}</option></select></label>
   <label class="text-sm font-semibold">Temporalidad<select v-model="temporalidad" class="mt-1 w-full rounded-xl border p-3"><option v-for="v in temporalidades" :key="v">{{v}}</option></select></label>
   <label class="text-sm font-semibold">Exchange preferido<select v-model="exchangeElegido" class="mt-1 w-full rounded-xl border p-3"><option v-for="v in exchanges" :key="v">{{v}}</option></select></label>
  </div>
  <p class="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Resumen: {{mercado}} · {{monedaFiltro==='TODAS'?'Todas':monedaFiltro}}/{{par}} · {{temporalidad}} · {{exchangeElegido}} · Riesgo {{riesgoNombre}}</p>
  <button class="mt-3 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white" @click="guardarPreferencias">Guardar preferencias locales</button>
  <p v-if="avisoPreferencias" class="mt-2 text-xs text-emerald-800" role="status">{{avisoPreferencias}}</p>
  <p class="mt-2 text-xs text-amber-800">Solo el riesgo se guarda en DynamoDB mediante el flujo F10.4 existente. Estas preferencias no se sincronizan entre dispositivos.</p>
 </section>
 <div v-if="confirmar" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" @click.self="confirmar=false"><div role="dialog" aria-modal="true" aria-labelledby="confirmar-riesgo" class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h3 id="confirmar-riesgo" class="text-xl font-extrabold">Confirmar cambio de perfil</h3><p class="mt-2 text-sm text-slate-600">Guardaras el perfil <strong>{{riesgoNombre}}</strong> en DynamoDB para este suscriptor. No cambiara limites de trading ni habilitara operaciones.</p><div class="mt-5 flex justify-end gap-2"><button class="rounded-xl border border-slate-200 px-4 py-2" @click="confirmar=false">Cancelar</button><button class="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white" @click="guardar">Confirmar</button></div></div></div>
</main>
</template>
