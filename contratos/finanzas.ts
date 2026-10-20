/** Contratos de la Fase 3: importables desde Vue y Lambdas. */
export type CentavosUSD = number
export type ExchangeId = 'binance' | 'bingx' | 'bybit' | 'okx' | 'otro'
export type CuentaTipo = 'spot' | 'futures'
export interface CuentaExchange { id: string; exchange: ExchangeId; tipo: CuentaTipo; usuarioId: string }
export interface MovimientoExterno { id: string; clase: 'deposito' | 'retiro'; centavos: CentavosUSD; fechaISO: string; cuentaId: string }
export interface TransferenciaInterna { id: string; clase: 'transferencia'; origenId: string; destinoId: string; activo: string; cantidad: number; fechaISO: string }
export interface TradeSpot { id: string; cuentaId: string; activo: string; tipo: 'compra' | 'venta'; cantidad: number; precioCentavos: CentavosUSD; comisionCentavos: CentavosUSD; fechaISO: string }
export interface PosicionSpot { cuentaId: string; activo: string; cantidad: number; costoBaseCentavos: CentavosUSD; pnlRealizadoCentavos: CentavosUSD }
export interface Cotizacion { activo: string; precioCentavos: CentavosUSD; fechaISO: string }
export interface BalanceFutures { cuentaId: string; equityCentavos: CentavosUSD; margenUtilizadoCentavos: CentavosUSD; pnlNoRealizadoCentavos: CentavosUSD; pnlRealizadoCentavos: CentavosUSD }
export interface ResumenFinanciero { valorSpotCentavos: CentavosUSD; equityFuturesCentavos: CentavosUSD; patrimonioCentavos: CentavosUSD; costoBaseSpotCentavos: CentavosUSD; pnlNoRealizadoSpotCentavos: CentavosUSD; pnlRealizadoSpotCentavos: CentavosUSD; flujoExternoNetoCentavos: CentavosUSD }
