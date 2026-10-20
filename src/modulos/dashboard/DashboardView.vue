<script setup lang="ts">
const metricas = [
  { titulo: 'Valor del portafolio', valor: '$18,742.52', detalle: '+12.4% en 30 días', positivo: true },
  { titulo: 'Ganancia / Pérdida', valor: '+$2,063.18', detalle: 'Datos de ejemplo', positivo: true },
  { titulo: 'Rendimiento (ROI)', valor: '+12.4%', detalle: 'Ilustrativo', positivo: true },
  { titulo: 'Exchanges conectados', valor: '0', detalle: 'Pendiente de integración', positivo: false },
]
const activos = [
  { ticker: 'BTC', nombre: 'Bitcoin', porcentaje: '32.4%' },
  { ticker: 'ETH', nombre: 'Ethereum', porcentaje: '24.8%' },
  { ticker: 'USDT', nombre: 'Tether', porcentaje: '14.1%' },
  { ticker: 'SOL', nombre: 'Solana', porcentaje: '8.7%' },
]
</script>
<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-2xl font-bold text-[#102c37]">Resumen de tu portafolio</h2><p class="mt-1 text-sm text-slate-500">Actividad e inversiones en un solo lugar</p></div><span class="rounded-lg border border-[#e3ebe8] bg-white px-3 py-2 text-xs text-slate-500">Últimos 30 días · Demo</span></div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="metrica in metricas" :key="metrica.titulo" class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm"><p class="text-sm text-slate-500">{{ metrica.titulo }}</p><p class="mt-3 text-2xl font-bold" :class="metrica.titulo === 'Ganancia / Pérdida' ? 'text-[#00856a]' : 'text-[#102c37]'">{{ metrica.valor }}</p><p class="mt-2 text-xs" :class="metrica.positivo ? 'text-[#16a34a]' : 'text-slate-500'">{{ metrica.detalle }}</p></article>
    </div>
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm"><h3 class="font-semibold text-[#102c37]">Evolución del portafolio</h3><p class="mb-6 mt-1 text-xs text-slate-500">Visualización ilustrativa · No representa balances reales</p>
        <svg class="h-56 w-full" viewBox="0 0 640 220" preserveAspectRatio="none" role="img" aria-label="Gráfico de evolución de ejemplo">
          <defs><linearGradient id="areaDemo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#00856a" stop-opacity="0.25"/><stop offset="100%" stop-color="#00856a" stop-opacity="0"/></linearGradient></defs>
          <path d="M0 170 H640 M0 110 H640 M0 50 H640" stroke="#e3ebe8" stroke-dasharray="5 5" fill="none" />
          <path d="M0 180 L45 160 L90 166 L136 132 L180 145 L228 102 L275 118 L320 79 L365 88 L410 59 L456 76 L510 42 L559 48 L610 23 L640 15 L640 220 L0 220Z" fill="url(#areaDemo)" />
          <path d="M0 180 L45 160 L90 166 L136 132 L180 145 L228 102 L275 118 L320 79 L365 88 L410 59 L456 76 L510 42 L559 48 L610 23 L640 15" stroke="#00856a" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </section>
      <section class="rounded-2xl border border-[#e3ebe8] bg-white p-5 shadow-sm"><h3 class="font-semibold text-[#102c37]">Distribución por activo</h3><p class="mt-1 text-xs text-slate-500">Ejemplo visual del futuro portafolio</p><div class="my-7 flex justify-center"><div class="grid h-40 w-40 place-items-center rounded-full" style="background: conic-gradient(#00856a 0 32.4%, #2563eb 32.4% 57.2%, #7c3aed 57.2% 71.3%, #f59e0b 71.3% 80%, #dbe5e8 80% 100%)"><div class="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p class="text-xl font-bold text-[#102c37]">4</p><p class="text-[11px] text-slate-500">Activos demo</p></div></div></div></div><div v-for="activo in activos" :key="activo.ticker" class="flex items-center justify-between border-t border-slate-100 py-2 text-sm"><span class="text-slate-600">{{ activo.nombre }} ({{ activo.ticker }})</span><span class="font-semibold text-[#102c37]">{{ activo.porcentaje }}</span></div></section>
    </div>
  </div>
</template>