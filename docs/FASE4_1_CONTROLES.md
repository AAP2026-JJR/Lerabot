# LERABOT Fase 4.1 — Controles de configuración (ampliación)

- Valores iniciales: snapshot `results.csv`, PK `SYS#GLOBAL`, SK `PROFILE` (no lectura en vivo).
- Secciones: General, Exchanges, Riesgos y Sistema.
- Booleanos: switches verde=activo, gris=inactivo.
- Arrays de timeframes: casillas seleccionables para SPOT y FUTURES.
- Riesgos: campos numéricos con límites de interfaz (NO sustituyen validación backend).
- Exchanges: parámetros base URL, rateLimit y timeout de Binance/BingX. Bybit no estaba en el CSV.
- Sistema: logging, región, stage y todas las siete flags `features`.
- Los cambios son VOLÁTILES: se pierden al recargar. `Exportar borrador JSON` es solo una exportación local.
- El valor enableFuturesTrading=true procede del snapshot, NO activa funciones remotas.
- No se habilitan PUT ni escritura DynamoDB hasta Cognito + autorización + validación + auditoría.
- Verificar: npm run type-check; npm run build; interacción de todos los controles; reset, exportación; regresión Mercado.
