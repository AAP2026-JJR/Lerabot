# Fase 3 — modelo financiero LERABOT (v1, demostración)

## Convenciones cerradas
- Moneda de reporte: USD. Montos monetarios en **centavos enteros** (`CentavosUSD`); cantidades y precios en `number` solo para simulaciones, NO para liquidación real.
- Patrimonio: suma del valor de posiciones Spot y de equity de cuentas Futures, **sin sumar dos veces garantías o transferencias internas**. La equity Futures recibida del proveedor es autoritativa para cada cuenta.
- Costo base: promedio ponderado móvil por cuenta/exchange/activo. Una compra incrementa cantidad y costo base; venta reduce el costo base proporcional y materializa P&L. Las comisiones en USD se imputan al costo de compra o descuentan del producto de venta.
- Flujo externo neto = depósitos externos menos retiros externos. Las transferencias internas no alteran aportaciones ni P&L, y deben trasladar costo base cuando se transfieren activos entre cuentas. Las transferencias quedan modeladas pero su reconciliación con cost basis multi-cuenta es requisito para integrar cuentas reales.
- P&L no realizado Spot = valor de mercado de la posición − costo base restante.
- P&L realizado Spot = ingresos netos de ventas − costo base retirado. El cálculo NO incorpora ingresos por staking, airdrops, FX, funding, impuestos ni comisiones pagadas en activos distintos de USD.
- Futures: el P&L realizado / no realizado, margen y equity provienen de datos normalizados del exchange, **no** se infieren del balance spot.
- Rentabilidad: NO calcular ROI ingenuo como P&L / depósitos con flujos entre fechas. Para rendimientos temporales se requiere una serie de valuations y flujos externos, aplicando TWR o XIRR según objetivo. La v1 muestra patrimonio y P&L, sin inventar rendimiento porcentual.
- El motor **no debe tratar movimientos internos como ganancias** ni suponer que todos los depósitos tienen costo base cero.

## Alcance y limitaciones
- Módulo determinista con casos de prueba, contratos TypeScript, demo y adaptador HTTP de solo lectura.
- NO hay AWS Lambda funcional, exchanges reales, credenciales, autenticación, persistencia histórica, tasa FX USD/PEN ni contabilidad fiscal.
- La reconciliación integral de transferencias, fees pagadas en token, FIFO/LIFO, posiciones cortas, derivados complejos y rendimiento histórico se implementarán y probarán antes de pasar a datos reales.
- Se requiere reconciliar snapshots contra las APIs fuente y cubrir paginación, errores, idempotencia y desfases temporales en fases backend.

## Checklist de aceptación
1. `npm run test:finanzas` con resultados correctos.
2. `npm run type-check` y `npm run build` sin errores.
3. Comprobar caso Spot compra/venta, fees, pérdidas, transferencia sin P&L y consolidación Spot+Futures.
4. Comprobar error por venta superior a existencias.
5. Revisar la documentación y aceptar limitaciones.
6. Confirmar que no se exponen secretos ni se representa la demo como datos reales.
7. Integrar rama feature a develop; main se mantiene estable.
