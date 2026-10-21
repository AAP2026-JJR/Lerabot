# LERABOT - Fase 4.1: interfaz de configuracion

- Secciones: General, Exchanges, Riesgos y Sistema.
- Paneles distintos con datos demonstrativos claramente marcados.
- Se conserva la preferencia en memoria Pinia USD/PEN.
- Ningun endpoint privado ni PUT habilitado; Cognito sera requisito para escritura.
- No almacenar secretos ni API Keys en Vue, DynamoDB sin cifrado apropiado, ni en repositorio.
- Fase 4.2: disenar PK/SK y acceso por privilegios; Fase 4.3: Lambda; Fase 4.4: API Gateway; Fase 4.5: vincular UI.

Pruebas: npm run type-check; npm run build; comprobar las 4 pestanas y navegacion Mercado.
