# LERABOT | Fase 6 - Operaciones por suscriptor

## Alcance
- Reemplaza la vista ficticia con lecturas reales de operaciones Spot por suscriptor.
- Muestra operaciones registradas (no inventa ventas, transferencias ni comisiones).
- Mercado: precio indicativo CoinGecko, únicamente si existe símbolo correspondiente (BTCUSDT -> BTC, ETHUSDT -> ETH). No equivale al precio real del exchange ni confirma rendimiento realizado.
- Listado con filtros locales, tabla scroll, detalle y JSON, objetivos TP, gráficos derivados de los registros mostrados.
- Lecturas DynamoDB de solo lectura: Scan y GetItem. Sin escrituras.

## AWS Lambda
1. Crear `lerabot-operaciones` en `sa-east-1` con runtime Node.js 24.x, handler `index.handler`.
2. Copiar `backend/funciones/operaciones/index.mjs` al editor de Lambda y pulsar **Deploy**.
3. Variables:
   - `DYNAMODB_OPERATIONS_TABLE`: **nombre exacto de la tabla** que contiene PK `SUB#...#EX#...`, SK `SYM#...#SIG#...`. No se puede inferir el nombre de la tabla desde el CSV.
   - `CORS_ALLOWED_ORIGINS`: `http://localhost:5173,https://main.d3rjwlblam4nwo.amplifyapp.com` (ajustar al dominio verdadero de Amplify).
4. IAM del rol de **lerabot-operaciones**, recurso limitado al ARN real de la tabla:

```json
{"Version":"2012-10-17","Statement":[{"Sid":"ReadOperationsOnly","Effect":"Allow","Action":["dynamodb:Scan","dynamodb:GetItem"],"Resource":"arn:aws:dynamodb:sa-east-1:540651105019:table/NOMBRE_REAL_TABLA"}]}
```

5. Dependencias: `@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb` (AWS SDK v3). Runtime Node.js 24.x de Lambda normalmente las incluye; si el despliegue falla por `ERR_MODULE_NOT_FOUND`, empaquetarlas junto al código o adjuntar layer compatible Node.js 24.x. No agregar capas redundantes si funciona.
6. API Gateway REST `fnpeg3edxj`, stage `prd`, integración **Lambda Proxy** hacia `lerabot-operaciones`:
   - `GET /operaciones` (listado; query `limite`, `cursor`, `suscriptor`, `estado`, `exchange`, `simbolo`)
   - `GET /operaciones/resumen`
   - `GET /operaciones/detalle?pk=...&sk=...`
   - OPTIONS y CORS para cada recurso. Si agregas recursos o métodos, usar **Deploy API → prd**.
   - GET Authorization NONE SOLO mientras utilices entorno de prueba; proteger con autorizador antes de incluir datos personales reales de suscriptores.
7. Configurar Amplify build env `VITE_OPERACIONES_API_URL=https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/operaciones` y `VITE_MERCADO_API_URL=https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/mercado`.

## Pruebas
```powershell
$base = 'https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/operaciones'
curl.exe -i "$base?limite=10"
curl.exe -i "$base/resumen"
curl.exe -i -H 'Origin: http://localhost:5173' "$base/resumen"
```
**Nota PowerShell**: al interpolar con interrogación, utiliza `${base}?limite=10` si el resultado no es el esperado.

Para detalle obtén un PK y SK real del listado, conviértelos con `[uri]::EscapeDataString` y usa `/detalle?pk=...&sk=...`.

## Semántica y límites
- `BUY_CONFIRMED` es el estado almacenado. TP registrados no prueban su ejecución. No hay comisiones ni ventas en el CSV entregado.
- Monto USD de entrada = `buyPrice * quantity`; variación de cotización no es PnL realizado.
- `/resumen` explora hasta 2000 registros y devuelve `parcial` si quedan registros.
- `/operaciones` pagina por `LastEvaluatedKey`. Scan no ofrece orden cronológico garantizado; con más volumen se recomienda GSI por fecha y suscriptor con Query.
- Filtros de UI se aplican a la página cargada. Para filtros globales aprovechar parámetros del backend, aumentar índices y buscar server-side en una futura iteración.
- El endpoint publica IDs de suscriptores: usar solamente datos de prueba con Authorization NONE.
