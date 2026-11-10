import type { OperacionSpot, RespuestaOperaciones, ResumenOperaciones } from './tipos'
import { consultarMercado } from '../mercado/servicio'

const BASE = (import.meta.env.VITE_OPERACIONES_API_URL as string | undefined)?.replace(/\/$/, '') || 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/operaciones'
async function leer<T>(ruta: string, filtros: Record<string,string> = {}): Promise<T> {
  const url = new URL(BASE + ruta)
  for (const [k,v] of Object.entries(filtros)) if(v) url.searchParams.set(k,v)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url.toString(), { signal: controller.signal, cache: 'no-store' })
    const datos: unknown = await res.json()
    if (!res.ok) {
      const mensaje = datos && typeof datos === 'object' && 'error' in datos ? String(datos.error) : `HTTP ${res.status}`
      throw new Error(mensaje)
    }
    return datos as T
  } finally { clearTimeout(timer) }
}
export const listarOperaciones = (parametros: Record<string,string> = {}) => leer<RespuestaOperaciones>('', parametros)
export const resumenOperaciones = () => leer<ResumenOperaciones>('/resumen')
export const detalleOperacion = (pk:string,sk:string) => leer<{ok:boolean;operacion:OperacionSpot}>('/detalle',{pk,sk})
export async function preciosDeMercado(simbolos: string[]): Promise<Record<string,{precio:number;cambio24h:number|null}>> {
  const pendientes = new Set(simbolos.map(s => s.replace(/\W/g,'').toUpperCase()).filter(Boolean))
  const encontrados: Record<string,{precio:number;cambio24h:number|null}> = {}
  // CoinGecko usa ticker base; no asume que cualquier simbolo sea USDT.
  for (let pagina=1; pagina<=3 && pendientes.size; pagina++) {
    const r = await consultarMercado(pagina,100)
    for (const moneda of r.monedas) {
      const ticker = moneda.simbolo.toUpperCase()
      const par = ticker + 'USDT'
      if (pendientes.has(par) && typeof moneda.precioUsd === 'number') {
        encontrados[par] = {precio:moneda.precioUsd,cambio24h:moneda.cambio24h}; pendientes.delete(par)
      }
    }
    if (r.monedas.length<100) break
  }
  return encontrados
}
