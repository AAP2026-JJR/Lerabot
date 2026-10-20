import type { BalanceFutures, Cotizacion, MovimientoExterno, PosicionSpot, ResumenFinanciero } from '../../../contratos/finanzas'

export function consolidarFinanzas(args: {
  posiciones: readonly PosicionSpot[]
  cotizaciones: readonly Cotizacion[]
  futuros: readonly BalanceFutures[]
  flujosExternos: readonly MovimientoExterno[]
}): ResumenFinanciero {
  const precios = new Map(args.cotizaciones.map(x => [x.activo, x.precioCentavos]))
  let valorSpot = 0
  for (const p of args.posiciones) {
    const precio = precios.get(p.activo)
    if (precio === undefined || !Number.isSafeInteger(precio) || precio < 0) throw new Error(`Cotizacion faltante/invalida: ${p.activo}`)
    valorSpot += Math.round(p.cantidad * precio)
  }
  const ids = new Set<string>()
  let equityFutures = 0
  for (const futuro of args.futuros) {
    if (ids.has(futuro.cuentaId)) throw new Error('Cuenta Futures duplicada')
    ids.add(futuro.cuentaId)
    equityFutures += futuro.equityCentavos
  }
  const costo = args.posiciones.reduce((n,p) => n+p.costoBaseCentavos,0)
  const realizado = args.posiciones.reduce((n,p) => n+p.pnlRealizadoCentavos,0)
  const flujo = args.flujosExternos.reduce((n,m) => n+(m.clase==='deposito'?m.centavos:-m.centavos),0)
  return {
    valorSpotCentavos: valorSpot,
    equityFuturesCentavos: equityFutures,
    patrimonioCentavos: valorSpot + equityFutures,
    costoBaseSpotCentavos: costo,
    pnlNoRealizadoSpotCentavos: valorSpot - costo,
    pnlRealizadoSpotCentavos: realizado,
    flujoExternoNetoCentavos: flujo,
  }
}
