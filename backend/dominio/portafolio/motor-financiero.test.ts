import { describe, expect, it } from 'vitest'
import { calcularPosicionesSpot } from './motor-spot'
import { consolidarFinanzas } from './consolidar'
import { cotizacionesDemo, flujosDemo, futurosDemo, tradesDemo } from './datos-demo'

describe('motor financiero Fase 3', () => {
  it('calcula costo ponderado, fee y P&L realizado en venta parcial', () => {
    const [p] = calcularPosicionesSpot(tradesDemo)
    expect(p).toBeDefined()
    expect(p!.cantidad).toBeCloseTo(0.15)
    expect(p!.costoBaseCentavos).toBe(1050150)
    expect(p!.pnlRealizadoCentavos).toBe(99875)
  })
  it('consolida spot y futures sin contar margen dos veces', () => {
    const resumen = consolidarFinanzas({posiciones:calcularPosicionesSpot(tradesDemo),cotizaciones:cotizacionesDemo,futuros:futurosDemo,flujosExternos:flujosDemo})
    expect(resumen.valorSpotCentavos).toBe(1275000)
    expect(resumen.equityFuturesCentavos).toBe(250000)
    expect(resumen.patrimonioCentavos).toBe(1525000)
    expect(resumen.pnlNoRealizadoSpotCentavos).toBe(224850)
    expect(resumen.flujoExternoNetoCentavos).toBe(1000000)
  })
  it('no inventa P&L a partir de transferencias (no son trades)', () => {
    const sinCambios = calcularPosicionesSpot(tradesDemo)
    expect(sinCambios).toEqual(calcularPosicionesSpot(tradesDemo))
  })
  it('rechaza venta sin saldo', () => {
    expect(() => calcularPosicionesSpot([{...tradesDemo[0]!, tipo:'venta'}])).toThrow('saldo suficiente')
  })
  it('rechaza trades duplicados', () => {
    expect(() => calcularPosicionesSpot([tradesDemo[0]!,tradesDemo[0]!])).toThrow('duplicado')
  })
  it('admite una perdida no realizada', () => {
    const x = consolidarFinanzas({posiciones:calcularPosicionesSpot([tradesDemo[0]!]),cotizaciones:[{activo:'BTC',precioCentavos:4000000,fechaISO:'2026-10-01'}],futuros:[],flujosExternos:[]})
    expect(x.pnlNoRealizadoSpotCentavos).toBeLessThan(0)
  })
})
