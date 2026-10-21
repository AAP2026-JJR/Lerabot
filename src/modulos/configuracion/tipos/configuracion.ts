export type SeccionConfiguracion = 'general' | 'exchanges' | 'riesgos' | 'sistema'
export type EstadoParametro = 'activo' | 'inactivo' | 'pendiente'
export interface ProveedorConfigurado { id: string; nombre: string; productos: string[]; endpoint: string; estado: EstadoParametro }
export interface ParametroSistema { nombre: string; valor: string; descripcion: string; estado?: EstadoParametro }
export interface VistaConfiguracion { proveedores: ProveedorConfigurado[]; riesgos: ParametroSistema[]; sistema: ParametroSistema[] }
