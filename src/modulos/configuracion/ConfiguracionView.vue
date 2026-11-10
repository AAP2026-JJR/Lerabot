<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PanelGeneral from './componentes/PanelGeneral.vue'
import PanelConfiguracionAvanzada from './componentes/PanelConfiguracionAvanzada.vue'
import { configuracionInicial, type ConfiguracionGlobal } from './datos/configuracion-catalogo'
import { ErrorConfiguracion, guardarConfiguracion, leerConfiguracion, type DocumentoConfiguracion } from './servicios/configuracion'
import type { SeccionConfiguracion } from './tipos/configuracion'

const seccion = ref<SeccionConfiguracion>('general')
const borrador = ref<ConfiguracionGlobal>(structuredClone(configuracionInicial))
const originalAws = ref<DocumentoConfiguracion | null>(null)
const cargando = ref(false)
const guardando = ref(false)
const mensaje = ref('')
const estado = ref<'neutral'|'ok'|'error'>('neutral')
const cambios = computed(() => originalAws.value !== null && JSON.stringify(borrador.value) !== JSON.stringify({ defaults: originalAws.value.defaults, features: originalAws.value.features }))
const secciones: { id: SeccionConfiguracion; nombre: string }[] = [
  { id: 'general', nombre: 'General' }, { id: 'exchanges', nombre: 'Exchanges' },
  { id: 'riesgos', nombre: 'Riesgos' }, { id: 'sistema', nombre: 'Sistema' }
]
function restaurar() {
  if (originalAws.value) {
    borrador.value = structuredClone({ defaults: originalAws.value.defaults, features: originalAws.value.features })
  } else borrador.value = structuredClone(configuracionInicial)
  mensaje.value = 'Cambios descartados.'; estado.value = 'neutral'
}
async function cargar() {
  cargando.value = true; mensaje.value = ''
  try {
    const doc = await leerConfiguracion()
    originalAws.value = structuredClone(doc)
    borrador.value = structuredClone({ defaults: doc.defaults, features: doc.features })
    estado.value = 'ok'; mensaje.value = `Configuración cargada. Versión ${doc.version}.`
  } catch (e) {
    originalAws.value = null
    estado.value = 'error'; mensaje.value = e instanceof Error ? e.message : 'Error de lectura'
  } finally { cargando.value = false }
}
async function guardar() {
  if (!originalAws.value || !cambios.value || guardando.value || cargando.value) return
  guardando.value = true; mensaje.value = ''
  try {
    const doc = await guardarConfiguracion({ ...borrador.value, version: originalAws.value.version })
    originalAws.value = structuredClone(doc)
    borrador.value = structuredClone({ defaults: doc.defaults, features: doc.features })
    estado.value = 'ok'; mensaje.value = `Cambios guardados. Versión ${doc.version}.`
  } catch (e) {
    estado.value = 'error'
    mensaje.value = e instanceof ErrorConfiguracion && e.codigo === 409
      ? 'Conflicto de versión (409). Recarga la configuración antes de volver a guardar.'
      : (e instanceof Error ? e.message : 'No se pudo guardar')
  } finally { guardando.value = false }
}
onMounted(() => { void cargar() })
</script>
<template>
  <div class="min-w-0 space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><h2 class="text-2xl font-bold text-[#102c37]">Configuración</h2>
        <p class="mt-1 text-sm text-slate-500">Parámetros centralizados de LERABOT. Los cambios se guardan al pulsar Guardar cambios.</p></div>
      <span class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Datos de prueba</span>
    </header>
    <div v-if="!originalAws" class="space-y-3 rounded-2xl border bg-white p-5">
      <h3 class="font-semibold">Cargando configuración</h3>
      <p v-if="cargando" class="text-sm text-slate-500">Consultando...</p>
      <p v-else class="text-sm" :class="estado==='error' ? 'text-red-700' : 'text-slate-600'">{{ mensaje || 'Pulsa Reintentar consulta.' }}</p>
      <button :disabled="cargando" class="rounded-lg border px-4 py-2" @click="cargar">Reintentar consulta</button>
    </div>
    <template v-else>
      <nav aria-label="Secciones de configuración" class="flex flex-wrap gap-2 border-b pb-4">
        <button v-for="s in secciones" :key="s.id" class="rounded-xl border px-4 py-2 text-sm" :class="seccion===s.id?'border-[#00856a] bg-[#e1f4ef] text-[#006d57]':'border-[#e3ebe8] bg-white'" @click="seccion=s.id">{{ s.nombre }}</button>
      </nav>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <strong>{{ secciones.find(s => s.id===seccion)?.nombre }}</strong>
        <span class="text-xs text-slate-500">{{ cambios ? 'Cambios pendientes' : 'Sin cambios' }}<template v-if="originalAws"> · Versión {{ originalAws.version }}</template></span>
      </div>
      <PanelGeneral v-if="seccion==='general'" />
      <PanelConfiguracionAvanzada v-else v-model="borrador" :seccion="seccion" />
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d6e6df] bg-white p-4">
        <p class="text-sm text-slate-500">Los cambios se guardan mediante la API de configuración.</p>
        <div class="flex gap-2">
          <button class="rounded-lg border px-4 py-2" :disabled="!cambios || guardando" @click="restaurar">Restablecer</button>
          <button class="rounded-lg bg-[#00856a] px-4 py-2 font-semibold text-white disabled:opacity-50" :disabled="!cambios || cargando || guardando || !originalAws" @click="guardar">{{ guardando ? 'Guardando...' : 'Guardar cambios' }}</button>
        </div>
      </div>
      <p v-if="mensaje" role="status" class="text-sm" :class="estado==='error'?'text-red-700':'text-[#00856a]'">{{ mensaje }}</p>
    </template>
  </div>
</template>
