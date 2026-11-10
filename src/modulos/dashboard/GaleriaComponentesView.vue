<script setup lang="ts">
import { ref } from 'vue'
import TarjetaBase from '@/compartido/componentes/TarjetaBase.vue'
import TarjetaMetrica from '@/compartido/componentes/TarjetaMetrica.vue'
import SelectorPeriodo from '@/compartido/componentes/SelectorPeriodo.vue'
import EstadoConexion from '@/compartido/componentes/EstadoConexion.vue'
import EstadoVacio from '@/compartido/componentes/EstadoVacio.vue'
import CargandoDatos from '@/compartido/componentes/CargandoDatos.vue'
import TablaDatos from '@/compartido/componentes/TablaDatos.vue'
const periodo = ref<'7D' | '30D' | '90D' | '1A'>('30D')
const columnas = [{ clave: 'activo', titulo: 'Activo' }, { clave: 'valor', titulo: 'Valor (USD)', alinear: 'derecha' as const }]
const filas = [{ id: 1, activo: 'Bitcoin (BTC)', valor: '$2,450.00' }, { id: 2, activo: 'Ethereum (ETH)', valor: '$1,210.00' }]
</script>
<template>
  <div class="space-y-6">
    <div><h2 class="text-2xl font-bold text-[#102c37]">Galería de componentes</h2><p class="mt-1 text-sm text-slate-500">Vista de prueba · Todos los importes son ilustrativos.</p></div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><TarjetaMetrica titulo="Balance total" valor="$3,660.00" detalle="+5.2% · Ejemplo" tendencia="positiva" /><TarjetaMetrica titulo="Pérdida diaria" valor="-$32.40" detalle="-0.9% · Ejemplo" tendencia="negativa" /><TarjetaMetrica titulo="Conexiones" valor="0" detalle="Pendiente de integración" /></div>
    <TarjetaBase titulo="Filtros y estados" descripcion="Interacciones y estados visuales"><div class="flex flex-wrap items-center gap-3"><SelectorPeriodo v-model="periodo" /><EstadoConexion estado="conectado" /><EstadoConexion estado="sincronizando" /><EstadoConexion estado="desconectado" /><EstadoConexion estado="error" /></div><p class="mt-3 text-xs text-slate-500">Período seleccionado: {{ periodo }}</p></TarjetaBase>
    <TarjetaBase titulo="Tabla reutilizable" descripcion="Datos ficticios"><TablaDatos :columnas="columnas" :filas="filas" clave-fila="id" /></TarjetaBase>
    <div class="grid gap-4 lg:grid-cols-2"><EstadoVacio titulo="Sin exchanges conectados" descripcion="Aquí aparecerán tus cuentas una vez conectadas." /><CargandoDatos mensaje="Ejemplo del indicador de carga" /></div>
  </div>
</template>