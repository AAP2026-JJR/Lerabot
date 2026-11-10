<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import MenuLateral from '@/compartido/componentes/MenuLateral.vue'
import Encabezado from '@/compartido/componentes/Encabezado.vue'
const route = useRoute()
const menuAbierto = ref(false)
const compacto = ref(false)
const titulo = computed(() => String(route.meta.titulo ?? 'LERABOT'))
watch(() => route.fullPath, () => { menuAbierto.value = false })
onMounted(() => { try { compacto.value = localStorage.getItem('lerabot_sidebar_compacto') === '1' } catch { /* almacenamiento no disponible */ } })
function alternar() { compacto.value = !compacto.value; try { localStorage.setItem('lerabot_sidebar_compacto', compacto.value ? '1' : '0') } catch { /* opcional */ } }
</script>
<template>
  <div class="min-h-screen bg-[#f4f8f7]">
    <MenuLateral :abierto="menuAbierto" :compacto="compacto" @cerrar="menuAbierto = false" />
    <button type="button" class="fixed top-[18px] z-50 hidden h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-700 shadow-md transition-all hover:bg-emerald-50 lg:flex" :class="compacto?'left-[57px]':'left-[231px]'" :aria-label="compacto?'Expandir menú lateral':'Contraer menú lateral'" :title="compacto?'Expandir menú':'Contraer menú'" @click="alternar">{{compacto?'»':'«'}}</button>
    <div class="min-h-screen min-w-0 transition-[padding] duration-200" :class="compacto?'lg:pl-[76px]':'lg:pl-[248px]'">
      <Encabezado :titulo="titulo" @abrir-menu="menuAbierto = true" />
      <main class="mx-auto w-full min-w-0 max-w-[1700px] p-3 sm:p-5 lg:p-6 xl:p-8"><RouterView /></main>
    </div>
  </div>
</template>
