import type { RespuestaMercado } from './tipos'

export async function consultarMercado(pagina = 1, limite = 50): Promise<RespuestaMercado> {
  const base = import.meta.env.VITE_MERCADO_API_URL as string | undefined
  if (!base) throw new Error('Configura VITE_MERCADO_API_URL para activar los precios reales')
  const url = new URL(base)
  url.searchParams.set('pagina', String(pagina))
  url.searchParams.set('limite', String(limite))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const respuesta = await fetch(url.toString(), { signal: controller.signal, cache: 'no-store', mode: 'cors' })
    if (!respuesta.ok) throw new Error(`Servicio no disponible (HTTP ${respuesta.status})`)
    const data: unknown = await respuesta.json()
    if (!data || typeof data !== 'object' || !('monedas' in data) || !Array.isArray(data.monedas)) {
      throw new Error('Formato de respuesta inválido')
    }
    return data as RespuestaMercado
  } finally {
    clearTimeout(timeout)
  }
}