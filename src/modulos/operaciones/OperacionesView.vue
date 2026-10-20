<script setup lang="ts">
import { computed, ref } from 'vue'
import TarjetaBase from '../../compartido/componentes/TarjetaBase.vue'
import TarjetaMetrica from '../../compartido/componentes/TarjetaMetrica.vue'
import TablaDatos from '../../compartido/componentes/TablaDatos.vue'
const filtro = ref('Todas')
const columnas = [{clave:'fecha',titulo:'Fecha'},{clave:'exchange',titulo:'Exchange'},{clave:'tipo',titulo:'Tipo'},{clave:'par',titulo:'Par'},{clave:'cantidad',titulo:'Cantidad',alinear:'derecha' as const},{clave:'total',titulo:'Total (USD)',alinear:'derecha' as const},{clave:'comision',titulo:'Fee (USD)',alinear:'derecha' as const}]
const operaciones: Record<string,string>[] = [
{id:'1',fecha:'15/10/2026',exchange:'Binance',tipo:'Compra',par:'BTC/USDT',cantidad:'0.012',total:'$806.52',comision:'$0.80'},
{id:'2',fecha:'13/10/2026',exchange:'BingX',tipo:'Venta',par:'ETH/USDT',cantidad:'0.350',total:'$1,092.00',comision:'$1.10'},
{id:'3',fecha:'11/10/2026',exchange:'Bybit',tipo:'Transferencia',par:'USDT',cantidad:'500',total:'$500.00',comision:'$0.00'},
{id:'4',fecha:'09/10/2026',exchange:'Binance',tipo:'Compra',par:'SOL/USDT',cantidad:'3',total:'$426.00',comision:'$0.42'}]
const visibles=computed(()=>operaciones.filter(o=>filtro.value==='Todas'||o.tipo===filtro.value))
</script>
<template><div class="space-y-6"><header><h2 class="text-2xl font-bold">Operaciones</h2><p class="mt-1 text-sm text-slate-500">Compras, ventas y movimientos de demostración.</p></header>
  <div class="grid gap-4 md:grid-cols-3"><TarjetaMetrica titulo="Movimientos (demo)" valor="4" /><TarjetaMetrica titulo="Compras (demo)" valor="2" /><TarjetaMetrica titulo="Comisiones (demo)" valor="$2.32" /></div>
  <TarjetaBase titulo="Historial de operaciones" descripcion="Registros ficticios: todavía no se consultan APIs."><div class="mb-4 flex flex-wrap gap-2"><button v-for="tipo in ['Todas','Compra','Venta','Transferencia']" :key="tipo" class="rounded-lg px-3 py-2 text-sm" :class="filtro===tipo?'bg-[#e1f4ef] font-semibold text-[#00856a]':'border border-slate-200 text-slate-600'" @click="filtro=tipo">{{ tipo }}</button></div><TablaDatos :columnas="columnas" :filas="visibles" clave-fila="id"><template #celda-tipo="{ valor }"><span class="rounded-full px-2 py-1 text-xs" :class="valor==='Compra'?'bg-emerald-50 text-emerald-700':valor==='Venta'?'bg-red-50 text-red-700':'bg-blue-50 text-blue-700'">{{ valor }}</span></template></TablaDatos></TarjetaBase>
  <p class="text-xs text-slate-500">En una fase posterior separaremos trades de depósitos, retiros y transferencias para calcular el rendimiento correctamente.</p></div></template>
