export interface EventoAuditoria {
  PK: string; SK: string; eventId?: string; createdAt?: string; updatedAt?: string;
  status?: string; source?: string; eventType?: string; operationId?: string;
  signalId?: string; symbol?: string; tradeType?: string; side?: string;
  timeframe?: string; message?: string; exchangeId?: string;
  executed?: boolean | string; tradesCount?: number | string;
  details?: unknown; payload?: unknown; [key: string]: unknown
}
export interface PaginaAuditoria { ok: boolean; eventos: EventoAuditoria[]; siguienteCursor: string | null; parcial?: boolean; examinados?: number }
export interface ResumenAuditoria { ok: boolean; total: number; porEstado: Record<string, number>; porFuente: Record<string, number>; ultimoEvento: string | null; parcial: boolean; examinados: number }
