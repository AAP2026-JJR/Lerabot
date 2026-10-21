# Fase 4.5 - Integracion Vue con API restringida

- Modo demostracion: solo memoria, sin DynamoDB.
- Modo AWS: GET /prd/configuracion; por ahora se espera HTTP 403 sin autorizador.
- No se envia PUT. No se solicita ni almacena token IAM en el navegador.
- El GET directo Lambda (evento sin requestContext) funciona para prueba administrativa en AWS.
- Por seguridad la ruta de API conserva acceso restringido.
- Antes de integrar Cognito, no publicar lecturas privadas ni escrituras.
- Lambda: agregar CORS a todas las respuestas incluidas 403; requiere modificar codigo desplegado manualmente, ya que la Lambda NO aparece en el ZIP recibido.
- Configurar VITE_CONFIGURACION_API_URL en .env.local y luego en Amplify al habilitar autorizacion.
