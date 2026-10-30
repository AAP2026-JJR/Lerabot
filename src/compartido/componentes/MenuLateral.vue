<script setup lang="ts">
import { RouterLink } from 'vue-router'
withDefaults(defineProps<{ abierto: boolean; compacto?: boolean }>(), { compacto: false })
const emit = defineEmits<{ cerrar: [] }>()
const opciones = [
  { ruta: '/dashboard', titulo: 'Dashboard', icono: '▦' },
  { ruta: '/mercado', titulo: 'Mercado', icono: '◉' },
  { ruta: '/exchanges', titulo: 'Exchanges', icono: '⇄' },
  { ruta: '/portafolio', titulo: 'Portafolio', icono: '◈' },
  { ruta: '/operaciones', titulo: 'Operaciones', icono: '↗' },
  { ruta: '/reportes', titulo: 'Reportes', icono: '▤' },
  { ruta: '/configuracion', titulo: 'Configuración', icono: '⚙' },
  { ruta: '/auditoria', titulo: 'Auditoría', icono: '▤' },
]
</script>
<template>
  <div v-if="abierto" class="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" @click="emit('cerrar')" />
  <aside :class="[abierto?'translate-x-0':'-translate-x-full',compacto?'lg:w-[76px] lg:px-2':'lg:w-[248px] lg:px-3']" class="fixed inset-y-0 left-0 z-40 flex w-[min(248px,85vw)] flex-col overflow-y-auto border-r border-[#e3ebe8] bg-white px-3 py-5 transition-[transform,width,padding] duration-200 lg:translate-x-0">
    <div class="mb-8 flex items-center gap-3 px-3" :class="compacto?'lg:justify-center lg:px-0':''"><div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00856a] text-xl font-bold text-white">L</div><div :class="compacto?'lg:hidden':''"><div class="text-lg font-extrabold tracking-wide text-[#102c37]">LERABOT</div><div class="text-[10px] tracking-wide text-slate-500">PORTAFOLIO CRIPTO</div></div></div>
    <nav class="space-y-1" aria-label="Menú principal"><RouterLink v-for="opcion in opciones" :key="opcion.ruta" :to="opcion.ruta" :title="compacto?opcion.titulo:undefined" @click="emit('cerrar')" class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors" :class="[$route.path===opcion.ruta?'bg-[#e1f4ef] text-[#00856a]':'text-slate-600 hover:bg-slate-50 hover:text-[#102c37]',compacto?'lg:justify-center lg:px-1':'']"><span aria-hidden="true" class="w-5 shrink-0 text-center text-lg">{{opcion.icono}}</span><span :class="compacto?'lg:hidden':''">{{opcion.titulo}}</span></RouterLink></nav>
    <div class="mt-auto border-t border-slate-100 pt-4 text-center text-xs text-slate-400" :class="compacto?'lg:hidden':''">LERABOT · Tu portafolio cripto</div>
  </aside>
</template>
