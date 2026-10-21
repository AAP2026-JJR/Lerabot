<script setup lang="ts">
import { computed, toRaw } from 'vue'
import InterruptorConfiguracion from './InterruptorConfiguracion.vue'
import { opcionesTimeframe, type ConfiguracionGlobal, type PuntoConexion } from '../datos/configuracion-catalogo'
const props = defineProps<{ modelValue: ConfiguracionGlobal; seccion: 'exchanges' | 'riesgos' | 'sistema' }>()
const emit = defineEmits<{ 'update:modelValue': [valor: ConfiguracionGlobal] }>()
const modelo = computed(() => props.modelValue)
function modificar(cambio: (c: ConfiguracionGlobal) => void) {
  const copia: ConfiguracionGlobal = structuredClone(toRaw(props.modelValue))
  cambio(copia)
  emit('update:modelValue', copia)
}
function numero(valor: string, minimo: number, maximo: number): number {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.min(maximo, Math.max(minimo, n)) : minimo
}
function campoExchange(id: string, producto: 'spot' | 'futures', campo: keyof PuntoConexion, valor: string) {
  modificar(c => {
    const ex = c.defaults.exchanges[id]
    if (!ex) return
    const target = ex[producto]
    if (campo === 'baseUrl') target.baseUrl = valor
    if (campo === 'rateLimit') target.rateLimit = numero(valor, 1, 100000)
    if (campo === 'timeout') target.timeout = numero(valor, 100, 120000)
  })
}
function toggleTimeframe(tipo: 'SPOT' | 'FUTURES', periodo: string, activo: boolean) {
  modificar(c => {
    const prev = c.defaults.enabledTimeframes[tipo]
    c.defaults.enabledTimeframes[tipo] = activo ? [...new Set([...prev, periodo])] : prev.filter(p => p !== periodo)
  })
}
const features = [
  { key: 'enableSpotTrading', label: 'Habilitar trading Spot', detalle: 'Referencia del CSV; no ejecuta operaciones' },
  { key: 'enableFuturesTrading', label: 'Habilitar trading Futures', detalle: 'Solo vista previa: no activa órdenes reales' },
  { key: 'enableDynamoDB', label: 'Habilitar DynamoDB', detalle: 'Funcionalidad de referencia' },
  { key: 'enableDynamoAudit', label: 'Auditoría DynamoDB', detalle: 'Registro de cambios' },
  { key: 'enableDynamoConfig', label: 'Configuración DynamoDB', detalle: 'Lectura de configuración remota' },
  { key: 'enableSpotLifecyclePersistence', label: 'Persistir ciclo de vida Spot', detalle: 'Persistencia de órdenes Spot' },
  { key: 'enableNotifications', label: 'Notificaciones', detalle: 'Alertas y eventos' },
] as const
</script>
<template>
  <div class="space-y-5">
    <template v-if="seccion === 'exchanges'">
      <section v-for="(exchange, id) in modelo.defaults.exchanges" :key="id" class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
        <h4 class="text-base font-semibold text-[#102c37]">{{ exchange.name }}</h4>
        <p class="mt-1 text-xs text-slate-500">Configuración pública de endpoints (sin API Keys privadas)</p>
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div v-for="producto in (['spot', 'futures'] as const)" :key="producto" class="min-w-0 rounded-xl border border-[#e3ebe8] p-4">
            <h5 class="mb-3 font-semibold capitalize">{{ producto }}</h5>
            <label class="mb-1 block text-xs text-slate-600">URL base</label>
            <input :value="exchange[producto].baseUrl" @change="campoExchange(String(id), producto, 'baseUrl', ($event.target as HTMLInputElement).value)" class="mb-3 w-full rounded-lg border border-[#d8e3df] px-3 py-2 text-sm" />
            <div class="grid grid-cols-2 gap-3">
              <label class="text-xs text-slate-600">Límite de solicitudes
                <input type="number" min="1" max="100000" :value="exchange[producto].rateLimit" @change="campoExchange(String(id), producto, 'rateLimit', ($event.target as HTMLInputElement).value)" class="mt-1 w-full rounded-lg border border-[#d8e3df] px-3 py-2 text-sm" />
              </label>
              <label class="text-xs text-slate-600">Timeout (ms)
                <input type="number" min="100" max="120000" :value="exchange[producto].timeout" @change="campoExchange(String(id), producto, 'timeout', ($event.target as HTMLInputElement).value)" class="mt-1 w-full rounded-lg border border-[#d8e3df] px-3 py-2 text-sm" />
              </label>
            </div>
          </div>
        </div>
      </section>
      <p class="text-xs text-slate-500">Bybit no aparece en el CSV compartido. Se agregará al catálogo después de definir sus parámetros reales.</p>
    </template>
    <template v-else-if="seccion === 'riesgos'">
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
        <h4 class="font-semibold">Límites operativos de referencia</h4>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <label class="text-sm">Porcentaje máximo del balance por operación (%)
            <input type="number" min="0" max="100" :value="modelo.defaults.maxBalancePercentPerTrade" @change="modificar(c => { c.defaults.maxBalancePercentPerTrade = numero(($event.target as HTMLInputElement).value, 0, 100) })" class="mt-2 w-full rounded-lg border border-[#d8e3df] px-3 py-2" />
          </label>
          <label class="text-sm">Calidad mínima de señal (0–100)
            <input type="number" min="0" max="100" :value="modelo.defaults.minSignalQuality" @change="modificar(c => { c.defaults.minSignalQuality = numero(($event.target as HTMLInputElement).value, 0, 100) })" class="mt-2 w-full rounded-lg border border-[#d8e3df] px-3 py-2" />
          </label>
          <label class="text-sm">Máximo de reintentos
            <input type="number" min="0" max="20" step="1" :value="modelo.defaults.maxRetries" @change="modificar(c => { c.defaults.maxRetries = Math.floor(numero(($event.target as HTMLInputElement).value, 0, 20)) })" class="mt-2 w-full rounded-lg border border-[#d8e3df] px-3 py-2" />
          </label>
          <label class="text-sm">Riesgo Futures predeterminado (%)
            <input type="number" min="0" max="100" placeholder="No definido (NULL)" :value="modelo.defaults.defaultFuturesRiskPercent ?? ''" @change="modificar(c => { const s = ($event.target as HTMLInputElement).value; c.defaults.defaultFuturesRiskPercent = s.trim() === '' ? null : numero(s, 0, 100) })" class="mt-2 w-full rounded-lg border border-[#d8e3df] px-3 py-2" />
          </label>
        </div>
      </section>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
        <h4 class="font-semibold">Timeframes habilitados</h4>
        <div v-for="tipo in (['SPOT', 'FUTURES'] as const)" :key="tipo" class="mt-4">
          <p class="mb-2 text-sm font-medium">{{ tipo }}</p>
          <div class="flex flex-wrap gap-2">
            <label v-for="opcion in opcionesTimeframe" :key="tipo + opcion" class="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e3ebe8] px-3 py-2 text-sm">
              <input type="checkbox" class="accent-[#00856a]" :checked="modelo.defaults.enabledTimeframes[tipo].includes(opcion)" @change="toggleTimeframe(tipo, opcion, ($event.target as HTMLInputElement).checked)" />{{ opcion }}
            </label>
          </div>
        </div>
      </section>
    </template>
    <template v-else>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
        <h4 class="font-semibold">Funciones del sistema</h4>
        <InterruptorConfiguracion v-for="f in features" :key="f.key" :etiqueta="f.label" :descripcion="f.detalle" :model-value="modelo.features[f.key]" @update:model-value="modificar(c => { c.features[f.key] = $event })" />
      </section>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
        <h4 class="mb-4 font-semibold">Logging y observabilidad</h4>
        <label class="block text-sm">Nivel de log
          <select :value="modelo.defaults.logging.level" @change="modificar(c => { c.defaults.logging.level = ($event.target as HTMLSelectElement).value })" class="mt-2 w-full rounded-lg border border-[#d8e3df] bg-white px-3 py-2 sm:max-w-xs">
            <option>DEBUG</option><option>INFO</option><option>WARN</option><option>ERROR</option>
          </select>
        </label>
        <div class="mt-4">
          <InterruptorConfiguracion etiqueta="Logs estructurados" :model-value="modelo.defaults.logging.structured" @update:model-value="modificar(c => { c.defaults.logging.structured = $event })" />
          <InterruptorConfiguracion etiqueta="Métricas de rendimiento" :model-value="modelo.defaults.logging.enablePerformanceMetrics" @update:model-value="modificar(c => { c.defaults.logging.enablePerformanceMetrics = $event })" />
          <InterruptorConfiguracion etiqueta="Logs de resumen" :model-value="modelo.defaults.logging.enableSummaryLogs" @update:model-value="modificar(c => { c.defaults.logging.enableSummaryLogs = $event })" />
        </div>
      </section>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm">
        <h4 class="mb-4 font-semibold">Entorno de referencia</h4>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="text-sm">Región AWS<input :value="modelo.defaults.region" @change="modificar(c => { c.defaults.region = ($event.target as HTMLInputElement).value })" class="mt-2 w-full rounded-lg border border-[#d8e3df] px-3 py-2" /></label>
          <label class="text-sm">Stage<input :value="modelo.defaults.stage" @change="modificar(c => { c.defaults.stage = ($event.target as HTMLInputElement).value })" class="mt-2 w-full rounded-lg border border-[#d8e3df] px-3 py-2" /></label>
        </div>
      </section>
    </template>
  </div>
</template>
