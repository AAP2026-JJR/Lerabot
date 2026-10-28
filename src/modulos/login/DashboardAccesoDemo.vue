<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { sesionDemo, salirDemo } from './sesionDemo'
const sesion=computed(()=>sesionDemo())
const router=useRouter()
function salir(){salirDemo();void router.replace('/login')}
</script>
<template><div class="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-6"><div class="flex flex-wrap justify-between gap-3 items-center"><div><p class="font-bold text-amber-950">Acceso de demostración · {{ sesion?.rol ?? 'SIN SESIÓN' }}</p><p class="text-sm text-amber-800">{{ sesion?.email }} <span v-if="sesion?.subscriberId">· {{ sesion.subscriberId }}</span></p><p class="text-xs mt-2 text-amber-900">Los módulos AWS actuales no verifican el usuario. No usar este acceso para información privada.</p></div><button @click="salir" class="rounded-lg bg-amber-900 text-white px-4 py-2 text-sm">Cerrar sesión</button></div></div></template>
