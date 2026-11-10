export interface OperacionSpot {
  PK: string; SK: string
  operationId?: string; signalId?: string; eventId?: string
  symbol?: string; exchangeId?: string; status?: string; tradeType?: string
  side?: string; buyOrderId?: string; buyOrderType?: string
  buyPrice?: number; quantity?: number; createdAt?: string; updatedAt?: string
  tpCount?: number; tpOrders?: unknown
  tp1Price?: number; tp1Quantity?: number; tp1OrderId?: string
  tp2Price?: number; tp2Quantity?: number; tp2OrderId?: string
  tp3Price?: number; tp3Quantity?: number; tp3OrderId?: string
  [key: string]: unknown
}
export interface RespuestaOperaciones { ok: boolean; operaciones: OperacionSpot[]; siguienteCursor: string | null; examinados: number; parcial?: boolean }
export interface ResumenOperaciones { ok: boolean; total: number; compras: number; ventas: number; otros: number; suscriptores: number; volumenComprasUsd: number; porSimbolo: Record<string,number>; porEstado: Record<string,number>; parcial: boolean; examinados: number }
