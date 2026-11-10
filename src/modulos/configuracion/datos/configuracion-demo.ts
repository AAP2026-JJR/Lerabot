import type { VistaConfiguracion } from '../tipos/configuracion'

// Datos de demostracion. No reflejan la configuracion real de AWS ni habilitan trading.
export const configuracionDemo: VistaConfiguracion = {
  proveedores: [
    { id: 'binance', nombre: 'Binance', productos: ['Spot', 'Futures'], endpoint: 'https://api.binance.com', estado: 'pendiente' },
    { id: 'bingx', nombre: 'BingX', productos: ['Spot', 'Futures'], endpoint: 'https://open-api.bingx.com', estado: 'pendiente' },
    { id: 'bybit', nombre: 'Bybit', productos: ['Spot', 'Futures'], endpoint: 'https://api.bybit.com', estado: 'pendiente' },
  ],
  riesgos: [
    { nombre: 'Limite por operacion', valor: 'No configurado', descripcion: 'Requiere politicas y autorizacion de administrador.' },
    { nombre: 'Reintentos', valor: 'No configurado', descripcion: 'Pendiente de leer desde DynamoDB.' },
    { nombre: 'Alertas de riesgo', valor: 'No configurado', descripcion: 'No opera ni ejecuta operaciones.' },
  ],
  sistema: [
    { nombre: 'Configuracion global', valor: 'Pendiente de conexion', descripcion: 'API Gateway / Lambda / DynamoDB.' },
    { nombre: 'Auditoria de cambios', valor: 'Pendiente', descripcion: 'Registrar actor, fecha y version.' },
    { nombre: 'Acceso administrativo', valor: 'No habilitado', descripcion: 'Se activara despues de Cognito.' },
  ],
}
