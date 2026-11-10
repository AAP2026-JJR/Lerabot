import type { ResumenFinanciero } from '../../../contratos/finanzas'
/** Contrato para la futura Lambda. Sin API keys, sin llamadas en Fase 3. */
export interface FuenteResumenFinanciero {
  obtenerResumen(usuarioId: string): Promise<ResumenFinanciero>
}
export class ServicioFinancieroHttp implements FuenteResumenFinanciero {
  constructor(private readonly apiBase: string, private readonly token: () => Promise<string>) {}
  async obtenerResumen(usuarioId: string): Promise<ResumenFinanciero> {
    if (!this.apiBase.startsWith('https://')) throw new Error('Se requiere HTTPS')
    const jwt = await this.token()
    const respuesta = await fetch(`${this.apiBase.replace(/\/$/,'')}/usuarios/${encodeURIComponent(usuarioId)}/resumen`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!respuesta.ok) throw new Error(`Error al consultar resumen: ${respuesta.status}`)
    return await respuesta.json() as ResumenFinanciero
  }
}
