import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const pool = import.meta.env.VITE_COGNITO_POOL_ID as string | undefined
const dominio = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined
const region = import.meta.env.VITE_COGNITO_REGION || 'sa-east-1'
const url = import.meta.env.VITE_COGNITO_REDIRECT_URI || `${window.location.origin}/configuracion`

export const autenticacionLista = Boolean(pool && dominio && clientId)
export const administradorOidc = autenticacionLista
  ? new UserManager({
      authority: `https://cognito-idp.${region}.amazonaws.com/${pool}`,
      metadataUrl: `https://cognito-idp.${region}.amazonaws.com/${pool}/.well-known/openid-configuration`,
      client_id: clientId!,
      redirect_uri: url,
      post_logout_redirect_uri: url,
      response_type: 'code',
      scope: 'openid email profile',
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: false,
    })
  : null
export async function completarRetorno(): Promise<void> {
  if (!administradorOidc) return
  const params = new URLSearchParams(window.location.search)
  if (params.has('code') && params.has('state')) await administradorOidc.signinRedirectCallback()
}
export async function tokenId(): Promise<string | null> {
  const user = await administradorOidc?.getUser()
  return user && !user.expired ? (user.id_token ?? null) : null
}
