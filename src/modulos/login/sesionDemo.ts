export type RolDemo = 'ADMIN' | 'SUBSCRIBER'
export interface SesionDemo { email: string; rol: RolDemo; subscriberId: string | null }
const KEY = 'lerabot_demo_sesion_v1'
const ADMIN = 'huamaniledesmajose@gmail.com'
// Solo fixtures de demostracion. NO autoriza API ni valida identidad.
const SUSCRIPTORES: Record<string,string> = { 'suscriptor.demo@ejemplo.com': 'SUB_001', 'suscriptor2.demo@ejemplo.com': 'SUB_002' }
export function entrarDemo(emailInput: string): SesionDemo | null {
  const email = emailInput.trim().toLowerCase()
  if (email !== ADMIN && !Object.prototype.hasOwnProperty.call(SUSCRIPTORES,email)) return null
  const s: SesionDemo = email === ADMIN ? {email,rol:'ADMIN',subscriberId:null} : {email,rol:'SUBSCRIBER',subscriberId:SUSCRIPTORES[email]!}
  sessionStorage.setItem(KEY,JSON.stringify(s))
  return s
}
export function sesionDemo(): SesionDemo | null {
  try { const raw = sessionStorage.getItem(KEY); if (!raw) return null
    const v: unknown = JSON.parse(raw)
    if(!v || typeof v!=='object') return null
    const s = v as Partial<SesionDemo>
    if(typeof s.email !== 'string') return null
    const email=s.email.toLowerCase()
    if(email===ADMIN && s.rol==='ADMIN' && s.subscriberId===null) return {email,rol:'ADMIN',subscriberId:null}
    if(s.rol==='SUBSCRIBER' && s.subscriberId===SUSCRIPTORES[email]) return {email,rol:'SUBSCRIBER',subscriberId:s.subscriberId ?? null}
  } catch { return null }
  return null
}
export function salirDemo() { sessionStorage.removeItem(KEY) }
