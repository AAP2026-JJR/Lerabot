# LERABOT — Fase 4.6

## Alcance
Frontend Vue + Cognito OIDC PKCE + API Gateway REST /configuracion + Lambda + DynamoDB.

**NO habilitar escritura solo por activar CONFIG_WRITE_ENABLED.** Requiere API Gateway REST con Cognito User Pool Authorizer en GET y PUT y user admin en grupo `lerabot-admin`.

## AWS antes de probar el PUT
1. Crear Cognito User Pool en sa-east-1, grupo lerabot-admin, usuario administrador asignado al grupo; MFA recomendable/obligatorio en producción.
2. Crear App client SPA pública, SIN secreto, authorization code + PKCE. Configurar dominio Cognito y callback/logout `http://localhost:5173/configuracion` y después dominio real Amplify.
3. En la API REST `Lerabot` -> Authorizers crear COGNITO_USER_POOLS. Asociarlo a GET y PUT en Method request. No declarar authorization scopes en esos métodos si se utilizará ID token. OPTIONS sigue NONE/MOCK. Re-deploy stage prd.
4. Hacer prueba GET/PUT sin token: 401/403. Realizar prueba con sesión válida que pertenezca al grupo administrador.
5. Lambda: variable DYNAMODB_CONFIG_TABLE=ledabot-config; CORS_ALLOWED_ORIGINS, CONFIG_WRITE_ENABLED=true SOLAMENTE DESPUES del paso 3 y de probar la denegación anónima.
6. En Amplify agregar variables VITE_CONFIGURACION_API_URL, VITE_COGNITO_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_COGNITO_DOMAIN, VITE_COGNITO_REGION y VITE_COGNITO_REDIRECT_URI, y redeploy. Ninguna clave privada en VITE_.

## Variables frontend ejemplo (NO colocar secretos)
VITE_CONFIGURACION_API_URL=https://fnpeg3edxj.execute-api.sa-east-1.amazonaws.com/prd/configuracion
VITE_COGNITO_REGION=sa-east-1
VITE_COGNITO_POOL_ID=sa-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXX
VITE_COGNITO_DOMAIN=tu-dominio.auth.sa-east-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/configuracion

## Importante
- Lambda `index.mjs` es código fuente. Copiarlo manualmente a la consola AWS y pulsar Deploy. El script NO publica AWS.
- No tocar `/mercado`.
- La política UpdateItem ya se configuró; verificar que el rol de ejecución sea el correcto.
- La Lambda no tiene auditoría de actualizaciones: ANTES de activar cambios globales productivos se recomienda registro de auditoría e identidad, además de backup.
- Un cambio de configuración NO activa por sí solo órdenes reales de trading. Validar conectores antes de activar features.
- El panel General preexistente es de preferencias visuales y no modifica `defaults` de DynamoDB; el guardado aplica a Exchanges, Riesgos y Sistema.
- Probar: cargar -> activar Notifications -> guardar -> GET -> recargar -> revertir; token faltante; HTTP 409 con versión anterior; HTTP 400 configuración inválida.
- Si se modifica código local en AWS, mantener ambas copias sincronizadas.
