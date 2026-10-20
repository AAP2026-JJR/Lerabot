import type { PosicionSpot, TradeSpot } from '../../../contratos/finanzas'

function validarTrade(t: TradeSpot): void {
  if (!t.cuentaId || !t.activo || !t.id || !Number.isFinite(t.cantidad) || t.cantidad <= 0) throw new Error('Trade invalido')
  if (!Number.isSafeInteger(t.precioCentavos) || t.precioCentavos < 0 || !Number.isSafeInteger(t.comisionCentavos) || t.comisionCentavos < 0) throw new Error('Importe invalido')
}
/** Promedio ponderado móvil por cuenta y activo. Solo demo Spot en USD, sin cortos. */
export function calcularPosicionesSpot(trades: readonly TradeSpot[]): PosicionSpot[] {
  const posiciones = new Map<string, PosicionSpot>()
  const ids = new Set<string>()
  for (const t of [...trades].sort((a,b) => a.fechaISO.localeCompare(b.fechaISO) || a.id.localeCompare(b.id))) {
    validarTrade(t)
    if (ids.has(t.id)) throw new Error(`Trade duplicado: ${t.id}`)
    ids.add(t.id)
    const key = `${t.cuentaId}::${t.activo}`
    const p = posiciones.get(key) ?? { cuentaId: t.cuentaId, activo: t.activo, cantidad: 0, costoBaseCentavos: 0, pnlRealizadoCentavos: 0 }
    const bruto = Math.round(t.cantidad * t.precioCentavos)
    if (t.tipo === 'compra') {
      p.cantidad += t.cantidad
      p.costoBaseCentavos += bruto + t.comisionCentavos
    } else {
      if (t.cantidad > p.cantidad + 1e-10) throw new Error(`Venta sin saldo suficiente: ${key}`)
      const costoVendido = Math.round(p.costoBaseCentavos * t.cantidad / p.cantidad)
      p.pnlRealizadoCentavos += bruto - t.comisionCentavos - costoVendido
      p.costoBaseCentavos -= costoVendido
      p.cantidad -= t.cantidad
      if (Math.abs(p.cantidad) < 1e-10) { p.cantidad = 0; p.costoBaseCentavos = 0 }
    }
    posiciones.set(key, p)
  }
  return [...posiciones.values()]
}
