<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import { sesionDemo } from '@/modulos/login/sesionDemo'
withDefaults(defineProps<{ abierto: boolean; compacto?: boolean }>(), { compacto: false })
const emit = defineEmits<{ cerrar: [] }>()
const opcionesBase = [
  { ruta: '/dashboard', titulo: 'Dashboard', icono: '▦', estilo: 'bg-sky-50 text-sky-700 group-hover:bg-sky-100' },
  { ruta: '/mercado', titulo: 'Mercado', icono: '◉', estilo: 'bg-violet-50 text-violet-700 group-hover:bg-violet-100' },
  { ruta: '/exchanges', titulo: 'Exchanges', icono: '⇄', estilo: 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100' },
  { ruta: '/billetera', titulo: 'Billetera', icono: '◈', estilo: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100' },
  { ruta: '/portafolio', titulo: 'Portafolio', icono: '▧', estilo: 'bg-amber-50 text-amber-700 group-hover:bg-amber-100' },
  { ruta: '/reportes', titulo: 'Reportes', icono: '▤', estilo: 'bg-cyan-50 text-cyan-700 group-hover:bg-cyan-100' },
  { ruta: '/configuracion', titulo: 'Configuración', icono: '⚙', estilo: 'bg-slate-100 text-slate-700 group-hover:bg-slate-200' },
  { ruta: '/auditoria', titulo: 'Auditoría', icono: '◷', estilo: 'bg-rose-50 text-rose-700 group-hover:bg-rose-100' },
]
// Solo navegación visual: los permisos de API requieren autenticación y validación del servidor.
const opciones = computed(() => opcionesBase.filter(o => (!['/configuracion', '/auditoria'].includes(o.ruta) || sesionDemo()?.rol === 'ADMIN') && (o.ruta !== '/billetera' || sesionDemo()?.rol === 'SUBSCRIBER')))
</script>
<template>
  <div v-if="abierto" class="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" @click="emit('cerrar')" />
  <aside :class="[abierto?'translate-x-0':'-translate-x-full',compacto?'lg:w-[76px] lg:px-2':'lg:w-[248px] lg:px-3']" class="fixed inset-y-0 left-0 z-40 flex w-[min(248px,85vw)] flex-col overflow-y-auto border-r border-[#e3ebe8] bg-white px-3 py-5 transition-[transform,width,padding] duration-200 lg:translate-x-0">
    <div class="mb-8 flex items-center gap-3 px-3" :class="compacto?'lg:justify-center lg:px-0':''"><div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00856a] text-xl font-bold text-white">L</div><div :class="compacto?'lg:hidden':''"><div class="text-lg font-extrabold tracking-wide text-[#102c37]">LedaBot</div><div class="text-[10px] tracking-wide text-slate-500">PORTAFOLIO CRIPTO</div></div></div>
    <nav class="space-y-1" aria-label="Menú principal"><RouterLink v-for="opcion in opciones" :key="opcion.ruta" :to="opcion.ruta" :title="compacto?opcion.titulo:undefined" @click="emit('cerrar')" class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200 hover:translate-x-0.5" :class="[$route.path===opcion.ruta?'bg-[#e1f4ef] text-[#007c64] shadow-sm ring-1 ring-emerald-100':'text-slate-700 hover:bg-slate-50 hover:text-[#102c37]',compacto?'lg:justify-center lg:px-1':'']"><span aria-hidden="true" class="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg transition-all duration-200" :class="[$route.path===opcion.ruta?'bg-white shadow-sm ring-1 ring-emerald-100':opcion.estilo]">{{opcion.icono}}</span><span :class="compacto?'lg:hidden':''">{{opcion.titulo}}</span></RouterLink></nav>
    <div class="mt-auto border-t border-slate-100 pt-4 text-center text-xs text-slate-400" :class="compacto?'lg:hidden':''">LedaBot · Tu portafolio cripto</div>
  </aside>
</template>
