<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
const correo = ref('')
const error = ref('')
const cargando = ref(false)
const router = useRouter()
async function entrar() {
  if (cargando.value) return
  error.value = ''
  cargando.value = true
  try {
    const base = (import.meta.env.VITE_PERFILES_API_URL || 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/, '')
    const response = await fetch(base + '/consultar', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:correo.value.trim().toLowerCase()})})
    if (!response.ok) throw new Error('No se pudo verificar el registro. Intenta nuevamente.')
    const result = await response.json() as {exists:boolean,profile?:{displayName:string,role:string,status:string,subscriberId:string|null}}
    if (!result.exists) { await router.push({path:'/registro',query:{email:correo.value.trim().toLowerCase()}}); return }
    if (!result.profile || result.profile.status !== 'active') {
      error.value = 'Tu cuenta no está activa. Contacta al administrador.'
      return
    }
    // Identificacion visual; no habilita permisos de backend.
    sessionStorage.setItem('lerabot_perfil_visual', JSON.stringify({email:correo.value.trim().toLowerCase(),...result.profile}))
    await router.push('/dashboard')
  } catch(e) {error.value=e instanceof Error?e.message:'Error de conexion'}
  finally {cargando.value=false}
}
</script>

<template>
 <main class="login-fullscreen relative isolate flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 text-slate-900 sm:px-6">
  <div aria-hidden="true" class="absolute inset-0 -z-30 bg-[#042c29]"></div>
  <div aria-hidden="true" class="absolute inset-0 -z-20 bg-cover bg-center opacity-40 blur-xl" style="background-image: url('/ledabot-login-panel.png')"></div>
  <img aria-hidden="true" src="/ledabot-login-panel.png" alt="" class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-90" />
  <div aria-hidden="true" class="absolute inset-0 -z-10 bg-slate-950/25"></div>
  <section class="w-full max-w-[460px] rounded-[26px] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-9">
   <div class="mb-6 flex items-center gap-3"><span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">L</span><div><p class="text-xl font-extrabold">LedaBot</p><p class="text-xs text-slate-500">Portafolio cripto</p></div></div>
   <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Bienvenido a LedaBot</h1><p class="mt-2 text-sm text-slate-500">Ingresa tu correo para continuar</p>
   <form class="mt-6 space-y-4" @submit.prevent="entrar"><label class="block text-sm font-semibold" for="correo-lerabot">Correo electrónico<input id="correo-lerabot" v-model="correo" type="email" name="email" autocomplete="email" required placeholder="tu@correo.com" class="mt-2 block h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-emerald-500"/></label><button type="submit" :disabled="cargando" class="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{{cargando?'Validando…':'Continuar con correo →'}}</button><p v-if="error" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{error}}</p></form>
   <p class="mt-5 text-center text-sm text-slate-600">¿No tienes cuenta? <a href="/registro" class="font-semibold text-emerald-700">Crear cuenta</a></p>
  </section>
 </main>
</template>
<style scoped>
.login-fullscreen {min-height:100vh;min-height:100dvh}
@media(max-height:600px) {.login-fullscreen{overflow-y:auto;align-items:flex-start}}
</style>
