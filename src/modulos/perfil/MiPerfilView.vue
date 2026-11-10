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
onMounted(()=>{void consultar()})
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
 <div v-if="confirmar" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" @click.self="confirmar=false"><div role="dialog" aria-modal="true" aria-labelledby="confirmar-riesgo" class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h3 id="confirmar-riesgo" class="text-xl font-extrabold">Confirmar cambio de perfil</h3><p class="mt-2 text-sm text-slate-600">Guardaras el perfil <strong>{{riesgoNombre}}</strong> en DynamoDB para este suscriptor. No cambiara limites de trading ni habilitara operaciones.</p><div class="mt-5 flex justify-end gap-2"><button class="rounded-xl border border-slate-200 px-4 py-2" @click="confirmar=false">Cancelar</button><button class="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white" @click="guardar">Confirmar</button></div></div></div>
</main>
</template>
