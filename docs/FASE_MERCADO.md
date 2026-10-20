# LERABOT — Mercado público de criptomonedas

## Alcance MVP
- Nueva pantalla `/mercado`, independiente de Exchanges y Portafolio.
- Fuente CoinGecko `/coins/markets`: precios agregados (USD), cambio 24h y capitalización.
- AWS Lambda Node.js 22.x detrás de API Gateway HTTP API (`GET /mercado`).
- Datos reales solamente cuando el endpoint esté configurado; nunca inventar precios.
- La vista solicita 50 monedas y pagina; NO devuelve todas las criptomonedas simultáneamente.
- Refresco automático de la vista cada 5 minutos y actualización manual.
- API Key CoinGecko solo en las variables de entorno de Lambda, nunca como `VITE_*`.

## Despliegue AWS manual (primera versión)
1. Crear Lambda con runtime Node.js 22.x y subir `backend/funciones/mercado/index.mjs` como `index.mjs`, handler `index.handler`.
2. Configurar `COINGECKO_DEMO_API_KEY` y `CORS_ORIGIN=https://TU-RAMA.amplifyapp.com` en Lambda. No registrar la clave en Git.
3. Crear HTTP API en API Gateway con ruta `GET /mercado` integrada a la Lambda; habilitar CORS para dominio Amplify, método GET y cabecera Content-Type. Sin Cognito todavía: endpoint público con throttling y presupuesto/alertas.
4. Probar `https://API_ID.execute-api.REGION.amazonaws.com/mercado?pagina=1&limite=50`.
5. En AWS Amplify configurar `VITE_MERCADO_API_URL` con URL completa de GET y redeploy (las variables Vite son de tiempo de compilación).
6. Probar ruta `/mercado`; consultar en CloudWatch errores, duración, cuotas y consumo.

## Limitaciones que debemos tratar antes de escalar
- Caché actual es por contenedor Lambda: varias instancias pueden consultar la fuente simultáneamente. Proteger cuota con caché distribuida (DynamoDB con expiración lógica) o programador que refresque un snapshot global.
- Consultas externas tienen límites y posibles indisponibilidades; la Lambda devuelve 502/503 si no hay datos previos.
- Esta primera versión no filtra por activos del usuario: eso requiere Cognito, portafolio conectado y colección de IDs de monedas.
- Diferentes proveedores pueden cotizar diferente; el precio agregado no garantiza precio ejecutable en un exchange.
- No usar la diferencia 24h como P&L del usuario.
- Antes de exponer públicamente en producción: límites de API Gateway, alertas de gasto, políticas CORS y pruebas con usuarios simultáneos.

## Ajustes de cierre 3.9 (REST API real)
- La infraestructura activa es **API Gateway REST API**, stage `prd`, metodo `GET /mercado`, **Lambda proxy integration = True**. La seccion anterior que menciona HTTP API es historica.
- Configura `CORS_ALLOWED_ORIGINS=http://localhost:5173,https://TU-DOMINIO-AMPLIFY` (solo orígenes exactos, sin slash final). `CORS_ORIGIN` se acepta como respaldo temporal. Mantener `COINGECKO_DEMO_API_KEY`.
- REST API: `OPTIONS /mercado` Mock existente debe anunciar `Access-Control-Allow-Methods: 'GET,OPTIONS'`, origen permitido, y si se modifica OPTIONS hay que hacer Deploy API al stage `prd`. La Lambda proxy proporciona CORS para GET/errores.
- Frontend usa `cache: 'no-store'`; Lambda conserva cache en memoria **5 minutos por contenedor**. `Actualizar ahora` revalida via API Gateway, pero puede retornar los mismos datos desde Lambda durante el TTL. No equivale a forzar consulta nueva al proveedor.
- `actualizadoEn` es hora de consulta efectiva al proveedor y `ultimaConsulta` hora de intento exitoso del cliente. Revisar `desactualizado` cuando el proveedor falle.
- AWS Lambda Console: copiar el contenido de `backend/funciones/mercado/index.mjs`, Deploy y ejecutar Test. La actualizacion del repositorio no despliega Lambda automaticamente.
- Antes de publicar: validar CORS en localhost y Amplify, throttling para REST API, cuota de CoinGecko, logs sin credenciales, alarmas/costos y controles de abuso para endpoint publico.
- Algun request puede superar limite de CoinGecko; considerar DynamoDB snapshots/cache compartida antes de escalar.
