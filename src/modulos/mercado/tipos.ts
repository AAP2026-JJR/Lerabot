export interface PrecioMoneda {
  id: string
  simbolo: string
  nombre: string
  precioUsd: number | null
  cambio24h: number | null
  capitalizacionUsd: number | null
  posicion: number | null
}
export interface RespuestaMercado {
  fuente: string
  actualizadoEn: string
  pagina: number
  limite: number
  desactualizado: boolean
  monedas: PrecioMoneda[]
}