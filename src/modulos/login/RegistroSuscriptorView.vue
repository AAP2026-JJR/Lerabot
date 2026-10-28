<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
const router=useRouter()
const nombre=ref(''), correo=ref(''), telefono=ref(''), cargando=ref(false), error=ref(''), exito=ref('')
async function crear(){
 if(cargando.value)return
 error.value='';exito.value='';cargando.value=true
 try{
  const base=(import.meta.env.VITE_PERFILES_API_URL||'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/,'')
  const r=await fetch(base+'/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:nombre.value,email:correo.value,mobilePhone:telefono.value})})
  const data=await r.json().catch(()=>({})) as {error?:string,message?:string}
  if(!r.ok)throw new Error(data.error||'No se pudo registrar el perfil')
  exito.value='Cuenta creada. Está pendiente de verificar el correo para habilitar acceso a datos.'
  nombre.value='';correo.value='';telefono.value=''
 }catch(e){error.value=e instanceof Error?e.message:'Error inesperado'}finally{cargando.value=false}
}
</script>
<template>
 <main class="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-8">
 <section class="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
 <button class="text-sm text-emerald-700 hover:underline" @click="router.push('/login')">← Volver al login</button>
 <div class="mt-6 mb-7 flex items-center gap-3"><div class="grid size-12 place-items-center rounded-xl bg-emerald-600 text-2xl font-black text-white">L</div><div><h1 class="text-2xl font-extrabold">Crear cuenta</h1><p class="text-sm text-slate-500">LERABOT · Registro de suscriptor</p></div></div>
 <form class="space-y-5" @submit.prevent="crear">
 <div><label for="nombre" class="mb-1.5 block text-sm font-semibold">Nombre completo</label><input id="nombre" v-model.trim="nombre" required minlength="3" maxlength="100" autocomplete="name" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Nombre y apellido" /></div>
 <div><label for="correo" class="mb-1.5 block text-sm font-semibold">Correo electrónico</label><input id="correo" v-model.trim="correo" required type="email" maxlength="254" autocomplete="email" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" placeholder="tu@correo.com" /></div>
 <div><label for="telefono" class="mb-1.5 block text-sm font-semibold">Celular (opcional)</label><input id="telefono" v-model.trim="telefono" type="tel" maxlength="25" autocomplete="tel" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500" placeholder="+51 ..." /></div>
 <p class="text-xs text-slate-500">Tu cuenta se registra como suscriptor. Las preferencias de trading empiezan desactivadas; podrás configurarlas cuando tu cuenta esté habilitada.</p>
 <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</p><p v-if="exito" role="status" class="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{{ exito }}</p>
 <button :disabled="cargando" class="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{{cargando?'Registrando...':'Crear cuenta'}}</button>
 </form>
 </section></main>
</template>
