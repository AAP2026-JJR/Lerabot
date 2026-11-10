<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
type Riesgo = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
const nombre = ref('')
const correo = ref('')
const telefono = ref('')
const perfilRiesgo = ref<Riesgo>('MODERATE')
const cargando = ref(false)
const error = ref('')
const dialogo = ref<'confirmacion' | 'exito' | null>(null)
const nuevoId = ref('')
const opciones: { id: Riesgo; nombre: string; detalle: string; icono: string }[] = [
  { id: 'CONSERVATIVE', nombre: 'Conservador', detalle: 'Prioriza una exposicion menor', icono: '🛡' },
  { id: 'MODERATE', nombre: 'Moderado', detalle: 'Equilibrio entre riesgo y oportunidad', icono: '◈' },
  { id: 'AGGRESSIVE', nombre: 'Agresivo', detalle: 'Mayor exposicion potencial', icono: '↗' },
]
const elegido = computed(() => opciones.find(opcion => opcion.id === perfilRiesgo.value)?.nombre || 'Moderado')
function revisar() { if (!cargando.value) { error.value = ''; dialogo.value = 'confirmacion' } }
function cerrar() { if (!cargando.value) dialogo.value = null }
async function crear() {
  if (cargando.value) return
  error.value = ''
  cargando.value = true
  try {
    const base = (import.meta.env.VITE_PERFILES_API_URL || 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/perfiles').replace(/\/$/, '')
    const response = await fetch(base + '/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: nombre.value.trim(), email: correo.value.trim().toLowerCase(), mobilePhone: telefono.value.trim(), riskProfileRequested: perfilRiesgo.value }),
    })
    const payload = await response.json().catch(() => ({})) as { error?: string; subscriberId?: string }
    if (!response.ok) throw new Error(payload.error || 'No se pudo crear la cuenta')
    nuevoId.value = payload.subscriberId || ''
    dialogo.value = 'exito'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ocurrio un problema inesperado'
    dialogo.value = null
  } finally { cargando.value = false }
}
</script>

<template>
  <main class="min-h-[100dvh] bg-[#f4f8f7] flex items-center justify-center px-4 py-8 text-slate-900">
    <section class="w-full max-w-[570px] rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_55px_-30px_rgba(15,40,40,.3)] sm:p-9">
      <button type="button" class="text-sm font-medium text-emerald-700 hover:underline" @click="router.push('/login')">← Volver al login</button>
      <div class="mt-6 mb-7 flex items-center gap-3">
        <div class="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">L</div>
        <div><h1 class="text-2xl font-extrabold tracking-tight">Crear cuenta</h1><p class="text-sm text-slate-500">LERABOT · Nuevo suscriptor</p></div>
      </div>
      <form class="space-y-4" @submit.prevent="revisar">
        <div><label for="nombre" class="mb-1.5 block text-sm font-semibold">Nombre completo</label><input id="nombre" v-model.trim="nombre" required minlength="3" maxlength="100" autocomplete="name" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Nombre y apellido" /></div>
        <div><label for="correo" class="mb-1.5 block text-sm font-semibold">Correo electronico</label><input id="correo" v-model.trim="correo" type="email" required maxlength="254" autocomplete="email" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="tu@correo.com" /></div>
        <div><label for="telefono" class="mb-1.5 block text-sm font-semibold">Celular (opcional)</label><input id="telefono" v-model.trim="telefono" type="tel" maxlength="25" autocomplete="tel" class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="+51 ..." /></div>
        <fieldset class="rounded-2xl border border-emerald-100 bg-[#f5faf8] p-4">
          <legend class="px-1 text-sm font-bold text-slate-900">Perfil de riesgo inicial</legend>
          <p class="mb-3 text-xs text-slate-500">Elige la preferencia de partida. No activa operaciones ni define limites automaticamente.</p>
          <div class="grid gap-2 sm:grid-cols-3">
            <label v-for="opcion in opciones" :key="opcion.id" :class="['cursor-pointer rounded-xl border bg-white p-3 transition focus-within:ring-2 focus-within:ring-emerald-200',perfilRiesgo === opcion.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-200']">
              <input v-model="perfilRiesgo" class="sr-only" name="riesgo" type="radio" :value="opcion.id" />
              <span class="mb-2 block text-xl text-emerald-700" aria-hidden="true">{{ opcion.icono }}</span>
              <span class="block text-sm font-bold">{{ opcion.nombre }}</span>
              <span class="mt-1 block text-xs leading-4 text-slate-500">{{ opcion.detalle }}</span>
            </label>
          </div>
          <p class="mt-3 text-xs text-emerald-800">Rol: Suscriptor · Spot y Futures permanecen desactivados inicialmente.</p>
        </fieldset>
        <p v-if="error" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{{ error }}</p>
        <button :disabled="cargando" class="w-full rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">{{ cargando ? 'Registrando...' : 'Revisar y crear cuenta' }}</button>
      </form>
    </section>

    <div v-if="dialogo" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation" @click.self="cerrar">
      <section role="dialog" aria-modal="true" :aria-labelledby="dialogo === 'confirmacion' ? 'titulo-confirmacion' : 'titulo-exito'" class="w-full max-w-md rounded-[26px] border border-slate-100 bg-white p-6 shadow-2xl sm:p-8">
        <template v-if="dialogo === 'confirmacion'">
          <div class="mb-4 grid size-12 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">✓</div>
          <h2 id="titulo-confirmacion" class="text-xl font-extrabold">Confirma los datos de tu cuenta</h2>
          <p class="mt-1 text-sm text-slate-500">Revisa tu informacion antes de registrarte.</p>
          <dl class="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <div><dt class="text-slate-500">Nombre</dt><dd class="font-semibold break-words">{{ nombre }}</dd></div>
            <div><dt class="text-slate-500">Correo</dt><dd class="font-semibold break-all">{{ correo }}</dd></div>
            <div><dt class="text-slate-500">Rol</dt><dd class="font-semibold">Suscriptor</dd></div>
            <div><dt class="text-slate-500">Riesgo solicitado</dt><dd class="font-semibold">{{ elegido }}</dd></div>
          </dl>
          <p class="mt-4 text-xs text-slate-500">La cuenta quedara pendiente de verificacion. No se activan operaciones de trading.</p>
          <div class="mt-5 flex gap-3"><button :disabled="cargando" class="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold" @click="cerrar">Editar</button><button :disabled="cargando" class="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50" @click="crear">{{ cargando ? 'Registrando...' : 'Confirmar' }}</button></div>
        </template>
        <template v-else>
          <div class="mb-4 grid size-14 place-items-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-700">✓</div>
          <h2 id="titulo-exito" class="text-xl font-extrabold">¡Solicitud registrada!</h2>
          <p class="mt-2 text-sm text-slate-600">Se creo el perfil de suscriptor con preferencia <strong>{{ elegido }}</strong>. La cuenta requiere verificacion y activacion antes de acceder.</p>
          <p v-if="nuevoId" class="mt-3 break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-600">ID: {{ nuevoId }}</p>
          <button class="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white" @click="router.push('/login')">Volver al login</button>
        </template>
      </section>
    </div>
  </main>
</template>
