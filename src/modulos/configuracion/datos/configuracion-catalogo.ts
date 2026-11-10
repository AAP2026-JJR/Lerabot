/** Snapshot del archivo results.csv compartido; datos de REFERENCIA, nunca leidos de AWS. */
export interface PuntoConexion { baseUrl: string; rateLimit: number; timeout: number }
export interface ExchangeConfigurado { name: string; spot: PuntoConexion; futures: PuntoConexion }
export interface ConfiguracionGlobal {
  defaults: {
    region: string
    stage: string
    maxBalancePercentPerTrade: number
    minSignalQuality: number
    maxRetries: number
    defaultFuturesRiskPercent: number | null
    enabledTimeframes: { SPOT: string[]; FUTURES: string[] }
    logging: { level: string; structured: boolean; enablePerformanceMetrics: boolean; enableSummaryLogs: boolean }
    exchanges: Record<string, ExchangeConfigurado>
  }
  features: {
    enableSpotTrading: boolean
    enableFuturesTrading: boolean
    enableDynamoDB: boolean
    enableDynamoAudit: boolean
    enableDynamoConfig: boolean
    enableSpotLifecyclePersistence: boolean
    enableNotifications: boolean
  }
}
export const configuracionInicial: ConfiguracionGlobal = {
  defaults: {
    region: 'sa-east-1', stage: 'dev',
    maxBalancePercentPerTrade: 50, minSignalQuality: 50, maxRetries: 3,
    defaultFuturesRiskPercent: null,
    enabledTimeframes: { SPOT: ['1d', '1w'], FUTURES: ['30m', '1h', '2h', '4h', '1m', '5m'] },
    logging: { level: 'INFO', structured: true, enablePerformanceMetrics: true, enableSummaryLogs: false },
    exchanges: {
      binance: { name: 'Binance', spot: { baseUrl: 'https://api.binance.com', rateLimit: 1200, timeout: 10000 }, futures: { baseUrl: 'https://fapi.binance.com', rateLimit: 1200, timeout: 10000 } },
      bingx: { name: 'BingX', spot: { baseUrl: 'https://open-api.bingx.com', rateLimit: 600, timeout: 10000 }, futures: { baseUrl: 'https://open-api.bingx.com', rateLimit: 600, timeout: 10000 } },
    },
  },
  features: {
    enableSpotTrading: false, enableFuturesTrading: true, enableDynamoDB: false,
    enableDynamoAudit: false, enableDynamoConfig: false,
    enableSpotLifecyclePersistence: false, enableNotifications: false,
  },
}
export const opcionesTimeframe = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'] as const
