<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import MenuLateral from '@/compartido/componentes/MenuLateral.vue'
import Encabezado from '@/compartido/componentes/Encabezado.vue'

const route = useRoute()
const menuAbierto = ref(false)
const titulo = computed(() => String(route.meta.titulo ?? 'LERABOT'))
watch(() => route.fullPath, () => { menuAbierto.value = false })
</script>

<template>
  <div class="min-h-screen bg-[#f6f9f8]">
    <MenuLateral :abierto="menuAbierto" @cerrar="menuAbierto = false" />
    <div class="min-h-screen min-w-0 lg:pl-[248px]">
      <Encabezado :titulo="titulo" @abrir-menu="menuAbierto = true" />
      <main class="mx-auto w-full min-w-0 max-w-[1440px] p-3 sm:p-6 lg:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
