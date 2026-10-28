# LERABOT — Fase 6 final: operaciones financieras

- Tabla financiera por operación Spot: precio de compra, cantidad, invertido USD, cotización de Mercado, valor actual, PnL no realizado y ROI.
- Invertido = precio de entrada * cantidad. Valor actual = precio de mercado * cantidad. PnL no realizado = valor actual - invertido. ROI = PnL / invertido * 100.
- Calcula únicamente compras cotizadas de la página visible. No se afirma un patrimonio completo ni se infiere saldo disponible tras ventas.
- PnL realizado, fees, retiros y consolidación entre exchanges necesitan fuente de ejecuciones y conciliación adicional.
- La tabla usa paginación mediante cursor de DynamoDB y filtros de los registros cargados.
- La Lambda no requiere cambios: GET /operaciones, /operaciones/resumen y /operaciones/detalle existentes.
- AWS CLI en modo diagnostico consulta identidad, Lambda y stage; no modifica IAM, API Gateway ni DynamoDB.
- Comprueba VITE_MERCADO_API_URL y, opcionalmente, VITE_OPERACIONES_API_URL en los entornos de ejecución sin compartir secretos.
