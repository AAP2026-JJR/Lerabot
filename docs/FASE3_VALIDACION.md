# Validación y cierre Fase 3

## Pruebas técnicas (PowerShell desde raíz)
```
npm run test:finanzas
npm run type-check
npm run build
git status
```

## Revisión manual
- [ ] Confirmar fórmulas, moneda de reporte y promedio ponderado con ejemplos del usuario.
- [ ] Spot: compra, venta parcial, comisión y pérdida negativa.
- [ ] Futures: usar equity del proveedor, sin sumar el margen como patrimonio extra.
- [ ] Movimientos internos: ni rendimiento ni aportaciones; reconciliación real queda pendiente.
- [ ] No se presenta ROI/TWR/XIRR como calculado sin suficiente historial.
- [ ] Se entiende que los datos Demo NO son reales.
- [ ] No se suben `.env`, claves API ni secretos.
- [ ] Commit / Pull Request a develop, sin modificar main hasta aprobación.

## Criterio de cierre
**Esta versión deja la base matemática y los contratos de la Fase 3 listos para revisión**, pero no equivale a una cartera real auditada. Si se exige integración de API, conciliación completa de transferencias o visualización en Dashboard con resultados reales, esas tareas siguen pendientes. No cerrar como sistema financiero en producción.
