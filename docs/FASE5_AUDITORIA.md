# LERABOT Fase 5 - Auditoría de Trading

## Fuente
CSV `results(2).csv`: PK, SK, createdAt, details, eventId, eventType, exchangeId, executed, message, operationId, payload, side, signalId, source, stage, status, subscriberId, subscribersCount, symbol, timeframe, tradesCount, tradeType, ttl, updatedAt.

Estados reales: PASS_RULES_ROUTED, REJECTED, SUCCESS. PASS_RULES_ROUTED **no equivale** a orden ejecutada.

## Lambda
Crear `lerabot-auditoria` Node.js 24.x en sa-east-1. Handler index.handler.
Variable **DYNAMODB_AUDIT_TABLE** = nombre REAL de tabla de auditoría (no es ledabot-config). IAM: dynamodb:Scan y dynamodb:GetItem únicamente sobre esa tabla.
CORS_ALLOWED_ORIGINS = orígenes exactos de localhost y Amplify.

## API Gateway REST existente (API Lerabot)
Crear rutas GET con integración Lambda proxy:
- `/auditoria/eventos` → misma Lambda
- `/auditoria/resumen` → misma Lambda
- `/auditoria/eventos/detalle` → misma Lambda (detalle por `?pk=...&sk=...`)

Cada recurso necesita OPTIONS (MOCK) para CORS o Gateway CORS equivalente. GET Authorization NONE para pruebas únicamente. Deploy API a stage `prd`. No se crean métodos PUT.

ATENCIÓN: la ruta conceptual `/auditoria/eventos/{eventId}` NO puede consultar DynamoDB por eventId sin índice secundario; las llaves reales del CSV son PK y SK. Implementamos GET `/auditoria/eventos/detalle?pk=...&sk=...` sin inventar índices.

## Limitaciones honestas de esta primera iteración
- Scan no garantiza orden cronológico, y el filtro/búsqueda son sobre lotes, no búsqueda global. Para producción añadir GSI por fecha/estado o materialización de auditoría.
- Resumen lee como máximo 2000 elementos; `parcial=true` si faltan elementos.
- Listado puede devolver más que el límite solicitado al terminar un lote, para evitar saltarse registros al paginar.
- No se infiere ejecución confirmada de PASS_RULES_ROUTED.
- Exportación CSV exporta la página cargada, no la tabla completa.

## Pruebas
`node --check backend/funciones/auditoria/index.mjs`, `npm run type-check`, `npm run build`. Luego probar GET y CORS sobre las 3 rutas y la pestaña Auditoría.
