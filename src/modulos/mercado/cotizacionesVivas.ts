import { shallowRef } from 'vue'

export type CotizacionViva = { precio: number; cambio24h: number | null; actualizado: number; fuente: 'Binance Spot' }
export const cotizacionesVivas = shallowRef<Record<string, CotizacionViva>>({})
export const estadoCotizaciones = shallowRef<'conectando' | 'en-vivo' | 'desconectado'>('desconectado')

const clientes = new Map<number, Set<string>>()
let siguienteCliente = 0
let socket: WebSocket | null = null
let reintento: ReturnType<typeof setTimeout> | undefined
let idle: ReturnType<typeof setTimeout> | undefined
let contador = 1
let activos = new Set<string>()
const normalizar = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
const requeridos = () => new Set([...clientes.values()].flatMap(x => [...x]))
const enviar = (metodo: 'SUBSCRIBE' | 'UNSUBSCRIBE', simbolos: string[]) => {
  if (socket?.readyState !== WebSocket.OPEN || simbolos.length === 0) return
  socket.send(JSON.stringify({ method: metodo, params: simbolos.map(s => s.toLowerCase() + '@miniTicker'), id: contador++ }))
}
function sincronizar() {
  if (socket?.readyState !== WebSocket.OPEN) return
  const nuevos = requeridos()
  enviar('SUBSCRIBE', [...nuevos].filter(s => !activos.has(s)))
  enviar('UNSUBSCRIBE', [...activos].filter(s => !nuevos.has(s)))
  activos = nuevos
}
function conectar() {
  if (clientes.size === 0 || socket || typeof WebSocket === 'undefined') return
  if (reintento) { clearTimeout(reintento); reintento = undefined }
  estadoCotizaciones.value = 'conectando'
  const ws = new WebSocket('wss://stream.binance.com:9443/ws')
  socket = ws
  ws.onopen = () => { activos = new Set(); estadoCotizaciones.value = 'en-vivo'; sincronizar() }
  ws.onmessage = ev => {
    try {
      const d = JSON.parse(String(ev.data)) as Record<string, unknown>
      if (d.e !== '24hrMiniTicker' || typeof d.s !== 'string') return
      const precio = Number(d.c), apertura = Number(d.o)
      if (!Number.isFinite(precio) || precio <= 0) return
      cotizacionesVivas.value = {
        ...cotizacionesVivas.value,
        [d.s]: { precio, cambio24h: Number.isFinite(apertura) && apertura > 0 ? (precio / apertura - 1) * 100 : null, actualizado: Date.now(), fuente: 'Binance Spot' }
      }
    } catch { /* ignorar respuestas de control y mensajes invalidos */ }
  }
  ws.onclose = () => {
    if (socket !== ws) return
    socket = null; activos.clear(); estadoCotizaciones.value = 'desconectado'
    if (clientes.size) reintento = setTimeout(conectar, 4000)
  }
  ws.onerror = () => { ws.close() }
}
export function observarCotizaciones(simbolos: string[]): () => void {
  const id = ++siguienteCliente
  const lista = new Set(simbolos.map(normalizar).filter(s => /^[A-Z0-9]+USDT$/.test(s)))
  clientes.set(id, lista)
  if (idle) { clearTimeout(idle); idle = undefined }
  conectar(); sincronizar()
  return () => {
    clientes.delete(id); sincronizar()
    if (!clientes.size) idle = setTimeout(() => {
      if (clientes.size) return
      if (reintento) { clearTimeout(reintento); reintento = undefined }
      socket?.close(); socket = null; activos.clear(); estadoCotizaciones.value = 'desconectado'
    }, 1500)
  }
}
export function cotizacionActual(simbolo: string): CotizacionViva | null {
  const d = cotizacionesVivas.value[normalizar(simbolo)]
  return d && Date.now() - d.actualizado < 30000 ? d : null
}
