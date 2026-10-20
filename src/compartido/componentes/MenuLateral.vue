<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ abierto: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const opciones = [
  { ruta: '/dashboard', titulo: 'Dashboard', icono: '▦' },
  { ruta: '/exchanges', titulo: 'Exchanges', icono: '⇄' },
  { ruta: '/portafolio', titulo: 'Portafolio', icono: '◈' },
  { ruta: '/operaciones', titulo: 'Operaciones', icono: '↗' },
  { ruta: '/reportes', titulo: 'Reportes', icono: '▤' },
  { ruta: '/configuracion', titulo: 'Configuración', icono: '⚙' },
]
</script>

<template>
  <div v-if="abierto" class="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" @click="emit('cerrar')" />
  <aside :class="abierto ? 'translate-x-0' : '-translate-x-full'"
    class="fixed inset-y-0 left-0 z-40 flex w-[min(248px,85vw)] overflow-y-auto flex-col border-r border-[#e3ebe8] bg-white px-3 py-5 transition-transform duration-200 lg:translate-x-0">
    <div class="mb-10 flex items-center gap-3 px-3">
      <div class="grid h-10 w-10 place-items-center rounded-xl bg-[#00856a] text-xl font-bold text-white">L</div>
      <div><div class="text-lg font-extrabold tracking-wide text-[#102c37]">LERABOT</div><div class="text-[10px] tracking-wide text-slate-500">PORTAFOLIO CRIPTO</div></div>
    </div>
    <nav class="space-y-1" aria-label="Menú principal">
      <RouterLink v-for="opcion in opciones" :key="opcion.ruta" :to="opcion.ruta" @click="emit('cerrar')"
        class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors"
        :class="$route.path === opcion.ruta ? 'bg-[#e1f4ef] text-[#00856a]' : 'text-slate-600 hover:bg-slate-50 hover:text-[#102c37]'">
        <span aria-hidden="true" class="w-5 text-center text-lg">{{ opcion.icono }}</span><span>{{ opcion.titulo }}</span>
      </RouterLink>
    </nav>
    <div class="mt-auto rounded-xl bg-[#f6f9f8] p-4 text-xs leading-5 text-slate-500">
      <div class="mb-1 font-semibold text-[#102c37]">Modo demostración</div>
      Datos ilustrativos. Próximamente conectaremos los exchanges de forma segura.
    </div>
  </aside>
</template>
