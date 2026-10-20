# LERABOT

Plataforma web multiusuario para consultar y consolidar balances, activos, operaciones y rendimiento de distintos exchanges.

## Estado
Fase 1: base del proyecto. Las integraciones con exchanges y la infraestructura AWS aun no estan implementadas.

## Tecnologias
- Frontend: Vue 3, TypeScript, Vite.
- Backend previsto: AWS Lambda (TypeScript), API Gateway y almacenamiento AWS.
- Autenticacion prevista: Amazon Cognito.
- Despliegue previsto: AWS Amplify vinculado a GitHub.

Scrip correr info de proyecto
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .\Exportar-Contexto-Lerabot.ps1
```


## Iniciar
```bash
npm install
npm run dev
npm run build
```

## Arquitectura
- `src/App.vue`, `src/main.ts`, `src/assets/`: entrada y estilos Vue.
- `src/componentes/`: componentes visuales reutilizables (comunes, estructura, graficos, tablas).
- `src/vistas/`: paginas principales (dashboard, exchanges, activos, trades, movimientos, reportes, ajustes).
- `src/rutas/`: definicion de rutas; se implementara cuando se instale Vue Router.
- `src/estado/`: estado compartido; se implementara al incorporar Pinia.
- `src/servicios/`: clientes HTTP hacia el API Gateway, nunca hacia exchanges privados.
- `src/reutilizables/`: logica reutilizable (composables).
- `src/tipos/`: interfaces y tipos TypeScript.
- `src/utilidades/`: funciones puras de formato/calculo.
- `backend/funciones/`: handlers Lambda separados por responsabilidad.
- `backend/compartido/proveedores/`: adaptadores de Binance, BingX, Bybit, etc.
- `backend/infraestructura/`: IaC futura.

## Criterios
- Las carpetas funcionales se nombran en espanol sin tildes, y se preservan las convenciones tecnicas obligatorias (`src`, `assets`, `App.vue`, etc.).
- Nunca guardar API Keys de exchanges en frontend, variables `VITE_` o GitHub.
- Las operaciones sobre exchanges seran inicialmente **solo lectura**.
- Los balances entre exchanges se consolidaran sin duplicar transferencias internas.
