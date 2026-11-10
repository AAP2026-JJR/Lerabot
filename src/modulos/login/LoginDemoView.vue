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
  <main class="login-viewport bg-white text-slate-900 lg:grid lg:grid-cols-[49%_51%]">
    <section class="login-form-panel flex min-h-[100dvh] items-center justify-center px-6 py-8 sm:px-12 lg:min-h-0 lg:px-10 lg:py-5 xl:px-16">
      <div class="login-form-inner w-full max-w-[610px]">
        <div class="login-brand mb-9 flex items-center gap-4">
          <div class="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[20px] bg-gradient-to-br from-emerald-500 to-emerald-700 text-[38px] font-black text-white shadow-sm">L</div>
          <div>
            <p class="text-3xl font-extrabold tracking-tight text-slate-950">LERABOT</p>
            <p class="mt-1 text-base text-slate-500 sm:text-lg">Tu portafolio cripto, más inteligente</p>
          </div>
        </div>
        <header class="login-welcome mb-8">
          <h1 class="text-[clamp(1.85rem,2.8vw,3rem)] font-extrabold leading-tight tracking-tight text-slate-950">Bienvenido a LERABOT</h1>
          <p class="mt-3 text-lg text-slate-500 sm:text-xl">Ingresa tu correo para continuar hacia tu panel.</p>
        </header>
        <form class="login-form space-y-5" @submit.prevent="entrar">
          <div>
            <label for="correo-lerabot" class="mb-3 block text-lg font-semibold text-slate-900">Correo electrónico</label>
            <div class="flex h-[60px] items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 shadow-sm transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
              <svg class="h-6 w-6 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
              <input id="correo-lerabot" v-model="correo" type="email" name="email" autocomplete="email" inputmode="email" required placeholder="tu@correo.com" class="h-full min-w-0 w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400" />
            </div>
          </div>
          <button type="submit" :disabled="cargando" class="flex h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-lg font-semibold text-white shadow-lg shadow-emerald-600/10 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-60">
            {{ cargando ? 'Validando...' : 'Continuar con correo' }} <span aria-hidden="true">→</span>
          </button>
          <p v-if="error" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>
        </form>
        <p class="mt-4 text-center text-sm text-slate-600">¿No tienes cuenta? <a href="/registro" class="font-semibold text-emerald-700 hover:underline">Crear cuenta</a></p>
        <p class="login-notice mt-6 flex items-center gap-2 text-sm text-slate-500"><svg class="h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg> Tu panel de seguimiento de portafolio.</p>
      </div>
    </section>
    <aside class="relative hidden min-h-0 overflow-hidden bg-[#001c25] lg:block" aria-label="Vista ilustrativa de LERABOT">
      <img src="/lerabot-login-panel.png" alt="Vista gráfica de LERABOT con gráficos y seguimiento de portafolio" class="absolute inset-0 h-full w-full object-cover object-center" />
    </aside>
  </main>
</template>

<style scoped>
/* El login ocupa la ventana, sin desplazar la pagina en escritorio. */
.login-viewport { min-height: 100dvh; }
@media (min-width: 1024px) {
  .login-viewport { height: 100dvh; min-height: 0; overflow: hidden; }
  .login-form-panel { height: 100%; min-height: 0; overflow: hidden; }
  .login-form-inner { max-height: 100%; }
}
/* Pantallas de laptop con poca altura: reducir espacios antes que crear scroll. */
@media (min-width: 1024px) and (max-height: 800px) {
  .login-brand { margin-bottom: 1.25rem; }
  .login-welcome { margin-bottom: 1.3rem; }
  .login-welcome p { margin-top: .45rem; }
  .login-form { row-gap: .7rem; }
  .login-notice { margin-top: 1rem; }
}
@media (min-width: 1024px) and (max-height: 630px) {
  .login-brand { margin-bottom: .65rem; }
  .login-brand > div:first-child { width: 52px; height: 52px; font-size: 30px; }
  .login-welcome { margin-bottom: .7rem; }
  .login-welcome h1 { font-size: 1.65rem; }
  .login-welcome p { font-size: .9rem; }
  .login-form-panel { padding-top: .5rem; padding-bottom: .5rem; }
  .login-form label { margin-bottom: .35rem; }
  .login-form input { font-size: 1rem; }
  .login-form .h-\[60px\] { height: 46px; }
  .login-notice { margin-top: .55rem; font-size: .72rem; }
}
/* En celular no se debe cortar el formulario: scroll solo si realmente hace falta. */
@media (max-width: 1023px) { .login-viewport { overflow-x: hidden; } }
</style>