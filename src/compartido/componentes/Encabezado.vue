<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
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
      <div v-if="abierto" role="menu" class="absolute right-0 top-14 z-50 w-[min(345px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,40,45,0.16)]">
        <div class="rounded-xl bg-gradient-to-br from-emerald-50 to-slate-50 px-4 py-4">
          <div class="flex items-center gap-3"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-lg font-extrabold text-white">{{ inicial }}</span><div class="min-w-0"><p class="font-bold text-slate-900">{{ usuario?.rol === 'ADMIN' ? 'Administrador' : 'Mi cuenta' }}</p><p class="text-xs font-medium text-emerald-700">{{ usuario?.rol === 'ADMIN' ? 'Administración' : 'Suscriptor' }}</p></div></div>
          <p class="mt-3 break-all text-sm text-slate-700">{{ usuario?.email || 'Sin correo' }}</p><span v-if="usuario?.subscriberId" class="mt-2 inline-flex rounded-full border border-emerald-100 bg-white px-2 py-1 font-mono text-xs text-slate-500">{{ usuario.subscriberId }}</span>
        </div>
        <RouterLink v-if="usuario?.rol === 'SUBSCRIBER'" role="menuitem" to="/mi-perfil" class="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700" @click="abierto=false"><span aria-hidden="true" class="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">♙</span> Mi perfil <span class="ml-auto text-slate-400" aria-hidden="true">›</span></RouterLink>
        <div class="my-2 border-t border-slate-100" />
        <button type="button" role="menuitem" class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 focus:bg-rose-50" @click="cerrar"><span aria-hidden="true" class="grid h-8 w-8 place-items-center rounded-lg bg-rose-50">↪</span> Cerrar sesión</button>
      </div>
    </div>
  </header>
</template>