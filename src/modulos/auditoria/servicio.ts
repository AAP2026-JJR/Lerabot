import type { EventoAuditoria, PaginaAuditoria, ResumenAuditoria } from './tipos'
const base = (import.meta.env.VITE_AUDITORIA_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/auditoria'
async function leer<T>(ruta: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(base + ruta)
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v) })
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 16000)
  try {
    const res = await fetch(url.toString(), { signal: controller.signal, cache: 'no-store' })
    const data: unknown = await res.json()
    if (!res.ok) throw new Error(`Auditoría: HTTP ${res.status}`)
    return data as T
  } finally { clearTimeout(id) }
}
export const listarEventos = (params: Record<string, string>) => leer<PaginaAuditoria>('/eventos', params)
export const obtenerResumen = () => leer<ResumenAuditoria>('/resumen')
export const leerEvento = (pk: string, sk: string) => leer<{ok: boolean; evento: EventoAuditoria}>('/eventos/detalle', {pk, sk})
