export type RolDemo = 'ADMIN' | 'SUBSCRIBER'
export interface SesionDemo { email: string; rol: RolDemo; subscriberId: string | null }
const KEY = 'lerabot_perfil_visual'
// Sesion visual de navegacion: NO constituye autenticacion ni autoriza datos privados.
export function sesionDemo(): SesionDemo | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const data = value as Record<string, unknown>
    if (typeof data.email !== 'string' || !data.email.includes('@')) return null
    if (data.status !== 'active') return null
    if (data.role !== 'ADMIN' && data.role !== 'SUBSCRIBER') return null
    const subscriberId = typeof data.subscriberId === 'string' ? data.subscriberId : null
    if (data.role === 'SUBSCRIBER' && !subscriberId) return null
    return { email: data.email.toLowerCase(), rol: data.role, subscriberId }
  } catch { return null }
}
export function entrarDemo(_emailInput: string): SesionDemo | null { return sesionDemo() }
export function salirDemo(): void { sessionStorage.removeItem(KEY); sessionStorage.removeItem('lerabot_demo_sesion_v1') }