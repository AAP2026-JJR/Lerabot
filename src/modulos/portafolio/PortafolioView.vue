<script setup lang="ts">
import { ref, computed } from 'vue'
import TarjetaMetrica from '../../compartido/componentes/TarjetaMetrica.vue'
import TarjetaBase from '../../compartido/componentes/TarjetaBase.vue'
import TablaDatos from '../../compartido/componentes/TablaDatos.vue'
const buscar = ref('')
const columnas = [{clave:'activo',titulo:'Activo'},{clave:'cantidad',titulo:'Cantidad',alinear:'derecha' as const},{clave:'precio',titulo:'Precio actual',alinear:'derecha' as const},{clave:'invertido',titulo:'Costo base',alinear:'derecha' as const},{clave:'valor',titulo:'Valor (USD)',alinear:'derecha' as const},{clave:'resultado',titulo:'P&L estimado',alinear:'derecha' as const}]
const filas: Record<string, string>[] = [
{id:'1',activo:'Bitcoin (BTC)',cantidad:'0.1325',precio:'$67,210.00',invertido:'$8,100.00',valor:'$8,905.33',resultado:'+$805.33'},
{id:'2',activo:'Ethereum (ETH)',cantidad:'2.15',precio:'$3,120.00',invertido:'$6,200.00',valor:'$6,708.00',resultado:'+$508.00'},
{id:'3',activo:'Solana (SOL)',cantidad:'15.00',precio:'$142.00',invertido:'$2,350.00',valor:'$2,130.00',resultado:'-$220.00'},
{id:'4',activo:'Tether (USDT)',cantidad:'1,000',precio:'$1.00',invertido:'$1,000.00',valor:'$1,000.00',resultado:'$0.00'}]

const visibles = computed(() =>
    filas.filter((x) =>
        (x.activo ?? '')
            .toLowerCase()
            .includes(buscar.value.toLowerCase())
    )
)
</script>
<template>
  <div class="space-y-6"><header><h2 class="text-2xl font-bold">Portafolio</h2><p class="mt-1 text-sm text-slate-500">Activos y costos ilustrativos. No representan inversiones reales.</p></header>
    <div class="grid gap-4 md:grid-cols-3"><TarjetaMetrica titulo="Valor de activos (demo)" valor="$18,743.33" detalle="Ejemplo de interfaz" /><TarjetaMetrica titulo="Capital invertido (demo)" valor="$17,650.00" /><TarjetaMetrica titulo="P&L no realizado (demo)" valor="+$1,093.33" tendencia="positiva" detalle="No incluye fees ni retiros" /></div>
    <TarjetaBase titulo="Mis activos" descripcion="Cantidades y precios completamente ficticios."><div class="mb-4"><label for="buscar-activo" class="mb-1 block text-sm text-slate-500">Buscar activo</label><input id="buscar-activo" v-model="buscar" placeholder="Bitcoin, ETH, SOL..." class="w-full max-w-sm rounded-lg border border-[#e3ebe8] px-3 py-2 text-sm outline-[#00856a]" /></div><TablaDatos :columnas="columnas" :filas="visibles" clave-fila="id"><template #celda-resultado="{ valor }"><span :class="String(valor).startsWith('-') ? 'text-red-600' : 'text-emerald-600'">{{ valor }}</span></template></TablaDatos></TarjetaBase>
    <p class="text-xs text-slate-500">El cálculo real distinguirá costo de adquisición, capital aportado, ganancias realizadas y no realizadas, y transferencias internas.</p>
  </div>
</template>
