import type { BalanceFutures, Cotizacion, MovimientoExterno, TradeSpot, TransferenciaInterna } from '../../../contratos/finanzas'
export const tradesDemo: TradeSpot[] = [
  {id:'t1',cuentaId:'binance-spot',activo:'BTC',tipo:'compra',cantidad:0.1,precioCentavos:6000000,comisionCentavos:100,fechaISO:'2026-01-01T00:00:00Z'},
  {id:'t2',cuentaId:'binance-spot',activo:'BTC',tipo:'compra',cantidad:0.1,precioCentavos:8000000,comisionCentavos:100,fechaISO:'2026-02-01T00:00:00Z'},
  {id:'t3',cuentaId:'binance-spot',activo:'BTC',tipo:'venta',cantidad:0.05,precioCentavos:9000000,comisionCentavos:75,fechaISO:'2026-03-01T00:00:00Z'},
]
export const cotizacionesDemo: Cotizacion[] = [{activo:'BTC',precioCentavos:8500000,fechaISO:'2026-10-01T00:00:00Z'}]
export const futurosDemo: BalanceFutures[] = [{cuentaId:'bingx-futures',equityCentavos:250000,margenUtilizadoCentavos:80000,pnlNoRealizadoCentavos:10000,pnlRealizadoCentavos:5000}]
export const flujosDemo: MovimientoExterno[] = [{id:'f1',cuentaId:'binance-spot',clase:'deposito',centavos:1000000,fechaISO:'2026-01-01T00:00:00Z'}]
export const transferenciasDemo: TransferenciaInterna[] = [{id:'i1',clase:'transferencia',origenId:'binance-spot',destinoId:'bingx-spot',activo:'USDT',cantidad:100,fechaISO:'2026-03-01T00:00:00Z'}]
