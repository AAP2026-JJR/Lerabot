<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { sesionDemo, salirDemo } from '@/modulos/login/sesionDemo'
defineProps<{ titulo: string }>()
const emit = defineEmits<{ abrirMenu: [] }>()
const router = useRouter()
const abierto = ref(false)
const usuario = computed(() => sesionDemo())
const inicial = computed(() => usuario.value?.rol === 'ADMIN' ? 'A' : 'S')
function cerrar() { abierto.value = false; salirDemo(); void router.replace('/login') }
function cerrarFuera(e: MouseEvent) { if (!(e.target as HTMLElement)?.closest?.('[data-lerabot-perfil]')) abierto.value = false }
function tecla(e: KeyboardEvent) { if (e.key === 'Escape') abierto.value = false }
onMounted(() => { document.addEventListener('click', cerrarFuera); document.addEventListener('keydown', tecla) })
onUnmounted(() => { document.removeEventListener('click', cerrarFuera); document.removeEventListener('keydown', tecla) })
</script>
<template>
  <header class="sticky top-0 z-20 flex h-[72px] min-w-0 items-center justify-between border-b border-[#e3ebe8] bg-white px-4 sm:px-8">
    <div class="flex min-w-0 items-center gap-3">
      <button type="button" aria-label="Abrir menú" class="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 lg:hidden" @click="emit('abrirMenu')">☰</button>
      <div class="min-w-0"><h1 class="truncate text-base font-bold text-[#102c37] sm:text-xl">{{ titulo }}</h1><p class="hidden text-xs text-slate-500 sm:block">Tu portafolio cripto, más inteligente</p></div>
    </div>
    <div data-lerabot-perfil class="relative shrink-0">
      <button type="button" aria-haspopup="menu" :aria-expanded="abierto" aria-label="Abrir menú de perfil" :class="usuario?.rol === 'ADMIN' ? 'bg-violet-700 hover:bg-violet-800' : 'bg-emerald-600 hover:bg-emerald-700'" class="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-white shadow-sm outline-offset-2 focus-visible:outline focus-visible:outline-emerald-600" @click="abierto = !abierto">{{ inicial }}</button>
      <div v-if="abierto" role="menu" class="absolute right-0 top-12 z-50 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
        <div class="border-b border-slate-100 px-4 py-3"><p class="text-sm font-semibold text-slate-900">{{ usuario?.rol === 'ADMIN' ? 'Administrador' : 'Suscriptor' }}</p><p class="mt-1 break-all text-xs text-slate-500">{{ usuario?.email || 'Sin correo' }}</p><p v-if="usuario?.subscriberId" class="mt-1 text-xs text-slate-400">{{ usuario.subscriberId }}</p></div>
        <button type="button" role="menuitem" class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50" @click="cerrar"><span aria-hidden="true">↪</span> Cerrar sesión</button>
      </div>
    </div>
  </header>
</template>