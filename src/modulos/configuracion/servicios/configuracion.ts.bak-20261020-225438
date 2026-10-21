import type { ConfiguracionGlobal } from '../datos/configuracion-catalogo'

export interface DocumentoConfiguracion extends ConfiguracionGlobal {
  version: number
  createdAt?: string
  updatedAt?: string
}
type ApiResponse = { ok: boolean; configuracion?: DocumentoConfiguracion; error?: string }
export class ErrorConfiguracion extends Error {
  constructor(public readonly codigo: number, mensaje: string) { super(mensaje) }
}
function endpoint(): string {
  const url = import.meta.env.VITE_CONFIGURACION_API_URL as string | undefined
  if (!url) throw new ErrorConfiguracion(0, 'Configura VITE_CONFIGURACION_API_URL')
  return url
}
async function peticion(metodo: 'GET' | 'PUT', body?: object): Promise<DocumentoConfiguracion> {
  let respuesta: Response
  try {
    respuesta = await fetch(endpoint(), {
      method: metodo,
      headers: { Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
  } catch {
    throw new ErrorConfiguracion(0, 'No fue posible conectar con API Gateway. Revisa red y CORS.')
  }
  const datos = await respuesta.json().catch(() => ({})) as ApiResponse
  if (!respuesta.ok || !datos.ok || !datos.configuracion) {
    throw new ErrorConfiguracion(respuesta.status, datos.error || `Error HTTP ${respuesta.status}`)
  }
  return datos.configuracion
}
export const leerConfiguracion = () => peticion('GET')
export const guardarConfiguracion = (doc: DocumentoConfiguracion) =>
  peticion('PUT', { defaults: doc.defaults, features: doc.features, version: doc.version })
