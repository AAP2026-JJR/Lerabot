// LERABOT: precios publicos de mercado - AWS Lambda Node.js 22.x (REST API Lambda proxy).
// Configura COINGECKO_DEMO_API_KEY y CORS_ALLOWED_ORIGINS (lista separada por comas).
// La clave solo existe en Lambda, nunca en Vue.
const ENDPOINT = 'https://api.coingecko.com/api/v3/coins/markets';
const TTL_MS = 300_000;
const cache = new Map(); // por instancia: NO es cache distribuida

function origenesPermitidos() {
  return (process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}
function corsHeaders(event) {
  const origen = event?.headers?.origin || event?.headers?.Origin || '';
  const autorizados = origenesPermitidos();
  const headers = { 'vary': 'Origin' };
  if (origen && autorizados.includes(origen)) {
    headers['access-control-allow-origin'] = origen;
    headers['access-control-allow-methods'] = 'GET,OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type';
  }
  return headers;
}
function respuesta(event, statusCode, contenido) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Browser should revalidate. Lambda applies its own 5 minute cache.
      'cache-control': 'no-store',
      ...corsHeaders(event),
    },
    body: JSON.stringify(contenido),
  };
}
function numeroSeguro(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export const handler = async (event = {}) => {
  const method = event?.httpMethod || event?.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(event), body: '' };
  if (method !== 'GET') return respuesta(event, 405, { error: 'Metodo no permitido' });

  const params = event.queryStringParameters || {};
  const pagina = Number(params.pagina ?? 1);
  const limite = Number(params.limite ?? 50);
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10 || ![25, 50, 100].includes(limite)) {
    return respuesta(event, 400, { error: 'Use pagina=1..10 y limite=25,50,100' });
  }
  const apiKey = process.env.COINGECKO_DEMO_API_KEY;
  if (!apiKey) return respuesta(event, 503, { error: 'Proveedor de mercado no configurado' });

  const clave = `${pagina}:${limite}`;
  const ahora = Date.now();
  const anterior = cache.get(clave);
  if (anterior && ahora - anterior.guardadoEn < TTL_MS) {
    return respuesta(event, 200, anterior.datos);
  }

  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('order', 'market_cap_desc');
    url.searchParams.set('per_page', String(limite));
    url.searchParams.set('page', String(pagina));
    url.searchParams.set('sparkline', 'false');
    url.searchParams.set('price_change_percentage', '24h');
    const result = await fetch(url, {
      headers: { 'x-cg-demo-api-key': apiKey, 'accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) {
      console.error('CoinGecko HTTP', result.status);
      if (anterior) return respuesta(event, 200, { ...anterior.datos, desactualizado: true });
      return respuesta(event, result.status === 429 ? 429 : 502, { error: 'Proveedor de mercado no disponible' });
    }
    const datos = await result.json();
    if (!Array.isArray(datos)) throw new Error('Respuesta CoinGecko invalida');
    const monedas = datos.map((m) => ({
      id: String(m.id ?? ''),
      simbolo: String(m.symbol ?? '').toUpperCase(),
      nombre: String(m.name ?? ''),
      precioUsd: numeroSeguro(m.current_price),
      cambio24h: numeroSeguro(m.price_change_percentage_24h),
      capitalizacionUsd: numeroSeguro(m.market_cap),
      posicion: numeroSeguro(m.market_cap_rank),
    }));
    const respuestaFinal = {
      fuente: 'CoinGecko', actualizadoEn: new Date().toISOString(),
      pagina, limite, desactualizado: false, monedas,
    };
    cache.set(clave, { guardadoEn: Date.now(), datos: respuestaFinal });
    return respuesta(event, 200, respuestaFinal);
  } catch (err) {
    console.error('Error al consultar proveedor', err instanceof Error ? err.message : String(err));
    if (anterior) return respuesta(event, 200, { ...anterior.datos, desactualizado: true });
    return respuesta(event, 502, { error: 'No fue posible consultar el mercado' });
  }
};
