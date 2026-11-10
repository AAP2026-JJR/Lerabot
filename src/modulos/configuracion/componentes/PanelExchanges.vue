<script setup lang="ts">
import { configuracionDemo } from '../datos/configuracion-demo'
import TarjetaBase from '../../../compartido/componentes/TarjetaBase.vue'
</script>
<template>
  <TarjetaBase titulo="Proveedores de mercado" descripcion="Catalogo ilustrativo de integraciones; no hay credenciales conectadas">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="p in configuracionDemo.proveedores" :key="p.id" class="min-w-0 rounded-xl border border-[#e3ebe8] p-4">
        <div class="flex items-start justify-between gap-2"><h4 class="font-semibold">{{ p.nombre }}</h4><span class="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">Pendiente</span></div>
        <p class="mt-2 text-sm text-slate-600">{{ p.productos.join(' · ') }}</p>
        <p class="mt-3 break-all text-xs text-slate-500">Endpoint de referencia: {{ p.endpoint }}</p>
      </article>
    </div>
    <p class="mt-4 text-xs text-slate-500">Las API Keys de usuarios no deben almacenarse ni mostrarse aqui. Mas adelante se gestionaran con autorizacion y un servicio seguro.</p>
  </TarjetaBase>
</template>
